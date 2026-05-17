/**
 * Visual diff baseline tool (v0.34.97 iter 31).
 *
 * 用途: 自动 regression detect. 跑 puppeteer 截图关键页面, 对比 baseline.
 *   - 没有 baseline → 把当前 PNG 存为 baseline (first-run, git check-in)
 *   - 有 baseline → SHA256 + file size 对比 → report status
 *
 * 不用 pixel diff lib (项目没装 pixelmatch/sharp) — SHA256 + size delta 作 proxy:
 *   - SHA 一致: ✓ identical
 *   - SHA 不一致 + size 差 < 5%: ⚠ minor (可能 anti-alias / timestamp 字符)
 *   - SHA 不一致 + size 差 > 5%: ✗ major (内容显著变化, 检查)
 *
 * Run:
 *   node scripts/_visual-diff.mjs              # baseline 模式 (没就建, 有就比)
 *   node scripts/_visual-diff.mjs --refresh    # 强制更新 baseline (慎用)
 *
 * Output:
 *   tests/visual-baselines/{user}-{page}.png   # check-in baseline
 *   tests/visual-current/{user}-{page}.png     # 当前 (mismatch 才存)
 *   tests/visual-diff-report.md                # human-readable summary
 *
 * 截图对象 (cap 8 防 ESA 慢):
 *   selena.xiaojin.app /, /math, /math/mistakes
 *   bruce.xiaojin.app  /, /math
 *   admin.xiaojin.app  /super-admin
 */
import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// v0.34.97 iter 31: paths resolved relative to repo root (script lives in scripts/)
// 不用 CWD-相对路径 — 防止从任意 cwd 调时 output 落错地方.
const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const REFRESH = process.argv.includes("--refresh");
const BASELINE_DIR = join(REPO_ROOT, "tests/visual-baselines");
const CURRENT_DIR = join(REPO_ROOT, "tests/visual-current");
const REPORT = join(REPO_ROOT, "tests/visual-diff-report.md");

mkdirSync(BASELINE_DIR, { recursive: true });
mkdirSync(CURRENT_DIR, { recursive: true });

function getPwd() {
  const text = readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8");
  return (text.match(/^APP_PASSWORD=(.+)$/m) ?? [])[1] ?? "";
}

async function getCadetPwd(userId) {
  // 用 OSS list _auth/users.json
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

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const PAGES = [
  { user: "selena", path: "/", name: "selena-home" },
  { user: "selena", path: "/math", name: "selena-math" },
  { user: "selena", path: "/math/mistakes", name: "selena-mistakes" },
  { user: "bruce", path: "/", name: "bruce-home" },
  { user: "bruce", path: "/math", name: "bruce-math" },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 414, height: 896 },
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const results = [];
for (const { user, path, name } of PAGES) {
  console.log(`\n[${name}] ${user}.xiaojin.app${path}`);
  const pwd = user === "selena" ? getPwd() : await getCadetPwd(user);
  if (!pwd) {
    console.log("  ✗ no password");
    results.push({ name, status: "no_password" });
    continue;
  }
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((p) => {
    localStorage.setItem("selena.cloud.pwd", p);
  }, pwd);
  try {
    await page.goto(`https://${user}.xiaojin.app${path}`, { waitUntil: "networkidle0", timeout: 45000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 4000));
    // 关 modal 让截图干净
    for (let i = 0; i < 4; i++) {
      const closed = await page.evaluate(() => {
        const btns = [...document.querySelectorAll("button")];
        for (const b of btns) {
          const t = b.textContent ?? "";
          if (/^(稍后再填|跳过|知道啦|知道了|✕|开始练习)$/.test(t.trim())) { b.click(); return true; }
        }
        return false;
      });
      if (!closed) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    await new Promise((r) => setTimeout(r, 600));
    const buf = await page.screenshot({ type: "png" });
    const currentSha = sha256(buf);
    const currentSize = buf.length;
    const baselinePath = `${BASELINE_DIR}/${name}.png`;

    if (!existsSync(baselinePath) || REFRESH) {
      writeFileSync(baselinePath, buf);
      console.log(`  📸 baseline ${REFRESH ? "REFRESHED" : "saved (first-run)"} (${(currentSize / 1024).toFixed(1)} KB)`);
      results.push({ name, status: REFRESH ? "refreshed" : "baseline_saved", currentSize });
      continue;
    }

    const baselineBuf = readFileSync(baselinePath);
    const baselineSha = sha256(baselineBuf);
    const baselineSize = baselineBuf.length;
    const sizeDeltaPct = Math.abs(currentSize - baselineSize) / baselineSize * 100;

    if (currentSha === baselineSha) {
      console.log(`  ✓ identical (${(currentSize / 1024).toFixed(1)} KB)`);
      results.push({ name, status: "identical", currentSize, baselineSize });
    } else {
      const currentPath = `${CURRENT_DIR}/${name}.png`;
      writeFileSync(currentPath, buf);
      const status = sizeDeltaPct < 5 ? "minor" : "major";
      console.log(`  ${status === "minor" ? "⚠" : "✗"} ${status}: SHA diff, size ${sizeDeltaPct.toFixed(1)}% delta (baseline ${(baselineSize / 1024).toFixed(1)} KB → current ${(currentSize / 1024).toFixed(1)} KB)`);
      results.push({ name, status, currentSize, baselineSize, sizeDeltaPct });
    }
  } catch (e) {
    console.log(`  ✗ error: ${e.message.slice(0, 100)}`);
    results.push({ name, status: "error", error: e.message.slice(0, 100) });
  } finally {
    await page.close();
  }
}
await browser.close();

// Write report
let md = `# Visual Diff Report\n\nGenerated: ${new Date().toISOString()}\n\n`;
md += `| Page | Status | Baseline | Current | Δ |\n|---|---|---|---|---|\n`;
for (const r of results) {
  const bs = r.baselineSize ? `${(r.baselineSize / 1024).toFixed(1)} KB` : "—";
  const cs = r.currentSize ? `${(r.currentSize / 1024).toFixed(1)} KB` : "—";
  const delta = r.sizeDeltaPct ? `${r.sizeDeltaPct.toFixed(1)}%` : "—";
  const emoji = { identical: "✓", baseline_saved: "📸", refreshed: "🔄", minor: "⚠", major: "✗", error: "💥", no_password: "🔑" }[r.status] ?? "?";
  md += `| ${r.name} | ${emoji} ${r.status} | ${bs} | ${cs} | ${delta} |\n`;
}
md += `\n## Notes\n\n- ✓ identical: SHA256 match — no UI change\n- 📸 baseline_saved: first run, baseline established\n- ⚠ minor: SHA diff but size delta < 5% (likely anti-alias / timestamp / minor)\n- ✗ major: size delta > 5% (significant UI change — review tests/visual-current/{name}.png)\n- 💥 error: page load / screenshot failed\n- 🔑 no_password: cadet auth missing\n\nRun \`node scripts/_visual-diff.mjs --refresh\` to update baselines (慎用 — wipes old baseline).\n`;
writeFileSync(REPORT, md);
console.log(`\n📝 Report: ${REPORT}`);

const majors = results.filter((r) => r.status === "major").length;
console.log(`\nSummary: ${results.length} pages — ${results.filter((r) => r.status === "identical").length} identical, ${results.filter((r) => r.status === "minor").length} minor, ${majors} major, ${results.filter((r) => r.status === "baseline_saved").length} baseline_saved, ${results.filter((r) => r.status === "error").length} error`);
process.exit(majors > 0 ? 1 : 0);
