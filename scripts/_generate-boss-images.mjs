#!/usr/bin/env node
/**
 * 一次性运维：生成 6 单元 boss + 1 期末 boss 的怪兽插画。
 *
 * 模型：默认走 token-plan 优先（wan2.7-image-pro），失败 fallback。
 * 存储：trophyId = "math_boss_<unitId>" 写到 D1 via /api/sync/trophy-images
 * 客户端用 useTrophyImage("math_boss_<unitId>") 读取，回退 emoji。
 *
 * 自身 quality gate：每张生图后会下载 base64 + 检测大小，<5KB 视为失败重试。
 * 中途某张失败：等待 30s 后重试，最多 3 次。最终失败的留 emoji。
 *
 * 用法：APP_PASSWORD=... node scripts/_generate-boss-images.mjs
 */

import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PWD = process.env.APP_PASSWORD;
if (!PWD) { console.error("APP_PASSWORD env required"); process.exit(1); }
const PROD = "https://selena-elevate.pages.dev";

// 7 boss prompts — 风格统一：可爱卡通、儿童友好、数学主题、清晰主体居中、白底
const BOSSES = [
  {
    unitId: "G4B_U1_DECIMAL_ADD_SUB",
    name: "小数浪潮怪",
    prompt:
      "Cute cartoon ocean wave monster, friendly big googly eyes, body shaped like a curling tidal wave, glowing decimal points (.) sparkling on the crest like blue jewels, splashing water droplets shaped as small numbers around it, vibrant cyan and turquoise palette, mischievous toothy smile, kawaii children's illustration style, soft outline, square 1:1 composition, clean white background, centered subject, no text",
  },
  {
    unitId: "G4B_U2_TRI_QUAD",
    name: "三角魔兽",
    prompt:
      "Cute cartoon geometric monster made of intersecting triangles and quadrilaterals, friendly cartoon eyes, sharp angles softened with rounded corners, a wooden compass strapped on its back, bold crimson red and warm orange palette with golden geometric outlines, playful but slightly mischievous expression, kawaii children's illustration style, soft outline, square 1:1 composition, clean white background, centered subject, no text",
  },
  {
    unitId: "G4B_U3_DECIMAL_MULTIPLY",
    name: "倍数巨人",
    prompt:
      "Cute cartoon gentle giant with rounded cheeks, body covered in glowing multiplication × symbols like tattoos, holding two small boulders shaped like decimal numbers, deep purple and shimmering gold palette, big friendly smile, slightly bashful look, kawaii children's illustration style, soft outline, square 1:1 composition, clean white background, centered subject, no text",
  },
  {
    unitId: "G4B_U4_OBSERVE_OBJECTS",
    name: "视角恶魔",
    prompt:
      "Cute cartoon three-eyed creature, each eye reflects a different geometric view (front/top/side) of a translucent 3D cube floating around it, friendly mischievous expression with a small fang, mid purple palette with bright cyan accents, holding a small magnifying glass, kawaii children's illustration style, soft outline, square 1:1 composition, clean white background, centered subject, no text",
  },
  {
    unitId: "G4B_U5_EQUATIONS",
    name: "平衡魔王",
    prompt:
      "Cute cartoon balance-scale wizard creature holding a giant ornate balance scale, the two pans hold floating x and = symbols glowing softly, golden crown with a question-mark gem, deep royal purple and gold palette, friendly slightly mischievous smile, kawaii children's illustration style, soft outline, square 1:1 composition, clean white background, centered subject, no text",
  },
  {
    unitId: "G4B_U6_DATA",
    name: "统计巨怪",
    prompt:
      "Cute cartoon troll character whose body is made of stacked colorful bar chart bars, line chart squiggle eyebrows, holding a clipboard displaying a tiny pie chart, vibrant teal + warm yellow + soft pink palette, friendly toothy smile, kawaii children's illustration style, soft outline, square 1:1 composition, clean white background, centered subject, no text",
  },
  {
    unitId: "FINAL",
    name: "数学大魔王",
    prompt:
      "Majestic cute cartoon math king with imposing tall crown, regal robes embroidered with arithmetic symbols (+, -, ×, ÷, =, π), holding a scepter topped with the integral symbol ∫, deep crimson red and shimmering gold palette with subtle starburst aura behind, intimidating yet still friendly smile showing one fang, final-boss vibe but kawaii children's illustration style, soft outline, square 1:1 composition, clean white background, centered subject, no text",
  },
];

