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

// PUT 一个测试文件，设置 ACL public-read
const r = await client.put("web/test-public.txt", Buffer.from("hello world"), {
  headers: {
    "x-oss-object-acl": "public-read",
    "Content-Type": "text/plain",
  },
});
console.log("Put:", r.res.status);

// 公网拉
const url = `https://xiaojinapp.oss-cn-hongkong.aliyuncs.com/web/test-public.txt`;
const resp = await fetch(url);
console.log("Public GET status:", resp.status);
console.log("Body:", await resp.text());
