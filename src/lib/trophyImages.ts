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
 * Tier 风格指南——铜银金钻 4 等级，配合 Apple Fitness 风（简洁、底色为主、细边）。
 *
 * 关键：底色 = 等级。看一眼就知道铜还是金，不靠图案区分。
 */
const TIER_FLAVORS = {
  bronze: {
    metalColor: "古铜橙 (rich antique copper / bronze)",
    finish: "哑光铜质感，温暖橘调",
    accent: "细金边、低调内发光",
    aura: "清晨阳光",
  },
  silver: {
    metalColor: "亮银白 (polished silver / platinum white)",
    finish: "镜面银质感，冷调高光",
    accent: "细钢边、银色光晕",
    aura: "月光清辉",
  },
  gold: {
    metalColor: "真金黄 (royal 24k gold)",
    finish: "镀金高光，温暖金调",
    accent: "金边浮雕、璀璨星芒",
    aura: "宝石镶嵌闪光",
  },
  platinum: {
    metalColor: "钻石彩虹全息 (holographic iridescent diamond)",
    finish: "钻石切面，七彩光晕",
    accent: "棱镜折射、霓虹幻光",
    aura: "星河流转",
  },
} as const;

/**
 * 给 trophy 拼出生成 prompt（v0.29 Apple Fitness 风重写）：
 *
 * 设计原则：
 *  - **底色 = 等级**：铜橙 / 银白 / 真金 / 钻彩，看一眼就知道在哪一档
 *  - **主体大、留白少**：主体占 85%（不是 50%），不要外圈装饰围环
 *  - **细边线**：3px 内的金属细边，不要厚重纹饰
 *  - **不同分类不同形状**：milestone/ability=圆形 medal；skill=六角徽章；commemorative=六角星
 *  - **强调"没有任何文字"**：避免 AI 写错字
 *  - 512×512 中心严格构图便于 UI 圆形 mask
 */
export function buildTrophyPrompt(t: TrophyMeta): string {
  // 段位勋章（id 形如 "tier_school" / "tier_district" 等）走专门风格
  if (/_tier_/.test(t.id) || (t.id.includes("tier_") && t.subjectId === "math")) {
    return buildTierBadgePrompt(t);
  }

  const tier = t.tier;
  const flavor = tier ? TIER_FLAVORS[tier] : null;
  const category = t.category ?? "milestone";

  // 形状按分类区分（让玩家一眼区分类别）
  const shape =
    category === "commemorative"
      ? "六角星形 (six-pointed star) 纪念徽章"
      : category === "skill"
        ? "盾形 (shield-shaped) 学科徽章"
        : category === "ability"
          ? "六边形 (hexagonal) 能力徽章"
          : "圆形 (circular) 标准勋章";

  // 底色由 tier 决定；没 tier（commemorative / daily）用学科调色板
  const palette = flavor
    ? `底色：${flavor.metalColor}，${flavor.finish}，装饰：${flavor.accent}，氛围：${flavor.aura}`
    : t.subjectId === "math"
      ? "底色：深紫罗兰渐樱花粉，柔和女童感，金色细节"
      : "底色：暖金 + 中国红，水墨晕染，墨色细节";

  const desc = t.description ? `主题：「${t.description}」。` : "";

  return [
    // Apple Fitness 极简风
    `Apple Fitness 风格的高级运动奖牌，${shape}，主体居中放大占画面 85%。`,
    `主体：${t.name} 概念的卡通图标，高度凝练，单一焦点，识别度高。`,
    desc,
    palette,
    // 简洁框线 — 关键差异点
    `**只有一道极细 (1-2px) 的金属环线作为外缘**，不要任何装饰围圈、不要花纹、不要光环、不要射线，整体简洁高级。`,
    `画面背景：纯黑或深深紫，让主体的 ${flavor?.metalColor ?? "金属"} 色更突出。`,
    `禁止出现：任何文字、字母、数字、签名、水印、印章、徽章题写。`,
    `风格：精致 3D 浮雕质感 + 柔和内发光，**像 Apple Fitness 的徽章那样高级简洁**，4 年级女生喜欢但不幼稚。`,
    `画面尺寸：512×512 正方形，主体严格居中，四周留 8% 纯色边距。`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * 段位勋章专用 prompt：每段位有自己的"地点 + 主色 + 标志"。
 * t.id 形如 "tier_school" / "tier_district" / "tier_city" / "tier_province" / "tier_country"。
 */
function buildTierBadgePrompt(t: TrophyMeta): string {
  // 抽取 tier id（去掉前缀）
  const rawId = t.id.replace(/^math_/, "").replace(/^chinese_/, "").replace(/^tier_/, "");
  const tierTheme: Record<string, { motif: string; color: string }> = {
    school: { motif: "可爱卡通校园建筑（学校大门 + 课本）", color: "天蓝色 + 浅青色，柔和" },
    district: {
      motif: "锦江区地标 + 春天嫩芽（嫩绿色丝带 + 锦江水波）",
      color: "翠绿 + 蜜蓝绿，新生感",
    },
    city: {
      motif: "成都熊猫宝宝头像 + 蓉城都市轮廓",
      color: "紫罗兰 + 紫红，神秘感",
    },
    province: {
      motif: "金色国宝大熊猫 + 四川山川剪影",
      color: "金色 + 橘红，辉煌感",
    },
    country: {
      // ⚠️ 不写 "中国地图" / "五星" —— 阿里云图像模型对国家地图和国旗符号有内容
      // 过滤，会返回 InvalidParameter。改用通用的"凤凰 + 山河 + 星辰"传奇意象。
      motif: "金色凤凰展翅 + 远山云海 + 璀璨星辰光环",
      color: "深红 + 真金，传奇质感",
    },
  };
  const theme = tierTheme[rawId] ?? { motif: t.name, color: "紫红" };
  return [
    `Apple Fitness 风格的圆形段位勋章 (rank medal)，简洁高级，居中构图。`,
    `主体：${theme.motif}，4 年级女生喜欢但不幼稚的精致风格，主体占画面 85%。`,
    `主色调：${theme.color}。`,
    `**只有一道极细 (1-2px) 的金属环线作为外缘**，不要装饰围圈、不要花纹光环。`,
    `背景：纯黑或深深紫，让主体颜色更突出。`,
    `禁止出现：任何文字、字母、数字、签名、水印。`,
    `风格：精致 3D 浮雕 + 柔光内发光，像 Apple Fitness 徽章一样高级。`,
    `画面尺寸：512×512 正方形，主体严格居中，四周留 8% 边距。`,
  ].join(" ");
}

/** 把任意 URL 下载成 base64 data URL（持久化到 IndexedDB） */
async function fetchAsDataUrl(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch image failed: ${r.status}`);
  const blob = await r.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FileReader result not string"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
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
