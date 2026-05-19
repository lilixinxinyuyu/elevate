/**
 * 每日字次/词次目标 + 连续打卡 streak（v0.31.41）
 *
 * v0.35.67 (User Flow Review P1-2 + Bruce directive): 加 Streak Freeze 请假条体系.
 *   - earn 规则: 单日 todayCount 达到 EARN_THRESHOLD (25, 远超 target 10/20) →
 *     获得 1 张请假条 (累积上限 MAX_TOKENS=3)
 *   - use 规则: 漏一天 (cur.lastCompleteDate = 前天) + 有 token → 自动用 1 张桥过昨天,
 *     streak 不破. silent (不弹 modal, 下次进 home 看到余量减 1)
 *   - 目的: 给 Selena autonomy (掌控感) + 减"断 streak 崩溃"焦虑. 跟练习挂钩, 不送.
 *
 * 数据：
 *   db.meta.key = `daily_${subjectId}_${studentId}` → DailyState
 *   - todayDate: "YYYY-MM-DD"
 *   - todayCount: 今日已答字次
 *   - target: 每日目标
 *   - streak: 连续完成天数
 *   - lastCompleteDate: 最近完成目标的日期
 *   - freezeTokens: 请假条余量 (v0.35.67 新增, 老数据默认 0)
 *   - lastFreezeUsedAt: 上次用请假条的日期 (debug 用)
 */

import { db } from "../db/dexie";

/** v0.35.67 Streak Freeze: 单日答题 ≥ 这个数字 → 获得 1 张请假条 */
export const FREEZE_EARN_THRESHOLD = 25;
/** v0.35.67 Streak Freeze: 累积上限 */
export const FREEZE_MAX_TOKENS = 3;

export interface DailyState {
  todayDate: string;
  todayCount: number;
  target: number;
  streak: number;
  lastCompleteDate: string | null;
  /** v0.35.67: 请假条余量 (0-3) */
  freezeTokens?: number;
  /** v0.35.67: 上次自动用请假条的日期 (debug / UI 显示) */
  lastFreezeUsedAt?: string | null;
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

/** v0.35.67 Streak Freeze: 前天日期 (用来判断是否漏 1 天可被 freeze 桥过) */
function dayBeforeYesterdayDateStr(now: number = Date.now()): string {
  return todayDateStr(now - 2 * 24 * 60 * 60 * 1000);
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
    // v0.35.67 Streak Freeze: 检查是否漏了昨天 + 有 freeze token → 自动桥过
    // 条件: lastCompleteDate = 前天 (说明昨天没完成 target), 且 freezeTokens > 0
    // 效果: lastCompleteDate 设为昨天 (假装昨天完成了), token -1, streak 不破
    // 沉默生效, UI 在 home 看 token 余量发现自动用了
    const currentTokens = cur.freezeTokens ?? 0;
    if (cur.lastCompleteDate === dayBeforeYesterdayDateStr() && currentTokens > 0) {
      const nextState: DailyState = {
        todayDate: today,
        todayCount: 0,
        target: cur.target,
        streak: cur.streak, // 保护 streak
        lastCompleteDate: yesterdayDateStr(), // 假装昨天完成
        freezeTokens: currentTokens - 1,
        lastFreezeUsedAt: yesterdayDateStr(),
      };
      // 立即持久化 (没等 tickDaily) — 让用户进 home 看到正确余量
      void saveDaily(subject, studentId, nextState);
      return nextState;
    }
    return {
      todayDate: today,
      todayCount: 0,
      target: cur.target,
      streak: cur.streak,
      lastCompleteDate: cur.lastCompleteDate,
      freezeTokens: currentTokens,
      lastFreezeUsedAt: cur.lastFreezeUsedAt ?? null,
    };
  }
  // 同日: 老数据可能没 freezeTokens 字段 → 兜底 0
  return {
    ...cur,
    freezeTokens: cur.freezeTokens ?? 0,
    lastFreezeUsedAt: cur.lastFreezeUsedAt ?? null,
  };
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
): Promise<{ next: DailyState; justCompleted: boolean; justEarnedFreeze?: boolean }> {
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
  // v0.35.67 Streak Freeze 获得规则:
  //   单日 todayCount 第一次 >= EARN_THRESHOLD (25) → 获得 1 张, cap 3 张
  //   逻辑: 远超 target (10/20) 表明今天努力 → 给奖励
  const currentTokens = cur.freezeTokens ?? 0;
  const justEarnedFreeze =
    cur.todayCount < FREEZE_EARN_THRESHOLD &&
    next.todayCount >= FREEZE_EARN_THRESHOLD &&
    currentTokens < FREEZE_MAX_TOKENS;
  if (justEarnedFreeze) {
    next.freezeTokens = currentTokens + 1;
  } else {
    next.freezeTokens = currentTokens;
  }
  await saveDaily(subject, studentId, next);
  return { next, justCompleted, justEarnedFreeze };
}

export async function setDailyTarget(
  subject: string,
  studentId: string,
  target: number,
): Promise<void> {
  const cur = await loadDaily(subject, studentId);
  await saveDaily(subject, studentId, { ...cur, target });
}
