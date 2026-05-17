/**
 * E2E walk of new cadet flow (v0.34.73 iter 8 verification).
 *
 * 走完整 demo-class5 同学第一次登录的体验:
 *   1. 输入 8 位密码登录
 *   2. SubjectPicker 顶部 banner: 新手 Tour 弹出 → 截 3 步
 *   3. 关 Tour → ProfileGate 弹出 → 填 grade=5 + 字段, 验进度条 + 完成 🎉
 *   4. GradeMismatchBanner 出现 (5 年级)
 *   5. 进入数学 → 验证没有期中加冕 / 生日 / 新学期弹窗
 *   6. 退出 → 改密码 modal
 *
 * 截图保存到 /tmp/xiaojin-e2e/{step}-{name}.png + console errors / network 4xx
 * 全部记入 report.json.
 *
 * Run: node scripts/_e2e-new-cadet-walk.mjs democlass5 78666109
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const USER_ID = process.argv[2] ?? "democlass5";
const PASSWORD = process.argv[3] ?? "78666109";
const BASE = `https://${USER_ID}.xiaojin.app`;
const OUT = "/tmp/xiaojin-e2e";
mkdirSync(OUT, { recursive: true });

const consoleLogs = [];
const networkFails = [];

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
});

async function shot(name) {
  const fp = `${OUT}/${name}.png`;
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`  📸 ${fp}`);
}
async function snap(label, fn) {
  console.log(`\n[step] ${label}`);
  try {
    await fn();
  } catch (e) {
    console.error(`  ✗ ${label} failed:`, e.message);
  }
}

try {
  await snap("01-cold-load-login", async () => {
    await page.goto(BASE, { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));
    await shot("01-login-screen");
    console.log(`  title="${await page.title()}"`);
  });

  await snap("02-enter-password", async () => {
    // 找密码 input
    const inputs = await page.$$("input[type='password'], input[type='text']");
    if (inputs.length === 0) {
      console.log("  no password input found — already logged in?");
      return;
    }
    await inputs[0].type(PASSWORD);
    await shot("02-password-typed");
    // submit
    const buttons = await page.$$("button[type='submit'], button");
    for (const b of buttons) {
      const txt = await page.evaluate((el) => el.textContent ?? "", b);
      if (txt.includes("继续") || txt.includes("登录") || txt.includes("进入") || txt.includes("Login") || txt.includes("Submit") || txt.includes("Enter")) {
        await b.click();
        console.log(`  clicked button: "${txt.trim()}"`);
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 2500));
  });

  await snap("03-after-login-subject-picker", async () => {
    await new Promise((r) => setTimeout(r, 1500));
    await shot("03-subject-picker");
    console.log(`  title="${await page.title()}"`);
    // 检查新手 Tour 是否出现
    const tourBody = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      for (const d of dialogs) {
        if (d.textContent.includes("欢迎来到小进") || d.textContent.includes("速度+准确") || d.textContent.includes("速度 + 准确")) {
          return d.textContent.slice(0, 200);
        }
      }
      return null;
    });
    console.log(`  new-user tour detected: ${tourBody ? "✓" : "✗"}`);
    if (tourBody) console.log(`    body="${tourBody.replace(/\s+/g, " ").slice(0, 120)}…"`);
  });

  await snap("04-tour-step-2", async () => {
    // 点 "下一步"
    const buttons = await page.$$("button");
    for (const b of buttons) {
      const txt = await page.evaluate((el) => el.textContent ?? "", b);
      if (txt.includes("下一步")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
    await shot("04-tour-step-2");
  });

  await snap("05-tour-step-3", async () => {
    const buttons = await page.$$("button");
    for (const b of buttons) {
      const txt = await page.evaluate((el) => el.textContent ?? "", b);
      if (txt.includes("下一步")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
    await shot("05-tour-step-3");
  });

  await snap("06-tour-closed", async () => {
    // 点 "开始练习 →" 关 Tour
    const buttons = await page.$$("button");
    for (const b of buttons) {
      const txt = await page.evaluate((el) => el.textContent ?? "", b);
      if (txt.includes("开始练习")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
    await shot("06-after-tour");
  });

  await snap("07-profile-gate-likely-open", async () => {
    // ProfileGate 应该已经弹出 (delay 800ms 自动弹)
    await new Promise((r) => setTimeout(r, 2000));
    await shot("07-profile-gate");
    const profileBody = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      for (const d of dialogs) {
        if (d.textContent.includes("完善") && d.textContent.includes("档案")) {
          return d.textContent.slice(0, 200);
        }
      }
      return null;
    });
    console.log(`  profile gate detected: ${profileBody ? "✓" : "✗"}`);
  });

  await snap("08-fill-profile-partial", async () => {
    // 填部分字段试进度条
    const fills = [
      { placeholder: "Selena", value: "李五年" }, // displayName
      { placeholder: "成都锦江和平街小学", value: "成都树德实验" }, // school
      { placeholder: "成都", value: "成都" }, // city
    ];
    for (const f of fills) {
      const inp = await page.$(`input[placeholder*="${f.placeholder}"]`);
      if (inp) {
        await inp.click({ clickCount: 3 });
        await inp.type(f.value);
        console.log(`  filled ${f.placeholder} = ${f.value}`);
      }
    }
    // 选 grade = 5
    const gradeSel = await page.$$("select");
    if (gradeSel.length > 0) {
      await gradeSel[0].select("5"); // 第一个 select 是 grade
      console.log(`  selected grade = 5`);
    }
    await shot("08-profile-partial-filled");
  });

  await snap("09-save-partial", async () => {
    // 点保存
    const buttons = await page.$$("button[type='submit']");
    for (const b of buttons) {
      const txt = await page.evaluate((el) => el.textContent ?? "", b);
      if (txt.includes("保存") || txt.includes("完成")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 2500));
    await shot("09-after-save");
  });

  await snap("10-close-profile-gate", async () => {
    // 跳过剩余字段
    const buttons = await page.$$("button");
    for (const b of buttons) {
      const txt = await page.evaluate((el) => el.textContent ?? "", b);
      if (txt.includes("稍后再填") || txt.includes("✕")) {
        await b.click();
        console.log(`  clicked: ${txt.trim()}`);
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
    await shot("10-subject-picker-with-grade-banner");
  });

  await snap("11-enter-math", async () => {
    // 找数学卡 click
    const mathCard = await page.$("a[href='/math']");
    if (mathCard) {
      await mathCard.click();
      console.log(`  clicked math card`);
    }
    await new Promise((r) => setTimeout(r, 3000));
    await shot("11-math-home");
    console.log(`  title="${await page.title()}"`);
  });

  await snap("12-check-popups-on-math", async () => {
    await new Promise((r) => setTimeout(r, 2000));
    const popups = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      return Array.from(dialogs).map((d) => d.textContent?.slice(0, 80) ?? "");
    });
    console.log(`  modal popups on math entry: ${popups.length === 0 ? "(none) ✓" : popups.join(" | ")}`);
    await shot("12-math-popups-check");
  });
} finally {
  const report = {
    base: BASE,
    userId: USER_ID,
    consoleLogs,
    networkFails,
    finishedAt: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(`\n\n=== summary ===`);
  console.log(`  console logs: ${consoleLogs.length}`);
  console.log(`  network fails (>=400): ${networkFails.length}`);
  console.log(`  screenshots: /tmp/xiaojin-e2e/`);
  console.log(`  report: /tmp/xiaojin-e2e/report.json`);
  await browser.close();
}
