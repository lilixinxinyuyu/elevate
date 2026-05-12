/**
 * 小进的星海工坊 — 进度持久化（沙箱版）
 *
 * 所有 db.meta key 前缀 `atelier::`，跟主路径数据完全隔离。
 * 删除工坊 = 删所有 `atelier::*` key。
 *
 * 灵感（Inspiration）：累积值，never decrease。每完成一题 +1，全对 session +3。
 * 触发解锁阈值：10 / 25 / 50 / 100 / 200。
 */

import { db } from "../../db/dexie";
import type { AtelierRealmId } from "../../content/atelier/realms";

const KEY = {
  inspirationTotal: () => "atelier::inspiration::total",
  realmVisited: (id: AtelierRealmId) => `atelier::realm::${id}::visited`,
  realmCompleted: (id: AtelierRealmId) => `atelier::realm::${id}::completed`,
  realmStars: (id: AtelierRealmId) => `atelier::realm::${id}::stars`,
} as const;

/** 读取累积灵感总数 */
export async function getInspiration(): Promise<number> {
  const row = await db.meta.get(KEY.inspirationTotal());
  return typeof row?.value === "number" ? row.value : 0;
}

/** 加灵感（用于答题完成回调） */
export async function addInspiration(delta: number): Promise<number> {
  const cur = await getInspiration();
  const next = Math.max(0, cur + delta);
  await db.meta.put({ key: KEY.inspirationTotal(), value: next });
  return next;
}

/** 进入一个 realm — visited++ */
export async function recordRealmVisit(id: AtelierRealmId): Promise<void> {
  const row = await db.meta.get(KEY.realmVisited(id));
  const cur = typeof row?.value === "number" ? row.value : 0;
  await db.meta.put({ key: KEY.realmVisited(id), value: cur + 1 });
}

/** 完成一个 realm session（一组题做完） */
export async function recordRealmCompletion(id: AtelierRealmId, stars: 1 | 2 | 3): Promise<void> {
  const cRow = await db.meta.get(KEY.realmCompleted(id));
  const completedCur = typeof cRow?.value === "number" ? cRow.value : 0;
  await db.meta.put({ key: KEY.realmCompleted(id), value: completedCur + 1 });

  // 取已有最高星等
  const sRow = await db.meta.get(KEY.realmStars(id));
  const starsCur = typeof sRow?.value === "number" ? sRow.value : 0;
  if (stars > starsCur) {
    await db.meta.put({ key: KEY.realmStars(id), value: stars });
  }
}

export interface RealmProgress {
  visited: number;
  completed: number;
  stars: number; // 0-3
}

export async function getRealmProgress(id: AtelierRealmId): Promise<RealmProgress> {
  const [vRow, cRow, sRow] = await Promise.all([
    db.meta.get(KEY.realmVisited(id)),
    db.meta.get(KEY.realmCompleted(id)),
    db.meta.get(KEY.realmStars(id)),
  ]);
  return {
    visited: typeof vRow?.value === "number" ? vRow.value : 0,
    completed: typeof cRow?.value === "number" ? cRow.value : 0,
    stars: typeof sRow?.value === "number" ? sRow.value : 0,
  };
}

/** 灵感阈值 → 触发的解锁事件（用于 UI 显示装饰升级） */
export const INSPIRATION_THRESHOLDS = [
  { at: 10, decoration: "bookshelf", label: "📚 书架出现在工坊角落" },
  { at: 25, outfit: "sandi", label: "👗 小礼服 outfit 解锁" },
  { at: 50, decoration: "starcore-bright", label: "✨ 星核更亮了" },
  { at: 100, outfit: "ren", label: "👘 白旗袍 outfit 解锁" },
  { at: 200, decoration: "atelier-complete", label: "🌟 工坊完整形态" },
] as const;

/** 计算当前灵感对应的工坊阶段 (0-5)，用于 UI 显示哪些装饰已亮 */
export function getAtelierStage(inspiration: number): number {
  let stage = 0;
  for (const t of INSPIRATION_THRESHOLDS) {
    if (inspiration >= t.at) stage++;
  }
  return stage;
}

/** Reset 所有 atelier 数据（admin 沙箱按钮用） */
export async function resetAtelierProgress(): Promise<void> {
  const keys = await db.meta.toCollection().keys();
  const atelierKeys = (keys as string[]).filter((k) => typeof k === "string" && k.startsWith("atelier::"));
  await db.meta.bulkDelete(atelierKeys);
}

/** 一次性读全部 realm 进度（hub 页用） */
export async function getAllRealmProgress(
  realmIds: AtelierRealmId[],
): Promise<Record<AtelierRealmId, RealmProgress>> {
  const entries = await Promise.all(realmIds.map(async (id) => [id, await getRealmProgress(id)] as const));
  return Object.fromEntries(entries) as Record<AtelierRealmId, RealmProgress>;
}
