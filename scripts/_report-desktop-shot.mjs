/**
 * Desktop-width screenshot of selena home page for peer review.
 * Default smoke is 414px (iPhone) — too cramped to evaluate layout.
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, readFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "https://selena.xiaojin.app";
const OUT = "/tmp/xiaojin-smoke";
mkdirSync(OUT, { recursive: true });
const PWD = readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8").match(/^APP_PASSWORD=(.+)$/m)[1];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 900, height: 1400 },
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
console.log("[1/2] navigate + login");
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1500));
try {
  await page.waitForSelector('input[type="password"]', { timeout: 5_000 });
  await page.type('input[type="password"]', PWD);
  await page.keyboard.press("Enter");
} catch {}
await new Promise((r) => setTimeout(r, 4000));

console.log("[2/2] fullPage screenshot");
await page.screenshot({ path: `${OUT}/home-desktop.png`, fullPage: true });
await browser.close();
console.log(`saved ${OUT}/home-desktop.png`);
