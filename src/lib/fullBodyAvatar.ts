/**
 * v0.36.67 — Hub v6/v7 重做: **全身立绘实时生成 + 实时抠图 + 缓存** (Bruce 2026-05-21 拍板)。
 *
 * Bruce 定的架构:
 *  - 进场景的全身角色 = 选定/每次升段那一刻**实时生成** (per 学生×职业×性别×段位),
 *    然后**实时抠掉深 navy 背景**, 融进主界面。
 *  - "实时" = 按需生成一次 + **缓存** (per 学生×段位, 存 db.meta), 同段重进不重生,
 *    升段才再生成。不每次进页面都等/烧钱。
 *
 * 本模块 = 那个引擎: ensureFullBodyAvatar() 查缓存 → 缺则 实时 gen(token-plan wan)
 * → removeNavyBgToTrimmedPng 客户端抠图 → 存缓存 → 返回透明全身 PNG dataURL。
 *
 * 注意: 用 token-plan (月订阅已付费, wan2.7-image-pro), 不走 BAILIAN 按量。
 * 生成 ~15-40s, 调用方负责 loading UX (选角进度条 / 升段动画盖住等待)。
 * 失败抛错, 调用方 fallback (预生成半身 / emoji)。
 */
import { db } from "../db/dexie";
import { generateImage, TutorError } from "./tutor";
import { removeNavyBgToTrimmedPng } from "./removeNavyBg";
import type { Archetype, Gender } from "./characterChoice";

// ── Character Bible (全身版) — 跟 scripts/_gen-tier-avatars.mjs 一致, 只把"半身"改"全身" ──
const FIXED_PREFIX_FULLBODY =
  "Anime cel-shading style, masterpiece quality, vibrant clean line-art. " +
  "FULL-BODY character standing, entire figure visible from head to feet (including legs and shoes), " +
  "slight dynamic 3/4 hero stance, looking at viewer, " +
  "dark navy background for transparency cutout (NOT white/transparent, very dark solid navy like #0a0e2c).";

const ANCHOR: Record<Gender, string> = {
  female:
    "10-year-old cute Chinese girl, short black bob hair (chin-length, neat bangs across forehead), " +
    "large amber-brown eyes (bright and warm), gentle confident smile, round soft face, " +
    "slim youthful build, healthy fair skin",
  male:
    "10-year-old cute Chinese boy, short black hair (slightly tousled, neat bangs across forehead), " +
    "large bright amber-brown eyes, gentle confident smile, round soft face, " +
    "slim youthful build, healthy fair skin",
};

// 去掉 "full body"/"multiple views"; 加防裁剪 (anti-crop) 保证出全身。
const NEGATIVE_FULLBODY =
  "cropped, close-up, half-body, only upper body, legs cut off, ugly, deformed face, extra limbs, " +
  "inconsistent proportions, different hair color, blonde hair, blue eyes, brown hair, freckles, " +
  "messy background, text, signature, watermark, mature features, teen idol, aged-up, adult proportions";

// Outfit per archetype × tier (英文, 跟 gen 脚本一致 — 中文短语会触发阿里云 green-net)。
const OUTFIT: Record<Archetype, Record<string, string>> = {
  scholar: { school: "blue cardigan + notebook + pencil badge", district: "training jacket + math badge", city: "tactical belt pouch + compass", province: "half-cape + metal trim", country: "hero outfit + laurel wreath + star medal" },
  scientist: { school: "white lab coat + flask + safety goggles", district: "upgraded flask + measuring tool", city: "full lab suit + microscope", province: "scientist cape", country: "hero lab robe + glowing aura" },
  explorer: { school: "adventure vest + compass + map", district: "camping gear + binoculars", city: "full expedition team uniform", province: "captain coat + medals", country: "legendary explorer + golden laurel" },
  mage: { school: "wizard robe + wand + wizard hat", district: "advanced spellbook + star staff", city: "archmage robe + floating", province: "academy headmaster robe", country: "grand archmage + astral crown" },
  warrior: { school: "martial-arts gi + red headband + wooden sword", district: "training armor + advanced sword", city: "samurai armor set + real sword", province: "master robe + long sword", country: "legendary warrior + crown" },
  artist: { school: "apron + palette + paintbrush", district: "artist smock + work apron", city: "full studio outfit + easel", province: "master apron + golden palette", country: "legendary artist + laurel wreath" },
};

export function buildFullBodyPrompt(archetype: Archetype, gender: Gender, tier: string): string {
  const outfit = OUTFIT[archetype]?.[tier] ?? OUTFIT[archetype]?.school ?? "school outfit";
  return (
    `${FIXED_PREFIX_FULLBODY} ${ANCHOR[gender]}. ` +
    `Outfit (RPG ${archetype}, ${tier} tier): ${outfit}. ` +
    `Negative: ${NEGATIVE_FULLBODY}.`
  );
}

interface CachedAvatar {
  dataUrl: string;
  generatedAt: number;
}

function cacheKey(studentId: string, archetype: Archetype, gender: Gender, tier: string): string {
  return `fullBodyAvatar::math::${studentId}::${archetype}::${gender}::${tier}`;
}

/** 只查缓存, 不生成 (大厅快路径: 有就立即显示, 没有再触发 ensure)。 */
export async function getCachedFullBodyAvatar(
  studentId: string, archetype: Archetype, gender: Gender, tier: string,
): Promise<string | null> {
  const row = await db.meta.get(cacheKey(studentId, archetype, gender, tier));
  const v = row?.value as CachedAvatar | undefined;
  return v?.dataUrl ?? null;
}

/**
 * 拿全身透明立绘: 命中缓存直接返; 否则实时生成 + 抠图 + 存缓存。
 * **永远不会每次重生** — 同 (学生,职业,性别,段位) 只生成一次。
 * @throws 生成/抠图失败时抛 (调用方 fallback)。
 */
export async function ensureFullBodyAvatar(
  studentId: string, archetype: Archetype, gender: Gender, tier: string,
): Promise<string> {
  const cached = await getCachedFullBodyAvatar(studentId, archetype, gender, tier);
  if (cached) return cached;

  const prompt = buildFullBodyPrompt(archetype, gender, tier);
  const res = await generateImage({ prompt, model: "wan2.7-image-pro", size: "1024*1024", source: "fullbody-avatar" });
  const url = res.urls?.[0];
  if (!url) throw new TutorError("no_image_url", 502);

  const { dataUrl } = await removeNavyBgToTrimmedPng(url);
  await db.meta.put({ key: cacheKey(studentId, archetype, gender, tier), value: { dataUrl, generatedAt: Date.now() } satisfies CachedAvatar });
  return dataUrl;
}
