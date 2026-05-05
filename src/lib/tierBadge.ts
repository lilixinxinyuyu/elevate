/**
 * 段位校徽图——统一入口（Hero + BadgeInventory + 任何用到段位徽章的地方共用一张）。
 *
 * v0.30.3 重构：之前自己写了一套 `_tier_badge_${id}` key，跟旧有的
 * BadgeInventory 用的 `math_tier_${id}` 完全分开 —— 同一段位有 2 张图。
 * 现在统一到 BadgeInventory 的 key 体系上：
 *   - cache key:        `math_tier_${tierId}`
 *   - prompt builder:   trophyImages.ts 里 `buildTierBadgePrompt` (复用)
 *   - 触发生成:          ensureTrophyImage(meta) (trophyImages.ts)
 *
 * 这样 hero 触发的生成立刻在 BadgeInventory 也显示，不用重复生成。
 */

import { db } from "../db/dexie";
import { ensureTrophyImage, type TrophyMeta } from "./trophyImages";
import { TIERS } from "../core/tiers";

/** 把 tierId 转成 TrophyMeta，统一塞给 ensureTrophyImage（走 buildTierBadgePrompt） */
function tierMeta(tierId: string): TrophyMeta {
  const tier = TIERS.find((t) => t.id === tierId);
  return {
    id: `math_tier_${tierId}`,
    subjectId: "math",
    name: tier?.badgeName ?? "段位徽章",
    icon: tier?.badgeIcon ?? "🏅",
    description: tier?.badgeDesc ?? "",
    rare: true,
  };
}

/** 取段位校徽图：缓存命中直接用，缺失就走 ensureTrophyImage 生成 + 持久化 */
export async function ensureTierBadgeImage(tierId: string): Promise<string | null> {
  try {
    const r = await ensureTrophyImage(tierMeta(tierId));
    return r.imageDataUrl;
  } catch (e) {
    console.warn(`[tierBadge] ${tierId} generation failed`, e);
    return null;
  }
}

/** 后台批量补 5 段位的图。串行避免撞 quota */
export async function ensureAllTierBadgeImages(): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const tier of TIERS) {
    out[tier.id] = await ensureTierBadgeImage(tier.id);
  }
  return out;
}

/** 重新生成单个段位徽章（admin 不喜欢这次的可以重抽） */
export async function regenerateTierBadge(tierId: string): Promise<string | null> {
  await db.trophyImages.delete(`math_tier_${tierId}`);
  return ensureTierBadgeImage(tierId);
}

/**
 * v0.30.3 一次性清理：删掉 v0.30.2 生成的 `_tier_badge_*` 旧 key 的图（如有）。
 * 它们用了不同 prompt，跟 BadgeInventory 不一致，一次性清掉让两边对齐。
 *
 * 调用一次（用 meta key 标记跑过）就 return。
 */
export async function migrateOldTierBadgeKeys(): Promise<{ deleted: number }> {
  const ACK_KEY = "tierBadge::oldKeyMigration::v0303";
  const ack = await db.meta.get(ACK_KEY);
  if (ack?.value === true) return { deleted: 0 };
  let deleted = 0;
  for (const tier of TIERS) {
    const oldId = `_tier_badge_${tier.id}`;
    const row = await db.trophyImages.get(oldId);
    if (row) {
      await db.trophyImages.delete(oldId);
      deleted += 1;
    }
  }
  await db.meta.put({ key: ACK_KEY, value: true });
  return { deleted };
}

/** 给定 tierId 拿当前 cache 的 dataUrl（同步——不触发生成；用于已知有缓存的场景） */
export function tierBadgeImageKey(tierId: string): string {
  return `math_tier_${tierId}`;
}
