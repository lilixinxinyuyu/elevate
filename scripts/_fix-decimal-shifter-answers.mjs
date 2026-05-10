#!/usr/bin/env node
/**
 * v0.31.75：修 D1 里 30 道 decimal_shifter 题的 answer 数据。
 *
 * 现状：每道 game_type=decimal_shifter 但 answer.type=choice + value=A/B/C/D。
 *   DecimalShifter 模板期 answer.type=number → 当前实测把 target 误设成 0
 *   → Selena 把 1.28 移成 128 系统判错。
 *
 * 修复：
 *   1. 找正确选项的 text，parse 成 number
 *   2. 写回 answer = { type: "number", value: <parsedNumber> }
 *   3. 保留 options 字段（不删，让 DecimalShifter 也能 fallback 用）
 *   4. POST 回 /api/sync/ai-questions 更新
 *
 * 用法:
 *   APP_PASSWORD=... node scripts/_fix-decimal-shifter-answers.mjs [--apply]
 */
import { readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const APP_PASSWORD = process.env.APP_PASSWORD;
if (APPLY && !APP_PASSWORD) {
  console.error("ERROR: --apply 需要 APP_PASSWORD env");
  process.exit(1);
}
const PROD = "https://selena-elevate.pages.dev";

const aj = JSON.parse(readFileSync("/tmp/aiqs.json", "utf8"));
const rows = aj.rows ?? [];

const broken = rows.filter(
  (q) =>
    q.game_type === "decimal_shifter" &&
    q.answer?.type === "choice" &&
    Array.isArray(q.options),
);
console.log(`▶ Found ${broken.length} broken decimal_shifter questions`);

const fixed = [];
const failed = [];

for (const q of broken) {
  const correctOpt = q.options.find((o) => o.id === q.answer.value);
  if (!correctOpt) {
    failed.push({ id: q.question_id, reason: "no_correct_option" });
    continue;
  }
  // Parse number from option text — strip non-digit/dot/minus chars
  const text = String(correctOpt.text).trim();
  const numStr = text.replace(/[^\d.\-]/g, "");
  const n = Number(numStr);
  if (Number.isNaN(n)) {
    failed.push({ id: q.question_id, reason: "parse_failed", text });
    continue;
  }
  // 创建新版 question，保留所有原字段，只改 answer + 加 status=approved
  const updated = {
    ...q,
    answer: { type: "number", value: n },
    // 保留 options 让前端可 fallback 兼容；DecimalShifter 现在两者都能 parse
  };
  fixed.push({ id: q.question_id, oldAnswer: q.answer, newValue: n, stem: q.stem.slice(0, 60), updated });
}

console.log(`✓ Fixed ${fixed.length}, failed ${failed.length}`);
console.log("\n=== Sample fixes ===");
for (const f of fixed.slice(0, 8)) {
  console.log(`  ${f.id}: choice=${f.oldAnswer.value} → number=${f.newValue}`);
  console.log(`    stem: ${f.stem}…`);
}
if (failed.length > 0) {
  console.log("\n=== Failed ===");
  for (const f of failed) console.log(`  ${f.id}: ${f.reason}${f.text ? ' (text: ' + f.text + ')' : ''}`);
}

writeFileSync(
  "/tmp/decimal-shifter-fixes.json",
  JSON.stringify({ count: fixed.length, fixes: fixed.map((f) => ({ id: f.id, oldAnswer: f.oldAnswer, newValue: f.newValue, stem: f.stem })) }, null, 2),
);

if (!APPLY) {
  console.log(`\n✓ Dry run. To apply: --apply`);
  process.exit(0);
}

// Apply: POST batches to /api/sync/ai-questions
console.log("\n══════ Applying ══════");
const BATCH = 30;
let pushed = 0,
  failedPush = 0;
for (let i = 0; i < fixed.length; i += BATCH) {
  const batch = fixed.slice(i, i + BATCH).map((f) => f.updated);
  try {
    const r = await fetch(`${PROD}/api/sync/ai-questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${APP_PASSWORD}` },
      body: JSON.stringify({ rows: batch }),
    });
    if (!r.ok) {
      console.error(`  batch ${i}: HTTP ${r.status}`);
      failedPush += batch.length;
      continue;
    }
    const j = await r.json();
    pushed += j.accepted ?? 0;
    process.stderr.write(`.`);
  } catch (e) {
    console.error(`\n  batch ${i} threw: ${e.message}`);
    failedPush += batch.length;
  }
}
console.error();
console.log(`\n✓ Push: ${pushed} updated, ${failedPush} failed`);
