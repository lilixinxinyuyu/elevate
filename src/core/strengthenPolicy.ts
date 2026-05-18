/**
 * v0.35.3 (iter 37 P1-2): 强化挑战 policy.
 *
 * Selena 43% master plan P1-2. 错答后立刻给 3 道同型加练, 正向"强化" 包装.
 *
 * 目标:
 *   - 错题立刻强化, 防"过去就忘"
 *   - 包装为加练/挑战 (不是惩罚)
 *   - 全对额外 +25 XP 奖励
 *
 * Feature flag: isStrengthenChallengeV1 (default ON).
 */
import type { Question } from "./types";
import { isStrengthenChallengeV1 } from "../lib/featureFlags";

/* ──────────────────── 触发判定 ──────────────────── */

export interface StrengthenContext {
  examMode?: boolean;
  noRetry?: boolean;
  /** 当前已在 strengthen session 内 (防嵌套) */
  insideStrengthen?: boolean;
  /** 当前是 mini-game (错题侦探等) */
  insideMiniGame?: boolean;
  /** 同一 session 内已弹过的次数 */
  sessionCount?: number;
}

/** 单 session 内 modal 最多弹的次数 (评审共识防疲劳) */
export const MAX_PROMPTS_PER_SESSION = 2;

/**
 * 是否符合"弹强化挑战 modal" 的时机.
 * @param isCorrect 本次 attempt 是否答对 (我们只在答错时弹)
 * @param isFirstAttempt 是否第 1 次提交 (排除 retry 后第 2 次)
 * @param question 当前题
 * @param ctx 上下文 (考试模式/嵌套/cap)
 */
export function isStrengthenOpportunity(
  isCorrect: boolean,
  isFirstAttempt: boolean,
  question: Question,
  ctx: StrengthenContext,
): boolean {
  if (!isStrengthenChallengeV1()) return false;
  if (isCorrect) return false;
  if (!isFirstAttempt) return false;
  if (ctx.examMode || ctx.noRetry) return false;
  if (ctx.insideStrengthen || ctx.insideMiniGame) return false;
  if ((ctx.sessionCount ?? 0) >= MAX_PROMPTS_PER_SESSION) return false;
  // 排除大题 (本身就够重了)
  if (question.subquestions && question.subquestions.length > 0) return false;
  if (question.word_problem_steps && question.difficulty >= 3) return false;
  // 排除没 skill 信息 (没法找同型)
  if (!question.skill_id) return false;
  // 同 skill 跳过后 10 min 冷却 (评审 B)
  if (isSkillOnCooldown(question.skill_id)) return false;
  return true;
}

/* ──────────────────── XP 公式 ──────────────────── */

/**
 * 强化 session 结束时根据正确数发 bonus.
 * 每题正常分仍走 scoreAttempt (此处只算额外 bonus).
 *
 * 评审共识降 XP (防 "错了反而赚更多" 反向激励, 跟 estimation/multistep 经济平衡):
 *   3 题对: +15
 *   2 题对: +8
 *   1 题对: +3
 *   0 题对: 0 + 鼓励文案
 */
export const STRENGTHEN_XP = {
  ALL_CORRECT: 15,
  TWO_CORRECT: 8,
  ONE_CORRECT: 3,
  ZERO_CORRECT: 0,
} as const;

export const STRENGTHEN_SESSION_SIZE = 3;

export function calcStrengthenBonus(correctCount: number): number {
  if (correctCount >= 3) return STRENGTHEN_XP.ALL_CORRECT;
  if (correctCount === 2) return STRENGTHEN_XP.TWO_CORRECT;
  if (correctCount === 1) return STRENGTHEN_XP.ONE_CORRECT;
  return STRENGTHEN_XP.ZERO_CORRECT;
}

/* ──────────────────── Bonus idempotency (评审 B 强调) ──────────────────── */

/**
 * 同一 strengthen session 内 bonus 只能发一次 (防刷新 / 重复 submit 重发).
 * key 是 strengthen sessionId, value 是 timestamp.
 * 用 sessionStorage 而非 localStorage (重启浏览器即清).
 */
const BONUS_AWARDED_PREFIX = "strengthen_bonus_";

export function markStrengthenBonusAwarded(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(BONUS_AWARDED_PREFIX + sessionId, String(Date.now()));
  } catch { /* noop */ }
}

export function isStrengthenBonusAlreadyAwarded(sessionId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(BONUS_AWARDED_PREFIX + sessionId) !== null;
  } catch {
    return false;
  }
}

/* ──────────────────── Skill cooldown (评审 B 建议) ──────────────────── */

/** 同一 skill 跳过强化挑战后 10 分钟内不再弹 (防被强化 modal 烦哭) */
const SKILL_COOLDOWN_PREFIX = "strengthen_skill_cd_";
const SKILL_COOLDOWN_MS = 10 * 60 * 1000;

export function isSkillOnCooldown(skill_id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ts = sessionStorage.getItem(SKILL_COOLDOWN_PREFIX + skill_id);
    if (!ts) return false;
    return Date.now() - Number(ts) < SKILL_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function markSkillSkipped(skill_id: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SKILL_COOLDOWN_PREFIX + skill_id, String(Date.now()));
  } catch { /* noop */ }
}

/* ──────────────────── 同型 matching ──────────────────── */

export interface StrengthenSkillContext {
  skill_id: string;
  difficulty: number;
  /** 用户答错的原题 id (避免再出同一题) */
  excludeQuestionId: string;
  /** 优先 grade/unit 范围, 没必要 cross-grade */
  grade: 1 | 2 | 3 | 4 | 5 | 6;
  unit_id: string;
}

/** 从原题提取强化 session 的 skill context */
export function pickStrengthSkillContext(question: Question): StrengthenSkillContext {
  return {
    skill_id: question.skill_id,
    difficulty: question.difficulty,
    excludeQuestionId: question.question_id,
    grade: question.grade,
    unit_id: question.unit_id,
  };
}

/* ──────────────────── 鼓励文案 (评审共识: 0 对仍要正向) ──────────────────── */

export function strengthenSummaryMessage(correctCount: number): string {
  if (correctCount === 3) return "🎉 全对! 这类题你掌握了!";
  if (correctCount === 2) return "👍 答对 2 道, 已经很稳了";
  if (correctCount === 1) return "💪 答对 1 道, 这类题再多看几道就会";
  return "🌱 这类题真的有点难, 我们一起多练几次, 一定会的";
}
