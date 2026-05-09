#!/usr/bin/env node
/**
 * v5 fill-bank — 直连 dashscope，绕开 Cloudflare 30s 硬限。
 *
 * 跟 v4 的区别：
 *   - **直连 dashscope/qwen-plus** (不走 /api/generate/questions)
 *   - 单批 count=10 wallclock ~116s，AI 100% 完成度（每次拿满）
 *   - 并发 3 个 skill（>3 触发 alibaba 端 rate limit）
 *   - 客户端补 stemMatchesSkill / off_topic 检查（之前 server 做的）
 *   - AI judge 仍走 Cloudflare（judge 短，30s 够用）
 *
 * 守住 v3/v4 的所有铁律：
 *   - autoFix 只动纯元数据
 *   - filter 不 force 非法 enum
 *   - vfail/afail/off_topic/judge_delete 全部落盘 → /tmp/vfail-samples.jsonl 等
 *   - 同 skill 连续 N 次 0 通过 → 跳过本轮
 *   - 不写 force-fix loop
 *
 * 用法：
 *   APP_PASSWORD + DASHSCOPE_API_KEY 都从 ~/Desktop/xy/.dev.vars 自动注入
 *   node scripts/_fill-bank-v5.mjs <target=30> <passes=4> <concurrency=3> <batchSize=10> [termFilter]
 *   termFilter: "上册" / "下册" / "综合复习" / 不传 = 全部
 */
