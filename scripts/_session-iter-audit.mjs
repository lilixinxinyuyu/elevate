import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
async function getCadetPwd(userId) {
  const env = Object.fromEntries(readFileSync("/Users/yong/Desktop/xy/.dev.vars","utf-8").split("\n").filter((l)=>l.includes("=")&&!l.startsWith("#")).map((l)=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()];}));
  const code = `import OSS from 'ali-oss';const oss=new OSS({endpoint:'https://${env.ALIYUN_OSS_REGION}.aliyuncs.com',bucket:'${env.ALIYUN_OSS_BUCKET}',accessKeyId:'${env.ALIYUN_OSS_ACCESS_KEY_ID}',accessKeySecret:'${env.ALIYUN_OSS_ACCESS_KEY_SECRET}',secure:true});const a=await oss.get('_auth/users.json');const j=JSON.parse(a.content.toString('utf-8'));process.stdout.write(Object.entries(j.passwords||{}).find(([_,u])=>u==='${userId}')?.[0]||'');`;
  return execSync(`cd /Users/yong/Desktop/xy/heping-math-trainer/aliyun-deploy && node -e "${code.replace(/"/g,'\\"')}" --input-type=module`,{encoding:"utf-8"}).trim();
}
const pwd = await getCadetPwd("selena");
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 414, height: 896 }, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument((p) => { localStorage.setItem("selena.cloud.pwd", p); localStorage.setItem("xiaojinapp.cloud.pwd", p); }, pwd);

const checks = [
  { name: "iter 10 期末备考 dashboard", url: "/math/exam-prep", expectStrs: ["期末备考中心"] },
  { name: "iter 13 Home iOS Arcade 3 tab", url: "/math", expectStrs: ["游戏厅", "个人"] },
  { name: "iter 15 Selena 端 paper mistakes", url: "/math/paper-mistakes", expectStrs: ["📄 试卷错题"] },
  { name: "iter 16 错题侦探", url: "/math/find-mistakes", expectStrs: ["错题侦探"] },
  { name: "iter 22 OCR 按钮 (admin)", url: "/math/paper-entry", expectStrs: ["拍照识别错题"], host: "https://admin.xiaojin.app" },
  { name: "iter 23 FC stats panel (admin)", url: "/super-admin", expectStrs: ["FC 调用监控"], host: "https://admin.xiaojin.app" },
];

await page.goto("https://selena.xiaojin.app/math", { waitUntil: "load", timeout: 90000 });
await new Promise((r) => setTimeout(r, 15000));

for (const c of checks) {
  const host = c.host ?? "https://selena.xiaojin.app";
  await page.goto(`${host}${c.url}`, { waitUntil: "load", timeout: 60000 });
  let found = false; let lastResult = [];
  for (let waited = 0; waited < 15000; waited += 1500) {
    await new Promise((r) => setTimeout(r, 1500));
    lastResult = await page.evaluate((strs) => {
      const t = document.body.innerText;
      return strs.map((s) => ({ str: s, present: t.includes(s) }));
    }, c.expectStrs);
    if (lastResult.every((r) => r.present)) { found = true; break; }
  }
  const missing = lastResult.filter((r) => !r.present);
  console.log(`${found ? "✅" : "❌"} ${c.name}`);
  if (missing.length > 0) {
    for (const m of missing) console.log(`    MISSING: "${m.str}"`);
  }
}

await browser.close();
