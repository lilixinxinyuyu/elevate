import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync } from "node:fs";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const pwd = (readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8").match(/^APP_PASSWORD=(.+)$/m) ?? [])[1] ?? "";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 414, height: 1200 }, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument((p) => localStorage.setItem("selena.cloud.pwd", p), pwd);
await page.goto("https://selena.xiaojin.app/math", { waitUntil: "networkidle0", timeout: 60000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 6000));
for (let i = 0; i < 5; i++) {
  const closed = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    for (const b of btns) {
      const t = (b.textContent ?? "").trim();
      if (/^(稍后再填|跳过|知道啦|知道了|✕|开始练习)$/.test(t)) { b.click(); return true; }
    }
    return false;
  });
  if (!closed) break;
  await new Promise((r) => setTimeout(r, 300));
}
await new Promise((r) => setTimeout(r, 2000));
// Scroll to the entry section
const entryY = await page.evaluate(() => {
  const link = document.querySelector('a[href="/math/find-mistakes"]');
  if (link) {
    link.scrollIntoView({ block: "center" });
    return link.getBoundingClientRect().top + window.scrollY;
  }
  return null;
});
console.log("entry Y:", entryY);
await new Promise((r) => setTimeout(r, 800));
const buf = await page.screenshot({ type: "png" });
writeFileSync("/Users/yong/Desktop/xy/heping-math-trainer/tests/e2e-screenshots/math-home-entries-zoom.png", buf);
console.log(`zoom screenshot: ${(buf.length / 1024).toFixed(1)} KB`);
await browser.close();
