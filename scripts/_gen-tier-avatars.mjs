#!/usr/bin/env node
/**
 * scripts/_gen-tier-avatars.mjs — 生成 **tier 立绘** (per archetype × gender × tier)
 * 的预生成静态资产, 落到 public/character/base-<arch>-<gender>-<tier>-v1.png.
 *
 * 跟现有 12 张 Lv1 base (base-<arch>-<gender>-school-v1.png) 同款:
 *   - anime cel-shading 半身立绘 + 深 navy bg (#0a0e2c)
 *   - CV flood-fill 把深 bg 抠成透明 → 768×768 RGBA PNG
 *   - tier 之间唯一区别是 outfit (Character Bible 的 "Outfit per archetype × tier" 表)
 *
 * **图源**: 当前 production image gen — POST /api/generate/image (ESA, fc-bypass)
 *   → client 拿 fcUrl → POST fcUrl → token-plan **wan2.7-image-pro** (月订阅, 已付费).
 *   绝不走 BAILIAN / dashscope 直连按量付费 (FC 服务端只配 TOKEN_PLAN_CN, 见
 *   aliyun-deploy/fc-image-gen/index.mjs). 兼容老 CF Pages 直接返 urls 的 sync shape.
 *
 * 用法:
 *   APP_PASSWORD=xxx node scripts/_gen-tier-avatars.mjs <archetype> <gender> <tier>
 *   APP_PASSWORD=xxx node scripts/_gen-tier-avatars.mjs scholar female district
 *
 *   单 (arch,gender,tier) → 1 张图. 想跑全 48 张以后再加 --all (此脚本预留 loop
 *   helper genOne(), 不要一次跑全集 — 费 quota + 要逐张视觉 QA).
 *
 *   --dry-run            只打印 prompt, 不调 API / 不写文件
 *   --threshold N        CV 深 bg 阈值 (BGR 各通道 ≤ N 视为 bg, 默认 70)
 *   --api-base URL       默认 https://selena.xiaojin.app (当前 ESA production)
 *
 * env:
 *   APP_PASSWORD         认证密码 (从 ../.dev.vars 读, 见 memory). 必填.
 *   ELEVATE_API_BASE     覆盖 --api-base
 *
 * 安全: APP_PASSWORD 只从 env 读, 不进 commit/log.
 */

import { writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const OUT_DIR = join(PROJECT_ROOT, "public", "character");

const ARCHETYPES = ["scholar", "scientist", "explorer", "mage", "warrior", "artist"];
const GENDERS = ["female", "male"];
// 跟 src/core/tiers.ts TIERS 顺序 1:1 (school..country)
const TIERS = ["school", "district", "city", "province", "country"];

// ---------------------------------------------------------------------------
// Character Bible — 移植自 docs/character-growth-progress-pause-2026-05-19.md
// (Wan prompt anchor). 每张 prompt = fixed prefix + gender anchor + tier outfit + negative.
// ---------------------------------------------------------------------------

// "Fixed prefix" (每张 prompt) — 锁画风 + 深 navy bg 便于 CV 抠图.
const FIXED_PREFIX =
  "Anime cel-shading style, masterpiece quality, vibrant clean line-art. " +
  "Half-body portrait centered, looking at viewer, dark navy background for " +
  "transparency cutout (NOT white/transparent, very dark solid navy like #0a0e2c).";

// Gender anchor — 锁人物 (短发圆脸大眼 10 岁), 跨 tier 保持一致.
const ANCHOR = {
  female:
    "10-year-old cute Chinese girl, short black bob hair (chin-length, neat bangs across forehead), " +
    "large amber-brown eyes (bright and warm), gentle confident smile, round soft face, " +
    "slim youthful build, healthy fair skin",
  male:
    "10-year-old cute Chinese boy, short black hair (slightly tousled, neat bangs across forehead), " +
    "large bright amber-brown eyes, gentle confident smile, round soft face, " +
    "slim youthful build, healthy fair skin",
};

// "Negative" (每张) — 防漂移 (发色/眼色/年龄/性化/制服 fetish 等).
const NEGATIVE =
  "multiple views, full body, ugly, deformed face, inconsistent proportions, " +
  "different hair color, blonde hair, blue eyes, brown hair, freckles, messy " +
  "background, text, signature, watermark, NSFW, mature features, teen idol, " +
  "aged-up, busty, anime sexualized, school uniform fetish, sailor uniform";

// "Outfit per archetype × tier" 表 (中文 outfit 描述, AI 能吃中文).
// 行 = archetype, 列 = tier (school/district/city/province/country).
const OUTFIT = {
  scholar: {
    school: "蓝开衫 + 笔记本 + 铅笔徽章",
    district: "训练夹克 + 数学徽章",
    city: "战术腰包 + 罗盘",
    province: "半披风 + 金属边",
    country: "hero 套装 + 桂冠 + 星章",
  },
  scientist: {
    school: "白大褂 + 烧瓶 + 护目镜",
    district: "增强版烧瓶 + 测量仪",
    city: "全套实验服 + 显微镜",
    province: "科学家披风",
    country: "hero 实验袍 + 光环",
  },
  explorer: {
    school: "冒险背心 + 罗盘 + 地图",
    district: "帐篷器具 + 望远镜",
    city: "完整探险队制服",
    province: "队长袍 + 勋章",
    country: "传奇探险家 + 金桂冠",
  },
  mage: {
    school: "巫师袍 + 魔杖 + 巫师帽",
    district: "进阶魔法书 + 星杖",
    city: "大法师袍 + 飞翔",
    province: "学院掌门袍",
    country: "大法师 + 星象冠",
  },
  warrior: {
    school: "道服 + 红头带 + 木剑",
    district: "训练胴 + 进阶剑",
    city: "武士套装 + 真剑",
    province: "大师袍 + 长剑",
    country: "传奇武士 + 头冠",
  },
  artist: {
    school: "围裙 + 调色板 + 画笔",
    district: "艺术家工作服",
    city: "完整画室装 + 画架",
    province: "大师围裙 + 金色调色板",
    country: "传奇艺术家 + 桂冠",
  },
};

/**
 * 拼出一张 tier 立绘的完整 prompt:
 *   fixed prefix + gender anchor + "Outfit: <tier outfit>" + "Negative: <neg>"
 */
function buildPrompt(archetype, gender, tier) {
  const anchor = ANCHOR[gender];
  const outfit = OUTFIT[archetype]?.[tier];
  if (!anchor) throw new Error(`unknown gender: ${gender}`);
  if (!outfit) throw new Error(`no outfit for ${archetype} × ${tier}`);
  return (
    `${FIXED_PREFIX} ${anchor}. ` +
    `Outfit (RPG ${archetype}, ${tier} tier): ${outfit}. ` +
    `Negative: ${NEGATIVE}.`
  );
}

// ---------------------------------------------------------------------------
// 调 production image gen (fc-bypass → token-plan wan2.7-image-pro)
// ---------------------------------------------------------------------------

/**
 * POST /api/generate/image (ESA). 当前 production 返 { ok, fcUrl, provider:"fc-bypass" }
 * → 再 POST fcUrl 拿 { ok, urls, model, provider:"token-plan-cn" }.
 * 兼容老 CF Pages sync shape (直接返 { ok, urls }).
 *
 * 重试: 5xx / no_model_worked / timeout / fetch_failed → retry, 否则抛.
 */
async function callImageApi(apiBase, prompt, model = "wan2.7-image-pro", maxRetries = 3) {
  const url = `${apiBase}/api/generate/image`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.APP_PASSWORD}`,
  };
  const reqBody = JSON.stringify({ prompt, model, size: "1024*1024", n: 1 });
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(20000, 8000 * 2 ** (attempt - 1)); // 8s,16s,20s
      console.log(`  ↻ retry ${attempt} in ${backoff / 1000}s ...`);
      await new Promise((r) => setTimeout(r, backoff));
    }
    try {
      const r = await fetch(url, { method: "POST", headers, body: reqBody });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        const err = new Error(`API ${r.status}: ${txt.slice(0, 200)}`);
        if (r.status >= 500 || /no_model_worked|http_error|timeout/.test(txt)) {
          lastErr = err;
          continue;
        }
        throw err;
      }
      const j = await r.json();
      if (!j.ok) throw new Error(`API ok=false: ${JSON.stringify(j).slice(0, 200)}`);

      // 路径 1: fc-bypass (当前 ESA production) — client 再 POST fcUrl.
      if (j.provider === "fc-bypass" && typeof j.fcUrl === "string") {
        const fcR = await fetch(j.fcUrl, { method: "POST", headers, body: reqBody });
        if (!fcR.ok) {
          const txt = await fcR.text().catch(() => "");
          const err = new Error(`FC ${fcR.status}: ${txt.slice(0, 200)}`);
          if (fcR.status >= 500 || /no_model_worked|timeout|fetch_failed/.test(txt)) {
            lastErr = err;
            continue;
          }
          throw err;
        }
        const fcJ = await fcR.json();
        if (!fcJ.ok || !Array.isArray(fcJ.urls) || fcJ.urls.length === 0) {
          const err = new Error(`FC ok=false/no urls: ${JSON.stringify(fcJ).slice(0, 200)}`);
          if (/no_model_worked|timeout|fetch_failed/.test(JSON.stringify(fcJ))) {
            lastErr = err;
            continue;
          }
          throw err;
        }
        return { url: fcJ.urls[0], model: fcJ.model ?? model, provider: fcJ.provider };
      }

      // 路径 2: 老 sync (CF Pages) — 直接返 urls.
      if (Array.isArray(j.urls) && j.urls.length > 0) {
        return { url: j.urls[0], model: j.model ?? model, provider: j.provider ?? "sync" };
      }
      throw new Error(`API ok=true 但无 fcUrl/urls: ${JSON.stringify(j).slice(0, 200)}`);
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

async function downloadBytes(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// ---------------------------------------------------------------------------
// CV 抠图: 深 navy bg → 透明 (768×768 RGBA), 跟 base-12 同款.
// 镜像 scripts/_make-trophy-transparent-v2.py 的 remove_dark_bg (corner flood-fill),
// inline 成 python3 heredoc 让脚本自包含 (cv2 + numpy 已装, 见 verify).
// ---------------------------------------------------------------------------

const TRANSPARENCY_PY = `
import sys, cv2, numpy as np
src, dst, thr = sys.argv[1], sys.argv[2], int(sys.argv[3])
out_size = 768            # 跟现有 base-<arch>-<gender>-school-v1.png 一致
feather = 2

img = cv2.imread(src, cv2.IMREAD_COLOR)
if img is None:
    print("decode_failed", file=sys.stderr); sys.exit(2)
h, w = img.shape[:2]

# 关键修复 (pause doc caveat #1): 在**彩色图**上做 corner flood-fill, per-channel 小容差
# lo. 之前在二值 near_dark mask 上 flood (容差对二值无意义) → navy bg + 黑发同属
# near_dark 且空间连通 → 把黑发也抠掉变白。彩色图小容差: navy(B≈44) 与黑发(B≈10) 在
# B 通道差 ~34 >> lo, flood 到发际就停, 保住黑发。base-12 sweet spot lo≈5 (个别 bg 偏移
# 需 lo≈12); 取 6 兼顾去净 navy + 不啃黑发。
lo = 6
bg = np.zeros((h, w), dtype=np.uint8)
inset = 5
seeds = [(inset, inset), (inset, w-1-inset), (h-1-inset, inset), (h-1-inset, w-1-inset)]
flood_flags = 8 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY  # neighbor-diff, mask 填 255
for cy, cx in seeds:
    b, g, r = [int(v) for v in img[cy, cx]]
    if b <= thr and g <= thr and r <= thr:  # 仅从暗角(navy) seed, 不从前景 seed
        ff = np.zeros((h+2, w+2), dtype=np.uint8)
        cv2.floodFill(img.copy(), ff, (cx, cy), 0, (lo, lo, lo), (lo, lo, lo), flood_flags)
        bg = np.maximum(bg, ff[1:h+1, 1:w+1])

if feather > 0:
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (feather*2+1, feather*2+1))
    bg = cv2.erode(bg, k, iterations=1)

