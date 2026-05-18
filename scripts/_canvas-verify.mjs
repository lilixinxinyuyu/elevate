import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function getCadetPwd(userId) {
  const env = Object.fromEntries(
    readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8")
      .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  const code = `
import OSS from 'ali-oss';
const oss = new OSS({endpoint:'https://${env.ALIYUN_OSS_REGION}.aliyuncs.com',bucket:'${env.ALIYUN_OSS_BUCKET}',accessKeyId:'${env.ALIYUN_OSS_ACCESS_KEY_ID}',accessKeySecret:'${env.ALIYUN_OSS_ACCESS_KEY_SECRET}',secure:true});
const a = await oss.get('_auth/users.json');
const j = JSON.parse(a.content.toString('utf-8'));
process.stdout.write(Object.entries(j.passwords||{}).find(([_,u])=>u==='${userId}')?.[0] || '');
`.trim();
  return execSync(`cd /Users/yong/Desktop/xy/heping-math-trainer/aliyun-deploy && node -e "${code.replace(/"/g, '\\"')}" --input-type=module`, { encoding: "utf-8" }).trim();
}

const pwd = await getCadetPwd("selena");
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 414, height: 896 },
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
page.on("console", (msg) => msg.type() === "error" && console.log("ERR:", msg.text().slice(0, 150)));
await page.evaluateOnNewDocument((p) => {
  localStorage.setItem("selena.cloud.pwd", p);
  localStorage.setItem("xiaojinapp.cloud.pwd", p);
}, pwd);

// 跑 fresh + check 是否有 canvas_scratch 题
let canvasFound = false;
let templates = [];

for (let i = 0; i < 12; i++) {
  await page.goto(`https://selena.xiaojin.app/math/train?fresh=${Date.now() + i}`, { waitUntil: "load", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 5000));
  // 看 DOM 有没有 canvas, 题面信息
  const info = await page.evaluate(() => {
    const hasCanvas = !!document.querySelector("canvas");
    const canvasW = document.querySelector("canvas")?.width;
    const hasInput = !!document.querySelector("input[inputmode='decimal'], input[type='number']");
    const hasTextarea = !!document.querySelector("textarea");
    const stem = document.body.innerText.match(/第\s*1\s*\/\s*\d+/)?.[0] ?? "";
    const allText = document.body.innerText;
    // 找 panel 特征
    const hasScratchHint = allText.includes("写草稿") || allText.includes("草稿险");
    const hasMultiStepHint = allText.includes("已知") && allText.includes("求");
    const hasCanvasHint = allText.includes("列算式区") || allText.includes("白板");
    return { hasCanvas, canvasW, hasInput, hasTextarea, stem, hasScratchHint, hasMultiStepHint, hasCanvasHint };
  });
  templates.push(info);
  if (info.hasCanvas && info.hasCanvasHint) {
    canvasFound = true;
    console.log(`Question ${i + 1}: ✅ CANVAS FOUND. canvasW=${info.canvasW}`);
    await page.screenshot({ path: `/tmp/canvas-found-${i}.png` });
    break;
  } else {
    console.log(`Q${i + 1}: input=${info.hasInput} canvas=${info.hasCanvas} canvasHint=${info.hasCanvasHint} scratchHint=${info.hasScratchHint} multistep=${info.hasMultiStepHint}`);
  }
}
console.log(`\nResult: canvasFound=${canvasFound} (tried 12 fresh sessions)`);
await browser.close();
