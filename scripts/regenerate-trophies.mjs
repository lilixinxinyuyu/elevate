#!/usr/bin/env node
/**
 * scripts/regenerate-trophies.mjs — 直接调 production /api/generate/image 生成
 * trophy AI 图，落地到本地 /tmp/trophies/ 让人看图把关。
 *
 * 用法：
 *   APP_PASSWORD=xxx node scripts/regenerate-trophies.mjs --ids boss_first_pass,streak_keeper
 *   APP_PASSWORD=xxx node scripts/regenerate-trophies.mjs --missing      # 缺啥补啥（默认）
 *   APP_PASSWORD=xxx node scripts/regenerate-trophies.mjs --all          # 全集
 *
 * 输出：
 *   /tmp/trophies/<trophyImage_key>.png    每张本地落盘，让人 Read 视觉 review
 *   /tmp/trophies/_import.js               浏览器 console 一键 import 的 JS snippet
 *
 * 流程：
 *   1. esbuild 打包 src/lib/trophyImages.ts + allTrophies.ts → 临时 mjs
 *   2. 取 getAllTrophyMeta() 拿全集 + buildTrophyPrompt() 拿 prompt
 *   3. --missing 模式：先 fetch /api/sync/trophy-images 拿云端已有的 keys，diff
 *      （如果不可用则全部生成）
 *   4. 对每个目标 trophy，POST /api/generate/image 拿 image URL → 下载 → 写入 png
 *      并发 1（避免 token-plan 限流），单张 ~25s，15 张 ~6 min
 *   5. 输出 _import.js 让用户 console paste 完成入库 + 触发 cloud sync
 *
 * 安全：APP_PASSWORD 只从 env 读，不进 commit/log。
 */

import { build } from "esbuild";
import { writeFileSync, readFileSync, mkdirSync, existsSync, rmSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const OUT_DIR = "/tmp/trophies";

// ---------------------------------------------------------------------------
// CLI 参数
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const a = {
    mode: "missing", // missing | all | ids
    ids: [], // when mode=ids
    apiBase: process.env.ELEVATE_API_BASE || "https://selena-elevate.pages.dev",
    concurrency: 1, // 并发；token-plan 限流，1 最稳
    skipPng: false,
    // v0.31.7：默认 --push-d1，生成完直接 POST /api/sync/trophy-images
    // 用户刷新页面即同步到 IndexedDB（pullFromCloud 自动跑）。
    pushD1: true,
    // 压缩：512×512 jpeg q=85，~50KB/张（D1 单行 500KB 限制内 + AuthGate
    // pull 后客户端走 migrateCompressOversizedTrophyImages 兜底）
    compress: true,
  };
  for (let i = 2; i < argv.length; i++) {
    const x = argv[i];
    const next = argv[i + 1];
    switch (x) {
      case "--missing":
        a.mode = "missing";
        break;
      case "--all":
        a.mode = "all";
        break;
      case "--ids":
        a.mode = "ids";
        a.ids = (next || "").split(",").filter(Boolean);
        i++;
        break;
      case "--concurrency":
        a.concurrency = Math.max(1, Math.min(3, parseInt(next, 10) || 1));
        i++;
        break;
      case "--skip-png":
        a.skipPng = true;
        break;
      case "--no-push":
        a.pushD1 = false;
        break;
      case "--no-compress":
        a.compress = false;
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        if (x.startsWith("--")) die(`Unknown flag: ${x}`);
    }
  }
  if (!process.env.APP_PASSWORD) die("APP_PASSWORD env 必填（Cloudflare Pages 那个，调 /api/generate/image 用）");
  return a;
}

function printHelp() {
  console.log(`scripts/regenerate-trophies.mjs

用法：
  APP_PASSWORD=xxx node scripts/regenerate-trophies.mjs [mode] [opts]

mode（默认 --missing）:
  --missing            只生成 D1 上还没有的（默认；没法读 D1 时回退 --all）
  --all                全量重生成（覆盖现有）
  --ids X,Y,Z          指定 trophyImage key（如 math_boss_first_pass / math_streak_keeper_gold）

opts:
  --concurrency N      并发数 1-3，默认 1（token-plan 限流，3 容易 429）
  --skip-png           不写 png，仅打印 prompt（dry run）
  --no-push            不自动 POST /api/sync/trophy-images，默认 push
  --no-compress        不压缩到 512×512 jpeg q=85（默认压缩，单张 ~50KB）

env:
  APP_PASSWORD         Cloudflare Pages 的认证密码（必填）
  ELEVATE_API_BASE     默认 https://selena-elevate.pages.dev

输出：
  /tmp/trophies/<key>.png    每张图本地落盘
  /tmp/trophies/_import.js   浏览器 console paste 入库 + sync

跑完后流程：
  1. 在 /tmp/trophies 看图，不合格的改 src/lib/trophyImages.ts 的 motif
     → 重跑 --ids 那一枚
  2. 全合格后：cat /tmp/trophies/_import.js 复制粘贴到 selena 浏览器 console
`);
}