import { build } from "esbuild";
import { writeFileSync, readFileSync, appendFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// 注入 .dev.vars (parent dir 优先)
for (const path of [join(PROJECT_ROOT, "..", ".dev.vars"), join(PROJECT_ROOT, ".dev.vars")]) {
  try {
    const dv = readFileSync(path, "utf8");
    for (const line of dv.split("\n")) {
      const [k, ...rest] = line.split("=");
      if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
    }
  } catch { /* */ }
}

const APP_PWD = process.env.APP_PASSWORD;
const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY;
if (!APP_PWD) { console.error("APP_PASSWORD env required"); process.exit(1); }
if (!DASHSCOPE_KEY) { console.error("DASHSCOPE_API_KEY env required (~/Desktop/xy/.dev.vars)"); process.exit(1); }

const TARGET_PER_SKILL = Number(process.argv[2] ?? 30);
const PASSES = Number(process.argv[3] ?? 4);
const CONCURRENCY = Number(process.argv[4] ?? 3);
const BATCH_SIZE = Number(process.argv[5] ?? 10);
const TERM_FILTER = process.argv[6];  // optional

const PROD = "https://selena-elevate.pages.dev";
const DASHSCOPE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";
const VFAIL_SAMPLES = "/tmp/vfail-samples.jsonl";
const VFAIL_SUMMARY = "/tmp/vfail-summary.json";
const JUDGE_DELETE_SAMPLES = "/tmp/judge-delete-samples.jsonl";
const PER_CALL_TIMEOUT_MS = 240_000;  // 4 分钟（直连 alibaba，没 Cloudflare 30s 限）

// ============================================================
//  build prompt composer + content
// ============================================================
const t1 = join(tmpdir(), `fbv5pc-${Date.now()}.mjs`);
await build({
  entryPoints: [join(PROJECT_ROOT, "functions/_promptComposer.ts")],
  bundle: true, format: "esm", platform: "node", outfile: t1, logLevel: "error",
});
const { composeQuestionUserPrompt } = await import(t1);

const t2 = join(tmpdir(), `fbv5pg-${Date.now()}.mjs`);
await build({
  entryPoints: [join(PROJECT_ROOT, "functions/_prompts.generated.ts")],
  bundle: true, format: "esm", platform: "node", outfile: t2, logLevel: "error",
});
const { PROMPTS } = await import(t2);

const t3 = join(tmpdir(), `fbv5lc-${Date.now()}.mjs`);
await build({
  entryPoints: [join(PROJECT_ROOT, "scripts/_load-content-extended.ts")],
  bundle: true, format: "esm", platform: "node", outfile: t3, logLevel: "error",
});
const { SEED_QUESTIONS, validateQuestion, auditQuestion, SKILLS, UNITS } = await import(t3);
[t1, t2, t3].forEach(p => rmSync(p, { force: true }));

const SKILL_BY = new Map(SKILLS.map(s => [s.id, s]));
const UNIT_BY = new Map(UNITS.map(u => [u.id, u]));

// ============================================================
//  优先级 + term filter
// ============================================================
const priorities = JSON.parse(readFileSync("/tmp/priorities.json", "utf8"));
// 不再 hard-cap — 由 priorities 决定全集，pass 内 ZERO_THRESHOLD 自动跳过卡死的
let skills = priorities.topToFill;
if (TERM_FILTER) {
  skills = skills.filter(s => s.term === TERM_FILTER);
  process.stderr.write(`▶ term=${TERM_FILTER} 过滤后 ${skills.length} 个 skill\n`);
}

const sysPrompt = PROMPTS.questionsSystem.replace(/\{\{subjectLabel\}\}/g, "数学");

process.stderr.write(`▶ v5 直连 dashscope/qwen-plus: ${skills.length} skills, target ${TARGET_PER_SKILL}, passes ${PASSES}, concurrency ${CONCURRENCY}, batch ${BATCH_SIZE}\n`);

// ============================================================
//  existingStems：SEED + D1 (per skill)
// ============================================================
const existingAiStemsBySkill = new Map();
try {
  const aj = JSON.parse(readFileSync("/tmp/aiqs.json", "utf8"));
  if (Array.isArray(aj.rows)) {
    for (const r of aj.rows) {
      if (r?.skill_id && typeof r?.stem === "string") {
        const arr = existingAiStemsBySkill.get(r.skill_id) ?? [];
        arr.push(r.stem);
        existingAiStemsBySkill.set(r.skill_id, arr);
      }
    }
  }
  process.stderr.write(`▶ Loaded existing AI stems: ${[...existingAiStemsBySkill.values()].reduce((s, a) => s + a.length, 0)} 道（${existingAiStemsBySkill.size} skill）\n`);
} catch (e) {
  process.stderr.write(`▶ Warn: 没读到 /tmp/aiqs.json (${e.message})\n`);
}

function existingStemsFor(skillId, batchAccepted = []) {
  const out = [];
  for (const q of SEED_QUESTIONS) {
    if (q.skill_id === skillId && typeof q.stem === "string") out.push(q.stem);
  }
  for (const s of (existingAiStemsBySkill.get(skillId) ?? [])) out.push(s);
  for (const q of batchAccepted) {
    if (typeof q.stem === "string") out.push(q.stem);
  }
  return out;
}

// ============================================================
//  client-side stemMatchesSkill (mirror server)
// ============================================================
function stemMatchesSkill(stem, skillId, skillName) {
  if (!stem) return false;
  if (!skillId) return true;
  const explicit = PROMPTS.skillKeywords?.[skillId];
  let keywords;
  if (explicit && explicit.length > 0) {
    keywords = explicit;
  } else if (skillName) {
    const fuzz = [];
    for (let i = 0; i < skillName.length - 1; i++) fuzz.push(skillName.slice(i, i + 2));
    keywords = fuzz;
  } else {
    return true;
  }
  return keywords.some((kw) => stem.includes(kw));
}

// ============================================================
//  autoFix — copied from v4 (safe metadata only)
// ============================================================
function autoFix(rawQ, sk) {
  const q = { ...rawQ };
  const skillDef = SKILL_BY.get(sk.skillId);
  const unitDef = UNIT_BY.get(sk.unitId);

  if (!q.subjectId) q.subjectId = "math";
  if (!q.status) q.status = "approved";
  if (!q.version) q.version = 1;
  if (!q.grade) q.grade = 4;
  if (!q.skill_name && skillDef) q.skill_name = skillDef.name;
  if (!q.unit_name && unitDef) q.unit_name = unitDef.name;
  if (!Array.isArray(q.hints)) q.hints = [];
  if (!Array.isArray(q.tags)) q.tags = [];

  // 数字字段的字符串转数字 (AI 偶尔给 "1" / "4" 字符串)
  // 安全：只是机械类型转换，不引入新事实
  for (const key of ["version", "grade", "difficulty", "estimated_time_seconds"]) {
    if (typeof q[key] === "string" && /^-?\d+(\.\d+)?$/.test(q[key])) {
      q[key] = Number(q[key]);
    }
  }

  const VALID_ABILITY = new Set([
    "calculation", "concept", "reasoning", "modeling",
    "spatial", "data", "strategy", "habit",
  ]);
  if (Array.isArray(q.ability_dimension)) {
    const filtered = q.ability_dimension.filter((a) => VALID_ABILITY.has(a));
    if (filtered.length > 0 && filtered.length < q.ability_dimension.length) {
      q.ability_dimension = filtered;
    }
  }

  if (Array.isArray(q.solution_steps)) {
    q.solution_steps = q.solution_steps.map((s) => {
      if (typeof s === "string") return s;
      if (s && typeof s === "object") {
        if (typeof s.text === "string") return s.text;
        if (typeof s.step === "string") return s.step;
        if (typeof s.description === "string") return s.description;
        const vals = Object.values(s).filter((v) => typeof v === "string");
        if (vals.length > 0) return vals.join("：");
      }
      return String(s);
    }).filter((s) => s && s.length > 0);
  }

  if (Array.isArray(q.hints)) {
    q.hints = q.hints.map((h) => {
      if (h && typeof h === "object" && typeof h.penalty === "number" && !Number.isInteger(h.penalty)) {
        const p = h.penalty < 1 ? Math.round(h.penalty * 10) : Math.round(h.penalty);
        return { ...h, penalty: Math.max(1, Math.min(5, p)) };
      }
      return h;
    });
  }

  return q;
}

// ============================================================
//  Direct dashscope call — count=N batch
// ============================================================
async function genBatchDirect(skill, batchAccepted = []) {
  const stems = existingStemsFor(skill.skillId, batchAccepted);
  const userPrompt = composeQuestionUserPrompt({
    subjectId: "math",
    unitId: skill.unitId,
    unitName: skill.unitName,
    skillId: skill.skillId,
    skillName: skill.skillName,
    term: skill.term === "综合复习" ? undefined : skill.term,
    difficulty: "2-4",
    count: BATCH_SIZE,
    existingStems: stems,
    batchAngle: "数字换一组",
    callerTag: "fill-bank-v5",
  });

  // 单道 token 估算：v0.31.68 实测 plain_choice 多步题也常超 800（如小数乘加），
  // 1500 默认更稳；word_problem_lab / shop_counter / balance_lab 应用题更长，给 2000
  const skillDef = SKILL_BY.get(skill.skillId);
  const gameType = (PROMPTS.gameTypeBySkill ?? {})[skill.skillId];
  const heavyTypes = new Set(["word_problem_lab", "shop_counter", "balance_lab"]);
  const perItemTokens = heavyTypes.has(gameType) ? 2000 : 1500;
  const estMaxTokens = Math.min(28000, Math.max(3000, BATCH_SIZE * perItemTokens + 500));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_CALL_TIMEOUT_MS);
  let r;
  try {
    r = await fetch(DASHSCOPE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DASHSCOPE_KEY}` },
      body: JSON.stringify({
        model: "qwen-plus",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: estMaxTokens,
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) {
    const txt = await r.text();
    const e = new Error(`dashscope ${r.status}: ${txt.slice(0, 100)}`);
    throw e;
  }
  const j = await r.json();
  const content = j.choices?.[0]?.message?.content ?? "";
  let parsed;
  try { parsed = JSON.parse(content); } catch (e) {
    throw new Error(`json_parse_failed: ${e.message?.slice(0, 80)}`);
  }
  return Array.isArray(parsed.questions) ? parsed.questions : [];
}

// ============================================================
//  AI Judge — 仍走 Cloudflare（短 prompt 30s 够）
// ============================================================
async function judgeBatch(questions) {
  if (!questions.length) return new Map();
  const summaries = questions.map(q => ({
    question_id: q.question_id,
    stem: q.stem,
    skill_id: q.skill_id,
    skill_name: q.skill_name,
    unit_id: q.unit_id,
    game_type: q.game_type,
    difficulty: q.difficulty,
    estimated_time_seconds: q.estimated_time_seconds,
    options: Array.isArray(q.options) ? q.options : undefined,
    answer: q.answer,
    common_errors: q.common_errors,
    hints: q.hints,
    solution_steps: q.solution_steps,
    tags: q.tags,
  }));
  const r = await fetch(`${PROD}/api/agent/judge-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${APP_PWD}` },
    body: JSON.stringify({
      subjectId: "math",
      scopeLabel: "fill-bank-v5",
      scopeFilter: "ai_generated",
      questions: summaries,
    }),
  });
  if (!r.ok) {
    process.stderr.write(`  judge HTTP ${r.status}\n`);
    return new Map();
  }
  let body;
  try { body = await r.json(); } catch { return new Map(); }
  if (!body.ok || !Array.isArray(body.judgments)) return new Map();
  const map = new Map();
  for (const j of body.judgments) if (j?.question_id) map.set(j.question_id, j);
  return map;
}

// ============================================================
//  per-skill 单批闭环
// ============================================================
const consecutiveZeroBySkill = new Map();
const ZERO_THRESHOLD = 2;

const stats = {
  totalGen: 0, totalAccepted: 0, totalVfail: 0, totalAfail: 0,
  totalOffTopic: 0, totalDup: 0,
  totalJudgeDelete: 0, totalJudgeBorderline: 0, totalJudgeKeep: 0,
  byIssueHist: {}, vfailExamples: {},
};

async function fillSkillOnce(skill, batchAccepted) {
  if ((consecutiveZeroBySkill.get(skill.skillId) ?? 0) >= ZERO_THRESHOLD) {
    return { kept: [], dropped: 0, reason: "skipped_threshold" };
  }
  const have = batchAccepted.length;
  const target = Math.min(skill.need ?? TARGET_PER_SKILL, TARGET_PER_SKILL);
  if (have >= target) return { kept: [], dropped: 0, reason: "target_reached" };

  // 1. gen
  const t0 = Date.now();
  let questions;
  try {
    questions = await genBatchDirect(skill, batchAccepted);
    stats.totalGen += questions.length;
  } catch (e) {
    process.stderr.write(`    ${skill.skillName}: gen fail (${e.message?.slice(0, 80)})\n`);
    return { kept: [], dropped: 0, reason: e.message?.slice(0, 50) };
  }
  process.stderr.write(`    ${skill.skillName}: gen ${questions.length} 道 in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  // 2. validate / off_topic / audit / dedup
  const passingValidation = [];
  const existingSet = new Set(existingStemsFor(skill.skillId, batchAccepted));

  for (const rawQ of questions) {
    const q = autoFix(rawQ, skill);

    // off_topic check (server 层之前做，现在客户端做)
    if (!stemMatchesSkill(q.stem, skill.skillId, skill.skillName)) {
      stats.totalOffTopic++;
      try {
        appendFileSync(VFAIL_SAMPLES, JSON.stringify({ skillId: skill.skillId, kind: "off_topic", q }) + "\n");
      } catch { /* */ }
      continue;
    }

    const v = validateQuestion(q);
    if (!v.ok) {
      stats.totalVfail++;
      const issueKeys = v.issues.map((i) => `${i.severity}:${i.path}:${i.message.slice(0, 40)}`);
      for (const k of issueKeys) {
        stats.byIssueHist[skill.skillId] ??= {};
        stats.byIssueHist[skill.skillId][k] = (stats.byIssueHist[skill.skillId][k] ?? 0) + 1;
      }
      stats.vfailExamples[skill.skillId] ??= [];
      if (stats.vfailExamples[skill.skillId].length < 3) {
        stats.vfailExamples[skill.skillId].push({ q, issues: v.issues });
      }
      try {
        appendFileSync(VFAIL_SAMPLES, JSON.stringify({ skillId: skill.skillId, kind: "vfail", issues: v.issues, q }) + "\n");
      } catch { /* */ }
      continue;
    }

    const a = auditQuestion(v.question);
    if (a.worstSeverity === "critical" || a.worstSeverity === "likely-broken") {
      stats.totalAfail++;
      try {
        appendFileSync(VFAIL_SAMPLES, JSON.stringify({ skillId: skill.skillId, kind: "afail", severity: a.worstSeverity, issues: a.issues, q: v.question }) + "\n");
      } catch { /* */ }
      continue;
    }

    if (existingSet.has(v.question.stem)) {
      stats.totalDup++;
      try {
        appendFileSync(VFAIL_SAMPLES, JSON.stringify({ skillId: skill.skillId, kind: "dup", q: v.question }) + "\n");
      } catch { /* */ }
      continue;
    }
    existingSet.add(v.question.stem);

    passingValidation.push({
      ...v.question,
      subjectId: "math",
      status: "approved",
      tags: Array.from(new Set([...(v.question.tags ?? []), "ai_generated"])),
    });
  }

  if (!passingValidation.length) {
    consecutiveZeroBySkill.set(skill.skillId, (consecutiveZeroBySkill.get(skill.skillId) ?? 0) + 1);
    return { kept: [], dropped: questions.length, reason: "all_failed_validation" };
  }

  // 3. AI judge
  process.stderr.write(`    ${skill.skillName}: judge ${passingValidation.length} 道…\n`);
  const judgments = await judgeBatch(passingValidation);
  const finalKept = [];
  for (const q of passingValidation) {
    const j = judgments.get(q.question_id);
    if (!j) {
      finalKept.push(q);
      stats.totalJudgeKeep++;
    } else if (j.verdict === "delete") {
      stats.totalJudgeDelete++;
      try {
        appendFileSync(JUDGE_DELETE_SAMPLES, JSON.stringify({ skillId: skill.skillId, judgment: j, q }) + "\n");
      } catch { /* */ }
    } else if (j.verdict === "borderline") {
      stats.totalJudgeBorderline++;
      finalKept.push({
        ...q,
        status: "needs_review",
        tags: Array.from(new Set([...(q.tags ?? []), "judge_borderline"])),
      });
      try {
        appendFileSync(JUDGE_DELETE_SAMPLES, JSON.stringify({ skillId: skill.skillId, judgment: j, q, kept: true }) + "\n");
      } catch { /* */ }
    } else {
      finalKept.push(q);
      stats.totalJudgeKeep++;
    }
  }

  if (finalKept.length === 0) {
    consecutiveZeroBySkill.set(skill.skillId, (consecutiveZeroBySkill.get(skill.skillId) ?? 0) + 1);
  } else {
    consecutiveZeroBySkill.set(skill.skillId, 0);
  }
  stats.totalAccepted += finalKept.length;
  return { kept: finalKept, dropped: questions.length - finalKept.length, reason: "ok" };
}

// ============================================================
//  并发调度 + 多 pass
// ============================================================
const acceptedBySkill = new Map();
for (const sk of skills) acceptedBySkill.set(sk.skillId, []);

async function runWorker(queue, workerId) {
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    const { skill } = item;
    const batchAccepted = acceptedBySkill.get(skill.skillId) ?? [];
    process.stderr.write(`  [w${workerId}] ▶ ${skill.skillName} have ${batchAccepted.length}/${skill.need ?? TARGET_PER_SKILL}\n`);
    const result = await fillSkillOnce(skill, batchAccepted);
    if (result.kept.length > 0) {
      acceptedBySkill.get(skill.skillId).push(...result.kept);
    }
    process.stderr.write(`  [w${workerId}] ✓ ${skill.skillName}: kept ${result.kept.length} dropped ${result.dropped} (${result.reason})\n`);
    await new Promise(r => setTimeout(r, 1500));
  }
}

