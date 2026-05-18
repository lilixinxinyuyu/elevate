#!/usr/bin/env node
/**
 * 题库 SpeedMatch 占比 + 新 metadata 完整性 audit (调研, iter12)
 *
 * 起因: 父亲反馈 Selena 期中"试卷题速过感, 草稿险触发不够".
 * 怀疑 SpeedMatch (闪电匹配, 单步速算) 占比过高, "慢思考"题占比过低.
 *
 * 跑法:
 *   node scripts/_audit-question-templates.mjs
 *   node scripts/_audit-question-templates.mjs --json
 *
 * 字段维度 (iter 33-35 加的 metadata):
 *   - speedEligible    SpeedMatch 白名单
 *   - requiresEstimation  EstimationGate 触发
 *   - requiresScratch  ScratchInsurance 触发
 *   - requiresMultiStep MultiStepApp 触发
 *   - keyNumbers       应用题"关键数字"
 */
import { build } from "esbuild";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// 把 policies + content 一次 bundle 出来
const tmp = join(tmpdir(), `audit-tpl-${Date.now()}.mjs`);
const ENTRY = join(tmpdir(), `audit-tpl-entry-${Date.now()}.ts`);
import { writeFileSync } from "node:fs";
writeFileSync(
  ENTRY,
  `export { SEED_QUESTIONS } from "${join(PROJECT_ROOT, "src/content/questions").replace(/\\/g, "/")}";
export { speedEligibleByHeuristic, classifyStem } from "${join(PROJECT_ROOT, "src/core/speedMatchPolicy").replace(/\\/g, "/")}";
export { requiresEstimationByHeuristic, detectMainOperator, extractNumbers } from "${join(PROJECT_ROOT, "src/core/estimationPolicy").replace(/\\/g, "/")}";
export { requiresMultiStepByHeuristic } from "${join(PROJECT_ROOT, "src/core/multiStepPolicy").replace(/\\/g, "/")}";
export { requiresScratchByHeuristic } from "${join(PROJECT_ROOT, "src/core/scratchPolicy").replace(/\\/g, "/")}";
`,
);

await build({
  entryPoints: [ENTRY],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: tmp,
  logLevel: "error",
});
const mod = await import(tmp);
rmSync(tmp, { force: true });
rmSync(ENTRY, { force: true });

const {
  SEED_QUESTIONS,
  speedEligibleByHeuristic,
  requiresEstimationByHeuristic,
  requiresMultiStepByHeuristic,
  requiresScratchByHeuristic,
  classifyStem,
  detectMainOperator,
} = mod;

const total = SEED_QUESTIONS.length;
const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);

const byGameType = new Map();
const byFormat = new Map();
const byDifficulty = new Map();
const byPlayAs = new Map();

const metaFilled = {
  speedEligible: 0,
  requiresEstimation: 0,
  requiresScratch: 0,
  requiresMultiStep: 0,
  keyNumbers: 0,
};

const heuristic = {
  speedEligible: 0,
  requiresEstimation: 0,
  requiresScratch: 0,
  requiresMultiStep: 0,
};

const explicitConflict = { speedEligible: 0, requiresEstimation: 0, requiresScratch: 0, requiresMultiStep: 0 };

const subjectCount = new Map();

for (const q of SEED_QUESTIONS) {
  bump(byGameType, q.game_type ?? "?");
  bump(byFormat, q.question_format ?? "?");
  bump(byDifficulty, q.difficulty ?? "?");
  bump(byPlayAs, q.play_as ?? "(none)");
  bump(subjectCount, q.subjectId ?? "math");

  if (typeof q.speedEligible === "boolean") metaFilled.speedEligible++;
  if (typeof q.requiresEstimation === "boolean") metaFilled.requiresEstimation++;
  if (typeof q.requiresScratch === "boolean") metaFilled.requiresScratch++;
  if (typeof q.requiresMultiStep === "boolean") metaFilled.requiresMultiStep++;
  if (Array.isArray(q.keyNumbers) && q.keyNumbers.length > 0) metaFilled.keyNumbers++;

  // heuristic 跑一遍
  let isSpeed = false;
  let isEst = false;
  let isMS = false;
  let isScr = false;
  try {
    isSpeed = speedEligibleByHeuristic(q);
    isEst = requiresEstimationByHeuristic(q);
    isMS = requiresMultiStepByHeuristic(q);
    isScr = requiresScratchByHeuristic(q);
  } catch (e) {
    // 防 schema 不全
  }
  if (isSpeed) heuristic.speedEligible++;
  if (isEst) heuristic.requiresEstimation++;
  if (isMS) heuristic.requiresMultiStep++;
  if (isScr) heuristic.requiresScratch++;

  // 显式跟 heuristic 冲突 (用于"该重新标记")
  if (typeof q.speedEligible === "boolean" && q.speedEligible !== isSpeed) explicitConflict.speedEligible++;
  if (typeof q.requiresEstimation === "boolean" && q.requiresEstimation !== isEst) explicitConflict.requiresEstimation++;
  if (typeof q.requiresMultiStep === "boolean" && q.requiresMultiStep !== isMS) explicitConflict.requiresMultiStep++;
  if (typeof q.requiresScratch === "boolean" && q.requiresScratch !== isScr) explicitConflict.requiresScratch++;
}

