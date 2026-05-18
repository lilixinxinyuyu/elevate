/**
 * Quick check: 在 Selena Home 上找新加的 6 个 entries 在 DOM 里到底有没有.
 */
import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
function getPwd() {
  return (readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8").match(/^APP_PASSWORD=(.+)$/m) ?? [])[1] ?? "";
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 414, height: 896 },
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.evaluateOnNewDocument((p) => localStorage.setItem("selena.cloud.pwd", p), getPwd());

await page.goto("https://selena.xiaojin.app/", { waitUntil: "networkidle0", timeout: 60000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 6000)); // 等 6s 让 SubjectShell / HomePage 加载

// 关 modals
for (let i = 0; i < 5; i++) {
  const closed = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    for (const b of btns) {
      const t = (b.textContent ?? "").trim();
      if (/^(稍后再填|跳过|知道啦|知道了|✕|开始练习|算了)$/.test(t)) { b.click(); return true; }
    }
    return false;
  });
  if (!closed) break;
  await new Promise((r) => setTimeout(r, 300));
}

await new Promise((r) => setTimeout(r, 2000));

// Take full page screenshot (scroll capture)
const buf = await page.screenshot({ type: "png", fullPage: true });
writeFileSync("/Users/yong/Desktop/xy/heping-math-trainer/tests/e2e-screenshots/home-fullpage.png", buf);
console.log(`Full page screenshot: ${(buf.length / 1024).toFixed(1)} KB`);

// Check body innerText, count keyword occurrences
const data = await page.evaluate(() => {
  const text = document.body.innerText;
  const allLinks = [...document.querySelectorAll("a[href]")].map((a) => ({
    href: a.getAttribute("href"),
    text: (a.textContent ?? "").trim().slice(0, 50),
  }));
  return {
    bodyTextLength: text.length,
    bodyTextSample: text.slice(0, 500),
    keywords: {
      "错题侦探": text.includes("错题侦探"),
      "进制小课堂": text.includes("进制小课堂"),
      "脑力雷达": text.includes("脑力雷达"),
      "稳准挑战": text.includes("稳准挑战"),
      "巧算工具箱": text.includes("巧算工具箱"),
      "考试模拟": text.includes("考试模拟"),
      "find-mistakes": text.includes("find-mistakes"),
    },
    allLinks: allLinks.slice(0, 50),
    docTitle: document.title,
    url: window.location.href,
  };
});

console.log(JSON.stringify(data, null, 2));
await browser.close();
