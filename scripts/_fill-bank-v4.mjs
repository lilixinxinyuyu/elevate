#!/usr/bin/env node
/**
 * v4 fill-bank — count=N 批量出 + 并发 + AI judge 接闭环
 *
 * 跟 v3 的区别：
 *   - 一次 gen 出 N 道（默认 20，不是 1 道）→ system prompt 重用，token 降 ~95%
 *   - 同时跑多个 skill（concurrency）
 *   - 接 AI judge 复检：accepted 批 → judgeBatch → keep/borderline 入库 / delete 落盘
 *   - existingStems **全量传**（client + server 都不裁）
 *
 * 守住 v3 的所有铁律：
 *   - autoFix 只动纯元数据
 *   - filter 不 force 非法 enum
 *   - vfail/afail/judge_delete 全部落盘 → /tmp/{vfail,judge_delete}-samples.jsonl
 *   - 同 skill 连续 N 次 0 通过 → 跳过本轮（避免空转）
 *   - 不写"自动重生成直到合规"force-loop（爸爸明确反对）
 *
 * 用法：APP_PASSWORD=... node scripts/_fill-bank-v4.mjs <target=20> <passes=4> <concurrency=4> <batchSize=20>
 */

import { build } from "esbuild";
import { writeFileSync, readFileSync, appendFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const tmpFile = join(tmpdir(), `fillbankv4-${Date.now()}.mjs`);

const PWD = process.env.APP_PASSWORD;
if (!PWD) { console.error("APP_PASSWORD env required"); process.exit(1); }

const TARGET_PER_SKILL = Number(process.argv[2] ?? 20);
const PASSES = Number(process.argv[3] ?? 4);
const CONCURRENCY = Number(process.argv[4] ?? 4);
const BATCH_SIZE = Number(process.argv[5] ?? 20);
const PROD = "https://selena-elevate.pages.dev";
const VFAIL_SAMPLES = "/tmp/vfail-samples.jsonl";
const VFAIL_SUMMARY = "/tmp/vfail-summary.json";
const JUDGE_DELETE_SAMPLES = "/tmp/judge-delete-samples.jsonl";

await build({
  entryPoints: [join(PROJECT_ROOT, "scripts/_load-content-extended.ts")],
  bundle: true, format: "esm", platform: "node", outfile: tmpFile, logLevel: "error",
});
const { SEED_QUESTIONS, validateQuestion, auditQuestion, SKILLS, UNITS } = await import(tmpFile);
rmSync(tmpFile, { force: true });

const SKILL_BY = new Map(SKILLS.map(s => [s.id, s]));
const UNIT_BY = new Map(UNITS.map(u => [u.id, u]));

const priorities = JSON.parse(readFileSync("/tmp/priorities.json", "utf8"));
const skills = priorities.topToFill.slice(0, 24);
process.stderr.write(`▶ v4 closed-loop+judge: ${skills.length} skills, target ${TARGET_PER_SKILL}, passes ${PASSES}, concurrency ${CONCURRENCY}, batch ${BATCH_SIZE}\n`);

const auth = `Bearer ${PWD}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
//  autoFix — copied from v3, safe metadata only
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

  // filter ability_dimension invalid enums
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

  // solution_steps obj → string
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

  // hints[].penalty float → int
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
//  Generate — count=N batch
// ============================================================
async function genBatch(skill, batchAccepted = []) {
  const stems = existingStemsFor(skill.skillId, batchAccepted);
  const r = await fetch(`${PROD}/api/generate/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({
      subjectId: "math",
      unitId: skill.unitId, unitName: skill.unitName,
      skillId: skill.skillId, skillName: skill.skillName,
      count: BATCH_SIZE,
      difficulty: "2-4",
      term: skill.term === "综合复习" ? undefined : skill.term,
      existingStems: stems,
    }),
  });
  const txt = await r.text();
  if (!r.ok) {
    const isBudget = r.status === 502 && (txt.includes("budget") || txt.includes("timeout") || txt.includes("no_model_worked"));
    const isOffTopic = txt.includes("off_topic") || txt.includes("none matched skill");
    const e = new Error(`gen ${r.status}: ${txt.slice(0, 150)}`);
    e.isBudget = isBudget;
    e.isOffTopic = isOffTopic;
    throw e;
  }
  const j = JSON.parse(txt);
  if (!j.ok || !Array.isArray(j.questions)) throw new Error("empty_response");
  return j.questions;
}

