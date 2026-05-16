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

const policy = {
  Version: "1",
  Statement: [
    {
      Effect: "Allow",
      Action: ["oss:GetObject"],
      Principal: ["*"],
      Resource: [`acs:oss:*:*:${env.ALIYUN_OSS_BUCKET}/web/*`],
    },
  ],
};

const r = await client.putBucketPolicy(env.ALIYUN_OSS_BUCKET, policy);
console.log("PutBucketPolicy:", r.res.status, r.res.statusMessage);

// 验证
const got = await client.getBucketPolicy(env.ALIYUN_OSS_BUCKET);
console.log("\nCurrent bucket policy:");
console.log(JSON.stringify(got.policy, null, 2));
