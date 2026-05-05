/**
 * v0.30.12: 把 G4B U1-U4 补强题（68 道）转成 TS pack。
 *
 * 输入：/tmp/u14-questions.json （由浏览器批量生成 + dump）
 * 输出：src/content/aiGenG4B_U14_Pack.ts
 *
 * 验证：去重、答案 type、禁词扫（同 v0.30.7 emit-g4b-ai-pack.mjs）
 */

import { readFileSync, writeFileSync } from "node:fs";

const raw = JSON.parse(readFileSync("/tmp/u14-questions.json", "utf-8"));
console.log(`input: ${raw.length} questions`);

const seen = new Set();
const accepted = [];
const rejected = { dup: 0, badShape: 0, badDiff: 0, missingSkill: 0, forbidden: 0, badAnswer: 0 };

const FORBIDDEN_RE = [
  /笨|粗心鬼|你怎么又错|真差|没用/,
  /比例|函数|方程组|平方根|二次方程|立方根|一元二次/,
];
const VALID_ANSWER_TYPES = new Set(["number", "choice", "multi_step"]);
const G4B_U14_SKILLS = new Set([
  "decimal_meaning_place", "decimal_unit_conversion", "decimal_compare",
  "decimal_add_sub_vertical", "decimal_add_sub_simplify", "decimal_inverse_problem",
  "triangle_inequality", "triangle_angle_sum", "triangle_classification",
  "decimal_mul_meaning", "decimal_point_shift", "decimal_mul_vertical",
  "decimal_product_digits", "decimal_mul_mix", "decimal_mul_simplify",
  "decimal_price_quantity", "decimal_speed_distance", "decimal_work_total",
  "decimal_segment_pricing", "observe_front_top_left",
]);

for (const q of raw) {
  if (!q.question_id || !q.stem || !q.answer || !q.skill_id) { rejected.badShape++; continue; }
  if (!G4B_U14_SKILLS.has(q.skill_id)) { rejected.missingSkill++; continue; }
  if (!Number.isInteger(q.difficulty) || q.difficulty < 2 || q.difficulty > 4) { rejected.badDiff++; continue; }
  const key = `${q.skill_id}::${(q.stem||"").trim()}`;
  if (seen.has(key)) { rejected.dup++; continue; }
  seen.add(key);
  if (!q.answer.type || !VALID_ANSWER_TYPES.has(q.answer.type)) { rejected.badAnswer++; continue; }
  if (q.answer?.type === "multi_step") {
    if (!Array.isArray(q.subquestions) || q.subquestions.length === 0) { rejected.badShape++; continue; }
  } else if (!Array.isArray(q.options) || q.options.length < 2) {
    rejected.badShape++; continue;
  }
  // 禁词全文扫
  const fullText = [
    q.stem || "", q.feedback_correct || "", q.feedback_wrong || "", q.parent_tip || "",
    ...(Array.isArray(q.options) ? q.options.map(o => o?.text || "") : []),
    ...(Array.isArray(q.solution_steps) ? q.solution_steps : [String(q.solution_steps || "")]),
    ...(Array.isArray(q.common_errors) ? q.common_errors.map(e => `${e?.error || ""} ${e?.remediation || ""}`) : []),
    ...(Array.isArray(q.hints) ? q.hints.map(h => h?.text || "") : []),
    ...(Array.isArray(q.tags) ? q.tags : []),
  ].join("\n");
  if (FORBIDDEN_RE.some(re => re.test(fullText))) { rejected.forbidden++; continue; }
  if (!Array.isArray(q.solution_steps)) {
    q.solution_steps = q.solution_steps ? [String(q.solution_steps)] : [];
  }
  accepted.push(q);
}

console.log("rejected:", rejected);
console.log("accepted:", accepted.length);

const bySkill = {};
const byDiff = { 2: 0, 3: 0, 4: 0 };
for (const q of accepted) {
  bySkill[q.skill_id] = (bySkill[q.skill_id] || 0) + 1;
  byDiff[q.difficulty]++;
}
console.log("byDiff:", byDiff);
console.log("bySkill:", bySkill);

const header = `/**
 * AI_GEN_G4B_U14_PACK — v0.30.12 G4B U1-U4 必考 skill 补强包
 *
 * 触发：v0.30.10 inventory 显示 11 个必考 skill 距 30 道目标差 49 道。
 * 用浏览器自动化跑 /api/generate/questions（DashScope qwen-plus），count=4/批
 * 4 并发 ~5 分钟。本文件由 scripts/_emit-g4b-u14-pack.mjs 转译，**勿手改**。
 *
 * 总数：${accepted.length} 道
 * 难度：D2=${byDiff[2]} / D3=${byDiff[3]} / D4=${byDiff[4]}
 *
 * 涵盖技能：
 *   ${Object.entries(bySkill).map(([k,v]) => `${k}:${v}`).join(", ")}
 */

import type { Question } from "../core/types";

export const AI_GEN_G4B_U14_PACK: Question[] = `;

const body = JSON.stringify(accepted, null, 2);
const footer = ` as Question[];\n`;

writeFileSync("src/content/aiGenG4B_U14_Pack.ts", header + body + footer);
console.log("wrote src/content/aiGenG4B_U14_Pack.ts");
