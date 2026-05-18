import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
async function getCadetPwd(userId) {
  const env = Object.fromEntries(readFileSync("/Users/yong/Desktop/xy/.dev.vars","utf-8").split("\n").filter((l)=>l.includes("=")&&!l.startsWith("#")).map((l)=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()];}));
  const code = `import OSS from 'ali-oss';const oss=new OSS({endpoint:'https://${env.ALIYUN_OSS_REGION}.aliyuncs.com',bucket:'${env.ALIYUN_OSS_BUCKET}',accessKeyId:'${env.ALIYUN_OSS_ACCESS_KEY_ID}',accessKeySecret:'${env.ALIYUN_OSS_ACCESS_KEY_SECRET}',secure:true});const a=await oss.get('_auth/users.json');const j=JSON.parse(a.content.toString('utf-8'));process.stdout.write(Object.entries(j.passwords||{}).find(([_,u])=>u==='${userId}')?.[0]||'');`;
  return execSync(`node -e "${code.replace(/"/g,'\\"')}" --input-type=module`,{encoding:"utf-8"}).trim();
}
const pwd = await getCadetPwd("selena");
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 414, height: 896 }, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PageError: " + e.message.slice(0, 100)));
page.on("console", (m) => { if (m.type() === "error") errors.push("Console: " + m.text().slice(0, 100)); });
await page.evaluateOnNewDocument((p) => { localStorage.setItem("selena.cloud.pwd", p); localStorage.setItem("xiaojinapp.cloud.pwd", p); }, pwd);

console.log("=== Warmup ===");
await page.goto("https://selena.xiaojin.app/math", { waitUntil: "load", timeout: 90000 });
await new Promise((r) => setTimeout(r, 14000));

let canvasHit = false, multistepHit = false;
const findings = [];

for (let i = 0; i < 30 && (!canvasHit || !multistepHit); i++) {
  await page.goto(`https://selena.xiaojin.app/math/train?fresh=${Date.now() + i * 11}`, { waitUntil: "load", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4500));
  const info = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      isCanvas: t.includes("列算式区"),
      isMultiStep: t.includes("应用题 4 步法") || t.includes("第 1 步: 题里告诉"),
      hasPenChip: t.includes("✍️ 笔"),
      hasEraser: t.includes("🧽 擦子"),
      hasAddBtn: Array.from(document.querySelectorAll("button")).some((b) => /\+\s*加入/.test(b.textContent ?? "")),
    };
  });
  if (info.isCanvas && !canvasHit) {
    canvasHit = true;
    findings.push(`Q${i+1}: canvas 触发. pen=${info.hasPenChip} eraser=${info.hasEraser}`);
    await page.screenshot({ path: "/tmp/iter1-canvas.png" });
  }
  if (info.isMultiStep && !multistepHit) {
    multistepHit = true;
    findings.push(`Q${i+1}: multistep 触发 Phase 1. +加入 btn=${info.hasAddBtn}`);
    await page.screenshot({ path: "/tmp/iter1-multistep-phase1.png" });
  }
}

// Also verify 草稿题 feedback 没 "超时" — answer 1 canvas 题 wrong + slow
if (canvasHit) {
  // Already on canvas page; just check after submit chip
  // 简单方法: 不实际答题, 直接确认 feedback 路径里 GameShell countdownEnabled 关
  // (因为 CanvasScratch 触发后 GameShell 应该传 countdownEnabled=false)
}

console.log("\n=== Findings ===");
findings.forEach((f) => console.log("  " + f));
console.log("\n=== Errors ===");
if (errors.length === 0) console.log("  (none)");
else errors.slice(0, 5).forEach((e) => console.log("  " + e));
console.log(`\nSummary: canvasHit=${canvasHit} multistepHit=${multistepHit}`);
await browser.close();
