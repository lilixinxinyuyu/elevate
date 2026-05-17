/**
 * Migrate OSS data → Tablestore. Idempotent.
 *
 * Source → Target:
 *   _auth/users.json     → auth_users (1 row per password)
 *   _index/users.json    → users_index (1 row per userId, full entry)
 *   users/{uid}/reports/{id}.json + index.json → reports (1 row per report)
 *   users/{uid}/agent-summaries/{ts}.json     → agent_summaries (1 row per ts)
 *   users/{uid}/image-tasks/{id}.json         → image_tasks (1 row per task)
 *
 * Skipped (留 OSS):
 *   snapshot.json (2.5MB, > TS 单行 2MB 限)
 *   profile.json (放 users_index.profile 列, 不独立迁)
 *   stats.json (放 users_index.statsKpi 列)
 *   web/* 前端
 *   agent-summary 全文（preview 进 users_index 即可）
 *
 * Run: node aliyun-deploy/scripts/_migrate-oss-to-ts.mjs
 */
import TableStore from "tablestore";
import OSS from "ali-oss";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const ts = new TableStore.Client({
  accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID,
  secretAccessKey: env.ALIYUN_OSS_ACCESS_KEY_SECRET,
  endpoint: env.ALIYUN_TABLESTORE_ENDPOINT,
  instancename: env.ALIYUN_TABLESTORE_INSTANCE,
});
const oss = new OSS({
  endpoint: `https://${env.ALIYUN_OSS_REGION}.aliyuncs.com`,
  bucket: env.ALIYUN_OSS_BUCKET,
  accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID,
  accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET,
  secure: true,
});

const Long = TableStore.Long;

function strPK(name, value) {
  return { [name]: String(value) };
}

function strCol(name, value) {
  return { [name]: value == null ? "" : String(value) };
}

function intCol(name, value) {
  return { [name]: Long.fromNumber(Number(value) || 0) };
}

function jsonCol(name, value) {
  return { [name]: JSON.stringify(value ?? null) };
}

async function putRow(tableName, primaryKey, attributeColumns) {
  return new Promise((resolve, reject) => {
    ts.putRow(
      {
        tableName,
        condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
        primaryKey,
        attributeColumns,
      },
      (err, res) => err ? reject(err) : resolve(res),
    );
  });
}

async function safeGetJson(key) {
  try {
    const r = await oss.get(key);
    return JSON.parse(r.content.toString("utf-8"));
  } catch (e) {
    if (e.code === "NoSuchKey") return null;
    throw e;
  }
}

async function listOssPrefix(prefix) {
  // Tiny wrapper: list all keys under prefix
  const out = [];
  let marker;
  do {
    const r = await oss.list({ prefix, marker, "max-keys": 1000 });
    if (r.objects) out.push(...r.objects.map((o) => o.name));
    marker = r.nextMarker;
  } while (marker);
  return out;
}

// ─── Migration steps ───────────────────────────────────────

async function migrateAuthUsers() {
  console.log("\n[1/5] auth_users");
  const j = await safeGetJson("_auth/users.json");
  if (!j || !j.passwords) {
    console.log("  no _auth/users.json (will source from baked APP_USERS + APP_PASSWORD)");
    // Use baked fallback
    const map = {};
    if (env.APP_USERS) {
      try {
        Object.assign(map, JSON.parse(env.APP_USERS));
      } catch { /* */ }
    }
    if (env.APP_PASSWORD) {
      map[env.APP_PASSWORD] = "selena";
    }
    if (Object.keys(map).length === 0) {
      console.log("  no baked auth either → nothing to migrate");
      return;
    }
    for (const [pwd, uid] of Object.entries(map)) {
      await putRow(
        "auth_users",
        [strPK("password", pwd)],
        [strCol("userId", uid), intCol("createdAt", Date.now()), strCol("source", "baked")],
      );
      console.log(`  ✓ ${uid} (from baked)`);
    }
    return;
  }
  for (const [pwd, uid] of Object.entries(j.passwords)) {
    await putRow(
      "auth_users",
      [strPK("password", pwd)],
      [strCol("userId", uid), intCol("createdAt", Date.now()), strCol("source", "oss")],
    );
    console.log(`  ✓ ${uid}`);
  }
}

