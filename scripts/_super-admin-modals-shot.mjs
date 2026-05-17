/**
 * Screenshot super-admin page + open each modal one by one for x.ai visual review.
 *
 * Output: /tmp/xiaojin-smoke-modals/
 *   01-page.png          super-admin landing
 *   02-edit-modal.png    edit cadet modal
 *   03-new-modal.png     new student modal
 *   04-agent-modal.png   AI mission log modal
 *   05-stats-modal.png   stats modal
 *   06-creds-modal.png   credential result modal
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

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

console.log("[1/6] navigate + login");
await page.goto(`${BASE}/super-admin`, { waitUntil: "domcontentloaded", timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1500));

// AuthGate password input
try {
  await page.waitForSelector('input[type="password"]', { timeout: 5_000 });
  await page.type('input[type="password"]', PWD);
  await page.keyboard.press("Enter");
} catch {}
await new Promise((r) => setTimeout(r, 3500));

// Save landing
await page.screenshot({ path: `${OUT}/01-page.png`, fullPage: false });

// Edit modal — click first 编辑/EDIT button
console.log("[2/6] edit modal");
try {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => /edit|编辑/i.test(x.textContent ?? ""));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `${OUT}/02-edit-modal.png`, fullPage: false });
  // close
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => /^cancel$/i.test((x.textContent ?? "").trim()));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 600));
} catch (e) { console.log("  fail:", e.message); }

// New student modal — click + Enlist new cadet
console.log("[3/6] new modal");
try {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => /enlist|加同学|new cadet/i.test(x.textContent ?? ""));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `${OUT}/03-new-modal.png`, fullPage: false });
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => /^cancel$/i.test((x.textContent ?? "").trim()));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 600));
} catch (e) { console.log("  fail:", e.message); }

// Agent modal — click 🤖 / AI button
console.log("[4/6] agent modal");
try {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => /^ai$|agent|🤖/i.test((x.textContent ?? "").trim()));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: `${OUT}/04-agent-modal.png`, fullPage: false });
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => /^close$/i.test((x.textContent ?? "").trim()));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 600));
} catch (e) { console.log("  fail:", e.message); }

// Stats modal — click 📊 / stats
console.log("[5/6] stats modal");
try {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => /stats|📊|学情/i.test(x.textContent ?? ""));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: `${OUT}/05-stats-modal.png`, fullPage: false });
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => /^close$/i.test((x.textContent ?? "").trim()));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 600));
} catch (e) { console.log("  fail:", e.message); }

console.log("[6/6] done");
await browser.close();
console.log(`screenshots in ${OUT}/`);
