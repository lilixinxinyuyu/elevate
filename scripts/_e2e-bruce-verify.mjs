/**
 * Quick e2e for bruce: 验证 title + trophy images.
 * Run: node scripts/_e2e-bruce-verify.mjs
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const USER_ID = "bruce";
// Pull bruce password from .dev.vars OSS query
const PASSWORD = execSync(
  `cd /Users/yong/Desktop/xy/heping-math-trainer/aliyun-deploy && node -e "
import OSS from 'ali-oss';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('/Users/yong/Desktop/xy/.dev.vars','utf-8').split('\\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const oss = new OSS({endpoint:'https://'+env.ALIYUN_OSS_REGION+'.aliyuncs.com',bucket:env.ALIYUN_OSS_BUCKET,accessKeyId:env.ALIYUN_OSS_ACCESS_KEY_ID,accessKeySecret:env.ALIYUN_OSS_ACCESS_KEY_SECRET,secure:true});
const a = await oss.get('_auth/users.json');
const j = JSON.parse(a.content.toString('utf-8'));
process.stdout.write(Object.entries(j.passwords||{}).find(([_,u])=>u==='bruce')?.[0] || '');
" --input-type=module`,
  { encoding: "utf-8" },
).trim();
console.log("bruce pwd len:", PASSWORD.length);

const BASE = `https://${USER_ID}.xiaojin.app`;
const OUT = "/tmp/xiaojin-bruce";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 414, height: 896 },
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const networkFails = [];
page.on("response", (r) => {
  if (r.status() >= 400) networkFails.push({ url: r.url(), status: r.status() });
});

await page.evaluateOnNewDocument((pwd) => {
  localStorage.setItem("selena.cloud.pwd", pwd);
}, PASSWORD);

console.log("loading", BASE);
const t0 = Date.now();
await page.goto(BASE, { waitUntil: "networkidle0", timeout: 90000 }).catch((e) => console.log("nav timeout:", e.message));
const loadMs = Date.now() - t0;
console.log(`load time: ${loadMs}ms`);

await new Promise((r) => setTimeout(r, 3500));
console.log(`title: "${await page.title()}"`);
await page.screenshot({ path: `${OUT}/01-home.png` });

// 关掉 modal
for (let i = 0; i < 4; i++) {
  const closed = await page.evaluate(() => {
    const dialogs = document.querySelectorAll('[role="dialog"]');
    for (const d of dialogs) {
      for (const b of d.querySelectorAll("button")) {
        const t = b.textContent ?? "";
        if (t.includes("稍后") || t.includes("跳过") || t.includes("✕") || t.includes("知道了")) {
          b.click();
          return true;
        }
      }
    }
    return false;
  });
  if (!closed) break;
  await new Promise((r) => setTimeout(r, 400));
}
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: `${OUT}/02-home-clean.png` });

// 进数学 home 看勋章柜
await page.evaluate(() => { window.history.pushState({}, "", "/math"); window.dispatchEvent(new PopStateEvent("popstate")); });
await new Promise((r) => setTimeout(r, 4000));
console.log(`/math title: "${await page.title()}"`);
await page.screenshot({ path: `${OUT}/03-math.png` });

// 进 skills 页看徽章柜
await page.evaluate(() => { window.history.pushState({}, "", "/math/skills"); window.dispatchEvent(new PopStateEvent("popstate")); });
await new Promise((r) => setTimeout(r, 3500));
await page.screenshot({ path: `${OUT}/04-skills.png` });

// 看 trophy-images API 是否 200
const apiCheck = await page.evaluate(async () => {
  try {
    const r = await fetch("/api/sync/trophy-images?list=1", {
      headers: { Authorization: `Bearer ${localStorage.getItem("selena.cloud.pwd")}` },
    });
    const j = await r.json();
    return { ok: j.ok, count: j.count };
  } catch (e) { return { error: e.message }; }
});
console.log(`trophy-images API: ${JSON.stringify(apiCheck)}`);

const titleNow = await page.title();
console.log(`final title: "${titleNow}"`);
console.log(`network fails: ${networkFails.length}`);
if (networkFails.length > 0) console.log(`  ${networkFails.slice(0, 3).map((f) => f.url.slice(-60) + " #" + f.status).join("\n  ")}`);

writeFileSync(`${OUT}/report.json`, JSON.stringify({ loadMs, title: titleNow, networkFails, apiCheck }, null, 2));
await browser.close();
