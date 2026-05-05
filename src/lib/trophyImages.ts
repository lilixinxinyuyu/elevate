/**
 * AI 生成勋章图的获取 + 持久化。
 *
 * 设计：
 *  - 调 /api/generate/image → 拿到 dashscope OSS URL
 *  - URL 24h 过期 → 立刻 fetch 下载成 base64 data URL，存进 db.trophyImages
 *  - 后续 trophy wall 都从 db 读 base64 直接渲染，没有时回到 emoji 兜底
 *
 * "盲盒"：rare trophy 解锁时调 generateTrophyImage(trophyId, prompt, {force: true})
 *  → 不管缓存是否存在都重新生成 → 写入 db isLottery=true
 *
 * 批量：generateAllMissing() 给 admin 用 — 跑过所有 trophy，已有的跳过
 */

import { useEffect, useState } from "react";
import { db } from "../db/dexie";
import { generateImage } from "./tutor";
import type { TrophyImageRow } from "../db/dexie";
import type { TrophyTier } from "../core/types";

/** trophy 元数据（math + chinese 都能用） */
export interface TrophyMeta {
  id: string;
  subjectId: "math" | "chinese";
  name: string;
  /** 默认 emoji icon */
  icon: string;
  description?: string;
  /** 是否是 rare（单次成就），rare 才走盲盒抽奖 */
  rare?: boolean;
  /** v0.29: 勋章分类（影响 AI 图风格） */
  category?: "daily" | "milestone" | "ability" | "skill" | "commemorative";
  /** v0.29: tier-leveled 勋章在哪个等级（影响 AI 图底色） */
  tier?: "bronze" | "silver" | "gold" | "platinum";
}

/**
 * v0.29.1 B++ 方案：每枚勋章 **一张 AI 图**（不分 tier），让 AI 自由发挥独特配色。
 *
 * 设计哲学（对齐 Apple Fitness）：
 *  - 每枚勋章 = 一份独特的多彩插画，主体丰富 + 配色独特
 *  - tier (铜银金钻) 的视觉表达 **不进 AI 图**，而是 CSS 在外层加：
 *      1. 1-2px 金属外环（铜橙 / 银白 / 真金 / 钻彩）
 *      2. 右下角小角标 ★ / ★★ / ★★★ / 💎
 *      3. tier 色 glow / drop-shadow
 *      4. 钻档专属：CSS conic-gradient 全息光晕动画
 *  - 这样 17 张图够用（vs 68），主体有 Apple 级丰富，tier 升级靠"加 buff"语言
 *
 * 注意：TrophyMeta.tier 字段虽还在但本函数 **不读取**——所有 tier 在 CSS 处理。
 */

/** 段位勋章特殊处理（5 个 tier 段位需要不同地标，不走通用流程） */
function isSegmentTier(t: TrophyMeta): boolean {
  return /_tier_/.test(t.id) || (t.id.includes("tier_") && t.subjectId === "math");
}

/**
 * 给 trophy 拼出生成 prompt（v0.29.9 回归独立精修路线）。
 *
 * 设计：每枚 trophy 都有手写的 motif + signature palette，确保独特创意。
 * 对 tiered trophy（milestone/ability/skill），同 motif 用 4 种金属调（铜银金钻）
 * 各生成一张，构成"同一作品的 4 个珍藏版本"。
 *
 * 用户反馈痛点回顾：
 *  - v0.29.0-v0.29.7 "AI 自由发挥多彩 motif" → 颜色漂移，多数偏绿
 *  - v0.29.8 "单色+CSS 染色" → 一致但单调没质感，像 SVG 不像奖牌
 *  - v0.29.9 "每枚独立精修+手写 prompt" → 独立创意 + 一致质感
 */
export function buildTrophyPrompt(t: TrophyMeta): string {
  if (isSegmentTier(t)) {
    return buildTierBadgePrompt(t);
  }
  if (t.category === "commemorative") {
    return buildCommemorativePrompt(t);
  }
  // 非 commemorative：从 spec 取 motif + tier 金属调拼 prompt
  return buildRichTrophyPrompt(t);
}

