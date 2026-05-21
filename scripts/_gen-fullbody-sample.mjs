#!/usr/bin/env node
/**
 * scripts/_gen-fullbody-sample.mjs — **一次性 QA 脚本** (非资产生成).
 *
 * 目的: 在真生产 (token-plan wan2.7-image-pro) 上验证 src/lib/fullBodyAvatar.ts 的
 * **全身立绘** prompt 真能出 **不裁剪的全身图** + navy bg 能被抠干净。这是 Hub 重做
 * (实时全身生成 + 抠图 + 场景融合) 最大的未知。半身款已验证 (base-12 + tier 立绘),
 * 但全身 prompt 的 anti-crop / 比例 / 抠图从没在真实环境跑过。
 *
 * 输出落 /tmp/fullbody-qa/ (throwaway, 不进 repo / 不进 public)。orchestrator 逐张
 * Read 视觉 QA: ① 全身完整 (头到脚, 腿/鞋没截) ② navy bg 抠净不啃黑发/深袍
 * ③ 画风跟 anchor 一致 (10 岁圆脸大眼, 不漂成大人)。
 *
 * 复用 _gen-tier-avatars.mjs 的 callImageApi (fc-bypass → token-plan) + python 抠图,
 * 但 prompt 常量从 src/lib/fullBodyAvatar.ts 1:1 抄来 (全身版)。
 *
 * 用法:
 *   APP_PASSWORD=$(grep ^APP_PASSWORD= ../.dev.vars|cut -d= -f2-) \
 *     node scripts/_gen-fullbody-sample.mjs
 *   (默认跑 3 张 risk-spanning 样本; 可传 <arch> <gender> <tier> 跑单张)
 */
import { writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT_DIR = "/tmp/fullbody-qa";

// ── 全身 prompt 常量 (1:1 copy from src/lib/fullBodyAvatar.ts) ──────────────
const FIXED_PREFIX_FULLBODY =
  "Anime cel-shading style, masterpiece quality, vibrant clean line-art. " +
  "FULL-BODY character standing, entire figure visible from head to feet (including legs and shoes), " +
  "slight dynamic 3/4 hero stance, looking at viewer, " +
  "dark navy background for transparency cutout (NOT white/transparent, very dark solid navy like #0a0e2c). " +
  "Background MUST be a completely plain empty solid navy fill — absolutely nothing else in the background: " +
  "no floating props, no scattered objects, no stars, no crystals, no books, no scenery, no decorations, no frame, no border. " +
  "All gear/accessories belong ON the character only, never floating around them.";

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

const NEGATIVE_FULLBODY =
  "cropped, close-up, half-body, only upper body, legs cut off, ugly, deformed face, extra limbs, " +
  "inconsistent proportions, different hair color, blonde hair, blue eyes, brown hair, freckles, " +
  "messy background, text, signature, watermark, mature features, teen idol, aged-up, adult proportions, " +
  "floating objects, background props, scattered items, floating stars, floating crystals, floating books, " +
  "background scenery, emblems, decorative background, frame, border, multiple objects";

const OUTFIT = {
  scholar: { school: "blue cardigan + notebook + pencil badge", district: "training jacket + math badge", city: "tactical belt pouch + compass", province: "half-cape + metal trim", country: "hero outfit + laurel wreath + star medal" },
  scientist: { school: "white lab coat + flask + safety goggles", district: "upgraded flask + measuring tool", city: "full lab suit + microscope", province: "scientist cape", country: "hero lab robe + glowing aura" },
  explorer: { school: "adventure vest + compass + map", district: "camping gear + binoculars", city: "full expedition team uniform", province: "captain coat + medals", country: "legendary explorer + golden laurel" },
  mage: { school: "wizard robe + wand + wizard hat", district: "advanced spellbook + star staff", city: "archmage robe + floating", province: "academy headmaster robe", country: "grand archmage + astral crown" },
  warrior: { school: "martial-arts gi + red headband + wooden sword", district: "training armor + advanced sword", city: "samurai armor set + real sword", province: "master robe + long sword", country: "legendary warrior + crown" },
  artist: { school: "apron + palette + paintbrush", district: "artist smock + work apron", city: "full studio outfit + easel", province: "master apron + golden palette", country: "legendary artist + laurel wreath" },
};

function buildFullBodyPrompt(archetype, gender, tier) {
  const outfit = OUTFIT[archetype]?.[tier] ?? OUTFIT[archetype]?.school ?? "school outfit";
  return (
    `${FIXED_PREFIX_FULLBODY} ${ANCHOR[gender]}. ` +
    `Outfit (RPG ${archetype}, ${tier} tier): ${outfit}. ` +
    `Negative: ${NEGATIVE_FULLBODY}.`
  );
}

// ── 调 prod image gen (fc-bypass → token-plan wan2.7-image-pro) ─────────────
async function callImageApi(apiBase, prompt, model = "wan2.7-image-pro", maxRetries = 3) {
  const url = `${apiBase}/api/generate/image`;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${process.env.APP_PASSWORD}` };
  const reqBody = JSON.stringify({ prompt, model, size: "1024*1024", n: 1 });
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(20000, 8000 * 2 ** (attempt - 1));
      console.log(`  ↻ retry ${attempt} in ${backoff / 1000}s ...`);
      await new Promise((r) => setTimeout(r, backoff));
    }
    try {
      const r = await fetch(url, { method: "POST", headers, body: reqBody });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        const err = new Error(`API ${r.status}: ${txt.slice(0, 200)}`);
        if (r.status >= 500 || /no_model_worked|http_error|timeout/.test(txt)) { lastErr = err; continue; }
        throw err;
      }
      const j = await r.json();
      if (!j.ok) throw new Error(`API ok=false: ${JSON.stringify(j).slice(0, 200)}`);
      if (j.provider === "fc-bypass" && typeof j.fcUrl === "string") {
        const fcR = await fetch(j.fcUrl, { method: "POST", headers, body: reqBody });
        if (!fcR.ok) {
          const txt = await fcR.text().catch(() => "");
          const err = new Error(`FC ${fcR.status}: ${txt.slice(0, 200)}`);
          if (fcR.status >= 500 || /no_model_worked|timeout|fetch_failed/.test(txt)) { lastErr = err; continue; }
          throw err;
        }
        const fcJ = await fcR.json();
        if (!fcJ.ok || !Array.isArray(fcJ.urls) || fcJ.urls.length === 0) {
          const err = new Error(`FC ok=false/no urls: ${JSON.stringify(fcJ).slice(0, 200)}`);
          if (/no_model_worked|timeout|fetch_failed/.test(JSON.stringify(fcJ))) { lastErr = err; continue; }
          throw err;
        }
        return { url: fcJ.urls[0], model: fcJ.model ?? model, provider: fcJ.provider };
      }
      if (Array.isArray(j.urls) && j.urls.length > 0) return { url: j.urls[0], model: j.model ?? model, provider: j.provider ?? "sync" };
      throw new Error(`API ok=true 但无 fcUrl/urls: ${JSON.stringify(j).slice(0, 200)}`);
    } catch (e) {
      lastErr = e;
      if (e instanceof Error && /fetch failed|ECONN|ETIMEDOUT|timeout/i.test(e.message)) continue;
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

// 全身款抠图: 不强制 768 方图 (全身是竖图), 保留原比例, 只 navy→透明 + bbox trim 统计.
const TRANSPARENCY_PY = `
import sys, cv2, numpy as np
src, dst, thr = sys.argv[1], sys.argv[2], int(sys.argv[3])
feather = 2
img = cv2.imread(src, cv2.IMREAD_COLOR)
if img is None:
    print("decode_failed", file=sys.stderr); sys.exit(2)
h, w = img.shape[:2]
lo = 6
bg = np.zeros((h, w), dtype=np.uint8)
inset = 5
seeds = [(inset, inset), (inset, w-1-inset), (h-1-inset, inset), (h-1-inset, w-1-inset)]
flood_flags = 8 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY
for cy, cx in seeds:
    b, g, r = [int(v) for v in img[cy, cx]]
    if b <= thr and g <= thr and r <= thr:
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
# bbox trim on alpha — 量化"全身占图比例", 判断有没有被裁/留白过多
alpha = bgra[:, :, 3]
ys, xs = np.where(alpha > 64)
if len(ys) == 0:
    print("EMPTY_AFTER_CUTOUT", file=sys.stderr); sys.exit(4)
y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
fig_h = (y1 - y0 + 1) / h
fig_w = (x1 - x0 + 1) / w
top_touch = y0 <= 2
bot_touch = y1 >= h - 3
cv2.imwrite(dst, bgra, [int(cv2.IMWRITE_PNG_COMPRESSION), 6])
bg_ratio = float((alpha < 64).sum()) / (h * w)
fg_ratio = float((alpha > 200).sum()) / (h * w)
print(f"{w}x{h} fig_h={fig_h*100:.0f}% fig_w={fig_w*100:.0f}% top_touch={top_touch} bot_touch={bot_touch} bg={bg_ratio*100:.0f}% fg={fg_ratio*100:.0f}%")
`;

function makeTransparent(rawBuf, dstPath, threshold = 70) {
  const tmpIn = join(tmpdir(), `fb-qa-raw-${Date.now()}.png`);
  writeFileSync(tmpIn, rawBuf);
  return execFileSync("python3", ["-c", TRANSPARENCY_PY, tmpIn, dstPath, String(threshold)], { encoding: "utf8" }).trim();
}

async function genOne(archetype, gender, tier, apiBase) {
  const prompt = buildFullBodyPrompt(archetype, gender, tier);
  const outName = `fullbody-${archetype}-${gender}-${tier}.png`;
  const outPath = join(OUT_DIR, outName);
  console.log(`\n=== ${archetype} × ${gender} × ${tier} ===`);
  const { url, model, provider } = await callImageApi(apiBase, prompt);
  console.log(`  ✓ gen ok (model=${model}, provider=${provider})`);
  const raw = await downloadBytes(url);
  console.log(`  ✓ downloaded ${(raw.length / 1024).toFixed(0)} KB`);
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const stats = makeTransparent(raw, outPath);
  const finalKb = (statSync(outPath).size / 1024).toFixed(0);
  console.log(`  ✓ cutout → ${outName} (${stats}, ${finalKb} KB)`);
  return { outPath, stats };
}

async function main() {
  const apiBase = process.env.ELEVATE_API_BASE || "https://selena.xiaojin.app";
  if (!process.env.APP_PASSWORD) {
    console.error("✗ APP_PASSWORD env 必填. APP_PASSWORD=$(grep ^APP_PASSWORD= ../.dev.vars|cut -d= -f2-)");
    process.exit(1);
  }
  const argv = process.argv.slice(2);
  // risk-spanning default: 轻底色 baseline / 深袍+冠最难抠最复杂 / 武士铠甲最杂
  const samples = argv.length >= 3
    ? [[argv[0], argv[1], argv[2]]]
    : [["scholar", "female", "school"], ["mage", "male", "country"], ["warrior", "female", "city"]];
  console.log(`全身立绘 QA — ${samples.length} 张 → ${OUT_DIR}/  (api=${apiBase})`);
  const results = [];
  for (const [a, g, t] of samples) {
    try { results.push(await genOne(a, g, t, apiBase)); }
    catch (e) { console.error(`  ✗ ${a}×${g}×${t}: ${e instanceof Error ? e.message : e}`); }
  }
  console.log(`\n✅ done. ${results.length}/${samples.length} ok. Read 这些图视觉 QA:`);
  results.forEach((r) => console.log(`   ${r.outPath}  [${r.stats}]`));
}

main().catch((e) => { console.error("\n✗", e instanceof Error ? e.message : e); process.exit(1); });