// 慢思考 = 任一 estimation/multistep/scratch 触发
let slowAny = 0;
let speedAndSlow = 0; // 不应该 overlap, 但看下
for (const q of SEED_QUESTIONS) {
  let s = false;
  try {
    const e = requiresEstimationByHeuristic(q);
    const m = requiresMultiStepByHeuristic(q);
    const sc = requiresScratchByHeuristic(q);
    s = e || m || sc;
  } catch {}
  if (s) slowAny++;
  if (s && speedEligibleByHeuristic(q)) speedAndSlow++;
}

// "速过感" 候选 = speedEligible && difficulty<=2 && !applicationStory
const speedCandidates = SEED_QUESTIONS.filter((q) => {
  try {
    if (!speedEligibleByHeuristic(q)) return false;
    if ((q.difficulty ?? 5) > 2) return false;
    return true;
  } catch {
    return false;
  }
}).length;

// 按 game_type × heuristic-speed 交叉
const speedByGameType = new Map();
for (const q of SEED_QUESTIONS) {
  try {
    if (speedEligibleByHeuristic(q)) bump(speedByGameType, q.game_type ?? "?");
  } catch {}
}

const pct = (n) => ((n / total) * 100).toFixed(1) + "%";

const args = process.argv.slice(2);
if (args.includes("--json")) {
  console.log(JSON.stringify({
    total,
    byGameType: Object.fromEntries(byGameType),
    byFormat: Object.fromEntries(byFormat),
    byDifficulty: Object.fromEntries(byDifficulty),
    byPlayAs: Object.fromEntries(byPlayAs),
    subjectCount: Object.fromEntries(subjectCount),
    metaFilled,
    heuristic,
    explicitConflict,
    slowAny,
    speedAndSlow,
    speedCandidates,
    speedByGameType: Object.fromEntries(speedByGameType),
  }, null, 2));
} else {
  console.log(`\n=== Question Template Audit (total ${total}) ===\n`);
  console.log(`Subjects:`);
  for (const [k, v] of [...subjectCount].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(12)} ${v}  (${pct(v)})`);
  console.log(`\nGame Type 分布:`);
  for (const [k, v] of [...byGameType].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(28)} ${v}  (${pct(v)})`);
  console.log(`\nQuestion Format 分布:`);
  for (const [k, v] of [...byFormat].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(28)} ${v}  (${pct(v)})`);
  console.log(`\nplay_as (GameTemplate) 分布:`);
  for (const [k, v] of [...byPlayAs].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(28)} ${v}  (${pct(v)})`);
  console.log(`\nDifficulty 分布:`);
  for (const [k, v] of [...byDifficulty].sort()) console.log(`  d${k}  ${v}  (${pct(v)})`);

  console.log(`\n--- iter 33-35 metadata 显式填写率 ---`);
  for (const [k, v] of Object.entries(metaFilled)) {
    console.log(`  ${k.padEnd(22)} 已填 ${String(v).padStart(5)} / ${total}  (${pct(v)})  缺 ${pct(total - v)}`);
  }

  console.log(`\n--- heuristic 触发率 (自动判定, 题真正会走的路径) ---`);
  for (const [k, v] of Object.entries(heuristic)) {
    console.log(`  ${k.padEnd(22)} ${String(v).padStart(5)}  (${pct(v)})`);
  }

  console.log(`\n--- 显式 vs heuristic 冲突 (人工标错或 heuristic 不准) ---`);
  for (const [k, v] of Object.entries(explicitConflict)) {
    console.log(`  ${k.padEnd(22)} ${v}`);
  }

  console.log(`\n--- SpeedMatch / 慢思考 占比对比 ---`);
  console.log(`  SpeedMatch eligible (heuristic):           ${heuristic.speedEligible}  (${pct(heuristic.speedEligible)})`);
  console.log(`  SpeedMatch candidate (digits≤2,op≤1,d≤2):  ${speedCandidates}  (${pct(speedCandidates)})`);
  console.log(`  慢思考 (任一 estimation/multistep/scratch): ${slowAny}  (${pct(slowAny)})`);
  console.log(`  speed ∩ slow 冲突:                          ${speedAndSlow}`);

  console.log(`\n--- SpeedMatch eligible 按 game_type 拆分 ---`);
  for (const [k, v] of [...speedByGameType].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(28)} ${v}`);
  }
}
