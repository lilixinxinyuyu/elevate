#!/usr/bin/env node
/**
 * v0.31.75：深度检查每道 D1 AI 题的 (game_type, answer.type, options) 配对是否匹配。
 *
 * 出现过的真 bug:
 *   - decimal_shifter 题但 answer.type=choice （Bruce 报: 1.28→128 系统判错）
 *     根因: DecimalShifter 模板期 answer.type=number，碰到 choice 时 target=0
 *
 * 检测规则:
 *   - decimal_shifter / vertical_repair → answer.type 必须是 number 或 fill_blank 类
 *   - plain_choice / cube_view / triangle_judge / shop_counter / balance_lab
 *     → answer.type=choice + options >= 2 (balance_lab 例外: 也支持 number 输入模式)
 *   - word_problem_lab → answer.type=multi_step + subquestions
 *
 * 报告 mismatched 列表，**不自动 fix** — 需要人工 / 脚本回填。
 *
 * 用法:
 *   node scripts/_audit-question-template-match.mjs
 *   前置: /tmp/aiqs.json 是最新 D1 快照。
 */
import { readFileSync, writeFileSync } from "node:fs";

const aj = JSON.parse(readFileSync("/tmp/aiqs.json", "utf8"));
const rows = aj.rows ?? [];
console.error(`▶ Auditing ${rows.length} questions for template/data mismatches`);

// 期望的 (game_type → answer.type 集合) 映射
const EXPECTED_ANSWER_TYPES = {
  plain_choice: new Set(["choice"]),
  cube_view: new Set(["choice"]),
  triangle_judge: new Set(["choice"]),
  shop_counter: new Set(["choice", "multi_step"]),
  balance_lab: new Set(["choice", "number"]), // 模板支持两种
  decimal_shifter: new Set(["number"]),
  vertical_repair: new Set(["number", "fill_blank"]),
  speed_match: new Set(["choice"]),
  clue_finder: new Set(["choice"]),
  word_problem_lab: new Set(["multi_step"]),
  equation_builder: new Set(["fill_blank", "number"]),
};

const findings = {
  decimal_shifter_with_choice: [],
  word_problem_lab_no_subquestions: [],
  plain_choice_no_options: [],
  answer_value_not_in_options: [],
  unknown_game_type: [],
  type_mismatch_other: [],
};

for (const q of rows) {
  // v0.31.75: play_as 是真正驱动模板的字段；优先用 play_as 判别匹配
  const gt = q.play_as ?? q.game_type;
  const at = q.answer?.type;
  if (!gt || !at) continue;
  // plain_numeric template 接受 number type
  const expected =
    gt === "plain_numeric"
      ? new Set(["number", "fill_blank"])
      : EXPECTED_ANSWER_TYPES[gt];
  if (!expected) {
    findings.unknown_game_type.push({ id: q.question_id, game_type: gt });
    continue;
  }
  if (!expected.has(at)) {
    // Specific bucket for the most common bug
    if (gt === "decimal_shifter" && at === "choice") {
      findings.decimal_shifter_with_choice.push({
        id: q.question_id,
        stem: q.stem?.slice(0, 60),
        answerValue: q.answer?.value,
        options: q.options?.map((o) => ({ id: o.id, text: o.text })) ?? [],
        tags: q.tags,
      });
    } else {
      findings.type_mismatch_other.push({
        id: q.question_id,
        stem: q.stem?.slice(0, 60),
        game_type: gt,
        answer_type: at,
        expected: [...expected],
      });
    }
    continue;
  }
  // Additional check 1: choice → must have options + answer.value in options
  if (at === "choice") {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      findings.plain_choice_no_options.push({
        id: q.question_id,
        stem: q.stem?.slice(0, 60),
        game_type: gt,
      });
      continue;
    }
    const optIds = new Set(q.options.map((o) => o.id));
    if (!optIds.has(q.answer?.value)) {
      findings.answer_value_not_in_options.push({
        id: q.question_id,
        stem: q.stem?.slice(0, 60),
        answerValue: q.answer?.value,
        optionIds: [...optIds],
      });
    }
  }
  // Additional check 2: multi_step → must have subquestions
  if (at === "multi_step" && !Array.isArray(q.subquestions)) {
    findings.word_problem_lab_no_subquestions.push({
      id: q.question_id,
      stem: q.stem?.slice(0, 60),
      game_type: gt,
    });
  }
}

console.log("\n══════ 题型/数据匹配审计 ══════\n");
for (const [k, v] of Object.entries(findings)) {
  console.log(`${k}: ${v.length} 道`);
}
console.log();
if (findings.decimal_shifter_with_choice.length > 0) {
  console.log("=== decimal_shifter + answer.type=choice 样本（最多 8 道）===");
  for (const f of findings.decimal_shifter_with_choice.slice(0, 8)) {
    console.log(`  ${f.id}: ${f.stem}…`);
    console.log(`    answer=${f.answerValue}, options=${f.options.map((o) => o.id + ":" + o.text).join(" / ")}`);
  }
  console.log();
}
if (findings.unknown_game_type.length > 0) {
  console.log("=== unknown game_type 分布 ===");
  const counts = {};
  for (const f of findings.unknown_game_type) {
    counts[f.game_type] = (counts[f.game_type] ?? 0) + 1;
  }
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  console.log();
}

writeFileSync("/tmp/template-mismatch.json", JSON.stringify(findings, null, 2));
console.error(`\n✓ Findings written to /tmp/template-mismatch.json`);
