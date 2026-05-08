/**
 * 每日字次/词次目标 + 连续打卡 streak（v0.31.41）
 *
 * 老 chinese/g4_cn.html 没有"今日目标 + streak"概念，做完了无感。
 * 新版引入：
 *
 *   daily_target_attempts:   每日字次目标（默认 20）
 *   daily_streak:            连续完成目标的天数
 *   daily_lastCompleteDate:  最近完成目标的日期 (YYYY-MM-DD)
 *
 * 流程：
 *   - 进页时检查日期切换：今天是新一天 → reset todayCount=0
 *   - 每答一字次 → todayCount++
 *   - todayCount 第一次 >= target 时弹"今日目标完成 🎉"
 *   - streak 维护：如果完成目标且昨天也完成 → streak++；昨天没完成 → streak=1
 *
 * 数据：
 *   db.meta.key = `daily_${subjectId}_${studentId}` → DailyState
 *   - todayDate: "YYYY-MM-DD"
 *   - todayCount: 今日已答字次
 *   - target: 每日目标
 *   - streak: 连续完成天数
 *   - lastCompleteDate: 最近完成目标的日期
 */

import { db } from "../db/dexie";

export interface DailyState {
  todayDate: string;
  todayCount: number;
  target: number;
  streak: number;
  lastCompleteDate: string | null;
}

function todayDateStr(now: number = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yesterdayDateStr(now: number = Date.now()): string {
  return todayDateStr(now - 24 * 60 * 60 * 1000);
}

function key(subject: string, studentId: string): string {
  return `daily_${subject}_${studentId}`;
}

export async function loadDaily(
  subject: string,
  studentId: string,
  defaultTarget: number = 20,
): Promise<DailyState> {
  const row = await db.meta.get(key(subject, studentId));
  const today = todayDateStr();
  if (!row?.value) {
    return {
      todayDate: today,
      todayCount: 0,
      target: defaultTarget,
      streak: 0,
      lastCompleteDate: null,
    };
  }
  const cur = row.value as DailyState;
  // 日期切换：reset todayCount
  if (cur.todayDate !== today) {
    return {
      todayDate: today,
      todayCount: 0,
      target: cur.target,
      streak: cur.streak,
      lastCompleteDate: cur.lastCompleteDate,
    };
  }
  return cur;
}

export async function saveDaily(
  subject: string,
  studentId: string,
  state: DailyState,
): Promise<void> {
  await db.meta.put({ key: key(subject, studentId), value: state });
}

/**
 * 答完一题。如果当前 todayCount + 1 == target → 触发完成事件（streak++）
 * 返回更新后的 state + 是否刚刚完成目标。
 */
export async function tickDaily(
  subject: string,
  studentId: string,
  cur: DailyState,
): Promise<{ next: DailyState; justCompleted: boolean }> {
  const today = todayDateStr();
  const next: DailyState = {
    ...cur,
    todayDate: today,
    todayCount: cur.todayCount + 1,
  };
  const justCompleted =
    cur.todayCount < cur.target && next.todayCount >= cur.target;
  if (justCompleted) {
    // streak 维护
    if (cur.lastCompleteDate === yesterdayDateStr()) {
      next.streak = cur.streak + 1;
    } else if (cur.lastCompleteDate === today) {
      // 同日已完成（不应再次进入此分支，但兜底）
      next.streak = cur.streak;
    } else {
      next.streak = 1;
    }
    next.lastCompleteDate = today;
  }
  await saveDaily(subject, studentId, next);
  return { next, justCompleted };
}

export async function setDailyTarget(
  subject: string,
  studentId: string,
  target: number,
): Promise<void> {
  const cur = await loadDaily(subject, studentId);
  await saveDaily(subject, studentId, { ...cur, target });
}
