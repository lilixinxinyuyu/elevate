import OSS from "ali-oss";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync("/Users/yong/Desktop/xy/.dev.vars","utf-8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]})
);
const c = new OSS({endpoint:`https://${env.ALIYUN_OSS_REGION}.aliyuncs.com`,bucket:env.ALIYUN_OSS_BUCKET,accessKeyId:env.ALIYUN_OSS_ACCESS_KEY_ID,accessKeySecret:env.ALIYUN_OSS_ACCESS_KEY_SECRET,secure:true});
const h = await c.head("users/selena/snapshot.json");
console.log("Direct OSS HEAD:", h.status, "Content-Length:", h.res.headers["content-length"]);
