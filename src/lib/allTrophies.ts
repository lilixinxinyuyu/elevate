/**
 * 跨学科 trophy 元数据汇总。
 *
 * 给 trophyImages 批量生成 / lottery 抽奖判断 / TrophyIcon 渲染共用一份统一
 * 数据源。
 */

import { TROPHIES } from "../core/trophies";
import { CHINESE_TROPHIES } from "../subjects/chinese/trophies";
import type { TrophyMeta } from "./trophyImages";

/** 把 math + chinese 的 trophy 都拉平成 TrophyMeta */
export function getAllTrophyMeta(): TrophyMeta[] {
  const math: TrophyMeta[] = TROPHIES.map((t) => ({
    id: `math_${t.id}`, // 加前缀避免 id 冲突
    subjectId: "math" as const,
    name: t.name,
    icon: t.icon ?? "🏆",
    description: t.description,
    rare: typeof t.check === "function",
  }));
  const chinese: TrophyMeta[] = CHINESE_TROPHIES.map((t) => ({
    id: `chinese_${t.id}`,
    subjectId: "chinese" as const,
    name: t.name,
    icon: t.icon ?? "🏆",
    description: t.description,
    rare: typeof t.check === "function",
  }));
  return [...math, ...chinese];
}

/** 给定 (subjectId, raw trophyId) 算出 TrophyImage 的 keyed id */
export function trophyImageKey(subjectId: "math" | "chinese", rawId: string): string {
  return `${subjectId}_${rawId}`;
}

/** 给定 trophy raw id（不带前缀），从全集里查 meta（math 优先） */
export function findTrophyMeta(
  rawId: string,
  subjectId?: "math" | "chinese",
): TrophyMeta | undefined {
  const all = getAllTrophyMeta();
  if (subjectId) {
    return all.find((t) => t.id === trophyImageKey(subjectId, rawId));
  }
  return all.find((t) => t.id.endsWith(`_${rawId}`));
}