async function migrateUsersIndex() {
  console.log("\n[2/5] users_index");
  const j = await safeGetJson("_index/users.json");
  if (!j || !j.users) {
    console.log("  no _index/users.json");
    return;
  }
  for (const [uid, entry] of Object.entries(j.users)) {
    await putRow(
      "users_index",
      [strPK("userId", uid)],
      [
        strCol("displayName", entry.displayName ?? uid),
        jsonCol("profile", entry.profile),
        intCol("snapshotMs", entry.snapshotMs ?? 0),
        intCol("snapshotBytes", entry.snapshotBytes ?? 0),
        jsonCol("statsKpi", entry.statsKpi),
        jsonCol("latestSummary", entry.latestSummary),
        intCol("updatedAt", entry.lastIndexedAt ?? Date.now()),
      ],
    );
    console.log(`  ✓ ${uid}`);
  }
}

async function migrateReports() {
  console.log("\n[3/5] reports");
  const userIds = await listKnownUsers();
  for (const uid of userIds) {
    const idx = await safeGetJson(`users/${uid}/reports/index.json`);
    if (!idx || !idx.entries) {
      console.log(`  ${uid}: no reports/index`);
      continue;
    }
    for (const entry of idx.entries) {
      // Pull full record for details
      const rec = await safeGetJson(`users/${uid}/reports/${entry.id}.json`);
      if (!rec) continue;
      await putRow(
        "reports",
        [strPK("userId", uid), strPK("reportId", entry.id)],
        [
          strCol("questionId", rec.questionId ?? ""),
          strCol("reason", rec.reason ?? ""),
          strCol("reasonText", rec.reasonText ?? ""),
          jsonCol("originalPayload", rec.originalPayload),
          jsonCol("userAnswer", rec.userAnswer),
          intCol("createdAt", rec.createdAt ?? 0),
          strCol("fixStatus", rec.fixStatus ?? "pending"),
          jsonCol("fixedPayload", rec.fixedPayload),
          strCol("changesSummary", rec.changesSummary ?? ""),
          intCol("fixedAt", rec.fixedAt ?? 0),
          strCol("llmError", rec.llmError ?? ""),
        ],
      );
    }
    console.log(`  ✓ ${uid}: ${idx.entries.length} reports`);
  }
}

async function migrateAgentSummaries() {
  console.log("\n[4/5] agent_summaries");
  const userIds = await listKnownUsers();
  for (const uid of userIds) {
    const keys = await listOssPrefix(`users/${uid}/agent-summaries/`);
    let count = 0;
    for (const key of keys) {
      const fn = key.split("/").pop();
      if (fn === "latest.json") continue; // skip alias
      const ts = parseInt(fn.replace(/\.json$/, ""), 10);
      if (!ts) continue;
      const s = await safeGetJson(key);
      if (!s) continue;
      await putRow(
        "agent_summaries",
        [strPK("userId", uid), { ts: Long.fromNumber(ts) }],
        [
          strCol("summary", s.summary ?? ""),
          strCol("messageToStudent", s.messageToStudent ?? ""),
          strCol("messageToGuardian", s.messageToGuardian ?? ""),
          strCol("model", s.model ?? ""),
          strCol("generatedBy", s.generatedBy ?? ""),
          strCol("guardianRole", s.guardianRole ?? ""),
        ],
      );
      count++;
    }
    if (count > 0) console.log(`  ✓ ${uid}: ${count} summaries`);
  }
}

async function migrateImageTasks() {
  console.log("\n[5/5] image_tasks");
  const userIds = await listKnownUsers();
  for (const uid of userIds) {
    const keys = await listOssPrefix(`users/${uid}/image-tasks/`);
    let count = 0;
    for (const key of keys) {
      const fn = key.split("/").pop();
      const taskId = fn.replace(/\.json$/, "");
      const s = await safeGetJson(key);
      if (!s) continue;
      await putRow(
        "image_tasks",
        [strPK("userId", uid), strPK("taskId", taskId)],
        [
          strCol("status", s.status ?? "pending"),
          jsonCol("urls", s.urls),
          strCol("model", s.model ?? ""),
          strCol("prompt", (s.prompt ?? "").slice(0, 500)),
          intCol("createdAt", s.createdAt ?? 0),
          intCol("updatedAt", s.updatedAt ?? 0),
          strCol("error", s.error ?? ""),
        ],
      );
      count++;
    }
    if (count > 0) console.log(`  ✓ ${uid}: ${count} tasks`);
  }
}

async function listKnownUsers() {
  const j = await safeGetJson("_auth/users.json");
  const ids = new Set();
  if (j?.passwords) {
    for (const v of Object.values(j.passwords)) ids.add(v);
  }
  if (env.APP_PASSWORD) ids.add("selena");
  return [...ids];
}

(async () => {
  await migrateAuthUsers();
  await migrateUsersIndex();
  await migrateReports();
  await migrateAgentSummaries();
  await migrateImageTasks();
  console.log("\n✓ All migrations done. OSS keys remain untouched (dual-write phase).");
})().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