async function callImageApi(prompt, modelHint) {
  const body = { prompt, size: "512*512", n: 1 };
  if (modelHint) body.model = modelHint;
  const r = await fetch(`${PROD}/api/generate/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${PWD}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`image api ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  if (!j.ok || !Array.isArray(j.urls) || !j.urls[0]) throw new Error(`no urls: ${JSON.stringify(j).slice(0,200)}`);
  return { url: j.urls[0], model: j.model };
}

// 压缩到 JPEG ≤ 200KB（D1 单参数 SQL bind 上限大约 ~1MB，trophy-images 表
// 实测 ~30KB/张是常态）。原 PNG 通常 5-7MB，压缩后 80-120KB。
const SCRATCH_DIR = join(tmpdir(), `boss-img-${process.pid}`);
mkdirSync(SCRATCH_DIR, { recursive: true });

async function fetchAndCompress(url, idx) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch image ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength < 5_000) throw new Error(`image too small (${buf.byteLength}B)`);

  const rawPath = join(SCRATCH_DIR, `raw-${idx}.bin`);
  const jpgPath = join(SCRATCH_DIR, `cmp-${idx}.jpg`);
  writeFileSync(rawPath, buf);
  // 用 macOS sips（系统自带）压缩到 JPEG 80% 质量。fallback 用 ImageMagick convert。
  let usedTool = "sips";
  try {
    execFileSync("sips", [
      "-s", "format", "jpeg",
      "-s", "formatOptions", "80",
      "-Z", "512",
      rawPath, "--out", jpgPath,
    ], { stdio: "ignore" });
  } catch {
    usedTool = "convert";
    execFileSync("convert", [rawPath, "-resize", "512x512>", "-quality", "82", jpgPath], { stdio: "ignore" });
  }
  const jpg = readFileSync(jpgPath);
  rmSync(rawPath, { force: true });
  rmSync(jpgPath, { force: true });
  const b64 = jpg.toString("base64");
  return {
    dataUrl: `data:image/jpeg;base64,${b64}`,
    rawB: buf.byteLength,
    cmpB: jpg.length,
    tool: usedTool,
  };
}

async function pushTrophyRows(rows) {
  const r = await fetch(`${PROD}/api/sync/trophy-images`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${PWD}` },
    body: JSON.stringify({ rows }),
  });
  if (!r.ok) throw new Error(`push ${r.status}: ${await r.text()}`);
  return await r.json();
}

const generated = [];
const failed = [];

for (let i = 0; i < BOSSES.length; i++) {
  const boss = BOSSES[i];
  const tid = `math_boss_${boss.unitId}`;
  process.stderr.write(`[${i + 1}/${BOSSES.length}] ${boss.name} (${tid}) … `);

  let lastErr = null;
  let row = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const t0 = Date.now();
      const { url, model } = await callImageApi(boss.prompt);
      const { dataUrl, rawB, cmpB, tool } = await fetchAndCompress(url, i);
      const elapsed = Math.round((Date.now() - t0) / 1000);
      row = {
        trophyId: tid,
        subjectId: "math",
        imageDataUrl: dataUrl,
        sourceUrl: url,
        prompt: boss.prompt,
        model,
        generatedAt: Date.now(),
      };
      process.stderr.write(`✓ ${model} ${elapsed}s (raw ${(rawB/1024/1024).toFixed(1)}MB → ${tool} ${(cmpB/1024).toFixed(1)}KB)\n`);
      break;
    } catch (e) {
      lastErr = e;
      process.stderr.write(`attempt ${attempt} fail: ${e.message.slice(0,80)} `);
      if (attempt < 3) {
        process.stderr.write(`(等 30s)\n`);
        await new Promise(r => setTimeout(r, 30000));
      } else {
        process.stderr.write(`✗\n`);
      }
    }
  }
  if (row) generated.push(row);
  else failed.push({ unitId: boss.unitId, name: boss.name, err: lastErr?.message });
}

if (generated.length > 0) {
  process.stderr.write(`▶ 推 ${generated.length} 张图到 D1…\n`);
  // 分批 push（避免单 batch 超限）
  for (let i = 0; i < generated.length; i += 5) {
    await pushTrophyRows(generated.slice(i, i + 5));
  }
  process.stderr.write(`✓ 推送完成\n`);
}

const report = {
  generated: generated.map(r => ({ trophyId: r.trophyId, model: r.model })),
  failed,
};
console.log(JSON.stringify(report, null, 2));
writeFileSync("/tmp/boss-images-report.json", JSON.stringify(report, null, 2));
