#!/usr/bin/env node
/**
 * v0.31.75：修复 D1 里 (game_type, answer.type) 不匹配的题。
 *
 * 已修过：30 道 decimal_shifter + answer.type=choice → 在 _fix-decimal-shifter-answers.mjs
 *
 * 此脚本处理：
 *   - plain_choice / shop_counter + answer.type=number + 没 options
 *     → 把 play_as 改为 "plain_numeric"（前端能渲染纯数字输入框）
 *
 * 用法:
 *   APP_PASSWORD=... node scripts/_fix-template-mismatch.mjs [--apply]
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

const broken = rows.filter((q) => {
  const gt = q.game_type;
  const at = q.answer?.type;
  const hasOpts = Array.isArray(q.options) && q.options.length >= 2;
  if (at !== "number") return false;
  if (gt === "plain_choice" && !hasOpts) return true;
  if (gt === "shop_counter" && !hasOpts && !Array.isArray(q.subquestions)) return true;
  return false;
});

console.log(`▶ Found ${broken.length} questions with answer.type=number but template expects options`);

const fixed = broken.map((q) => ({
  id: q.question_id,
  oldPlayAs: q.play_as,
  newPlayAs: "plain_numeric",
  stem: q.stem?.slice(0, 60),
  updated: { ...q, play_as: "plain_numeric" },
}));

console.log("\n=== Sample (first 8) ===");
for (const f of fixed.slice(0, 8)) {
  console.log(`  ${f.id}: play_as ${f.oldPlayAs} → plain_numeric`);
  console.log(`    stem: ${f.stem}…`);
}

writeFileSync(
  "/tmp/template-mismatch-fixes.json",
  JSON.stringify({ count: fixed.length, fixes: fixed.map((f) => ({ id: f.id, oldPlayAs: f.oldPlayAs })) }, null, 2),
);

if (!APPLY) {
  console.log(`\n✓ Dry run. To apply: --apply`);
  process.exit(0);
}

console.log("\n══════ Applying ══════");
const BATCH = 30;
let pushed = 0;
for (let i = 0; i < fixed.length; i += BATCH) {
  const batch = fixed.slice(i, i + BATCH).map((f) => f.updated);
  const r = await fetch(`${PROD}/api/sync/ai-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${APP_PASSWORD}` },
    body: JSON.stringify({ rows: batch }),
  });
  if (!r.ok) { console.error(`  batch ${i}: HTTP ${r.status}`); continue; }
  const j = await r.json();
  pushed += j.accepted ?? 0;
  process.stderr.write(".");
}
console.error();
console.log(`\n✓ Updated ${pushed} questions`);
