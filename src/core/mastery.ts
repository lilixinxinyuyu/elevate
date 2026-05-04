export interface MasteryInput {
  oldScore: number;
  difficulty: number;
  isCorrect: boolean;
  usedHint: boolean;
  elapsedSeconds: number;
  estimatedTimeSeconds: number;
  errorTags: string[];
  priorErrorTags?: string[];
  cognitiveLevel: "recall" | "procedural" | "application" | "reasoning";
  multiStepAllStepsCorrect?: boolean;
  /**
   * 这道题之前答对过几次（和 scoring.ts 同一个口径）。
   * 0 = 第 1 次答对（满 mastery 增长）
   * 1 = 第 2 次答对（×0.5，走出短期记忆）
   * 2 = 第 3 次答对（×0.2，几乎只是确认）
   * 3 = 第 4 次答对（×0.1）
   * 4+ = 第 5 次以后（×0，纯刷不长 mastery）
   *
   * 关键：防止"反复做同一道题→mastery 虚高 90"假象。真的会做需要在不同
   * 题面下都对，不是同一题点 N 次。
   */
  priorCorrectCount?: number;
  /**
   * 整道题的"独立题数"封顶（用于 service.ts 计算这个 skill 学生做过多少
   * 道唯一题）。如果不传就不封顶。当独立题数 < 5 时，mastery 上限被压到
   * 30+独立题数×10（即只做 1 道唯一题最多 40 分；做 7 道才能到 100）。
   *
   * 这阻止"用 1 道题刷到 100 mastery"——即使没 priorCorrectCount 衰减也得
   * 见够题面才能拿满分。
   */
  uniqueQuestionsTried?: number;
}

export const MASTERY_BOUNDS = { min: 0, max: 100, weak: 60, stable: 75, mastered: 90 };

/** 重做衰减：和 scoring.ts 的 REPEAT_DECAY 同步 */
const MASTERY_REPEAT_DECAY = [1.0, 0.5, 0.2, 0.1] as const;
function masteryRepeatMul(priorCorrectCount: number): number {
  if (priorCorrectCount <= 0) return 1.0;
  if (priorCorrectCount >= MASTERY_REPEAT_DECAY.length) return 0;
  return MASTERY_REPEAT_DECAY[priorCorrectCount] ?? 0;
}

/**
 * 独立题数封顶：mastery 不能超过 30 + uniqueQuestionsTried × 10。
 *
 * 例：
 *   1 道唯一题 → 上限 40
 *   3 道唯一题 → 上限 60
 *   5 道唯一题 → 上限 80
 *   7 道唯一题 → 上限 100（解锁满分）
 *
 * 这让"广度"成为前置条件——做过的题面够多才能宣称 mastered。
 */
export function masteryCapByUnique(uniqueCount: number): number {
  return Math.min(100, 30 + uniqueCount * 10);
}

export function clampMastery(v: number): number {
  return Math.max(MASTERY_BOUNDS.min, Math.min(MASTERY_BOUNDS.max, v));
}

export function updateMastery(input: MasteryInput): number {
  const d = input.difficulty;
  let delta = 0;
  if (input.isCorrect) {
    delta = 2 + d * 0.8;
    if (!input.usedHint) delta += 1;
    if (input.elapsedSeconds <= input.estimatedTimeSeconds) delta += 0.5;
    if (input.multiStepAllStepsCorrect) delta += 1;
    // **重做衰减**：第 N 次答对同一道题，mastery 增长打折
    delta *= masteryRepeatMul(input.priorCorrectCount ?? 0);
  } else {
    delta = -(2 + d * 0.9);
    const conceptualTags = new Set([
      "relation_model_error",
      "equation_setup_error",
      "average_formula_error",
      "missing_value_inverse_error",
    ]);
    const carelessTags = new Set([
      "careless_reading",
      "no_unit_answer",
      "vertical_alignment_error",
    ]);
    if (input.errorTags.some((t) => conceptualTags.has(t))) delta -= 1.5;
    if (input.errorTags.some((t) => carelessTags.has(t))) delta -= 0.5;
    if (input.priorErrorTags && input.errorTags.some((t) => input.priorErrorTags!.includes(t))) {
      delta -= 1; // 连续同错因
    }
    // 答错不衰减（错本来就该扣，不论是不是同题）
  }

  // 单题上下限保护
  if (delta > 8) delta = 8;
  if (delta < -8) delta = -8;

  let next = clampMastery(input.oldScore + delta);

  // **独立题数封顶**：做过题面太少时不允许 mastery 飚上去
  if (typeof input.uniqueQuestionsTried === "number") {
    const cap = masteryCapByUnique(input.uniqueQuestionsTried);
    // 只在升的时候封顶；本来就高于 cap 的不强制下拉（避免老数据被惩罚）
    if (next > cap && delta > 0) {
      next = Math.max(input.oldScore, cap);
    }
  }
  return next;
}
