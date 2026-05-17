import { z } from "zod";

export const AbilityIdSchema = z.enum([
  "calculation",
  "concept",
  "reasoning",
  "modeling",
  "spatial",
  "data",
  "strategy",
  "habit",
]);

export const TermSchema = z.enum(["上册", "下册", "综合复习"]);

export const ExamPrioritySchema = z.enum([
  "MUST_BIG",
  "HIGH_BIG",
  "MUST_SMALL",
  "VERY_HIGH_SMALL",
  "HIGH_SMALL",
  "NORMAL",
  "LOW",
  "LOW_SMALL",
  "EXTENSION",
]);

export const QuestionFormatSchema = z.enum([
  "numeric",
  "numeric_choice",
  "single_choice",
  "multi_choice",
  "multi_step",
  "fill_blank",
  "drag_drop",
  "sort_ladder",
  "geometry_operation",
]);

export const CognitiveLevelSchema = z.enum(["recall", "procedural", "application", "reasoning"]);

export const NumericAnswerSchema = z.object({
  type: z.literal("number"),
  value: z.number(),
  unit: z.string().optional(),
  acceptable_error: z.number().nonnegative().optional(),
});
export const ChoiceAnswerSchema = z.object({
  type: z.literal("choice"),
  value: z.string().min(1),
});
export const MultiStepAnswerSchema = z.object({
  type: z.literal("multi_step"),
  steps: z
    .array(
      z.object({
        step_id: z.string().min(1),
        expected: z.union([z.string(), z.number()]),
        kind: z.enum(["relationship", "expression", "answer"]).optional(),
      }),
    )
    .min(1),
});
export const AnswerSchema = z.discriminatedUnion("type", [
  NumericAnswerSchema,
  ChoiceAnswerSchema,
  MultiStepAnswerSchema,
]);

/** v0.31.73：option.visual 给前端 grid-aligned 竖式渲染（取代 ASCII art） */
export const OptionVisualSchema = z.object({
  type: z.literal("vertical_arithmetic"),
  a: z.string().min(1),
  op: z.string().min(1),
  b: z.string().min(1),
  align: z.enum(["decimal", "right"]).optional(),
});

export const ChoiceOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  errorTag: z.string().optional(),
  visual: OptionVisualSchema.optional(),
});

export const CommonErrorSchema = z.object({
  tag: z.string().min(1),
  error: z.string().min(1),
  remediation: z.string().min(1),
});

export const WordProblemStepsSchema = z.object({
  known: z.array(z.string()).min(1),
  question: z.string().min(1),
  relationship: z.string().min(1),
  equation_or_expression: z.string().min(1),
  check: z.string().min(1),
});

export const HintSchema = z.object({
  text: z.string().min(1),
  penalty: z.number().int().min(0).optional(),
});

export const ClueSubquestionSchema = z.object({
  kind: z.literal("clue_pick"),
  prompt: z.string().min(1),
  clues: z.array(z.string().min(1)).min(2),
  correct: z.array(z.number().int().nonnegative()).min(1),
  mode: z.enum(["pick_correct", "pick_wrong"]),
  hint: z.string().optional(),
});

export const ChooseSubquestionSchema = z.object({
  kind: z.literal("choose"),
  prompt: z.string().min(1),
  options: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1),
        correct: z.boolean(),
        errorTag: z.string().optional(),
      }),
    )
    .min(2),
  multi: z.boolean().optional(),
  hint: z.string().optional(),
});

export const NumericSubquestionSchema = z.object({
  kind: z.literal("numeric"),
  prompt: z.string().min(1),
  value: z.number(),
  acceptable_error: z.number().nonnegative().optional(),
  unit: z.string().optional(),
  distractors: z.array(z.number()).optional(),
  hint: z.string().optional(),
});

export const SubQuestionSchema = z.discriminatedUnion("kind", [
  ClueSubquestionSchema,
  ChooseSubquestionSchema,
  NumericSubquestionSchema,
]);

export const GameTemplateSchema = z.enum([
  "speed_match",
  "shop_counter",
  "equation_builder",
  "clue_finder",
  "sort_ladder",
  "chart_detective",
  "shape_court",
  "triangle_judge",
  "cube_view",
  "true_false_swipe",
  "vertical_repair",
  "decimal_shifter",
  "memory_match",
  "balance_lab",
  "plain_numeric",
  "plain_choice",
  "dot_grid_draw",
]);

