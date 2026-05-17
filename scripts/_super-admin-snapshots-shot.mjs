/**
 * Screenshot super-admin with the snapshots panel expanded for Ep30 visual review.
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

console.log("[1/2] navigate + login");
await page.goto(`${BASE}/super-admin`, { waitUntil: "domcontentloaded", timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1500));
try {
  await page.waitForSelector('input[type="password"]', { timeout: 5_000 });
  await page.type('input[type="password"]', PWD);
  await page.keyboard.press("Enter");
} catch {}
await new Promise((r) => setTimeout(r, 3500));

console.log("[2/3] open snapshots details + screenshot");
await page.evaluate(() => {
  const details = [...document.querySelectorAll("details")];
  const snap = details.find((d) => (d.textContent ?? "").toLowerCase().includes("recent snapshots"));
  if (snap) snap.open = true;
});
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: `${OUT}/06-snapshots-panel.png`, fullPage: false });

console.log("[3/3] expand a row preview + screenshot");
await page.evaluate(() => {
  // click first backup row toggle (the inner button with backupId text)
  const buttons = [...document.querySelectorAll('button[title*="预览"], button[title*="点开"]')];
  if (buttons[0]) buttons[0].click();
});
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: `${OUT}/08-backup-preview.png`, fullPage: false });

await browser.close();
console.log(`screenshots in ${OUT}/`);
