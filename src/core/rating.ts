/**
 * 综合评分 v5：每学期一局，0-1000 分，4 个月 perfect = 全国（≈990+）。
 *
 * 核心模型：
 * - 每个学期（上册 / 下册 / ...）是独立的赛季
 * - 学期开始 = 0 分，4 个月 perfect = 顶段（全国）
 * - 段位金字塔分布：大多数孩子停在和平街小学
 *
 * 4 个分量（最大 = 250 + 400 + 200 + 150 = 1000）：
 * - 准确率 (0-250)：(acc-50%)/50% × 250 × warmup_factor
 *     warmup = min(1, attempts/100)，新手前 100 题不能直接拿满
 * - 熟练度 (0-400)：effective_mastery × breadth × 4
 *     effective = 真 mastery 被独立题数封顶（cap = 40 + 5×独立题数）
 *     breadth = min(1, 这学期练过的 skill / 全部 skill)
 * - 持续性 (0-200)：streak * 5 + cumDays * 1.5
 * - 题量 (0-150)：log10(attempts+1) × 60 - 50
 *
 * 段位映射（pyramid，与 tiers.ts 一致）：
 *   0-600   和平街小学   60% 孩子
 *   600-780 锦江区        25%
 *   780-880 成都市        10%
 *   880-960 四川省        4%
 *   960-1000 全国         1%（4 月 perfect）
 *
 * **学期过滤**：调用方传 termFilter，我们只用属于那个学期的 attempts/mastery 算分。
 * 上册/下册/综合复习 是独立的赛季，互不串。
 */
import type { Attempt, MasteryScore, Term } from "./types";
import { SKILLS } from "../content/skills";
import { UNITS } from "../content/units";
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
const UNIT_MAP = new Map(UNITS.map((u) => [u.id, u]));

// === CALIBRATION CONSTANTS ===========================================
const ACCURACY_BASELINE = 0.5;
const ACCURACY_MAX_POINTS = 250;
const ACCURACY_WARMUP_ATTEMPTS = 100;

const MASTERY_MAX_POINTS = 400;
const MASTERY_MULTIPLIER = 4;
const MASTERY_BASE_CAP = 40;
const UNIQUE_Q_PER_LEVEL = 5;
// 学期内目标 skill 数（下册有 ~30 个，上册 ~20 个）。这个值后面会按学期动态算
const MASTERY_BREADTH_DEFAULT_TARGET = 25;

const CONTINUITY_MAX_POINTS = 200;
const CONTINUITY_STREAK_WEIGHT = 5;
const CONTINUITY_CUMDAYS_WEIGHT = 1.5;