export const QuestionSchema = z.object({
  question_id: z.string().min(3),
  version: z.number().int().positive(),
  status: z.enum([
    "draft",
    "validated",
    "approved",
    "active",
    "retired",
    "needs_review",
    "rejected",
  ]),
  source: z
    .object({
      curriculum: z.string().optional(),
      basis: z.string().optional(),
      copyright_safe: z.boolean().optional(),
      original: z.boolean().optional(),
    })
    .optional(),
  // v0.34.80 iter 14: 多年级支持 — 之前 z.literal(4) 锁死 4 年级, iter 10 合成
  // grade-5 题 admin import 会被拒. 改 union(1..6) 给 iter 9-11 PDF 流程开闸.
  // 学生 train scheduler 仍按 student.grade 过滤; 题本身可以是任意年级 (1-6).
  grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  term: TermSchema,
  unit_id: z.string().min(1),
  unit_name: z.string().optional(),
  skill_id: z.string().min(1),
  skill_name: z.string().optional(),
  ability_dimension: z.array(AbilityIdSchema).min(1),
  exam_priority: ExamPrioritySchema,
  game_type: z.string().min(1),
  play_as: GameTemplateSchema.optional(),
  cognitive_level: CognitiveLevelSchema,
  difficulty: z.number().int().min(1).max(5),
  estimated_time_seconds: z.number().int().positive(),
  stem: z.string().min(1),
  question_format: QuestionFormatSchema,
  options: z.array(ChoiceOptionSchema).optional(),
  distractors: z.array(z.union([z.string(), z.number()])).optional(),
  answer: AnswerSchema,
  solution_steps: z.array(z.string().min(1)).min(1),
  word_problem_steps: WordProblemStepsSchema.optional(),
  subquestions: z.array(SubQuestionSchema).optional(),
  hints: z.array(HintSchema).max(5).optional(),
  common_errors: z.array(CommonErrorSchema),
  feedback_correct: z.string().min(1),
  feedback_wrong: z.string().min(1),
  parent_tip: z.string().optional(),
  variant_rules: z
    .object({
      same_skill: z.boolean().optional(),
      change_numbers: z.boolean().optional(),
      change_context: z.boolean().optional(),
      preserve_difficulty: z.boolean().optional(),
    })
    .optional(),
  review_interval_days: z.array(z.number().int().positive()).optional(),
  tags: z.array(z.string()).optional(),
  safety_check: z.record(z.boolean()).optional(),
  /**
   * v0.34.98 (iter 32 P0-0b): SpeedMatch 白名单. 显式标 true/false
   * → 强制覆盖 isSpeedEligible() heuristic. 未设置时走启发式判断.
   * 详见 src/core/speedMatchPolicy.ts.
   */
  speedEligible: z.boolean().optional(),
  /**
   * v0.34.99 (iter 33 P0-1): Estimation Gate. 显式 true/false 覆盖 heuristic.
   * 详见 src/core/estimationPolicy.ts.
   */
  requiresEstimation: z.boolean().optional(),
  /**
   * v0.34.99 (iter 33 P0-1): 应用题的"关键数字" (题面提取困难时由出题人/AI 明确标注).
   * Estimation Gate Phase 1 显示 "把 X 看作 ▢" 时用. 若未提供且 heuristic 触发,
   * 则用 extractNumbers(stem) 兜底.
   */
  keyNumbers: z.array(z.number()).max(4).optional(),
  // Phase 2 Axis 2：点子图画图题载荷。
  dot_grid: z
    .object({
      gridWidth: z.number().int().min(2).max(15),
      gridHeight: z.number().int().min(2).max(15),
      targetShape: z.enum([
        "parallelogram",
        "rectangle",
        "trapezoid",
        "isosceles_triangle",
        "equilateral_triangle",
        "right_triangle",
        "any_triangle",
      ]),
      targetLabel: z.string().min(1),
      snapToDots: z.boolean().optional(),
    })
    .optional(),
});

export type QuestionInput = z.infer<typeof QuestionSchema>;
