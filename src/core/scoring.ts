import type { AbilityId, Question } from "./types";

export interface ScoreInput {
  question: Question;
  isCorrect: boolean;
  partialCorrect?: boolean;
  multiStepAllStepsCorrect?: boolean;
  hintsOpened: number;
  elapsedSeconds: number;
  isReview: boolean;
  comboAfter: number; // 本题答完后的连击数
  /** 之前答对过这道题几次（仅 isCorrect=true 的次数）。0 = 第一次答对（无递减） */
  priorCorrectCount?: number;
  /** 是否是该 skill 的首次答对（学到新知识点 +5 XP） */
  isNewSkill?: boolean;
  /**
   * v0.30.7: 这次答题前是否打开过"小进讲题"。
   * usedTutor + isCorrect → tutor-assisted 答对：基础分 ×0.7、无 combo 倍率、
   * 无速度奖励、无新 skill 奖励、无复习奖励。本质上"借助讲解才答对"，
   * 不能跟独立答对等价计 XP。
   */
  usedTutor?: boolean;
  /**
   * v0.30.7: 同一道题在本 session 里第几次作答（1 / 2）。
   * - 1: 第一次作答（正常加成）
   * - 2: 1st 错答之后的重做提交（无 combo/无速度奖励，因为已经有了"先错"的事实）
   * 注：对 isCorrect=true & attemptOrdinal=2 但 usedTutor=false 的情况——
   *     即"自己想通了再做对"——还是给 base XP（独立学习），但没 combo/速度。
   */
  attemptOrdinal?: 1 | 2;
}

export interface ScoreDelta {
  total: number;
  byAbility: Partial<Record<AbilityId, number>>;
  base: number;
  hintPenalty: number;
  comboMul: number;
  timeBonus: number;
  /** 重做递减倍率（0-1）。1.0 = 首次答对；0.5/0.2/0.1 = 第 2/3/4 次；0 = 第 5+ 次 */
  repeatDecay: number;
  /** 新知识点首次答对的奖励 XP（5 或 0） */
  newSkillBonus: number;
}

export function comboMultiplier(combo: number): number {
  if (combo >= 10) return 2.0;
  if (combo >= 5) return 1.5;
  if (combo >= 3) return 1.2;
  return 1.0;
}

/**
 * 重复递减倍率：同一道题已经答对过 N 次后，再次答对的 XP 倍率。
 * 配合 priorCorrectCount 使用：
 *   priorCorrect 0 (本次是第 1 次对) → 1.0 (满分)
 *   priorCorrect 1 (本次是第 2 次对) → 0.5
 *   priorCorrect 2 (本次是第 3 次对) → 0.2
 *   priorCorrect 3 (本次是第 4 次对) → 0.1
 *   priorCorrect 4+ (第 5 次以后)   → 0   （**纯刷量不加分**）
 *
 * 累计：一道题最多挤出 1.0+0.5+0.2+0.1 = 1.8 倍 base XP。
 */
export const REPEAT_DECAY = [1.0, 0.5, 0.2, 0.1] as const;
export const NEW_SKILL_BONUS = 5;

export function repeatDecayMultiplier(priorCorrectCount: number): number {
  if (priorCorrectCount < 0) return 1.0;
  if (priorCorrectCount >= REPEAT_DECAY.length) return 0;
  return REPEAT_DECAY[priorCorrectCount] ?? 0;
}

/**
 * 阶梯速度奖励（v0.28.1）— 像 iOS Elevate 那样"越快分越多"。
 *
 *   < 50% 估算时间  →  +5 XP "⚡⚡ 闪电"
 *   < 80%           →  +3 XP "⚡ 迅速"
 *   ≤ 100%          →  +2 XP "✓ 及时"  (老版本只有这一档)
 *   ≤ 150%          →   0    "⏰ 超时"  (题主动答对仍计正确，但不给奖励)
 *   > 150%          →  -1 XP "🐢 拖拉" (超时太多减一分，提醒注意速度)
 *
 * 注意：超时 150% 后 GameShell 已经 auto-submit；这里只是兜底。
 * 仅 isCorrect=true 时计算，错答不奖也不罚速度。
 */