/**
 * v0.29.9: 每个非 commemorative trophy 的手写 motif spec。
 *
 * key = 不带 tier 后缀的纯 trophyId（如 "math_answer_master"）
 * value = motif 描述 + 主调色板提示（tier 会再叠加金属调）
 */
const TROPHY_MOTIF_SPEC: Record<string, { motif: string; palette: string }> = {
  // === daily（无 tier，1 张图）===
  math_daily_complete: {
    motif: "a glowing checkmark sticker placed on a paper calendar page, with a soft happy aura",
    palette: "fresh emerald green + golden yellow + cream highlights",
  },
  math_speed_demon: {
    motif: "a cute hand silhouette zooming forward with electric lightning trails behind, dynamic motion blur",
    palette: "electric sapphire blue + lemon yellow + silver lightning",
  },
  math_no_hint_run: {
    motif: "a bright cartoon brain wearing a tiny halo of stars and shimmering thought sparkles",
    palette: "lavender purple + warm peach + silver star highlights",
  },
  math_mistake_reborn: {
    motif: "a magical book bursting open with a tiny phoenix rising out of the pages, golden flame trail",
    palette: "fiery ruby red + warm amber + golden flame",
  },

  // === milestone（4 tier 变体）===
  math_answer_master: {
    motif: "a target with a perfectly placed arrow in the bullseye, surrounded by tiny burst sparkles and small ribbon flag",
    palette: "deep ruby red bullseye + cream rings + 闪亮 metallic arrow",
  },
  math_combo_king: {
    motif: "a stylized lightning bolt strike with combo number trail dissolving into sparks, dynamic energy",
    palette: "electric blue energy + amber lightning core",
  },
  math_streak_keeper: {
    motif: "a tall flame burning steadily with a small glowing heart inside, surrounded by soft warm aura",
    palette: "warm orange flame + ruby heart + cream glow",
  },
  math_mastery_climber: {
    motif: "tiered mountain peaks with a small triangular flag planted on the highest summit, soft cloud at base",
    palette: "deep teal mountains + cream snow + crimson flag",
  },

  // === ability（8 个，4 tier 变体）===
  math_ability_calculation: {
    motif: "a charming abacus with glowing colorful beads, viewed at a slight angle for depth",
    palette: "jade green frame + ruby + sapphire + warm amber beads",
  },
  math_ability_concept: {
    motif: "a cute lightbulb wearing a tiny graduation cap, with idea-sparks radiating around",
    palette: "sunshine yellow bulb + navy cap + silver sparks",
  },
  math_ability_reasoning: {
    motif: "a magnifying glass hovering over interlocking puzzle pieces, one piece glowing gold",
    palette: "deep sapphire blue + cream paper + golden glow",
  },
  math_ability_modeling: {
    motif: "a triangular ruler crossed with a brass compass, small geometric shapes floating around them",
    palette: "teal blue + rose gold + soft cream",
  },
  math_ability_spatial: {
    motif: "an isometric Rubik's cube floating with one face exploding into colorful tiles",
    palette: "vivid rainbow cube faces + dark space backdrop",
  },
  math_ability_data: {
    motif: "a 3D bar chart with colorful bars rising from a base, sparkle particles around the tallest bar",
    palette: "violet + fuchsia + cyan bars + magenta sparkle",
  },
  math_ability_strategy: {
    motif: "a chess knight piece standing on a glowing tile, soft starry tile pattern around",
    palette: "dusty rose marble knight + golden tile + indigo backdrop",
  },
  math_ability_habit: {
    motif: "a stylized heart with a small steady flame burning inside, soft golden ring around the heart",
    palette: "ruby heart + cream flame + rose gold ring",
  },

  // === skill（5 个，4 tier 变体）===
  math_decimal_hero: {
    motif: "a tiny superhero kid in a flowing cape, holding a shield with a glowing decimal point, in a heroic pose",
    palette: "sky blue cape + lemon yellow shield + cream skin",
  },
  math_equation_hero: {
    motif: "a balance scale with a glowing 'X' variable on one tray and a number stack on the other, perfect equilibrium",
    palette: "warm orange variable + turquoise scales + brass arms",
  },
  math_average_hero: {
    motif: "a magnifying glass over a small bar chart, with a tiny detective deerstalker hat resting on the magnifier",
    palette: "mauve hat + honey gold magnifier + cream bars",
  },
  math_triangle_hero: {
    motif: "a sturdy triangle shape with a tiny gavel placed across its base, like a courtroom symbol",
    palette: "deep purple triangle + amber gavel + cream backdrop",
  },
  math_shop_hero: {
    motif: "a cheerful shopping bag with a glowing coin spilling out the top, surrounded by tiny price-tag sparkles",
    palette: "mint green bag + rose gold coin + cream tags",
  },
};

