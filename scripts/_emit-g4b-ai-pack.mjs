import { readFileSync, writeFileSync } from "node:fs";

const raw = JSON.parse(readFileSync("/tmp/g4b-ai-gen.json", "utf-8"));
console.log(`input: ${raw.length} questions`);

// 验证 + 清洗
const seen = new Set();
const accepted = [];
const rejected = { dup: 0, badShape: 0, badDiff: 0, missingSkill: 0, forbidden: 0, badAnswer: 0 };

// 与 src/core/validateQuestion.ts 同步的禁词正则
const FORBIDDEN_RE = [
  /笨|粗心鬼|你怎么又错|真差|没用/,
  /比例|函数|方程组|平方根|二次方程|立方根|一元二次/,
];

const VALID_ANSWER_TYPES = new Set(["number", "choice", "multi_step"]);

const G4B_SKILLS = new Set([
  "decimal_meaning_place","decimal_unit_conversion","decimal_compare",
  "decimal_add_sub_vertical","decimal_add_sub_simplify","decimal_inverse_problem",
  "triangle_inequality","triangle_angle_sum","triangle_classification",
  "decimal_mul_meaning","decimal_point_shift","decimal_mul_vertical",
  "decimal_product_digits","decimal_mul_mix","decimal_mul_simplify",
  "decimal_price_quantity","decimal_speed_distance","decimal_work_total",
  "decimal_segment_pricing","observe_front_top_left",
  "letter_expression","equation_meaning_balance","equation_solve_simple",
  "equation_one_step_word","equation_two_step_word","equation_meeting_problem",
  "equation_sum_difference","data_bar_chart","average_meaning",
  "average_compute","average_inverse_total","average_inverse_missing",
]);

for (const q of raw) {
  // shape sanity
  if (!q.question_id || !q.stem || !q.answer || !q.skill_id) { rejected.badShape++; continue; }
  if (!G4B_SKILLS.has(q.skill_id)) { rejected.missingSkill++; continue; }
  // 难度 2-4 only
  if (!Number.isInteger(q.difficulty) || q.difficulty < 2 || q.difficulty > 4) { rejected.badDiff++; continue; }
  // dedup by stem (string) within skill
  const key = `${q.skill_id}::${(q.stem||"").trim()}`;
  if (seen.has(key)) { rejected.dup++; continue; }
  seen.add(key);
  // answer.type 必须是合法 discriminator
  if (!q.answer.type || !VALID_ANSWER_TYPES.has(q.answer.type)) { rejected.badAnswer++; continue; }
  // multi_step questions need subquestions
  if (q.answer?.type === "multi_step") {
    if (!Array.isArray(q.subquestions) || q.subquestions.length === 0) { rejected.badShape++; continue; }
  } else if (!Array.isArray(q.options) || q.options.length < 2) {
    rejected.badShape++; continue;
  }
  // 禁词检查（stem + options + solution_steps + feedback + common_errors + hints + tags 全文扫）
  // 与 src/core/validateQuestion.ts 同步
  const fullText = [
    q.stem || "",
    q.feedback_correct || "",
    q.feedback_wrong || "",
    q.parent_tip || "",
    ...(Array.isArray(q.options) ? q.options.map(o => o?.text || "") : []),
    ...(Array.isArray(q.solution_steps) ? q.solution_steps : [String(q.solution_steps || "")]),
    ...(Array.isArray(q.common_errors) ? q.common_errors.map(e => `${e?.error || ""} ${e?.remediation || ""}`) : []),
    ...(Array.isArray(q.hints) ? q.hints.map(h => h?.text || "") : []),
    ...(Array.isArray(q.tags) ? q.tags : []),
  ].join("\n");
  if (FORBIDDEN_RE.some(re => re.test(fullText))) { rejected.forbidden++; continue; }
  // solution_steps 强制 array（API 偶尔返回 string）
  if (!Array.isArray(q.solution_steps)) {
    q.solution_steps = q.solution_steps ? [String(q.solution_steps)] : [];
  }
  accepted.push(q);
}

console.log("rejected:", rejected);
console.log("accepted:", accepted.length);

// Distribution audit
const bySkill = {};
const byDiff = { 2: 0, 3: 0, 4: 0 };
for (const q of accepted) {
  bySkill[q.skill_id] = (bySkill[q.skill_id] || 0) + 1;
  byDiff[q.difficulty]++;
}
console.log("byDiff:", byDiff);
console.log("bySkill:", bySkill);

// Emit TS file. Each question is an inline-typed object with `as const` not used (heavy).
// Just JSON.stringify with `as Question[]` cast.
const header = `/**
 * AI_GEN_G4B_PACK — v0.30.2 一次性生成的 G4B 题库补充包
 *
 * 来源：在 admin / 浏览器里跑 /api/generate/questions 批量调用，DashScope qwen-plus
 * 出题，按 difficulty=2-4，每个 G4B skill 4-12 道。本文件由
 * scripts/_emit-g4b-ai-pack.mjs 从 /tmp/g4b-ai-gen.json 转译，**勿手改**——
 * 改要重跑生成 + 重 emit。
 *
 * 总数：${accepted.length} 道
 * 难度：D2=${byDiff[2]} / D3=${byDiff[3]} / D4=${byDiff[4]}
 *
 * 涵盖技能：
 *   ${Object.entries(bySkill).map(([k,v]) => `${k}:${v}`).join(", ")}
 */

import type { Question } from "../core/types";

export const AI_GEN_G4B_PACK: Question[] = `;

const body = JSON.stringify(accepted, null, 2);
const footer = ` as Question[];\n`;

writeFileSync(
  "src/content/aiGenG4BPack.ts",
  header + body + footer,
);
console.log("wrote src/content/aiGenG4BPack.ts");
