import OSS from "ali-oss";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync("/Users/yong/Desktop/xy/.dev.vars","utf-8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]})
);
const c = new OSS({endpoint:`https://${env.ALIYUN_OSS_REGION}.aliyuncs.com`,bucket:env.ALIYUN_OSS_BUCKET,accessKeyId:env.ALIYUN_OSS_ACCESS_KEY_ID,accessKeySecret:env.ALIYUN_OSS_ACCESS_KEY_SECRET,secure:true});
const snap = await c.get("users/selena/snapshot.json");
const bytes = snap.content.length;
const stats = { snapshotBytes: bytes, fetchedAt: Date.now(), note: "seeded by _seed-selena-stats.mjs after restore" };
await c.put("users/selena/stats.json", Buffer.from(JSON.stringify(stats)), {headers:{"Content-Type":"application/json; charset=utf-8"}});
console.log("Seeded selena stats.json with snapshotBytes =", bytes);
