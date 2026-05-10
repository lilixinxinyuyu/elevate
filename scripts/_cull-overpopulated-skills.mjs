#!/usr/bin/env node
/**
 * v0.31.87 — 题库治理：每 skill 最多保留 N 道，多余的删。
 *
 * 用例：题库失衡（plain_choice 占 78%），现在让 fill-bank 按权重抽生成多样题型。
 * 但已经过量的 skill 占着配额，新题型 push 时会卡顿。
 * 这个脚本把每 skill 修剪到 N 道，**优先保留多样 game_type**：
 *   - 按 game_type 分组
 *   - 每组保留 ceil(N / types_count) 道
 *   - 删剩下的（sort by question_id 字典序，删后部）
 *
 * 例：某 skill 有 79 道 plain_choice，目标 N=20：
 *   - 79 道 / 1 type = 保留前 20，删 59 道
 *
 * 例：另一 skill 有 30 道 (20 plain + 10 speed_match)，目标 N=20：
 *   - 2 types：每组保留 10 道。最终 10 + 10 = 20
 *
 * 用法：
 *   APP_PASSWORD=xxx node scripts/_cull-overpopulated-skills.mjs <target=20> [--apply]
 *   - 默认 dry-run（只打印计划，不删）
 *   - --apply 真删
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

for (const path of [join(PROJECT_ROOT, "..", ".dev.vars"), join(PROJECT_ROOT, ".dev.vars")]) {
  try {
    const dv = readFileSync(path, "utf8");
    for (const line of dv.split("\n")) {
      const [k, ...rest] = line.split("=");
      if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
    }
  } catch { /* */ }
}

const APP_PWD = process.env.APP_PASSWORD;
if (!APP_PWD) { console.error("APP_PASSWORD env required"); process.exit(1); }

const TARGET = Number(process.argv[2] ?? 20);
const APPLY = process.argv.includes("--apply");
const PROD = "https://selena-elevate.pages.dev";

function fetchAuth(path, opts = {}) {
  return fetch(`${PROD}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${APP_PWD}`, ...opts.headers },
  });
}

console.log(`目标：每 skill 最多 ${TARGET} 道（${APPLY ? "ACTUAL APPLY" : "DRY-RUN"}）\n`);

const r = await fetchAuth("/api/sync/ai-questions");
const j = await r.json();
const rows = j.rows ?? [];
console.log(`从 D1 拉到 ${rows.length} 道 AI 题\n`);

// 按 skill_id 分组
const bySkill = new Map();
for (const q of rows) {
  if (!q.skill_id) continue;
  if (!bySkill.has(q.skill_id)) bySkill.set(q.skill_id, []);
  bySkill.get(q.skill_id).push(q);
}

const overpopulated = [];
for (const [skill, qs] of bySkill) {
  if (qs.length > TARGET) overpopulated.push({ skill, qs });
}

overpopulated.sort((a, b) => b.qs.length - a.qs.length);

let totalToDelete = 0;
const idsToDelete = [];

for (const { skill, qs } of overpopulated) {
  // 按 game_type 分组
  const byGT = new Map();
  for (const q of qs) {
    const gt = q.game_type || "unknown";
    if (!byGT.has(gt)) byGT.set(gt, []);
    byGT.get(gt).push(q);
  }
  const gtCount = byGT.size;
  // 每组保留 ceil(TARGET / gtCount)
  const perGroup = Math.ceil(TARGET / gtCount);
  const keep = [];
  const cull = [];
  for (const [gt, list] of byGT) {
    // 按 question_id sort (stable)
    list.sort((a, b) => (a.question_id || "").localeCompare(b.question_id || ""));
    keep.push(...list.slice(0, perGroup));
    cull.push(...list.slice(perGroup));
  }
  // 如果 keep 总数仍 > TARGET（perGroup 上取整），随机 cull 部分多余的
  while (keep.length > TARGET) {
    cull.push(keep.pop());
  }
  totalToDelete += cull.length;
  for (const c of cull) idsToDelete.push(c.question_id);
  console.log(
    `${skill}: ${qs.length} → ${keep.length} (删 ${cull.length}) | 类型分布 ${
      [...byGT.entries()].map(([gt, l]) => `${gt}:${l.length}`).join(", ")
    }`,
  );
}

console.log(
  `\n=== 总览 ===\n超量 skill: ${overpopulated.length}\n待删: ${totalToDelete} 道\n保留: ${rows.length - totalToDelete} 道`,
);

if (!APPLY) {
  console.log("\n（DRY-RUN — 加 --apply 真删）");
  process.exit(0);
}

// 实际删除：调 /api/sync/ai-questions DELETE（v0.31.87 加的端点）
console.log("\n开始删除...");
let deleted = 0;
const BATCH = 50;
for (let i = 0; i < idsToDelete.length; i += BATCH) {
  const chunk = idsToDelete.slice(i, i + BATCH);
  const r = await fetchAuth("/api/sync/ai-questions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: chunk }),
  });
  if (!r.ok) {
    console.error(`批次 ${i / BATCH + 1} 失败: ${r.status}`);
    continue;
  }
  const j = await r.json();
  deleted += j.deleted ?? 0;
  process.stdout.write(`.`);
}
console.log(`\n\n✅ 删除完成：${deleted} 道`);
