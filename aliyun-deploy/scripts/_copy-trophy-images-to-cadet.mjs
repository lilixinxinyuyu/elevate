/**
 * Stopgap (v0.34.82 iter 16a): 复制 selena 的 204 张 trophy-images 到指定
 * 新同学的 OSS 路径, 让新同学进 app 立即看到徽章图 (不用等 AI 重新生成).
 *
 * 爸爸反馈: "切换到 alibaba oss 后所有的图片徽章从来都没有载入...
 * 我这里怎么拉服务器的数据都没有, 始终没有徽章图"
 *
 * 根因: bruce 同学 OSS users/bruce/trophy-images/ count=0 (从未生成过),
 * selena users/selena/trophy-images/ count=204. 新同学没自动拷.
 *
 * Run: cd aliyun-deploy && node scripts/_copy-trophy-images-to-cadet.mjs <userId>
 * 例: node scripts/_copy-trophy-images-to-cadet.mjs bruce
 *
 * 之后跑一遍 demo 同学就有 selena 同款 ~200 张 trophy images,
 * 演示时家长老师都能看到完整勋章柜.
 */
import OSS from "ali-oss";
import { readFileSync } from "node:fs";

const TARGET = process.argv[2];
if (!TARGET || !/^[a-zA-Z0-9_-]{1,64}$/.test(TARGET)) {
  console.error("usage: node scripts/_copy-trophy-images-to-cadet.mjs <userId>");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const oss = new OSS({
  endpoint: `https://${env.ALIYUN_OSS_REGION}.aliyuncs.com`,
  bucket: env.ALIYUN_OSS_BUCKET,
  accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID,
  accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET,
  secure: true,
});

const SRC_PREFIX = "users/selena/trophy-images/";
const DST_PREFIX = `users/${TARGET}/trophy-images/`;

console.log(`Listing ${SRC_PREFIX} ...`);
let allKeys = [];
let marker = null;
while (true) {
  const r = await oss.list({ prefix: SRC_PREFIX, "max-keys": 1000, marker });
  allKeys = allKeys.concat((r.objects ?? []).map((o) => o.name));
  if (!r.nextMarker) break;
  marker = r.nextMarker;
}
console.log(`  found ${allKeys.length} trophy images on selena`);

// 检查 target 已有的, 不重覆
console.log(`Checking ${DST_PREFIX} (existing) ...`);
const existingNames = new Set();
let mk = null;
while (true) {
  const r = await oss.list({ prefix: DST_PREFIX, "max-keys": 1000, marker: mk });
  for (const o of r.objects ?? []) existingNames.add(o.name.slice(DST_PREFIX.length));
  if (!r.nextMarker) break;
  mk = r.nextMarker;
}
console.log(`  target ${TARGET} already has ${existingNames.size}`);

let copied = 0, skipped = 0, failed = 0;
const t0 = Date.now();
const PARALLEL = 8;
const tasks = [];
let inflight = 0;
let idx = 0;

async function runOne(srcKey) {
  const filename = srcKey.slice(SRC_PREFIX.length);
  const dstKey = DST_PREFIX + filename;
  if (existingNames.has(filename)) { skipped++; return; }
  try {
    await oss.copy(dstKey, srcKey);
    copied++;
    if (copied % 20 === 0) console.log(`  ... ${copied}/${allKeys.length}`);
  } catch (e) {
    failed++;
    console.warn(`  ✗ ${filename}: ${e.message?.slice(0, 60)}`);
  }
}

await new Promise((resolve) => {
  function pump() {
    while (inflight < PARALLEL && idx < allKeys.length) {
      const i = idx++;
      inflight++;
      runOne(allKeys[i]).finally(() => {
        inflight--;
        if (idx >= allKeys.length && inflight === 0) resolve();
        else pump();
      });
    }
  }
  pump();
});

console.log(`\n=== done in ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);
console.log(`  copied: ${copied}`);
console.log(`  skipped (already existed): ${skipped}`);
console.log(`  failed: ${failed}`);
console.log(`\n${TARGET} 同学现在有 ${copied + skipped + existingNames.size} 张 trophy-images.`);
console.log(`下次登录 https://${TARGET}.xiaojin.app 应该看到勋章柜满图.`);
