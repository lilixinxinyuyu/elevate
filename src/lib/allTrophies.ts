/**
 * 跨学科 trophy 元数据汇总。
 *
 * v0.29.1 B++ 方案：每个勋章只有一张 AI 图（不再按 tier 展开 4 张）。
 *   - tier 视觉差异由 CSS 层（外环 / 角标 / glow / 钻档动画）处理
 *   - 大幅省 quota（17 张 vs 68 张）+ 同图 4 tier 视觉一致
 *   - trophyImageKey(subj, id) 不带 tier 后缀
 */

import { TROPHIES } from "../core/trophies";
import { CHINESE_TROPHIES } from "../subjects/chinese/trophies";
import { TIERS } from "../core/tiers";
import type { TrophyDef } from "../core/types";
import type { TrophyMeta } from "./trophyImages";

/**
 * math TrophyDef → TrophyMeta（一对一，不再按 tier 展开）。
 *
 * 历史：v0.29.0 一度按 tier 展开成 4 张图，后来发现：
 *   1. 4 张 AI 图视觉一致性靠运气（兄弟卡风格不齐）
 *   2. 生成量翻 4 倍（68 张 vs 17 张），quota 浪费严重
 *   3. tier 升级体验被弱化（明明该是"框升级"，硬被解读成"主体重画"）
 * → 改成一张多彩主体，CSS 套 tier 框（B++ 方案）
 */
function mathTrophyToMeta(t: TrophyDef): TrophyMeta {
  return {
    id: `math_${t.id}`,
    subjectId: "math",
    name: t.name,
    icon: t.icon ?? "🏆",
    description: t.description,
    // commemorative 是 rare（盲盒触发）；其他靠 tier 升级到 gold/platinum 时才 rare
    rare: t.category === "commemorative",
    category: t.category,
  };
}

/** 把 math + chinese trophy + 段位勋章都拉平成 TrophyMeta */
export function getAllTrophyMeta(): TrophyMeta[] {
  const math: TrophyMeta[] = TROPHIES.map(mathTrophyToMeta);
  const chinese: TrophyMeta[] = CHINESE_TROPHIES.map((t) => ({
    id: `chinese_${t.id}`,
    subjectId: "chinese" as const,
    name: t.name,
    icon: t.icon ?? "🏆",
    description: t.description,
    rare: typeof t.check === "function",
  }));
  // 段位勋章：5 个 tier，math + chinese 各一份（视觉风格不同）
  const mathTiers: TrophyMeta[] = TIERS.map((tier) => ({
    id: `math_tier_${tier.id}`,
    subjectId: "math" as const,
    name: `${tier.name} 段位勋章`,
    icon: tier.badgeIcon,
    description: tier.badgeDesc,
    rare: true,
  }));
  const chineseTiers: TrophyMeta[] = TIERS.map((tier) => ({
    id: `chinese_tier_${tier.id}`,
    subjectId: "chinese" as const,
    name: `${tier.name} 段位勋章`,
    icon: tier.badgeIcon,
    description: tier.badgeDesc,
    rare: true,
  }));
  return [...math, ...chinese, ...mathTiers, ...chineseTiers];
}

/**
 * 给定 (subjectId, raw trophyId) 算出 TrophyImage 的 keyed id。
 *
 * v0.29.1: tier 参数不再使用（B++ 方案下一张图 4 tier 共用）。
 * 保留参数签名兼容老调用，但内部忽略。
 */
export function trophyImageKey(
  subjectId: "math" | "chinese",
  rawId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tier?: import("../core/types").TrophyTier,
): string {
  return `${subjectId}_${rawId}`;
}

/** 给定 trophy raw id（不带前缀），从全集里查 meta（math 优先） */
export function findTrophyMeta(
  rawId: string,
  subjectId?: "math" | "chinese",
): TrophyMeta | undefined {
  const all = getAllTrophyMeta();
  const target = trophyImageKey(subjectId ?? "math", rawId);
  return all.find((t) => t.id === target);
}
