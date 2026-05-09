/**
 * v0.31.69: 错题复活的"每日上限 + 自动分散积压"调度器。
 *
 * 背景：spaced-review 在 stage 0 时 nextReviewAt = today + 1d。如果 Selena 周六
 * 一次做了 80 道错题，周日就有 80 道全部到期 — 一小时根本做不完，焦点环永远
 * 闭不上 → 雪球 + 焦虑。
 *
 * 解法（A 路）：
 *   1. 每日复活目标 = 10 道（小四 1h 合理量）。
 *   2. 当前到期数 > target × 1.5（= 15）时，按 stage / nextReviewAt 排序，
 *      保留最该今日复活的 target 道，**多余的把 nextReviewAt 重新分散**到未来
 *      7 天（每天约 target 道 + 小时 jitter 防全部同一秒到期）。
 *   3. 焦点环闭合规则改成 `revivedToday >= min(target, totalDueToday)`，
 *      不再要求"清零所有到期"。
 *   4. 闭环后，如果今日复活状态"顺利"（accuracy > 70% AND 答题速度比 estimated
 *      快 ≥20%）→ 继续鼓励再来 5 道；否则只显示"今日已闭"。
 *
 * 这是纯函数 + 无 db 副作用模块，方便单测。db 写回放在 service.ts:
 * spreadOverflowDueMistakes()。
 */

import type { MistakeReview } from "../core/types";

/** 每日复活目标 — Selena 1h 内合理做完的量。 */
export const DAILY_REVIVE_TARGET = 10;

/** 当前到期数超过这个值才触发 spread。给 50% headroom 防小波动反复重排。 */
export const SPREAD_TRIGGER = Math.ceil(DAILY_REVIVE_TARGET * 1.5);

/** 把溢出的错题分散到未来这么多天。 */
export const SPREAD_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 把 due 数大于上限时多余的错题分散到未来 SPREAD_DAYS 天。
 *
 * 排序：stage ASC, nextReviewAt ASC（薄弱 + 久未复习的优先今日复活；
 * 高 stage = 已经复习过几轮的可以晚点）。
 *
 * @returns
 *   - keepToday: 今日仍保留到期的（不动 nextReviewAt）
 *   - spread:    被推后的（nextReviewAt 已改写，调用方写回 db）
 */
export function planMistakeSpread(
  dueMistakes: MistakeReview[],
  now: number = Date.now(),
): { keepToday: MistakeReview[]; spread: MistakeReview[] } {
  if (dueMistakes.length <= SPREAD_TRIGGER) {
    return { keepToday: dueMistakes, spread: [] };
  }

  const sorted = [...dueMistakes].sort(
    (a, b) => a.stage - b.stage || a.nextReviewAt - b.nextReviewAt,
  );

  const keepToday = sorted.slice(0, DAILY_REVIVE_TARGET);
  const overflow = sorted.slice(DAILY_REVIVE_TARGET);

  // Tomorrow 00:00 local time
  const tomorrowStart = (() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime() + DAY_MS;
  })();

  const spread: MistakeReview[] = overflow.map((m, i) => {
    // 每天分 DAILY_REVIVE_TARGET 道，超过 SPREAD_DAYS 就压到最后一天
    const dayOffset = Math.min(SPREAD_DAYS - 1, Math.floor(i / DAILY_REVIVE_TARGET));
    // 0-6h 内 deterministic jitter，避免一秒钟内大批同时到期
    const jitter = ((i * 37) % 360) * 60_000; // 0 - 6h in 1-minute steps
    return {
      ...m,
      nextReviewAt: tomorrowStart + dayOffset * DAY_MS + jitter,
    };
  });

  return { keepToday, spread };
}

/**
 * 今日复活是否"顺利"——决定是否在闭环后继续鼓励再来 5 道。
 *
 * 入参是今日 review-mode session 内的 attempts 数据（从 attempts 表 + question 表
 * crosslook 出 estimated 时间，调用方组装好传进来）。
 *
 * 顺利定义：
 *   - 至少 5 个样本（少于 5 信号噪声大）
 *   - 答对率 > 70%
 *   - 平均答题时间 < 估计时间的 80%（比平时快 ≥ 20%）
 */
export function shouldEncourageMore(
  attempts: { isCorrect: boolean; elapsedSeconds: number; estimatedSeconds: number }[],
): boolean {
  if (attempts.length < 5) return false;
  const correctCount = attempts.filter((a) => a.isCorrect).length;
  const accuracy = correctCount / attempts.length;
  if (accuracy <= 0.7) return false;
  const totalElapsed = attempts.reduce((s, a) => s + a.elapsedSeconds, 0);
  const totalEstimated = attempts.reduce((s, a) => s + a.estimatedSeconds, 0);
  if (totalEstimated <= 0) return false;
  return totalElapsed / totalEstimated < 0.8;
}

/**
 * 今日"还要做几道"才算闭环。
 * @param dueCount        当前到期错题数（spread 之后的）
 * @param revivedToday    今日已成功推进的错题数
 * @returns 还需复活的道数（≥ 0）
 */
export function remainingForToday(dueCount: number, revivedToday: number): number {
  const totalToday = dueCount + revivedToday;
  const target = Math.min(DAILY_REVIVE_TARGET, totalToday);
  return Math.max(0, target - revivedToday);
}
