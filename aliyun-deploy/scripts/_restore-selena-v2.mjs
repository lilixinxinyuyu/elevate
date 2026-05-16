import OSS from "ali-oss";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8")
    .split("\n").filter(l => l.includes("=")).map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const client = new OSS({
  endpoint: `https://${env.ALIYUN_OSS_REGION}.aliyuncs.com`,
  bucket: env.ALIYUN_OSS_BUCKET,
  accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID,
  accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET,
  secure: true,
});

const SELENA_KEY = "users/selena/snapshot.json";
const versions = await client.getBucketVersions({ prefix: SELENA_KEY, "max-keys": 20 });
const objs = versions.objects ?? [];
const goodVersion = objs.find((v) => !v.isLatest && v.size > 100000);
if (!goodVersion) {
  console.error("No good version found! All non-latest are too small.");
  process.exit(1);
}
console.log(`Will restore version from ${goodVersion.lastModified} (${goodVersion.size} bytes)`);
const res = await client.get(SELENA_KEY, { versionId: goodVersion.versionId });
const bodyBuf = res.content;
console.log(`Fetched ${bodyBuf.length} bytes`);
const parsed = JSON.parse(bodyBuf.toString("utf-8"));
const tables = parsed.data ?? parsed;
const summary = {};
for (const [k, v] of Object.entries(tables)) if (Array.isArray(v)) summary[k] = v.length;
console.log("Tables:", summary);
const putR = await client.put(SELENA_KEY, bodyBuf, {
  headers: { "Content-Type": "application/json; charset=utf-8" },
});
console.log(`Restored! Status=${putR.res.status}, size=${bodyBuf.length}`);
