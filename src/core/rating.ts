/**
 * 综合评分 0-1000（Elevate 风格）。
 *
 * 4 个分量：
 * - 准确率 (0-300)：最近 7 天答题正确率。<50% → 0，100% → 300（线性）。
 * - 熟练度 (0-300)：所有有记录的 skill mastery 平均，按 examPriority 加权。
 * - 持续性 (0-200)：streak * 5 + 累计练习天数 * 2，截断 200。
 * - 题量   (0-200)：log10(attempts+1) * 80 - 50，截断 0-200。
 *
 * 校准目标：Selena 当前数据（最近 7d 76% 准确率、8 天连胜、429 题、平均 mastery ~65）
 * → 综合分 ≈ 570，落在锦江区中段，下一档（成都市）就在前方。
 */
import type { Attempt, MasteryScore } from "./types";
import { SKILLS } from "../content/skills";
import {
  TIERS,
  type Tier,
  tierFromScore,
  nextTier,
  percentSurpassed,
  deltaToNextTier,
  progressInTier,
} from "./tiers";

const SKILL_MAP = new Map(SKILLS.map((s) => [s.id, s]));

/** 与 scheduler.ts 保持一致 */
const EXAM_PRIORITY_WEIGHT: Record<string, number> = {
  MUST_BIG: 1.0,
  HIGH_BIG: 0.85,
  MUST_SMALL: 0.75,
  VERY_HIGH_SMALL: 0.7,
  HIGH_SMALL: 0.6,
  NORMAL: 0.4,
  LOW_SMALL: 0.25,
  LOW: 0.2,
  EXTENSION: 0.1,
};

export interface RatingComponents {
  accuracy: number;
  mastery: number;
  continuity: number;
  volume: number;
}

export interface RatingResult {
  /** 综合分 0-1000，整数 */
  score: number;
  /** 4 个分量原始值（未取整） */
  components: RatingComponents;
  /** 当前所在段位 */
  tier: Tier;
  /** 下一段（最高段为 null） */
  nextTier: Tier | null;
  /** 段位内进度 0-1 */
  progressInTier: number;
  /** "你超过了 X% 同年级"（友好曲线） */
  percentSurpassed: number;
  /** 距离下一段还差多少分 */
  deltaToNext: number;
  /** 调试用：原始指标 */
  raw: {
    accuracy7d: number;
    weightedMastery: number;
    streak: number;
    cumulativeDays: number;
    totalAttempts: number;
  };
}

function localDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** 最近 7 天准确率（不含今天的话也算到今天为止的 7 天窗口） */
export function computeAccuracy7d(attempts: Attempt[], now = Date.now()): number {
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;
  const recent = attempts.filter((a) => a.createdAt >= cutoff);
  if (recent.length === 0) return 0;
  return recent.filter((a) => a.isCorrect).length / recent.length;
}

/** 加权 mastery 平均（按 examPriority） */
export function computeWeightedMastery(mastery: MasteryScore[]): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const m of mastery) {
    const skill = SKILL_MAP.get(m.skillId);
    if (!skill) continue;
    const w = EXAM_PRIORITY_WEIGHT[skill.examPriority] ?? 0.4;
    totalWeight += w;
    weightedSum += m.score * w;
  }
  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}

/** 当前连续天数（截至今天，往回数） */
export function computeStreak(attempts: Attempt[], now = Date.now()): number {
  if (attempts.length === 0) return 0;
  const days = new Set(attempts.map((a) => localDayKey(a.createdAt)));
  let streak = 0;
  const cursor = new Date(now);
  // 今天没练 → 从昨天起算
  if (!days.has(localDayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(localDayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeCumulativeDays(attempts: Attempt[]): number {
  return new Set(attempts.map((a) => localDayKey(a.createdAt))).size;
}

/**
 * 主入口：计算综合分。
 */
export function computeRating(
  attempts: Attempt[],
  mastery: MasteryScore[],
  now = Date.now(),
): RatingResult {
  const acc7d = computeAccuracy7d(attempts, now);
  const weightedMastery = computeWeightedMastery(mastery);
  const streak = computeStreak(attempts, now);
  const cumulativeDays = computeCumulativeDays(attempts);
  const totalAttempts = attempts.length;

  // 准确率 0-300：50% 起步，100% 满
  const accuracyComp = clamp((acc7d - 0.5) / 0.5 * 300, 0, 300);

  // 熟练度 0-300：mastery 0-100 线性映射 * 3
  const masteryComp = clamp(weightedMastery * 3, 0, 300);

  // 持续性 0-200：streak * 5 + cumDays * 2
  const continuityComp = clamp(streak * 5 + cumulativeDays * 2, 0, 200);

  // 题量 0-200：log10 曲线，避免刷量
  const volumeComp = clamp(Math.log10(totalAttempts + 1) * 80 - 50, 0, 200);

  const rawScore = accuracyComp + masteryComp + continuityComp + volumeComp;
  const score = Math.round(clamp(rawScore, 0, 1000));

  const tier = tierFromScore(score);
  const next = nextTier(tier);

  return {
    score,
    components: {
      accuracy: accuracyComp,
      mastery: masteryComp,
      continuity: continuityComp,
      volume: volumeComp,
    },
    tier,
    nextTier: next,
    progressInTier: progressInTier(score, tier),
    percentSurpassed: percentSurpassed(score, tier),
    deltaToNext: deltaToNextTier(score, tier),
    raw: {
      accuracy7d: acc7d,
      weightedMastery,
      streak,
      cumulativeDays,
      totalAttempts,
    },
  };
}

export { TIERS };
