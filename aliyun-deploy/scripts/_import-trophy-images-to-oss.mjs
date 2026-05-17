/**
 * One-shot: 把 backup 里的 trophyImages 数组 (205 entries) 推到 OSS。
 *
 * Ep39 实测: 整 bundle 17MB 走 GET endpoint 触发 ESA 599 (worker memory).
 * 改 **per-image OSS key** 架构: users/{userId}/trophy-images/{trophyId}.json
 * 每图 ~80KB, GET 单图 ESA 安全, manifest list 走 OSS list-v2 也小.
 *
 * 数据形状: backup.trophyImages = Array<{trophyId, subjectId, imageDataUrl, generatedAt}>
 *   - 2 个非图片 entry (data:application/json - AI 题目 hack 存的) — 跳过, 不入 OSS
 *   - 189 jpeg + 14 png = 203 真图 写入 per-key
 *
 * 走 ali-oss SDK 直接 PUT (绕过 ESA upload 限制, Node SDK 无大小限).
 *
 * Run: cd aliyun-deploy && node scripts/_import-trophy-images-to-oss.mjs [--apply]
 */
import OSS from "ali-oss";
import { readFileSync } from "node:fs";

const BACKUP_FILE = "/Users/yong/Desktop/xy/backup/heping-backup-FULL-2026-05-16.json";
const USER_ID = "selena";
const KEY_PREFIX = `users/${USER_ID}/trophy-images/`;
const LEGACY_BUNDLE_KEY = `users/${USER_ID}/trophy-images.json`;

const env = Object.fromEntries(
  readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const APPLY = process.argv.includes("--apply");

const oss = new OSS({
  endpoint: `https://${env.ALIYUN_OSS_REGION}.aliyuncs.com`,
  bucket: env.ALIYUN_OSS_BUCKET,
  accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID,
  accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET,
  secure: true,
});

console.log(`reading backup: ${BACKUP_FILE}`);
const j = JSON.parse(readFileSync(BACKUP_FILE, "utf-8"));
const ti = Array.isArray(j.trophyImages) ? j.trophyImages : [];
console.log(`  trophyImages entries: ${ti.length}`);

// breakdown by mime
const byMime = {};
for (const e of ti) {
  const m = (e.imageDataUrl ?? "").match(/^data:([^;]+);/)?.[1] ?? "(none)";
  byMime[m] = (byMime[m] ?? 0) + 1;
}
console.log(`  by mime:`, byMime);

const bodyText = JSON.stringify(ti);
console.log(`  payload: ${(bodyText.length / 1024 / 1024).toFixed(2)} MB`);

// Filter: skip non-image entries (data:application/json hack)
const realImages = ti.filter((e) => {
  const m = (e.imageDataUrl ?? "").match(/^data:image\//);
  return m && e.trophyId && /^[A-Za-z0-9_-]{1,128}$/.test(e.trophyId);
});
console.log(`  real images (skipped non-image hacks): ${realImages.length} / ${ti.length}`);

(async () => {
  // Check existing keys under prefix
  console.log(`\n--- existing keys under ${KEY_PREFIX} ---`);
  const existing = await oss.list({ prefix: KEY_PREFIX, "max-keys": 1000 });
  console.log(`  ${(existing.objects ?? []).length} keys already there`);

  if (!APPLY) {
    console.log("\n[dry-run] add --apply to actually upload. Plan:");
    console.log(`  - upload ${realImages.length} per-key files`);
    console.log(`  - delete legacy bundle ${LEGACY_BUNDLE_KEY} (if exists)`);
    return;
  }

  console.log(`\n--- uploading ${realImages.length} per-key files ---`);
  let ok = 0, fail = 0;
  for (let i = 0; i < realImages.length; i++) {
    const e = realImages[i];
    const key = `${KEY_PREFIX}${e.trophyId}.json`;
    const body = JSON.stringify({
      trophyId: e.trophyId,
      subjectId: e.subjectId,
      imageDataUrl: e.imageDataUrl,
      generatedAt: e.generatedAt,
    });
    try {
      await oss.put(key, Buffer.from(body), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
      ok++;
      if ((i + 1) % 30 === 0) console.log(`  uploaded ${i + 1}/${realImages.length}`);
    } catch (err) {
      console.error(`  ✗ ${key}: ${err.message}`);
      fail++;
    }
  }
  console.log(`  done. ok=${ok} fail=${fail}`);

  // Clean up legacy 17MB bundle (the Ep39 first-try upload)
  try {
    await oss.delete(LEGACY_BUNDLE_KEY);
    console.log(`  ✓ deleted legacy bundle ${LEGACY_BUNDLE_KEY}`);
  } catch (err) {
    if (err.code !== "NoSuchKey") console.warn(`  (legacy delete: ${err.message})`);
  }
})().catch((e) => {
  console.error("fatal:", e.message, e.stack);
  process.exit(1);
});
