import OSS from "ali-oss";
import { readFileSync, writeFileSync } from "node:fs";
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
// List object versions for selena snapshot
try {
  const versions = await client.getBucketVersions({
    prefix: "users/selena/snapshot.json",
    "max-keys": 10,
  });
  console.log("Versions:", JSON.stringify(versions.objects || versions, null, 2).slice(0, 2000));
} catch (e) {
  console.log("getBucketVersions error:", e.message, e.code);
  console.log("Bucket might not have versioning enabled");
  // Try listing without versions
  try {
    const info = await client.getBucketInfo(env.ALIYUN_OSS_BUCKET);
    console.log("\nBucket versioning status:", info.bucket?.Versioning ?? "unknown");
  } catch (e2) {
    console.log("getBucketInfo error:", e2.message);
  }
}