bgra = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
bgra[:, :, 3] = 255 - bg
if feather > 0:
    bgra[:, :, 3] = cv2.GaussianBlur(bgra[:, :, 3], (feather*2+1, feather*2+1), 0)

if max(h, w) != out_size:
    scale = out_size / max(h, w)
    bgra = cv2.resize(bgra, (int(round(w*scale)), int(round(h*scale))), interpolation=cv2.INTER_AREA)

ok = cv2.imwrite(dst, bgra, [int(cv2.IMWRITE_PNG_COMPRESSION), 6])
if not ok:
    print("encode_failed", file=sys.stderr); sys.exit(3)

alpha = bgra[:, :, 3]
hh, ww = bgra.shape[:2]
bg_ratio = float((alpha < 64).sum()) / (hh * ww)
fg_ratio = float((alpha > 200).sum()) / (hh * ww)
print(f"{ww}x{hh} bg={bg_ratio*100:.0f}% fg={fg_ratio*100:.0f}%")
`;

/** raw bytes (深 bg PNG) → 透明 RGBA PNG 写到 dstPath. 返 CV 统计字符串. */
function makeTransparent(rawBuf, dstPath, threshold) {
  const tmpIn = join(tmpdir(), `tier-avatar-raw-${Date.now()}.png`);
  writeFileSync(tmpIn, rawBuf);
  const out = execFileSync(
    "python3",
    ["-c", TRANSPARENCY_PY, tmpIn, dstPath, String(threshold)],
    { encoding: "utf8" },
  );
  return out.trim();
}

// ---------------------------------------------------------------------------
// genOne: 生成单张 (arch,gender,tier) → public/character/base-<a>-<g>-<t>-v1.png
//   loop helper — 全 48 张以后可以 for-loop 调它, 但本脚本默认只跑 1 张.
// ---------------------------------------------------------------------------

async function genOne(archetype, gender, tier, opts) {
  const prompt = buildPrompt(archetype, gender, tier);
  const outName = `base-${archetype}-${gender}-${tier}-v1.png`;
  const outPath = join(OUT_DIR, outName);

  console.log(`\n=== ${archetype} × ${gender} × ${tier} ===`);
  console.log(`prompt:\n${prompt}\n`);

  if (opts.dryRun) {
    console.log("(dry-run: 不调 API / 不写文件)");
    return { ok: true, dryRun: true, prompt, outPath };
  }

  console.log(`→ POST ${opts.apiBase}/api/generate/image (token-plan wan2.7-image-pro)`);
  const { url, model, provider } = await callImageApi(opts.apiBase, prompt);
  console.log(`  ✓ gen ok (model=${model}, provider=${provider})`);

  const raw = await downloadBytes(url);
  console.log(`  ✓ downloaded ${(raw.length / 1024).toFixed(0)} KB`);

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const stats = makeTransparent(raw, outPath, opts.threshold);
  const finalKb = (statSync(outPath).size / 1024).toFixed(0);
  console.log(`  ✓ CV transparent → ${outName} (${stats}, ${finalKb} KB)`);

  return { ok: true, prompt, outPath, model, provider, stats, sourceUrl: url };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    threshold: 70,
    apiBase: process.env.ELEVATE_API_BASE || "https://selena.xiaojin.app",
    positional: [],
  };
  for (let i = 2; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--dry-run") opts.dryRun = true;
    else if (x === "--threshold") opts.threshold = parseInt(argv[++i], 10) || 70;
    else if (x === "--api-base") opts.apiBase = argv[++i];
    else if (x === "-h" || x === "--help") { printHelp(); process.exit(0); }
    else if (x.startsWith("--")) die(`Unknown flag: ${x}`);
    else opts.positional.push(x);
  }
  return opts;
}

function printHelp() {
  console.log(`scripts/_gen-tier-avatars.mjs

