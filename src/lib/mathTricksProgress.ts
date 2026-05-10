/**
 * 巧算工具箱进度持久化（v0.31.87 替换 localStorage）。
 *
 * 旧 v0.31.71-86 用 localStorage `selena.tricks.completed`：
 *   - ✗ 不跨设备（爸爸看不到）
 *   - ✗ 不进 cloud sync
 *   - ✗ Selena PWA 清缓存就丢
 *
 * v0.31.87 新存储：
 *   - db.meta key `tricks::completed::<studentId>` → Set<trickId>（终身完成）
 *   - db.meta key `tricks::dailyDone::<studentId>::<dateKey>` → Set<trickId>
 *     （今日做过哪几个 — TodayRings 内环判定用 size > 0）
 *
 * 这两份分开是因为：
 *   - "已掌握"是终身列表（视觉上"金色 ✓"）
 *   - "今日有做"决定每日打卡环（昨天做过不算今天闭环）
 *
 * 自动 migration：第一次读 `completed` 时若 db.meta 空，把 localStorage
 * 的旧值写入并清掉 localStorage（一次性）。
 */

import { db } from "../db/dexie";
import { todayKey } from "./date";

const LEGACY_KEY = "selena.tricks.completed";

function completedKey(studentId: string): string {
  return `tricks::completed::${studentId}`;
}

function dailyKey(studentId: string, dateKey: string): string {
  return `tricks::dailyDone::${studentId}::${dateKey}`;
}

/** 读取终身已完成的 trick set。第一次会从 localStorage 迁移。 */
export async function getCompletedTricks(studentId: string): Promise<Set<string>> {
  const row = await db.meta.get(completedKey(studentId));
  if (row?.value && Array.isArray(row.value)) {
    return new Set(row.value as string[]);
  }
  // migration: 首次没数据，看 localStorage
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, boolean>;
      const ids = Object.keys(obj).filter((k) => obj[k]);
      if (ids.length > 0) {
        await db.meta.put({ key: completedKey(studentId), value: ids });
        // 清除旧 key 避免下次 hit 这分支
        localStorage.removeItem(LEGACY_KEY);
        return new Set(ids);
      }
    }
  } catch {
    /* */
  }
  return new Set();
}

/** 标记一个 trick 终身已完成，同时记录今日做过。 */
export async function markTrickDone(
  studentId: string,
  trickId: string,
): Promise<void> {
  // 终身列表
  const completed = await getCompletedTricks(studentId);
  if (!completed.has(trickId)) {
    completed.add(trickId);
    await db.meta.put({
      key: completedKey(studentId),
      value: Array.from(completed),
    });
  }
  // 今日列表（不论是否第一次完成，今天点了就算今日有做）
  const today = todayKey();
  const dailyRow = await db.meta.get(dailyKey(studentId, today));
  const todaySet = new Set(
    (dailyRow?.value as string[] | undefined) ?? [],
  );
  if (!todaySet.has(trickId)) {
    todaySet.add(trickId);
    await db.meta.put({
      key: dailyKey(studentId, today),
      value: Array.from(todaySet),
    });
  }
}

/** 今天做过几个 trick — TodayRings 闭环判定用。 */
export async function getTricksTodayCount(studentId: string): Promise<number> {
  const today = todayKey();
  const row = await db.meta.get(dailyKey(studentId, today));
  if (!row?.value || !Array.isArray(row.value)) return 0;
  return (row.value as string[]).length;
}

/** "已掌握"总数（终身），给页面 hero 进度展示。 */
export async function getCompletedTricksCount(
  studentId: string,
): Promise<number> {
  const set = await getCompletedTricks(studentId);
  return set.size;
}
