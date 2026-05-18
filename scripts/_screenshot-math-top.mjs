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
await page.evaluateOnNewDocument((p) => { localStorage.setItem("selena.cloud.pwd", p); localStorage.setItem("xiaojinapp.cloud.pwd", p); }, pwd);
await page.goto("https://selena.xiaojin.app/math", { waitUntil: "load", timeout: 90000 });
await new Promise((r) => setTimeout(r, 12000));
// Find all "管理" + "⚙" text + links to /admin or /super-admin
const adminInfo = await page.evaluate(() => {
  const text = document.body.innerText;
  const adminCount = (text.match(/管理/g) ?? []).length;
  const settingsIconCount = (text.match(/⚙/g) ?? []).length;
  // Find all clickable elements containing "管理"
  const adminLinks = Array.from(document.querySelectorAll("a, button"))
    .filter((el) => /管理|⚙/.test(el.textContent ?? ""))
    .map((el) => ({
      tag: el.tagName, text: (el.textContent ?? "").trim().slice(0, 30),
      href: el.tagName === "A" ? (el).href : null,
      rect: el.getBoundingClientRect(),
    }))
    .filter((x) => x.rect.top < 200); // top of page only
  return { adminCount, settingsIconCount, topAdminLinks: adminLinks };
});
console.log(JSON.stringify(adminInfo, null, 2));
await page.screenshot({ path: "/tmp/selena-math-top.png", fullPage: false, clip: { x: 0, y: 0, width: 414, height: 200 } });
console.log("Screenshot: /tmp/selena-math-top.png");
await browser.close();
