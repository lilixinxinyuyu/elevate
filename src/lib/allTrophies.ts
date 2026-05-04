/**
 * 跨学科 trophy 元数据汇总。
 *
 * v0.29.9 回归"每 tier 独立 AI 图"：每个 tiered trophy 有 4 张独立精心生成的
 * tier 变体（铜银金钻），key 带 tier 后缀。daily / commemorative / segment
 * tier badge 不分 tier，只 1 张图。
 *
 * （v0.29.1-v0.29.8 曾尝试 1 张图共用 / 单色+CSS 染色路线，但视觉效果
 * 用户不满意 → 回归独立精修。）
 */

import { TROPHIES } from "../core/trophies";
import { CHINESE_TROPHIES } from "../subjects/chinese/trophies";
import { TIERS } from "../core/tiers";
import type { TrophyDef, TrophyTier } from "../core/types";
import type { TrophyMeta } from "./trophyImages";

const TIER_NAMES: Record<TrophyTier, string> = {
  bronze: "铜",
  silver: "银",
  gold: "金",
  platinum: "钻",
};

/**
 * 一个 math TrophyDef 展开成它对应的 TrophyMeta 列表：
 *   - commemorative / daily：1 条
 *   - milestone / ability / skill：4 条（每 tier 一张独立图）
 */
function expandMathTrophy(t: TrophyDef): TrophyMeta[] {
  const baseDescription = t.description ?? "";
  const isTiered = !!t.tieredThresholds && t.tieredThresholds.length > 0;
  if (!isTiered) {
    return [
      {
        id: `math_${t.id}`,
        subjectId: "math",
        name: t.name,
        icon: t.icon ?? "🏆",
        description: baseDescription,
        rare: t.category === "commemorative",
        category: t.category,
      },
    ];
  }
  return t.tieredThresholds!.map((th) => ({
    id: `math_${t.id}_${th.tier}`,
    subjectId: "math",
    name: `${t.name} · ${TIER_NAMES[th.tier]}`,
    icon: t.icon ?? "🏆",
    description: `${baseDescription}（${TIER_NAMES[th.tier]}：${th.tierLabel}）`,
    rare: th.tier === "gold" || th.tier === "platinum",
    category: t.category,
    tier: th.tier,
  }));
}

/** 把 math + chinese trophy + 段位勋章都拉平成 TrophyMeta */
export function getAllTrophyMeta(): TrophyMeta[] {
  const math: TrophyMeta[] = TROPHIES.flatMap(expandMathTrophy);
  const chinese: TrophyMeta[] = CHINESE_TROPHIES.map((t) => ({
    id: `chinese_${t.id}`,
    subjectId: "chinese" as const,
    name: t.name,
    icon: t.icon ?? "🏆",
    description: t.description,
    rare: typeof t.check === "function",
  }));
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
 * 给定 (subjectId, raw trophyId, optional tier) 算出 TrophyImage key。
 * v0.29.9: tier 提供且 trophy 有 tier 体系时，key 带 tier 后缀。
 */
export function trophyImageKey(
  subjectId: "math" | "chinese",
  rawId: string,
  tier?: TrophyTier,
): string {
  const base = `${subjectId}_${rawId}`;
  return tier ? `${base}_${tier}` : base;
}

/** 给定 trophy raw id（不带前缀），从全集里查 meta（math 优先） */
export function findTrophyMeta(
  rawId: string,
  subjectId?: "math" | "chinese",
  tier?: TrophyTier,
): TrophyMeta | undefined {
  const all = getAllTrophyMeta();
  const target = trophyImageKey(subjectId ?? "math", rawId, tier);
  return all.find((t) => t.id === target);
}
