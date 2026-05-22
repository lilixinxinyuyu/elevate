#!/usr/bin/env node
/**
 * 一次性: 截 prod 上 v7 指挥中心(/math/hub-v7-preview) 与 原版默认大厅(/math) 的桌面+手机图,
 * 存 /tmp 供发给视觉模型(gemini-3-pro / gpt-5.5)做专业设计 critique。
 * 复用 _e2e-train-state-smoke.mjs 的 Chrome + selena 登录态注入。
 */
import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "https://selena.xiaojin.app";

function getCadetPwd(userId) {
  const env = Object.fromEntries(
    readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8")
      .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  const code = `
import OSS from 'ali-oss';
const oss = new OSS({endpoint:'https://${env.ALIYUN_OSS_REGION}.aliyuncs.com',bucket:'${env.ALIYUN_OSS_BUCKET}',accessKeyId:'${env.ALIYUN_OSS_ACCESS_KEY_ID}',accessKeySecret:'${env.ALIYUN_OSS_ACCESS_KEY_SECRET}',secure:true});
const a = await oss.get('_auth/users.json');
const j = JSON.parse(a.content.toString('utf-8'));
process.stdout.write(Object.entries(j.passwords||{}).find(([_,u])=>u==='${userId}')?.[0] || '');
  `.trim();
  try {
    return execSync(`cd /Users/yong/Desktop/xy/heping-math-trainer/aliyun-deploy && node -e "${code.replace(/"/g, '\\"')}" --input-type=module`, { encoding: "utf-8" }).trim();
  } catch (e) { console.error("pwd fail", e.message); return null; }
}

const pwd = getCadetPwd("selena");
if (!pwd) { console.error("no pwd"); process.exit(1); }

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.evaluateOnNewDocument((p) => {
  localStorage.setItem("selena.cloud.pwd", p);
  localStorage.setItem("xiaojinapp.cloud.pwd", p);
}, pwd);

const shots = [
  { url: `${BASE}/math/hub-v7-preview?fresh=${Date.now()}`, vp: { width: 1600, height: 1000 }, out: "/tmp/hub-v7-desktop.png" },
  { url: `${BASE}/math/hub-v7-preview?fresh=${Date.now()+1}`, vp: { width: 390, height: 844 }, out: "/tmp/hub-v7-mobile.png" },
  { url: `${BASE}/math?fresh=${Date.now()+2}`, vp: { width: 1600, height: 1000 }, out: "/tmp/hub-orig-desktop.png" },
  { url: `${BASE}/math?fresh=${Date.now()+3}`, vp: { width: 390, height: 844 }, out: "/tmp/hub-orig-mobile.png" },
];
for (const s of shots) {
  await page.setViewport(s.vp);
  await page.goto(s.url, { waitUntil: "load", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 6000)); // 等数据 + 立绘/动效
  await page.screenshot({ path: s.out });
  console.log("✓", s.out, JSON.stringify(s.vp), s.url.split("?")[0]);
}
await browser.close();
console.log("done");
