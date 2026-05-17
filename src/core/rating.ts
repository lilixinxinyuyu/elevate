/**
 * 综合评分 v6：纯 XP 累计，每学期一局，无上限。
 *
 * 设计哲学：
 * - 学生答的每道题给 XP（scoring.ts::scoreAttempt 已经处理：base × 难度 × 答对系数 × 连击 + 各种奖励 - 提示惩罚）
 * - 学期内 attempts 的 XP 累加 = 当前赛季分数
 * - **没有上限**——每答一题都加分。学期结束清零下学期重开。
 * - 上册 / 下册 / 综合复习 是独立赛季，互不串。
 *
 * 段位区间（XP 尺度，与 tiers.ts 一致）：
 *   0-10k    🏫 和平街小学
 *   10k-22k  🏛️ 锦江区
 *   22k-32k  🌆 成都市
 *   32k-40k  🐼 四川省
 *   40k+     🇨🇳 全国（无上限）
 *
 * 4 月 perfect 选手 ≈ 48,000 XP（120 天 × 18 题/天 × ~22 XP/题）。
 *
 * 这个文件还导出"能力诊断"composite 分数（accuracy/mastery/streak/volume）
 * 给 admin 用，但**主显示是 XP**。
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
  subTierLabel,
  subTierLabelDynamic,
  subTierBounds,
  SUB_TIER_NAMES,
  TIER_PREFIXES,
} from "./tiers";

const SKILL_MAP = new Map(SKILLS.map((s) => [s.id, s]));
const UNIT_MAP = new Map(UNITS.map((u) => [u.id, u]));

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

// ============ 共用工具 ============

function localDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function termOfSkill(skillId: string): Term | null {
  const skill = SKILL_MAP.get(skillId);
  if (!skill) return null;
  const unit = UNIT_MAP.get(skill.unitId);
  return unit?.term ?? null;
}

export function skillCountInTerm(term: Term): number {
  let n = 0;
  for (const s of SKILLS) {
    const unit = UNIT_MAP.get(s.unitId);
    if (unit?.term === term) n++;
  }
  return n;
}

export function filterByTerm<T extends { skillId: string }>(items: T[], term: Term): T[] {
  return items.filter((it) => termOfSkill(it.skillId) === term);
}

// ============ 主入口：computeRating（XP-based） ============

export interface RatingResult {
  /** 累计 XP（这个学期内 attempts 的 scoreDelta.total 之和，无上限） */
  score: number;
  tier: Tier;
  nextTier: Tier | null;
  progressInTier: number;
  percentSurpassed: number;
  deltaToNext: number;
  subRank: number;
  subRankRoman: string;
  subRankStars: string;
  deltaToNextSubRank: number;
  /** v0.31.50: 完整称号，例如 "锦江数学课代表" */
  subTierLabel: string;
  /** v0.31.50: 当前小段位 0-1 进度（短进度条用） */
  subTierProgress: number;
  /** v0.31.50: 当前小段位已积累的 XP（例如 480/600 中的 480） */
  subTierInto: number;
  /** v0.31.50: 当前小段位总宽度（例如 480/600 中的 600） */
  subTierSize: number;
  /** v0.31.50: 下一个小段位的称号；本段顶（V）时是 next 大段的"爱好者"；全国顶时为 null */
  nextSubTierLabel: string | null;
  term: Term | null;
  /** 给家长 admin 看的辅助指标 */
  raw: {
    totalAttempts: number;
    correctAttempts: number;
    accuracy: number;
    avgXpPerAttempt: number;
    streak: number;
    cumulativeDays: number;
    skillsPracticed: number;
  };
}

/**
 * 学期赛季分：把这个学期的所有 attempt 的 XP（scoreDelta.total）加起来。
 *
 * `term=null` → 所有 attempts（旧行为）。
 */
