/**
 * Verify: fresh browser (empty IDB) logs in as selena, triggers pullFromCloud,
 * and the new manifest+per-image API actually pulls trophy images into IDB.
 *
 * Expectations:
 * 1. GET /api/sync/trophy-images?list=1 returns 200 with count:203
 * 2. Multiple GET /api/sync/trophy-images/:trophyId requests fire (parallel x4)
 * 3. IDB.trophyImages count goes from 0 → ~50 (PULL_LIMIT_PER_TICK cap)
 */
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PWD = readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8").match(/^APP_PASSWORD=(.+)$/m)[1];
const base = "https://selena.xiaojin.app";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 414, height: 1000 },
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--incognito"],
});
const page = await browser.newPage();

const trophyReqs = [];
page.on("request", (req) => {
  const u = req.url();
  if (u.includes("/api/sync/trophy-images")) trophyReqs.push(u);
});

console.log("[1] navigate fresh + login");
await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1500));
try {
  await page.waitForSelector('input[type="password"]', { timeout: 5_000 });
  await page.type('input[type="password"]', PWD);
  await page.keyboard.press("Enter");
} catch {}

console.log("[2] wait 20s for pull cycle to complete");
await new Promise((r) => setTimeout(r, 20_000));

console.log("[3] inspect trophy-image network");
const manifestCalls = trophyReqs.filter((u) => u.includes("?list=1"));
const singleCalls = trophyReqs.filter((u) => /\/trophy-images\/[^?]+/.test(u) && !u.includes("?list="));
const legacyCalls = trophyReqs.filter((u) => !u.includes("?list=") && !/\/trophy-images\/[^?]+/.test(u));
console.log(`  manifest (?list=1) calls: ${manifestCalls.length}`);
console.log(`  single-image GETs: ${singleCalls.length}`);
console.log(`  legacy bundle GETs: ${legacyCalls.length}`);
if (singleCalls.length) console.log(`  first 3 single GETs:`, singleCalls.slice(0, 3));

console.log("[4] count IDB trophyImages");
const idbCount = await page.evaluate(async () => {
  return new Promise((resolve) => {
    const req = indexedDB.open("heping-math-trainer");
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("trophyImages")) { resolve(-1); return; }
      const tx = db.transaction("trophyImages", "readonly");
      const store = tx.objectStore("trophyImages");
      const c = store.count();
      c.onsuccess = () => resolve(c.result);
      c.onerror = () => resolve(-2);
    };
    req.onerror = () => resolve(-3);
  });
});
console.log(`  IDB.trophyImages count = ${idbCount}`);

await browser.close();
