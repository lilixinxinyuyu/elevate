/**
 * Aliyun Function Compute 3.0 — daily backup snapshot + prune.
 *
 * Runtime: nodejs22 (FC 3.0 默认)
 * Trigger: cron `0 0 3 * * ?` (UTC) — 每天 03:00 UTC = 11:00 Beijing
 * Memory: 128 MB (轻量)
 * Timeout: 60s (足够 backup-snapshot 2 个 ossCopy + prune 1 list + 1 deleteMulti)
 *
 * Workflow:
 *   1. POST https://admin.xiaojin.app/api/super-admin/backup-snapshot
 *      with Authorization: Bearer ${BACKUP_TOKEN}
 *      body { note: "cron daily" }
 *   2. List _backups/ prefixes via ali-oss
 *   3. Apply retention policy (14d daily + 12w weekly + 12m monthly)
 *   4. ossDeleteMulti the rest
 *   5. Return summary { backupId, kept, deleted }
 *
 * Env vars (configured in FC console or s.yaml):
 *   BACKUP_TOKEN — same value as EdgeRoutine baked env
 *   ALIYUN_OSS_REGION, ALIYUN_OSS_BUCKET, ALIYUN_OSS_ACCESS_KEY_ID,
 *   ALIYUN_OSS_ACCESS_KEY_SECRET — same OSS creds as EdgeRoutine
 *
 * Deploy: see README.md (Serverless Devs CLI 推荐)
 */

import OSS from "ali-oss";

const BACKUP_ENDPOINT = "https://admin.xiaojin.app/api/super-admin/backup-snapshot";
const KEEP_DAYS = 14;
const KEEP_WEEKS = 12;
const KEEP_MONTHS = 12;

const BACKUP_ID_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})Z(?:-pre-restore-of-.*)?$/;

function parseBackupId(id) {
  const m = BACKUP_ID_RE.exec(id);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
}

function isoWeek(date) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const w =
    1 +
    Math.round(
      ((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
    );
  return `${target.getUTCFullYear()}-W${String(w).padStart(2, "0")}`;
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function decide(allIds, now = new Date()) {
  const cutoffDays = now.getTime() - KEEP_DAYS * 86400_000;
  const parsed = allIds
    .map((id) => ({ id, date: parseBackupId(id) }))
    .filter((x) => x.date)
    .sort((a, b) => b.date - a.date);

  const keep = new Set();
  for (const { id, date } of parsed) {
    if (date.getTime() >= cutoffDays) keep.add(id);
  }
  const weekly = new Map();
  for (const { id, date } of parsed) {
    const wk = isoWeek(date);
    if (!weekly.has(wk)) weekly.set(wk, id);
  }
  for (const [, id] of [...weekly].slice(0, KEEP_WEEKS)) keep.add(id);
  const monthly = new Map();
  for (const { id, date } of parsed) {
    const mk = monthKey(date);
    if (!monthly.has(mk)) monthly.set(mk, id);
  }
  for (const [, id] of [...monthly].slice(0, KEEP_MONTHS)) keep.add(id);

  return {
    kept: parsed.filter((x) => keep.has(x.id)).map((x) => x.id),
    toDelete: parsed.filter((x) => !keep.has(x.id)).map((x) => x.id),
  };
}

async function listBackupIds(oss) {
  const ids = [];
  let marker;
  do {
    const r = await oss.list({
      prefix: "_backups/",
      delimiter: "/",
      "max-keys": 1000,
      marker,
    });
    for (const p of r.prefixes ?? []) {
      ids.push(p.slice("_backups/".length, -1));
    }
    marker = r.nextMarker;
  } while (marker);
  return ids;
}

async function listKeysInBackup(oss, backupId) {
  const keys = [];
  let marker;
  do {
    const r = await oss.list({
      prefix: `_backups/${backupId}/`,
      "max-keys": 1000,
      marker,
    });
    for (const o of r.objects ?? []) keys.push(o.name);
    marker = r.nextMarker;
  } while (marker);
  return keys;
}

/**
 * FC 3.0 HTTP/Timer trigger entrypoint (Node.js).
 * For Timer trigger: event arg ignored; we always run backup + prune.
 * For HTTP trigger: same behavior (idempotent), returns JSON summary.
 */
export const handler = async (event, context) => {
  const startedAt = Date.now();
  console.log("[fc-cron] start", new Date().toISOString(), "context:", context?.requestId);

  const token = process.env.BACKUP_TOKEN;
  if (!token) {
    console.error("[fc-cron] BACKUP_TOKEN env missing");
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: "BACKUP_TOKEN missing" }) };
  }

  // ── 1) Trigger backup snapshot via EdgeRoutine ────────────────
  const backupRes = await fetch(BACKUP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ note: "cron daily 03:00 UTC" }),
  });
  const backupJson = await backupRes.json().catch(() => null);
  console.log("[fc-cron] backup status:", backupRes.status, JSON.stringify(backupJson)?.slice(0, 300));
  if (!backupRes.ok || !backupJson?.ok) {
    return {
      statusCode: 502,
      body: JSON.stringify({
        ok: false,
        stage: "backup",
        status: backupRes.status,
        detail: backupJson,
      }),
    };
  }

  // ── 2) Prune old backups via direct OSS access ────────────────
  if (!process.env.ALIYUN_OSS_ACCESS_KEY_ID) {
    console.warn("[fc-cron] OSS creds missing — skipping prune");
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        backup: { backupId: backupJson.backupId },
        prune: { skipped: "no_oss_creds" },
        durationMs: Date.now() - startedAt,
      }),
    };
  }

  const oss = new OSS({
    endpoint: `https://${process.env.ALIYUN_OSS_REGION}.aliyuncs.com`,
    bucket: process.env.ALIYUN_OSS_BUCKET,
    accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
    secure: true,
  });

  const allIds = await listBackupIds(oss);
  const { kept, toDelete } = decide(allIds);
  console.log(`[fc-cron] prune plan: ${allIds.length} total, keep ${kept.length}, delete ${toDelete.length}`);

  let removedKeys = 0;
  for (const id of toDelete) {
    const keys = await listKeysInBackup(oss, id);
    if (keys.length === 0) continue;
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      const r = await oss.deleteMulti(batch, { quiet: true });
      removedKeys += r.res?.statusCode === 200 ? batch.length : 0;
    }
  }

  const summary = {
    ok: true,
    backup: { backupId: backupJson.backupId, copied: backupJson.copied?.length ?? 0 },
    prune: {
      total: allIds.length,
      kept: kept.length,
      deletedSnapshots: toDelete.length,
      removedKeys,
    },
    durationMs: Date.now() - startedAt,
    startedAt: new Date(startedAt).toISOString(),
  };
  console.log("[fc-cron] done", JSON.stringify(summary));
  return { statusCode: 200, body: JSON.stringify(summary) };
};