for (let pass = 1; pass <= PASSES; pass++) {
  const queue = skills
    .filter(sk => {
      if ((consecutiveZeroBySkill.get(sk.skillId) ?? 0) >= ZERO_THRESHOLD) return false;
      const have = (acceptedBySkill.get(sk.skillId) ?? []).length;
      const target = Math.min(sk.need ?? TARGET_PER_SKILL, TARGET_PER_SKILL);
      return have < target;
    })
    .map(skill => ({ skill }));

  if (queue.length === 0) {
    process.stderr.write(`▶ Pass ${pass}: 没有 skill 需要补题，结束\n`);
    break;
  }

  process.stderr.write(`\n◀▶ Pass ${pass}: queue=${queue.length} skill, concurrency=${CONCURRENCY}\n`);

  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, (_, i) => runWorker(queue, i + 1));
  await Promise.all(workers);

  const passAccepted = Array.from(acceptedBySkill.values()).reduce((s, a) => s + a.length, 0);
  process.stderr.write(`◀ Pass ${pass} done: total ${passAccepted}, vfail ${stats.totalVfail}, afail ${stats.totalAfail}, off_topic ${stats.totalOffTopic}, dup ${stats.totalDup}, judge {keep ${stats.totalJudgeKeep}, borderline ${stats.totalJudgeBorderline}, delete ${stats.totalJudgeDelete}}\n`);

  if (pass < PASSES) await new Promise(r => setTimeout(r, 5000));
}

