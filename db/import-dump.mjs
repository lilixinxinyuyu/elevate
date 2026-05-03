#!/usr/bin/env node
/**
 * 把 IndexedDB 导出 JSON 转成可以 wrangler d1 execute 的 SQL，
 * 让 Selena 现有的 ~430 道答题历史 / 187 奖杯一次性进 D1，
 * 之后她在任何设备打开输密码 → 立即同步过来。
 *
 * 用法：
 *   node db/import-dump.mjs <dump.json>      # 输出 SQL 到 stdout
 *   node db/import-dump.mjs <dump.json> > db/import-dump.sql
 *   wrangler d1 execute selena-elevate-db --remote --file=db/import-dump.sql
 *
 * 转换：
 *   IndexedDB dump 的 { table: [{key,value}, ...] } 形式
 *     → 同步 schema 期望的 { table: [row, row, ...] } 形式
 *   然后 INSERT 一条 snapshots 行。
 */

import { readFileSync } from "node:fs";
import { argv } from "node:process";

const PUSH_TABLES = ["attempts", "mastery", "mistakes", "sessions", "trophies", "meta", "students"];

const file = argv[2];
if (!file) {
  console.error("usage: node import-dump.mjs <dump.json>");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(file, "utf8"));
const payload = {};
for (const t of PUSH_TABLES) {
  const rows = raw[t] ?? [];
  payload[t] = rows.map((r) => (r && typeof r === "object" && "value" in r ? r.value : r));
}

const totalXp = (() => {
  for (const m of payload.meta) {
    if (typeof m?.key === "string" && m.key.startsWith("totalXp::") && typeof m.value === "number") {
      return m.value;
    }
  }
  return 0;
})();

const json = JSON.stringify(payload);
// SQL 单引号转义
const safe = json.replace(/'/g, "''");
const now = Date.now();

const sql = `INSERT INTO snapshots (user_key, payload, attempts_count, sessions_count, total_xp, client_id, created_at)
VALUES ('selena', '${safe}', ${payload.attempts.length}, ${payload.sessions.length}, ${totalXp}, 'import-dump', ${now});
`;

process.stderr.write(`[import-dump] tables:\n`);
for (const t of PUSH_TABLES) process.stderr.write(`  ${t}: ${payload[t].length}\n`);
process.stderr.write(`[import-dump] payload size: ${(json.length / 1024).toFixed(1)} KB\n`);
process.stdout.write(sql);
