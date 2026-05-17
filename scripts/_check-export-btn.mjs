import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PWD = readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8").match(/^APP_PASSWORD=(.+)$/m)[1];
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  defaultViewport: { width: 1280, height: 900 },
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.goto("https://admin.xiaojin.app/super-admin", { waitUntil: "domcontentloaded", timeout: 60_000 });
await new Promise((r) => setTimeout(r, 1500));
try {
  await page.waitForSelector('input[type="password"]', { timeout: 5_000 });
  await page.type('input[type="password"]', PWD);
  await page.keyboard.press("Enter");
} catch {}
await new Promise((r) => setTimeout(r, 5000));

// search all buttons for "Export"
const buttons = await page.$$eval('button, a', els =>
  els.filter(el => /export/i.test(el.textContent ?? "")).map(el => ({
    tag: el.tagName, text: (el.textContent ?? "").trim().slice(0,40),
    title: el.getAttribute("title")?.slice(0,80)
  }))
);
console.log("Export-bearing elements:", buttons.length);
for (const b of buttons) console.log(" ", b.tag, b.text, b.title ? `(title: ${b.title})` : "");

// Take screenshot focusing on selena row
await page.screenshot({ path: "/tmp/xiaojin-smoke-modals/11-with-export.png", fullPage: true });
await browser.close();
