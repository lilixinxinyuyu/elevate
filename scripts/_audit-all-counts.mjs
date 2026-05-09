#!/usr/bin/env node
/**
 * 统计 SEED + 当前 D1 aiQuestions 合并后每个 skill 的总题量。
 * 输出 < 20 的 skill 列表 → /tmp/under20.json，给 fill-bank-v2 用。
 *
 * 用法：
 *   curl -H "Authorization: Bearer $APP_PASSWORD" \
 *     https://selena-elevate.pages.dev/api/sync/download -o /tmp/prod-snapshot.json
 *   node scripts/_audit-all-counts.mjs
 */

import { build } from "esbuild";
import { writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const tmpFile = join(tmpdir(), `auditall-${Date.now()}.mjs`);

await build({
  entryPoints: [join(PROJECT_ROOT, "scripts/_load-content.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: tmpFile,
  logLevel: "error",
});
const { SEED_QUESTIONS, SKILLS, UNITS } = await import(tmpFile);
rmSync(tmpFile, { force: true });

const snap = JSON.parse(readFileSync("/tmp/prod-snapshot.json", "utf8"));
// v0.31.65: aiQuestions 已拆出独立端点。优先从 /tmp/aiqs.json 读（独立 fetch），
// fallback 到主 snapshot（兼容老数据）。
let aiQs = [];
try {
  const aiqsFile = readFileSync("/tmp/aiqs.json", "utf8");
  const aj = JSON.parse(aiqsFile);
  if (Array.isArray(aj.rows)) aiQs = aj.rows;
} catch {
  aiQs = snap.latest?.payload?.aiQuestions ?? [];
}

const UNIT_BY = new Map(UNITS.map(u => [u.id, u]));

const counts = {};
for (const q of SEED_QUESTIONS) {
  if (!q.skill_id) continue;
  if (!counts[q.skill_id]) counts[q.skill_id] = { seed: 0, ai: 0 };
  counts[q.skill_id].seed++;
}
for (const q of aiQs) {
  if (!q.skill_id) continue;
  if (!counts[q.skill_id]) counts[q.skill_id] = { seed: 0, ai: 0 };
  counts[q.skill_id].ai++;
}

const PRIO_RANK = {
  MUST_BIG: 9, HIGH_BIG: 8, MUST_SMALL: 7, VERY_HIGH_SMALL: 6,
  HIGH_SMALL: 5, NORMAL: 4, LOW_SMALL: 2, LOW: 1, EXTENSION: 0,
};

// v0.31.59+: 目标提到 30 — 每 skill 至少 30 道，给 scheduler 留足变化空间。
const TARGET = Number(process.env.TARGET ?? 30);

const rows = SKILLS.map(s => {
  const u = UNIT_BY.get(s.unitId);
  const c = counts[s.id] ?? { seed: 0, ai: 0 };
  const total = c.seed + c.ai;
  const need = Math.max(0, TARGET - total);
  return {
    skillId: s.id,
    skillName: s.name,
    unitId: s.unitId,
    unitName: u?.name ?? s.unitId,
    term: u?.term ?? "?",
    examPriority: s.examPriority,
    priorityRank: PRIO_RANK[s.examPriority] ?? 0,
    seed: c.seed,
    ai: c.ai,
    total,
    need,
  };
}).sort((a, b) => b.need - a.need || b.priorityRank - a.priorityRank);

const under20 = rows.filter(r => r.need > 0);
const ge20 = rows.filter(r => r.need === 0);

console.log(JSON.stringify({
  summary: {
    totalSkills: rows.length,
    seedTotal: SEED_QUESTIONS.length,
    aiTotal: aiQs.length,
    underTwenty: under20.length,
    ofWhichTermXia: under20.filter(r => r.term === "下册").length,
    ofWhichTermShang: under20.filter(r => r.term === "上册").length,
    ofWhichComprehensive: under20.filter(r => r.term === "综合复习").length,
    needTotal: under20.reduce((s, r) => s + r.need, 0),
  },
  under20,
  // 全部 skill 当前题量 (供检查)
  allCounts: rows.map(r => ({ skillId: r.skillId, total: r.total, seed: r.seed, ai: r.ai })),
}, null, 2));

// 命名保留 under20.json 以兼容老脚本 — 实际 threshold 取决于 TARGET env
writeFileSync("/tmp/under20.json", JSON.stringify({ topToFill: under20, target: TARGET }, null, 2));
process.stderr.write(`\n▶ TARGET=${TARGET}, ${under20.length} skill 需补题，总缺 ${under20.reduce((s, r) => s + r.need, 0)} 道\n`);