/**
 * tier 金属调修饰：避开"24K GOLD"/"DIAMOND PLATINUM"等品牌词（wan2.7 会当文字漏入图）。
 * 用纯描述性语言。
 */
const TIER_FLAVOR: Record<TrophyTier, string> = {
  bronze:
    "Tier finish: warm antique copper-bronze metallic surface, aged patina with hints of amber, weathered vintage charm, soft greenish oxidation in shadows.",
  silver:
    "Tier finish: polished cool silver-white metallic mirror, crisp pearl highlights, brushed metal striations, faint prismatic shine on the edges.",
  gold:
    "Tier finish: warm honey-amber metallic shine, deep embossed relief, regal warm glow, sun-kissed edges that catch the light.",
  platinum:
    "Tier finish: iridescent rainbow-holographic metallic surface, crystalline prismatic facets, soft aurora glow, sparkly fairy-dust particles drifting around the medal.",
};

function buildRichTrophyPrompt(t: TrophyMeta): string {
  // 取出无 tier 后缀的 trophyId 用于查 spec
  const baseId = t.id
    .replace(/^math_/, "math_")
    .replace(/_(bronze|silver|gold|platinum)$/, "");
  const spec = TROPHY_MOTIF_SPEC[baseId];
  const motif =
    spec?.motif ?? `an iconic illustration that represents「${t.name}」 (${t.description ?? ""})`;
  const palette =
    spec?.palette ?? "rich 2-3 color signature palette";
  const tierFlavor = t.tier ? TIER_FLAVOR[t.tier] : "Tier finish: classic colorful enamel palette.";

  return [
    // 主旨——避开 "Apple Fitness" 品牌词，用描述性语言
    `Premium 3D rendered luxury award medallion, magical and rich — designed for a 4th-grade girl to treasure and show off proudly.`,
    // motif（核心）
    `Subject: ${motif}.`,
    // 风格细节
    `Composition: the subject occupies ~78% of the medal, strictly centered, framed by subtle decorative elements (tiny star sparkles, small ribbon flecks, soft light particles) — never crowded.`,
    `Surface: glossy enameled medal with deep 3D embossed relief, clear dimensional depth, soft inner glow, polished metallic reflections.`,
    `Signature palette: ${palette}.`,
    // Tier 金属调
    tierFlavor,
    // 风格 — 不再说品牌名
    `Production style: high-end commemorative medallion, premium tactile feel, the kind of medal a child wants to keep forever and show friends — magical, dreamy, sparkly, slightly playful and cute.`,
    // 框约束
    `Outer ring: a refined thin metallic edge that matches the tier finish — NO heavy decorative wreaths, NO busy frames, NO oversized ribbon banners.`,
    // 背景 / 大小
    `Background: deep space-purple gradient to near-black, helps the medal colors pop dramatically.`,
    // 强力反 text 三连
    `**ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO LOGOS, NO ENGLISH SCRIPT, NO CHINESE CHARACTERS, NO NUMBERS, NO SIGNATURES, NO WATERMARKS, NO STAMPS** — the medal must be ENTIRELY pictorial and graphical, zero typography.`,
    `Image size 512×512, square, subject strictly centered with ~8% padding.`,
  ].join(" ");
}

