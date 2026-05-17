/**
 * One-shot: 把 backup/heping-backup-FULL-2026-05-16.json 推到 OSS 作为 Selena
 * 的 snapshot.json, 让其它设备 pull 时能拿到完整数据 (3635 attempts, 930
 * trophies, 426 mistakes, 325 fluency, 62 tutor sessions 等).
 *
 * 背景: 该 backup 是 Selena 设备本地导出的全量, 之前因 oss_http_599 (Ep35
 * 修了) 长期同步不上 OSS. 现在 sync 修了，但 OSS 上的 snapshot 还是 Selena
 * 最近重新 push 的 ~3MB 版本，缺历史。这个脚本一次性把 full backup 灌上去
 * 作为 baseline.
 *
 * 安全:
 *   - 推之前会 copy 当前 OSS snapshot 一份 backup ( _backups/{ts}-pre-import )
 *     失败可回滚
 *   - dumpLocal payload shape: 包含 PUSH_TABLES + 空 aiQuestions
 *   - 不带 trophyImages (走独立 endpoint, 上传 25MB 拖累 ESA)
 *   - 不带 questions/units/skills (seed-only, 从代码加载)
 *
 * 后续:
 *   1. push 完后, Selena 设备打开会自动 pull, attempts 是 append-only union →
 *      她的本地 IDB 会得到 backup ∪ her_local
 *   2. 她下次 push (8s debounce 自动) → OSS 变成 backup ∪ her_local, 成为 truth
 *   3. 其它设备 pull → 拿到完整画面
 *
 * Run: cd aliyun-deploy && node scripts/_import-backup-to-oss.mjs [--apply]
 *      (默认 dry-run 只显示 size; --apply 才真上传)
 */
import OSS from "ali-oss";
import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";

const BACKUP_FILE = "/Users/yong/Desktop/xy/backup/heping-backup-FULL-2026-05-16.json";
const USER_ID = "selena";
const SNAPSHOT_KEY = `users/${USER_ID}/snapshot.json`;

const env = Object.fromEntries(
  readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");

const oss = new OSS({
  endpoint: `https://${env.ALIYUN_OSS_REGION}.aliyuncs.com`,
  bucket: env.ALIYUN_OSS_BUCKET,
  accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID,
  accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET,
  secure: true,
});

// PUSH_TABLES from src/db/cloudSync.ts
const PUSH_TABLES = [
  "attempts", "mastery", "mistakes", "sessions", "trophies",
  "meta", "students", "tutorSessions", "fluencyAttempts", "fluencyStats",
];

console.log(`reading backup: ${BACKUP_FILE}`);
const raw = readFileSync(BACKUP_FILE, "utf-8");
const j = JSON.parse(raw);
console.log(`  backup file size: ${(statSync(BACKUP_FILE).size / 1024 / 1024).toFixed(2)} MB`);
console.log(`  backup version: ${j.version}, exportedAt: ${j.exportedAt}`);

// Build snapshot payload matching dumpLocal() shape
const payload = {};
for (const table of PUSH_TABLES) {
  const rows = j[table];
  payload[table] = Array.isArray(rows) ? rows : [];
  console.log(`  ${table}: ${payload[table].length} rows`);
}
payload.aiQuestions = []; // dumpLocal includes empty aiQuestions

const bodyText = JSON.stringify(payload);
const bodyBytes = Buffer.byteLength(bodyText, "utf-8");
const gzipBytes = gzipSync(bodyText).length;
console.log(`\npayload raw: ${(bodyBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`payload gzipped: ${(gzipBytes / 1024).toFixed(1)} KB`);

(async () => {
  // 1. HEAD current snapshot to compare
  console.log("\n--- current OSS snapshot ---");
  try {
    const h = await oss.head(SNAPSHOT_KEY);
    console.log(`  exists: ${h.res.headers["content-length"]} bytes, last-modified ${h.res.headers["last-modified"]}`);
  } catch (e) {
    if (e.code === "NoSuchKey") console.log("  not exists");
    else throw e;
  }

  if (!APPLY) {
    console.log("\n[dry-run] add --apply to actually upload. Nothing changed.");
    return;
  }

  // 2. Copy current snapshot to _backups/{ts}-pre-import/ as safety
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ts = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z-pre-import-from-2026-05-16-backup`;
  const safetyKey = `_backups/${ts}/users/${USER_ID}/snapshot.json`;
  console.log(`\n--- safety backup current → ${safetyKey} ---`);
  try {
    await oss.copy(safetyKey, SNAPSHOT_KEY);
    console.log("  ✓ safety backup created");
  } catch (e) {
    if (e.code === "NoSuchKey") console.log("  (no current snapshot to back up)");
    else throw e;
  }

  // 3. Upload backup as new snapshot
  console.log(`\n--- uploading ${(bodyBytes / 1024 / 1024).toFixed(2)} MB to ${SNAPSHOT_KEY} ---`);
  const r = await oss.put(SNAPSHOT_KEY, Buffer.from(bodyText), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
  console.log(`  ✓ uploaded. etag=${r.res.headers.etag}, versionId=${r.res.headers["x-oss-version-id"] ?? "(no versioning)"}`);

  // 4. Verify
  const h2 = await oss.head(SNAPSHOT_KEY);
  console.log(`\n--- verify ---`);
  console.log(`  new size: ${h2.res.headers["content-length"]} bytes`);
  console.log(`  last-modified: ${h2.res.headers["last-modified"]}`);

  console.log(`\n[done] safety backup at: ${safetyKey}`);
  console.log("Selena 设备下次 pull (Layout.tsx interval 自动触发) 会 merge 这批数据。");
  console.log("其它设备 pull 立即可见。");
})().catch((e) => {
  console.error("\nfatal:", e.message, e.stack);
  process.exit(1);
});
