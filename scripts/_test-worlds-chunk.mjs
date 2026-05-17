/**
 * Verify /worlds route lazy-loads its own chunk (worlds-*.js).
 * Captures: network requests + console errors + final screenshot.
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, readFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "https://selena.xiaojin.app";
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

const jsRequests = [];
page.on("request", (req) => {
  const url = req.url();
  if (url.endsWith(".js")) jsRequests.push(url);
});
const consoleErrs = [];
page.on("pageerror", (e) => consoleErrs.push("pageerror: " + e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrs.push("console: " + msg.text());
});
const failedReqs = [];
page.on("response", (r) => {
  if (r.status() >= 400) failedReqs.push(`${r.status()} ${r.url()}`);
});

// First navigate to home (so we get baseline JS load)
console.log("[1/3] navigate to home, login");
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
try {
  await page.waitForSelector('input[type="password"]', { timeout: 5_000 });
  await page.type('input[type="password"]', PWD);
  await page.keyboard.press("Enter");
} catch {}
await new Promise((r) => setTimeout(r, 3000));

const baselineJsCount = jsRequests.length;
const baselineWorldsCount = jsRequests.filter((u) => /worlds-[A-Za-z0-9]+\.js/.test(u)).length;
console.log(`  baseline JS: ${baselineJsCount}, worlds-*.js: ${baselineWorldsCount}`);

// Now navigate to /worlds — should trigger lazy chunk fetch
console.log("[2/3] navigate to /worlds");
const before = jsRequests.length;
await page.goto(`${BASE}/worlds`, { waitUntil: "domcontentloaded", timeout: 30_000 });
await new Promise((r) => setTimeout(r, 3000));

const newJs = jsRequests.slice(before);
const worldsChunkFetched = jsRequests.filter((u) => /worlds-[A-Za-z0-9]+\.js/.test(u));
console.log(`  new JS after /worlds: ${newJs.length}`);
console.log(`  worlds-*.js fetches total: ${worldsChunkFetched.length}`);
if (worldsChunkFetched.length > 0) console.log("  ✓ worlds chunk:", worldsChunkFetched[0]);

await page.screenshot({ path: `${OUT}/07-worlds-page.png`, fullPage: false });

// Report
console.log("\n[3/3] summary");
console.log("  console errors:", consoleErrs.length);
if (consoleErrs.length) console.log("    ", consoleErrs.slice(0, 5));
console.log("  failed requests:", failedReqs.length);
if (failedReqs.length) console.log("    ", failedReqs.slice(0, 5));
console.log(`  screenshot: ${OUT}/07-worlds-page.png`);

await browser.close();
process.exit(worldsChunkFetched.length > 0 && consoleErrs.length === 0 && failedReqs.length === 0 ? 0 : 1);
