/**
 * v0.32.0: P3 Worlds 进度系统 — db.meta `worlds::*` 沙箱 namespace。
 *
 * 跟主路径 XP/level/trophy 系统隔离。Sprint 1 只追踪：
 *  - 每个建筑完成的 session 数（mini-game 通关）
 *  - 总装饰碎片数（决定地图视觉成长）
 *
 * 沙箱：删除所有 worlds::* key 可一键回滚。
 */

import { db } from "../../db/dexie";

const PREFIX = "worlds::";

async function get<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(PREFIX + key);
  if (!row) return fallback;
  return row.value as T;
}

async function set(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key: PREFIX + key, value });
}

/** 某建筑完成的 mini-game 次数 */
export async function getBuildingCompleteCount(buildingId: string): Promise<number> {
  return get<number>(`baibao::${buildingId}::completed`, 0);
}

/** 累加某建筑完成次数 */
export async function incrementBuildingComplete(buildingId: string): Promise<number> {
  const cur = await getBuildingCompleteCount(buildingId);
  const next = cur + 1;
  await set(`baibao::${buildingId}::completed`, next);
  await incrementDecorationShards();
  return next;
}

/** 累计装饰碎片（决定地图视觉成长） */
export async function getDecorationShards(): Promise<number> {
  return get<number>("decoration_shards", 0);
}

async function incrementDecorationShards(): Promise<void> {
  const cur = await getDecorationShards();
  await set("decoration_shards", cur + 1);
}

/** 获取所有 baibao 建筑的完成统计 */
export async function getAllBaibaoStats(): Promise<Record<string, number>> {
  const ids = ["store", "bank", "bakery", "bus-stop", "carpentry", "my-room"];
  const out: Record<string, number> = {};
  for (const id of ids) {
    out[id] = await getBuildingCompleteCount(id);
  }
  return out;
}

/** 获取所有 xingfan 建筑的完成统计 */
export async function getAllXingfanStats(): Promise<Record<string, number>> {
  const ids = ["airport", "customs", "cafe", "newsstand"];
  const out: Record<string, number> = {};
  for (const id of ids) {
    out[id] = await getBuildingCompleteCount(id);
  }
  return out;
}
