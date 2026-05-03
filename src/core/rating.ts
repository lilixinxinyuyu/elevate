/**
 * 综合评分 0-1000（v3 校准）。
 *
 * 设计哲学：
 * - **大多数孩子的家是和平街小学（0-700, 70%）**。突破出去是真本事。
 * - 真实游戏的金字塔分布：上一段比下一段难得多。
 * - 反"刷分"：题库小、重复做、强制打卡 都不该让分数虚高。
 *
 * 4 个分量（最大 = 250 + 400 + 200 + 150 = 1000）。当前预算：
 * - 准确率 (0-250)：最近 7 天答题正确率。<50% → 0，100% → 250 线性。
 * - 熟练度 (0-400)：effective_mastery × 广度因子 × 4
 *     **effective_mastery** = 真 mastery 但被"独立题数"封顶
 *       cap_per_skill = min(100, MASTERY_BASE_CAP + UNIQUE_Q_PER_LEVEL × 看过的独立题数)
 *       默认 cap = 40 + 5×N。看过 1 道独立题 cap=45；12 道 cap=100。
 *       —— 杀死"刷 5 道题刷 50 次堆 mastery 90"的漏洞
 *     广度因子 = min(1.0, num_skills_practiced / 30)
 * - 持续性 (0-200)：streak * 5 + 累计练习天数 * 1.5
 * - 题量 (0-150)：log10(attempts+1) * 60 - 50
 *     —— 200 题后接近饱和。不让"刷题量"超过实际能力。
 *
 * 单分量满分总和 1000 —— 真正的"完美选手"才能进 全国 段。
 * 大多数孩子（哪怕勤奋）天花板在 500-700（和平街小学 ★III-IV）。
 *
 * 所有"魔法数字"都在下面 CALIBRATION 常量里，想调整改这一处就行。
 */

// === CALIBRATION CONSTANTS ===========================================
// 想让分数更难拿，把这些数字调小；想更容易，调大。
const ACCURACY_BASELINE = 0.5;        // 准确率起点（< baseline → 0 分）
const ACCURACY_MAX_POINTS = 250;
const MASTERY_MAX_POINTS = 400;
const MASTERY_MULTIPLIER = 4;         // weighted_mastery × breadth × 这个 = mastery_comp
const MASTERY_BASE_CAP = 40;          // 没看过任何独立题时 mastery 最高只能 40
const UNIQUE_Q_PER_LEVEL = 5;         // 每多看 1 道独立题，mastery cap +5
const MASTERY_BREADTH_TARGET = 30;    // 练满 30 个 skill 广度因子=1.0
const CONTINUITY_MAX_POINTS = 200;
const CONTINUITY_STREAK_WEIGHT = 5;
const CONTINUITY_CUMDAYS_WEIGHT = 1.5;
const VOLUME_MAX_POINTS = 150;
const VOLUME_LOG_MULTIPLIER = 60;
const VOLUME_LOG_OFFSET = 50;
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
    /** 真 mastery 加权平均（未封顶） */
    rawWeightedMastery: number;
    /** 经过"独立题数封顶"后的 mastery 加权平均 */
    weightedMastery: number;
    skillsPracticed: number;
    /** 平均每个 skill 看过多少道独立题（用于诊断重复刷题） */
    avgUniqueQuestionsPerSkill: number;
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

/**
 * effective_mastery：把真实 mastery 按"看过的独立题数量"封顶。
 *
 * 漏洞场景：题库只有 5 道题，孩子做 50 次都对，mastery EWMA 上去到 90。
 * 修复：你只见过 5 道独立题 → mastery 最高只能到 65（40 + 5×5）。
 *
 * 返回的是 mastery 数组的"等价"版本——每个 score 已经按独立题数封顶过。
 */
export function effectiveMastery(
  mastery: MasteryScore[],
  attempts: Attempt[],
): MasteryScore[] {
  const uniqueQByskill = new Map<string, Set<string>>();
  for (const a of attempts) {
    if (!uniqueQByskill.has(a.skillId)) uniqueQByskill.set(a.skillId, new Set());
    uniqueQByskill.get(a.skillId)!.add(a.questionId);
  }
  return mastery.map((m) => {
    const uniq = uniqueQByskill.get(m.skillId)?.size ?? 0;
    const cap = Math.min(100, MASTERY_BASE_CAP + uniq * UNIQUE_Q_PER_LEVEL);
    return { ...m, score: Math.min(m.score, cap) };
  });
}

/** 加权 mastery 平均（按 examPriority），返回 0-100。建议先经过 effectiveMastery 处理 */
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

/** 广度因子：练得越多越接近 1.0；MASTERY_BREADTH_TARGET 个 skill 满分 */
export function breadthFactor(skillsPracticed: number, target = MASTERY_BREADTH_TARGET): number {
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
  // 关键：mastery 先按独立题数封顶，再加权平均
  const cappedMastery = effectiveMastery(mastery, attempts);
  const weightedMastery = computeWeightedMastery(cappedMastery);
  const skillsPracticed = countSkillsPracticed(mastery);
  const breadth = breadthFactor(skillsPracticed);
  const streak = computeStreak(attempts, now);
  const cumulativeDays = computeCumulativeDays(attempts);
  const totalAttempts = attempts.length;

  // 准确率：< baseline → 0；100% → MAX
  const accuracyComp = clamp(
    ((acc7d - ACCURACY_BASELINE) / (1 - ACCURACY_BASELINE)) * ACCURACY_MAX_POINTS,
    0,
    ACCURACY_MAX_POINTS,
  );

  // 熟练度：effective mastery × 广度 × 倍率
  const masteryComp = clamp(weightedMastery * breadth * MASTERY_MULTIPLIER, 0, MASTERY_MAX_POINTS);

  // 持续性
  const continuityComp = clamp(
    streak * CONTINUITY_STREAK_WEIGHT + cumulativeDays * CONTINUITY_CUMDAYS_WEIGHT,
    0,
    CONTINUITY_MAX_POINTS,
  );

  // 题量（log10 曲线）
  const volumeComp = clamp(
    Math.log10(totalAttempts + 1) * VOLUME_LOG_MULTIPLIER - VOLUME_LOG_OFFSET,
    0,
    VOLUME_MAX_POINTS,
  );

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
      rawWeightedMastery: computeWeightedMastery(mastery),
      weightedMastery,
      skillsPracticed,
      avgUniqueQuestionsPerSkill: (() => {
        const set = new Map<string, Set<string>>();
        for (const a of attempts) {
          if (!set.has(a.skillId)) set.set(a.skillId, new Set());
          set.get(a.skillId)!.add(a.questionId);
        }
        if (set.size === 0) return 0;
        let total = 0;
        set.forEach((s) => (total += s.size));
        return total / set.size;
      })(),
      breadthFactor: breadth,
      streak,
      cumulativeDays,
      totalAttempts,
    },
  };
}

export { TIERS };