// ============================================================
//  AI Judge — 接闭环
// ============================================================
async function judgeBatch(questions, subjectId = "math") {
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
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({
      subjectId,
      scopeLabel: "fill-bank-v4 batch",
      scopeFilter: "ai_generated",
      questions: summaries,
    }),
  });
  const txt = await r.text();
  if (!r.ok) {
    process.stderr.write(`  judge HTTP ${r.status}: ${txt.slice(0, 100)}\n`);
    return new Map();  // judge 失败时全部按 keep 处理（不阻塞入库）
  }
  let body;
  try { body = JSON.parse(txt); } catch { return new Map(); }
  if (!body.ok || !Array.isArray(body.judgments)) return new Map();

  const map = new Map();
  for (const j of body.judgments) {
    if (j?.question_id) map.set(j.question_id, j);
  }
  return map;
}

// ============================================================
//  per-skill 单批闭环
// ============================================================
const consecutiveZeroBySkill = new Map();
const ZERO_THRESHOLD = 3;  // 同 skill 连续 3 次 0 通过 → 跳过本 round

const stats = {
  totalGen: 0, totalAccepted: 0, totalVfail: 0, totalAfail: 0,
  totalDup: 0, totalJudgeDelete: 0, totalJudgeBorderline: 0, totalJudgeKeep: 0,
  totalBudget: 0, totalOffTopic: 0,
  byIssueHist: {}, vfailExamples: {},
};

