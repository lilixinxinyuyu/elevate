/**
 * Prune _backups/{ISO-ts}/ snapshots by retention policy.
 *
 * Policy (default):
 *   - keep all snapshots from the last 14 days (daily granularity)
 *   - keep last 12 weekly snapshots (the latest in each ISO week)
 *   - keep last 12 monthly snapshots (the latest in each calendar month)
 *   - delete everything else
 *
 * Why Node not EdgeRoutine? Aliyun OSS has DeleteMultipleObjects (up to 1000
 * keys per call) but the signature requires Content-MD5, which V8 crypto.subtle
 * doesn't have. ESA EdgeRoutine also limits to 8 fetch/req; pruning N backups
 * × 3 files each easily blows that. Run this from Node (Mac, CI, or future
 * Aliyun Function Compute 3.0).
 *
 * Usage:
 *   node aliyun-deploy/scripts/_prune-backups.mjs                # dry-run
 *   node aliyun-deploy/scripts/_prune-backups.mjs --apply        # actually delete
 *   node aliyun-deploy/scripts/_prune-backups.mjs --keep-days=30 --apply
 *
 * Idempotent — re-run is safe; only deletes once.
 */

import OSS from "ali-oss";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const args = Object.fromEntries(
  process.argv.slice(2)
    .map((a) => a.startsWith("--") ? a.slice(2).split("=") : null)
    .filter(Boolean)
    .map(([k, v]) => [k, v ?? "1"]),
);
const APPLY = args.apply === "1";
const KEEP_DAYS = parseInt(args["keep-days"] ?? "14", 10);
const KEEP_WEEKS = parseInt(args["keep-weeks"] ?? "12", 10);
const KEEP_MONTHS = parseInt(args["keep-months"] ?? "12", 10);

const oss = new OSS({
  endpoint: `https://${env.ALIYUN_OSS_REGION}.aliyuncs.com`,
  bucket: env.ALIYUN_OSS_BUCKET,
  accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID,
  accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET,
  secure: true,
});

// ─── Parse backupId → Date ──────────────────────────────────────────
// Format: 2026-05-17T091500Z or 2026-05-17T091500Z-pre-restore-of-...
const ID_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})Z(?:-pre-restore-of-.*)?$/;

function parseBackupId(id) {
  const m = ID_RE.exec(id);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
}

function isoWeek(date) {
  // ISO week: Mon-Sun
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const w = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(w).padStart(2, "0")}`;
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ─── List all _backups/* prefixes ───────────────────────────────────
async function listBackupIds() {
  const ids = new Set();
  let marker;
  do {
    const r = await oss.list({
      prefix: "_backups/",
      delimiter: "/",
      "max-keys": 1000,
      marker,
    });
    for (const p of r.prefixes ?? []) {
      // p = "_backups/2026-05-17T091500Z/"
      const id = p.slice("_backups/".length, -1);
      ids.add(id);
    }
    marker = r.nextMarker;
  } while (marker);
  return [...ids];
}

// ─── List ALL keys inside a backup prefix (for batch delete) ────────
async function listKeysInBackup(backupId) {
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

// ─── Decide keep vs prune per policy ────────────────────────────────
function decide(allIds, now = new Date()) {
  const cutoffDays = now.getTime() - KEEP_DAYS * 86400_000;
  // Sort newest first
  const parsed = allIds
    .map((id) => ({ id, date: parseBackupId(id) }))
    .filter((x) => x.date)
    .sort((a, b) => b.date - a.date);

  const keep = new Set();
  const reasons = {};

  // 1) keep last KEEP_DAYS (daily)
  for (const { id, date } of parsed) {
    if (date.getTime() >= cutoffDays) {
      keep.add(id);
      reasons[id] = "daily<" + KEEP_DAYS + "d";
    }
  }

  // 2) weekly: latest in each iso week, take KEEP_WEEKS newest weeks
  const weekly = new Map(); // week → newest id in that week
  for (const { id, date } of parsed) {
    const wk = isoWeek(date);
    if (!weekly.has(wk)) weekly.set(wk, id); // parsed is desc → first wins = newest in week
  }
  for (const [wk, id] of [...weekly].slice(0, KEEP_WEEKS)) {
    if (!keep.has(id)) {
      keep.add(id);
      reasons[id] = "weekly:" + wk;
    }
  }

  // 3) monthly
  const monthly = new Map();
  for (const { id, date } of parsed) {
    const mk = monthKey(date);
    if (!monthly.has(mk)) monthly.set(mk, id);
  }
  for (const [mk, id] of [...monthly].slice(0, KEEP_MONTHS)) {
    if (!keep.has(id)) {
      keep.add(id);
      reasons[id] = "monthly:" + mk;
    }
  }

  const toDelete = parsed.filter((x) => !keep.has(x.id)).map((x) => x.id);
  return { kept: parsed.filter((x) => keep.has(x.id)).map((x) => ({ id: x.id, reason: reasons[x.id] })), toDelete };
}

// ─── Main ───────────────────────────────────────────────────────────
(async () => {
  const allIds = await listBackupIds();
  console.log(`[prune] found ${allIds.length} snapshots in _backups/`);

  if (allIds.length === 0) {
    console.log("[prune] nothing to do.");
    return;
  }

  const { kept, toDelete } = decide(allIds);
  console.log(`\n[policy] keep ${KEEP_DAYS}d daily + ${KEEP_WEEKS}w weekly + ${KEEP_MONTHS}m monthly`);
  console.log(`[plan] keep ${kept.length}, delete ${toDelete.length}\n`);

  console.log("KEEP (newest first):");
  for (const { id, reason } of kept.slice(0, 20)) {
    console.log(`  ✓ ${id}  (${reason})`);
  }
  if (kept.length > 20) console.log(`  …${kept.length - 20} more`);

  console.log("\nDELETE:");
  for (const id of toDelete.slice(0, 20)) {
    console.log(`  ✗ ${id}`);
  }
  if (toDelete.length > 20) console.log(`  …${toDelete.length - 20} more`);

  if (!APPLY) {
    console.log("\n[dry-run] add --apply to actually delete. nothing was changed.");
    return;
  }
  if (toDelete.length === 0) {
    console.log("\n[apply] nothing to delete.");
    return;
  }

  // Collect all keys to remove, then DeleteMultipleObjects in batches of 1000
  console.log("\n[apply] collecting keys to delete…");
  const allKeys = [];
  for (const id of toDelete) {
    const keys = await listKeysInBackup(id);
    allKeys.push(...keys);
  }
  console.log(`[apply] total ${allKeys.length} keys`);

  let removed = 0;
  for (let i = 0; i < allKeys.length; i += 1000) {
    const batch = allKeys.slice(i, i + 1000);
    const r = await oss.deleteMulti(batch, { quiet: true });
    removed += r.res?.statusCode === 200 ? batch.length : 0;
    console.log(`[apply] batch ${Math.floor(i / 1000) + 1}: ${batch.length} keys → status ${r.res?.statusCode}`);
  }
  console.log(`\n[apply] done. removed ${removed}/${allKeys.length} keys across ${toDelete.length} snapshots.`);
})().catch((e) => {
  console.error("[fatal]", e.message, e.stack);
  process.exit(1);
});
