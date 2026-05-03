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
}

export const MASTERY_BOUNDS = { min: 0, max: 100, weak: 60, stable: 75, mastered: 90 };

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
  }

  // 单题上下限保护
  if (delta > 8) delta = 8;
  if (delta < -8) delta = -8;

  return clampMastery(input.oldScore + delta);
}
