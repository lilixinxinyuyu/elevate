import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
async function getCadetPwd(userId) {
  const env = Object.fromEntries(readFileSync("/Users/yong/Desktop/xy/.dev.vars","utf-8").split("\n").filter((l)=>l.includes("=")&&!l.startsWith("#")).map((l)=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()];}));
  const code = `import OSS from 'ali-oss';const oss=new OSS({endpoint:'https://${env.ALIYUN_OSS_REGION}.aliyuncs.com',bucket:'${env.ALIYUN_OSS_BUCKET}',accessKeyId:'${env.ALIYUN_OSS_ACCESS_KEY_ID}',accessKeySecret:'${env.ALIYUN_OSS_ACCESS_KEY_SECRET}',secure:true});const a=await oss.get('_auth/users.json');const j=JSON.parse(a.content.toString('utf-8'));process.stdout.write(Object.entries(j.passwords||{}).find(([_,u])=>u==='${userId}')?.[0]||'');`;
  return execSync(`cd /Users/yong/Desktop/xy/heping-math-trainer/aliyun-deploy && node -e "${code.replace(/"/g,'\\"')}" --input-type=module`,{encoding:"utf-8"}).trim();
}
const pwd = await getCadetPwd("selena");
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 414, height: 896 }, args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("console", (msg) => {
  const t = msg.text();
  if (t.includes("[seed]") || t.includes("seed_") || t.includes("metadata") || t.includes("ensureSeeded")) console.log("CONSOLE:", t.slice(0, 200));
});
await page.evaluateOnNewDocument((p) => { localStorage.setItem("selena.cloud.pwd", p); localStorage.setItem("xiaojinapp.cloud.pwd", p); }, pwd);

// Land /math (Home) 先让 ensureSeeded 跑
console.log("--- 1. goto /math home ---");
await page.goto("https://selena.xiaojin.app/math", { waitUntil: "load", timeout: 90000 });
await new Promise((r) => setTimeout(r, 12000)); // 等 sync + seed

// 直接 IndexedDB 看 (must use page.evaluate before new navigation)
const dbState1 = await page.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open("heping-math-trainer"); r.onsuccess = () => res(r.result); });
  function getAll(s) { return new Promise((res) => { const t = db.transaction(s, "readonly").objectStore(s).getAll(); t.onsuccess = () => res(t.result); }); }
  function getMeta(k) { return new Promise((res) => { const t = db.transaction("meta", "readonly").objectStore("meta").get(k); t.onsuccess = () => res(t.result); }); }
  const qs = await getAll("questions");
  const seedV = await getMeta("seedVersion");
  // sample 5 random questions
  const sample = qs.slice(0, 5).map((q) => ({
    id: q.question_id, diff: q.difficulty,
    reqScratch: q.requiresScratch, reqMultiStep: q.requiresMultiStep, speedEligible: q.speedEligible,
    play_as: q.play_as, hasMeta: q.requiresScratch !== undefined || q.requiresMultiStep !== undefined,
  }));
  // Count metadata-填充率
  let withMeta = 0, scratchTrue = 0, multistepTrue = 0;
  for (const q of qs) {
    if (q.requiresScratch !== undefined || q.requiresMultiStep !== undefined) withMeta++;
    if (q.requiresScratch === true) scratchTrue++;
    if (q.requiresMultiStep === true) multistepTrue++;
  }
  return { qCount: qs.length, seedV: seedV?.value, withMeta, scratchTrue, multistepTrue, sample };
});
console.log(JSON.stringify(dbState1, null, 2));

await browser.close();
