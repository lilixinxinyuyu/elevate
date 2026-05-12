/**
 * 小镇沙箱进度持久化。db.meta key 前缀 `town::`。
 *
 * 复用 atelier 的灵感系统但 namespace 完全独立 — town 跟 atelier 数据互不污染。
 */

import { db } from "../../db/dexie";
import type { BuildingId } from "../../content/town/buildings";

const KEY = {
  inspiration: () => "town::inspiration::total",
  buildingVisits: (id: BuildingId) => `town::building::${id}::visits`,
  buildingTasks: (id: BuildingId) => `town::building::${id}::tasksDone`,
  townStage: () => "town::stage::current",
} as const;

/** 灵感总数 */
export async function getInspiration(): Promise<number> {
  const row = await db.meta.get(KEY.inspiration());
  return typeof row?.value === "number" ? row.value : 0;
}

export async function addInspiration(delta: number): Promise<number> {
  const cur = await getInspiration();
  const next = Math.max(0, cur + delta);
  await db.meta.put({ key: KEY.inspiration(), value: next });
  return next;
}

/** 建筑进入次数 */
export async function recordBuildingVisit(id: BuildingId): Promise<number> {
  const row = await db.meta.get(KEY.buildingVisits(id));
  const cur = typeof row?.value === "number" ? row.value : 0;
  const next = cur + 1;
  await db.meta.put({ key: KEY.buildingVisits(id), value: next });
  return next;
}

/** 完成一次具体任务（building 内一个 task 单元 — e.g. 银行 1 个客户） */
export async function recordBuildingTask(id: BuildingId, success: boolean): Promise<number> {
  if (!success) return 0;
  const row = await db.meta.get(KEY.buildingTasks(id));
  const cur = typeof row?.value === "number" ? row.value : 0;
  const next = cur + 1;
  await db.meta.put({ key: KEY.buildingTasks(id), value: next });
  return next;
}

export interface BuildingProgress {
  visits: number;
  tasksDone: number;
}

export async function getBuildingProgress(id: BuildingId): Promise<BuildingProgress> {
  const [v, t] = await Promise.all([
    db.meta.get(KEY.buildingVisits(id)),
    db.meta.get(KEY.buildingTasks(id)),
  ]);
  return {
    visits: typeof v?.value === "number" ? v.value : 0,
    tasksDone: typeof t?.value === "number" ? t.value : 0,
  };
}

export async function getAllBuildingProgress(ids: BuildingId[]): Promise<Record<BuildingId, BuildingProgress>> {
  const entries = await Promise.all(ids.map(async (id) => [id, await getBuildingProgress(id)] as const));
  return Object.fromEntries(entries) as Record<BuildingId, BuildingProgress>;
}

/** 镇子阶段 0=村庄 1=乡镇 2=县城 ... 灵感阈值触发 */
export const TOWN_STAGES = [
  { at: 0, name: "迷你村庄", emoji: "🏘️" },
  { at: 30, name: "热闹村庄", emoji: "🏡" },
  { at: 80, name: "新生乡镇", emoji: "🏙️" },
  { at: 200, name: "小县城", emoji: "🌆" },
  { at: 500, name: "中等城市", emoji: "🌃" },
] as const;

export interface TownStage {
  at: number;
  name: string;
  emoji: string;
}

export function getTownStage(inspiration: number): TownStage {
  let stage: TownStage = TOWN_STAGES[0]!;
  for (const s of TOWN_STAGES) {
    if (inspiration >= s.at) stage = s;
  }
  return stage;
}

export async function resetTownProgress(): Promise<void> {
  const keys = await db.meta.toCollection().keys();
  const townKeys = (keys as string[]).filter((k) => typeof k === "string" && k.startsWith("town::"));
  await db.meta.bulkDelete(townKeys);
}
