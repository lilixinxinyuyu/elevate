/**
 * E2E verify (v0.34.78 iter 12): democlass5 登录 → 进数学 → 真打开 train →
 * 验证 5 道 iter 10 合成的 grade-5 题真出现在 question pool.
 *
 * 老师演示前最后一道防线 — 如果题没出来就丢脸.
 *
 * 跑法: node scripts/_e2e-verify-grade5-train.mjs
 *
 * 输出: /tmp/xiaojin-demo/{step}.png + report.json
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const USER_ID = "democlass5";
const PASSWORD = "78666109";
const BASE = `https://${USER_ID}.xiaojin.app`;
const OUT = "/tmp/xiaojin-demo";
mkdirSync(OUT, { recursive: true });

const consoleLogs = [];
const networkFails = [];
const apiCalls = [];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 414, height: 896 },
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) {
    consoleLogs.push({ at: Date.now(), type: m.type(), text: m.text().slice(0, 200) });
  }
});
page.on("pageerror", (e) => consoleLogs.push({ at: Date.now(), type: "pageerror", text: e.message.slice(0, 200) }));
page.on("response", (r) => {
  if (r.status() >= 400) networkFails.push({ at: Date.now(), url: r.url(), status: r.status() });
  if (r.url().includes("/api/sync/ai-questions")) {
    apiCalls.push({ at: Date.now(), url: r.url(), status: r.status() });
  }
});

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`  📸 ${name}.png`);
}
async function snap(label, fn) {
  console.log(`\n[${label}]`);
  try {
    await fn();
  } catch (e) {
    console.error(`  ✗ ${label}: ${e.message}`);
  }
}

try {
  // 注入 password to localStorage 跳过登录页 (avoid race with login form)
  await page.evaluateOnNewDocument((pwd) => {
    localStorage.setItem("selena.cloud.pwd", pwd);
  }, PASSWORD);

  await snap("01 cold load → SubjectPicker", async () => {
    await page.goto(BASE, { waitUntil: "networkidle0", timeout: 45000 }).catch((e) => console.log(`  nav fail (continuing): ${e.message}`));
    await new Promise((r) => setTimeout(r, 4000));
    await shot("01-subject-picker");
    console.log(`  title="${await page.title()}"`);
  });

  await snap("02 close modals (Tour + ProfileGate)", async () => {
    // 点掉任何 dialog 的关闭按钮
    for (let i = 0; i < 3; i++) {
      const closed = await page.evaluate(() => {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        for (const d of dialogs) {
          // 找 "稍后" / "跳过" / "✕" 按钮
          const buttons = d.querySelectorAll("button");
          for (const b of buttons) {
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
      await new Promise((r) => setTimeout(r, 500));
    }
    await shot("02-modals-dismissed");
  });

  await snap("03 force pullFromCloud to fetch synthesized questions", async () => {
    // 调 pull api 直接 — 强制 sync 一次
    const pullResult = await page.evaluate(async () => {
      try {
        const r = await fetch("/api/sync/ai-questions?since=0", {
          headers: { Authorization: `Bearer ${localStorage.getItem("selena.cloud.pwd")}` },
        });
        const j = await r.json();
        return {
          ok: j.ok,
          rowCount: (j.rows || []).length,
          perKey: j.perKeyCount,
          blob: j.blobCount,
          sample: (j.rows || []).slice(0, 3).map((q) => ({ qid: q.question_id, stem: (q.stem || "").slice(0, 60) })),
        };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log(`  pull result: ${JSON.stringify(pullResult, null, 2)}`);
  });

  await snap("04 check dexie has the 5 questions after sync", async () => {
    // 等 cloudSync interval 跑一次 (Layout interval ~30s, but force pull above already fetched)
    // 客户端 pullFromCloud 会自动 bulkPut 进 db.questions
    await new Promise((r) => setTimeout(r, 3500));
    const dexieCount = await page.evaluate(async () => {
      try {
        const db = (window).db || (window).__db;
        if (!db) return { error: "no_db_global" };
        const all = await db.questions.toArray();
        const grade5 = all.filter((q) => (q.tags || []).includes("grade_5") || (q.tags || []).includes("textbook_synthesized"));
        return { totalQuestions: all.length, grade5Count: grade5.length, sample: grade5.slice(0, 3).map((q) => q.question_id) };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log(`  dexie check: ${JSON.stringify(dexieCount, null, 2)}`);
  });

  await snap("05 navigate to math home", async () => {
    // 用 react-router-dom 客户端导航避免 ProfileGate overlay 拦截
    await page.evaluate(() => {
      window.history.pushState({}, "", "/math");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await new Promise((r) => setTimeout(r, 3000));
    await shot("05-math-home");
    console.log(`  title="${await page.title()}"`);
  });

  await snap("06 navigate to math train", async () => {
    await page.evaluate(() => {
      window.history.pushState({}, "", "/math/train");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await new Promise((r) => setTimeout(r, 4000));
    await shot("06-math-train");
    console.log(`  title="${await page.title()}"`);
    // 看页面有没有题
    const pageText = await page.evaluate(() => document.body.textContent?.slice(0, 500) ?? "");
    console.log(`  page text (first 200 chars): ${pageText.replace(/\s+/g, " ").slice(0, 200)}`);
  });

  await snap("07 dump final body for analysis", async () => {
    await new Promise((r) => setTimeout(r, 2000));
    await shot("07-final");
    const url = page.url();
    console.log(`  final url: ${url}`);
  });
} finally {
  const report = {
    base: BASE,
    userId: USER_ID,
    consoleLogs,
    networkFails,
    apiCalls,
    finishedAt: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(`\n=== summary ===`);
  console.log(`  console logs: ${consoleLogs.length} (errors/warnings)`);
  console.log(`  network 4xx-5xx: ${networkFails.length}`);
  console.log(`  /api/sync/ai-questions calls: ${apiCalls.length}`);
  console.log(`  screenshots: ${OUT}/`);
  await browser.close();
}
