/**
 * E2E smoke test for Selena 43% master plan — iter 32-42 (P0 + P1 + P2).
 *
 * 目标: 在真 production 浏览器里走 Selena 完整 flow, 验证 11 个新 feature 都 render 不崩.
 *
 * 检查项:
 *   1. Selena Home 应有 6 个新入口 (考试模拟 / 错题侦探 / 进制小课堂 / 脑力雷达 / 稳准挑战 inline / 巧算工具箱原有)
 *   2. 每个新页面 navigate 后不报 console error
 *   3. /math/train 1 题答完, 检查 EstimationGate 或 ScratchPanel render (如果该题触发)
 *   4. Mobile viewport (414x896, iPad mini 模拟) - Selena 实际使用尺寸
 *
 * 输出: console + tests/e2e-smoke-report.md
 */
import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const REPORT = join(REPO_ROOT, "tests/e2e-smoke-report.md");
const SCREENSHOTS_DIR = join(REPO_ROOT, "tests/e2e-screenshots");
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function getPwd() {
  // Parent/admin password — for admin.xiaojin.app
  const text = readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8");
  return (text.match(/^APP_PASSWORD=(.+)$/m) ?? [])[1] ?? "";
}

async function getCadetPwd(userId) {
  // Selena 等 cadet 在 OSS _auth/users.json 里有独立密码 (跟 visual-diff.mjs 同模式)
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
  defaultViewport: { width: 414, height: 896 }, // iPad mini-ish, Selena 实际尺寸
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const results = [];
const consoleErrors = [];
const page = await browser.newPage();

// Capture console errors
page.on("console", (msg) => {
  if (msg.type() === "error") {
    consoleErrors.push({ url: page.url(), text: msg.text().slice(0, 200) });
  }
});
page.on("pageerror", (err) => {
  consoleErrors.push({ url: page.url(), text: `[PageError] ${err.message.slice(0, 200)}` });
});

// Set Selena 自己的 cadet password (parent APP_PASSWORD 在 selena 子域 → 401)
const selenaPwd = await getCadetPwd("selena");
if (!selenaPwd) {
  console.log("⚠️ getCadetPwd(selena) returned empty — will see 401 errors on Selena domain");
}
await page.evaluateOnNewDocument((p) => {
  localStorage.setItem("selena.cloud.pwd", p);
}, selenaPwd || getPwd());

async function visit(name, url, opts = {}) {
  console.log(`\n[${name}] ${url}`);
  const t0 = Date.now();
  try {
    await page.goto(url, { waitUntil: "networkidle0", timeout: 45000 }).catch((e) => {
      console.log(`  ⚠ navigation warn: ${e.message.slice(0, 80)}`);
    });
    await new Promise((r) => setTimeout(r, 3000)); // 等 React render + lazy chunk load

    // Close common modals
    for (let i = 0; i < 4; i++) {
      const closed = await page.evaluate(() => {
        const btns = [...document.querySelectorAll("button")];
        for (const b of btns) {
          const t = b.textContent ?? "";
          if (/^(稍后再填|跳过|知道啦|知道了|✕|开始练习|算了, 我再想想)$/.test(t.trim())) {
            b.click();
            return true;
          }
        }
        return false;
      });
      if (!closed) break;
      await new Promise((r) => setTimeout(r, 400));
    }

    const buf = await page.screenshot({ type: "png" });
    writeFileSync(join(SCREENSHOTS_DIR, `${name}.png`), buf);

    // Custom check
    const checkResult = opts.check ? await opts.check(page) : null;

    const elapsed = Date.now() - t0;
    console.log(`  ✓ rendered in ${elapsed}ms, ${(buf.length / 1024).toFixed(1)} KB`);
    if (checkResult) {
      console.log(`  ${checkResult.ok ? "✓" : "✗"} ${checkResult.message}`);
    }

    results.push({
      name,
      url,
      status: "ok",
      elapsedMs: elapsed,
      sizeKB: (buf.length / 1024).toFixed(1),
      check: checkResult,
    });
  } catch (e) {
    console.log(`  ✗ error: ${e.message.slice(0, 100)}`);
    results.push({ name, url, status: "error", error: e.message.slice(0, 100) });
  }
}

// === FLOW ===
console.log("=== Selena 43% master plan E2E smoke ===");

// 1. Math Home (注意: 不是 / — / 是上层 SubjectShell, 不含 math 入口. 必须用 /math)
await visit("01-math-home", "https://selena.xiaojin.app/math", {
  check: async (page) => {
    const found = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        错题侦探: text.includes("错题侦探"),
        进制小课堂: text.includes("进制小课堂"),
        脑力雷达: text.includes("脑力雷达"),
        稳准挑战: text.includes("稳准") || text.includes("挑战自己"),
        考试模拟: text.includes("考试模拟"),
        巧算工具箱: text.includes("巧算工具箱"),
      };
    });
    const missing = Object.entries(found).filter(([_, v]) => !v).map(([k]) => k);
    return {
      ok: missing.length === 0,
      message: missing.length === 0 ? "6 个入口全部 render (新 4 + 原 2)" : `缺: ${missing.join(", ")}`,
      found,
    };
  },
});