const VOLUME_MAX_POINTS = 150;
const VOLUME_LOG_MULTIPLIER = 60;
const VOLUME_LOG_OFFSET = 50;

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
  /** 综合分 0-1000 */
  score: number;
  components: RatingComponents;
  tier: Tier;
  nextTier: Tier | null;
  progressInTier: number;
  percentSurpassed: number;
  deltaToNext: number;
  subRank: number;
  subRankRoman: string;
  subRankStars: string;
  /** 距离下一个小段还差多少分 */
  deltaToNextSubRank: number;
  /** 这次评分对应的学期（用于显示"四下 / 四上"） */
  term: Term | null;
  raw: {
    accuracy7d: number;
    rawWeightedMastery: number;
    weightedMastery: number;
    skillsPracticed: number;
    breadthFactor: number;
    breadthTarget: number;
    avgUniqueQuestionsPerSkill: number;
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

/** 给定 skillId，查它属于哪个 term（上册 / 下册 / 综合复习） */
export function termOfSkill(skillId: string): Term | null {
  const skill = SKILL_MAP.get(skillId);
  if (!skill) return null;
  const unit = UNIT_MAP.get(skill.unitId);
  return unit?.term ?? null;
}

/** 该 term 共有多少个 skill（用于动态 breadth target） */
export function skillCountInTerm(term: Term): number {
  let n = 0;
  for (const s of SKILLS) {
    const unit = UNIT_MAP.get(s.unitId);
    if (unit?.term === term) n++;
  }
  return n;
}

/** 把 attempts/mastery 过滤到只包含某个学期的 skill */
export function filterByTerm<T extends { skillId: string }>(items: T[], term: Term): T[] {
  return items.filter((it) => termOfSkill(it.skillId) === term);
}

export function computeAccuracy7d(attempts: Attempt[], now = Date.now()): number {
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;
  const recent = attempts.filter((a) => a.createdAt >= cutoff);
  if (recent.length === 0) return 0;
  return recent.filter((a) => a.isCorrect).length / recent.length;
}

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

export function countSkillsPracticed(mastery: MasteryScore[]): number {
  return mastery.filter((m) => SKILL_MAP.has(m.skillId)).length;
}

export function breadthFactor(skillsPracticed: number, target: number): number {
  return Math.min(1.0, skillsPracticed / target);
}

export function computeStreak(attempts: Attempt[], now = Date.now()): number {
  if (attempts.length === 0) return 0;
  const days = new Set(attempts.map((a) => localDayKey(a.createdAt)));
  let streak = 0;
  const cursor = new Date(now);
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
 *
 * 如果传 term，就只用那个学期的数据。否则用全部（旧行为）。
 */
export function computeRating(
  attempts: Attempt[],
  mastery: MasteryScore[],
  now: number = Date.now(),
  term: Term | null = null,
): RatingResult {
  // 学期过滤
  const filteredAttempts = term ? filterByTerm(attempts, term) : attempts;
  const filteredMastery = term ? filterByTerm(mastery, term) : mastery;

  const acc7d = computeAccuracy7d(filteredAttempts, now);
  const cappedMastery = effectiveMastery(filteredMastery, filteredAttempts);
  const weightedMastery = computeWeightedMastery(cappedMastery);
  const skillsPracticed = countSkillsPracticed(filteredMastery);
  // breadth 目标：该学期总 skill 数（动态）；没传 term 用默认值
  const breadthTarget = term ? Math.max(1, skillCountInTerm(term)) : MASTERY_BREADTH_DEFAULT_TARGET;
  const breadth = breadthFactor(skillsPracticed, breadthTarget);
  const streak = computeStreak(filteredAttempts, now);
  const cumulativeDays = computeCumulativeDays(filteredAttempts);
  const totalAttempts = filteredAttempts.length;

  // 准确率 + warmup（新手前 100 题不能直接拿满）
  const warmupFactor = Math.min(1, totalAttempts / ACCURACY_WARMUP_ATTEMPTS);
  const accuracyComp = clamp(
    ((acc7d - ACCURACY_BASELINE) / (1 - ACCURACY_BASELINE)) * ACCURACY_MAX_POINTS * warmupFactor,
    0,
    ACCURACY_MAX_POINTS,
  );

  const masteryComp = clamp(
    weightedMastery * breadth * MASTERY_MULTIPLIER,
    0,
    MASTERY_MAX_POINTS,
  );

  const continuityComp = clamp(
    streak * CONTINUITY_STREAK_WEIGHT + cumulativeDays * CONTINUITY_CUMDAYS_WEIGHT,
    0,
    CONTINUITY_MAX_POINTS,
  );

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
  const tierLo = tier.range[0];
  const tierHi = tier.range[1];
  const subSize = (tierHi - tierLo) / 4;
  const nextSubBoundary = tierLo + subSize * sub;
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
    term,
    raw: {
      accuracy7d: acc7d,
      rawWeightedMastery: computeWeightedMastery(filteredMastery),
      weightedMastery,
      skillsPracticed,
      breadthFactor: breadth,
      breadthTarget,
      avgUniqueQuestionsPerSkill: (() => {
        const set = new Map<string, Set<string>>();
        for (const a of filteredAttempts) {
          if (!set.has(a.skillId)) set.set(a.skillId, new Set());
          set.get(a.skillId)!.add(a.questionId);
        }
        if (set.size === 0) return 0;
        let total = 0;
        set.forEach((s) => (total += s.size));
        return total / set.size;
      })(),
      streak,
      cumulativeDays,
      totalAttempts,
    },
  };
}

export { TIERS };
