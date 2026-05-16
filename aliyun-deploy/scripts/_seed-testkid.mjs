import OSS from "ali-oss";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync("/Users/yong/Desktop/xy/.dev.vars","utf-8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]})
);
const c = new OSS({endpoint:`https://${env.ALIYUN_OSS_REGION}.aliyuncs.com`,bucket:env.ALIYUN_OSS_BUCKET,accessKeyId:env.ALIYUN_OSS_ACCESS_KEY_ID,accessKeySecret:env.ALIYUN_OSS_ACCESS_KEY_SECRET,secure:true});
// Put a 200KB test payload for testkid
const blob = "x".repeat(200000);
const fake = JSON.stringify({data:{attempts:Array.from({length:1000},(_,i)=>({id:`a${i}`,createdAt:1000+i,isCorrect:true,subject:"math",skillId:"add"})),padding:blob}});
console.log("Fake snapshot size:", fake.length);
await c.put("users/testkid/snapshot.json", Buffer.from(fake), {headers:{"Content-Type":"application/json; charset=utf-8"}});
console.log("Put testkid fake snapshot (200KB+)");
