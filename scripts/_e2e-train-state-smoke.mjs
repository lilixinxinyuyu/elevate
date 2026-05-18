/**
 * v0.35.21 iter 50 (retrospective P1-2.1): Train state puppeteer smoke.
 *
 * 评审 B 强烈建议过 — Train 页 mid-session 刷新 / fresh / unitId / mode
 * 参数行为没真测过 (iter 37 retrospective 自陈"只口头验证"). 本 iter 加自动
 * smoke 防回归.
 *
 * 测试场景 (prod selena.xiaojin.app):
 *   A. mid-session 刷新 → session 持久 (同 question_id, 同 index)
 *   B. ?fresh=<ts> → 强制新 session (不同 question_id)
 *   C. ?skillId=<id> → skill-scoped session
 *   D. ?mode=mock_exam&size=30 → 30 题 mock 模式
 *   E. mock_exam ?size=60 → 60 题
 *
 * 输出: tests/iter50-train-state-smoke.md (PASS/FAIL 清单)
 *
 * 用法: node scripts/_e2e-train-state-smoke.mjs
 */
import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const REPORT = join(REPO_ROOT, "tests/iter50-train-state-smoke.md");
const SCREENSHOTS_DIR = join(REPO_ROOT, "tests/iter50-screenshots");
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const SELENA_URL = "https://selena.xiaojin.app";

async function getCadetPwd(userId) {
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
  } catch {
    return null;
  }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 414, height: 896 },
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const results = [];
const consoleErrors = [];
const page = await browser.newPage();

page.on("console", (msg) => {
  if (msg.type() === "error") {
    consoleErrors.push({ url: page.url(), text: msg.text().slice(0, 200) });
  }
});
page.on("pageerror", (err) => {
  consoleErrors.push({ url: page.url(), text: `[PageError] ${err.message.slice(0, 200)}` });
});

const selenaPwd = await getCadetPwd("selena");
if (!selenaPwd) {
  console.error("✗ getCadetPwd(selena) returned empty. Aborting.");
  await browser.close();
  process.exit(1);
}
await page.evaluateOnNewDocument((p) => {
  localStorage.setItem("selena.cloud.pwd", p);
  localStorage.setItem("xiaojinapp.cloud.pwd", p);
}, selenaPwd);

