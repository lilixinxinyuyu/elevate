/**
 * 综合评分 0-1000（Elevate 风格）。
 *
 * v2 校准（更严格，让"在和平街小学班里中等"的孩子真的落在 200-300 段）。
 *
 * 4 个分量（最大值约 230 + 500 + 130 + 140 = 1000）：
 * - 准确率 (0-230)：最近 7 天答题正确率。<50% → 0，100% → 230（线性）。
 * - 熟练度 (0-500)：weighted mastery × **广度因子** × 5
 *     广度因子 = min(1.0, num_skills_practiced / 35)
 *     —— 只练了几个 skill 不能因为 mastery 高就直接到全国
 * - 持续性 (0-130)：streak * 4 + 累计练习天数 * 1.5。
 *     —— 鼓励持续，但不让"刷天数"超过实际能力
 * - 题量   (0-140)：log10(attempts+1) * 60 - 50。
 *     —— 进步阶段加分快，过 1000 题后接近饱和
 *
 * 校准目标：Selena 当前数据（最近 7d 76% 准确率、8 天连胜、429 题、平均 mastery ~65、~7 个 skill 有记录）
 * → 综合分 ≈ 280-340，落在和平街小学 ★III/IV，再加把劲就出校了。
 *
 * 这与"在班里中等水平"的家长判断对得上。
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
  subRank,
  subRankRoman,
  subRankStars,
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
  /** 段内小段 1-4（★I/II/III/IV） */
  subRank: number;
  /** 段内小段罗马数字字符串 */
  subRankRoman: string;
  /** 段内小段星级字符串 ★★★☆ */
  subRankStars: string;
  /** 距离下一个小段（不是大段）还差多少分 */
  deltaToNextSubRank: number;
  /** 调试用：原始指标 */
  raw: {
    accuracy7d: number;
    weightedMastery: number;
    skillsPracticed: number;
    breadthFactor: number;
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

/** 加权 mastery 平均（按 examPriority），返回 0-100 */
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

/** 已练过的 skill 数（mastery 行存在的） */
export function countSkillsPracticed(mastery: MasteryScore[]): number {
  return mastery.filter((m) => SKILL_MAP.has(m.skillId)).length;
}

/** 广度因子：练得越多越接近 1.0；30 个 skill 满分（一年最多深度掌握 30 个 skill） */
export function breadthFactor(skillsPracticed: number, target = 30): number {
  return Math.min(1.0, skillsPracticed / target);
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
  const skillsPracticed = countSkillsPracticed(mastery);
  const breadth = breadthFactor(skillsPracticed);
  const streak = computeStreak(attempts, now);
  const cumulativeDays = computeCumulativeDays(attempts);
  const totalAttempts = attempts.length;

  // v2 校准：让"和平街小学班里中等"的孩子真的落在 200-300 段
  // 准确率 0-230：50% 起步，100% 满分 230
  const accuracyComp = clamp((acc7d - 0.5) / 0.5 * 230, 0, 230);

  // 熟练度 0-500：mastery × 广度因子 × 5
  // —— 关键：只练 7 个 skill 的人，breadth=0.2，mastery 100 也只拿 100/500
  const masteryComp = clamp(weightedMastery * breadth * 5, 0, 500);

  // 持续性 0-130：streak * 4 + cumDays * 1.5
  const continuityComp = clamp(streak * 4 + cumulativeDays * 1.5, 0, 130);

  // 题量 0-140：log10 曲线，过 1000 题接近饱和
  const volumeComp = clamp(Math.log10(totalAttempts + 1) * 60 - 50, 0, 140);

  const rawScore = accuracyComp + masteryComp + continuityComp + volumeComp;
  const score = Math.round(clamp(rawScore, 0, 1000));

  const tier = tierFromScore(score);
  const next = nextTier(tier);
  const sub = subRank(score, tier);
  // 距离下一个小段：score 到下一个 25% 边界的距离（或下一段起点）
  const tierLo = tier.range[0];
  const tierHi = tier.range[1];
  const subSize = (tierHi - tierLo) / 4;
  const nextSubBoundary = tierLo + subSize * sub; // 1→25%, 2→50%, 3→75%, 4→tierHi
  const deltaToNextSubRank = Math.max(0, Math.ceil(nextSubBoundary - score));

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
    subRank: sub,
    subRankRoman: subRankRoman(sub),
    subRankStars: subRankStars(sub),
    deltaToNextSubRank,
    raw: {
      accuracy7d: acc7d,
      weightedMastery,
      skillsPracticed,
      breadthFactor: breadth,
      streak,
      cumulativeDays,
      totalAttempts,
    },
  };
}

export { TIERS };
