#!/usr/bin/env node
/**
 * 扫描 D1 里所有 AI 题，按 leak 模式分类，输出报告。
 *
 * 用法：
 *   curl -H "Authorization: Bearer $APP_PASSWORD" \
 *     https://selena-elevate.pages.dev/api/sync/ai-questions?since=0 \
 *     -o /tmp/aiqs.json
 *   node scripts/_audit-leak-patterns.mjs
 *
 * 检测的 leak 模式（对应 quality-principles.md 的 P1-P4）：
 *
 * P1（题面纯净）：
 *   - clue_meta_annotation：clue 文本里挂"（无关）/（非已知）/（解题设定）"等元注解
 *   - option_errorTag_visible：options 上挂了 errorTag 字段（应该在 _internal_）
 *
 * P2（数学闭合）：
 *   - math_not_closed_sum：和倍/差倍题，总数不能被 (n+1)/(n-1) 整除
 *   - non_integer_count：果树/人数/本数等整数情境答案给了小数
 *
 * P3（干扰项独立）：
 *   - distractor_is_other_quantity：numeric distractor 是题中可识别的另一量值（暂不实现 — 需 NLP）
 *
 * P4：暂不机械检测（需 AI judge）。
 */
import { readFileSync, writeFileSync } from "node:fs";

const aj = JSON.parse(readFileSync("/tmp/aiqs.json", "utf8"));
const rows = aj.rows ?? [];
console.error(`Loaded ${rows.length} questions from /tmp/aiqs.json`);

const META_PATTERNS = [
  "（无关）",
  "(无关)",
  "（非已知）",
  "(非已知)",
  "（解题设定）",
  "(解题设定)",
  "（解题设定，非已知）",
  "（无关条件）",
  "（提示）",
  "（干扰）",
  "（混淆）",
];

function hasMetaAnnotation(text) {
  if (typeof text !== "string") return false;
  return META_PATTERNS.some((p) => text.includes(p));
}

const cleanedClues = (clues) =>
  Array.isArray(clues)
    ? clues.map((c) => {
        if (typeof c !== "string") return c;
        let cleaned = c;
        for (const p of META_PATTERNS) cleaned = cleaned.split(p).join("");
        return cleaned.replace(/\s+$/g, "").replace(/，$/g, "").trim();
      })
    : clues;

// ============================================================
// Detector functions
// ============================================================

function detectClueMetaAnnotation(q) {
  for (const sub of q.subquestions ?? []) {
    if (sub.kind === "clue_pick" && Array.isArray(sub.clues)) {
      for (const clue of sub.clues) {
        if (hasMetaAnnotation(clue)) return true;
      }
    }
  }
  return false;
}

function detectOptionErrorTag(q) {
  for (const sub of q.subquestions ?? []) {
    if (sub.kind === "choose" && Array.isArray(sub.options)) {
      for (const opt of sub.options) {
        if (opt && typeof opt === "object" && "errorTag" in opt) return true;
      }
    }
  }
  // 也检查顶层 options（plain_choice 等）
  if (Array.isArray(q.options)) {
    for (const opt of q.options) {
      if (opt && typeof opt === "object" && "errorTag" in opt) return true;
    }
  }
  return false;
}

function detectNonIntegerCount(q) {
  // 启发式：unit 是 棵/人/个/本/只/张/件/朵/支/把/瓶/盒 等可数实物时，answer 必须整数
  const integerUnits = new Set([
    "棵","人","个","本","只","张","件","朵","支","把","瓶","盒",
    "辆","双","副","串","根","条","头","匹","名","位",
  ]);
  // 找 numeric subquestion
  for (const sub of q.subquestions ?? []) {
    if (sub.kind === "numeric" && integerUnits.has(sub.unit)) {
      if (typeof sub.value === "number" && !Number.isInteger(sub.value)) {
        return { unit: sub.unit, value: sub.value };
      }
    }
  }
  // 也检查 answer.steps[].expected
  for (const step of q.answer?.steps ?? []) {
    if (step.kind === "answer" && typeof step.expected === "number") {
      // 没法知道 unit，跳过
    }
  }
  return null;
}

