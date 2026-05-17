/**
 * Screenshot super-admin with the proxy fallback monitor panel expanded.
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, readFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "https://admin.xiaojin.app";
const OUT = "/tmp/xiaojin-smoke-modals";
mkdirSync(OUT, { recursive: true });
const PWD = readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8").match(/^APP_PASSWORD=(.+)$/m)[1];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 1280, height: 900 },
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();

console.log("[1/2] login + open proxy details");
await page.goto(`${BASE}/super-admin`, { waitUntil: "domcontentloaded", timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1500));
try {
  await page.waitForSelector('input[type="password"]', { timeout: 5_000 });
  await page.type('input[type="password"]', PWD);
  await page.keyboard.press("Enter");
} catch {}
await new Promise((r) => setTimeout(r, 3500));

await page.evaluate(() => {
  const details = [...document.querySelectorAll("details")];
  const px = details.find((d) => (d.textContent ?? "").toLowerCase().includes("proxy fallback monitor"));
  if (px) px.open = true;
});
await new Promise((r) => setTimeout(r, 2500));

console.log("[2/2] screenshot");
await page.screenshot({ path: `${OUT}/09-proxy-panel.png`, fullPage: false });
await browser.close();
console.log(`screenshot in ${OUT}/09-proxy-panel.png`);