/**
 * v0.29.2: 纪念勋章专属 prompt — "传家宝"级仪式感。
 *
 * commemorative 类是"一辈子只拿一次"的事件勋章（第一步 / 期中加冕 / 新学年起航 / 生日 等），
 * 应该明显比 daily / milestone / ability / skill 更精致、更有奖章质感、更值得珍藏。
 *
 * 设计要点：
 *  - 形状：六角星（六芒星）—— 跟其他勋章形状有明显区分
 *  - 质感：传家宝奖章 (heirloom medallion) / 浮雕 / 厚重金属感
 *  - 缎带 + 月桂枝 / 棕榈叶 等仪式装饰元素
 *  - 配色仍多彩，但可加金色高光（不是 tier 锁死的金）
 *  - 强调"独一无二""值得永久珍藏"的氛围
 */
function buildCommemorativePrompt(t: TrophyMeta): string {
  const desc = t.description ? `主题：「${t.description}」。` : "";
  return [
    `Apple Fitness 风格的高级**纪念奖章 commemorative medallion**，六角星形 (six-pointed star)，主体居中放大占画面 85%。`,
    `这是一枚**传家宝级别 (heirloom)** 的纪念勋章 —— 比普通成就勋章更精致、更有仪式感、更值得珍藏。`,
    `主体：「${t.name}」概念的卡通图标，配合**月桂枝 / 棕榈叶 / 缎带 / 星芒**等仪式性装饰元素围绕主体（不要写文字）。`,
    desc,
    // 多彩配色 + 仪式感
    `**配色：2-3 种主色调和谐多彩搭配**，与「${t.name}」主题相关，可加金色或银色高光做奖章质感。`,
    `示例方向（任选灵感）：金 + 深紫 + 樱花粉 / 银 + 翡翠绿 + 金 / 玫瑰金 + 香槟 + 暖白。`,
    // 重点：奖章质感
    `**质感关键**：厚重金属奖章浮雕感 (3D embossed metal medallion)，比普通勋章更深的浮雕、更精细的边缘细节、更明显的光影立体感。`,
    `**外缘**：1-2px 极细金属环线，可有轻微的雕花纹理（但不要厚装饰围圈）。`,
    `背景：纯黑或深深紫，让多彩主体和金属光泽更突出。`,
    `禁止出现：任何文字、字母、数字、签名、水印。`,
    `风格：精致 3D 浮雕 + 柔光内发光 + 仪式感 + Apple Fitness 高级简洁感，4 年级女生喜欢但不幼稚，让人有"想永远收藏"的冲动。`,
    `画面尺寸：512×512 正方形，主体严格居中，四周留 8% 边距。`,
  ].join(" ");
}

/**
 * 段位勋章专用 prompt：每段位有自己的"地点 + 主色 + 标志"。
 * t.id 形如 "tier_school" / "tier_district" / "tier_city" / "tier_province" / "tier_country"。
 */
