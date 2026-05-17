import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PWD = readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8").match(/^APP_PASSWORD=(.+)$/m)[1];
const base = "https://selena.xiaojin.app";

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  defaultViewport: { width: 414, height: 1000 },
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
await new Promise(r => setTimeout(r, 1200));
try {
  await page.waitForSelector('input[type="password"]', { timeout: 5_000 });
  await page.type('input[type="password"]', PWD);
  await page.keyboard.press("Enter");
} catch {}
await new Promise(r => setTimeout(r, 3500));

// Find all today-task chip links by href subject-prefix (more reliable than text)
const links = await page.$$eval('a[href]', anchors =>
  anchors
    .filter(a => {
      const h = a.getAttribute("href") ?? "";
      return /^\/(math|chinese|english)\//.test(h);
    })
    .map(a => ({ text: (a.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40), href: a.getAttribute("href") }))
);
console.log("today-task links found:");
for (const l of links) console.log(" ", l.text, "→", l.href);

// Probe each unique href for 200/404
const uniq = [...new Set(links.map(l => l.href))];
console.log("\nprobing each link (HEAD then GET via puppeteer nav)...");
for (const href of uniq) {
  const fullUrl = href.startsWith("http") ? href : base + href;
  try {
    const r = await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
    const title = await page.title();
    const url = page.url();
    console.log(`  ${r?.status() ?? "?"} ${href} → final ${url} (title: "${title.slice(0,40)}")`);
  } catch (e) {
    console.log(`  ERR ${href} → ${e.message.slice(0,80)}`);
  }
}
await browser.close();
