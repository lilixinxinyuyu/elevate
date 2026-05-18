import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
async function getCadetPwd(userId) {
  const env = Object.fromEntries(readFileSync("/Users/yong/Desktop/xy/.dev.vars","utf-8").split("\n").filter((l)=>l.includes("=")&&!l.startsWith("#")).map((l)=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()];}));
  const code = `import OSS from 'ali-oss';const oss=new OSS({endpoint:'https://${env.ALIYUN_OSS_REGION}.aliyuncs.com',bucket:'${env.ALIYUN_OSS_BUCKET}',accessKeyId:'${env.ALIYUN_OSS_ACCESS_KEY_ID}',accessKeySecret:'${env.ALIYUN_OSS_ACCESS_KEY_SECRET}',secure:true});const a=await oss.get('_auth/users.json');const j=JSON.parse(a.content.toString('utf-8'));process.stdout.write(Object.entries(j.passwords||{}).find(([_,u])=>u==='${userId}')?.[0]||'');`;
  return execSync(`node -e "${code.replace(/"/g,'\\"')}" --input-type=module`,{encoding:"utf-8"}).trim();
}
const pwd = await getCadetPwd("selena");
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1024, height: 768 }, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument((p) => { localStorage.setItem("selena.cloud.pwd", p); localStorage.setItem("xiaojinapp.cloud.pwd", p); }, pwd);

// 1. Landing (/) — should have admin entry
await page.goto("https://selena.xiaojin.app/", { waitUntil: "load", timeout: 90000 });
await new Promise((r) => setTimeout(r, 6000));
const landing = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll("a, button")).filter((el) => /管理|⚙/.test(el.textContent ?? ""));
  return { count: links.length, items: links.map((el) => (el.textContent ?? "").trim().slice(0, 30)) };
});
console.log("Landing admin entry:", JSON.stringify(landing));

// 2. Math (/math) — should NOT have any admin entry
await page.goto("https://selena.xiaojin.app/math", { waitUntil: "load", timeout: 90000 });
await new Promise((r) => setTimeout(r, 12000));
const math = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll("a, button")).filter((el) => /管理|⚙/.test(el.textContent ?? ""));
  return { count: links.length, items: links.map((el) => ({ text: (el.textContent ?? "").trim().slice(0, 30), href: el.tagName === "A" ? (el).getAttribute("href") : null })) };
});
console.log("\nMath admin entries:", JSON.stringify(math, null, 2));
await browser.close();