function buildTierBadgePrompt(t: TrophyMeta): string {
  // 抽取 tier id（去掉前缀）
  const rawId = t.id.replace(/^math_/, "").replace(/^chinese_/, "").replace(/^tier_/, "");
  const tierTheme: Record<string, { motif: string; rim: string; bg: string }> = {
    school: {
      motif:
        "a friendly stylized primary school crest: an open book at center with a tiny rising sun above, two small green leaves curling around the book, soft pastel sky-blue palette",
      rim: "polished pale silver with soft blue inner glow",
      bg: "warm pastel cream-to-sky-blue radial gradient",
    },
    district: {
      motif:
        "an emerald regional emblem: a slender bamboo stalk rising at center wrapped in calm river ripples, tiny new spring buds, refined and uplifting",
      rim: "polished gold with emerald inner glow",
      bg: "deep emerald to jade radial gradient",
    },
    city: {
      motif:
        "a violet city emblem: a cute panda silhouette beside a stylized traditional Chinese eave (Wuhou Shrine inspired) with a glowing teacup at the bottom, mystic and refined",
      rim: "brushed silver with violet inner glow",
      bg: "deep violet to fuchsia radial gradient",
    },
    province: {
      motif:
        "an amber-gold provincial emblem: a chubby panda hugging green bamboo with stylized misty Sichuan mountains behind, small golden stars sprinkled around the rim",
      rim: "thick polished gold with amber inner glow",
      bg: "amber to honey-gold radial gradient",
    },
    country: {
      // ⚠️ 不写 "中国地图" / "五星" —— 阿里云图像模型对国家地图和国旗符号有内容
      // 过滤，会返回 InvalidParameter。改用通用的"凤凰 + 山河 + 星辰"传奇意象。
      motif:
        "a national legendary emblem: a golden phoenix in flight over abstract Great Wall layers and a starburst halo, regal and powerful",
      rim: "radiant gold with ruby inner glow",
      bg: "deep ruby to gold radial gradient",
    },
  };
  const theme = tierTheme[rawId] ?? {
    motif: t.name,
    rim: "polished gold",
    bg: "deep violet radial gradient",
  };
  return [
    // === 主体描述 ===
    `A premium Apple Fitness style achievement medal, circular embossed relief, clean centered composition.`,
    `Subject: ${theme.motif}.`,
    // === 框架填满（修 v0.30.3 黑边大问题） ===
    `**The circular medal fills the entire frame edge-to-edge — the rim touches all four sides of the square canvas with at most 1-2 pixel margin.** No visible empty background border, no thick padding, no halo of dark space around the medal.`,
    `Rim: ${theme.rim}, smooth thin metallic ring 2-3% of the frame width, exactly at the canvas edge.`,
    // === 内部背景，跟金属环呼应（不要纯黑！） ===
    `Inside the rim: ${theme.bg}, soft and dimensional, makes the central motif glow naturally. Absolutely **NOT a flat black or near-black background** — the inner color should be saturated and rich.`,
    `Surface: precise 3D embossed relief, silky inner glow, premium hyperrealistic detail, like the very best Apple Fitness award icons.`,
    // === 严格禁止 ===
    `**ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO LOGOS, NO ENGLISH SCRIPT, NO CHINESE CHARACTERS, NO NUMBERS, NO SIGNATURES, NO WATERMARKS, NO STAMPS, NO TYPOGRAPHY, NO CALLIGRAPHY OF ANY KIND.**`,
    // === 输出尺寸 ===
    `Output: 512×512 square, the circular medal occupies 98%+ of the canvas with only a 1-2 pixel margin on each side.`,
  ].join(" ");
}

/**
 * v0.29.5: 把任意 URL 下载并 **压缩** 成 base64 data URL。
 *
 * 之前直接 readAsDataURL(blob) 把 AI 返回的原始 PNG 整张存进 IDB —— 实测每张
 * ~7 MB，2 张就 14 MB，导致 cloudSync 上传 14 MB JSON 给 Cloudflare 直接 500。
 *
 * 现在通过 canvas 重绘 + JPEG 压缩：
 *   - 目标尺寸 256×256（UI 最大显示尺寸 lg=80px / xl=128px，256 足够清晰）
 *   - 输出 JPEG quality=0.85（PNG 没必要——勋章图没有透明）
 *   - 实测每张 ~30-60 KB，30 张总 ~1-2 MB，sync push 轻松通过
 */
const COMPRESS_TARGET_PX = 256;
const COMPRESS_JPEG_QUALITY = 0.85;

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image decode failed"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Canvas 重绘 + JPEG 压缩。返回 data URL。 */
async function compressBlobToDataUrl(blob: Blob): Promise<string> {
  const img = await blobToImage(blob);
  const canvas = document.createElement("canvas");
  canvas.width = COMPRESS_TARGET_PX;
  canvas.height = COMPRESS_TARGET_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  // 黑底（与 prompt 要求"深色背景"一致；JPEG 不支持透明）
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, COMPRESS_TARGET_PX, COMPRESS_TARGET_PX);
  // 等比缩放居中绘制
  const scale = Math.min(
    COMPRESS_TARGET_PX / img.width,
    COMPRESS_TARGET_PX / img.height,
  );
  const w = img.width * scale;
  const h = img.height * scale;
  const dx = (COMPRESS_TARGET_PX - w) / 2;
  const dy = (COMPRESS_TARGET_PX - h) / 2;
  ctx.drawImage(img, dx, dy, w, h);
  return canvas.toDataURL("image/jpeg", COMPRESS_JPEG_QUALITY);
}

