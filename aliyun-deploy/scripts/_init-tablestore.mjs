/**
 * One-shot: create all Tablestore tables for xiaojinapp.
 * Idempotent — skips existing tables.
 *
 * Tables:
 *   auth_users      PK: password STRING — fast password lookup
 *   users_index     PK: userId STRING   — dashboard 聚合每 user
 *   reports         PK: userId STRING, reportId STRING — 报题流
 *   agent_summaries PK: userId STRING, ts INT          — 摘要时序
 *   image_tasks     PK: userId STRING, taskId STRING   — 图生任务
 *
 * Run: cd aliyun-deploy && node scripts/_init-tablestore.mjs
 */
import TableStore from "tablestore";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const client = new TableStore.Client({
  accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID,
  secretAccessKey: env.ALIYUN_OSS_ACCESS_KEY_SECRET,
  endpoint: env.ALIYUN_TABLESTORE_ENDPOINT,
  instancename: env.ALIYUN_TABLESTORE_INSTANCE,
});

const TABLES = [
  {
    name: "auth_users",
    primaryKeys: [{ name: "password", type: "STRING" }],
    desc: "password → userId. Fast lookup at auth time.",
  },
  {
    name: "users_index",
    primaryKeys: [{ name: "userId", type: "STRING" }],
    desc: "Per-user dashboard aggregate (profile, snapshot meta, kpi, summary preview).",
  },
  {
    name: "reports",
    primaryKeys: [
      { name: "userId", type: "STRING" },
      { name: "reportId", type: "STRING" },
    ],
    desc: "Question reports. Composite PK for per-user filtering.",
  },
  {
    name: "agent_summaries",
    primaryKeys: [
      { name: "userId", type: "STRING" },
      { name: "ts", type: "INTEGER" },
    ],
    desc: "Time-series AI summaries.",
  },
  {
    name: "image_tasks",
    primaryKeys: [
      { name: "userId", type: "STRING" },
      { name: "taskId", type: "STRING" },
    ],
    desc: "Image generation task state.",
  },
];

function pTableMeta(t) {
  return {
    tableName: t.name,
    primaryKey: t.primaryKeys,
  };
}

const reservedThroughput = {
  capacityUnit: { read: 0, write: 0 }, // CU mode 按量付费，预留 = 0
};

const tableOptions = {
  timeToLive: -1,            // 永不过期
  maxVersions: 1,            // 只留最新版本
};

async function listExisting() {
  return new Promise((resolve, reject) => {
    client.listTable({}, (err, res) => err ? reject(err) : resolve(res.tableNames || []));
  });
}

async function createTable(t) {
  return new Promise((resolve, reject) => {
    client.createTable(
      {
        tableMeta: pTableMeta(t),
        reservedThroughput,
        tableOptions,
      },
      (err, res) => err ? reject(err) : resolve(res),
    );
  });
}

(async () => {
  console.log("Listing existing tables…");
  const existing = await listExisting();
  console.log("  existing:", existing);
  for (const t of TABLES) {
    if (existing.includes(t.name)) {
      console.log(`  ✓ ${t.name} (already exists)`);
      continue;
    }
    try {
      await createTable(t);
      console.log(`  + ${t.name} created — ${t.desc}`);
    } catch (e) {
      console.error(`  ✗ ${t.name} failed: ${e.message}`);
    }
  }
  console.log("\nDone. Re-list to confirm:");
  const after = await listExisting();
  console.log("  ", after);
})().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