function die(msg) {
  console.error("✗", msg);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// esbuild 打包 + 拿 trophy meta + buildTrophyPrompt
// ---------------------------------------------------------------------------

async function loadTrophyHelpers() {
  const tmpFile = join(tmpdir(), `trophy-bundle-${Date.now()}.mjs`);
  await build({
    entryPoints: [join(PROJECT_ROOT, "scripts/_load-trophy-prompts.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: tmpFile,
    external: [],
    logLevel: "error",
  });
  const mod = await import(tmpFile);
  rmSync(tmpFile, { force: true });
  return { buildTrophyPrompt: mod.buildTrophyPrompt, getAllTrophyMeta: mod.getAllTrophyMeta };
}

// ---------------------------------------------------------------------------
// 调 API 生成
// ---------------------------------------------------------------------------

/**
 * v0.31.97：调 prod `/api/generate/image` —— 这是唯一可行路径。
 *
 * 原因（见 memory/token_plan_workflow.md）：
 *   - dashscope-intl Free Tier 没有 image 模型（/v1/images/generations 返 404，
 *     /api/v1/services/.../image-synthesis 报 InvalidParameter "Model not exist"）
 *   - token-plan image gen 走 /compatible-mode/v1/chat/completions（chat 风格），
 *     prod functions/api/generate/image.ts 已实现 4 model 顺序 walking 的兜底
 *   - 直接 curl token-plan 也行但要复刻整个 walking 逻辑，没必要重写
 *
 * 重试策略：402(quota)/429(rate)/5xx 都 retry，3 次指数退避。
 */
async function callImageApi(apiBase, prompt, maxRetries = 3) {
  const url = `${apiBase}/api/generate/image`;
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(20000, 4000 * 2 ** (attempt - 1));
      await new Promise((r) => setTimeout(r, backoff));
    }
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.APP_PASSWORD}`,
        },
        body: JSON.stringify({ prompt, size: "512*512", n: 1 }),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        const err = new Error(`API ${r.status}: ${txt.slice(0, 200)}`);
        // 5xx / no_model_worked / 网络抖动 → retry；4xx 业务错（含 401 quota）直接抛
        if (r.status >= 500 || /no_model_worked|http_error/.test(txt)) {
          lastErr = err;
          continue;
        }
        throw err;
      }
      const j = await r.json();
      if (!j.ok) {
        const err = new Error(`API ok=false: ${JSON.stringify(j).slice(0, 200)}`);
        if (/no_model_worked|http_error|QuotaExhausted/.test(JSON.stringify(j))) {
          lastErr = err;
          continue;
        }
        throw err;
      }
      const u = (j.urls && j.urls[0]) ?? null;
      if (!u) throw new Error("API 返回 ok=true 但无 urls");
      return { url: u, model: j.model, taskId: j.taskId };
    } catch (e) {
      lastErr = e;
      if (e instanceof Error && /fetch failed|ECONN|ETIMEDOUT|timeout/i.test(e.message)) {
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("retries exhausted");
}

async function downloadPng(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return buf;
}

// ---------------------------------------------------------------------------
// 压缩 PNG → JPEG（用系统 ImageMagick，512×512 q=85，~50KB/张）
// ---------------------------------------------------------------------------

function compressToJpeg(pngPath) {
  const jpgPath = pngPath.replace(/\.png$/, ".jpg");
  try {
    execSync(
      `magick "${pngPath}" -resize 512x512 -quality 85 -strip "${jpgPath}"`,
      { stdio: "ignore" },
    );
    return jpgPath;
  } catch (e) {
    console.warn(
      `  ⚠ compress failed (need ImageMagick \`magick\` in PATH): ${e instanceof Error ? e.message : e}`,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// 直接 POST 到 D1：用户刷新页面 pullFromCloud 自动拉到 IndexedDB
// ---------------------------------------------------------------------------

async function pushToD1(apiBase, okOnes) {
  const allRows = okOnes.map((r) => {
    const fp = r.jpg ?? r.png;
    const buf = readFileSync(fp);
    const ext = fp.endsWith(".jpg") ? "jpeg" : "png";
    return {
      trophyId: r.id,
      subjectId: r.id.startsWith("chinese_") ? "chinese" : "math",
      imageDataUrl: `data:image/${ext};base64,${buf.toString("base64")}`,
      prompt: r.prompt,
      model: r.model,
      sourceUrl: r.sourceUrl,
      generatedAt: Date.now(),
    };
  });
  let totalAccepted = 0;
  const allRejected = [];
  // /api/sync/trophy-images 限 30 行/批，但稳妥用 10
  for (let i = 0; i < allRows.length; i += 10) {
    const batch = allRows.slice(i, i + 10);
    const r = await fetch(`${apiBase}/api/sync/trophy-images`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.APP_PASSWORD}`,
      },
      body: JSON.stringify({ rows: batch }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`POST trophy-images ${r.status}: ${txt.slice(0, 200)}`);
    }
    const j = await r.json();
    totalAccepted += j.accepted ?? 0;
    if (j.rejected) allRejected.push(...j.rejected);
  }
  return { accepted: totalAccepted, rejected: allRejected };
}

// ---------------------------------------------------------------------------
// 拉云端已有 trophyImages 列表（D1 sync endpoint）
// ---------------------------------------------------------------------------

async function listExistingKeys(apiBase) {
  const url = `${apiBase}/api/sync/trophy-images`;
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.APP_PASSWORD}` },
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (Array.isArray(j.rows)) {
      return new Set(j.rows.map((x) => x.trophyId));
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 决定要生成哪些 trophy
// ---------------------------------------------------------------------------

function targetTrophies(args, allMeta, existing) {
  if (args.mode === "ids") {
    return allMeta.filter((t) => args.ids.includes(t.id));
  }
  if (args.mode === "all") {
    return allMeta;
  }
  // missing
  if (!existing) {
    console.warn("⚠ 拿不到云端 trophyImages 列表，回退 --all 模式");
    return allMeta;
  }
  return allMeta.filter((t) => !existing.has(t.id));
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  console.log("→ 打包 trophy 数据 + prompt 工具");
  const { buildTrophyPrompt, getAllTrophyMeta } = await loadTrophyHelpers();
  const allMeta = getAllTrophyMeta();
  console.log(`  全集 ${allMeta.length} 枚`);

  let existing = null;
  if (args.mode === "missing") {
    console.log("→ 拉云端已有 trophyImages keys");
    existing = await listExistingKeys(args.apiBase);
    console.log(`  云端已有 ${existing ? existing.size : "(无法读取)"} 枚`);
  }

  const targets = targetTrophies(args, allMeta, existing);
  console.log(`→ 本次要生成 ${targets.length} 枚`);
  if (targets.length === 0) {
    console.log("✓ 无需生成");
    return;
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const results = []; // {id, ok, png?, error?, prompt}
  let done = 0;

  for (const t of targets) {
    done++;
    const prompt = buildTrophyPrompt(t);
    process.stdout.write(`[${done}/${targets.length}] ${t.id} ... `);

    if (args.skipPng) {
      results.push({ id: t.id, ok: true, prompt, dryRun: true });
      console.log("(dry run, prompt only)");
      continue;
    }

    try {
      const { url, model } = await callImageApi(args.apiBase, prompt);
      const buf = await downloadPng(url);
      const png = join(OUT_DIR, `${t.id}.png`);
      writeFileSync(png, buf);
      // v0.31.7：压缩到 512×512 jpeg q=85（D1 单行 500KB 限制 + 浏览器 IndexedDB 不爆）
      let jpg = null;
      if (args.compress) {
        jpg = compressToJpeg(png);
      }
      results.push({ id: t.id, ok: true, png, jpg, prompt, model, sourceUrl: url });
      console.log(`✓ (${(buf.length / 1024).toFixed(0)} KB png${jpg ? ` → ${(statSync(jpg).size / 1024).toFixed(0)} KB jpg` : ""}, ${model})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ id: t.id, ok: false, error: msg, prompt });
      console.log(`✗ ${msg}`);
    }
  }

  // 写 _import.js（用压缩 jpg 如果有）
  const okOnes = results.filter((r) => r.ok && !r.dryRun);
  if (okOnes.length > 0) {
    const importJs = buildImportJs(okOnes);
    const importPath = join(OUT_DIR, "_import.js");
    writeFileSync(importPath, importJs);
    console.log(`\n→ 写好 ${importPath}`);
  }

  // v0.31.7：默认直接 push 到 D1 — 用户刷新页面就同步到 IndexedDB（pullFromCloud）
  if (args.pushD1 && okOnes.length > 0) {
    console.log(`\n→ POST /api/sync/trophy-images (${okOnes.length} 张)`);
    const r = await pushToD1(args.apiBase, okOnes);
    console.log(
      `  accepted=${r.accepted} rejected=${r.rejected.length}${r.rejected.length ? "  详: " + JSON.stringify(r.rejected) : ""}`,
    );
  }

  // 写 _summary.json
  const summary = {
    runAt: new Date().toISOString(),
    targets: targets.length,
    succeeded: okOnes.length,
    failed: results.filter((r) => !r.ok).length,
    items: results.map((r) => ({
      id: r.id,
      ok: r.ok,
      png: r.png,
      error: r.error,
    })),
  };
  writeFileSync(join(OUT_DIR, "_summary.json"), JSON.stringify(summary, null, 2));

  console.log(
    `\n✅ 完成。成功 ${okOnes.length} / 失败 ${results.length - okOnes.length}`,
  );
  console.log(`📋 下一步：`);
  console.log(`   1. 看 ${OUT_DIR}/*.png 视觉 review`);
  console.log(`   2. 不合格的：改 src/lib/trophyImages.ts 的 motif → 重跑：`);
  console.log(
    `      APP_PASSWORD=$APP_PASSWORD node scripts/regenerate-trophies.mjs --ids <ID1,ID2>`,
  );
  if (args.pushD1) {
    console.log(
      `   3. 已 push 到 D1。Selena 刷新 https://selena-elevate.pages.dev/math 即可（pullFromCloud 自动同步）。`,
    );
  } else {
    console.log(
      `   3. --no-push 模式：复制 ${OUT_DIR}/_import.js 到 selena 浏览器 console 粘贴`,
    );
  }
}

// ---------------------------------------------------------------------------
// 浏览器 console 一键 import 脚本
// ---------------------------------------------------------------------------

function buildImportJs(okOnes) {
  // 把每个 png 读进来转 base64 dataURL，嵌入 JS
  const items = okOnes.map((r) => {
    const buf = readFileSync(r.png);
    const b64 = buf.toString("base64");
    return {
      trophyId: r.id,
      imageDataUrl: `data:image/png;base64,${b64}`,
      prompt: r.prompt,
      model: r.model,
      sourceUrl: r.sourceUrl,
    };
  });

  return `// scripts/regenerate-trophies.mjs 输出 — 浏览器 console 一键 import
// 把下面整段粘到 selena 的 https://selena-elevate.pages.dev/math 的 DevTools console
// 跑完会写入 IndexedDB.trophyImages，下次刷新页面 + cloud sync 推到 D1
(async () => {
  const Dexie = (await import("https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.mjs")).default;
  const db = new Dexie("heping-math-trainer");
  await db.open();
  const items = ${JSON.stringify(items, null, 2)};
  let n = 0;
  for (const it of items) {
    const subjectId = it.trophyId.startsWith("chinese_") ? "chinese" : "math";
    await db.trophyImages.put({
      trophyId: it.trophyId,
      subjectId,
      imageDataUrl: it.imageDataUrl,
      sourceUrl: it.sourceUrl,
      prompt: it.prompt,
      model: it.model || "wan2.7-image-pro",
      generatedAt: Date.now(),
    });
    n++;
  }
  console.log(\`✓ wrote \${n} trophy images. 触发 cloud sync 把它们推到 D1...\`);
  // 触发 push（pushToCloud 是 src/db/cloudSync 里的，window 应该没暴露——刷新页面会自动 sync）
  console.log("→ 现在刷新页面，cloud sync 会把图推到 D1。");
})();
`;
}

main().catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
