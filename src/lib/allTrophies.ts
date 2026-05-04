/**
 * 跨学科 trophy 元数据汇总。
 *
 * 给 trophyImages 批量生成 / lottery 抽奖判断 / TrophyIcon 渲染共用一份统一
 * 数据源。
 *
 * v0.29 进阶系统：math TROPHIES 里 milestone/ability/skill 类的勋章每个有
 * 4 等级（铜/银/金/钻），AI 图按 tier 单独生成。所以一个 def "answer_master"
 * 实际会展开成 4 个 TrophyMeta（id 后缀 _bronze/_silver/_gold/_platinum）。
 * daily/commemorative 类没有 tier 后缀。
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
 * 把一个 math TrophyDef 展开成它对应的所有 TrophyMeta。
 *
 * - commemorative / daily：单条
 * - milestone / ability / skill：4 条（每个 tier 一条），AI 图各自生成
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
        // commemorative 和 daily 都不打 tier；commemorative 是 rare（盲盒触发）
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
    // 金/钻是 rare 触发盲盒
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
  // 段位勋章：5 个 tier，math + chinese 各一份（视觉风格不同）
  const mathTiers: TrophyMeta[] = TIERS.map((tier) => ({
    id: `math_tier_${tier.id}`,
    subjectId: "math" as const,
    name: `${tier.name} 段位勋章`,
    icon: tier.badgeIcon,
    description: tier.badgeDesc,
    rare: true, // 段位勋章都是稀有
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
 * 给定 (subjectId, raw trophyId, optional tier) 算出 TrophyImage 的 keyed id。
 * tier 只对 math 的 milestone/ability/skill 类才有；commemorative/daily 不带。
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