用法:
  APP_PASSWORD=xxx node scripts/_gen-tier-avatars.mjs <archetype> <gender> <tier>

archetype: ${ARCHETYPES.join(" | ")}
gender:    ${GENDERS.join(" | ")}
tier:      ${TIERS.join(" | ")}

opts:
  --dry-run        只打印 prompt
  --threshold N    CV 深 bg 阈值 (默认 70)
  --api-base URL   默认 https://selena.xiaojin.app

env:
  APP_PASSWORD     必填 (从 ../.dev.vars 读)

输出:
  public/character/base-<archetype>-<gender>-<tier>-v1.png  (768×768 RGBA)
`);
}

function die(msg) {
  console.error("✗", msg);
  process.exit(1);
}

async function main() {
  const opts = parseArgs(process.argv);
  const [archetype, gender, tier] = opts.positional;

  if (!archetype || !gender || !tier) {
    printHelp();
    die("需要 3 个位置参数: <archetype> <gender> <tier>");
  }
  if (!ARCHETYPES.includes(archetype)) die(`bad archetype "${archetype}" (要 ${ARCHETYPES.join("/")})`);
  if (!GENDERS.includes(gender)) die(`bad gender "${gender}" (要 ${GENDERS.join("/")})`);
  if (!TIERS.includes(tier)) die(`bad tier "${tier}" (要 ${TIERS.join("/")})`);
  if (!opts.dryRun && !process.env.APP_PASSWORD) {
    die("APP_PASSWORD env 必填. 前缀: APP_PASSWORD=$(grep ^APP_PASSWORD= ../.dev.vars|cut -d= -f2-)");
  }

  const res = await genOne(archetype, gender, tier, opts);

  if (res.dryRun) {
    console.log("\n✅ dry-run 完成.");
  } else {
    console.log(`\n✅ 完成. → ${res.outPath}`);
    console.log("📋 下一步: orchestrator 视觉 QA 这张图; 合格后把该 tier id 加进");
    console.log("   src/lib/characterChoice.ts 的 AVAILABLE_AVATAR_TIERS, 再 ship.");
  }
}

main().catch((e) => {
  console.error("\n✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
