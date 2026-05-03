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
}

export interface ScoreDelta {
  total: number;
  byAbility: Partial<Record<AbilityId, number>>;
  base: number;
  hintPenalty: number;
  comboMul: number;
  timeBonus: number;
}

export function comboMultiplier(combo: number): number {
  if (combo >= 10) return 2.0;
  if (combo >= 5) return 1.5;
  if (combo >= 3) return 1.2;
  return 1.0;
}

export function scoreAttempt(input: ScoreInput): ScoreDelta {
  const { question, isCorrect, hintsOpened, elapsedSeconds, isReview, multiStepAllStepsCorrect, comboAfter } = input;
  const base = 10;
  const difficultyMul = 1 + (question.difficulty - 1) * 0.2;
  const correctFactor = isCorrect ? 1 : input.partialCorrect ? 0.5 : 0.2;
  const timeBonus = isCorrect && elapsedSeconds <= question.estimated_time_seconds ? 2 : 0;
  const hintPenalty = -hintsOpened;
  const stepBonus = multiStepAllStepsCorrect ? 3 : 0;
  const reviewBonus = isReview && isCorrect ? 2 : 0;
  const comboMul = isCorrect ? comboMultiplier(comboAfter) : 1;

  const raw = base * difficultyMul * correctFactor + timeBonus + hintPenalty + stepBonus + reviewBonus;
  const total = Math.max(1, Math.round(raw * comboMul));

  const abilities = question.ability_dimension.length > 0 ? question.ability_dimension : (["calculation"] as AbilityId[]);
  const share = Math.max(1, Math.round(total / abilities.length));
  const byAbility: Partial<Record<AbilityId, number>> = {};
  for (const a of abilities) byAbility[a] = share;
  if (isReview && isCorrect) byAbility.habit = (byAbility.habit ?? 0) + 1;

  return { total, byAbility, base, hintPenalty, comboMul, timeBonus };
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
