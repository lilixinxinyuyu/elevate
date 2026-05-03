#!/usr/bin/env node
/**
 * 通过 /api/sync/upload 把 IndexedDB dump 上传到 D1。
 * 绕过 wrangler d1 execute 的"语句过长"限制（D1 Worker 用 prepare().bind() 没这个限制）。
 *
 * 用法：
 *   APP_PASSWORD=selena-2026 \
 *     node db/upload-via-api.mjs ~/Desktop/xy/db/heping-math-trainer.json https://selena-elevate.pages.dev
 */
import { readFileSync } from "node:fs";
import { argv, env } from "node:process";

const file = argv[2];
const baseUrl = argv[3] ?? "https://selena-elevate.pages.dev";
const pwd = env.APP_PASSWORD;
if (!file || !pwd) {
  console.error("usage: APP_PASSWORD=<pwd> node upload-via-api.mjs <dump.json> [baseUrl]");
  process.exit(1);
}

const PUSH_TABLES = ["attempts", "mastery", "mistakes", "sessions", "trophies", "meta", "students"];
const raw = JSON.parse(readFileSync(file, "utf8"));
const payload = {};
for (const t of PUSH_TABLES) {
  payload[t] = (raw[t] ?? []).map((r) => (r && typeof r === "object" && "value" in r ? r.value : r));
}

const totalXp = (payload.meta.find((m) => m?.key?.startsWith("totalXp::") && typeof m.value === "number") ?? {}).value ?? 0;

const body = {
  payload,
  attemptsCount: payload.attempts.length,
  sessionsCount: payload.sessions.length,
  totalXp,
  clientId: "import-dump",
};

console.error(`uploading ${(JSON.stringify(payload).length / 1024).toFixed(1)} KB to ${baseUrl}/api/sync/upload`);

const resp = await fetch(`${baseUrl}/api/sync/upload`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${pwd}` },
  body: JSON.stringify(body),
});
const data = await resp.json();
console.log(JSON.stringify(data, null, 2));
process.exit(resp.ok && data.ok ? 0 : 1);
