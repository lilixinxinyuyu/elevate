#!/usr/bin/env node
/**
 * v0.35.40 Refactor Priority 8: SEED 内容 schema 验证 build gate.
 *
 * 痛点 (Gemini + GPT 共识 #3):
 *   AI 出题 / admin 手填可能塞进非法 metadata, TS 不查 runtime data:
 *     - play_as: 'multi_step' (拼错, 应该是 multi_step_application) → resolve.ts
 *       fallback 走默认, Selena 看不到 4 步框架
 *     - skill_id: 'decimal_xxx' (skill 不存在 → mastery 永远算不进, Home 数据错)
 *     - unit_id: 同上
 *     - answer.type 'choice' 但 value 不是 option.id → grader 必判错
 *
 * 现有 scripts/audit-questions.mjs 检查 answer/options 完整性, 但**没检 play_as 等
 * cross-reference**. 本 check 跟 audit 互补.
 *
 * 失败 → exit 1 → 阻断 build (跟 check-seed-bump 同 pattern).
 *
 * 加新 GameTemplate union member 时不需要改本脚本 — VALID_TEMPLATES 集合
 * 直接复制 src/core/types.ts 的 union. 漏更新会被本脚本下次跑发现 (报"play_as
 * 用了未知值").
 */
import { build } from "esbuild";
import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// 1. 编译 SEED_QUESTIONS + SKILLS + UNITS via esbuild (跟 audit-questions / check-seed-bump 同 pattern)
const tmpFile = join(tmpdir(), `content-schema-bundle-${Date.now()}.mjs`);
await build({
  entryPoints: [join(PROJECT_ROOT, "scripts/_load-content.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: tmpFile,
  external: [],
  logLevel: "error",
});
const mod = await import(tmpFile);
rmSync(tmpFile, { force: true });
const { SEED_QUESTIONS, SKILLS, UNITS } = mod;

// 注: GAME_TEMPLATE_IDS 也从 mod 取, 看下面 2.

// 2. v0.35.44 (GPT peer review HOTFIX): 之前 regex parse `types.ts` 脆弱 —
// 行尾注释 / 一行 union / alias 都会失效. 改用 import GAME_TEMPLATE_IDS
// (已 `satisfies readonly GameTemplate[]` 保证编译期跟 union 一致).
const { GAME_TEMPLATE_IDS } = mod;
if (!Array.isArray(GAME_TEMPLATE_IDS) || GAME_TEMPLATE_IDS.length < 20) {
  console.error(`[check-content-schema] FAIL: src/core/types.ts 没 export GAME_TEMPLATE_IDS 或长度异常 (${GAME_TEMPLATE_IDS?.length})`);
  process.exit(1);
}
const VALID_TEMPLATES = new Set(GAME_TEMPLATE_IDS);

// 3. build lookup sets for cross-ref
const SKILL_IDS = new Set(SKILLS.map((s) => s.id));
const UNIT_IDS = new Set(UNITS.map((u) => u.id));

// 4. 跑检查
const errors = [];
const warnings = [];

for (const q of SEED_QUESTIONS) {
  const qid = q.question_id;
  // play_as validity
  if (q.play_as !== undefined && q.play_as !== null && !VALID_TEMPLATES.has(q.play_as)) {
    errors.push(`[play_as] q=${qid}: '${q.play_as}' 不在 GameTemplate union. 有效: ${[...VALID_TEMPLATES].slice(0, 6).join(', ')}...`);
  }
  // skill_id existence
  if (q.skill_id && !SKILL_IDS.has(q.skill_id)) {
    errors.push(`[skill_id] q=${qid}: '${q.skill_id}' 不在 SKILLS. mastery 永远算不进, Home rings 错.`);
  }
  // unit_id existence
  if (q.unit_id && !UNIT_IDS.has(q.unit_id)) {
    errors.push(`[unit_id] q=${qid}: '${q.unit_id}' 不在 UNITS. 单元筛选 / 闯关解锁会错.`);
  }
  // requiresMultiStep + scratch 互斥 (multi_step 模板已含草稿区)
  if (q.requiresMultiStep === true && q.play_as === "canvas_scratch") {
    warnings.push(`[multistep+canvas] q=${qid}: 同标 requiresMultiStep + play_as=canvas_scratch (互斥, 应只用 multi_step_application)`);
  }
  // play_as=multi_step_application 但答案不是 number → grader 失效
  if (q.play_as === "multi_step_application" && q.answer?.type !== "number") {
    warnings.push(`[multistep-answer] q=${qid}: play_as=multi_step_application 但 answer.type=${q.answer?.type}. MultiStep 模板要求 number 答案才好打分.`);
  }
  // answer.type==='choice' 但 value 不在 option.id 里 (跟 audit-questions C2 重叠, 加这里是 cross-build)
  if (q.answer?.type === "choice" && Array.isArray(q.options)) {
    const optIds = new Set(q.options.map((o) => o.id));
    if (q.answer.value !== undefined && !optIds.has(q.answer.value)) {
      errors.push(`[answer-choice] q=${qid}: answer.value '${q.answer.value}' 不在 options ${[...optIds].join(',')}. grader 必判错.`);
    }
  }
}

console.log(`[check-content-schema] 检查 ${SEED_QUESTIONS.length} 题:`);
console.log(`  valid templates: ${VALID_TEMPLATES.size}`);
console.log(`  valid skills:    ${SKILL_IDS.size}`);
console.log(`  valid units:     ${UNIT_IDS.size}`);
console.log(`  errors:   ${errors.length}`);
console.log(`  warnings: ${warnings.length}`);

if (warnings.length > 0) {
  console.log(`\n--- WARNINGS (不阻断 build) ---`);
  for (const w of warnings.slice(0, 20)) console.log(`  ⚠ ${w}`);
  if (warnings.length > 20) console.log(`  ... 还有 ${warnings.length - 20} 条`);
}

if (errors.length > 0) {
  console.error(`\n--- ERRORS (阻断 build) ---`);
  for (const e of errors.slice(0, 30)) console.error(`  ✗ ${e}`);
  if (errors.length > 30) console.error(`  ... 还有 ${errors.length - 30} 条`);
  console.error(`\n  ACTION: 修 SEED_QUESTIONS / SKILLS / UNITS 让 cross-ref 一致. 然后 npm run build 重跑.\n`);
  process.exit(1);
}

console.log(`\n[check-content-schema] ✓ 全部 ${SEED_QUESTIONS.length} 题通过 schema 检查.`);
process.exit(0);