async function fillSkillOnce(skill, batchAccepted) {
  if ((consecutiveZeroBySkill.get(skill.skillId) ?? 0) >= ZERO_THRESHOLD) {
    return { kept: [], dropped: 0, reason: "skipped_threshold" };
  }

  const have = batchAccepted.length;
  const target = Math.min(skill.need ?? TARGET_PER_SKILL, TARGET_PER_SKILL);
  if (have >= target) return { kept: [], dropped: 0, reason: "target_reached" };

  // 1. gen N
  let questions;
  try {
    questions = await genBatch(skill, batchAccepted);
    stats.totalGen += questions.length;
  } catch (e) {
    if (e.isBudget) stats.totalBudget++;
    if (e.isOffTopic) stats.totalOffTopic++;
    return { kept: [], dropped: 0, reason: e.message?.slice(0, 80) };
  }

  // 2. validate / audit / dedup per question
  const passingValidation = [];
  const existingSet = new Set(existingStemsFor(skill.skillId, batchAccepted));

  for (const rawQ of questions) {
    const q = autoFix(rawQ, skill);

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

    // 3. exact stem dedup
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

  // 4. AI judge
  const judgments = await judgeBatch(passingValidation);
  const finalKept = [];
  for (const q of passingValidation) {
    const j = judgments.get(q.question_id);
    if (!j) {
      // judge 没返回 → 保守入库（按 keep 处理）
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

async function runWorker(queue) {
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    const { skill } = item;
    const batchAccepted = acceptedBySkill.get(skill.skillId) ?? [];
    process.stderr.write(`  ▶ ${skill.skillName.slice(0, 12)} have ${batchAccepted.length}/${skill.need ?? TARGET_PER_SKILL}\n`);
    const result = await fillSkillOnce(skill, batchAccepted);
    if (result.kept.length > 0) {
      acceptedBySkill.get(skill.skillId).push(...result.kept);
    }
    process.stderr.write(`    ${skill.skillName.slice(0, 12)}: kept ${result.kept.length} dropped ${result.dropped} (${result.reason})\n`);
    await sleep(500);
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

  process.stderr.write(`◀▶ Pass ${pass}: queue=${queue.length} skill, concurrency=${CONCURRENCY}\n`);

  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => runWorker(queue));
  await Promise.all(workers);

  const passAccepted = Array.from(acceptedBySkill.values()).reduce((s, a) => s + a.length, 0);
  process.stderr.write(`◀ Pass ${pass} done: total accepted ${passAccepted}, vfail ${stats.totalVfail}, afail ${stats.totalAfail}, dup ${stats.totalDup}, judge_delete ${stats.totalJudgeDelete}, judge_borderline ${stats.totalJudgeBorderline}\n`);

  if (pass < PASSES) await sleep(3000);
}

// ============================================================
//  Push 到 D1
// ============================================================
const allAccepted = Array.from(acceptedBySkill.values()).flat();
process.stderr.write(`▶ 总结：gen ${stats.totalGen}, accepted ${allAccepted.length}, vfail ${stats.totalVfail}, afail ${stats.totalAfail}, dup ${stats.totalDup}, judge {keep ${stats.totalJudgeKeep}, borderline ${stats.totalJudgeBorderline}, delete ${stats.totalJudgeDelete}}, budget ${stats.totalBudget}\n`);

if (allAccepted.length > 0) {
  process.stderr.write(`▶ Push 经 /api/sync/ai-questions 端点 (按行 upsert)…\n`);
  writeFileSync("/tmp/fillbank-pending.json", JSON.stringify({ rows: allAccepted, ts: Date.now() }));

  const PUSH_BATCH = 30;
  let pushedTotal = 0;
  let failedTotal = 0;

  for (let i = 0; i < allAccepted.length; i += PUSH_BATCH) {
    const batch = allAccepted.slice(i, i + PUSH_BATCH);
    const waits = [0, 3_000, 15_000, 60_000];
    let batchPushed = false;
    for (let attempt = 0; attempt < waits.length && !batchPushed; attempt++) {
      if (waits[attempt] > 0) await sleep(waits[attempt]);
      try {
        const up = await fetch(`${PROD}/api/sync/ai-questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: auth },
          body: JSON.stringify({ rows: batch }),
        });
        if (!up.ok) {
          process.stderr.write(`  batch ${i / PUSH_BATCH + 1} attempt ${attempt + 1}: HTTP ${up.status}\n`);
          continue;
        }
        const txt = await up.text();
        if (!txt.startsWith("{")) {
          process.stderr.write(`  batch ${i / PUSH_BATCH + 1} attempt ${attempt + 1}: non-JSON\n`);
          continue;
        }
        const uj = JSON.parse(txt);
        pushedTotal += uj.accepted ?? 0;
        if (uj.rejected?.length) {
          failedTotal += uj.rejected.length;
          process.stderr.write(`  batch ${i / PUSH_BATCH + 1} rejected ${uj.rejected.length} 道\n`);
        }
        batchPushed = true;
        process.stderr.write(`  batch ${i / PUSH_BATCH + 1}/${Math.ceil(allAccepted.length / PUSH_BATCH)}: ✓ accepted ${uj.accepted}\n`);
      } catch (e) {
        process.stderr.write(`  batch ${i / PUSH_BATCH + 1} attempt ${attempt + 1} threw: ${e.message?.slice(0, 80)}\n`);
      }
    }
    if (!batchPushed) {
      failedTotal += batch.length;
      process.stderr.write(`✗ batch ${i / PUSH_BATCH + 1} 全部重试失败\n`);
    }
  }
  process.stderr.write(`✓ Push 完成：accepted ${pushedTotal}, failed ${failedTotal}\n`);
  if (failedTotal === 0) {
    try { rmSync("/tmp/fillbank-pending.json", { force: true }); } catch {}
  }
}

// vfail summary
const skipped = skills.filter(s => (consecutiveZeroBySkill.get(s.skillId) ?? 0) >= ZERO_THRESHOLD);
writeFileSync(VFAIL_SUMMARY, JSON.stringify({
  totalGen: stats.totalGen,
  totalAccepted: stats.totalAccepted,
  totalVfail: stats.totalVfail,
  totalAfail: stats.totalAfail,
  totalDup: stats.totalDup,
  totalJudgeDelete: stats.totalJudgeDelete,
  totalJudgeBorderline: stats.totalJudgeBorderline,
  totalJudgeKeep: stats.totalJudgeKeep,
  totalBudget: stats.totalBudget,
  totalOffTopic: stats.totalOffTopic,
  byIssueHist: stats.byIssueHist,
  examples: stats.vfailExamples,
  skipped: skipped.map(s => ({ skillId: s.skillId, skillName: s.skillName })),
  pushedNew: allAccepted.length,
}, null, 2));

console.log(JSON.stringify({
  accepted: allAccepted.length,
  vfail: stats.totalVfail,
  afail: stats.totalAfail,
  dup: stats.totalDup,
  judgeDelete: stats.totalJudgeDelete,
  judgeBorderline: stats.totalJudgeBorderline,
  perSkill: Object.fromEntries(Array.from(acceptedBySkill).map(([k, v]) => [k, v.length])),
}, null, 2));
