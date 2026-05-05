/**
 * 段位校徽图——5 段每一段一张专属徽章图。
 *
 * 形象：
 *   - school   小学校徽（书本 + 太阳 + 草 + 蓝色调，温馨童趣）
 *   - district 区级徽章（成都府南河水波 + 翠竹，绿色调）
 *   - city     市级徽章（武侯祠飞檐 + 大熊猫 + 茶器，紫色调）
 *   - province 省级徽章（憨态熊猫抱竹 + 山峦，琥珀金色调）
 *   - country  国家级徽章（凤凰展翅 + 长城云海 + 星辰，红金色调）
 *
 * 缓存策略复用 db.trophyImages（trophyId 加 `_tier_badge_` 前缀）。
 * 第一次摸到立即生成；缓存命中直接 return。失败 fallback 到 emoji。
 *
 * 风格基线：圆形浮雕徽章 / 金属包边 / 适度发光。**严禁文字、数字、字母、Logo**。
 */

import { db } from "../db/dexie";
import { generateImage } from "./tutor";

const NEG_PROMPT =
  "**ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO ENGLISH SCRIPT, NO CHINESE CHARACTERS, NO NUMBERS, NO LOGOS, NO SIGNATURES, NO WATERMARKS, NO STAMPS, NO TYPOGRAPHY, NO CALLIGRAPHY, NO STROKES OF ANY GLYPH SHAPE.**";

const STYLE_BASE =
  "clean centered round metallic emblem, polished embossed relief, soft inner glow, premium app icon quality, render only the badge centered on transparent or solid contrasting background, vibrant but tasteful palette, Apple Fitness award level finish, hyperrealistic detail, no text whatsoever";

/**
 * 5 段位的专属 prompt。每条都是手工调过的"图像主体描述 + 调色 + 风格"。
 */
const TIER_BADGE_PROMPTS: Record<string, string> = {
  school:
    "A cute primary-school crest: a glowing pastel blue and cream circular medal with embossed open book and tiny rising sun in the center, four young green leaves around the rim, sparkles. Childlike, warm, friendly. Palette: sky blue + cream + soft amber + leaf green. " +
    STYLE_BASE,
  district:
    "An emerald-green regional emblem: a polished circular medal with stylized river ripples in the center wrapping around a slender bamboo stalk, surrounded by a thin gold rim. Refined, calm, growing. Palette: deep emerald + jade + soft gold. " +
    STYLE_BASE,
  city:
    "A violet city-scale emblem: a circular polished medal with a tiny bonsai-like panda silhouette beside an upward-curving traditional Chinese eave (Wuhou Shrine inspired), a teacup glow at the bottom rim. Mystical, refined. Palette: deep violet + fuchsia accents + brushed silver. " +
    STYLE_BASE,
  province:
    "An amber-gold provincial emblem: a polished circular medal showing a chubby panda hugging green bamboo with stylized misty Sichuan mountains behind, surrounded by a thick gold rim with tiny stars. Heroic, warm. Palette: amber + honey gold + jade green. " +
    STYLE_BASE,
  country:
    "A national-level emblem: a polished round medal with a golden phoenix in flight over abstract Great Wall layers and starburst, deep ruby + gold rim. Legendary, regal. Palette: ruby red + radiant gold + ivory highlights. " +
    STYLE_BASE,
};

const PREFIX = "_tier_badge_";

/**
 * 取段位校徽图：缓存命中直接返回，缺失就生成 + 持久化。
 *
 * 失败返回 null（调用方 fallback 到 emoji）。**不抛异常**，让 hero 不崩。
 */
export async function ensureTierBadgeImage(tierId: string): Promise<string | null> {
  const id = `${PREFIX}${tierId}`;
  const cached = await db.trophyImages.get(id);
  if (cached?.imageDataUrl) return cached.imageDataUrl;

  const prompt = TIER_BADGE_PROMPTS[tierId];
  if (!prompt) return null;
  const fullPrompt = `${prompt}\n\n${NEG_PROMPT}`;
  try {
    const r = await generateImage({ prompt: fullPrompt, size: "512*512", n: 1 });
    const url = r.urls[0];
    if (!url) throw new Error("generateImage returned 0 urls");
    const blob = await (await fetch(url)).blob();
    const dataUrl = await blobToDataUrl(blob);
    await db.trophyImages.put({
      trophyId: id,
      subjectId: "math",
      imageDataUrl: dataUrl,
      sourceUrl: url,
      prompt: fullPrompt,
      model: r.model,
      generatedAt: Date.now(),
      isLottery: false,
    });
    return dataUrl;
  } catch (e) {
    console.warn(`[tierBadge] ${tierId} generation failed`, e);
    return null;
  }
}

/**
 * 后台批量补 5 段位的图——admin 提供"重新生成所有段位徽章"的入口。
 * 顺序串行（图像生成本来就慢，不并发免得撞 quota）。
 */
export async function ensureAllTierBadgeImages(): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const id of Object.keys(TIER_BADGE_PROMPTS)) {
    out[id] = await ensureTierBadgeImage(id);
  }
  return out;
}

/** 重新生成单个段位徽章（admin 不喜欢这次的可以重抽） */
export async function regenerateTierBadge(tierId: string): Promise<string | null> {
  await db.trophyImages.delete(`${PREFIX}${tierId}`);
  return ensureTierBadgeImage(tierId);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FileReader result not string"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
