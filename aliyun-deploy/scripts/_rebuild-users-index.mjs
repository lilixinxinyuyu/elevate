/**
 * One-shot bootstrap of _index/users.json from per-user OSS files.
 * Run from Node (not ESA routine) to bypass 8 fetch limit.
 *
 * Usage: node aliyun-deploy/scripts/_rebuild-users-index.mjs
 */
import OSS from "ali-oss";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8")
    .split("\n").filter((l) => l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const c = new OSS({
  endpoint: `https://${env.ALIYUN_OSS_REGION}.aliyuncs.com`,
  bucket: env.ALIYUN_OSS_BUCKET,
  accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID,
  accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET,
  secure: true,
});

// Get list of userIds from OSS _auth (or env baked APP_USERS as fallback)
async function listUserIds() {
  try {
    const auth = await c.get("_auth/users.json");
    const j = JSON.parse(auth.content.toString("utf-8"));
    return [...new Set(Object.values(j.passwords ?? {}))];
  } catch {
    // fallback baked
    const baked = env.APP_USERS ? JSON.parse(env.APP_USERS) : {};
    const ids = new Set(Object.values(baked));
    if (env.APP_PASSWORD) ids.add("selena");
    return [...ids];
  }
}

async function safeGet(key) {
  try {
    const r = await c.get(key);
    return JSON.parse(r.content.toString("utf-8"));
  } catch (e) {
    if (e.code === "NoSuchKey") return null;
    throw e;
  }
}

async function safeHead(key) {
  try {
    const h = await c.head(key);
    return {
      lastModifiedMs: h.res.headers["last-modified"] ? Date.parse(h.res.headers["last-modified"]) : null,
      bytes: h.res.headers["content-length"] ? Number(h.res.headers["content-length"]) : null,
    };
  } catch (e) {
    if (e.code === "NoSuchKey") return null;
    throw e;
  }
}

const userIds = (await listUserIds()).sort();
console.log("Building index for:", userIds);

const index = { schemaVersion: 1, updatedAt: Date.now(), users: {} };

for (const uid of userIds) {
  const profile = await safeGet(`users/${uid}/profile.json`);
  const stats = await safeGet(`users/${uid}/stats.json`);
  const summary = await safeGet(`users/${uid}/agent-summaries/latest.json`);
  const snap = await safeHead(`users/${uid}/snapshot.json`);

  index.users[uid] = {
    userId: uid,
    displayName: profile?.displayName ?? uid,
    profile,
    snapshotMs: snap?.lastModifiedMs ?? null,
    snapshotBytes: stats?.snapshotBytes ?? snap?.bytes ?? null,
    statsKpi: stats ? {
      todayAttempts: stats.today?.attempts ?? 0,
      last7Attempts: stats.last7Days?.attempts ?? 0,
      correctRate: stats.correctRateRecent100 ?? 0,
    } : null,
    latestSummary: summary ? {
      generatedAt: summary.generatedAt,
      preview: (summary.summary ?? "").slice(0, 50),
    } : null,
    lastIndexedAt: Date.now(),
  };
  console.log(`  ${uid}: profile=${!!profile}, stats=${!!stats}, summary=${!!summary}, snapMs=${snap?.lastModifiedMs}`);
}

await c.put("_index/users.json", Buffer.from(JSON.stringify(index, null, 2)), {
  headers: { "Content-Type": "application/json; charset=utf-8" },
});
console.log(`\n✓ Wrote _index/users.json with ${Object.keys(index.users).length} users`);
