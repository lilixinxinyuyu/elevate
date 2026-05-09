#!/usr/bin/env node
/**
 * v3 fill-bank — 闭环填题：
 *   1. 调 /api/generate/questions
 *   2. validate → 通过则接受
 *   3. 不通过 → autoFix（强制 ID/term 等已知字段）→ 再 validate
 *   4. 仍不通过 → 写 vfail 样本到 /tmp/vfail-samples.jsonl
 *   5. 同 skill 连续 N 次 vfail → 标记跳过本 round（避免空转）
 *   6. 最后输出 /tmp/vfail-summary.json，供人工 prompt 改进参考
 *
 * 用法：APP_PASSWORD=... node scripts/_fill-bank-v3.mjs <target=20> <passes=10>
 */

import { build } from "esbuild";
import { writeFileSync, readFileSync, appendFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const tmpFile = join(tmpdir(), `fillbankv3-${Date.now()}.mjs`);

const PWD = process.env.APP_PASSWORD;
if (!PWD) { console.error("APP_PASSWORD env required"); process.exit(1); }

const TARGET_PER_SKILL = Number(process.argv[2] ?? 20);
const PASSES = Number(process.argv[3] ?? 10);
const PROD = "https://selena-elevate.pages.dev";
const VFAIL_SAMPLES = "/tmp/vfail-samples.jsonl";
const VFAIL_SUMMARY = "/tmp/vfail-summary.json";

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
process.stderr.write(`▶ v3 closed-loop: ${skills.length} skills, default target ${TARGET_PER_SKILL}, max ${PASSES} passes\n`);

const auth = `Bearer ${PWD}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function targetFor(sk) {
  const n = sk.need;
  if (typeof n === "number" && n > 0) return Math.min(n, TARGET_PER_SKILL);
  return TARGET_PER_SKILL;
}

function* skillStems(skillId, extras = []) {
  for (const q of SEED_QUESTIONS) {
    if (q.skill_id === skillId && typeof q.stem === "string") yield q.stem;
  }
  for (const s of extras) yield s;
}

/**
 * autoFix —— 只动**纯元数据**字段，绝不动 IDs/term/difficulty/ability/exam_priority
 * 这些"内容性"字段。爸爸明确反馈：force-overwrite IDs 等内容字段 = 把 AI 跑题
 * 的问题埋进库里，将来发现就是大坑。
 *
 * 安全可改（无判断空间）：
 *   - subjectId="math"            （这个 endpoint 只出 math）
 *   - status="approved"           （工作流默认值）
 *   - version=1                   （schema 字段）
 *   - grade=4                     （Selena 上下文）
 *   - skill_name / unit_name      （从 ID derive，不引入新事实）
 *   - hints=[] / tags=[]          （空数组默认）
 *
 * 不动：
 *   - skill_id / unit_id          （AI 跑题就让它 vfail，让我看到 prompt 问题）
 *   - term                        （上下册不能猜）
 *   - difficulty                  （AI 应该给，给错说明 prompt 不清楚）
 *   - ability_dimension           （内容相关）
 *   - exam_priority               （内容相关）
 *   - game_type / question_format （由 prompt 决定）
 *   - cognitive_level             （内容相关）
 *   - estimated_time_seconds      （v0.31.51 已经在 runtime adjustedEstimatedTime 兜底了）
 *
 * 答案 type 字段也不动——如果 answer.type 错了，可能是答案结构错了，强制改 type
 * 不会让答案变对。
 */
function autoFix(rawQ, sk) {
  const q = { ...rawQ };
  const skillDef = SKILL_BY.get(sk.skillId);
  const unitDef = UNIT_BY.get(sk.unitId);

  // 仅这些字段：纯元数据 + derive
  if (!q.subjectId) q.subjectId = "math";
  if (!q.status) q.status = "approved";
  if (!q.version) q.version = 1;
  if (!q.grade) q.grade = 4;
  if (!q.skill_name && skillDef) q.skill_name = skillDef.name;
  if (!q.unit_name && unitDef) q.unit_name = unitDef.name;
  if (!Array.isArray(q.hints)) q.hints = [];
  if (!Array.isArray(q.tags)) q.tags = [];

  // **过滤** ability_dimension 中的非法 enum 值（不强加默认）
  //   - AI 经常把 cognitive_level 的 "procedural" 误塞进来
  //   - 过滤是"删 AI 写错的部分"，不是"我编对的值"
  //   - 过滤后空数组 → 继续 vfail（让我看到 AI 没选好的情况）
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

  // solution_steps: 如果 AI 给了对象数组（{step, text}），抽 .text 转字符串
  //   - schema 要求 string[]，AI 偶尔给富对象
  //   - 这是"提取 AI 已写好的内容"，不是"我编新内容"
  if (Array.isArray(q.solution_steps)) {
    q.solution_steps = q.solution_steps.map((s) => {
      if (typeof s === "string") return s;
      if (s && typeof s === "object") {
        // 优先 .text，其次 .step / 整体 stringify
        if (typeof s.text === "string") return s.text;
        if (typeof s.step === "string") return s.step;
        if (typeof s.description === "string") return s.description;
        // 最后兜底：取所有字符串字段拼接
        const vals = Object.values(s).filter((v) => typeof v === "string");
        if (vals.length > 0) return vals.join("：");
      }
      return String(s);
    }).filter((s) => s && s.length > 0);
  }

  // hints[].penalty: AI 偶尔给浮点 (0.1, 0.5, 1.5)，schema 要 int
  //   - round 是机械 conversion，不引入新事实
  //   - 0.1 → 0 → 但 penalty=0 不太合理，用 max(1, round) 防 0
  if (Array.isArray(q.hints)) {
    q.hints = q.hints.map((h) => {
      if (h && typeof h === "object" && typeof h.penalty === "number" && !Number.isInteger(h.penalty)) {
        // 0.1 / 0.2 / 0.3 → 1 / 1 / 1 — round 不够细致，scale up
        const p = h.penalty < 1 ? Math.round(h.penalty * 10) : Math.round(h.penalty);
        return { ...h, penalty: Math.max(1, Math.min(5, p)) };
      }
      return h;
    });
  }

  return q;
}

async function genOne(skill, batchStems) {
  const existingStems = Array.from(skillStems(skill.skillId, batchStems)).slice(0, 25);
  const r = await fetch(`${PROD}/api/generate/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({
      subjectId: "math",
      unitId: skill.unitId, unitName: skill.unitName,
      skillId: skill.skillId, skillName: skill.skillName,
      count: 1,
      difficulty: "2-4",
      term: skill.term === "综合复习" ? undefined : skill.term,
      existingStems,
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
  if (!j.ok || !Array.isArray(j.questions) || !j.questions[0]) throw new Error("empty");
  return j.questions[0];
}

const acceptedBySkill = new Map();
const allBatchStems = new Map();
const consecutiveVfailBySkill = new Map();
const vfailIssueHist = {};   // {skillId: {issueKey: count}}
const vfailExamples = {};    // {skillId: [examples]}
let totalVfail = 0;
let totalAutoFixed = 0;
let totalOffTopic = 0;
let totalBudget = 0;

const VFAIL_THRESHOLD = 4;  // 同 skill 连续 4 次 vfail → 暂跳过

for (let pass = 1; pass <= PASSES; pass++) {
  let skillsThisPass = 0;
  let acceptedThisPass = 0;
  let budgetHits = 0;

  for (const sk of skills) {
    const have = (acceptedBySkill.get(sk.skillId) ?? []).length;
    const skillTarget = targetFor(sk);
    if (have >= skillTarget) continue;
    if ((consecutiveVfailBySkill.get(sk.skillId) ?? 0) >= VFAIL_THRESHOLD) continue;
    skillsThisPass++;
    process.stderr.write(`P${pass} ${sk.skillName.slice(0, 8)}(${have}/${skillTarget}): `);
    let q = null;
    try {
      const stems = allBatchStems.get(sk.skillId) ?? [];
      q = await genOne(sk, stems);
    } catch (e) {
      const msg = e.message ?? String(e);
      if (e.isBudget) { budgetHits++; totalBudget++; }
      if (e.isOffTopic) totalOffTopic++;
      process.stderr.write(`✗ ${msg.slice(0, 60)}\n`);
      continue;
    }

    // First validate without modifying
    let v = validateQuestion(q);
    let usedAutoFix = false;
    if (!v.ok) {
      // Try autofix
      const fixed = autoFix(q, sk);
      const v2 = validateQuestion(fixed);
      if (v2.ok && v2.question) {
        v = v2;
        q = fixed;
        usedAutoFix = true;
        totalAutoFixed++;
      }
    }

    if (!v.ok || !v.question) {
      // Genuine vfail — capture for review
      totalVfail++;
      const issueKeys = v.issues.map((i) => `${i.severity}:${i.path}:${i.message.slice(0, 50)}`);
      vfailIssueHist[sk.skillId] = vfailIssueHist[sk.skillId] ?? {};
      for (const k of issueKeys) {
        vfailIssueHist[sk.skillId][k] = (vfailIssueHist[sk.skillId][k] ?? 0) + 1;
      }
      vfailExamples[sk.skillId] = vfailExamples[sk.skillId] ?? [];
      if (vfailExamples[sk.skillId].length < 3) {
        vfailExamples[sk.skillId].push({ q, issues: v.issues, pass });
      }
      try {
        appendFileSync(VFAIL_SAMPLES, JSON.stringify({ skillId: sk.skillId, pass, issues: v.issues, q }) + "\n");
      } catch { /* */ }
      consecutiveVfailBySkill.set(sk.skillId, (consecutiveVfailBySkill.get(sk.skillId) ?? 0) + 1);
      process.stderr.write(`vfail (${issueKeys[0]?.slice(0, 50) ?? "?"})\n`);
      await sleep(800);
      continue;
    }

    const a = auditQuestion(v.question);
    if (a.worstSeverity === "critical" || a.worstSeverity === "likely-broken") {
      process.stderr.write(`afail(${a.worstSeverity})\n`);
      await sleep(800);
      continue;
    }

    const stamped = {
      ...v.question,
      subjectId: "math",
      status: "approved",
      tags: Array.from(new Set([...(v.question.tags ?? []), "ai_generated"])),
    };
    const arr = acceptedBySkill.get(sk.skillId) ?? [];
    arr.push(stamped);
    acceptedBySkill.set(sk.skillId, arr);
    const stems = allBatchStems.get(sk.skillId) ?? [];
    stems.push(stamped.stem);
    allBatchStems.set(sk.skillId, stems);
    consecutiveVfailBySkill.set(sk.skillId, 0); // reset
    acceptedThisPass++;
    process.stderr.write(usedAutoFix ? `✓ (autoFix)\n` : `✓\n`);
    await sleep(800);
  }

  const accepted = Array.from(acceptedBySkill.values()).flat().length;
  process.stderr.write(`◀ Pass ${pass}: this=${acceptedThisPass}/${skillsThisPass}, total=${accepted}, budgetHits=${budgetHits}, autoFixes=${totalAutoFixed}\n`);

  if (skillsThisPass === 0) {
    process.stderr.write(`▶ 所有 skill 都达标或被跳过，结束\n`);
    break;
  }
  if (acceptedThisPass === 0 && budgetHits >= skillsThisPass / 2) {
    process.stderr.write(`▶ 整轮 budget 受限，等 5 分钟…\n`);
    await sleep(300_000);
  } else if (pass < PASSES) {
    await sleep(2000);
  }
}

const allAccepted = Array.from(acceptedBySkill.values()).flat();
process.stderr.write(`▶ 结束：accepted ${allAccepted.length}, vfail ${totalVfail}, autoFix ${totalAutoFixed}, budget ${totalBudget}, offTopic ${totalOffTopic}\n`);
process.stderr.write(`▶ 各 skill 收题：\n`);
for (const [sid, qs] of acceptedBySkill) {
  process.stderr.write(`   ${sid}: ${qs.length}\n`);
}
const skipped = skills.filter(s => (consecutiveVfailBySkill.get(s.skillId) ?? 0) >= VFAIL_THRESHOLD);
if (skipped.length > 0) {
  process.stderr.write(`▶ 因连续 vfail 被跳过的 skill：${skipped.map(s => s.skillName).join(", ")}\n`);
}

// Push to D1 if any new
if (allAccepted.length > 0) {
  process.stderr.write(`▶ Pull D1…\n`);
  const dl = await fetch(`${PROD}/api/sync/download`, { headers: { Authorization: auth } });
  const dj = await dl.json();
  const payload = dj.latest.payload;
  const existingAi = Array.isArray(payload.aiQuestions) ? payload.aiQuestions : [];
  const existingIds = new Set(existingAi.map(q => q.question_id));
  const newOnes = allAccepted.filter(q => !existingIds.has(q.question_id));
  const merged = [...existingAi, ...newOnes];

  process.stderr.write(`▶ Push: 总 aiQuestions ${merged.length}（新增 ${newOnes.length}）…\n`);
  const up = await fetch(`${PROD}/api/sync/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({
      payload: { ...payload, aiQuestions: merged },
      attemptsCount: payload.attempts?.length ?? 0,
      sessionsCount: payload.sessions?.length ?? 0,
      totalXp: dj.latest.totalXp ?? 0,
      clientId: "fill-bank-v3",
    }),
  });
  const uj = await up.json();
  process.stderr.write(`✓ uploaded version=${uj.version}\n`);
}

// vfail summary for prompt review
writeFileSync(VFAIL_SUMMARY, JSON.stringify({
  totalVfail, totalAutoFixed, totalOffTopic, totalBudget,
  byIssueHist: vfailIssueHist,
  examples: vfailExamples,
  skipped: skipped.map(s => ({ skillId: s.skillId, skillName: s.skillName })),
  pushedNew: allAccepted.length,
}, null, 2));

console.log(JSON.stringify({
  accepted: allAccepted.length,
  vfail: totalVfail,
  autoFixed: totalAutoFixed,
  perSkill: Object.fromEntries(Array.from(acceptedBySkill).map(([k, v]) => [k, v.length])),
}, null, 2));