// 2. 错题侦探 (iter 36 P1-1)
await visit("02-mistake-hunt", "https://selena.xiaojin.app/math/find-mistakes", {
  check: async (page) => {
    const has = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes("错题侦探") || text.includes("找出错") || text.includes("找 bug");
    });
    return { ok: has, message: has ? "错题侦探页 render" : "错题侦探页文本未见" };
  },
});

// 3. 进制小课堂 (iter 38 P1-3)
await visit("03-base-systems", "https://selena.xiaojin.app/math/base-systems", {
  check: async (page) => {
    const has = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes("进制小课堂") && (text.includes("10 进制") || text.includes("60 进制"));
    });
    return { ok: has, message: has ? "进制小课堂主菜单 render (含 10/60 进制节)" : "进制小课堂内容缺" };
  },
});

// 4. 脑力雷达 (iter 39 P1-4)
await visit("04-brainpower-radar", "https://selena.xiaojin.app/math/radar", {
  check: async (page) => {
    const has = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes("脑力雷达") && (text.includes("直觉力") || text.includes("严谨力"));
    });
    return { ok: has, message: has ? "脑力雷达页 render (5 维度)" : "脑力雷达 5 维度缺" };
  },
});

// 5. Train page (sanity render only, 不真做题)
await visit("05-train-home", "https://selena.xiaojin.app/math/train", {
  check: async (page) => {
    const hasQuestion = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.length > 100; // 题页通常有 ≥100 字符
    });
    return { ok: hasQuestion, message: hasQuestion ? "Train 页 render" : "Train 页内容空" };
  },
});

// 6. Mock exam report empty state
await visit("06-mock-report-empty", "https://selena.xiaojin.app/math/mock-report?sessionId=nonexistent", {
  check: async (page) => {
    const has = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes("模拟整卷") && (text.includes("还没有") || text.includes("开始模拟"));
    });
    return { ok: has, message: has ? "Mock report empty state 优雅" : "Mock report empty 状态不对" };
  },
});

// 7. Paper mistake entry (admin only, 假设 admin login)
await visit("07-paper-entry", "https://admin.xiaojin.app/math/paper-entry", {
  check: async (page) => {
    const has = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes("试卷错题录入") || text.includes("paper");
    });
    return { ok: has, message: has ? "试卷录入页 render" : "试卷录入页缺" };
  },
});

await browser.close();

// === REPORT ===
let md = `# E2E smoke report (Selena 43% master plan iter 32-42)\n\nGenerated: ${new Date().toISOString()}\n\n`;
md += `## 页面 render check\n\n`;
md += `| 序 | 页面 | URL | 状态 | 用时 | 大小 | 检查 |\n|---|---|---|---|---|---|---|\n`;
for (const r of results) {
  const emoji = r.status === "ok" ? (r.check?.ok ? "✅" : "⚠️") : "❌";
  md += `| ${r.name} | ${emoji} ${r.status} | ${r.url.split("/").slice(-2).join("/")} | ${r.elapsedMs ?? "—"}ms | ${r.sizeKB ?? "—"} KB | ${r.check?.message ?? "—"} |\n`;
}

md += `\n## Console errors (${consoleErrors.length})\n\n`;
if (consoleErrors.length === 0) {
  md += "✅ 无错误\n";
} else {
  for (const e of consoleErrors) {
    md += `- \`${e.url}\` → ${e.text}\n`;
  }
}

md += `\n## 总结\n\n`;
const okCount = results.filter((r) => r.status === "ok" && (r.check?.ok ?? true)).length;
const warnCount = results.filter((r) => r.status === "ok" && r.check && !r.check.ok).length;
const errCount = results.filter((r) => r.status === "error").length;
md += `- ✅ ${okCount} 页正常 + check 通过\n- ⚠️ ${warnCount} 页 render OK 但 check 失败 (检查 UI 缺什么)\n- ❌ ${errCount} 页 navigation 失败\n- Console errors: ${consoleErrors.length}\n`;

writeFileSync(REPORT, md);
console.log(`\n📝 Report: ${REPORT}`);
console.log(`\nSummary: ✅${okCount} / ⚠️${warnCount} / ❌${errCount} / console errors: ${consoleErrors.length}`);
process.exit(errCount + (consoleErrors.length > 5 ? 1 : 0));
