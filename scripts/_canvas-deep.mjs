import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
async function getCadetPwd(userId) {
  const env = Object.fromEntries(
    readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
  const code = `
import OSS from 'ali-oss';
const oss = new OSS({endpoint:'https://${env.ALIYUN_OSS_REGION}.aliyuncs.com',bucket:'${env.ALIYUN_OSS_BUCKET}',accessKeyId:'${env.ALIYUN_OSS_ACCESS_KEY_ID}',accessKeySecret:'${env.ALIYUN_OSS_ACCESS_KEY_SECRET}',secure:true});
const a = await oss.get('_auth/users.json');
const j = JSON.parse(a.content.toString('utf-8'));
process.stdout.write(Object.entries(j.passwords||{}).find(([_,u])=>u==='${userId}')?.[0] || '');
`.trim();
  return execSync(`cd /Users/yong/Desktop/xy/heping-math-trainer/aliyun-deploy && node -e "${code.replace(/"/g, '\\"')}" --input-type=module`, { encoding: "utf-8" }).trim();
}

const pwd = await getCadetPwd("selena");
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 414, height: 896 }, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument((p) => {
  localStorage.setItem("selena.cloud.pwd", p);
  localStorage.setItem("xiaojinapp.cloud.pwd", p);
}, pwd);

await page.goto(`https://selena.xiaojin.app/math/train?fresh=${Date.now()}`, { waitUntil: "load", timeout: 90000 });
await new Promise((r) => setTimeout(r, 6000));

// 直接 IndexedDB 拉 today's session + questions, 看 template
const result = await page.evaluate(async () => {
  // List all databases
  const dbs = await indexedDB.databases();
  // Use native indexedDB API directly (Dexie 已被 app open 过, just join)
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open("heping-math-trainer");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const storeNames = Array.from(db.objectStoreNames);
  function getAll(name) { return new Promise((res, rej) => {
    const t = db.transaction(name, "readonly").objectStore(name).getAll();
    t.onsuccess = () => res(t.result);
    t.onerror = () => rej(t.error);
  });}
  function getOne(name, key) { return new Promise((res) => {
    const t = db.transaction(name, "readonly").objectStore(name).get(key);
    t.onsuccess = () => res(t.result);
    t.onerror = () => res(null);
  });}
  const sessions = await getAll("sessions");
  const todaySessions = sessions.filter((s) => !s.finishedAt).slice(0, 3);
  const sampleQids = todaySessions.flatMap((s) => (s.questionIds ?? []).slice(0, 3));
  const qs = await Promise.all(sampleQids.map((id) => getOne("questions", id)));
  return {
    dbs,
    storeNames,
    dbVersion: db.version,
    sessionsCount: sessions.length,
    todayCount: todaySessions.length,
    sampleQids: sampleQids.slice(0, 5),
    sampleQs: qs.slice(0, 5).map((q) => q ? {
      id: q.question_id,
      diff: q.difficulty,
      requiresScratch: q.requiresScratch,
      requiresMultiStep: q.requiresMultiStep,
      speedEligible: q.speedEligible,
      play_as: q.play_as,
      hasMetadata: q.requiresScratch !== undefined || q.requiresMultiStep !== undefined,
    } : null),
    flagMultiStep: localStorage.getItem("multi_step_app_v1") !== "false",
    flagScratch: localStorage.getItem("scratch_insurance_v1") !== "false",
  };
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