function detectMathNotClosedSumDifference(q) {
  // 仅针对 skill_id = equation_sum_difference 或 stem 含"倍" + "共/相差"
  if (q.skill_id !== "equation_sum_difference") return null;
  const stem = q.stem ?? "";
  // 提取数字
  const nums = (stem.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (nums.length < 2) return null;
  // 试图匹配 "X 倍" 关系
  const beiMatch = stem.match(/(\d+)\s*倍/);
  if (!beiMatch) return null;
  const multiplier = Number(beiMatch[1]);
  if (multiplier < 2) return null;
  // 找总数（最大数字）
  const total = Math.max(...nums);
  // 启发式：和倍 → total / (multiplier+1)；差倍 → total / (multiplier-1)
  // 只要其中一个能整除就 OK
  const sumQuotient = total / (multiplier + 1);
  const diffQuotient = total / (multiplier - 1);
  const sumOk = Number.isInteger(sumQuotient);
  const diffOk = Number.isInteger(diffQuotient);
  if (!sumOk && !diffOk) {
    return { multiplier, total, sumQuotient, diffQuotient };
  }
  return null;
}

// ============================================================
// Run
// ============================================================

const findings = {
  clue_meta_annotation: [],
  option_errorTag_visible: [],
  non_integer_count: [],
  math_not_closed_sum: [],
};

for (const q of rows) {
  if (detectClueMetaAnnotation(q)) {
    findings.clue_meta_annotation.push(q.question_id);
  }
  if (detectOptionErrorTag(q)) {
    findings.option_errorTag_visible.push(q.question_id);
  }
  const nic = detectNonIntegerCount(q);
  if (nic) {
    findings.non_integer_count.push({ id: q.question_id, ...nic });
  }
  const mnc = detectMathNotClosedSumDifference(q);
  if (mnc) {
    findings.math_not_closed_sum.push({ id: q.question_id, stem: q.stem.slice(0, 50), ...mnc });
  }
}

console.log("\n══════ AI 题库 leak 模式扫描报告（共 " + rows.length + " 道）══════\n");

console.log("P1 题面纯净：");
console.log(`  clue 文本含"（无关）/（非已知）/（解题设定）"等元注解：${findings.clue_meta_annotation.length} 道`);
console.log(`  options 上挂 errorTag 字段：${findings.option_errorTag_visible.length} 道`);
console.log(`\nP2 数学闭合 + 现实合常识：`);
console.log(`  numeric.unit=可数实物（棵/人/个等）但 value 是小数：${findings.non_integer_count.length} 道`);
console.log(`  和倍/差倍题数学不闭合（不整除）：${findings.math_not_closed_sum.length} 道`);

// Sample print
console.log("\n--- 样例：clue 元注解 ---");
for (const id of findings.clue_meta_annotation.slice(0, 5)) {
  const q = rows.find((r) => r.question_id === id);
  for (const sub of q.subquestions ?? []) {
    if (sub.kind === "clue_pick") {
      const annotated = (sub.clues ?? []).filter(hasMetaAnnotation);
      console.log(`  ${id}:`);
      for (const a of annotated) console.log(`    - ${a}`);
      break;
    }
  }
}

console.log("\n--- 样例：math_not_closed ---");
for (const f of findings.math_not_closed_sum.slice(0, 5)) {
  console.log(`  ${f.id}: 倍数=${f.multiplier}, 总数=${f.total}, sum→${f.sumQuotient.toFixed(3)}, diff→${f.diffQuotient.toFixed(3)}`);
  console.log(`    stem: ${f.stem}…`);
}

console.log("\n--- 样例：non_integer_count ---");
for (const f of findings.non_integer_count.slice(0, 5)) {
  console.log(`  ${f.id}: ${f.value} ${f.unit}`);
}

writeFileSync("/tmp/leak-audit.json", JSON.stringify(findings, null, 2));
console.error(`\n✓ Findings written to /tmp/leak-audit.json`);

// Also output combined summary for cleanup decision
const allIds = new Set();
for (const arr of Object.values(findings)) {
  for (const item of arr) allIds.add(typeof item === "string" ? item : item.id);
}
console.log(`\n══════ 总结 ══════`);
console.log(`含至少一种 leak 的题：${allIds.size} 道（${(100 * allIds.size / rows.length).toFixed(1)}%）`);
console.log(`完全干净的题：${rows.length - allIds.size} 道`);