export function computeRating(
  attempts: Attempt[],
  mastery: MasteryScore[],
  _now: number = Date.now(),
  term: Term | null = null,
  // v0.34.82 iter 16: 同学学校名 (来自 profile.school), 用于动态 tier prefix
  // 替代 hardcoded "和平街". null/未填 → fallback 老前缀.
  schoolName: string | null = null,
): RatingResult {
  const filteredAttempts = term ? filterByTerm(attempts, term) : attempts;
  const filteredMastery = term ? filterByTerm(mastery, term) : mastery;

  // 主：XP 累计
  const score = filteredAttempts.reduce((sum, a) => sum + (a.scoreDelta?.total ?? 0), 0);

  // 辅：诊断指标
  const totalAttempts = filteredAttempts.length;
  const correctAttempts = filteredAttempts.filter((a) => a.isCorrect).length;
  const accuracy = totalAttempts > 0 ? correctAttempts / totalAttempts : 0;
  const avgXpPerAttempt = totalAttempts > 0 ? score / totalAttempts : 0;

  const days = new Set(filteredAttempts.map((a) => localDayKey(a.createdAt)));
  const cumulativeDays = days.size;
  let streak = 0;
  const cursor = new Date();
  if (!days.has(localDayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(localDayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  const skillsPracticed = filteredMastery.filter((m) => SKILL_MAP.has(m.skillId)).length;

  // 段位映射
  const tier = tierFromScore(score);
  const next = nextTier(tier);
  const sub = subRank(score, tier);
  const bounds = subTierBounds(score, tier, sub);
  const deltaToNextSubRank = Math.max(0, Math.ceil(bounds.hi - score));
  const curSubTierLabel = subTierLabelDynamic(tier, sub, schoolName);
  // 下一个小段位称号：
  //   - sub 1-4：同段位下一档（"锦江数学小达人"）
  //   - sub 5（已 V，本段顶）：跨大段，下一段第 1 档（"成都数学爱好者"）
  //   - 全国 V：null（已封顶）
  const nextSubTierLabel: string | null = (() => {
    if (sub < SUB_TIER_NAMES.length) {
      return subTierLabelDynamic(tier, sub + 1, schoolName);
    }
    if (next) {
      return subTierLabelDynamic(next, 1, schoolName);
    }
    return null;
  })();

  return {
    score,
    tier,
    nextTier: next,
    progressInTier: progressInTier(score, tier),
    percentSurpassed: percentSurpassed(score, tier),
    deltaToNext: deltaToNextTier(score, tier),
    subRank: sub,
    subRankRoman: subRankRoman(sub),
    subRankStars: subRankStars(sub),
    deltaToNextSubRank,
    subTierLabel: curSubTierLabel,
    subTierProgress: bounds.progress,
    subTierInto: Math.max(0, Math.round(bounds.into)),
    subTierSize: Math.round(bounds.size),
    nextSubTierLabel,
    term,
    raw: {
      totalAttempts,
      correctAttempts,
      accuracy,
      avgXpPerAttempt,
      streak,
      cumulativeDays,
      skillsPracticed,
    },
  };
}

// ============ 能力诊断（给家长 admin 用，0-1000 综合分）============
//
// v0.30.12 重写：参考 Khan Academy 的 "% skills mastered" + iOS Elevate 的
// 多游戏覆盖度，把"题量"换成"覆盖广度"——防"姊妹题刷分"虚高。
//
// 旧 volume = log10(totalAttempts) × 60 - 50：1000 道全是同 skill 的姊妹题也能
// 拿 130/150（87%）。Selena 已经接近 1000 题，再练就刷分。
//
// 新 volume（components 字段名沿用，避免破坏 sync schema）实际语义是"覆盖广度"：
//   每个 skill 最多贡献 5 分（按 unique correct 数封顶），
//   累加所有 skill = min(150, sum)。
//
// 后果：
//   - 1 skill 30 道 unique 正确  →  5/150  = 3%  （强烈反 farm）
//   - 30 skills × 5 unique 正确  →  150/150 = 100%（覆盖完美）
//   - 30 skills × 1 unique 正确  →  30/150  = 20% （有广度但浅）
//
// 跟之前比，sister-question 刷分基本被堵死。学习健康度反而更准。

export interface AbilityDiagnostic {
  /** 综合能力分 0-1000（独立于 XP 的"质量"指标） */
  score: number;
  components: { accuracy: number; mastery: number; continuity: number; volume: number };
  raw: {
    accuracy7d: number;
    rawWeightedMastery: number;
    weightedMastery: number;
    avgUniqueQuestionsPerSkill: number;
    skillsPracticed: number;
    breadthFactor: number;
    streak: number;
    cumulativeDays: number;
    totalAttempts: number;
    /** v0.30.12: 总 unique 答对题数（去重 questionId）。给家长展示用，比 totalAttempts 诚实 */
    uniqueQuestionsCorrect: number;
    /** v0.30.12: 覆盖广度积分 = sum across skills of min(5, uniqueCorrectInSkill). 0-150 */
    skillCoverageScore: number;
  };
}

const ACC_BASE = 0.5;
const ACC_MAX = 250;
const MASTERY_MAX = 400;
const MASTERY_MULT = 4;
const MASTERY_BASE_CAP = 40;
const UNIQUE_Q_PER_LEVEL = 5;
const CONT_MAX = 200;
const VOL_MAX = 150;
/** v0.30.12: 单 skill 对覆盖度的最大贡献（unique correct 数封顶）—— 反"姊妹题刷分"的核心 */
const SKILL_COVERAGE_CAP_PER_SKILL = 5;
/** v0.30.12: warmup 用 unique correct 数（不是 totalAttempts），防刷量充满 warmup */
const ACC_WARMUP_UNIQUE = 30;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function computeAbilityDiagnostic(
  attempts: Attempt[],
  mastery: MasteryScore[],
  term: Term | null = null,
  now: number = Date.now(),
): AbilityDiagnostic {
  const filteredAttempts = term ? filterByTerm(attempts, term) : attempts;
  const filteredMastery = term ? filterByTerm(mastery, term) : mastery;

  // v0.30.12: 准确率算 effective correct（tutor-correct 0.5 半信半疑），
  // 跟 mastery weighted accuracy 一致，防"用 tutor 刷高准确率"
  const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
  const recent = filteredAttempts.filter((a) => a.createdAt >= cutoff7d);
  let recentEffectiveCorrect = 0;
  for (const a of recent) {
    if (!a.isCorrect) continue;
    recentEffectiveCorrect += a.usedTutor ? 0.5 : 1;
  }
  const acc7d = recent.length === 0 ? 0 : recentEffectiveCorrect / recent.length;

  // 独立题数封顶 mastery + 计 unique correct per skill（v0.30.12 给 coverage 用）
  const uniqueQByskill = new Map<string, Set<string>>();
  const uniqueCorrectByskill = new Map<string, Set<string>>();
  for (const a of filteredAttempts) {
    if (!uniqueQByskill.has(a.skillId)) uniqueQByskill.set(a.skillId, new Set());
    uniqueQByskill.get(a.skillId)!.add(a.questionId);
    if (a.isCorrect) {
      if (!uniqueCorrectByskill.has(a.skillId)) uniqueCorrectByskill.set(a.skillId, new Set());
      uniqueCorrectByskill.get(a.skillId)!.add(a.questionId);
    }
  }
  let totalW = 0, weightedSum = 0, rawSum = 0, skillCount = 0;
  for (const m of filteredMastery) {
    const skill = SKILL_MAP.get(m.skillId);
    if (!skill) continue;
    skillCount += 1;
    const uniq = uniqueQByskill.get(m.skillId)?.size ?? 0;
    const cap = Math.min(100, MASTERY_BASE_CAP + uniq * UNIQUE_Q_PER_LEVEL);
    const eff = Math.min(m.score, cap);
    const w = EXAM_PRIORITY_WEIGHT[skill.examPriority] ?? 0.4;
    totalW += w;
    weightedSum += eff * w;
    rawSum += m.score * w;
  }
  const weightedMastery = totalW > 0 ? weightedSum / totalW : 0;
  const rawWeightedMastery = totalW > 0 ? rawSum / totalW : 0;

  const target = term ? Math.max(1, skillCountInTerm(term)) : 30;
  const breadth = Math.min(1.0, skillCount / target);

  const days = new Set(filteredAttempts.map((a) => localDayKey(a.createdAt)));
  const cumDays = days.size;
  let streak = 0;
  const cursor = new Date();
  if (!days.has(localDayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(localDayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const totalAttempts = filteredAttempts.length;

  // v0.30.12: warmup 用 unique correct 数，防"刷量充满 warmup"
  let uniqueQuestionsCorrect = 0;
  uniqueCorrectByskill.forEach((s) => (uniqueQuestionsCorrect += s.size));
  const warmup = Math.min(1, uniqueQuestionsCorrect / ACC_WARMUP_UNIQUE);

  const accComp = clamp(((acc7d - ACC_BASE) / (1 - ACC_BASE)) * ACC_MAX * warmup, 0, ACC_MAX);
  const masComp = clamp(weightedMastery * breadth * MASTERY_MULT, 0, MASTERY_MAX);
  const contComp = clamp(streak * 5 + cumDays * 1.5, 0, CONT_MAX);

  // v0.30.12: volume 重写为 skillCoverage = sum across skills of min(5, uniqueCorrect)
  // 题量刷分被堵死：1 skill 100 道也只贡献 5 分；30 skill 各 5 道 = 150 满分。
  let skillCoverageScore = 0;
  uniqueCorrectByskill.forEach((s) => {
    skillCoverageScore += Math.min(SKILL_COVERAGE_CAP_PER_SKILL, s.size);
  });
  const volComp = clamp(skillCoverageScore, 0, VOL_MAX);

  let avgUniq = 0;
  if (uniqueQByskill.size > 0) {
    let total = 0;
    uniqueQByskill.forEach((s) => (total += s.size));
    avgUniq = total / uniqueQByskill.size;
  }

  return {
    score: Math.round(clamp(accComp + masComp + contComp + volComp, 0, 1000)),
    components: { accuracy: accComp, mastery: masComp, continuity: contComp, volume: volComp },
    raw: {
      accuracy7d: acc7d,
      rawWeightedMastery,
      weightedMastery,
      avgUniqueQuestionsPerSkill: avgUniq,
      skillsPracticed: skillCount,
      breadthFactor: breadth,
      streak,
      cumulativeDays: cumDays,
      totalAttempts,
      uniqueQuestionsCorrect,
      skillCoverageScore,
    },
  };
}

export { TIERS };
