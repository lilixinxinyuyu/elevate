/**
 * v0.31.98：错题复活今日环"已闭过"sticky flag。
 *
 * 修 Bruce 反馈的 bug：早上把 5 道错题复活完，焦点环 done=true 显示"今日已闭"；
 * 下午做了几道新题答错或 spread 队列把后面几天的题推回今天，导致 dueMistakes 又
 * 涨到 3 道，原 done 判定 `revivedToday >= min(10, total)` 又变 false → 已完成
 * 的打卡变无效。
 *
 * 修复：用 db.meta 持久化"今日错题环闭过没"。一旦今天 done 判定为 true，就 mark；
 * 之后即使 due 又变 > revived，也保持 done=true（明天 0:00 自动重置因为 key
 * 带日期）。
 *
 * 跟 sql 表 schema 无关——只用 db.meta 通用 KV。
 */
import { db } from "../db/dexie";

function todayKey(studentId: string): string {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `mistakeRingClosed::${studentId}::${dateStr}`;
}

export async function markMistakeRingClosedToday(studentId: string): Promise<void> {
  const k = todayKey(studentId);
  const existing = await db.meta.get(k);
  if (existing?.value) return;
  await db.meta.put({ key: k, value: Date.now() });
}

export async function isMistakeRingClosedToday(studentId: string): Promise<boolean> {
  const row = await db.meta.get(todayKey(studentId));
  return !!row?.value;
}
