/** Verify cross-subdomain warning: login as selena on alice.xiaojin.app */
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PWD = readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8").match(/^APP_PASSWORD=(.+)$/m)[1];

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  defaultViewport: { width: 414, height: 800 },
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
console.log("[1] visit alice.xiaojin.app as Selena password");
await page.goto("https://alice.xiaojin.app/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await new Promise(r => setTimeout(r, 2000));
// type Selena password
try {
  await page.waitForSelector('input[type="password"]', { timeout: 5_000 });
  await page.type('input[type="password"]', PWD);
  await page.keyboard.press("Enter");
} catch (e) {
  console.log("no password input:", e.message);
}
await new Promise(r => setTimeout(r, 12000));

// check for the warning modal
const warnText = await page.evaluate(() => {
  const els = [...document.querySelectorAll("div")];
  const m = els.find(el => /这不是你的子域名/.test(el.textContent ?? ""));
  return m?.textContent?.slice(0, 200) ?? "(no warning modal found)";
});
console.log("modal text:", warnText.slice(0, 200));
await page.screenshot({ path: "/tmp/xiaojin-smoke-modals/13-cross-subdomain.png" });
await browser.close();
console.log("saved /tmp/xiaojin-smoke-modals/13-cross-subdomain.png");