export function speedBonus(elapsedSeconds: number, estimatedSeconds: number, isCorrect: boolean): {
  bonus: number;
  tier: "lightning" | "quick" | "on_time" | "overdue" | "slow";
} {
  if (!isCorrect) return { bonus: 0, tier: "on_time" };
  const ratio = elapsedSeconds / Math.max(1, estimatedSeconds);
  if (ratio < 0.5) return { bonus: 5, tier: "lightning" };
  if (ratio < 0.8) return { bonus: 3, tier: "quick" };
  if (ratio <= 1.0) return { bonus: 2, tier: "on_time" };
  if (ratio <= 1.5) return { bonus: 0, tier: "overdue" };
  return { bonus: -1, tier: "slow" };
}

/** v0.30.7: tutor-assisted correct 的 base 分倍率（70%） */
export const TUTOR_ASSISTED_FACTOR = 0.7;

export function scoreAttempt(input: ScoreInput): ScoreDelta {
  const { question, isCorrect, hintsOpened, elapsedSeconds, isReview, multiStepAllStepsCorrect, comboAfter } = input;
  const usedTutor = !!input.usedTutor;
  const isSecondAttempt = (input.attemptOrdinal ?? 1) === 2;

  // v0.30.7：tutor-assisted 答对 = "借助讲解才答对"，所有奖励降权
  const tutorAssisted = isCorrect && usedTutor;
  // 不享受 combo/速度奖励的 case：1) 2nd 提交（已有"先错"事实）2) tutor-assisted（防御性，
  // 实际上 usedTutor=true 永远跟 ordinal=2 一起出现，但留个 belt-and-suspenders）
  const noBonusAttempt = isSecondAttempt || tutorAssisted;

  const base = 10;
  const difficultyMul = 1 + (question.difficulty - 1) * 0.2;
  const correctFactor = isCorrect
    ? (tutorAssisted ? TUTOR_ASSISTED_FACTOR : 1)
    : (input.partialCorrect ? 0.5 : 0.2);
  // 速度奖励：仅 1st 答对独享
  const { bonus: timeBonus } = noBonusAttempt
    ? { bonus: 0 }
    : speedBonus(elapsedSeconds, question.estimated_time_seconds, isCorrect);
  const hintPenalty = -hintsOpened;
  // multi-step + review + new-skill 奖励都属于"真功夫"加成，tutor-assisted 不给
  const stepBonus = (multiStepAllStepsCorrect && !tutorAssisted) ? 3 : 0;
  const reviewBonus = (isReview && isCorrect && !tutorAssisted) ? 2 : 0;
  // combo 倍率：tutor-assisted 或 2nd 提交都不享受
  const comboMul = (isCorrect && !noBonusAttempt && !tutorAssisted)
    ? comboMultiplier(comboAfter)
    : 1;

  const raw = base * difficultyMul * correctFactor + timeBonus + hintPenalty + stepBonus + reviewBonus;

  // 重做递减：只对答对的题应用（错答本来就只拿 0.2× base 极少分，不再扣）
  const repeatDecay = isCorrect ? repeatDecayMultiplier(input.priorCorrectCount ?? 0) : 1.0;

  // 新知识点首次答对：固定 +5 XP（不受 decay 影响）。tutor-assisted 不算"学到了"
  const newSkillBonus = (isCorrect && input.isNewSkill && !tutorAssisted) ? NEW_SKILL_BONUS : 0;

  // 答错保持原 1 分下限；答对走 decay 后允许为 0（5+ 次纯刷不给分）
  const decayed = raw * comboMul * repeatDecay;
  const totalRaw = decayed + newSkillBonus;
  const total = isCorrect
    ? Math.max(0, Math.round(totalRaw))
    : Math.max(1, Math.round(decayed));

  const abilities = question.ability_dimension.length > 0 ? question.ability_dimension : (["calculation"] as AbilityId[]);
  const share = Math.max(1, Math.round(total / abilities.length));
  const byAbility: Partial<Record<AbilityId, number>> = {};
  for (const a of abilities) byAbility[a] = share;
  if (isReview && isCorrect && !tutorAssisted) byAbility.habit = (byAbility.habit ?? 0) + 1;

  return { total, byAbility, base, hintPenalty, comboMul, timeBonus, repeatDecay, newSkillBonus };
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / 500) + 1;
}

export function xpToNextLevel(xp: number): { need: number; into: number; total: number } {
  const level = levelFromXp(xp);
  const levelStart = (level - 1) * 500;
  const into = xp - levelStart;
  const total = 500;
  return { need: total - into, into, total };
}
