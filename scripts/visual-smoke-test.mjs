/**
 * Visual smoke test for https://xiaojin.app via headless Chrome.
 *
 * 跑过：home / train / mistakes / settings 4 个 SPA 路由
 * 每页：截图 + console errors + failed network requests
 *
 * 输出：
 *   /tmp/xiaojin-smoke/<route>.png 截图
 *   /tmp/xiaojin-smoke/report.json  console + network summary
 *
 * 用法：
 *   node scripts/visual-smoke-test.mjs
 *   APP_PASSWORD=xxx node scripts/visual-smoke-test.mjs  (有 password 会自动登录)
 */

import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.SMOKE_BASE ?? "https://xiaojin.app";
const OUT = "/tmp/xiaojin-smoke";
mkdirSync(OUT, { recursive: true });

const PWD =
  process.env.APP_PASSWORD ??
  (() => {
    try {
      return (readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8").match(/^APP_PASSWORD=(.+)$/m) ?? [])[1] ?? "";
    } catch {
      return "";
    }
  })();

const ROUTES = ["/", "/train", "/mistakes", "/settings"];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 414, height: 896 }, // iPhone XR
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const report = { startedAt: new Date().toISOString(), base: BASE, pages: [] };

try {
  const page = await browser.newPage();

  // 收 console + network
  const consoleLogs = [];
  const networkFails = [];
  const networkAll = [];
  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) {
      consoleLogs.push({ type: msg.type(), text: msg.text().slice(0, 300) });
    }
  });
  page.on("pageerror", (err) => {
    consoleLogs.push({ type: "pageerror", text: err.message.slice(0, 300) });
  });
  page.on("response", (resp) => {
    const url = resp.url();
    const status = resp.status();
    networkAll.push({ url, status });
    if (status >= 400) {
      networkFails.push({ url, status });
    }
  });

  // 注入密码到 localStorage（key 来自 src/db/cloudSync.ts: PASSWORD_KEY = "selena.cloud.pwd"）
  if (PWD) {
    await page.evaluateOnNewDocument((p) => {
      localStorage.setItem("selena.cloud.pwd", p);
    }, PWD);
  }

  for (const route of ROUTES) {
    consoleLogs.length = 0;
    networkFails.length = 0;
    networkAll.length = 0;

    const url = BASE + route;
    console.log(`\n[smoke] ${url}`);
    const t0 = Date.now();
    let navOk = true;
    let navError = null;
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    } catch (e) {
      navOk = false;
      navError = e.message.slice(0, 200);
    }
    const navMs = Date.now() - t0;

    // 等一秒让 SPA 渲染稳定
    await new Promise((r) => setTimeout(r, 1500));

    const safeName = route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "_");
    const shot = `${OUT}/${safeName}.png`;
    await page.screenshot({ path: shot, fullPage: false });

    const pageReport = {
      route,
      url,
      navOk,
      navError,
      navMs,
      screenshot: shot,
      consoleErrors: [...consoleLogs],
      networkFails: [...networkFails],
      networkCount: networkAll.length,
      title: await page.title(),
    };
    report.pages.push(pageReport);
    console.log(`  ${navOk ? "OK" : "FAIL"} in ${navMs}ms, ${consoleLogs.length} console errs, ${networkFails.length} 4xx/5xx, title=${pageReport.title}`);
    if (consoleLogs.length) {
      console.log("  console:", consoleLogs.slice(0, 5).map((c) => `[${c.type}] ${c.text.slice(0, 80)}`).join(" | "));
    }
    if (networkFails.length) {
      console.log("  network fails:", networkFails.slice(0, 5).map((n) => `${n.status} ${n.url.replace(BASE, "")}`).join(" | "));
    }
  }
} finally {
  await browser.close();
}

report.completedAt = new Date().toISOString();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(`\n✓ report: ${OUT}/report.json`);
console.log(`✓ screenshots in ${OUT}/`);

// 总结
const totalErrs = report.pages.reduce((s, p) => s + p.consoleErrors.length, 0);
const totalFails = report.pages.reduce((s, p) => s + p.networkFails.length, 0);
const navFails = report.pages.filter((p) => !p.navOk).length;
console.log(`\nSummary: ${report.pages.length} pages, ${navFails} nav fails, ${totalErrs} console errors, ${totalFails} 4xx/5xx requests`);