/** 把任意 URL 下载、压缩成 base64 data URL（持久化到 IndexedDB） */
async function fetchAsDataUrl(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch image failed: ${r.status}`);
  const blob = await r.blob();
  return await compressBlobToDataUrl(blob);
}

/**
 * v0.29.5: 一次性迁移 — 把已存的过大勋章图重新压缩。
 * v0.29.7 修两个 bug：
 *   - 老版本 `new Blob([bytes])` 没传 MIME type，<img> 加载偶尔失败 → 静默
 *     跳过 → 老 7 MB 图不被压缩 → push 上传 14+ MB → cloud 500
 *   - 老版本 marker 设了之后再也不重跑，即使本地仍有大图
 *
 * 修法：
 *   - 解 base64 时保留 MIME type（"image/png"），blob 创建时传过去
 *   - 迁移结束后扫一遍剩余大图：还有 → 不设 marker（下次开 app 再跑）
 *
 * 阈值降到 200 KB（更激进）：实测合理 JPEG ~30-60 KB；> 200 KB 也是 PNG 没压缩
 * 的痕迹。
 *
 * 在 trophyImages 表里扫所有 imageDataUrl 长度 > 200KB 的 row，按现在的压缩
 * 管道重处理。每张耗时 < 100 ms（纯 canvas 操作，无 AI 调用）。
 */
const COMPRESSION_MIGRATION_KEY = "trophyImagesCompressedAt";
const COMPRESSION_THRESHOLD = 200 * 1024; // 200 KB

export async function migrateCompressOversizedTrophyImages(): Promise<{ processed: number; freedMb: number; remainingOversized: number } | null> {
  const meta = await db.meta.get(COMPRESSION_MIGRATION_KEY);
  // v0.29.7: 即使 marker 已设，也再扫一次。如果本地确实没大图，这一遍 ~5 ms 直接退出。
  // 这避免了"v0.29.5 bug 把 marker 设了但没真的压缩"的死局。
  const all = await db.trophyImages.toArray();
  const oversized = all.filter((row) => (row.imageDataUrl?.length ?? 0) >= COMPRESSION_THRESHOLD);
  if (oversized.length === 0) {
    if (!meta?.value) await db.meta.put({ key: COMPRESSION_MIGRATION_KEY, value: Date.now() });
    return null;
  }

  let processed = 0;
  let freedBytes = 0;
  let failed = 0;
  for (const row of oversized) {
    try {
      // data URL → blob → recompress
      const m = row.imageDataUrl!.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) {
        failed += 1;
        continue;
      }
      const mime = m[1] ?? "image/png";
      const bin = atob(m[2]!);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      // v0.29.7 关键：blob 必须带 MIME type，否则 <img> 加载失败 → 整个迁移挂
      const blob = new Blob([bytes], { type: mime });
      const beforeLen = row.imageDataUrl!.length;
      const compressed = await compressBlobToDataUrl(blob);
      freedBytes += beforeLen - compressed.length;
      await db.trophyImages.put({ ...row, imageDataUrl: compressed });
      processed += 1;
    } catch (e) {
      failed += 1;
      console.warn(`[trophyImages] compress migration failed for ${row.trophyId}`, e);
    }
  }

  // 检查迁移后还剩多少大图（应该 = failed 数）
  const stillOversized = (await db.trophyImages.toArray()).filter(
    (row) => (row.imageDataUrl?.length ?? 0) >= COMPRESSION_THRESHOLD,
  );

  // 只有当真的全部清干净了才设 marker — 否则下次启动会再尝试
  if (stillOversized.length === 0) {
    await db.meta.put({ key: COMPRESSION_MIGRATION_KEY, value: Date.now() });
  }

  return { processed, freedMb: freedBytes / 1024 / 1024, remainingOversized: stillOversized.length };
}

/**
 * v0.29.7: push 前的安全检查 — 总图大小超 5 MB 就强制再压一遍。
 *
 * 防止边界情况：用户在压缩 migration 完成前就触发 push。
 */
export async function ensureTrophyImagesUnderSizeLimit(maxTotalMb = 5): Promise<{ recompressed: number } | null> {
  const all = await db.trophyImages.toArray();
  const total = all.reduce((s, r) => s + (r.imageDataUrl?.length ?? 0), 0);
  if (total <= maxTotalMb * 1024 * 1024) return null;
  // 清 marker 让 migration 重跑
  await db.meta.delete(COMPRESSION_MIGRATION_KEY);
  const r = await migrateCompressOversizedTrophyImages();
  return { recompressed: r?.processed ?? 0 };
}

/** 直接读取已缓存的图（不会触发生成） */
export async function getTrophyImage(trophyId: string): Promise<TrophyImageRow | undefined> {
  return await db.trophyImages.get(trophyId);
}

/**
 * 拿勋章图：先从 cache 读，没有就生成 + 下载 + 存。
 * @param force 强制重新生成（盲盒抽奖用）
 */
export async function ensureTrophyImage(
  t: TrophyMeta,
  options: { force?: boolean; isLottery?: boolean } = {},
): Promise<TrophyImageRow> {
  if (!options.force) {
    const cached = await getTrophyImage(t.id);
    if (cached?.imageDataUrl) return cached;
  }
  const prompt = buildTrophyPrompt(t);
  // Round 6: 默认 512×512（最小尺寸 + 省 token + 主体严格居中）
  const r = await generateImage({
    prompt,
    size: "512*512",
    n: 1,
  });
  const url = r.urls[0];
  if (!url) throw new Error("generateImage returned 0 urls");
  // 立刻下载成 base64 (URL 24h 过期)
  const dataUrl = await fetchAsDataUrl(url);
  const row: TrophyImageRow = {
    trophyId: t.id,
    subjectId: t.subjectId,
    imageDataUrl: dataUrl,
    sourceUrl: url,
    prompt,
    model: r.model,
    generatedAt: Date.now(),
    isLottery: options.isLottery,
  };
  await db.trophyImages.put(row);
  return row;
}

/** Hook：组件订阅某个 trophy 的图，cache 命中即给图，否则给 null（用 emoji 兜底） */
export function useTrophyImage(trophyId: string | undefined): TrophyImageRow | null {
  const [row, setRow] = useState<TrophyImageRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!trophyId) {
      setRow(null);
      return;
    }
    void (async () => {
      const r = await db.trophyImages.get(trophyId);
      if (!cancelled) setRow(r ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [trophyId]);

  return row;
}

/** Hook：监听整个 trophyImages 表，一旦表更新（put）就重新拉 */
export function useAllTrophyImages(): Map<string, TrophyImageRow> {
  const [map, setMap] = useState<Map<string, TrophyImageRow>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const all = await db.trophyImages.toArray();
      if (!cancelled) setMap(new Map(all.map((r) => [r.trophyId, r])));
    };
    void refresh();
    // 简单方式：用一个 polling（5 秒间隔），dexie hooks 复杂避免依赖
    const id = window.setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return map;
}

/**
 * 批量生成所有缺失的勋章图（admin 用）。
 * 一张张串行 (避免 quota 雪崩)，回调汇报进度。
 */
export async function generateAllMissingTrophyImages(
  trophies: TrophyMeta[],
  onProgress?: (
    done: number,
    total: number,
    currentName: string,
    status: "running" | "skipped" | "done" | "failed",
    error?: string,
  ) => void,
): Promise<{ generated: number; skipped: number; failed: number }> {
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  for (let i = 0; i < trophies.length; i++) {
    const t = trophies[i]!;
    onProgress?.(i, trophies.length, t.name, "running");
    try {
      const cached = await getTrophyImage(t.id);
      if (cached?.imageDataUrl) {
        skipped++;
        onProgress?.(i + 1, trophies.length, t.name, "skipped");
        continue;
      }
      await ensureTrophyImage(t);
      generated++;
      onProgress?.(i + 1, trophies.length, t.name, "done");
    } catch (e) {
      failed++;
      onProgress?.(
        i + 1,
        trophies.length,
        t.name,
        "failed",
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  return { generated, skipped, failed };
}

/** 清掉所有缓存（admin 重置勋章图用） */
export async function clearAllTrophyImages(): Promise<number> {
  const count = await db.trophyImages.count();
  await db.trophyImages.clear();
  return count;
}
