#!/usr/bin/env node
/**
 * 一次性迁移：把主 snapshot 里的 aiQuestions 数组迁到 /api/sync/ai-questions
 * 独立端点（per-row）。迁完后可以从主 snapshot 移除，避免 payload 过大。
 *
 * 用法：APP_PASSWORD=... node scripts/_migrate-aiqs-to-perrow.mjs
 */

const PWD = process.env.APP_PASSWORD;
if (!PWD) { console.error("APP_PASSWORD env required"); process.exit(1); }
const PROD = "https://selena-elevate.pages.dev";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

console.error("▶ Pull current snapshot…");
const dl = await fetch(`${PROD}/api/sync/download`, { headers: { Authorization: `Bearer ${PWD}` } });
const dj = await dl.json();
const aiQs = dj.latest?.payload?.aiQuestions ?? [];
console.error(`  found ${aiQs.length} aiQuestions in main snapshot`);
if (aiQs.length === 0) {
  console.error("  nothing to migrate, exit");
  process.exit(0);
}

console.error(`▶ Push to /api/sync/ai-questions (batches of 30)…`);
let totalPushed = 0;
for (let i = 0; i < aiQs.length; i += 30) {
  const batch = aiQs.slice(i, i + 30);
  let success = false;
  for (let attempt = 0; attempt < 3 && !success; attempt++) {
    if (attempt > 0) await sleep(5000 * attempt);
    try {
      const r = await fetch(`${PROD}/api/sync/ai-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${PWD}` },
        body: JSON.stringify({ rows: batch }),
      });
      if (!r.ok) {
        console.error(`  batch ${i / 30 + 1} attempt ${attempt + 1}: HTTP ${r.status}`);
        continue;
      }
      const txt = await r.text();
      if (!txt.startsWith("{")) {
        console.error(`  batch ${i / 30 + 1} attempt ${attempt + 1}: non-JSON`);
        continue;
      }
      const j = JSON.parse(txt);
      totalPushed += j.accepted ?? 0;
      success = true;
      process.stderr.write(`  batch ${i / 30 + 1}/${Math.ceil(aiQs.length / 30)}: ✓ ${j.accepted}\n`);
    } catch (e) {
      console.error(`  batch ${i / 30 + 1} threw: ${e.message?.slice(0, 80)}`);
    }
  }
  if (!success) console.error(`✗ batch ${i / 30 + 1} 全部重试失败 — 部分迁失败`);
}

console.error(`✓ migrated ${totalPushed}/${aiQs.length}`);
console.log(JSON.stringify({ migrated: totalPushed, source: aiQs.length }, null, 2));
