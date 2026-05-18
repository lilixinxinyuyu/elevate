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
await page.evaluateOnNewDocument((p) => { localStorage.setItem("selena.cloud.pwd", p); localStorage.setItem("xiaojinapp.cloud.pwd", p); }, pwd);
// Warmup
await page.goto("https://selena.xiaojin.app/math", { waitUntil: "load", timeout: 90000 });
await new Promise((r) => setTimeout(r, 14000));

let multistepHit = false, hasKeypad = false, hasAddBtn = false;
for (let i = 0; i < 25 && !multistepHit; i++) {
  await page.goto(`https://selena.xiaojin.app/math/train?fresh=${Date.now() + i * 13}`, { waitUntil: "load", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 5000));
  const info = await page.evaluate(() => {
    const t = document.body.innerText;
    const isMultiStep = t.includes("应用题 4 步法") || t.includes("第 1 步: 题里告诉");
    if (!isMultiStep) return { multistep: false };
    // 在 Phase 1, check 是否有 "+ 加入" button
    const addBtn = Array.from(document.querySelectorAll("button")).some((b) => /\+\s*加入/.test(b.textContent ?? ""));
    return { multistep: true, addBtn };
  });
  if (info.multistep) {
    multistepHit = true;
    hasAddBtn = info.addBtn;
    console.log(`Q${i+1}: multistep HIT, "+ 加入" btn: ${info.addBtn ? "✅" : "❌"}`);
    // Try advance to Phase 3 to verify keypad
    await page.evaluate(() => {
      // Click first 2 stem-number chips to add 2 known
      const chips = Array.from(document.querySelectorAll("button")).filter((b) => /^\+\d/.test((b.textContent ?? "").trim()));
      chips.slice(0, 2).forEach((c) => (c).click());
    });
    await new Promise((r) => setTimeout(r, 500));
    // Click 下一步
    await page.evaluate(() => {
      const next = Array.from(document.querySelectorAll("button")).find((b) => /下一步/.test(b.textContent ?? ""));
      (next)?.click();
    });
    await new Promise((r) => setTimeout(r, 1000));
    // Phase 2 — click 下一步 with manual input
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input"));
      const manual = inputs.find((i) => (i).placeholder?.includes("还剩"));
      if (manual) { (manual).focus(); (manual).value = "test 求什么"; manual.dispatchEvent(new Event("input", { bubbles: true })); }
    });
    await new Promise((r) => setTimeout(r, 500));
    await page.evaluate(() => {
      const next = Array.from(document.querySelectorAll("button")).find((b) => /下一步/.test(b.textContent ?? ""));
      (next)?.click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    // Phase 3 — check 数字 keypad
    const keypadCheck = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button")).map((b) => (b.textContent ?? "").trim());
      const hasNum = ["0","1","7","9"].every((n) => buttons.includes(n));
      const hasOps = ["+","×","÷","="].every((op) => buttons.includes(op));
      const hasBackspace = buttons.includes("⌫");
      return { hasNum, hasOps, hasBackspace, sampleBtns: buttons.filter((t) => t.length <= 3).slice(0, 25) };
    });
    hasKeypad = keypadCheck.hasNum && keypadCheck.hasOps && keypadCheck.hasBackspace;
    console.log(`  Phase 3 keypad: nums=${keypadCheck.hasNum} ops=${keypadCheck.hasOps} backspace=${keypadCheck.hasBackspace} ${hasKeypad ? "✅" : "❌"}`);
    await page.screenshot({ path: "/tmp/v028-phase3.png", fullPage: false });
    break;
  }
}
console.log(`\nSummary: multistepFound=${multistepHit} addBtn=${hasAddBtn} keypad=${hasKeypad}`);
await browser.close();