// ============================================================
//  Push to D1 (per-row /api/sync/ai-questions)
// ============================================================
const allAccepted = Array.from(acceptedBySkill.values()).flat();
process.stderr.write(`\n▶ 总结：gen ${stats.totalGen}, accepted ${allAccepted.length}, vfail ${stats.totalVfail}, afail ${stats.totalAfail}, off_topic ${stats.totalOffTopic}, dup ${stats.totalDup}, judge {keep ${stats.totalJudgeKeep}, borderline ${stats.totalJudgeBorderline}, delete ${stats.totalJudgeDelete}}\n`);

if (allAccepted.length > 0) {
  process.stderr.write(`▶ Push 经 /api/sync/ai-questions 端点…\n`);
  writeFileSync("/tmp/fillbank-pending.json", JSON.stringify({ rows: allAccepted, ts: Date.now() }));
  const PUSH_BATCH = 30;
  let pushedTotal = 0, failedTotal = 0;
  for (let i = 0; i < allAccepted.length; i += PUSH_BATCH) {
    const batch = allAccepted.slice(i, i + PUSH_BATCH);
    const waits = [0, 3_000, 15_000];
    let pushed = false;
    for (let attempt = 0; attempt < waits.length && !pushed; attempt++) {
      if (waits[attempt] > 0) await new Promise(r => setTimeout(r, waits[attempt]));
      try {
        const up = await fetch(`${PROD}/api/sync/ai-questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${APP_PWD}` },
          body: JSON.stringify({ rows: batch }),
        });
        if (!up.ok) { process.stderr.write(`  batch ${i / PUSH_BATCH + 1} attempt ${attempt + 1}: HTTP ${up.status}\n`); continue; }
        const txt = await up.text();
        if (!txt.startsWith("{")) continue;
        const uj = JSON.parse(txt);
        pushedTotal += uj.accepted ?? 0;
        if (uj.rejected?.length) failedTotal += uj.rejected.length;
        pushed = true;
        process.stderr.write(`  batch ${i / PUSH_BATCH + 1}/${Math.ceil(allAccepted.length / PUSH_BATCH)}: ✓ accepted ${uj.accepted}\n`);
      } catch (e) {
        process.stderr.write(`  batch ${i / PUSH_BATCH + 1} threw: ${e.message?.slice(0, 80)}\n`);
      }
    }
    if (!pushed) failedTotal += batch.length;
  }
  process.stderr.write(`✓ Push: accepted ${pushedTotal}, failed ${failedTotal}\n`);
  if (failedTotal === 0) try { rmSync("/tmp/fillbank-pending.json", { force: true }); } catch {}
}

// vfail summary
const skipped = skills.filter(s => (consecutiveZeroBySkill.get(s.skillId) ?? 0) >= ZERO_THRESHOLD);
writeFileSync(VFAIL_SUMMARY, JSON.stringify({
  ...stats,
  skipped: skipped.map(s => ({ skillId: s.skillId, skillName: s.skillName })),
  pushedNew: allAccepted.length,
}, null, 2));

console.log(JSON.stringify({
  accepted: allAccepted.length,
  vfail: stats.totalVfail, afail: stats.totalAfail, off_topic: stats.totalOffTopic, dup: stats.totalDup,
  judge_delete: stats.totalJudgeDelete, judge_borderline: stats.totalJudgeBorderline,
  perSkill: Object.fromEntries(Array.from(acceptedBySkill).map(([k, v]) => [k, v.length])),
}, null, 2));
