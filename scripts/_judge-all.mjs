#!/usr/bin/env node
/**
 * 跑新版 AI judge（v0.31.72 4 P 原则）扫所有 D1 AI 题，输出 verdict 报告。
 *
 * 不直接 delete — 只生成 /tmp/judge-results.json + summary，让爸爸看完再决定。
 *
 * 用法:
 *   APP_PASSWORD=... node scripts/_judge-all.mjs [batchSize=10] [concurrency=2]
 *
 * 前置: /tmp/aiqs.json 已存在（最新拉的 D1 快照）
 */
import { readFileSync, writeFileSync } from "node:fs";

const APP_PASSWORD = process.env.APP_PASSWORD;
if (!APP_PASSWORD) {
  console.error("ERROR: APP_PASSWORD env required");
  process.exit(1);
}
const PROD = "https://selena-elevate.pages.dev";
const BATCH = Number(process.argv[2] ?? 10);
const CONCURRENCY = Number(process.argv[3] ?? 2);

const aj = JSON.parse(readFileSync("/tmp/aiqs.json", "utf8"));
const allQs = aj.rows ?? [];
console.error(`▶ Judging ${allQs.length} questions, batch=${BATCH}, concurrency=${CONCURRENCY}`);

// Group by subject (math vs chinese)
const bySubject = { math: [], chinese: [] };
for (const q of allQs) {
  const sid = q.subjectId === "chinese" ? "chinese" : "math";
  bySubject[sid].push(q);
}
console.error(`  math: ${bySubject.math.length}, chinese: ${bySubject.chinese.length}`);

// Batch up
function* makeBatches(qs, size) {
  for (let i = 0; i < qs.length; i += size) {
    yield qs.slice(i, i + size);
  }
}

async function judgeBatch(batch, subjectId) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${PROD}/api/agent/judge-questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${APP_PASSWORD}`,
      },
      body: JSON.stringify({
        questions: batch,
        subjectId,
        scopeLabel: "全部 AI 题 v0.31.72 重审",
        scopeFilter: "all",
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, error: `http_${r.status}`, detail: txt.slice(0, 200), batch };
    }
    const j = await r.json();
    if (!j.ok || !Array.isArray(j.judgments)) {
      return { ok: false, error: "bad_response", detail: JSON.stringify(j).slice(0, 200), batch };
    }
    const dt = Date.now() - t0;
    return { ok: true, judgments: j.judgments, dt, batch };
  } catch (e) {
    return { ok: false, error: e.message?.slice(0, 80), batch };
  }
}

const allResults = [];
const errors = [];

for (const [sid, qs] of Object.entries(bySubject)) {
  if (qs.length === 0) continue;
  const batches = [...makeBatches(qs, BATCH)];
  console.error(`\n▶ Subject=${sid}: ${batches.length} batches`);

  // Run with concurrency
  let i = 0;
  let done = 0;
  async function worker(workerId) {
    while (i < batches.length) {
      const myIdx = i++;
      const batch = batches[myIdx];
      const r = await judgeBatch(batch, sid);
      done++;
      if (r.ok) {
        allResults.push(...r.judgments);
        process.stderr.write(
          `  [${sid}/W${workerId}] batch ${myIdx + 1}/${batches.length} → ${r.judgments.length} verdicts in ${(r.dt / 1000).toFixed(1)}s (total ${done}/${batches.length})\n`,
        );
      } else {
        errors.push({ subjectId: sid, batchIdx: myIdx, error: r.error, detail: r.detail });
        process.stderr.write(
          `  [${sid}/W${workerId}] batch ${myIdx + 1}/${batches.length} FAILED: ${r.error}\n`,
        );
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, w) => worker(w + 1)));
}

// Summary
const summary = {
  total: allQs.length,
  judged: allResults.length,
  errors: errors.length,
  byVerdict: {},
  bySeverity: {},
  byIssue: {},
};
for (const j of allResults) {
  summary.byVerdict[j.verdict] = (summary.byVerdict[j.verdict] ?? 0) + 1;
  summary.bySeverity[j.severity] = (summary.bySeverity[j.severity] ?? 0) + 1;
  for (const issue of j.issues ?? []) {
    summary.byIssue[issue] = (summary.byIssue[issue] ?? 0) + 1;
  }
}

writeFileSync(
  "/tmp/judge-results.json",
  JSON.stringify({ summary, judgments: allResults, errors }, null, 2),
);

console.log("\n══════ Judge Re-run Summary ══════");
console.log(`Total questions: ${summary.total}`);
console.log(`Judged: ${summary.judged} (${((100 * summary.judged) / summary.total).toFixed(1)}%)`);
console.log(`Errors: ${summary.errors}`);
console.log("\nVerdict distribution:");
for (const [v, n] of Object.entries(summary.byVerdict).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${v}: ${n} (${((100 * n) / summary.judged).toFixed(1)}%)`);
}
console.log("\nSeverity distribution:");
for (const [s, n] of Object.entries(summary.bySeverity).sort((a, b) => Number(b[0]) - Number(a[0]))) {
  console.log(`  severity ${s}: ${n}`);
}
console.log("\nTop issues:");
const sortedIssues = Object.entries(summary.byIssue).sort((a, b) => b[1] - a[1]);
for (const [tag, n] of sortedIssues.slice(0, 15)) {
  console.log(`  ${tag}: ${n}`);
}
console.log(`\n✓ Full results written to /tmp/judge-results.json`);
