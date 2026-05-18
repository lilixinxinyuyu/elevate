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

// Warmup: land Home + wait for seed + sync
console.log("Warming up (seed + sync)...");
await page.goto("https://selena.xiaojin.app/math", { waitUntil: "load", timeout: 90000 });
await new Promise((r) => setTimeout(r, 12000));

let canvasFound = 0, multistepFound = 0, plainFound = 0, mixed = [];
for (let i = 0; i < 20; i++) {
  await page.goto(`https://selena.xiaojin.app/math/train?fresh=${Date.now() + i * 17}`, { waitUntil: "load", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4500));
  const info = await page.evaluate(() => {
    const allText = document.body.innerText;
    const hasCanvas = !!document.querySelector("canvas");
    const stemEl = document.querySelector(".font-display.text-2xl, .text-2xl.font-display, [class*='font-display'][class*='text-2xl']");
    const stem = stemEl?.textContent?.slice(0, 60) ?? "(no stem)";
    return {
      hasCanvas,
      stem,
      panel: allText.includes("列算式区") ? "canvas_scratch"
        : allText.includes("应用题 4 步法") || allText.includes("第 1 步: 题里告诉") ? "multi_step"
        : allText.includes("草稿险") ? "plain+scratch"
        : "plain",
    };
  });
  if (info.panel === "canvas_scratch") canvasFound++;
  else if (info.panel === "multi_step") multistepFound++;
  else plainFound++;
  mixed.push(info.panel);
  console.log(`Q${i + 1}: panel=${info.panel} stem="${info.stem.slice(0,30)}"`);
}
console.log(`\n=== SUMMARY (20 fresh sessions) ===`);
console.log(`canvas_scratch: ${canvasFound} (${(canvasFound/20*100).toFixed(0)}%)`);
console.log(`multi_step:     ${multistepFound} (${(multistepFound/20*100).toFixed(0)}%)`);
console.log(`plain/other:    ${plainFound} (${(plainFound/20*100).toFixed(0)}%)`);
console.log(`Expected: canvas ~7%, multistep ~30%`);
await browser.close();
