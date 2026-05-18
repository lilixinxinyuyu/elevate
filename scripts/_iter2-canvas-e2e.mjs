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
page.on("pageerror", (e) => errors.push("PageError: " + e.message.slice(0, 150)));
page.on("console", (m) => { if (m.type() === "error") errors.push("Console: " + m.text().slice(0, 150)); });
await page.evaluateOnNewDocument((p) => { localStorage.setItem("selena.cloud.pwd", p); localStorage.setItem("xiaojinapp.cloud.pwd", p); }, pwd);

await page.goto("https://selena.xiaojin.app/math", { waitUntil: "load", timeout: 90000 });
await new Promise((r) => setTimeout(r, 14000));

// 找 canvas 题
let canvasPageReached = false;
for (let i = 0; i < 50 && !canvasPageReached; i++) {
  await page.goto(`https://selena.xiaojin.app/math/train?fresh=${Date.now() + i * 7}`, { waitUntil: "load", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4500));
  const onCanvas = await page.evaluate(() => document.body.innerText.includes("列算式区"));
  if (onCanvas) { canvasPageReached = true; console.log(`Q${i+1}: canvas 触发 ✅`); break; }
}
if (!canvasPageReached) { console.log("没找到 canvas 题, abort"); await browser.close(); process.exit(1); }

// 在 canvas 上画几笔 (模拟列算式)
await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  // 模拟 3 笔: pointerdown → 几个 move → up
  function dispatch(type, x, y) {
    canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: "mouse", button: 0, buttons: 1,
      isPrimary: true, clientX: rect.left + x, clientY: rect.top + y, bubbles: true,
    }));
  }
  // 第 1 笔: "1"
  dispatch("pointerdown", 50, 50);
  for (let i = 0; i < 8; i++) dispatch("pointermove", 50 + i*2, 50 + i*4);
  dispatch("pointerup", 50 + 16, 50 + 32);
  // 第 2 笔: "+"
  dispatch("pointerdown", 100, 50);
  for (let i = 0; i < 8; i++) dispatch("pointermove", 100 + i*3, 50);
  dispatch("pointerup", 100 + 24, 50);
  // 第 3 笔: "2"
  dispatch("pointerdown", 150, 50);
  for (let i = 0; i < 8; i++) dispatch("pointermove", 150 + i*2, 50 + i*4);
  dispatch("pointerup", 150 + 16, 50 + 32);
});
await new Promise((r) => setTimeout(r, 1500));

// 输入答案 + 点确定
const strokesCount = await page.evaluate(() => {
  const t = document.body.innerText;
  const m = t.match(/(\d+)\s*笔/);
  return m ? parseInt(m[1], 10) : 0;
});
console.log(`画了 ${strokesCount} 笔 (期望 >= 1)`);

// 找数字输入 input → 输个错答 (随便填), 点确定
const filled = await page.evaluate(() => {
  const input = document.querySelector("input[inputmode='decimal']");
  if (!input) return false;
  input.focus();
  // React controlled input 需要 dispatch input event
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  nativeSetter.call(input, "999");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
});
console.log(`填了答案 input: ${filled ? "✅" : "❌"}`);

await new Promise((r) => setTimeout(r, 500));
// 点 "确定" button
const submitted = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === "确定");
  if (!btn || (btn).disabled) return false;
  (btn).click();
  return true;
});
console.log(`点 "确定": ${submitted ? "✅" : "❌"}`);

// 等 vision judge 返回 (最多 90s)
await new Promise((r) => setTimeout(r, 3000));
let visionStatus = "not-started";
for (let i = 0; i < 30; i++) {  // 90s
  const status = await page.evaluate(() => {
    const t = document.body.innerText;
    if (t.includes("🤖 小进在看你的列式")) return "loading";
    if (t.includes("✅ 列式没问题") || t.includes("⚠️ 列式有可改进")) return "ok";
    if (t.includes("🤖 检查失败")) return "error";
    return null;
  });
  if (status) { visionStatus = status; if (status !== "loading") break; }
  await new Promise((r) => setTimeout(r, 3000));
}
console.log(`Vision judge 最终: ${visionStatus}`);

// 检查 feedback 没"超时"
const feedbackText = await page.evaluate(() => document.body.innerText);
const hasOverdue = feedbackText.includes("⏰ 超时") || feedbackText.includes("🐢 拖拉");
console.log(`Feedback 有"超时/拖拉" label: ${hasOverdue ? "❌ 仍显示" : "✅ 已隐藏"}`);

// 检查没弹"草稿/心算" dialog
const hasScratchDialog = feedbackText.includes("写草稿") && feedbackText.includes("心算挑战");
console.log(`弹 ScratchInsurance dialog: ${hasScratchDialog ? "❌ 仍弹" : "✅ 已抑制"}`);

await page.screenshot({ path: "/tmp/iter2-canvas-feedback.png", fullPage: true });

console.log("\n=== Errors ===");
if (errors.length === 0) console.log("  (none)");
else errors.slice(0, 6).forEach((e) => console.log("  " + e));

await browser.close();
