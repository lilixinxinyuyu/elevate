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
 * v3 闭环核心：autoFix —— LLM 输出经常缺/错某些字段，但内容是好的。
 * 这里强制对齐我们已知的字段，避免 client validate 因小问题拒绝可用题目。
 */
function autoFix(rawQ, sk) {
  const q = { ...rawQ };
  const skillDef = SKILL_BY.get(sk.skillId);
  const unitDef = UNIT_BY.get(sk.unitId);

  // 强制对齐 IDs（最常见的 vfail 原因）
  q.skill_id = sk.skillId;
  q.unit_id = sk.unitId;
  if (unitDef?.term) q.term = unitDef.term;

  // 必填字段补默认
  if (!q.subjectId) q.subjectId = "math";
  if (!q.status) q.status = "approved";
  if (!q.version) q.version = 1;
  if (!q.grade) q.grade = 4;
  if (!q.skill_name && skillDef) q.skill_name = skillDef.name;
  if (!q.unit_name && unitDef) q.unit_name = unitDef.name;

  // 难度合规
  if (typeof q.difficulty !== "number" || q.difficulty < 1 || q.difficulty > 5) {
    q.difficulty = skillDef?.difficultyBase ?? 3;
  }

  // ability_dimension 默认
  if (!Array.isArray(q.ability_dimension) || q.ability_dimension.length === 0) {
    q.ability_dimension = (skillDef?.ability ?? ["calculation"]).slice();
  }
  // 过滤非法值
  const VALID_ABILITY = new Set(["calculation","concept","reasoning","modeling","spatial","data","strategy","habit"]);
  q.ability_dimension = q.ability_dimension.filter((a) => VALID_ABILITY.has(a));
  if (q.ability_dimension.length === 0) q.ability_dimension = ["calculation"];

  // exam_priority 默认
  if (!q.exam_priority) q.exam_priority = skillDef?.examPriority ?? "NORMAL";

  // game_type / play_as / question_format
  if (!q.game_type) q.game_type = "plain_choice";
  if (!q.play_as) q.play_as = q.game_type;
  if (!q.question_format) q.question_format = q.game_type === "plain_choice" ? "single_choice" : q.question_format;

  // cognitive_level
  const VALID_COG = new Set(["recall", "procedural", "application", "reasoning"]);
  if (!q.cognitive_level || !VALID_COG.has(q.cognitive_level)) q.cognitive_level = "procedural";

  // estimated_time_seconds
  if (typeof q.estimated_time_seconds !== "number" || q.estimated_time_seconds < 5) {
    q.estimated_time_seconds = q.difficulty <= 2 ? 25 : q.difficulty <= 3 ? 35 : 45;
  }

  // 多选题答案 type 修正
  if (Array.isArray(q.options) && q.answer && typeof q.answer === "object" && q.answer.value && q.answer.type !== "choice") {
    q.answer.type = "choice";
  }

  // hints 默认 []
  if (!Array.isArray(q.hints)) q.hints = [];

  // tags 兜底
  if (!Array.isArray(q.tags)) q.tags = [];

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
