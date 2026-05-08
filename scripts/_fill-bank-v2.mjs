#!/usr/bin/env node
/**
 * v2 fill-bank — 多轮扫策略（避免长 prompt 触发 budget_exceeded）：
 *
 *   Pass 1: 每个 skill 各 count=1 拿 1 题，失败立即下一 skill
 *   Pass 2-N: 重复，直到每个 skill 累计 ≥ TARGET 道 或 给定 PASSES 跑完
 *
 * 这种"广度优先"比"深度优先 (一个 skill 拿 5 道)" 更稳：
 *   - 单 prompt 短 → token-plan 不爆
 *   - 失败影响小 → 跳到下一 skill 继续
 *   - 进度均匀 → 即使中途挂，每个 skill 都有几道
 *
 * 用法：
 *   APP_PASSWORD=... node scripts/_fill-bank-v2.mjs <target=5> <passes=8>
 */

import { build } from "esbuild";
import { writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const tmpFile = join(tmpdir(), `fillbankv2-${Date.now()}.mjs`);

const PWD = process.env.APP_PASSWORD;
if (!PWD) { console.error("APP_PASSWORD env required"); process.exit(1); }

const TARGET_PER_SKILL = Number(process.argv[2] ?? 5);
const PASSES = Number(process.argv[3] ?? 8);
const PROD = "https://selena-elevate.pages.dev";

await build({
  entryPoints: [join(PROJECT_ROOT, "scripts/_load-content-extended.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: tmpFile,
  logLevel: "error",
});
const { SEED_QUESTIONS, validateQuestion, auditQuestion } = await import(tmpFile);
rmSync(tmpFile, { force: true });

const priorities = JSON.parse(readFileSync("/tmp/priorities.json", "utf8"));
const skills = priorities.topToFill.slice(0, 12);
console.error(`▶ v2: ${skills.length} skills × target ${TARGET_PER_SKILL}, max ${PASSES} passes`);

const auth = `Bearer ${PWD}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function* skillStems(skillId, extras) {
  for (const q of SEED_QUESTIONS) {
    if (q.skill_id === skillId && typeof q.stem === "string") yield q.stem;
  }
  for (const s of extras) yield s;
}

async function genOne(skill, batchStems) {
  const existingStems = Array.from(skillStems(skill.skillId, batchStems)).slice(0, 25);
  const r = await fetch(`${PROD}/api/generate/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({
      subjectId: "math",
      unitId: skill.unitId,
      unitName: skill.unitName,
      skillId: skill.skillId,
      skillName: skill.skillName,
      count: 1,
      difficulty: "2-4",
      term: skill.term === "综合复习" ? undefined : skill.term,
      existingStems,
    }),
  });
  const txt = await r.text();
  if (!r.ok) {
    const isBudget = r.status === 502 && (txt.includes("budget") || txt.includes("timeout") || txt.includes("no_model_worked"));
    const e = new Error(`gen ${r.status}: ${txt.slice(0, 150)}`);
    e.isBudget = isBudget;
    throw e;
  }
  const j = JSON.parse(txt);
  if (!j.ok || !Array.isArray(j.questions) || !j.questions[0]) throw new Error("empty");
  return j.questions[0];
}

const acceptedBySkill = new Map();        // skillId → Question[]
const allBatchStems = new Map();          // skillId → string[] (for dedup within batch)

for (let pass = 1; pass <= PASSES; pass++) {
  let skillsThisPass = 0;
  let acceptedThisPass = 0;
  let budgetHits = 0;

  for (const sk of skills) {
    const have = (acceptedBySkill.get(sk.skillId) ?? []).length;
    if (have >= TARGET_PER_SKILL) continue;
    skillsThisPass++;
    process.stderr.write(`P${pass} ${sk.skillName.slice(0,8)}(${have}/${TARGET_PER_SKILL}): `);
    try {
      const stems = allBatchStems.get(sk.skillId) ?? [];
      const q = await genOne(sk, stems);
      const v = validateQuestion(q);
      if (!v.ok || !v.question) {
        process.stderr.write(`vfail\n`);
        continue;
      }
      const a = auditQuestion(v.question);
      if (a.worstSeverity === "critical" || a.worstSeverity === "likely-broken") {
        process.stderr.write(`afail(${a.worstSeverity})\n`);
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
      stems.push(stamped.stem);
      allBatchStems.set(sk.skillId, stems);
      acceptedThisPass++;
      process.stderr.write(`✓\n`);
    } catch (e) {
      const msg = e.message ?? String(e);
      if (e.isBudget) budgetHits++;
      process.stderr.write(`✗ ${msg.slice(0, 50)}\n`);
    }
    // 1 题/skill/pass 之间小停顿，让 API 喘息
    await sleep(800);
  }

  const accepted = Array.from(acceptedBySkill.values()).flat().length;
  process.stderr.write(`◀ Pass ${pass} done: this=${acceptedThisPass}/${skillsThisPass}, total=${accepted}, budgetHits=${budgetHits}\n`);

  if (skillsThisPass === 0) {
    process.stderr.write(`▶ 所有 skill 已达标，结束\n`);
    break;
  }
  if (acceptedThisPass === 0 && budgetHits >= skillsThisPass / 2) {
    // 整轮全是 budget 问题 → 长等
    process.stderr.write(`▶ 整轮 budget 受限，等 5 分钟再试\n`);
    await sleep(300_000);
  } else if (pass < PASSES) {
    await sleep(2000);
  }
}

const allAccepted = Array.from(acceptedBySkill.values()).flat();
console.error(`▶ 总收：${allAccepted.length} 道，分布：`);
for (const [sid, qs] of acceptedBySkill) {
  console.error(`   ${sid}: ${qs.length}`);
}

if (allAccepted.length === 0) {
  console.log(JSON.stringify({ accepted: 0, msg: "no questions accepted" }));
  process.exit(0);
}

// Pull → merge → push
console.error(`▶ Pull D1 …`);
const dl = await fetch(`${PROD}/api/sync/download`, { headers: { Authorization: auth } });
const dj = await dl.json();
const payload = dj.latest.payload;
const existingAi = Array.isArray(payload.aiQuestions) ? payload.aiQuestions : [];
const existingIds = new Set(existingAi.map(q => q.question_id));
const newOnes = allAccepted.filter(q => !existingIds.has(q.question_id));
const merged = [...existingAi, ...newOnes];

console.error(`▶ Push: 总 aiQuestions ${merged.length}（新增 ${newOnes.length}）`);
const up = await fetch(`${PROD}/api/sync/upload`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: auth },
  body: JSON.stringify({
    payload: { ...payload, aiQuestions: merged },
    attemptsCount: payload.attempts?.length ?? 0,
    sessionsCount: payload.sessions?.length ?? 0,
    totalXp: dj.latest.totalXp ?? 0,
    clientId: "fill-bank-v2",
  }),
});
const uj = await up.json();
console.error(`✓ uploaded version=${uj.version}`);

const report = {
  passes: PASSES,
  totalAccepted: allAccepted.length,
  newOnesPushed: newOnes.length,
  totalAiInD1: merged.length,
  perSkill: Object.fromEntries(Array.from(acceptedBySkill).map(([k, v]) => [k, v.length])),
};
console.log(JSON.stringify(report, null, 2));
writeFileSync("/tmp/fillbank-v2-report.json", JSON.stringify(report, null, 2));
