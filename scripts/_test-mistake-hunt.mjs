import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync } from "node:fs";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const pwd = (readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8").match(/^APP_PASSWORD=(.+)$/m) ?? [])[1] ?? "";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 414, height: 896 }, args: ["--no-sandbox"] });
const page = await browser.newPage();

const errors = [];
page.on("pageerror", (err) => errors.push(`[PageError] ${err.message.slice(0, 120)}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`[Console] ${m.text().slice(0, 120)}`); });

await page.evaluateOnNewDocument((p) => localStorage.setItem("selena.cloud.pwd", p), pwd);
await page.goto("https://selena.xiaojin.app/math/find-mistakes", { waitUntil: "networkidle0", timeout: 60000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 4000));
const buf1 = await page.screenshot({ type: "png" });
writeFileSync("/Users/yong/Desktop/xy/heping-math-trainer/tests/e2e-screenshots/mistake-hunt-loaded.png", buf1);

// Check session is initialized with cards
const state = await page.evaluate(() => {
  const text = document.body.innerText;
  return {
    has5Questions: text.includes("(1/5)"),
    hasFindLine: text.includes("找出") || text.includes("第一处"),
    hasLines: document.querySelectorAll('button').length > 5,
    bodyLen: text.length,
    sample: text.slice(0, 300),
  };
});
console.log("MISTAKE HUNT load state:");
console.log(JSON.stringify(state, null, 2));

// Try click first line (probably correct first try is wrong, but flow should work)
const firstLineBtn = await page.evaluate(() => {
  // Find buttons inside the bug card (font-mono whitespace-pre)
  const candidates = [...document.querySelectorAll('div.font-mono button')];
  if (candidates.length === 0) return null;
  candidates[0].click();
  return { clicked: candidates[0].textContent?.slice(0, 30), total: candidates.length };
});
console.log("clicked first line:", firstLineBtn);
await new Promise((r) => setTimeout(r, 1500));

const buf2 = await page.screenshot({ type: "png" });
writeFileSync("/Users/yong/Desktop/xy/heping-math-trainer/tests/e2e-screenshots/mistake-hunt-after-click.png", buf2);

const after = await page.evaluate(() => {
  const text = document.body.innerText;
  return {
    bodyLen: text.length,
    hasResult: text.includes("XP") || text.includes("再看看") || text.includes("找到") || text.includes("正解"),
    sample: text.slice(0, 200),
  };
});
console.log("after click state:");
console.log(JSON.stringify(after, null, 2));

console.log("");
console.log("=== ERRORS ===");
console.log(errors.length === 0 ? "✓ none" : errors.join("\n"));
await browser.close();