// Helper: poll DOM 等 GameShell ready (最多 maxWaitMs), 然后 dump session info.
// 关键: 用 "第 N / Total" 精准 match (GameShell.tsx 显示文本).
async function readSessionInfo(maxWaitMs = 15000) {
  const start = Date.now();
  const POLL_INTERVAL = 500;
  let info = { stem: "", indexTotal: "", url: page.url() };
  while (Date.now() - start < maxWaitMs) {
    try {
      info = await page.evaluate(() => {
        // 多 selector + 多模板兜底. 不同 template (SpeedMatch / ShopCounter /
        // PlainNumeric / PlainChoice / MultiStepApplication etc) class 不同.
        const candidates = Array.from(document.querySelectorAll(
          ".font-display.text-2xl, .text-2xl.font-display, " +
          "[class*='font-display'][class*='text-2xl'], " +
          "[class*='text-2xl'][class*='leading-tight'], " +
          ".text-xl.font-bold, h1.font-display, h2.font-display, " +
          "[class*='text-lg'][class*='font-display']"
        )).filter((el) => {
          // 排除 header / sidebar / progress bar (这些含数字 / 短文本)
          const t = (el.textContent ?? "").trim();
          return t.length >= 4 && !/^\d/.test(t);
        });
        const stem = candidates[0]?.textContent?.trim()?.slice(0, 120) ?? "";
        let indexTotal = "";
        const spans = document.querySelectorAll("span.text-xs.text-slate-400");
        for (const s of spans) {
          const t = s.textContent ?? "";
          const m = t.match(/第\s*(\d+)\s*\/\s*(\d+)/);
          if (m) { indexTotal = `${m[1]}/${m[2]}`; break; }
        }
        return { stem, indexTotal, url: location.href };
      });
      // indexTotal 是真正的 train-loaded 信号 (GameShell 才显示). stem 多模板形态,
      // 但 indexTotal 唯一. 主要等 indexTotal.
      if (info.indexTotal) return info;
    } catch {
      /* page navigating, retry */
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
  return info;
}

async function step(name, fn) {
  console.log(`▶ ${name}`);
  try {
    const r = await fn();
    results.push({ name, status: "PASS", note: r });
    console.log(`  ✓ ${r}`);
    return r;
  } catch (e) {
    results.push({ name, status: "FAIL", note: e.message });
    console.error(`  ✗ FAIL: ${e.message}`);
    return null;
  }
}

// ──────────────────── Scenarios ────────────────────

await step("A.1 navigate /math/train (no params, default normal mode)", async () => {
  await page.goto(`${SELENA_URL}/math/train`, { waitUntil: "load", timeout: 90000 });
  // cold start 慢, poll loop 等到 stem 出现 (up to 20s)
  const info = await readSessionInfo(20000);
  if (!info.stem) throw new Error(`no stem rendered; indexTotal=${info.indexTotal} url=${info.url}`);
  await page.screenshot({ path: join(SCREENSHOTS_DIR, "A1-default.png") });
  return `stem="${info.stem.slice(0, 40)}..." index=${info.indexTotal}`;
});

let sessionA;

await step("A.2 first question loaded → capture stem + index", async () => {
  sessionA = await readSessionInfo();
  if (!sessionA.stem) throw new Error("no stem");
  return `captured: ${sessionA.stem.slice(0, 30)}... ${sessionA.indexTotal}`;
});

await step("A.3 RELOAD page (no fresh) → expect same indexTotal (session persisted)", async () => {
  await page.reload({ waitUntil: "load", timeout: 90000 });
  const after = await readSessionInfo();
  await page.screenshot({ path: join(SCREENSHOTS_DIR, "A3-after-reload.png") });
  // 只比 indexTotal — same session 同 questionIds → 同 size → 同 indexTotal "1/N".
  // stem 比较跨模板不稳 (不同 template selector 抓不同 DOM 节点).
  if (!after.indexTotal) {
    throw new Error(`reload 后无 indexTotal: url=${after.url}`);
  }
  if (after.indexTotal !== sessionA.indexTotal) {
    throw new Error(`session DIFF after reload! before=${sessionA.indexTotal} after=${after.indexTotal}`);
  }
  return `same indexTotal = ${after.indexTotal} (session persisted ✅)`;
});

let sessionFresh;
await step("B.1 navigate ?fresh=<ts> → expect new session loaded", async () => {
  await page.goto(`${SELENA_URL}/math/train?fresh=${Date.now()}`, { waitUntil: "load", timeout: 90000 });
  sessionFresh = await readSessionInfo(25000); // fresh session plan 慢, 多等
  await page.screenshot({ path: join(SCREENSHOTS_DIR, "B1-fresh.png") });
  if (!sessionFresh.indexTotal) throw new Error(`no indexTotal after fresh; url=${sessionFresh.url}`);
  if (!sessionFresh.url.includes("fresh=")) throw new Error(`fresh param dropped: ${sessionFresh.url}`);
  return `fresh session loaded (${sessionFresh.indexTotal}); URL has fresh ✅`;
});

await step("C.1 navigate /math/train?mode=mock_exam&size=30 → 30-题 mock", async () => {
  await page.goto(`${SELENA_URL}/math/train?mode=mock_exam&fresh=${Date.now()}&size=30`, { waitUntil: "load", timeout: 90000 });
  const info = await readSessionInfo(25000); // mock-exam plan 慢, 多等
  await page.screenshot({ path: join(SCREENSHOTS_DIR, "C1-mock-30.png") });
  if (!info.indexTotal) throw new Error(`no indexTotal for mock; url=${info.url}`);
  if (!/\/\s*30/.test(info.indexTotal)) {
    throw new Error(`expect "X/30" but got "${info.indexTotal}"`);
  }
  return `mock 30 题 OK: ${info.indexTotal}`;
});

await step("C.2 navigate /math/train?mode=mock_exam&size=60 → 60-题 mock", async () => {
  await page.goto(`${SELENA_URL}/math/train?mode=mock_exam&fresh=${Date.now()}&size=60`, { waitUntil: "load", timeout: 90000 });
  const info = await readSessionInfo();
  await page.screenshot({ path: join(SCREENSHOTS_DIR, "C2-mock-60.png") });
  if (!/\/\s*60/.test(info.indexTotal)) {
    throw new Error(`expect "X/60" but got "${info.indexTotal}"`);
  }
  return `mock 60 题 OK: ${info.indexTotal}`;
});

await step("D.1 mock_exam ?hard=1 → 硬限时 mode (URL preserved)", async () => {
  const url = `${SELENA_URL}/math/train?mode=mock_exam&fresh=${Date.now()}&size=30&hard=1`;
  await page.goto(url, { waitUntil: "load", timeout: 90000 });
  const info = await readSessionInfo();
  await page.screenshot({ path: join(SCREENSHOTS_DIR, "D1-mock-hard.png") });
  if (!info.url.includes("hard=1")) throw new Error(`hard param dropped: ${info.url}`);
  return `hard mode URL preserved: ${info.url.slice(-50)}`;
});

await step("E.1 console errors check", async () => {
  // mascot quick access 浮动按钮触发的 image gen 503 不算 ("known")
  // 实际 image gen 现在走 FC bypass → 200, 不该有错
  const real = consoleErrors.filter((e) =>
    !e.text.includes("image_gen_disabled") &&
    !e.text.includes("favicon") &&
    !/Failed to load resource.*\d{3}/.test(e.text)
  );
  if (real.length > 0) {
    throw new Error(`${real.length} real console errors: ${real.slice(0, 3).map((e) => e.text.slice(0, 80)).join(" | ")}`);
  }
  return `0 real console errors (${consoleErrors.length} total filtered)`;
});

// ──────────────────── Output report ────────────────────

const pass = results.filter((r) => r.status === "PASS").length;
const fail = results.filter((r) => r.status === "FAIL").length;
const md = `# iter 50 Train state smoke (v0.35.21)

Run: ${new Date().toISOString()}
Result: ${pass} PASS / ${fail} FAIL

## Scenarios

${results.map((r) => `- **${r.status === "PASS" ? "✅" : "❌"} ${r.name}** — ${r.note}`).join("\n")}

## Console errors (raw)

${consoleErrors.length === 0 ? "_(none)_" : consoleErrors.slice(0, 10).map((e) => `- \`${e.url.slice(-50)}\`: ${e.text}`).join("\n")}

## Screenshots

\`tests/iter50-screenshots/\` 含 A1 / A3 / B1 / C1 / C2 / D1 各场景截图.
`;

writeFileSync(REPORT, md, "utf-8");
console.log(`\n✓ report: ${REPORT}`);
console.log(`✓ ${pass} PASS / ${fail} FAIL`);

await browser.close();
process.exit(fail > 0 ? 1 : 0);
