import type { AbilityId, ExamPriority, Hint, Question, SubQuestion, GameTemplate } from "../core/types";
import { EXAM_PAPER_PACK } from "./examPaperPack";
import { MUST_BIG_PACK } from "./mustBigPack";
import { GAP_FILL_PACK_G4B } from "./gapFillPackG4B";
import { GAP_FILL_PACK_G4B_V2 } from "./gapFillPackG4B_v2";
import { GAP_FILL_PACK_G4B_V3 } from "./gapFillPackG4B_v3";
import { AI_GEN_G4B_PACK } from "./aiGenG4BPack";
import { AI_GEN_G4B_U14_PACK } from "./aiGenG4B_U14_Pack";
import { DOT_GRID_DEMO_PACK } from "./dotGridDemoPack";
// v0.35.20 iter 49: LLM backfilled metadata overlay (token-plan qwen3.6-flash 跑的).
// 见 scripts/_backfill-question-metadata.mjs. Empty {} 时无副作用.
import METADATA_BACKFILL from "./questions-backfilled-metadata.json";

/**
 * v0.35.20 iter 49 (retrospective P-AI-backfill):
 * 把 LLM-backfill 的 metadata merge 进每个 Question. 只在原 question 没 explicit
 * 设置该字段时才填. 0 影响已显式标 metadata 的题.
 */
function applyMetadataBackfill(qs: Question[]): Question[] {
  const overlay = METADATA_BACKFILL as Record<string, {
    speedEligible?: boolean;
    requiresEstimation?: boolean;
    requiresScratch?: boolean;
    requiresMultiStep?: boolean;
    keyNumbers?: number[];
  }>;
  return qs.map((q) => {
    const m = overlay[q.question_id];
    if (!m) return q;
    return {
      ...q,
      speedEligible: q.speedEligible ?? m.speedEligible,
      requiresEstimation: q.requiresEstimation ?? m.requiresEstimation,
      requiresScratch: q.requiresScratch ?? m.requiresScratch,
      requiresMultiStep: q.requiresMultiStep ?? m.requiresMultiStep,
      keyNumbers: q.keyNumbers ?? m.keyNumbers,
    };
  });
}

/**
 * v0.36.72: 阅读时长地板 (reading-time floor)。
 * Selena 反映"长题给的时间太短"(10 岁读字慢)。audit-questions.mjs 的 M4 规则把它当 minor
 * flag 出来 (26 道), 但根因是个别 pack(尤其 AI 生成的) estimated_time 没按题长加成。
 * 这里在装配末端**统一兜底**: 按 audit 同款 rubric **只抬高、绝不降低** estimated_time,
 * 一处修全部 + 未来新 AI 题自动合规, 免去逐条手改 24 个分散 entry。
 *   - stem ≥ 60 字  → ≥ 45s   (基础 30 + 长题加成 15)
 *   - stem ≥ 120 字 → ≥ 50s   (超长加成 25)
 *   - 多行/长选项(最长 ≥ 20 字) → ≥ 30s  (选项阅读加成 15)
 * 取适用地板里的最大值, 跟原 estimated_time 再取 max。
 */
function applyReadingTimeFloor(qs: Question[]): Question[] {
  return qs.map((q) => {
    const ets = q.estimated_time_seconds;
    if (typeof ets !== "number") return q;
    const stemLen = (q.stem ?? "").length;
    const opts = Array.isArray(q.options) ? q.options : [];
    const longestOpt = opts.reduce((mx, o) => Math.max(mx, (o?.text ?? "").length), 0);
    const hasMultiLineOpt = opts.some((o) => (o?.text ?? "").includes("\n") || (o?.text ?? "").length >= 20);
    let floor = 0;
    if (stemLen >= 60) floor = Math.max(floor, 45);
    if (stemLen >= 120) floor = Math.max(floor, 50);
    if (hasMultiLineOpt && longestOpt >= 20) floor = Math.max(floor, 30);
    if (floor <= ets) return q;
    return { ...q, estimated_time_seconds: floor };
  });
}

const base = {
  version: 1 as const,
  status: "approved" as const,
  grade: 4 as const,
  source: {
    curriculum: "BNU_2013_G4",
    basis: "user_supplied_textbook_outline",
    copyright_safe: true,
    original: true,
  },
  variant_rules: {
    same_skill: true,
    change_numbers: true,
    change_context: true,
    preserve_difficulty: true,
  },
  review_interval_days: [1, 3, 7, 14],
  safety_check: {
    no_real_child_name: true,
    no_personal_data: true,
    age_appropriate: true,
    no_ads: true,
    no_payment_inducement: true,
    no_unrelated_link: true,
  },
};

type SpeedOpts = {
  id: string;
  unitId: string;
  unitName: string;
  skillId: string;
  skillName: string;
  ability: AbilityId[];
  examPriority: ExamPriority;
  difficulty: 1 | 2 | 3 | 4 | 5;
  term: "上册" | "下册";
  stem: string;
  value: number;
  unit?: string;
  distractors: number[];
  hints?: Hint[];
  feedback_correct?: string;
  feedback_wrong?: string;
  commonErrors?: { tag: string; error: string; remediation: string }[];
  time?: number;
  playAs?: GameTemplate;
  tags?: string[];
};

function makeSpeed(opts: SpeedOpts): Question {
  return {
    ...base,
    question_id: opts.id,
    term: opts.term,
    unit_id: opts.unitId,
    unit_name: opts.unitName,
    skill_id: opts.skillId,
    skill_name: opts.skillName,
    ability_dimension: opts.ability,
    exam_priority: opts.examPriority,
    game_type: "speed_calc",
    play_as: opts.playAs ?? "speed_match",
    cognitive_level: "procedural",
    difficulty: opts.difficulty,
    estimated_time_seconds: opts.time ?? 20,
    stem: opts.stem,
    question_format: "numeric",
    answer: { type: "number", value: opts.value, ...(opts.unit ? { unit: opts.unit } : {}) },
    distractors: opts.distractors,
    solution_steps: [
      `答案是 ${opts.value}${opts.unit ?? ""}`,
    ],
    hints: opts.hints ?? [
      { text: "别急，读完题再选", penalty: 1 },
      { text: `答案接近 ${approx(opts.value)}`, penalty: 2 },
    ],
    common_errors: opts.commonErrors ?? [
      { tag: "careless_reading", error: "看错或算错", remediation: "重新读一遍题。" },
      { tag: "decimal_point_error", error: "小数点放错位", remediation: "先按整数算再点小数。" },
    ],
    feedback_correct: opts.feedback_correct ?? "干得漂亮！",
    feedback_wrong: opts.feedback_wrong ?? "再想想看，答案就在附近。",
    tags: opts.tags,
  };
}

type ChoiceOpts = {
  id: string;
  unitId: string;
  unitName: string;
  skillId: string;
  skillName: string;
  ability: AbilityId[];
  examPriority: ExamPriority;
  difficulty: 1 | 2 | 3 | 4 | 5;
  term: "上册" | "下册";
  stem: string;
  options: { id: string; text: string; errorTag?: string }[];
  correctId: string;
  hints?: Hint[];
  feedback_correct?: string;
  feedback_wrong?: string;
  solution_steps: string[];
  commonErrors?: { tag: string; error: string; remediation: string }[];
  time?: number;
  playAs?: GameTemplate;
  tags?: string[];
  cognitive?: "recall" | "procedural" | "application" | "reasoning";
  gameType?: string;
};

function makeChoice(opts: ChoiceOpts): Question {
  return {
    ...base,
    question_id: opts.id,
    term: opts.term,
    unit_id: opts.unitId,
    unit_name: opts.unitName,
    skill_id: opts.skillId,
    skill_name: opts.skillName,
    ability_dimension: opts.ability,
    exam_priority: opts.examPriority,
    game_type: opts.gameType ?? "geometry_judge",
    play_as: opts.playAs ?? "plain_choice",
    cognitive_level: opts.cognitive ?? "reasoning",
    difficulty: opts.difficulty,
    estimated_time_seconds: opts.time ?? 30,
    stem: opts.stem,
    question_format: "single_choice",
    options: opts.options,
    answer: { type: "choice", value: opts.correctId },
    solution_steps: opts.solution_steps,
    hints: opts.hints ?? [{ text: "排除明显不对的，再从剩下里选", penalty: 1 }],
    common_errors: opts.commonErrors ?? [
      { tag: "careless_reading", error: "看错题", remediation: "再读一次题目。" },
      { tag: "concept_confuse", error: "概念混淆", remediation: "回忆定义或关键规则。" },
    ],
    feedback_correct: opts.feedback_correct ?? "判断很准！",
    feedback_wrong: opts.feedback_wrong ?? "别着急，先排除错选项。",
    tags: opts.tags,
  };
}

type AppOpts = {
  id: string;
  unitId: string;
  unitName: string;
  skillId: string;
  skillName: string;
  ability: AbilityId[];
  examPriority: ExamPriority;
  difficulty: 1 | 2 | 3 | 4 | 5;
  term: "上册" | "下册";
  stem: string;
  clues: string[];
  correctClueIdx: number[];
  relationshipChoices: { id: string; text: string; correct: boolean; errorTag?: string }[];
  finalPrompt: string;
  finalValue: number;
  finalUnit?: string;
  finalDistractors?: number[];
  expression: string;
  solution_steps: string[];
  hints?: Hint[];
  feedback_correct?: string;
  feedback_wrong?: string;
  check: string;
  commonErrors?: { tag: string; error: string; remediation: string }[];
  time?: number;
  playAs?: GameTemplate;
  gameType?: string;
  tags?: string[];
};

function makeApp(opts: AppOpts): Question {
  const subs: SubQuestion[] = [
    {
      kind: "clue_pick",
      prompt: "先挑出本题用到的已知条件：",
      clues: opts.clues,
      correct: opts.correctClueIdx,
      mode: "pick_correct",
    },
    {
      kind: "choose",
      prompt: "这道题最合适的数量关系是：",
      options: opts.relationshipChoices,
    },
    {
      kind: "numeric",
      prompt: opts.finalPrompt,
      value: opts.finalValue,
      unit: opts.finalUnit,
      distractors: opts.finalDistractors,
    },
  ];
  return {
    ...base,
    question_id: opts.id,
    term: opts.term,
    unit_id: opts.unitId,
    unit_name: opts.unitName,
    skill_id: opts.skillId,
    skill_name: opts.skillName,
    ability_dimension: opts.ability,
    exam_priority: opts.examPriority,
    game_type: opts.gameType ?? "word_problem_lab",
    play_as: opts.playAs ?? "shop_counter",
    cognitive_level: "application",
    difficulty: opts.difficulty,
    estimated_time_seconds: opts.time ?? 90,
    stem: opts.stem,
    question_format: "multi_step",
    answer: {
      type: "multi_step",
      steps: [
        { step_id: "clue", expected: opts.correctClueIdx.join(",") },
        { step_id: "relationship", expected: opts.relationshipChoices.find((o) => o.correct)?.text ?? "" },
        { step_id: "answer", expected: opts.finalValue, kind: "answer" },
      ],
    },
    subquestions: subs,
    word_problem_steps: {
      known: opts.correctClueIdx.map((i) => opts.clues[i]!),
      question: opts.finalPrompt,
      relationship: opts.relationshipChoices.find((o) => o.correct)?.text ?? "",
      equation_or_expression: opts.expression,
      check: opts.check,
    },
    solution_steps: opts.solution_steps,
    hints: opts.hints ?? [
      { text: "先找题目要问的是什么", penalty: 1 },
      { text: `数量关系：${opts.relationshipChoices.find((o) => o.correct)?.text}`, penalty: 2 },
    ],
    common_errors: opts.commonErrors ?? [
      { tag: "relation_model_error", error: "数量关系写错", remediation: "先说一句再列式。" },
      { tag: "careless_reading", error: "没抓对已知", remediation: "重新读题。" },
    ],
    feedback_correct: opts.feedback_correct ?? "步骤清楚，解得漂亮！",
    feedback_wrong: opts.feedback_wrong ?? "没关系，再捋一遍思路。",
    tags: opts.tags,
  };
}

function approx(n: number): string {
  if (Number.isInteger(n)) return String(Math.round(n / 10) * 10);
  return (Math.round(n * 2) / 2).toString();
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ============================================================
   下册 · 小数乘法 · 购物应用（MUST_BIG 重点）
   ============================================================ */

const UNIT_DMUL = { unitId: "G4B_U3_DECIMAL_MULTIPLY", unitName: "小数乘法", term: "下册" as const };

const decimalPriceQuantity: Question[] = [
  makeApp({
    ...UNIT_DMUL,
    id: "G4B_dpq_1",
    skillId: "decimal_price_quantity",
    skillName: "总价=单价×数量",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "文具店里一支自动铅笔 3.8 元，Selena 买了 6 支。她的小兔玩偶在家等她。她一共要付多少元？",
    clues: [
      "一支自动铅笔 3.8 元",
      "Selena 的小兔玩偶在家等她",
      "Selena 买了 6 支铅笔",
      "文具店在学校门口",
    ],
    correctClueIdx: [0, 2],
    relationshipChoices: [
      { id: "A", text: "总价 = 单价 × 数量", correct: true },
      { id: "B", text: "总价 = 单价 + 数量", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "总价 = 数量 ÷ 单价", correct: false, errorTag: "relation_model_error" },
      { id: "D", text: "单价 = 总价 × 数量", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "一共多少钱？",
    finalValue: 22.8,
    finalUnit: "元",
    finalDistractors: [228, 2.28, 24],
    expression: "3.8*6",
    solution_steps: ["总价 = 单价 × 数量", "3.8 × 6 = 22.8", "答：22.8 元"],
    check: "估算 4×6=24，22.8 接近 24，合理",
    tags: ["购物", "小数乘法"],
  }),
  makeApp({
    ...UNIT_DMUL,
    id: "G4B_dpq_2",
    skillId: "decimal_price_quantity",
    skillName: "总价=单价×数量",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "一盒牛奶 2.5 元，买 8 盒。牛奶店还送一张贴纸。一共要付多少元？",
    clues: [
      "一盒牛奶 2.5 元",
      "买了 8 盒",
      "牛奶店送一张贴纸",
    ],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "总价 = 单价 × 数量", correct: true },
      { id: "B", text: "数量 = 单价 × 总价", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "总价 = 单价 ÷ 数量", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "一共多少元？",
    finalValue: 20,
    finalUnit: "元",
    finalDistractors: [200, 2.0, 17],
    expression: "2.5*8",
    solution_steps: ["2.5 × 8 = 20"],
    check: "25×8=200，点一位小数=20",
    tags: ["购物"],
  }),
  makeApp({
    ...UNIT_DMUL,
    id: "G4B_dpq_3",
    skillId: "decimal_price_quantity",
    skillName: "总价=单价×数量",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "一本练习本 4.8 元，买 7 本。书店今天人很多。一共用多少元？",
    clues: [
      "一本练习本 4.8 元",
      "买了 7 本",
      "书店今天人很多",
    ],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "总价 = 单价 × 数量", correct: true },
      { id: "B", text: "总价 = 数量 ÷ 单价", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "总价 = 单价 - 数量", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "一共多少元？",
    finalValue: 33.6,
    finalUnit: "元",
    finalDistractors: [336, 3.36, 30],
    expression: "4.8*7",
    solution_steps: ["4.8 × 7 = 33.6"],
    check: "5×7=35，33.6 接近 35",
    tags: ["购物"],
  }),
];

const decimalSpeedDistance: Question[] = [
  makeApp({
    ...UNIT_DMUL,
    id: "G4B_dsd_1",
    skillId: "decimal_speed_distance",
    skillName: "路程=速度×时间（小数）",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "一辆自行车每小时行驶 12.5 千米，骑行 4 小时。天气很好。一共走了多少千米？",
    clues: [
      "每小时走 12.5 千米",
      "骑了 4 小时",
      "天气很好",
    ],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "路程 = 速度 × 时间", correct: true },
      { id: "B", text: "速度 = 路程 × 时间", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "时间 = 路程 × 速度", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "一共多少千米？",
    finalValue: 50,
    finalUnit: "千米",
    finalDistractors: [5, 500, 48],
    expression: "12.5*4",
    solution_steps: ["12.5 × 4 = 50"],
    check: "12×4=48，50 合理",
    tags: ["路程"],
  }),
  makeApp({
    ...UNIT_DMUL,
    id: "G4B_dsd_2",
    skillId: "decimal_speed_distance",
    skillName: "路程=速度×时间（小数）",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "一艘小船每小时行 3.6 千米。划了 5 小时。一共行了多远？",
    clues: ["每小时 3.6 千米", "划了 5 小时"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "路程 = 速度 × 时间", correct: true },
      { id: "B", text: "路程 = 速度 ÷ 时间", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "一共多远？",
    finalValue: 18,
    finalUnit: "千米",
    finalDistractors: [180, 1.8, 15],
    expression: "3.6*5",
    solution_steps: ["3.6 × 5 = 18"],
    check: "36×5=180，点一位小数=18",
    tags: ["路程"],
  }),
];

const decimalWorkTotal: Question[] = [
  makeApp({
    ...UNIT_DMUL,
    id: "G4B_dwt_1",
    skillId: "decimal_work_total",
    skillName: "工程量/产量合计",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "一台机器每小时生产 6.5 个零件，工作 8 小时。机器型号是 X-3。一共生产多少个？",
    clues: ["每小时 6.5 个", "工作 8 小时", "机器型号 X-3"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "总产量 = 每小时产量 × 时间", correct: true },
      { id: "B", text: "每小时产量 = 总产量 × 时间", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "一共生产多少个？",
    finalValue: 52,
    finalUnit: "个",
    finalDistractors: [5.2, 520, 48],
    expression: "6.5*8",
    solution_steps: ["6.5 × 8 = 52"],
    check: "65×8=520，点一位小数=52",
    tags: ["工程"],
  }),
];

const decimalSegment: Question[] = [
  makeApp({
    ...UNIT_DMUL,
    id: "G4B_dsp_1",
    skillId: "decimal_segment_pricing",
    skillName: "分段计价",
    ability: ["modeling", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    time: 120,
    stem: "出租车起步价 8 元（3 公里内），之后每公里 1.6 元。Selena 的爸爸坐出租车 8 公里，一共付多少元？",
    clues: [
      "起步价 8 元，3 公里内",
      "超过 3 公里每公里 1.6 元",
      "坐了 8 公里",
      "爸爸带着一把伞",
    ],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "总价 = 起步价 + 超出部分 × 每公里价", correct: true },
      { id: "B", text: "总价 = 起步价 × 公里数", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "总价 = 起步价 + 公里数 × 每公里价", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "一共付多少元？",
    finalValue: 16,
    finalUnit: "元",
    finalDistractors: [12.8, 20.8, 14],
    expression: "8+(8-3)*1.6",
    solution_steps: [
      "超出部分：8-3=5 公里",
      "超出部分费用：5×1.6=8 元",
      "总：8+8=16 元",
    ],
    check: "把超出部分单独算，再加起步价",
    tags: ["分段计价"],
  }),
];

/* 小数乘加乘减 */
const decimalMulMix: Question[] = [
  makeSpeed({
    ...UNIT_DMUL,
    id: "G4B_dmmix_1",
    skillId: "decimal_mul_mix",
    skillName: "小数乘加混合运算",
    ability: ["calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "2.4 × 5 + 1.6 = ?",
    value: 13.6,
    distractors: [11.6, 20, 136],
    hints: [{ text: "先乘后加", penalty: 1 }],
    time: 25,
  }),
  makeSpeed({
    ...UNIT_DMUL,
    id: "G4B_dmmix_2",
    skillId: "decimal_mul_mix",
    skillName: "小数乘加混合运算",
    ability: ["calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "3.5 × 4 - 2.8 = ?",
    value: 11.2,
    distractors: [16.8, 2.8, 112],
    hints: [{ text: "先算 3.5×4，再减 2.8", penalty: 1 }],
    time: 25,
  }),
  makeApp({
    ...UNIT_DMUL,
    id: "G4B_dmmix_3",
    skillId: "decimal_mul_mix",
    skillName: "小数乘加混合运算",
    ability: ["calculation", "modeling"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "苹果 6.5 元/千克，买 2 千克；再买一瓶 8.5 元的牛奶。收银员很友好。一共多少元？",
    clues: ["苹果 6.5 元/千克", "买 2 千克苹果", "牛奶 8.5 元一瓶", "收银员很友好"],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "总价 = 苹果单价×数量 + 牛奶价", correct: true },
      { id: "B", text: "总价 = 苹果单价 + 牛奶价", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "一共多少元？",
    finalValue: 21.5,
    finalUnit: "元",
    finalDistractors: [25.5, 17, 20],
    expression: "6.5*2+8.5",
    solution_steps: ["苹果 6.5×2=13", "13+8.5=21.5"],
    check: "估算 13+9=22，合理",
  }),
];

const decimalMulSimplify: Question[] = [
  makeSpeed({
    ...UNIT_DMUL,
    id: "G4B_dms_1",
    skillId: "decimal_mul_simplify",
    skillName: "小数乘法简便",
    ability: ["strategy", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "1.25 × 0.8 × 4 = ?",
    value: 4,
    distractors: [40, 0.4, 10],
    hints: [{ text: "找 1.25 × 0.8 = 1", penalty: 1 }],
    time: 30,
  }),
  makeSpeed({
    ...UNIT_DMUL,
    id: "G4B_dms_2",
    skillId: "decimal_mul_simplify",
    skillName: "小数乘法简便",
    ability: ["strategy"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "2.5 × 4.8 = ?",
    value: 12,
    distractors: [120, 1.2, 15],
    hints: [{ text: "4.8 拆成 4×1.2，再和 2.5 相乘", penalty: 1 }],
    time: 30,
  }),
];

const decimalMulVertical: Question[] = [
  makeSpeed({
    ...UNIT_DMUL,
    id: "G4B_dmv_1",
    skillId: "decimal_mul_vertical",
    skillName: "小数乘法竖式",
    ability: ["calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "3.6 × 4 = ?",
    value: 14.4,
    distractors: [1.44, 144, 13.4],
    time: 20,
  }),
  makeSpeed({
    ...UNIT_DMUL,
    id: "G4B_dmv_2",
    skillId: "decimal_mul_vertical",
    skillName: "小数乘法竖式",
    ability: ["calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "2.5 × 1.6 = ?",
    value: 4,
    distractors: [40, 0.4, 3.6],
    time: 20,
  }),
  makeSpeed({
    ...UNIT_DMUL,
    id: "G4B_dmv_3",
    skillId: "decimal_mul_vertical",
    skillName: "小数乘法竖式",
    ability: ["calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "0.45 × 6 = ?",
    value: 2.7,
    distractors: [27, 0.27, 2.4],
    time: 20,
  }),
  makeSpeed({
    ...UNIT_DMUL,
    id: "G4B_dmv_4",
    skillId: "decimal_mul_vertical",
    skillName: "小数乘法竖式",
    ability: ["calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "7.2 × 0.5 = ?",
    value: 3.6,
    distractors: [36, 0.36, 3.5],
    time: 20,
  }),
];

const decimalMulMeaning: Question[] = [
  makeChoice({
    ...UNIT_DMUL,
    id: "G4B_dmm_1",
    skillId: "decimal_mul_meaning",
    skillName: "小数乘法意义",
    ability: ["concept"],
    examPriority: "MUST_SMALL",
    difficulty: 2,
    stem: "0.6 × 4 表示的意思是？",
    options: [
      { id: "A", text: "4 个 0.6 相加" },
      { id: "B", text: "0.6 个 4 相加", errorTag: "concept_confuse" },
      { id: "C", text: "0.6 与 4 的和", errorTag: "concept_confuse" },
      { id: "D", text: "0.6 除以 4", errorTag: "concept_confuse" },
    ],
    correctId: "A",
    solution_steps: ["a × b（b 是整数）表示 b 个 a 相加"],
    cognitive: "recall",
    gameType: "geometry_judge",
  }),
  makeChoice({
    ...UNIT_DMUL,
    id: "G4B_dmm_2",
    skillId: "decimal_mul_meaning",
    skillName: "小数乘法意义",
    ability: ["concept"],
    examPriority: "MUST_SMALL",
    difficulty: 2,
    stem: "下面哪一个表示 2.5 × 3 的意思？",
    options: [
      { id: "A", text: "3 个 2.5 相加：2.5+2.5+2.5" },
      { id: "B", text: "2.5 × 2.5 × 2.5", errorTag: "concept_confuse" },
      { id: "C", text: "2.5 与 3 的差", errorTag: "concept_confuse" },
      { id: "D", text: "2.5 + 3", errorTag: "concept_confuse" },
    ],
    correctId: "A",
    solution_steps: ["2.5 × 3 = 2.5 + 2.5 + 2.5"],
    cognitive: "recall",
    gameType: "geometry_judge",
  }),
];

const decimalPointShift: Question[] = [
  makeSpeed({
    ...UNIT_DMUL,
    id: "G4B_dps_1",
    skillId: "decimal_point_shift",
    skillName: "小数点移动",
    ability: ["concept", "strategy"],
    examPriority: "MUST_SMALL",
    difficulty: 2,
    stem: "把 3.6 扩大 10 倍，得多少？",
    value: 36,
    distractors: [0.36, 360, 46],
    hints: [{ text: "扩大 10 倍 = 小数点向右移 1 位", penalty: 1 }],
    time: 18,
  }),
  makeSpeed({
    ...UNIT_DMUL,
    id: "G4B_dps_2",
    skillId: "decimal_point_shift",
    skillName: "小数点移动",
    ability: ["concept", "strategy"],
    examPriority: "MUST_SMALL",
    difficulty: 2,
    stem: "把 254 缩小 100 倍，得多少？",
    value: 2.54,
    distractors: [25.4, 0.254, 2.45],
    hints: [{ text: "缩小 100 倍 = 小数点向左移 2 位", penalty: 1 }],
    time: 18,
  }),
];

const decimalProductDigits: Question[] = [
  makeChoice({
    ...UNIT_DMUL,
    id: "G4B_dpd_1",
    skillId: "decimal_product_digits",
    skillName: "积的小数位数",
    ability: ["strategy", "calculation"],
    examPriority: "MUST_SMALL",
    difficulty: 3,
    stem: "3.25 × 0.4 的积有几位小数？",
    options: [
      { id: "A", text: "1 位", errorTag: "decimal_point_error" },
      { id: "B", text: "2 位", errorTag: "decimal_point_error" },
      { id: "C", text: "3 位" },
      { id: "D", text: "4 位", errorTag: "decimal_point_error" },
    ],
    correctId: "C",
    solution_steps: ["两因数的小数位数相加：2+1=3"],
    cognitive: "procedural",
    gameType: "geometry_judge",
  }),
];

/* ============================================================
   下册 · 小数加减 & 逆向
   ============================================================ */
const UNIT_DAS = { unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法", term: "下册" as const };

const decimalAddSubVertical: Question[] = [
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_das_1",
    skillId: "decimal_add_sub_vertical",
    skillName: "小数加减竖式",
    ability: ["calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "12.35 + 8.7 = ?",
    value: 21.05,
    distractors: [20.72, 12.405, 19.5],
    hints: [{ text: "小数点对齐", penalty: 1 }],
    time: 25,
  }),
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_das_2",
    skillId: "decimal_add_sub_vertical",
    skillName: "小数加减竖式",
    ability: ["calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "10 - 3.6 = ?",
    value: 6.4,
    distractors: [7.4, 6, 7],
    hints: [{ text: "把 10 写成 10.0", penalty: 1 }],
    time: 20,
  }),
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_das_3",
    skillId: "decimal_add_sub_vertical",
    skillName: "小数加减竖式",
    ability: ["calculation"],
    examPriority: "MUST_BIG",
    difficulty: 2,
    stem: "5.2 + 3.6 = ?",
    value: 8.8,
    distractors: [88, 0.88, 8.2],
    time: 18,
  }),
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_das_4",
    skillId: "decimal_add_sub_vertical",
    skillName: "小数加减竖式",
    ability: ["calculation"],
    examPriority: "MUST_BIG",
    difficulty: 2,
    stem: "7.8 - 2.5 = ?",
    value: 5.3,
    distractors: [5.7, 4.3, 10.3],
    time: 18,
  }),
];

const decimalAddSubSimplify: Question[] = [
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_dasp_1",
    skillId: "decimal_add_sub_simplify",
    skillName: "小数加减简便",
    ability: ["strategy"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "简便计算：2.6 + 3.4 + 7.4 + 6.6 = ?",
    value: 20,
    distractors: [19, 21, 18],
    hints: [{ text: "把能凑整的先加", penalty: 1 }],
    time: 30,
  }),
];

const decimalInverseProblem: Question[] = [
  makeApp({
    ...UNIT_DAS,
    id: "G4B_dip_1",
    skillId: "decimal_inverse_problem",
    skillName: "逆向应用题",
    ability: ["modeling", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "Selena 和弟弟身高共 2.58 米，Selena 身高 1.42 米。弟弟喜欢跑步。弟弟身高多少米？",
    clues: ["两人合计 2.58 米", "Selena 1.42 米", "弟弟喜欢跑步"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "弟弟 = 合计 − Selena", correct: true },
      { id: "B", text: "弟弟 = 合计 + Selena", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "弟弟身高？",
    finalValue: 1.16,
    finalUnit: "米",
    finalDistractors: [1.2, 4, 0.6],
    expression: "2.58-1.42",
    solution_steps: ["2.58 − 1.42 = 1.16"],
    check: "1.16+1.42=2.58",
  }),
];

const decimalMeaning: Question[] = [
  makeChoice({
    ...UNIT_DAS,
    id: "G4B_dmp_1",
    skillId: "decimal_meaning_place",
    skillName: "小数意义、小数数位",
    ability: ["concept"],
    examPriority: "MUST_SMALL",
    difficulty: 2,
    stem: "0.35 中 3 在哪一位上？",
    options: [
      { id: "A", text: "十分位" },
      { id: "B", text: "百分位", errorTag: "place_value_error" },
      { id: "C", text: "个位", errorTag: "place_value_error" },
      { id: "D", text: "十位", errorTag: "place_value_error" },
    ],
    correctId: "A",
    solution_steps: ["小数点后第一位是十分位"],
    cognitive: "recall",
  }),
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_dmp_2",
    skillId: "decimal_meaning_place",
    skillName: "小数意义、小数数位",
    ability: ["concept"],
    examPriority: "MUST_SMALL",
    difficulty: 2,
    stem: "0.6 表示几个 0.1？",
    value: 6,
    distractors: [60, 0.6, 10],
    hints: [{ text: "0.6 = 6 × 0.1", penalty: 1 }],
    time: 18,
  }),
];

const decimalUnitConversion: Question[] = [
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_duc_1",
    skillId: "decimal_unit_conversion",
    skillName: "单位换算",
    ability: ["concept", "modeling"],
    examPriority: "MUST_SMALL",
    difficulty: 3,
    stem: "1.5 米 = 多少厘米？",
    value: 150,
    distractors: [15, 1.5, 1500],
    hints: [{ text: "1 米 = 100 厘米", penalty: 1 }],
    time: 20,
  }),
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_duc_2",
    skillId: "decimal_unit_conversion",
    skillName: "单位换算",
    ability: ["concept", "modeling"],
    examPriority: "MUST_SMALL",
    difficulty: 3,
    stem: "3.2 千克 = 多少克？",
    value: 3200,
    distractors: [32, 320, 3.2],
    hints: [{ text: "1 千克 = 1000 克", penalty: 1 }],
    time: 20,
  }),
];

const decimalCompare: Question[] = [
  makeChoice({
    ...UNIT_DAS,
    id: "G4B_dcmp_1",
    skillId: "decimal_compare",
    skillName: "小数比较",
    ability: ["concept", "reasoning"],
    examPriority: "NORMAL",
    difficulty: 2,
    stem: "下面哪个数最大？",
    options: [
      { id: "A", text: "0.45", errorTag: "place_value_error" },
      { id: "B", text: "0.5" },
      { id: "C", text: "0.099", errorTag: "place_value_error" },
      { id: "D", text: "0.305", errorTag: "place_value_error" },
    ],
    correctId: "B",
    solution_steps: ["比较小数：先比较整数部分，再从高位往低位比较"],
  }),
];

/* ============================================================
   下册 · 方程
   ============================================================ */
const UNIT_EQ = { unitId: "G4B_U5_EQUATIONS", unitName: "认识方程", term: "下册" as const };

const equationsSet: Question[] = [
  makeSpeed({
    ...UNIT_EQ,
    id: "G4B_es_1",
    skillId: "equation_solve_simple",
    skillName: "解简单方程",
    ability: ["calculation"],
    examPriority: "MUST_SMALL",
    difficulty: 3,
    stem: "x + 3.6 = 10，x = ?",
    value: 6.4,
    distractors: [13.6, 4, 7],
    hints: [{ text: "两边同时减 3.6", penalty: 1 }],
    time: 30,
  }),
  makeSpeed({
    ...UNIT_EQ,
    id: "G4B_es_2",
    skillId: "equation_solve_simple",
    skillName: "解简单方程",
    ability: ["calculation"],
    examPriority: "MUST_SMALL",
    difficulty: 3,
    stem: "3x = 27，x = ?",
    value: 9,
    distractors: [24, 3, 81],
    hints: [{ text: "两边同时除以 3", penalty: 1 }],
    time: 25,
  }),
  makeSpeed({
    ...UNIT_EQ,
    id: "G4B_es_3",
    skillId: "equation_solve_simple",
    skillName: "解简单方程",
    ability: ["calculation"],
    examPriority: "MUST_SMALL",
    difficulty: 3,
    stem: "x ÷ 4 = 2.5，x = ?",
    value: 10,
    distractors: [0.625, 6.5, 4],
    hints: [{ text: "两边同时乘 4", penalty: 1 }],
    time: 25,
  }),
  makeApp({
    ...UNIT_EQ,
    id: "G4B_e1_1",
    skillId: "equation_one_step_word",
    skillName: "一步方程应用",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "一支笔比一块橡皮贵 1.6 元，一支笔 3.5 元。文具店还摆了一些贴纸。橡皮多少元？",
    clues: ["笔比橡皮贵 1.6 元", "笔 3.5 元", "文具店摆了贴纸"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "橡皮 + 1.6 = 笔", correct: true },
      { id: "B", text: "橡皮 − 1.6 = 笔", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "橡皮 × 1.6 = 笔", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "橡皮多少元？",
    finalValue: 1.9,
    finalUnit: "元",
    finalDistractors: [5.1, 1.6, 1.5],
    expression: "3.5-1.6",
    solution_steps: ["设橡皮 x 元：x+1.6=3.5", "x=1.9"],
    check: "1.9+1.6=3.5",
  }),
  makeApp({
    ...UNIT_EQ,
    id: "G4B_e2_1",
    skillId: "equation_two_step_word",
    skillName: "两步方程应用",
    ability: ["modeling", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    time: 150,
    stem: "图书角有故事书和科普书共 86 本。故事书比科普书的 2 倍少 4 本。图书角还有一张小桌子。科普书有多少本？",
    clues: [
      "两种书共 86 本",
      "故事书比科普书的 2 倍少 4 本",
      "图书角还有一张小桌子",
    ],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "科普 + 故事 = 86", correct: true },
      { id: "B", text: "科普 − 故事 = 86", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "科普 = 故事 × 2 − 4", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "科普书有多少本？",
    finalValue: 30,
    finalUnit: "本",
    finalDistractors: [56, 28, 86],
    expression: "(86+4)/3",
    solution_steps: [
      "设科普 x：x+(2x−4)=86",
      "3x−4=86 → 3x=90 → x=30",
    ],
    check: "30+56=86",
  }),
  makeApp({
    ...UNIT_EQ,
    id: "G4B_em_1",
    skillId: "equation_meeting_problem",
    skillName: "相遇问题",
    ability: ["modeling", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    time: 150,
    stem: "甲乙两地相距 120 千米，货车每小时 50 千米、客车每小时 70 千米，两车同时相向开出。天气晴朗。几小时相遇？",
    clues: ["相距 120 千米", "货车 50 千米/时", "客车 70 千米/时", "天气晴朗"],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "(速度和) × 时间 = 总路程", correct: true },
      { id: "B", text: "速度差 × 时间 = 总路程", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "几小时相遇？",
    finalValue: 1,
    finalUnit: "小时",
    finalDistractors: [2.4, 1.7, 6],
    expression: "120/(50+70)",
    solution_steps: ["(50+70)x=120 → 120x=120 → x=1"],
    check: "1×120=120",
  }),
  makeApp({
    ...UNIT_EQ,
    id: "G4B_esum_1",
    skillId: "equation_sum_difference",
    skillName: "和倍/差倍问题",
    ability: ["modeling", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    time: 150,
    stem: "大苹果是小苹果重量的 3 倍，两个苹果共 480 克。苹果还带着叶子。小苹果多少克？",
    clues: ["大苹果是小苹果 3 倍", "两个共 480 克", "苹果带着叶子"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "小 + 3×小 = 480", correct: true },
      { id: "B", text: "小 × 3 = 480", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "小苹果多少克？",
    finalValue: 120,
    finalUnit: "克",
    finalDistractors: [360, 160, 480],
    expression: "480/4",
    solution_steps: ["4x=480 → x=120"],
    check: "120+360=480",
  }),
  makeChoice({
    ...UNIT_EQ,
    id: "G4B_el_1",
    skillId: "letter_expression",
    skillName: "字母表示数",
    ability: ["concept", "modeling"],
    examPriority: "MUST_SMALL",
    difficulty: 2,
    stem: "一本书 a 元，买 5 本要多少元？",
    options: [
      { id: "A", text: "5a" },
      { id: "B", text: "a+5", errorTag: "concept_confuse" },
      { id: "C", text: "a−5", errorTag: "concept_confuse" },
      { id: "D", text: "a÷5", errorTag: "concept_confuse" },
    ],
    correctId: "A",
    solution_steps: ["总价=单价×数量 = 5a"],
    cognitive: "recall",
  }),
  makeChoice({
    ...UNIT_EQ,
    id: "G4B_em2_1",
    skillId: "equation_meaning_balance",
    skillName: "方程意义",
    ability: ["concept", "reasoning"],
    examPriority: "MUST_SMALL",
    difficulty: 2,
    stem: "下列哪一个是方程？",
    options: [
      { id: "A", text: "3 + 5 = 8", errorTag: "concept_confuse" },
      { id: "B", text: "x + 3" },
      { id: "C", text: "2x + 1 = 7" },
      { id: "D", text: "5 > 3", errorTag: "concept_confuse" },
    ],
    correctId: "C",
    solution_steps: ["方程 = 含未知数的等式；A 没未知数、B 不是等式、D 不是等式"],
    cognitive: "recall",
  }),
];

/* ============================================================
   下册 · 平均数与统计
   ============================================================ */
const UNIT_DATA = { unitId: "G4B_U6_DATA", unitName: "数据的表示和分析", term: "下册" as const };

const averages: Question[] = [
  makeApp({
    ...UNIT_DATA,
    id: "G4B_ac_1",
    skillId: "average_compute",
    skillName: "求平均数",
    ability: ["calculation", "data"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "Selena 五次跳绳分别是 120、128、124、132、126 下。平均每次多少下？",
    clues: [
      "五次跳绳记录：120, 128, 124, 132, 126",
      "跳绳是在体育课做的",
      "共记录了 5 次数据",
    ],
    correctClueIdx: [0, 2],
    relationshipChoices: [
      { id: "A", text: "平均数 = 总数 ÷ 份数", correct: true },
      { id: "B", text: "平均数 = 总数 × 份数", correct: false, errorTag: "average_formula_error" },
    ],
    finalPrompt: "平均每次多少下？",
    finalValue: 126,
    finalUnit: "下",
    finalDistractors: [630, 132, 120],
    expression: "(120+128+124+132+126)/5",
    solution_steps: ["总：630", "630 ÷ 5 = 126"],
    check: "126×5=630",
  }),
  makeApp({
    ...UNIT_DATA,
    id: "G4B_am_1",
    skillId: "average_inverse_missing",
    skillName: "已知平均数求缺失数据",
    ability: ["modeling", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "四次跳绳平均 128 下，前三次分别是 125、132、127 下。第四次是多少下？",
    clues: ["四次平均 128 下", "前三次 125、132、127"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "未知 = 总数 − 已知之和", correct: true },
      { id: "B", text: "未知 = 平均数", correct: false, errorTag: "average_formula_error" },
      { id: "C", text: "未知 = 平均数 − 已知", correct: false, errorTag: "missing_value_inverse_error" },
    ],
    finalPrompt: "第四次多少下？",
    finalValue: 128,
    finalUnit: "下",
    finalDistractors: [132, 384, 4],
    expression: "128*4-(125+132+127)",
    solution_steps: ["总：128×4=512", "前三：384", "第四：512−384=128"],
    check: "(125+132+127+128)/4=128",
  }),
  makeApp({
    ...UNIT_DATA,
    id: "G4B_at_1",
    skillId: "average_inverse_total",
    skillName: "已知平均数求总数",
    ability: ["modeling", "data"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "5 个班平均每班植树 24 棵。一共植树多少棵？",
    clues: ["5 个班", "平均每班 24 棵"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "总数 = 平均 × 份数", correct: true },
      { id: "B", text: "总数 = 平均 ÷ 份数", correct: false, errorTag: "average_formula_error" },
    ],
    finalPrompt: "一共多少棵？",
    finalValue: 120,
    finalUnit: "棵",
    finalDistractors: [4.8, 29, 100],
    expression: "24*5",
    solution_steps: ["24×5=120"],
    check: "120/5=24",
  }),
  makeChoice({
    ...UNIT_DATA,
    id: "G4B_amean_1",
    skillId: "average_meaning",
    skillName: "平均数意义",
    ability: ["concept", "data"],
    examPriority: "MUST_SMALL",
    difficulty: 2,
    stem: "关于平均数，下列说法正确的是？",
    options: [
      { id: "A", text: "平均数一定是一组数中的某一个" , errorTag: "concept_confuse"},
      { id: "B", text: "平均数反映一组数据的总体水平" },
      { id: "C", text: "平均数就是最大值", errorTag: "concept_confuse" },
      { id: "D", text: "平均数就是中间那个数", errorTag: "concept_confuse" },
    ],
    correctId: "B",
    solution_steps: ["平均数 = 一组数据的平均水平代表"],
    cognitive: "recall",
  }),
  makeChoice({
    ...UNIT_DATA,
    id: "G4B_bar_1",
    skillId: "data_bar_chart",
    skillName: "条形统计图读图",
    ability: ["data"],
    examPriority: "HIGH_SMALL",
    difficulty: 2,
    stem: "条形统计图中，一格代表 5。某条柱高到第 7 格。这条柱代表多少？",
    options: [
      { id: "A", text: "7", errorTag: "concept_confuse" },
      { id: "B", text: "35" },
      { id: "C", text: "12", errorTag: "concept_confuse" },
      { id: "D", text: "70", errorTag: "concept_confuse" },
    ],
    correctId: "B",
    solution_steps: ["7 格 × 5 = 35"],
    cognitive: "procedural",
  }),
];

/* ============================================================
   下册 · 三角形/四边形
   ============================================================ */
const UNIT_TRI = { unitId: "G4B_U2_TRI_QUAD", unitName: "认识三角形和四边形", term: "下册" as const };

const triangleSet: Question[] = [
  makeChoice({
    ...UNIT_TRI,
    id: "G4B_ti_1",
    skillId: "triangle_inequality",
    skillName: "三角形三边关系",
    ability: ["reasoning", "spatial"],
    examPriority: "MUST_SMALL",
    difficulty: 3,
    stem: "下面哪一组线段可以围成三角形？",
    options: [
      { id: "A", text: "3cm、4cm、8cm", errorTag: "triangle_condition_error" },
      { id: "B", text: "5cm、6cm、10cm" },
      { id: "C", text: "2cm、3cm、5cm", errorTag: "triangle_condition_error" },
      { id: "D", text: "1cm、1cm、3cm", errorTag: "triangle_condition_error" },
    ],
    correctId: "B",
    solution_steps: ["两边之和必须严格大于第三边"],
    cognitive: "reasoning",
  }),
  makeSpeed({
    ...UNIT_TRI,
    id: "G4B_ta_1",
    skillId: "triangle_angle_sum",
    skillName: "三角形内角和",
    ability: ["calculation", "spatial"],
    examPriority: "MUST_SMALL",
    difficulty: 3,
    stem: "两个角分别是 45° 和 75°，第三个角多少度？",
    value: 60,
    distractors: [120, 90, 45],
    hints: [{ text: "三角形内角和 = 180°", penalty: 1 }],
    time: 20,
  }),
  makeSpeed({
    ...UNIT_TRI,
    id: "G4B_ta_2",
    skillId: "triangle_angle_sum",
    skillName: "三角形内角和",
    ability: ["calculation", "spatial"],
    examPriority: "MUST_SMALL",
    difficulty: 3,
    stem: "一个等腰三角形顶角 40°，每个底角多少度？",
    value: 70,
    distractors: [40, 140, 80],
    hints: [{ text: "两底角相等，且与顶角和为 180°", penalty: 1 }],
    time: 25,
  }),
  makeChoice({
    ...UNIT_TRI,
    id: "G4B_tc_1",
    skillId: "triangle_classification",
    skillName: "三角形分类",
    ability: ["concept", "spatial"],
    examPriority: "HIGH_SMALL",
    difficulty: 2,
    stem: "三个角分别是 30°、60°、90° 的三角形是？",
    options: [
      { id: "A", text: "锐角三角形", errorTag: "concept_confuse" },
      { id: "B", text: "直角三角形" },
      { id: "C", text: "钝角三角形", errorTag: "concept_confuse" },
      { id: "D", text: "等边三角形", errorTag: "concept_confuse" },
    ],
    correctId: "B",
    solution_steps: ["有一个 90° 的是直角三角形"],
    cognitive: "recall",
  }),
];

/* ============================================================
   下册 · 观察物体
   ============================================================ */
const UNIT_OBS = { unitId: "G4B_U4_OBSERVE_OBJECTS", unitName: "观察物体", term: "下册" as const };

const observeSet: Question[] = [
  makeChoice({
    ...UNIT_OBS,
    id: "G4B_obs_1",
    skillId: "observe_front_top_left",
    skillName: "正面/上面/左面观察",
    ability: ["spatial"],
    examPriority: "LOW_SMALL",
    difficulty: 2,
    stem: "从正面看一个立方体，看到什么形状？",
    options: [
      { id: "A", text: "正方形" },
      { id: "B", text: "圆形", errorTag: "concept_confuse" },
      { id: "C", text: "三角形", errorTag: "concept_confuse" },
      { id: "D", text: "梯形", errorTag: "concept_confuse" },
    ],
    correctId: "A",
    solution_steps: ["立方体的正面是正方形"],
    cognitive: "recall",
  }),
];

/* ============================================================
   上册 · 乘除法 & 运算律 & 大数 & 线与角 & 负数 & 位置
   ============================================================ */
const UNIT_MUL = { unitId: "G4A_U3_MULTIPLICATION", unitName: "乘法", term: "上册" as const };
const UNIT_LAWS = { unitId: "G4A_U4_LAWS", unitName: "运算律", term: "上册" as const };
const UNIT_DIV = { unitId: "G4A_U6_DIVISION", unitName: "除法", term: "上册" as const };
const UNIT_LARGE = { unitId: "G4A_U1_LARGE_NUMBERS", unitName: "认识更大的数", term: "上册" as const };
const UNIT_LA = { unitId: "G4A_U2_LINES_ANGLES", unitName: "线与角", term: "上册" as const };
const UNIT_POS = { unitId: "G4A_U5_POSITION", unitName: "方向与位置", term: "上册" as const };
const UNIT_NEG = { unitId: "G4A_U7_NEGATIVE", unitName: "生活中的负数", term: "上册" as const };
const UNIT_PROB = { unitId: "G4A_U8_PROBABILITY", unitName: "可能性", term: "上册" as const };

const upperBookSet: Question[] = [
  // 乘法
  makeSpeed({
    ...UNIT_MUL,
    id: "G4A_mul_1",
    skillId: "int_mul_3_by_2",
    skillName: "三位数乘两位数",
    ability: ["calculation"],
    examPriority: "NORMAL",
    difficulty: 3,
    stem: "234 × 12 = ?",
    value: 2808,
    distractors: [2304, 2818, 2880],
    time: 30,
  }),
  makeSpeed({
    ...UNIT_MUL,
    id: "G4A_mul_2",
    skillId: "int_mul_3_by_2",
    skillName: "三位数乘两位数",
    ability: ["calculation"],
    examPriority: "NORMAL",
    difficulty: 3,
    stem: "126 × 25 = ?",
    value: 3150,
    distractors: [3015, 3125, 3250],
    time: 30,
  }),
  makeChoice({
    ...UNIT_MUL,
    id: "G4A_mule_1",
    skillId: "int_mul_estimation",
    skillName: "乘法估算",
    ability: ["strategy"],
    examPriority: "NORMAL",
    difficulty: 2,
    stem: "198 × 52 大约是？",
    options: [
      { id: "A", text: "约 10000" },
      { id: "B", text: "约 1000", errorTag: "careless_reading" },
      { id: "C", text: "约 100000", errorTag: "careless_reading" },
      { id: "D", text: "约 500", errorTag: "careless_reading" },
    ],
    correctId: "A",
    solution_steps: ["200×50=10000"],
    cognitive: "reasoning",
  }),
  // 除法
  makeSpeed({
    ...UNIT_DIV,
    id: "G4A_div_1",
    skillId: "div_3_by_2_trial",
    skillName: "三位数除以两位数",
    ability: ["calculation"],
    examPriority: "NORMAL",
    difficulty: 4,
    stem: "486 ÷ 18 = ?",
    value: 27,
    distractors: [24, 28, 36],
    hints: [{ text: "把 18 看作 20 估初商", penalty: 1 }],
    time: 35,
  }),
  makeSpeed({
    ...UNIT_DIV,
    id: "G4A_div_2",
    skillId: "div_adjust_quotient",
    skillName: "调商",
    ability: ["calculation", "strategy"],
    examPriority: "NORMAL",
    difficulty: 4,
    stem: "672 ÷ 21 = ?",
    value: 32,
    distractors: [30, 33, 28],
    time: 35,
  }),
  makeApp({
    ...UNIT_DIV,
    id: "G4A_std_1",
    skillId: "speed_time_distance",
    skillName: "速度/时间/路程",
    ability: ["modeling", "calculation"],
    examPriority: "NORMAL",
    difficulty: 3,
    stem: "汽车 3 小时行驶 180 千米。天气晴朗。每小时多少千米？",
    clues: ["3 小时", "180 千米", "天气晴朗"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "速度 = 路程 ÷ 时间", correct: true },
      { id: "B", text: "速度 = 路程 × 时间", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "每小时几千米？",
    finalValue: 60,
    finalUnit: "千米",
    finalDistractors: [540, 30, 6],
    expression: "180/3",
    solution_steps: ["180 ÷ 3 = 60"],
    check: "60×3=180",
  }),
  // 运算律
  makeSpeed({
    ...UNIT_LAWS,
    id: "G4A_dl_1",
    skillId: "distributive_law",
    skillName: "乘法分配律",
    ability: ["strategy"],
    examPriority: "NORMAL",
    difficulty: 4,
    stem: "简便计算：25 × 99 = ?",
    value: 2475,
    distractors: [2499, 2400, 2575],
    hints: [{ text: "99 = 100 − 1", penalty: 1 }],
    time: 30,
  }),
  makeSpeed({
    ...UNIT_LAWS,
    id: "G4A_dl_2",
    skillId: "distributive_law",
    skillName: "乘法分配律",
    ability: ["strategy"],
    examPriority: "NORMAL",
    difficulty: 4,
    stem: "简便计算：18 × 25 + 2 × 25 = ?",
    value: 500,
    distractors: [450, 550, 900],
    hints: [{ text: "(18+2)×25", penalty: 1 }],
    time: 25,
  }),
  makeSpeed({
    ...UNIT_LAWS,
    id: "G4A_si_1",
    skillId: "simplify_integer",
    skillName: "整数简便计算",
    ability: ["strategy"],
    examPriority: "NORMAL",
    difficulty: 3,
    stem: "简便计算：36 + 74 + 26 + 64 = ?",
    value: 200,
    distractors: [190, 210, 180],
    hints: [{ text: "找凑整的组合", penalty: 1 }],
    time: 25,
  }),
  makeSpeed({
    ...UNIT_LAWS,
    id: "G4A_mob_1",
    skillId: "mixed_ops_brackets",
    skillName: "四则混合含括号",
    ability: ["calculation"],
    examPriority: "NORMAL",
    difficulty: 3,
    stem: "(12 + 8) × 5 = ?",
    value: 100,
    distractors: [52, 60, 200],
    hints: [{ text: "先算括号", penalty: 1 }],
    time: 20,
  }),
  // 大数
  makeChoice({
    ...UNIT_LARGE,
    id: "G4A_lpv_1",
    skillId: "large_place_value",
    skillName: "数位/万亿级",
    ability: ["concept"],
    examPriority: "NORMAL",
    difficulty: 1,
    stem: "100000 是几位数？",
    options: [
      { id: "A", text: "五位数", errorTag: "place_value_error" },
      { id: "B", text: "六位数" },
      { id: "C", text: "七位数", errorTag: "place_value_error" },
      { id: "D", text: "四位数", errorTag: "place_value_error" },
    ],
    correctId: "B",
    solution_steps: ["10 万 = 六位数"],
    cognitive: "recall",
  }),
  makeChoice({
    ...UNIT_LARGE,
    id: "G4A_lrw_1",
    skillId: "large_read_write",
    skillName: "大数读写",
    ability: ["concept"],
    examPriority: "NORMAL",
    difficulty: 2,
    stem: "十二万五千 写作？",
    options: [
      { id: "A", text: "125000" },
      { id: "B", text: "12500", errorTag: "place_value_error" },
      { id: "C", text: "1250000", errorTag: "place_value_error" },
      { id: "D", text: "1250", errorTag: "place_value_error" },
    ],
    correctId: "A",
    solution_steps: ["十二万 = 120000；五千 = 5000 → 125000"],
    cognitive: "recall",
  }),
  makeChoice({
    ...UNIT_LARGE,
    id: "G4A_lc_1",
    skillId: "large_compare",
    skillName: "大数比较",
    ability: ["concept", "reasoning"],
    examPriority: "NORMAL",
    difficulty: 2,
    stem: "哪一个数最大？",
    options: [
      { id: "A", text: "9876", errorTag: "place_value_error" },
      { id: "B", text: "12000" },
      { id: "C", text: "10987", errorTag: "place_value_error" },
      { id: "D", text: "11999", errorTag: "place_value_error" },
    ],
    correctId: "B",
    solution_steps: ["优先比位数，再从高位比"],
    cognitive: "reasoning",
  }),
  makeSpeed({
    ...UNIT_LARGE,
    id: "G4A_lr_1",
    skillId: "large_rewrite_wan_yi",
    skillName: "改写成万作单位",
    ability: ["concept"],
    examPriority: "NORMAL",
    difficulty: 2,
    stem: "把 320000 改写成以万为单位：",
    value: 32,
    distractors: [3.2, 320, 3200],
    hints: [{ text: "除以 10000", penalty: 1 }],
    time: 20,
  }),
  makeSpeed({
    ...UNIT_LARGE,
    id: "G4A_lap_1",
    skillId: "large_approx_rounding",
    skillName: "近似数",
    ability: ["strategy"],
    examPriority: "NORMAL",
    difficulty: 3,
    stem: "按四舍五入，把 34789 精确到千位，约是：",
    value: 35000,
    distractors: [34000, 34800, 35800],
    hints: [{ text: "看百位 7 ≥ 5，向千位进 1", penalty: 1 }],
    time: 25,
  }),
  // 线与角
  makeChoice({
    ...UNIT_LA,
    id: "G4A_at_1",
    skillId: "angle_types",
    skillName: "角的分类",
    ability: ["concept", "spatial"],
    examPriority: "HIGH_SMALL",
    difficulty: 2,
    stem: "下面哪个角是钝角？",
    options: [
      { id: "A", text: "45°", errorTag: "angle_sum_error" },
      { id: "B", text: "90°", errorTag: "angle_sum_error" },
      { id: "C", text: "120°" },
      { id: "D", text: "180°", errorTag: "angle_sum_error" },
    ],
    correctId: "C",
    solution_steps: ["钝角：大于 90° 小于 180°"],
    cognitive: "recall",
  }),
  makeChoice({
    ...UNIT_LA,
    id: "G4A_at_2",
    skillId: "angle_types",
    skillName: "角的分类",
    ability: ["concept", "spatial"],
    examPriority: "HIGH_SMALL",
    difficulty: 2,
    stem: "一个角是 90°，这是什么角？",
    options: [
      { id: "A", text: "锐角", errorTag: "angle_sum_error" },
      { id: "B", text: "直角" },
      { id: "C", text: "钝角", errorTag: "angle_sum_error" },
      { id: "D", text: "平角", errorTag: "angle_sum_error" },
    ],
    correctId: "B",
    solution_steps: ["90° 是直角"],
    cognitive: "recall",
  }),
  makeChoice({
    ...UNIT_LA,
    id: "G4A_am_1",
    skillId: "angle_measure",
    skillName: "量角",
    ability: ["spatial", "strategy"],
    examPriority: "HIGH_SMALL",
    difficulty: 3,
    stem: "量角时量角器的 0 刻度线应该对齐角的哪里？",
    options: [
      { id: "A", text: "角的顶点", errorTag: "careless_reading" },
      { id: "B", text: "角的一条边" },
      { id: "C", text: "随便放", errorTag: "careless_reading" },
      { id: "D", text: "角的另一边", errorTag: "careless_reading" },
    ],
    correctId: "B",
    solution_steps: ["量角器中心对顶点，0 刻度线对一条边"],
    cognitive: "procedural",
  }),
  // 数对
  makeChoice({
    ...UNIT_POS,
    id: "G4A_gc_1",
    skillId: "grid_coordinates",
    skillName: "数对确定位置",
    ability: ["spatial", "concept"],
    examPriority: "NORMAL",
    difficulty: 2,
    stem: "Selena 坐在第 3 列第 5 行，她的数对是？",
    options: [
      { id: "A", text: "(5, 3)", errorTag: "coordinate_order_error" },
      { id: "B", text: "(3, 5)" },
      { id: "C", text: "(3, 3)", errorTag: "careless_reading" },
      { id: "D", text: "(5, 5)", errorTag: "careless_reading" },
    ],
    correctId: "B",
    solution_steps: ["数对先列后行"],
    cognitive: "procedural",
  }),
  // 负数
  makeChoice({
    ...UNIT_NEG,
    id: "G4A_nt_1",
    skillId: "negative_temperature",
    skillName: "温度中的负数",
    ability: ["concept", "modeling"],
    examPriority: "NORMAL",
    difficulty: 1,
    stem: "−10℃ 与 −3℃ 比较，哪个更冷？",
    options: [
      { id: "A", text: "−10℃" },
      { id: "B", text: "−3℃", errorTag: "concept_confuse" },
      { id: "C", text: "一样冷", errorTag: "concept_confuse" },
      { id: "D", text: "不能比较", errorTag: "concept_confuse" },
    ],
    correctId: "A",
    solution_steps: ["负数绝对值越大、数反而越小；即 −10 < −3"],
    cognitive: "reasoning",
  }),
  // 可能性
  makeChoice({
    ...UNIT_PROB,
    id: "G4A_pc_1",
    skillId: "probability_compare",
    skillName: "可能性比较",
    ability: ["reasoning", "data"],
    examPriority: "NORMAL",
    difficulty: 2,
    stem: "袋子里有 5 个红球、1 个白球。摸一次，哪种情况可能性大？",
    options: [
      { id: "A", text: "摸到红球" },
      { id: "B", text: "摸到白球", errorTag: "probability_compare_error" },
      { id: "C", text: "一样", errorTag: "probability_compare_error" },
      { id: "D", text: "不能比较", errorTag: "probability_compare_error" },
    ],
    correctId: "A",
    solution_steps: ["球数多的颜色，被摸到的可能性大"],
    cognitive: "reasoning",
  }),
];

/* ============================================================
   v0.3 扩展：对错冲刺、竖式修理厂、各难度补题
   ============================================================ */

type TFOpts = {
  id: string;
  unitId: string;
  unitName: string;
  skillId: string;
  skillName: string;
  ability: AbilityId[];
  examPriority: ExamPriority;
  difficulty: 1 | 2 | 3 | 4 | 5;
  term: "上册" | "下册";
  stem: string;
  truth: "T" | "F";
  hints?: Hint[];
  feedback_correct?: string;
  feedback_wrong?: string;
  solution_steps: string[];
  time?: number;
  tags?: string[];
};

function makeTF(o: TFOpts): Question {
  return {
    ...base,
    question_id: o.id,
    term: o.term,
    unit_id: o.unitId,
    unit_name: o.unitName,
    skill_id: o.skillId,
    skill_name: o.skillName,
    ability_dimension: o.ability,
    exam_priority: o.examPriority,
    game_type: "true_false",
    play_as: "true_false_swipe",
    cognitive_level: "recall",
    difficulty: o.difficulty,
    estimated_time_seconds: o.time ?? 12,
    stem: o.stem,
    question_format: "single_choice",
    options: [
      { id: "T", text: "对" },
      { id: "F", text: "错" },
    ],
    answer: { type: "choice", value: o.truth },
    solution_steps: o.solution_steps,
    hints: o.hints,
    common_errors: [
      { tag: "careless_reading", error: "看错或没读完", remediation: "读完整句话再判断。" },
      { tag: "concept_confuse", error: "概念混淆", remediation: "回想定义。" },
    ],
    feedback_correct: o.feedback_correct ?? "判断很稳！",
    feedback_wrong: o.feedback_wrong ?? "再看一遍这句话，慢慢想。",
    tags: o.tags,
  };
}

const tfQuestions: Question[] = [
  makeTF({
    id: "TF_dec_1", term: "下册", unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法",
    skillId: "decimal_meaning_place", skillName: "小数意义", ability: ["concept"],
    examPriority: "MUST_SMALL", difficulty: 1,
    stem: "0.7 表示 7 个 0.1。",
    truth: "T",
    solution_steps: ["0.7 = 7 × 0.1"],
  }),
  makeTF({
    id: "TF_dec_2", term: "下册", unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法",
    skillId: "decimal_meaning_place", skillName: "小数意义", ability: ["concept"],
    examPriority: "MUST_SMALL", difficulty: 1,
    stem: "0.40 和 0.4 表示一样大。",
    truth: "T",
    solution_steps: ["小数末尾添 0 不改变大小"],
  }),
  makeTF({
    id: "TF_dec_3", term: "下册", unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法",
    skillId: "decimal_compare", skillName: "小数比较", ability: ["reasoning"],
    examPriority: "NORMAL", difficulty: 2,
    stem: "0.45 比 0.5 大。",
    truth: "F",
    solution_steps: ["十分位 4 < 5，所以 0.45 < 0.5"],
    hints: [{ text: "先比十分位", penalty: 1 }],
  }),
  makeTF({
    id: "TF_dmul_1", term: "下册", unitId: "G4B_U3_DECIMAL_MULTIPLY", unitName: "小数乘法",
    skillId: "decimal_product_digits", skillName: "积的小数位数", ability: ["strategy"],
    examPriority: "MUST_SMALL", difficulty: 2,
    stem: "3.6 × 0.5 的积有 2 位小数。",
    truth: "T",
    solution_steps: ["1+1=2 位小数"],
  }),
  makeTF({
    id: "TF_dmul_2", term: "下册", unitId: "G4B_U3_DECIMAL_MULTIPLY", unitName: "小数乘法",
    skillId: "decimal_mul_meaning", skillName: "小数乘法意义", ability: ["concept"],
    examPriority: "MUST_SMALL", difficulty: 1,
    stem: "0.5 × 4 表示 4 个 0.5 相加。",
    truth: "T",
    solution_steps: ["a × n（n 是整数）= n 个 a 相加"],
  }),
  makeTF({
    id: "TF_eq_1", term: "下册", unitId: "G4B_U5_EQUATIONS", unitName: "认识方程",
    skillId: "equation_meaning_balance", skillName: "方程意义", ability: ["concept"],
    examPriority: "MUST_SMALL", difficulty: 2,
    stem: "x + 5 是方程。",
    truth: "F",
    solution_steps: ["方程必须是含未知数的等式，没有等号不算方程。"],
    hints: [{ text: "方程要有等号", penalty: 1 }],
  }),
  makeTF({
    id: "TF_eq_2", term: "下册", unitId: "G4B_U5_EQUATIONS", unitName: "认识方程",
    skillId: "equation_meaning_balance", skillName: "方程意义", ability: ["concept"],
    examPriority: "MUST_SMALL", difficulty: 2,
    stem: "2x + 3 = 11 是方程。",
    truth: "T",
    solution_steps: ["有未知数 + 等号 → 是方程"],
  }),
  makeTF({
    id: "TF_tri_1", term: "下册", unitId: "G4B_U2_TRI_QUAD", unitName: "认识三角形和四边形",
    skillId: "triangle_inequality", skillName: "三边关系", ability: ["reasoning"],
    examPriority: "MUST_SMALL", difficulty: 2,
    stem: "三条边 3、4、7 厘米可以围成三角形。",
    truth: "F",
    solution_steps: ["3+4=7，不严格大于第三边，不能围成"],
    hints: [{ text: "两边之和必须『严格大于』第三边", penalty: 1 }],
  }),
  makeTF({
    id: "TF_avg_1", term: "下册", unitId: "G4B_U6_DATA", unitName: "数据的表示和分析",
    skillId: "average_meaning", skillName: "平均数意义", ability: ["concept"],
    examPriority: "MUST_SMALL", difficulty: 2,
    stem: "一组数的平均数一定就在这组数里。",
    truth: "F",
    solution_steps: ["平均数代表整体水平，可能并不是任何一个具体数"],
  }),
  makeTF({
    id: "TF_neg_1", term: "上册", unitId: "G4A_U7_NEGATIVE", unitName: "生活中的负数",
    skillId: "zero_not_pos_neg", skillName: "0 既不是正数也不是负数", ability: ["concept"],
    examPriority: "NORMAL", difficulty: 1,
    stem: "0 是正数。",
    truth: "F",
    solution_steps: ["0 既不是正数，也不是负数。"],
  }),
];

/* 竖式修理厂题（VerticalRepair） */
function makeVR(opts: {
  id: string;
  unitId: string;
  unitName: string;
  skillId: string;
  skillName: string;
  ability: AbilityId[];
  examPriority: ExamPriority;
  difficulty: 1 | 2 | 3 | 4 | 5;
  term: "上册" | "下册";
  stem: string;
  vertLines: string[];     // tags: vert:.., op:.., result:..
  prompt: string;
  options: { id: string; text: string; correct: boolean; errorTag?: string }[];
  solution_steps: string[];
  hints?: Hint[];
  time?: number;
  tags?: string[];
}): Question {
  const correctOpt = opts.options.find((o) => o.correct);
  return {
    ...base,
    question_id: opts.id,
    term: opts.term,
    unit_id: opts.unitId,
    unit_name: opts.unitName,
    skill_id: opts.skillId,
    skill_name: opts.skillName,
    ability_dimension: opts.ability,
    exam_priority: opts.examPriority,
    game_type: "vertical_repair",
    play_as: "vertical_repair",
    cognitive_level: "procedural",
    difficulty: opts.difficulty,
    estimated_time_seconds: opts.time ?? 30,
    stem: opts.stem,
    question_format: "single_choice",
    options: opts.options.map(({ id, text, errorTag }) => ({ id, text, errorTag })),
    answer: { type: "choice", value: correctOpt?.id ?? "A" },
    subquestions: [
      {
        kind: "choose",
        prompt: opts.prompt,
        options: opts.options,
      },
    ],
    solution_steps: opts.solution_steps,
    hints: opts.hints ?? [{ text: "先按整数算一下", penalty: 1 }],
    common_errors: [
      { tag: "vertical_alignment_error", error: "竖式对位错误", remediation: "确保末位/小数点对齐。" },
      { tag: "decimal_point_error", error: "小数点位置错", remediation: "看因数小数位数总和。" },
    ],
    feedback_correct: "你修好了这道竖式！",
    feedback_wrong: "再仔细看一下哪一步不对。",
    // vertLines 是 VerticalRepair 组件读的数据通道(vert:/op:/result:)；额外 tags(如 exam)附在后面
    tags: [...opts.vertLines, ...(opts.tags ?? [])],
  };
}

const verticalQuestions: Question[] = [
  makeVR({
    id: "VR_dmv_1", term: "下册", unitId: "G4B_U3_DECIMAL_MULTIPLY", unitName: "小数乘法",
    skillId: "decimal_mul_vertical", skillName: "小数乘法竖式", ability: ["calculation"],
    examPriority: "MUST_BIG", difficulty: 3,
    stem: "下面这道竖式 3.6 × 4 = ? 哪一项是正确的积？",
    vertLines: ["vert:3.6", "op:×", "vert:4", "result:?"],
    prompt: "积应该是多少？",
    options: [
      { id: "A", text: "144", correct: false, errorTag: "decimal_point_error" },
      { id: "B", text: "14.4", correct: true },
      { id: "C", text: "1.44", correct: false, errorTag: "decimal_point_error" },
      { id: "D", text: "0.144", correct: false, errorTag: "decimal_point_error" },
    ],
    solution_steps: ["36×4=144；3.6 一位小数 → 14.4"],
  }),
  makeVR({
    id: "VR_dmv_2", term: "下册", unitId: "G4B_U3_DECIMAL_MULTIPLY", unitName: "小数乘法",
    skillId: "decimal_mul_vertical", skillName: "小数乘法竖式", ability: ["calculation"],
    examPriority: "MUST_BIG", difficulty: 3,
    stem: "下面这道竖式 2.5 × 1.6 = ? 哪一项是正确的积？",
    vertLines: ["vert:2.5", "op:×", "vert:1.6", "result:?"],
    prompt: "积应该是多少？",
    options: [
      { id: "A", text: "40", correct: false, errorTag: "decimal_point_error" },
      { id: "B", text: "4", correct: true },
      { id: "C", text: "0.4", correct: false, errorTag: "decimal_point_error" },
      { id: "D", text: "4.0", correct: true },
    ].slice(0, 4).map((x, i) => ({ ...x, id: "ABCD"[i]! })) as { id: string; text: string; correct: boolean; errorTag?: string }[],
    solution_steps: ["25×16=400；两位小数 → 4.00 = 4"],
  }),
  makeVR({
    id: "VR_das_1", term: "下册", unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法",
    skillId: "decimal_add_sub_vertical", skillName: "小数加减竖式", ability: ["calculation"],
    examPriority: "MUST_BIG", difficulty: 3,
    stem: "下面这道竖式 12.35 + 8.7 = ? 哪一项是正确的和？",
    vertLines: ["vert:12.35", "op:+", "vert:8.70", "result:?"],
    prompt: "正确的和是？",
    options: [
      { id: "A", text: "21.05", correct: true },
      { id: "B", text: "20.72", correct: false, errorTag: "vertical_alignment_error" },
      { id: "C", text: "12.405", correct: false, errorTag: "vertical_alignment_error" },
      { id: "D", text: "19.05", correct: false, errorTag: "carry_borrow_error" },
    ],
    solution_steps: ["小数点对齐：12.35+8.70=21.05"],
  }),
  makeVR({
    id: "VR_imul_1", term: "上册", unitId: "G4A_U3_MULTIPLICATION", unitName: "乘法",
    skillId: "int_mul_3_by_2", skillName: "三位数乘两位数", ability: ["calculation"],
    examPriority: "NORMAL", difficulty: 3,
    stem: "用竖式算 234 × 12，下面哪一项是正确的积？",
    vertLines: ["vert:234", "op:×", "vert:12", "result:?"],
    prompt: "积是多少？",
    options: [
      { id: "A", text: "2808", correct: true },
      { id: "B", text: "2304", correct: false, errorTag: "place_value_error" },
      { id: "C", text: "2880", correct: false, errorTag: "careless_reading" },
      { id: "D", text: "468", correct: false, errorTag: "place_value_error" },
    ],
    solution_steps: ["234×2=468，234×10=2340；和=2808"],
  }),
  makeVR({
    id: "VR_idiv_1", term: "上册", unitId: "G4A_U6_DIVISION", unitName: "除法",
    skillId: "div_3_by_2_trial", skillName: "试商", ability: ["calculation"],
    examPriority: "NORMAL", difficulty: 4,
    stem: "486 ÷ 18 试商时，把 18 看成 20，初商应该取多少？",
    vertLines: ["vert:486", "op:÷", "vert:18"],
    prompt: "估初商：",
    options: [
      { id: "A", text: "2", correct: false, errorTag: "quotient_too_small" },
      { id: "B", text: "3", correct: true },
      { id: "C", text: "4", correct: false, errorTag: "quotient_too_large" },
      { id: "D", text: "5", correct: false, errorTag: "quotient_too_large" },
    ],
    solution_steps: ["486÷20≈24，48÷20≈2…+1，初商 3"],
    hints: [{ text: "把 18 看成 20，再用 48 ÷ 20 估", penalty: 1 }],
  }),
];

/* 难度 1 / 2 速算补充：所有 ability=calculation 类技能各加几道 */
function genQuickSet(): Question[] {
  const items: Question[] = [];
  // 小数加减 难度 1-2
  const adds: Array<[number, number]> = [
    [0.3, 0.4],
    [1.2, 0.5],
    [3.7, 2.3],
    [6.5, 1.5],
    [0.9, 0.1],
    [4.6, 3.4],
  ];
  adds.forEach(([a, b], i) => {
    const v = r2(a + b);
    items.push(makeSpeed({
      id: `Q_add_${i + 1}`, term: "下册",
      unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法",
      skillId: "decimal_add_sub_vertical", skillName: "小数加减竖式",
      ability: ["calculation"], examPriority: "MUST_BIG", difficulty: 1,
      stem: `${a} + ${b} = ?`, value: v,
      distractors: [r2(v + 1), r2(a - b), r2(v / 10)],
      time: 15,
    }));
  });
  const subs: Array<[number, number]> = [
    [1, 0.3],
    [2.5, 1.7],
    [10, 4.5],
    [5.4, 2.8],
    [9.1, 0.6],
  ];
  subs.forEach(([a, b], i) => {
    const v = r2(a - b);
    items.push(makeSpeed({
      id: `Q_sub_${i + 1}`, term: "下册",
      unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法",
      skillId: "decimal_add_sub_vertical", skillName: "小数加减竖式",
      ability: ["calculation"], examPriority: "MUST_BIG", difficulty: 2,
      stem: `${a} − ${b} = ?`, value: v,
      distractors: [r2(a + b), r2(b - a), r2(v + 1)],
      time: 18,
    }));
  });
  // 整数 × 小数（初学）难度 2
  const muls: Array<[number, number]> = [
    [0.3, 6],
    [0.5, 8],
    [1.2, 5],
    [4, 0.25],
    [0.7, 3],
    [2.4, 5],
  ];
  muls.forEach(([a, b], i) => {
    const v = r2(a * b);
    items.push(makeSpeed({
      id: `Q_mul_${i + 1}`, term: "下册",
      unitId: "G4B_U3_DECIMAL_MULTIPLY", unitName: "小数乘法",
      skillId: "decimal_mul_vertical", skillName: "小数乘法竖式",
      ability: ["calculation"], examPriority: "MUST_BIG", difficulty: 2,
      stem: `${a} × ${b} = ?`, value: v,
      distractors: [r2(v * 10), r2(v / 10), r2(a + b)],
      time: 18,
    }));
  });
  // 整数四则 难度 1-2 凑整简便
  items.push(makeSpeed({
    id: "Q_simp_1", term: "上册", unitId: "G4A_U4_LAWS", unitName: "运算律",
    skillId: "simplify_integer", skillName: "整数简便", ability: ["strategy"],
    examPriority: "NORMAL", difficulty: 2,
    stem: "25 + 49 + 75 = ?", value: 149,
    distractors: [124, 154, 145],
    hints: [{ text: "25+75=100", penalty: 1 }],
    time: 18,
  }));
  // 角度计算 难度 2-3
  items.push(makeSpeed({
    id: "Q_ang_1", term: "下册", unitId: "G4B_U2_TRI_QUAD", unitName: "认识三角形和四边形",
    skillId: "triangle_angle_sum", skillName: "三角形内角和", ability: ["calculation", "spatial"],
    examPriority: "MUST_SMALL", difficulty: 2,
    stem: "等边三角形每个角是？", value: 60,
    distractors: [90, 45, 180],
    time: 15,
  }));
  items.push(makeSpeed({
    id: "Q_ang_2", term: "下册", unitId: "G4B_U2_TRI_QUAD", unitName: "认识三角形和四边形",
    skillId: "triangle_angle_sum", skillName: "三角形内角和", ability: ["calculation", "spatial"],
    examPriority: "MUST_SMALL", difficulty: 3,
    stem: "直角三角形两个锐角和是？", value: 90,
    distractors: [180, 60, 45],
    hints: [{ text: "总和 180°，已用 90°", penalty: 1 }],
    time: 18,
  }));
  // 平均数 难度 1-2
  items.push(makeSpeed({
    id: "Q_avg_1", term: "下册", unitId: "G4B_U6_DATA", unitName: "数据的表示和分析",
    skillId: "average_compute", skillName: "求平均数", ability: ["calculation", "data"],
    examPriority: "MUST_BIG", difficulty: 1,
    stem: "数 4、6、8 的平均数是？", value: 6,
    distractors: [18, 4, 8],
    time: 15,
  }));
  items.push(makeSpeed({
    id: "Q_avg_2", term: "下册", unitId: "G4B_U6_DATA", unitName: "数据的表示和分析",
    skillId: "average_compute", skillName: "求平均数", ability: ["calculation", "data"],
    examPriority: "MUST_BIG", difficulty: 2,
    stem: "数 80、85、90、85 的平均数是？", value: 85,
    distractors: [340, 80, 90],
    time: 18,
  }));
  // 解方程 难度 1
  items.push(makeSpeed({
    id: "Q_eq_1", term: "下册", unitId: "G4B_U5_EQUATIONS", unitName: "认识方程",
    skillId: "equation_solve_simple", skillName: "解简单方程", ability: ["calculation"],
    examPriority: "MUST_SMALL", difficulty: 1,
    stem: "x − 4 = 6，x = ?", value: 10,
    distractors: [2, 24, 14],
    time: 15,
  }));
  items.push(makeSpeed({
    id: "Q_eq_2", term: "下册", unitId: "G4B_U5_EQUATIONS", unitName: "认识方程",
    skillId: "equation_solve_simple", skillName: "解简单方程", ability: ["calculation"],
    examPriority: "MUST_SMALL", difficulty: 2,
    stem: "x ÷ 5 = 1.2，x = ?", value: 6,
    distractors: [0.24, 5, 60],
    time: 20,
  }));
  // 单位换算 难度 1-2
  items.push(makeSpeed({
    id: "Q_unit_1", term: "下册", unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法",
    skillId: "decimal_unit_conversion", skillName: "单位换算", ability: ["concept"],
    examPriority: "MUST_SMALL", difficulty: 1,
    stem: "0.5 米 = 多少厘米？", value: 50,
    distractors: [5, 500, 0.5],
    time: 15,
  }));
  items.push(makeSpeed({
    id: "Q_unit_2", term: "下册", unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法",
    skillId: "decimal_unit_conversion", skillName: "单位换算", ability: ["concept"],
    examPriority: "MUST_SMALL", difficulty: 2,
    stem: "2.05 千克 = 多少克？", value: 2050,
    distractors: [205, 20.5, 20500],
    time: 18,
  }));
  return items;
}

const expansionV03: Question[] = [
  ...tfQuestions,
  ...verticalQuestions,
  ...genQuickSet(),
];

/* ============================================================
   v0.4 扩展：4 个新游戏模板的题目
   ============================================================ */

// 小数点滑梯
const decimalShifterQs: Question[] = [
  {
    ...base,
    question_id: "DS_shift_1",
    term: "下册",
    unit_id: "G4B_U3_DECIMAL_MULTIPLY",
    unit_name: "小数乘法",
    skill_id: "decimal_point_shift",
    skill_name: "小数点移动",
    ability_dimension: ["concept", "strategy"],
    exam_priority: "MUST_SMALL",
    game_type: "decimal_shifter",
    play_as: "decimal_shifter",
    cognitive_level: "procedural",
    difficulty: 2,
    estimated_time_seconds: 25,
    stem: "把 3.6 扩大 10 倍，结果是多少？",
    question_format: "numeric",
    answer: { type: "number", value: 36 },
    solution_steps: ["扩大 10 倍 = 小数点向右移 1 位", "3.6 → 36"],
    hints: [{ text: "扩大 10 倍：小数点向右走 1 位", penalty: 1 }],
    common_errors: [
      { tag: "decimal_point_error", error: "方向错或位数错", remediation: "扩大向右、缩小向左。" },
      { tag: "careless_reading", error: "看错倍率", remediation: "重读题。" },
    ],
    feedback_correct: "小数点滑得很准！",
    feedback_wrong: "再想想：扩大 10 倍，点向哪边走？",
    tags: ["start:3.6", "factor:×10"],
  },
  {
    ...base,
    question_id: "DS_shift_2",
    term: "下册",
    unit_id: "G4B_U3_DECIMAL_MULTIPLY",
    unit_name: "小数乘法",
    skill_id: "decimal_point_shift",
    skill_name: "小数点移动",
    ability_dimension: ["concept"],
    exam_priority: "MUST_SMALL",
    game_type: "decimal_shifter",
    play_as: "decimal_shifter",
    cognitive_level: "procedural",
    difficulty: 2,
    estimated_time_seconds: 25,
    stem: "把 254 缩小 100 倍，结果是多少？",
    question_format: "numeric",
    answer: { type: "number", value: 2.54 },
    solution_steps: ["缩小 100 倍 = 小数点向左 2 位", "254 → 2.54"],
    hints: [{ text: "缩小 100 倍：向左 2 位", penalty: 1 }],
    common_errors: [
      { tag: "decimal_point_error", error: "向右移", remediation: "缩小是向左移。" },
      { tag: "place_value_error", error: "位数错", remediation: "100 倍 = 2 位。" },
    ],
    feedback_correct: "完美！小数点向左走 2 位。",
    feedback_wrong: "缩小要向左移，再数一下要走几位。",
    tags: ["start:254", "factor:÷100"],
  },
  {
    ...base,
    question_id: "DS_shift_3",
    term: "下册",
    unit_id: "G4B_U3_DECIMAL_MULTIPLY",
    unit_name: "小数乘法",
    skill_id: "decimal_point_shift",
    skill_name: "小数点移动",
    ability_dimension: ["concept", "strategy"],
    exam_priority: "MUST_SMALL",
    game_type: "decimal_shifter",
    play_as: "decimal_shifter",
    cognitive_level: "procedural",
    difficulty: 3,
    estimated_time_seconds: 30,
    stem: "把 0.45 扩大 1000 倍，结果是多少？",
    question_format: "numeric",
    answer: { type: "number", value: 450 },
    solution_steps: ["1000 倍 = 向右 3 位", "0.45 → 4.5 → 45 → 450"],
    hints: [{ text: "1000 倍 = 向右 3 位", penalty: 1 }, { text: "数字不够长就在后面补 0", penalty: 1 }],
    common_errors: [
      { tag: "decimal_point_error", error: "得 4.5 或 45", remediation: "走 3 位，数字不够时补 0。" },
    ],
    feedback_correct: "你会在数字不够时补 0，太棒了！",
    feedback_wrong: "向右移 3 位，数字不够长就补 0。",
    tags: ["start:0.45", "factor:×1000"],
  },
];

// 记忆配对（小数 ↔ 表达式 / 等价数）
const memoryMatchQs: Question[] = [
  {
    ...base,
    question_id: "MM_dec_1",
    term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB",
    unit_name: "小数的意义和加减法",
    skill_id: "decimal_meaning_place",
    skill_name: "小数意义",
    ability_dimension: ["concept", "habit"],
    exam_priority: "MUST_SMALL",
    game_type: "memory_match",
    play_as: "memory_match",
    cognitive_level: "recall",
    difficulty: 2,
    estimated_time_seconds: 60,
    stem: "把每张牌和它相等的另一张配对：",
    question_format: "numeric",
    answer: { type: "number", value: 1 },
    solution_steps: ["小数和表达式表示同一个数才能配对"],
    common_errors: [
      { tag: "concept_confuse", error: "数位混淆", remediation: "0.5 = 5 个 0.1。" },
      { tag: "careless_reading", error: "记错配对", remediation: "翻牌时多看一会再翻第二张。" },
    ],
    feedback_correct: "记得很牢！",
    feedback_wrong: "再来一次，慢慢看。",
    tags: [
      "pair:0.5|5个0.1",
      "pair:0.30|0.3",
      "pair:0.25|2/8",
      "pair:1.5|0.5×3",
    ],
  },
  {
    ...base,
    question_id: "MM_unit_1",
    term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB",
    unit_name: "小数的意义和加减法",
    skill_id: "decimal_unit_conversion",
    skill_name: "单位换算",
    ability_dimension: ["concept", "habit"],
    exam_priority: "MUST_SMALL",
    game_type: "memory_match",
    play_as: "memory_match",
    cognitive_level: "recall",
    difficulty: 2,
    estimated_time_seconds: 60,
    stem: "把相等的长度配对（米 ↔ 厘米）：",
    question_format: "numeric",
    answer: { type: "number", value: 1 },
    solution_steps: ["1 米 = 100 厘米"],
    common_errors: [
      { tag: "unit_conversion_error", error: "进率错", remediation: "1 米 = 100 厘米。" },
      { tag: "careless_reading", error: "看错单位", remediation: "记得看清楚是米还是厘米。" },
    ],
    feedback_correct: "单位换算很稳！",
    feedback_wrong: "1 米 = 100 厘米，再来。",
    tags: [
      "pair:1.5米|150厘米",
      "pair:0.8米|80厘米",
      "pair:2.05米|205厘米",
      "pair:0.5米|50厘米",
    ],
  },
];

// 图形法庭（三边判定）
const shapeCourtQs: Question[] = [
  {
    ...base,
    question_id: "SC_tri_1",
    term: "下册",
    unit_id: "G4B_U2_TRI_QUAD",
    unit_name: "认识三角形和四边形",
    skill_id: "triangle_inequality",
    skill_name: "三边关系",
    ability_dimension: ["reasoning", "spatial"],
    exam_priority: "MUST_SMALL",
    game_type: "shape_court",
    play_as: "shape_court",
    cognitive_level: "reasoning",
    difficulty: 2,
    estimated_time_seconds: 25,
    stem: "这三根木棒能围成三角形吗？",
    question_format: "single_choice",
    options: [
      { id: "T", text: "能" },
      { id: "F", text: "不能" },
    ],
    answer: { type: "choice", value: "T" },
    solution_steps: ["3+4=7>5，可以围成"],
    hints: [{ text: "用最短两边相加跟最长边比较", penalty: 1 }],
    common_errors: [
      { tag: "triangle_condition_error", error: "记错条件", remediation: "两边之和大于第三边。" },
    ],
    feedback_correct: "你看出来了！",
    feedback_wrong: "再看一下：最短两边相加是不是大于最长边？",
    tags: ["sticks:3,4,5"],
  },
  {
    ...base,
    question_id: "SC_tri_2",
    term: "下册",
    unit_id: "G4B_U2_TRI_QUAD",
    unit_name: "认识三角形和四边形",
    skill_id: "triangle_inequality",
    skill_name: "三边关系",
    ability_dimension: ["reasoning", "spatial"],
    exam_priority: "MUST_SMALL",
    game_type: "shape_court",
    play_as: "shape_court",
    cognitive_level: "reasoning",
    difficulty: 3,
    estimated_time_seconds: 25,
    stem: "这三根木棒能围成三角形吗？",
    question_format: "single_choice",
    options: [
      { id: "T", text: "能" },
      { id: "F", text: "不能" },
    ],
    answer: { type: "choice", value: "F" },
    solution_steps: ["2+3=5，不大于 5，所以不能围成"],
    hints: [{ text: "等于第三边时也不行哦", penalty: 1 }],
    common_errors: [
      { tag: "triangle_condition_error", error: "误以为相等可以", remediation: "必须严格大于。" },
    ],
    feedback_correct: "细节抓得好——必须严格大于。",
    feedback_wrong: "2+3=5 刚好等于第三边，围不成哦。",
    tags: ["sticks:2,3,5"],
  },
  {
    ...base,
    question_id: "SC_tri_3",
    term: "下册",
    unit_id: "G4B_U2_TRI_QUAD",
    unit_name: "认识三角形和四边形",
    skill_id: "triangle_inequality",
    skill_name: "三边关系",
    ability_dimension: ["reasoning", "spatial"],
    exam_priority: "MUST_SMALL",
    game_type: "shape_court",
    play_as: "shape_court",
    cognitive_level: "reasoning",
    difficulty: 3,
    estimated_time_seconds: 25,
    stem: "这三根木棒能围成三角形吗？",
    question_format: "single_choice",
    options: [
      { id: "T", text: "能" },
      { id: "F", text: "不能" },
    ],
    answer: { type: "choice", value: "F" },
    solution_steps: ["3+4=7<8，不能"],
    hints: [{ text: "看看 3+4 是多少", penalty: 1 }],
    common_errors: [
      { tag: "triangle_condition_error", error: "判断条件错", remediation: "两边之和必须大于第三边。" },
    ],
    feedback_correct: "完美判断！",
    feedback_wrong: "3+4=7，比 8 还小，没法围成。",
    tags: ["sticks:3,4,8"],
  },
];

// 方程天平
const balanceLabQs: Question[] = [
  {
    ...base,
    question_id: "BL_eq_1",
    term: "下册",
    unit_id: "G4B_U5_EQUATIONS",
    unit_name: "认识方程",
    skill_id: "equation_solve_simple",
    skill_name: "解简单方程",
    ability_dimension: ["calculation", "strategy"],
    exam_priority: "MUST_SMALL",
    game_type: "balance_lab",
    play_as: "balance_lab",
    cognitive_level: "procedural",
    difficulty: 2,
    estimated_time_seconds: 45,
    stem: "在天平两边操作，把方程化简为 x = ?",
    question_format: "numeric",
    answer: { type: "number", value: 6.4 },
    solution_steps: ["两边减 3.6", "x = 6.4"],
    hints: [{ text: "想让左边只剩 x，要消掉那个 +3.6", penalty: 1 }],
    common_errors: [
      { tag: "equation_solve_error", error: "做错操作", remediation: "用『反操作』消项。" },
    ],
    feedback_correct: "天平保持平衡，化简很优雅！",
    feedback_wrong: "再想一下：两边同时做什么才能消掉 3.6？",
    tags: ["eq:x+3.6=10"],
  },
  {
    ...base,
    question_id: "BL_eq_2",
    term: "下册",
    unit_id: "G4B_U5_EQUATIONS",
    unit_name: "认识方程",
    skill_id: "equation_solve_simple",
    skill_name: "解简单方程",
    ability_dimension: ["calculation", "strategy"],
    exam_priority: "MUST_SMALL",
    game_type: "balance_lab",
    play_as: "balance_lab",
    cognitive_level: "procedural",
    difficulty: 3,
    estimated_time_seconds: 50,
    stem: "在天平两边操作，把方程化简为 x = ?",
    question_format: "numeric",
    answer: { type: "number", value: 9 },
    solution_steps: ["两边除以 3", "x = 9"],
    hints: [{ text: "x 前面有个 3，怎么消掉？", penalty: 1 }],
    common_errors: [
      { tag: "equation_solve_error", error: "用减法去消乘法", remediation: "乘的反操作是除。" },
    ],
    feedback_correct: "你抓住了『反操作』的关键！",
    feedback_wrong: "3x 是 3 乘 x，要用除法消。",
    tags: ["eq:3x=27"],
  },
  {
    ...base,
    question_id: "BL_eq_3",
    term: "下册",
    unit_id: "G4B_U5_EQUATIONS",
    unit_name: "认识方程",
    skill_id: "equation_solve_simple",
    skill_name: "解简单方程",
    ability_dimension: ["calculation", "strategy"],
    exam_priority: "MUST_SMALL",
    game_type: "balance_lab",
    play_as: "balance_lab",
    cognitive_level: "procedural",
    difficulty: 3,
    estimated_time_seconds: 60,
    stem: "在天平两边操作，把方程化简为 x = ?",
    question_format: "numeric",
    answer: { type: "number", value: 4 },
    solution_steps: ["两边减 5 → 2x = 8", "两边除以 2 → x = 4"],
    hints: [
      { text: "先消掉常数项 +5", penalty: 1 },
      { text: "再用除法把 2 去掉", penalty: 1 },
    ],
    common_errors: [
      { tag: "equation_solve_error", error: "顺序错", remediation: "先消常数再消系数。" },
    ],
    feedback_correct: "两步操作非常顺！",
    feedback_wrong: "分两步走：先消 +5，再消 ×2。",
    tags: ["eq:2x+5=13"],
  },
];

// 数据侦探（chart_detective）
const chartDetectiveQs: Question[] = [
  {
    ...base,
    question_id: "CD_avg_1",
    term: "下册",
    unit_id: "G4B_U6_DATA",
    unit_name: "数据的表示和分析",
    skill_id: "average_compute",
    skill_name: "求平均数",
    ability_dimension: ["data", "calculation"],
    exam_priority: "MUST_BIG",
    game_type: "chart_detective",
    play_as: "chart_detective",
    cognitive_level: "procedural",
    difficulty: 2,
    estimated_time_seconds: 45,
    stem: "把虚线拖到 5 次跳绳成绩的平均数位置：",
    question_format: "numeric",
    answer: { type: "number", value: 126 },
    solution_steps: ["总数：120+128+124+132+126 = 630", "630 ÷ 5 = 126"],
    hints: [
      { text: "平均数大约在最大与最小数中间", penalty: 1 },
      { text: "总和 ÷ 5 算一下", penalty: 1 },
    ],
    common_errors: [
      { tag: "average_formula_error", error: "随便估", remediation: "用总数 ÷ 份数检验。" },
      { tag: "careless_reading", error: "忘了一个数据", remediation: "把每个数都加进去。" },
    ],
    feedback_correct: "完美的平均数定位！",
    feedback_wrong: "再想一下：所有数加起来除以 5 是多少？",
    tags: ["bars:120,128,124,132,126", "step:1"],
  },
  {
    ...base,
    question_id: "CD_avg_2",
    term: "下册",
    unit_id: "G4B_U6_DATA",
    unit_name: "数据的表示和分析",
    skill_id: "average_compute",
    skill_name: "求平均数",
    ability_dimension: ["data", "calculation"],
    exam_priority: "MUST_BIG",
    game_type: "chart_detective",
    play_as: "chart_detective",
    cognitive_level: "procedural",
    difficulty: 2,
    estimated_time_seconds: 45,
    stem: "四个班植树棵数如下，把虚线拖到平均数位置：",
    question_format: "numeric",
    answer: { type: "number", value: 24 },
    solution_steps: ["总：20+24+28+24 = 96", "96 ÷ 4 = 24"],
    hints: [{ text: "总数 ÷ 班数", penalty: 1 }],
    common_errors: [
      { tag: "average_formula_error", error: "估错了", remediation: "用总和验算。" },
      { tag: "careless_reading", error: "份数错", remediation: "几列就是几份。" },
    ],
    feedback_correct: "你能一眼估出平均位置！",
    feedback_wrong: "总和 96 ÷ 4 = ?",
    tags: ["bars:20,24,28,24", "step:1"],
  },
  {
    ...base,
    question_id: "CD_avg_3",
    term: "下册",
    unit_id: "G4B_U6_DATA",
    unit_name: "数据的表示和分析",
    skill_id: "average_compute",
    skill_name: "求平均数",
    ability_dimension: ["data", "calculation"],
    exam_priority: "MUST_BIG",
    game_type: "chart_detective",
    play_as: "chart_detective",
    cognitive_level: "procedural",
    difficulty: 3,
    estimated_time_seconds: 60,
    stem: "下面是某周一周内每天的阅读分钟数，把虚线拖到平均值位置：",
    question_format: "numeric",
    answer: { type: "number", value: 30 },
    solution_steps: ["总：25+35+30+40+20+30+30=210", "210 ÷ 7 = 30"],
    hints: [{ text: "7 个数加起来再除 7", penalty: 1 }],
    common_errors: [
      { tag: "average_formula_error", error: "用 5 或 6 当份数", remediation: "一周 7 天。" },
    ],
    feedback_correct: "数据很多还能算准，太厉害！",
    feedback_wrong: "210 ÷ 7 = 30，再试一下。",
    tags: ["bars:25,35,30,40,20,30,30", "step:1"],
  },
  {
    ...base,
    question_id: "CD_bar_1",
    term: "下册",
    unit_id: "G4B_U6_DATA",
    unit_name: "数据的表示和分析",
    skill_id: "data_bar_chart",
    skill_name: "条形统计图读图",
    ability_dimension: ["data"],
    exam_priority: "HIGH_SMALL",
    game_type: "chart_detective",
    play_as: "chart_detective",
    cognitive_level: "procedural",
    difficulty: 2,
    estimated_time_seconds: 45,
    stem: "把虚线拖到所有柱子的最高值位置：",
    question_format: "numeric",
    answer: { type: "number", value: 45 },
    solution_steps: ["最高的是 45"],
    hints: [{ text: "找最高的那根", penalty: 1 }],
    common_errors: [
      { tag: "careless_reading", error: "看错最高", remediation: "对照刻度找。" },
      { tag: "place_value_error", error: "刻度看错", remediation: "看 y 轴上的数。" },
    ],
    feedback_correct: "看图很准！",
    feedback_wrong: "最高那一根的高度多少？",
    tags: ["bars:30,45,25,40,35", "step:5"],
  },
];

const expansionV04: Question[] = [
  ...decimalShifterQs,
  ...memoryMatchQs,
  ...shapeCourtQs,
  ...balanceLabQs,
  ...chartDetectiveQs,
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B (v0.36.78, 爸爸 2026-05-21 数学出题 loop)
 * 对齐成都北师大四下真实期末卷「解决问题」高分题型：购票方案/分段计价/红绳/倍数/
 * 和倍/速度路程/相遇。聚焦 FINAL_SPRINT 两大 0.22 权重 topic（小数乘法应用 + 列方程）。
 * tag=["from_test","exam","期末题"] → scheduler mock_exam pickScore 优先抽 + 期末备考中心可筛。
 * 详见 docs/math-exam-loop-state.md。算术已逐题验算。
 * =========================================================================== */
const EXAM_TAGS = ["from_test", "exam", "期末题"];
const examFinalPackG4B: Question[] = [
  // ① 分段计价·三班合买（真题 Q37 型，U3）
  makeApp({
    ...UNIT_DMUL,
    id: "G4B_exam_seg_1",
    skillId: "decimal_segment_pricing",
    skillName: "分段计价",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "儿童节演出要订演出服。批发价：1～50 套每套 75 元，51～100 套每套 70 元，100 套以上每套 65 元。四(1)班 43 人、四(2)班 55 人、四(3)班 52 人，每人订一套。",
    clues: [
      "四(1)班 43 人、四(2)班 55 人、四(3)班 52 人，每人订一套",
      "1～50 套每套 75 元",
      "51～100 套每套 70 元",
      "100 套以上每套 65 元",
      "演出在儿童节举行",
    ],
    correctClueIdx: [0, 3],
    relationshipChoices: [
      { id: "A", text: "三班合订共 150 套，超过 100 套，每套 65 元，总价 = 65 × 150", correct: true },
      { id: "B", text: "每套按 75 元算，总价 = 75 × 150", correct: false, errorTag: "wrong_price_tier" },
      { id: "C", text: "每套按 70 元算，总价 = 70 × 150", correct: false, errorTag: "wrong_price_tier" },
      { id: "D", text: "三班各自分开订，再分别定价", correct: false, errorTag: "ignore_combine" },
    ],
    finalPrompt: "三个班合起来订，一共要付多少元？",
    finalValue: 9750,
    finalUnit: "元",
    finalDistractors: [10500, 11250, 10715],
    expression: "(43+55+52)×65",
    solution_steps: ["总套数：43+55+52=150 套", "150 套超过 100 套，每套 65 元", "总价：65×150=9750 元"],
    check: "估算 65×150≈9750，合理",
    tags: [...EXAM_TAGS, "分段计价"],
  }),
  // ② 归一·红绳做花（真题 Q34 型，U3）
  makeApp({
    ...UNIT_DMUL,
    id: "G4B_exam_unit_1",
    skillId: "decimal_price_quantity",
    skillName: "归一问题",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "一条红绳长 120 分米，正好可以做 4 朵小红花。现在要做 25 朵同样的小红花。",
    clues: [
      "一条红绳长 120 分米",
      "这条红绳正好做 4 朵小红花",
      "现在要做 25 朵同样的小红花",
      "小红花用在元旦联欢会上",
    ],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "先求每朵用绳 = 总长 ÷ 朵数，再求 25 朵 = 每朵 × 25", correct: true },
      { id: "B", text: "需要红绳 = 120 × 25", correct: false, errorTag: "skip_normalize" },
      { id: "C", text: "需要红绳 = 120 ÷ 25 × 4", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "做 25 朵小红花一共需要红绳多少分米？",
    finalValue: 750,
    finalUnit: "分米",
    finalDistractors: [3000, 19.2, 700],
    expression: "120÷4×25",
    solution_steps: ["每朵用绳：120÷4=30 分米", "25 朵：30×25=750 分米"],
    check: "30×25=750，合理",
    tags: [...EXAM_TAGS, "归一"],
  }),
  // ③ 倍数·大象与熊猫（真题 Q36 型，U3）
  makeApp({
    ...UNIT_DMUL,
    id: "G4B_exam_times_1",
    skillId: "decimal_work_total",
    skillName: "倍数关系",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "一头大象每天吃 180 千克食物，一只熊猫 3 天吃 108 千克食物。",
    clues: [
      "一头大象每天吃 180 千克食物",
      "一只熊猫 3 天吃 108 千克食物",
      "大象和熊猫都生活在动物园",
    ],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "先求熊猫每天吃多少（108÷3），再求大象是熊猫的几倍（180÷熊猫每天）", correct: true },
      { id: "B", text: "倍数 = 180 ÷ 108", correct: false, errorTag: "forgot_daily" },
      { id: "C", text: "倍数 = 108 ÷ 180", correct: false, errorTag: "inverse_ratio" },
    ],
    finalPrompt: "大象每天吃的食物是熊猫每天的多少倍？",
    finalValue: 5,
    finalUnit: "倍",
    finalDistractors: [1.67, 0.2, 3],
    expression: "180÷(108÷3)",
    solution_steps: ["熊猫每天：108÷3=36 千克", "大象是熊猫的：180÷36=5 倍"],
    check: "36×5=180，正确",
    tags: [...EXAM_TAGS, "倍数"],
  }),
  // ④ 购票最优方案（真题 Q33 型，U3，选择最优）
  makeChoice({
    ...UNIT_DMUL,
    id: "G4B_exam_ticket_1",
    skillId: "decimal_segment_pricing",
    skillName: "购票方案",
    ability: ["reasoning", "strategy"],
    examPriority: "MUST_BIG",
    difficulty: 5,
    cognitive: "reasoning",
    stem: "一批游客共 18 人（8 个大人、10 个小孩）去参观博物馆。成人票 30 元/人，儿童票 15 元/人，团体票 20 元/人（10 人起，含 10 人）。怎样买票最省钱？",
    options: [
      { id: "A", text: "全部按团体票买：18×20=360 元" },
      { id: "B", text: "大人小孩都单买：8×30+10×15=390 元", errorTag: "not_optimal" },
      { id: "C", text: "8 个大人和 2 个小孩凑 10 人买团体票，其余 8 个小孩单买：10×20+8×15=320 元" },
      { id: "D", text: "只给 8 个大人买团体票，小孩单买", errorTag: "team_min_violation" },
    ],
    correctId: "C",
    solution_steps: [
      "团体票 20 元，比成人票 30 元便宜，比儿童票 15 元贵",
      "让 8 个大人（再凑 2 个小孩够 10 人）享受团体价最划算",
      "团体：10×20=200 元；其余 8 个小孩单买：8×15=120 元",
      "共 200+120=320 元，比 360、390 都省（D 方案不足 10 人无法买团体票）",
    ],
    tags: [...EXAM_TAGS, "购票方案"],
  }),
  // ⑤ 小数乘法·购物（U3）
  makeApp({
    ...UNIT_DMUL,
    id: "G4B_exam_dpq_1",
    skillId: "decimal_price_quantity",
    skillName: "总价=单价×数量",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "苹果每千克 6.5 元，妈妈买了 3.2 千克。",
    clues: ["苹果每千克 6.5 元", "妈妈买了 3.2 千克", "苹果是红色的"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "总价 = 单价 × 数量", correct: true },
      { id: "B", text: "总价 = 单价 + 数量", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "总价 = 单价 ÷ 数量", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "一共要付多少元？",
    finalValue: 20.8,
    finalUnit: "元",
    finalDistractors: [208, 2.08, 19.5],
    expression: "6.5×3.2",
    solution_steps: ["6.5×3.2=20.8 元"],
    check: "65×32=2080，两位小数=20.80",
    tags: [...EXAM_TAGS, "小数乘法"],
  }),
  // ⑥ 列方程·和倍（U5，真题 Q35 型）
  makeApp({
    ...UNIT_EQ,
    id: "G4B_exam_eq_sum_1",
    skillId: "equation_sum_difference",
    skillName: "和倍列方程",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "图书角有故事书和科技书共 96 本，故事书的本数是科技书的 3 倍。",
    clues: ["故事书和科技书共 96 本", "故事书是科技书的 3 倍", "图书角在教室后面"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "设科技书 x 本，故事书 3x 本，x + 3x = 96", correct: true },
      { id: "B", text: "x + 3 = 96", correct: false, errorTag: "ignore_multiple" },
      { id: "C", text: "3x − x = 96", correct: false, errorTag: "sum_vs_diff" },
    ],
    finalPrompt: "科技书有多少本？",
    finalValue: 24,
    finalUnit: "本",
    finalDistractors: [32, 48, 72],
    expression: "x+3x=96",
    solution_steps: ["设科技书 x 本，故事书 3x 本", "x+3x=96，4x=96，x=24", "科技书 24 本（故事书 72 本）"],
    check: "24+72=96，正确",
    tags: [...EXAM_TAGS, "列方程", "和倍"],
  }),
  // ⑦ 小数乘法·速度路程（U3）
  makeApp({
    ...UNIT_DMUL,
    id: "G4B_exam_speed_1",
    skillId: "decimal_speed_distance",
    skillName: "路程=速度×时间",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "一辆汽车每小时行驶 65.5 千米，行驶了 4 小时。",
    clues: ["汽车每小时行驶 65.5 千米", "行驶了 4 小时", "汽车是蓝色的"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "路程 = 速度 × 时间", correct: true },
      { id: "B", text: "路程 = 速度 ÷ 时间", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "路程 = 速度 + 时间", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "一共行驶了多少千米？",
    finalValue: 262,
    finalUnit: "千米",
    finalDistractors: [2620, 26.2, 260],
    expression: "65.5×4",
    solution_steps: ["65.5×4=262 千米"],
    check: "65×4=260，接近 262",
    tags: [...EXAM_TAGS, "小数乘法"],
  }),
  // ⑧ 列方程·相遇问题（U5）
  makeApp({
    ...UNIT_EQ,
    id: "G4B_exam_eq_meet_1",
    skillId: "equation_meeting_problem",
    skillName: "相遇问题",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "甲、乙两人从两地同时出发，相向而行。甲每分钟走 60 米，乙每分钟走 55 米，6 分钟后两人相遇。",
    clues: ["甲每分钟走 60 米", "乙每分钟走 55 米", "6 分钟后两人相遇", "甲乙是同班同学"],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "两地距离 = (甲速 + 乙速) × 相遇时间", correct: true },
      { id: "B", text: "两地距离 = (甲速 − 乙速) × 时间", correct: false, errorTag: "sum_vs_diff" },
      { id: "C", text: "两地距离 = 甲速 × 时间", correct: false, errorTag: "miss_one_mover" },
    ],
    finalPrompt: "两地相距多少米？",
    finalValue: 690,
    finalUnit: "米",
    finalDistractors: [30, 360, 330],
    expression: "(60+55)×6",
    solution_steps: ["速度和：60+55=115 米/分", "两地距离：115×6=690 米"],
    check: "115×6=690，正确",
    tags: [...EXAM_TAGS, "列方程", "相遇"],
  }),
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B2 (v0.36.79, 数学出题 loop iter3)
 * 覆盖真题 填空/判断/选择 题型 × U1小数意义加减/U2三角形/U4观察物体/U6平均数。
 * tag=["from_test","exam","期末题"]。算术逐题验算 + 待 proxy 复核。
 * =========================================================================== */
const examFinalPackG4B2: Question[] = [
  // U1 单位换算（真题 Q3 型）
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_exam_conv_1",
    skillId: "decimal_unit_conversion",
    skillName: "单位换算",
    ability: ["concept", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "4.07 千克 = （ ）克。",
    value: 4070,
    unit: "克",
    distractors: [40.7, 407, 40700],
    tags: [...EXAM_TAGS, "单位换算"],
  }),
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_exam_conv_2",
    skillId: "decimal_unit_conversion",
    skillName: "单位换算",
    ability: ["concept", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "0.65 平方米 = （ ）平方分米。（1 平方米 = 100 平方分米）",
    value: 65,
    unit: "平方分米",
    distractors: [6.5, 650, 6500],
    tags: [...EXAM_TAGS, "单位换算"],
  }),
  // U1 小数大小比较（真题 Q6 型）
  makeChoice({
    ...UNIT_DAS,
    id: "G4B_exam_cmp_1",
    skillId: "decimal_compare",
    skillName: "小数大小比较",
    ability: ["concept", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 2,
    cognitive: "reasoning",
    stem: "下面比较大小，正确的是（ ）。",
    options: [
      { id: "A", text: "12.251 < 12.351" },
      { id: "B", text: "12.251 > 12.351", errorTag: "compare_error" },
      { id: "C", text: "12.251 = 12.351", errorTag: "compare_error" },
    ],
    correctId: "A",
    solution_steps: ["整数部分都是 12，比十分位", "2 < 3，所以 12.251 < 12.351"],
    tags: [...EXAM_TAGS, "小数比较"],
  }),
  // U1 小数组成（真题 Q26 型）
  makeChoice({
    ...UNIT_DAS,
    id: "G4B_exam_meaning_1",
    skillId: "decimal_meaning_place",
    skillName: "小数的组成",
    ability: ["concept"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "由 2 个一、6 个十分之一和 8 个千分之一组成的小数是（ ）。",
    options: [
      { id: "A", text: "2.608" },
      { id: "B", text: "2.68", errorTag: "place_value_error" },
      { id: "C", text: "26.08", errorTag: "place_value_error" },
    ],
    correctId: "A",
    solution_steps: ["2 个一 = 2", "6 个十分之一 = 0.6", "8 个千分之一 = 0.008（百分位是 0）", "合起来 = 2.608"],
    tags: [...EXAM_TAGS, "小数意义"],
  }),
  // U1 数位意义（真题 Q21 型）
  makeChoice({
    ...UNIT_DAS,
    id: "G4B_exam_place_1",
    skillId: "decimal_meaning_place",
    skillName: "数位意义",
    ability: ["concept"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "在 3.159 中，“5”表示（ ）。",
    options: [
      { id: "A", text: "5 个 0.1", errorTag: "place_value_error" },
      { id: "B", text: "5 个 0.01" },
      { id: "C", text: "5 个 0.001", errorTag: "place_value_error" },
    ],
    correctId: "B",
    solution_steps: ["3.159 中，5 在百分位上", "百分位的计数单位是 0.01", "所以 5 表示 5 个 0.01"],
    tags: [...EXAM_TAGS, "小数意义"],
  }),
  // U1 0.6 与 0.60（真题 Q27 型）
  makeChoice({
    ...UNIT_DAS,
    id: "G4B_exam_meaning_2",
    skillId: "decimal_compare",
    skillName: "小数的意义",
    ability: ["concept", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    cognitive: "reasoning",
    stem: "0.6 和 0.60 比较，正确的是（ ）。",
    options: [
      { id: "A", text: "大小相等，意义相同", errorTag: "ignore_unit" },
      { id: "B", text: "大小相等，意义不同" },
      { id: "C", text: "大小不相等，意义不同", errorTag: "compare_error" },
    ],
    correctId: "B",
    solution_steps: ["0.6 表示 6 个 0.1，0.60 表示 60 个 0.01", "根据小数性质，末尾添 0 大小不变 → 大小相等", "但计数单位（意义）不同"],
    tags: [...EXAM_TAGS, "小数意义"],
  }),
  // U1 小数点移动（真题 Q15/Q16 型）
  makeChoice({
    ...UNIT_DAS,
    id: "G4B_exam_shift_1",
    skillId: "decimal_point_shift",
    skillName: "小数点移动",
    ability: ["concept", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    cognitive: "reasoning",
    stem: "把 0.096 的小数点去掉，得到的数 96 是原来的（ ）。",
    options: [
      { id: "A", text: "10 倍", errorTag: "shift_count_error" },
      { id: "B", text: "100 倍", errorTag: "shift_count_error" },
      { id: "C", text: "1000 倍" },
    ],
    correctId: "C",
    solution_steps: ["0.096 → 96，小数点向右移动了 3 位", "小数点每右移 1 位扩大到 10 倍，移 3 位扩大到 1000 倍", "（注意不是 100 倍）"],
    tags: [...EXAM_TAGS, "小数点移动"],
  }),
  // U6 平均数·已知平均求新平均（真题 Q28 型）
  makeApp({
    ...UNIT_DATA,
    id: "G4B_exam_avg_1",
    skillId: "average_inverse_total",
    skillName: "平均数综合",
    ability: ["modeling", "data"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "亮亮语文和数学的平均成绩是 90 分，常识科 96 分。",
    clues: ["语文和数学的平均成绩是 90 分", "常识科成绩是 96 分", "亮亮上四年级"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "三科总分 = 90×2 + 96，三科平均 = 三科总分 ÷ 3", correct: true },
      { id: "B", text: "三科平均 = (90 + 96) ÷ 2", correct: false, errorTag: "wrong_count" },
      { id: "C", text: "三科平均 = (90 + 96) ÷ 3", correct: false, errorTag: "forgot_two_subjects" },
    ],
    finalPrompt: "他三科的平均成绩是多少分？",
    finalValue: 92,
    finalUnit: "分",
    finalDistractors: [93, 95, 88],
    expression: "(90×2+96)÷3",
    solution_steps: ["语数总分：90×2=180 分", "三科总分：180+96=276 分", "三科平均：276÷3=92 分"],
    check: "92×3=276，正确",
    tags: [...EXAM_TAGS, "平均数"],
  }),
  // U6 平均数·直接求（真题 Q5 型）
  makeSpeed({
    ...UNIT_DATA,
    id: "G4B_exam_avg_2",
    skillId: "average_compute",
    skillName: "求平均数",
    ability: ["data", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "一天测量 6 次气温，分别是 17℃、20℃、26℃、27℃、23℃、19℃，这一天的平均气温是多少摄氏度？",
    value: 22,
    unit: "℃",
    distractors: [21, 23, 26],
    tags: [...EXAM_TAGS, "平均数"],
  }),
  // U2 三角形三边关系（真题 Q18 型）
  makeChoice({
    ...UNIT_TRI,
    id: "G4B_exam_tri_1",
    skillId: "triangle_inequality",
    skillName: "三角形三边关系",
    ability: ["concept", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    cognitive: "reasoning",
    stem: "用 5 厘米、5 厘米、10 厘米的三根小棒，能围成一个三角形吗？",
    options: [
      { id: "A", text: "能，是等腰三角形", errorTag: "ignore_inequality" },
      { id: "B", text: "不能，因为 5+5=10，不大于第三条边" },
      { id: "C", text: "能，是等边三角形", errorTag: "concept_confuse" },
    ],
    correctId: "B",
    solution_steps: ["三角形任意两边之和必须大于第三边", "5+5=10，等于第三边 10，不大于", "所以围不成三角形"],
    tags: [...EXAM_TAGS, "三角形"],
  }),
  // U2 三角形分类（真题 Q20 型：露出一个锐角无法确定）
  makeChoice({
    ...UNIT_TRI,
    id: "G4B_exam_tri_2",
    skillId: "triangle_classification",
    skillName: "三角形分类",
    ability: ["concept", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    cognitive: "reasoning",
    stem: "一个三角形被遮住了一部分，只露出一个锐角。按角分，它是一个（ ）三角形。",
    options: [
      { id: "A", text: "锐角三角形", errorTag: "insufficient_info" },
      { id: "B", text: "直角三角形", errorTag: "insufficient_info" },
      { id: "C", text: "无法确定" },
    ],
    correctId: "C",
    solution_steps: ["任何三角形都至少有两个锐角", "只看到一个锐角，另外两个角可能是锐角、直角或钝角", "所以无法确定它是哪种三角形"],
    tags: [...EXAM_TAGS, "三角形"],
  }),
  // U4 观察物体（真题 Q11 型）
  makeChoice({
    ...UNIT_OBS,
    id: "G4B_exam_obs_1",
    skillId: "observe_front_top_left",
    skillName: "观察物体",
    ability: ["spatial", "reasoning"],
    examPriority: "HIGH_BIG",
    difficulty: 3,
    cognitive: "reasoning",
    stem: "一个物体从前面看到的形状是 3 个小正方形横着排成一排。这个物体一定是由 3 个小正方体拼成的吗？",
    options: [
      { id: "A", text: "一定是 3 个", errorTag: "ignore_hidden" },
      { id: "B", text: "不一定，可能是 3 个，也可能更多" },
      { id: "C", text: "一定是 1 个", errorTag: "concept_confuse" },
    ],
    correctId: "B",
    solution_steps: ["从前面看到 3 个正方形，只能确定前面这一排", "后面（或上面）可能还藏着看不见的小正方体", "所以不一定只有 3 个，可能更多"],
    tags: [...EXAM_TAGS, "观察物体"],
  }),
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B3 (v0.36.80, 数学出题 loop iter4)
 * 真题计算题型(口算/竖式验算/简便) + U5解方程/方程定义 + U2内角和/角分类 + U6数据。
 * tag=["from_test","exam","期末题"]。算术逐题验算 + proxy 复核。
 * =========================================================================== */
const examFinalPackG4B3: Question[] = [
  // U5 解方程（真题 Q22 型）
  makeChoice({
    ...UNIT_EQ,
    id: "G4B_exam_solve_1",
    skillId: "equation_solve_simple",
    skillName: "解方程",
    ability: ["calculation", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    cognitive: "procedural",
    stem: "方程 5x − 18 = 12 的解是（ ）。",
    options: [
      { id: "A", text: "x = 2", errorTag: "solve_error" },
      { id: "B", text: "x = 4", errorTag: "solve_error" },
      { id: "C", text: "x = 6" },
    ],
    correctId: "C",
    solution_steps: ["5x − 18 = 12", "5x = 12 + 18 = 30", "x = 30 ÷ 5 = 6"],
    tags: [...EXAM_TAGS, "解方程"],
  }),
  // U5 方程定义判断（真题 Q13 型）
  makeTF({
    ...UNIT_EQ,
    id: "G4B_exam_eqdef_1",
    skillId: "equation_meaning_balance",
    skillName: "方程的意义",
    ability: ["concept"],
    examPriority: "MUST_BIG",
    difficulty: 2,
    stem: "12 + 7X > 8 是一个方程。",
    truth: "F",
    solution_steps: ["方程是含有未知数的『等式』", "12 + 7X > 8 是不等式（用的是 >，不是等号）", "所以它不是方程"],
    hints: [{ text: "方程必须有等号 =", penalty: 1 }],
    tags: [...EXAM_TAGS, "方程意义"],
  }),
  // U5 列方程·一步（已知和求加数）
  makeApp({
    ...UNIT_EQ,
    id: "G4B_exam_eq1_1",
    skillId: "equation_one_step_word",
    skillName: "一步方程应用",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "一个数加上 3.6 等于 10。求这个数。",
    clues: ["一个数加上 3.6", "结果等于 10", "这个数是一位小数"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "设这个数为 x，列方程 x + 3.6 = 10", correct: true },
      { id: "B", text: "x − 3.6 = 10", correct: false, errorTag: "op_inverse" },
      { id: "C", text: "x × 3.6 = 10", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "这个数是多少？",
    finalValue: 6.4,
    finalUnit: "",
    finalDistractors: [13.6, 6, 4.6],
    expression: "x+3.6=10",
    solution_steps: ["设这个数为 x", "x + 3.6 = 10", "x = 10 − 3.6 = 6.4"],
    check: "6.4 + 3.6 = 10，正确",
    tags: [...EXAM_TAGS, "列方程"],
  }),
  // U1 简便计算·连减（真题 Q31 型）
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_exam_simp_1",
    skillId: "decimal_add_sub_simplify",
    skillName: "小数简便计算",
    ability: ["calculation", "strategy"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "用简便方法计算：95.6 − 18.3 − 25.6 = ？",
    value: 51.7,
    distractors: [51.9, 137.5, 52.7],
    hints: [{ text: "先凑整：95.6 − 25.6 = 70", penalty: 1 }, { text: "再 70 − 18.3", penalty: 2 }],
    tags: [...EXAM_TAGS, "简便计算"],
  }),
  // U1 简便计算·凑整加（真题 Q31 型）
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_exam_simp_2",
    skillId: "decimal_add_sub_simplify",
    skillName: "小数简便计算",
    ability: ["calculation", "strategy"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "用简便方法计算：3.9 + 3.08 + 12.92 + 6.1 = ？",
    value: 26,
    distractors: [25.9, 24, 26.1],
    hints: [{ text: "凑整：3.9+6.1=10，3.08+12.92=16", penalty: 1 }],
    tags: [...EXAM_TAGS, "简便计算"],
  }),
  // U3 小数乘法简便（结合律）
  makeSpeed({
    ...UNIT_DMUL,
    id: "G4B_exam_simp_3",
    skillId: "decimal_mul_simplify",
    skillName: "小数乘法简便",
    ability: ["calculation", "strategy"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "用简便方法计算：0.25 × 36 = ？",
    value: 9,
    distractors: [90, 0.9, 144],
    hints: [{ text: "0.25 × 4 = 1，把 36 拆成 4 × 9", penalty: 1 }],
    tags: [...EXAM_TAGS, "简便计算"],
  }),
  // 运算律·乘法分配律（真题 Q31 型）
  makeSpeed({
    ...UNIT_LAWS,
    id: "G4B_exam_dist_1",
    skillId: "distributive_law",
    skillName: "乘法分配律",
    ability: ["calculation", "strategy"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "用简便方法计算：324 × 15 + 324 × 87 − 324 × 2 = ？",
    value: 32400,
    distractors: [32076, 33048, 324],
    hints: [{ text: "提取公因数 324：324 × (15 + 87 − 2)", penalty: 1 }, { text: "15 + 87 − 2 = 100", penalty: 2 }],
    tags: [...EXAM_TAGS, "简便计算", "运算律"],
  }),
  // U1 竖式计算并验算（真题 Q30 型）
  makeVR({
    ...UNIT_DAS,
    id: "G4B_exam_vr_1",
    skillId: "decimal_add_sub_vertical",
    skillName: "小数加减竖式",
    ability: ["calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "列竖式计算 5.42 + 7.69 = ？哪一项是正确的得数？",
    vertLines: ["vert:5.42", "op:+", "vert:7.69", "result:?"],
    prompt: "和应该是多少？",
    options: [
      { id: "A", text: "13.11", correct: true },
      { id: "B", text: "12.11", correct: false, errorTag: "carry_error" },
      { id: "C", text: "131.1", correct: false, errorTag: "decimal_point_error" },
      { id: "D", text: "13.01", correct: false, errorTag: "carry_error" },
    ],
    solution_steps: ["小数点对齐", "百分位 2+9=11，写 1 进 1；十分位 4+6+1=11，写 1 进 1；个位 5+7+1=13", "和是 13.11"],
    tags: [...EXAM_TAGS, "竖式"],
  }),
  // U2 三角形内角和 + 分类（真题 Q19 型）
  makeChoice({
    ...UNIT_TRI,
    id: "G4B_exam_angsum_1",
    skillId: "triangle_angle_sum",
    skillName: "三角形内角和",
    ability: ["concept", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    cognitive: "reasoning",
    stem: "一个三角形其中两个角分别是 88° 和 44°。按角分，它是一个（ ）三角形。",
    options: [
      { id: "A", text: "锐角三角形" },
      { id: "B", text: "钝角三角形", errorTag: "angle_sum_error" },
      { id: "C", text: "直角三角形", errorTag: "angle_sum_error" },
    ],
    correctId: "A",
    solution_steps: ["三角形内角和是 180°", "第三个角 = 180° − 88° − 44° = 48°", "三个角 88°、44°、48° 都小于 90°，所以是锐角三角形"],
    tags: [...EXAM_TAGS, "三角形", "内角和"],
  }),
  // U2 角的分类（真题 Q32 型衍生）
  makeChoice({
    ...UNIT_TRI,
    id: "G4B_exam_angle_1",
    skillId: "angle_types",
    skillName: "角的分类",
    ability: ["concept"],
    examPriority: "HIGH_BIG",
    difficulty: 2,
    stem: "一个角是 105°，按大小分，它是（ ）。",
    options: [
      { id: "A", text: "锐角", errorTag: "angle_type_error" },
      { id: "B", text: "直角", errorTag: "angle_type_error" },
      { id: "C", text: "钝角" },
    ],
    correctId: "C",
    solution_steps: ["大于 90° 且小于 180° 的角是钝角", "105° 在 90°～180° 之间，所以是钝角"],
    tags: [...EXAM_TAGS, "角"],
  }),
  // U6 条形统计图·读数（真题数据题型）
  makeChoice({
    ...UNIT_DATA,
    id: "G4B_exam_data_1",
    skillId: "data_bar_chart",
    skillName: "条形统计图",
    ability: ["data", "reasoning"],
    examPriority: "HIGH_BIG",
    difficulty: 2,
    cognitive: "reasoning",
    stem: "四(1)班同学最喜欢的运动统计：篮球 12 人、足球 8 人、跳绳 15 人、乒乓球 10 人。喜欢人数最多的运动是（ ）。",
    options: [
      { id: "A", text: "篮球", errorTag: "read_error" },
      { id: "B", text: "跳绳" },
      { id: "C", text: "乒乓球", errorTag: "read_error" },
    ],
    correctId: "B",
    solution_steps: ["比较各项人数：12、8、15、10", "15 最大，对应跳绳", "所以喜欢人数最多的是跳绳"],
    tags: [...EXAM_TAGS, "统计"],
  }),
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B4 (v0.36.81, 数学出题 loop iter6)
 * 图形法庭 shape_court：三根小棒能否围成三角形（真题 Q18 高频考点，U2 triangle_inequality）。
 * 覆盖最易错的"恰好相等→不能"。tag from_test/exam/期末题。
 * =========================================================================== */
const triStickBase = {
  ...base,
  term: "下册" as const,
  unit_id: "G4B_U2_TRI_QUAD",
  unit_name: "认识三角形和四边形",
  skill_id: "triangle_inequality",
  skill_name: "三边关系",
  ability_dimension: ["reasoning", "spatial"] as AbilityId[],
  exam_priority: "MUST_BIG" as ExamPriority,
  game_type: "shape_court",
  play_as: "shape_court" as GameTemplate,
  cognitive_level: "reasoning" as const,
  estimated_time_seconds: 25,
  question_format: "single_choice" as const,
  options: [{ id: "T", text: "能" }, { id: "F", text: "不能" }],
  hints: [{ text: "用最短两边相加，跟最长边比，必须严格大于", penalty: 1 }],
  common_errors: [
    { tag: "triangle_condition_error", error: "把『大于等于』当成条件", remediation: "两边之和必须严格大于第三边，等于也不行。" },
  ],
};
const examFinalPackG4B4: Question[] = [
  {
    ...triStickBase,
    question_id: "G4B_exam_tristick_1",
    difficulty: 4,
    stem: "用 5 厘米、5 厘米、10 厘米的三根小棒，能围成三角形吗？",
    answer: { type: "choice", value: "F" },
    solution_steps: ["最短两边之和：5+5=10", "10 不大于第三边 10", "所以不能围成三角形"],
    feedback_correct: "判得准！5+5=10 不大于 10。",
    feedback_wrong: "再想想：最短两边相加要严格大于最长边。",
    tags: ["sticks:5,5,10", ...EXAM_TAGS, "三角形"],
  },
  {
    ...triStickBase,
    question_id: "G4B_exam_tristick_2",
    difficulty: 3,
    stem: "用 2 厘米、3 厘米、6 厘米的三根小棒，能围成三角形吗？",
    answer: { type: "choice", value: "F" },
    solution_steps: ["最短两边之和：2+3=5", "5 < 6（第三边）", "所以不能围成三角形"],
    feedback_correct: "对！2+3=5 比 6 小，围不成。",
    feedback_wrong: "最短两边 2+3=5，比最长边 6 小，围不成。",
    tags: ["sticks:2,3,6", ...EXAM_TAGS, "三角形"],
  },
  {
    ...triStickBase,
    question_id: "G4B_exam_tristick_3",
    difficulty: 2,
    stem: "用 6 厘米、6 厘米、6 厘米的三根小棒，能围成三角形吗？",
    answer: { type: "choice", value: "T" },
    solution_steps: ["6+6=12 > 6", "任意两边之和都大于第三边", "能围成（而且是等边三角形）"],
    feedback_correct: "能！三边相等是等边三角形。",
    feedback_wrong: "6+6=12>6，可以围成等边三角形。",
    tags: ["sticks:6,6,6", ...EXAM_TAGS, "三角形"],
  },
  {
    ...triStickBase,
    question_id: "G4B_exam_tristick_4",
    difficulty: 3,
    stem: "用 4 厘米、5 厘米、8 厘米的三根小棒，能围成三角形吗？",
    answer: { type: "choice", value: "T" },
    solution_steps: ["最短两边之和：4+5=9", "9 > 8（第三边）", "所以能围成三角形"],
    feedback_correct: "对！4+5=9 大于 8，能围成。",
    feedback_wrong: "最短两边 4+5=9，大于最长边 8，能围成。",
    tags: ["sticks:4,5,8", ...EXAM_TAGS, "三角形"],
  },
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B5 (v0.36.82, 数学出题 loop iter7)
 * 对齐成华区 2024-2025 最新期末卷新考点：找规律(数列)/字母表示数/复名数换算/
 * 三角形第三边范围/平均数范围/小数估算比较/解方程含小数/货车限高(小数加减应用)。
 * 全部用已存在 skillId。tag from_test/exam/期末题。算术逐题验算 + proxy 复核。
 * =========================================================================== */
const examFinalPackG4B5: Question[] = [
  // 找规律·等差小数（真题 填空Q1①）
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_exam_pattern_1",
    skillId: "decimal_meaning_place",
    skillName: "找规律",
    ability: ["reasoning", "calculation"],
    examPriority: "HIGH_BIG",
    difficulty: 3,
    stem: "找规律填数：10.2，9.3，8.4，（ ），6.6。括号里填几？",
    value: 7.5,
    distractors: [7.4, 7.6, 8.3],
    hints: [{ text: "每个数比前一个少 0.9", penalty: 1 }],
    tags: [...EXAM_TAGS, "找规律"],
  }),
  // 找规律·等比小数（真题 填空Q1②）
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_exam_pattern_2",
    skillId: "decimal_point_shift",
    skillName: "找规律",
    ability: ["reasoning", "calculation"],
    examPriority: "HIGH_BIG",
    difficulty: 4,
    stem: "找规律填数：8，（ ），0.32，0.064，0.0128。第二个数是几？",
    value: 1.6,
    distractors: [1.5, 4, 0.16],
    hints: [{ text: "后一个数是前一个数的 1/5（÷5）", penalty: 1 }, { text: "8 ÷ 5 = ?", penalty: 2 }],
    tags: [...EXAM_TAGS, "找规律"],
  }),
  // 字母表示数·2倍多10（真题 填空Q4）
  makeChoice({
    ...UNIT_EQ,
    id: "G4B_exam_letter_1",
    skillId: "letter_expression",
    skillName: "用字母表示数",
    ability: ["modeling", "concept"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    cognitive: "reasoning",
    stem: "我国世界自然遗产有 x 项，世界文化遗产比自然遗产的 2 倍多 10 项。世界文化遗产有（ ）项。",
    options: [
      { id: "A", text: "2x + 10" },
      { id: "B", text: "2x − 10", errorTag: "sign_error" },
      { id: "C", text: "x + 10", errorTag: "ignore_multiple" },
    ],
    correctId: "A",
    solution_steps: ["自然遗产是 x 项", "它的 2 倍是 2x", "比 2 倍多 10 → 2x + 10"],
    tags: [...EXAM_TAGS, "字母表示数"],
  }),
  // 字母表示数·和（真题 填空Q4）
  makeChoice({
    ...UNIT_EQ,
    id: "G4B_exam_letter_2",
    skillId: "letter_expression",
    skillName: "用字母表示数",
    ability: ["modeling", "concept"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    cognitive: "reasoning",
    stem: "五年级植树 m 棵，六年级比五年级多植 4 棵。两个年级一共植树（ ）棵。",
    options: [
      { id: "A", text: "2m + 4" },
      { id: "B", text: "m + 4", errorTag: "miss_one_grade" },
      { id: "C", text: "2m − 4", errorTag: "sign_error" },
    ],
    correctId: "A",
    solution_steps: ["五年级 m 棵", "六年级 m + 4 棵", "一共：m + (m + 4) = 2m + 4 棵"],
    tags: [...EXAM_TAGS, "字母表示数"],
  }),
  // 复名数化小数（真题 填空Q3）
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_exam_conv_3",
    skillId: "decimal_unit_conversion",
    skillName: "复名数换算",
    ability: ["concept", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "7 吨 7 千克 = （ ）吨。（1 吨 = 1000 千克）",
    value: 7.007,
    distractors: [7.7, 7.07, 77],
    hints: [{ text: "7 千克 = 7÷1000 = 0.007 吨", penalty: 1 }],
    tags: [...EXAM_TAGS, "单位换算"],
  }),
  // 复名数·毫米化米（真题 填空Q3）
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_exam_conv_4",
    skillId: "decimal_unit_conversion",
    skillName: "单位换算",
    ability: ["concept", "calculation"],
    examPriority: "HIGH_BIG",
    difficulty: 3,
    stem: "1200 毫米 = （ ）米。（1 米 = 1000 毫米）",
    value: 1.2,
    distractors: [12, 120, 0.12],
    hints: [{ text: "1200 ÷ 1000", penalty: 1 }],
    tags: [...EXAM_TAGS, "单位换算"],
  }),
  // 三角形第三边范围（真题 选择Q3）
  makeChoice({
    ...UNIT_TRI,
    id: "G4B_exam_tri_range_1",
    skillId: "triangle_inequality",
    skillName: "三边关系范围",
    ability: ["reasoning", "concept"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    cognitive: "reasoning",
    stem: "一个三角形的两条边分别长 6 米、7 米，则第三条边的长度（ ）。",
    options: [
      { id: "A", text: "不可能大于 12 米", errorTag: "range_error" },
      { id: "B", text: "比已知两条边都长", errorTag: "range_error" },
      { id: "C", text: "不可能小于或等于 1 米" },
    ],
    correctId: "C",
    solution_steps: ["第三边要大于两边之差：7 − 6 = 1 米", "又要小于两边之和：6 + 7 = 13 米", "所以 1 米 < 第三边 < 13 米，不可能小于或等于 1 米"],
    tags: [...EXAM_TAGS, "三角形"],
  }),
  // 平均数范围（真题 选择Q5）
  makeChoice({
    ...UNIT_DATA,
    id: "G4B_exam_avg_range_1",
    skillId: "average_meaning",
    skillName: "平均数的意义",
    ability: ["data", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    cognitive: "reasoning",
    stem: "四年级 50 米短跑测试，最好成绩是 7.8 秒，最差成绩是 8.8 秒。下列说法正确的是（ ）。",
    options: [
      { id: "A", text: "平均成绩可能是 7.8 秒", errorTag: "average_range_error" },
      { id: "B", text: "平均成绩一定在 7.8 秒到 8.8 秒之间" },
      { id: "C", text: "平均成绩可能是 9 秒", errorTag: "average_range_error" },
    ],
    correctId: "B",
    solution_steps: ["平均数一定不大于最大值、不小于最小值", "所有成绩都在 7.8～8.8 秒之间", "所以平均成绩一定在 7.8 秒到 8.8 秒之间"],
    tags: [...EXAM_TAGS, "平均数"],
  }),
  // 小数乘法估算比较（真题 选择Q2）
  makeChoice({
    ...UNIT_DMUL,
    id: "G4B_exam_estimate_1",
    skillId: "decimal_mul_meaning",
    skillName: "小数乘法估算比较",
    ability: ["reasoning", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    cognitive: "reasoning",
    stem: "下面四个算式中，得数最小的是（ ）。①0.98×3　②0.98+0.98　③1.02×0.98　④0.98×0.98",
    options: [
      { id: "A", text: "④ 0.98×0.98" },
      { id: "B", text: "② 0.98+0.98", errorTag: "estimate_error" },
      { id: "C", text: "③ 1.02×0.98", errorTag: "estimate_error" },
    ],
    correctId: "A",
    solution_steps: ["①0.98×3≈2.94", "②0.98+0.98=1.96", "③1.02×0.98≈1.00", "④0.98×0.98：一个小于1的数乘小于1的数，结果最小（≈0.96）"],
    tags: [...EXAM_TAGS, "小数乘法", "估算"],
  }),
  // 解方程含小数（真题 计算Q4①）
  makeChoice({
    ...UNIT_EQ,
    id: "G4B_exam_solve_2",
    skillId: "equation_solve_simple",
    skillName: "解方程",
    ability: ["calculation", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    cognitive: "procedural",
    stem: "方程 3y − 3.9 = 8.1 的解是（ ）。",
    options: [
      { id: "A", text: "y = 4" },
      { id: "B", text: "y = 1.4", errorTag: "solve_error" },
      { id: "C", text: "y = 12", errorTag: "solve_error" },
    ],
    correctId: "A",
    solution_steps: ["3y − 3.9 = 8.1", "3y = 8.1 + 3.9 = 12", "y = 12 ÷ 3 = 4"],
    tags: [...EXAM_TAGS, "解方程"],
  }),
  // 货车限高·小数加减应用（真题 解决问题Q1）
  makeApp({
    ...UNIT_DAS,
    id: "G4B_exam_truck_1",
    skillId: "decimal_inverse_problem",
    skillName: "小数加减应用",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "陈叔叔的货车，从地面到车厢顶部高 2.1 米，车厢深 0.7 米。要拉一台正立放置、高 2.25 米的冰箱（冰箱底放在车厢底）。",
    clues: ["从地面到车厢顶部高 2.1 米", "车厢深 0.7 米", "冰箱正立放置高 2.25 米", "隧道限高 4 米"],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "车厢底离地高 = 2.1 − 0.7；冰箱最高点 = 车厢底离地高 + 2.25", correct: true },
      { id: "B", text: "冰箱最高点 = 2.1 + 2.25", correct: false, errorTag: "miss_floor_height" },
      { id: "C", text: "冰箱最高点 = 2.1 + 0.7 + 2.25", correct: false, errorTag: "add_extra" },
    ],
    finalPrompt: "装上冰箱后，最高点离地面多少米？",
    finalValue: 3.65,
    finalUnit: "米",
    finalDistractors: [4.35, 4.7, 5.05],
    expression: "(2.1-0.7)+2.25",
    solution_steps: ["车厢底离地高：2.1 − 0.7 = 1.4 米", "冰箱最高点：1.4 + 2.25 = 3.65 米", "3.65 米 < 4 米，能通过隧道"],
    check: "3.65 < 4，能通过",
    tags: [...EXAM_TAGS, "小数加减", "限高"],
  }),
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B6 (v0.36.83, 数学出题 loop iter8)
 * 加厚两大分值块(计算32分+解决问题30分)：列竖式/脱式简算/解方程/解决问题(列方程·平均数变式)
 * + 观察物体概念。对齐成华2024-2025卷 计算Q2-4 / 解决问题Q3-4。tag from_test/exam/期末题。
 * =========================================================================== */
const examFinalPackG4B6: Question[] = [
  // 列竖式·小数减（真题 计算Q2①）
  makeVR({
    ...UNIT_DAS,
    id: "G4B_exam_vr_2",
    skillId: "decimal_add_sub_vertical",
    skillName: "小数加减竖式",
    ability: ["calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "列竖式计算 90 − 22.9 = ？哪一项是正确的差？",
    vertLines: ["vert:90.0", "op:−", "vert:22.9", "result:?"],
    prompt: "差应该是多少？",
    options: [
      { id: "A", text: "67.1", correct: true },
      { id: "B", text: "68.1", correct: false, errorTag: "borrow_error" },
      { id: "C", text: "67.9", correct: false, errorTag: "borrow_error" },
      { id: "D", text: "72.9", correct: false, errorTag: "align_error" },
    ],
    solution_steps: ["把 90 看成 90.0，小数点对齐", "90.0 − 22.9 = 67.1"],
    tags: [...EXAM_TAGS, "竖式"],
  }),
  // 列竖式·小数乘整十百（真题 计算Q2③）
  makeVR({
    ...UNIT_DMUL,
    id: "G4B_exam_vr_3",
    skillId: "decimal_mul_vertical",
    skillName: "小数乘法竖式",
    ability: ["calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "列竖式计算 0.35 × 400 = ？哪一项是正确的积？",
    vertLines: ["vert:0.35", "op:×", "vert:400", "result:?"],
    prompt: "积应该是多少？",
    options: [
      { id: "A", text: "140", correct: true },
      { id: "B", text: "14", correct: false, errorTag: "decimal_point_error" },
      { id: "C", text: "1400", correct: false, errorTag: "decimal_point_error" },
      { id: "D", text: "1.4", correct: false, errorTag: "decimal_point_error" },
    ],
    solution_steps: ["35 × 400 = 14000", "0.35 有两位小数 → 14000 缩小到 1/100 = 140"],
    tags: [...EXAM_TAGS, "竖式"],
  }),
  // 列竖式·小数乘小数（真题 计算Q2④）
  makeVR({
    ...UNIT_DMUL,
    id: "G4B_exam_vr_4",
    skillId: "decimal_mul_vertical",
    skillName: "小数乘法竖式",
    ability: ["calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "列竖式计算 1.25 × 1.4 = ？哪一项是正确的积？",
    vertLines: ["vert:1.25", "op:×", "vert:1.4", "result:?"],
    prompt: "积应该是多少？",
    options: [
      { id: "A", text: "1.75", correct: true },
      { id: "B", text: "17.5", correct: false, errorTag: "decimal_point_error" },
      { id: "C", text: "0.175", correct: false, errorTag: "decimal_point_error" },
      { id: "D", text: "1.85", correct: false, errorTag: "calc_error" },
    ],
    solution_steps: ["125 × 14 = 1750", "1.25 两位 + 1.4 一位 = 三位小数 → 1.750 = 1.75"],
    tags: [...EXAM_TAGS, "竖式"],
  }),
  // 脱式简算·乘法分配律（真题 计算Q3②）
  makeSpeed({
    ...UNIT_DMUL,
    id: "G4B_exam_simp_4",
    skillId: "decimal_mul_simplify",
    skillName: "小数简便计算",
    ability: ["calculation", "strategy"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "用简便方法计算：2.8 × 5 + 5 × 7.2 = ？",
    value: 50,
    distractors: [25, 100, 36],
    hints: [{ text: "提取公因数 5：5 × (2.8 + 7.2)", penalty: 1 }, { text: "2.8 + 7.2 = 10", penalty: 2 }],
    tags: [...EXAM_TAGS, "简便计算"],
  }),
  // 脱式简算·乘加（真题 计算Q3③）
  makeSpeed({
    ...UNIT_DMUL,
    id: "G4B_exam_simp_5",
    skillId: "decimal_mul_simplify",
    skillName: "小数简便计算",
    ability: ["calculation", "strategy"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "计算：0.2 + 0.8 × 12.5 = ？（先算乘法）",
    value: 10.2,
    distractors: [12.5, 10, 12.7],
    hints: [{ text: "先算 0.8 × 12.5 = 10", penalty: 1 }],
    tags: [...EXAM_TAGS, "脱式计算"],
  }),
  // 解方程·除法型（真题 计算Q4②）
  makeChoice({
    ...UNIT_EQ,
    id: "G4B_exam_solve_3",
    skillId: "equation_solve_simple",
    skillName: "解方程",
    ability: ["calculation", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    cognitive: "procedural",
    stem: "方程 6x ÷ 3 = 24 的解是（ ）。",
    options: [
      { id: "A", text: "x = 12" },
      { id: "B", text: "x = 4", errorTag: "solve_error" },
      { id: "C", text: "x = 36", errorTag: "solve_error" },
    ],
    correctId: "A",
    solution_steps: ["6x ÷ 3 = 2x", "2x = 24", "x = 24 ÷ 2 = 12"],
    tags: [...EXAM_TAGS, "解方程"],
  }),
  // 解方程·加法型含小数（真题 计算Q4③）
  makeChoice({
    ...UNIT_EQ,
    id: "G4B_exam_solve_4",
    skillId: "equation_solve_simple",
    skillName: "解方程",
    ability: ["calculation", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    cognitive: "procedural",
    stem: "方程 m + 9.7 = 100 的解是（ ）。",
    options: [
      { id: "A", text: "m = 90.3" },
      { id: "B", text: "m = 109.7", errorTag: "op_inverse" },
      { id: "C", text: "m = 91.3", errorTag: "calc_error" },
    ],
    correctId: "A",
    solution_steps: ["m + 9.7 = 100", "m = 100 − 9.7 = 90.3"],
    tags: [...EXAM_TAGS, "解方程"],
  }),
  // 解决问题·列方程（真题 解决问题Q3）
  makeApp({
    ...UNIT_EQ,
    id: "G4B_exam_eq_costume_1",
    skillId: "equation_one_step_word",
    skillName: "列方程解决问题",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "学校为戏剧社添置了 7 套演出服和 1 个道具箱，一共花了 5000 元。其中道具箱花了 3600 元。每套演出服多少元？",
    clues: ["7 套演出服和 1 个道具箱共花 5000 元", "道具箱花了 3600 元", "每套演出服价钱相同"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "设每套演出服 x 元，列方程 7x + 3600 = 5000", correct: true },
      { id: "B", text: "7x − 3600 = 5000", correct: false, errorTag: "op_inverse" },
      { id: "C", text: "7x + 3600 = 3600", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "每套演出服多少元？",
    finalValue: 200,
    finalUnit: "元",
    finalDistractors: [1228.57, 714, 800],
    expression: "7x+3600=5000",
    solution_steps: ["设每套演出服 x 元", "7x + 3600 = 5000", "7x = 5000 − 3600 = 1400", "x = 1400 ÷ 7 = 200"],
    check: "7×200 + 3600 = 5000，正确",
    tags: [...EXAM_TAGS, "列方程"],
  }),
  // 解决问题·平均数变式（真题 解决问题Q4）
  makeApp({
    ...UNIT_DATA,
    id: "G4B_exam_avg_miss_1",
    skillId: "average_inverse_missing",
    skillName: "平均数·求缺失数据",
    ability: ["modeling", "data"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "体育课上，第 1 小组 5 位同学测 1 分钟仰卧起坐。前 3 位同学的平均成绩是 42 个。要使全组 5 人的平均成绩达到 44 个，后两位同学的总成绩应达到多少个？",
    clues: ["全组共 5 位同学", "前 3 位同学平均成绩 42 个", "要使全组平均成绩达到 44 个"],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "后两人总成绩 = 全组总数(44×5) − 前 3 人总数(42×3)", correct: true },
      { id: "B", text: "后两人总成绩 = 44 × 2", correct: false, errorTag: "wrong_total" },
      { id: "C", text: "后两人总成绩 = 44 − 42", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "后两位同学的总成绩应达到多少个？",
    finalValue: 94,
    finalUnit: "个",
    finalDistractors: [88, 46, 130],
    expression: "44×5-42×3",
    solution_steps: ["全组总数：44 × 5 = 220 个", "前 3 人总数：42 × 3 = 126 个", "后两人总数：220 − 126 = 94 个"],
    check: "(126 + 94) ÷ 5 = 44，正确",
    tags: [...EXAM_TAGS, "平均数"],
  }),
  // 观察物体·概念（真题 观察物体题型）
  makeChoice({
    ...UNIT_OBS,
    id: "G4B_exam_obs_2",
    skillId: "observe_front_top_left",
    skillName: "观察物体",
    ability: ["spatial", "concept"],
    examPriority: "HIGH_BIG",
    difficulty: 2,
    cognitive: "reasoning",
    stem: "站在不同的方向观察同一个物体，看到的形状（ ）。",
    options: [
      { id: "A", text: "可能相同，也可能不同" },
      { id: "B", text: "一定相同", errorTag: "concept_confuse" },
      { id: "C", text: "一定不同", errorTag: "concept_confuse" },
    ],
    correctId: "A",
    solution_steps: ["从不同方向看，看到的面不一样，形状可能不同", "但有些方向看到的形状也可能恰好相同", "所以是『可能相同，也可能不同』"],
    tags: [...EXAM_TAGS, "观察物体"],
  }),
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B7 (v0.36.84, 数学出题 loop iter9)
 * 用多种游戏玩法出期末题(增趣)：📊数据侦探(chart_detective) / 🃏记忆配对(memory_match) /
 * 🛝小数滑梯(decimal_shifter)。覆盖平均数·读图 / 小数意义 / 单位换算 / 小数点移动。
 * 各游戏 tag schema 见 docs + game-types prompt。tag from_test/exam/期末题。
 * =========================================================================== */
const examFinalPackG4B7: Question[] = [
  // 📊 数据侦探·求平均数
  {
    ...base,
    question_id: "G4B_exam_chart_1",
    term: "下册",
    unit_id: "G4B_U6_DATA",
    unit_name: "数据的表示和分析",
    skill_id: "average_compute",
    skill_name: "求平均数",
    ability_dimension: ["data", "calculation"],
    exam_priority: "MUST_BIG",
    game_type: "chart_detective",
    play_as: "chart_detective",
    cognitive_level: "procedural",
    difficulty: 3,
    estimated_time_seconds: 45,
    stem: "把虚线拖到 5 次数学测验成绩的平均分位置：85、90、78、95、82。",
    question_format: "numeric",
    answer: { type: "number", value: 86 },
    solution_steps: ["总分：85+90+78+95+82 = 430", "430 ÷ 5 = 86"],
    hints: [{ text: "平均数在最高分和最低分之间", penalty: 1 }, { text: "总分 ÷ 5", penalty: 2 }],
    common_errors: [{ tag: "average_formula_error", error: "漏加一个数据", remediation: "把 5 个分数都加进去再除以 5。" }],
    feedback_correct: "平均分定位准确！",
    feedback_wrong: "再想想：5 个分数加起来除以 5。",
    tags: ["bars:85,90,78,95,82", "step:1", ...EXAM_TAGS, "平均数"],
  },
  // 📊 数据侦探·读最大值（真题 博物馆参观人数）
  {
    ...base,
    question_id: "G4B_exam_chart_2",
    term: "下册",
    unit_id: "G4B_U6_DATA",
    unit_name: "数据的表示和分析",
    skill_id: "data_bar_chart",
    skill_name: "条形统计图读数",
    ability_dimension: ["data", "reasoning"],
    exam_priority: "HIGH_BIG",
    game_type: "chart_detective",
    play_as: "chart_detective",
    cognitive_level: "reasoning",
    difficulty: 2,
    estimated_time_seconds: 35,
    stem: "下面是某博物馆“十一”长假 7 天的参观人数（人）：1500、2500、4000、4250、3500、2500、1000。把虚线拖到参观人数最多的那天的位置。",
    question_format: "numeric",
    answer: { type: "number", value: 4250 },
    solution_steps: ["比较 7 个数据，4250 最大", "参观人数最多的是第 4 天，4250 人"],
    hints: [{ text: "找最高的那根柱子", penalty: 1 }],
    common_errors: [{ tag: "read_error", error: "看成第 3 天 4000", remediation: "4250 > 4000，第 4 天最多。" }],
    feedback_correct: "对！第 4 天 4250 人最多。",
    feedback_wrong: "再比一比，4250 才是最大的。",
    tags: ["bars:1500,2500,4000,4250,3500,2500,1000", "step:1", ...EXAM_TAGS, "统计"],
  },
  // 🃏 记忆配对·小数的意义
  {
    ...base,
    question_id: "G4B_exam_memory_1",
    term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB",
    unit_name: "小数的意义和加减法",
    skill_id: "decimal_meaning_place",
    skill_name: "小数的意义",
    ability_dimension: ["concept"],
    exam_priority: "MUST_BIG",
    game_type: "memory_match",
    play_as: "memory_match",
    cognitive_level: "recall",
    difficulty: 2,
    estimated_time_seconds: 40,
    stem: "把表示同一个数的两张牌配对：",
    question_format: "numeric",
    answer: { type: "number", value: 1 },
    solution_steps: ["0.3 = 3 个 0.1", "0.07 = 7 个 0.01", "0.5 = 5 个 0.1", "0.25 = 25 个 0.01"],
    hints: [{ text: "想想每个小数是几个 0.1 或 0.01", penalty: 1 }],
    common_errors: [{ tag: "place_value_error", error: "把 0.07 当成 7 个 0.1", remediation: "0.07 在百分位，是 7 个 0.01。" }],
    feedback_correct: "全部配对成功！",
    feedback_wrong: "再想想每张牌表示几个 0.1 或 0.01。",
    tags: ["pair:0.3|3 个 0.1", "pair:0.07|7 个 0.01", "pair:0.5|5 个 0.1", "pair:0.25|25 个 0.01", ...EXAM_TAGS, "小数意义"],
  },
  // 🃏 记忆配对·单位换算（米↔厘米）
  {
    ...base,
    question_id: "G4B_exam_memory_2",
    term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB",
    unit_name: "小数的意义和加减法",
    skill_id: "decimal_unit_conversion",
    skill_name: "单位换算",
    ability_dimension: ["concept", "calculation"],
    exam_priority: "HIGH_BIG",
    game_type: "memory_match",
    play_as: "memory_match",
    cognitive_level: "procedural",
    difficulty: 2,
    estimated_time_seconds: 40,
    stem: "把相等的长度配对（米 ↔ 厘米）：",
    question_format: "numeric",
    answer: { type: "number", value: 1 },
    solution_steps: ["1 米 = 100 厘米", "1.5 米 = 150 厘米", "0.6 米 = 60 厘米", "2.3 米 = 230 厘米"],
    hints: [{ text: "1 米 = 100 厘米，把米化成厘米", penalty: 1 }],
    common_errors: [{ tag: "unit_conversion_error", error: "进率用成 10", remediation: "米和厘米之间进率是 100。" }],
    feedback_correct: "换算很准！",
    feedback_wrong: "1 米 = 100 厘米，再配一次。",
    tags: ["pair:1 米|100 厘米", "pair:1.5 米|150 厘米", "pair:0.6 米|60 厘米", "pair:2.3 米|230 厘米", ...EXAM_TAGS, "单位换算"],
  },
  // 🛝 小数滑梯·扩大100倍
  {
    ...base,
    question_id: "G4B_exam_shift_2",
    term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB",
    unit_name: "小数的意义和加减法",
    skill_id: "decimal_point_shift",
    skill_name: "小数点移动",
    ability_dimension: ["concept", "calculation"],
    exam_priority: "MUST_BIG",
    game_type: "decimal_shifter",
    play_as: "decimal_shifter",
    cognitive_level: "procedural",
    difficulty: 2,
    estimated_time_seconds: 25,
    stem: "把 0.35 扩大到原来的 100 倍，小数点向右移动，结果是多少？",
    question_format: "numeric",
    answer: { type: "number", value: 35 },
    solution_steps: ["扩大 100 倍，小数点向右移 2 位", "0.35 → 35"],
    hints: [{ text: "扩大 100 倍 = 小数点右移 2 位", penalty: 1 }],
    common_errors: [{ tag: "shift_count_error", error: "只移 1 位", remediation: "100 倍要移 2 位。" }],
    feedback_correct: "对！0.35 → 35。",
    feedback_wrong: "扩大 100 倍，小数点向右移 2 位。",
    tags: ["start:0.35", "shift:right:2", "factor:×100", ...EXAM_TAGS, "小数点移动"],
  },
  // 🛝 小数滑梯·缩小到1/10
  {
    ...base,
    question_id: "G4B_exam_shift_3",
    term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB",
    unit_name: "小数的意义和加减法",
    skill_id: "decimal_point_shift",
    skill_name: "小数点移动",
    ability_dimension: ["concept", "calculation"],
    exam_priority: "MUST_BIG",
    game_type: "decimal_shifter",
    play_as: "decimal_shifter",
    cognitive_level: "procedural",
    difficulty: 3,
    estimated_time_seconds: 25,
    stem: "把 4.06 缩小到原来的 1/10，小数点向左移动，结果是多少？",
    question_format: "numeric",
    answer: { type: "number", value: 0.406 },
    solution_steps: ["缩小到 1/10，小数点向左移 1 位", "4.06 → 0.406"],
    hints: [{ text: "缩小到 1/10 = 小数点左移 1 位", penalty: 1 }],
    common_errors: [{ tag: "shift_direction_error", error: "移错方向", remediation: "缩小向左移。" }],
    feedback_correct: "对！4.06 → 0.406。",
    feedback_wrong: "缩小到 1/10，小数点向左移 1 位。",
    tags: ["start:4.06", "shift:left:1", "factor:÷10", ...EXAM_TAGS, "小数点移动"],
  },
  // 🛝 小数滑梯·扩大1000倍
  {
    ...base,
    question_id: "G4B_exam_shift_4",
    term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB",
    unit_name: "小数的意义和加减法",
    skill_id: "decimal_point_shift",
    skill_name: "小数点移动",
    ability_dimension: ["concept", "calculation"],
    exam_priority: "MUST_BIG",
    game_type: "decimal_shifter",
    play_as: "decimal_shifter",
    cognitive_level: "procedural",
    difficulty: 3,
    estimated_time_seconds: 25,
    stem: "把 0.7 扩大到原来的 1000 倍，小数点向右移动，结果是多少？",
    question_format: "numeric",
    answer: { type: "number", value: 700 },
    solution_steps: ["扩大 1000 倍，小数点向右移 3 位", "0.7 → 700（不够位补 0）"],
    hints: [{ text: "扩大 1000 倍 = 小数点右移 3 位", penalty: 1 }],
    common_errors: [{ tag: "shift_count_error", error: "位数不够没补 0", remediation: "0.7 右移 3 位要补 0 成 700。" }],
    feedback_correct: "对！0.7 → 700。",
    feedback_wrong: "扩大 1000 倍，右移 3 位，补 0 得 700。",
    tags: ["start:0.7", "shift:right:3", "factor:×1000", ...EXAM_TAGS, "小数点移动"],
  },
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B8 (v0.36.86, 数学出题 loop iter10)
 * 判断题(✓✗对错冲刺 true_false_swipe)——真题判断区高频(6 题/卷)。对齐成华2024-2025 + 成都2022卷。
 * makeTF 已加 tags 支持。tag from_test/exam/期末题。
 * =========================================================================== */
const examFinalPackG4B8: Question[] = [
  makeTF({
    ...UNIT_DAS,
    id: "G4B_exam_tf_1",
    skillId: "decimal_meaning_place",
    skillName: "小数的意义",
    ability: ["concept", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "大于 0 且小于 1 的一位小数有无数个。",
    truth: "F",
    solution_steps: ["一位小数只精确到十分位", "大于 0 小于 1 的一位小数只有 0.1、0.2 … 0.9 共 9 个", "不是无数个，所以错误"],
    hints: [{ text: "一位小数只到十分位，数一数有几个", penalty: 1 }],
    tags: [...EXAM_TAGS, "小数意义"],
  }),
  makeTF({
    ...UNIT_DAS,
    id: "G4B_exam_tf_2",
    skillId: "decimal_point_shift",
    skillName: "小数点移动",
    ability: ["concept", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "把 1.8 扩大到原来的 10 倍，再把小数点向左移动三位，得到的数是 0.018。",
    truth: "T",
    solution_steps: ["1.8 扩大 10 倍 = 18", "18 小数点向左移 3 位：18 → 1.8 → 0.18 → 0.018", "结果正是 0.018，正确"],
    hints: [{ text: "先算扩大 10 倍，再左移三位", penalty: 1 }],
    tags: [...EXAM_TAGS, "小数点移动"],
  }),
  makeTF({
    ...UNIT_TRI,
    id: "G4B_exam_tf_3",
    skillId: "triangle_classification",
    skillName: "三角形分类",
    ability: ["concept", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "等腰三角形一定是锐角三角形。",
    truth: "F",
    solution_steps: ["等腰三角形只要求两条边相等", "它可以是锐角、直角（等腰直角三角形）或钝角三角形", "所以不一定是锐角三角形，错误"],
    hints: [{ text: "想想等腰直角三角形", penalty: 1 }],
    tags: [...EXAM_TAGS, "三角形"],
  }),
  makeTF({
    ...UNIT_DAS,
    id: "G4B_exam_tf_4",
    skillId: "decimal_meaning_place",
    skillName: "小数的性质",
    ability: ["concept"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "“在小数的小数点后面添 0”和“在小数的末尾添 0”意思相同。",
    truth: "F",
    solution_steps: ["小数点后面添 0：如 2.5 → 2.05，大小变了", "末尾添 0：如 2.5 → 2.50，大小不变", "两者意思不同，错误"],
    hints: [{ text: "举例 2.5：在小数点后添 0 是 2.05，在末尾添 0 是 2.50", penalty: 1 }],
    tags: [...EXAM_TAGS, "小数意义"],
  }),
  makeTF({
    ...UNIT_DATA,
    id: "G4B_exam_tf_5",
    skillId: "data_bar_chart",
    skillName: "统计图的选择",
    ability: ["data", "reasoning"],
    examPriority: "HIGH_BIG",
    difficulty: 3,
    stem: "要直观地表示某小区物业每月支出的变化情况，适宜绘制折线统计图。",
    truth: "T",
    solution_steps: ["折线统计图擅长表示数量随时间增减变化", "“每月支出变化情况”正是随时间的变化", "所以适宜用折线统计图，正确"],
    hints: [{ text: "表示“变化情况”用哪种统计图最直观？", penalty: 1 }],
    tags: [...EXAM_TAGS, "统计"],
  }),
  makeTF({
    ...UNIT_DMUL,
    id: "G4B_exam_tf_6",
    skillId: "decimal_product_digits",
    skillName: "积的小数位数",
    ability: ["concept", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 2,
    stem: "1.2 × 0.3 的积是两位小数。",
    truth: "T",
    solution_steps: ["因数 1.2 是一位小数，0.3 是一位小数", "积的小数位数 = 1 + 1 = 2 位", "1.2 × 0.3 = 0.36，正是两位小数，正确"],
    hints: [{ text: "积的小数位数 = 两个因数小数位数之和", penalty: 1 }],
    tags: [...EXAM_TAGS, "小数乘法"],
  }),
  makeTF({
    ...UNIT_DMUL,
    id: "G4B_exam_tf_7",
    skillId: "decimal_product_digits",
    skillName: "积的变化规律",
    ability: ["reasoning", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "两个因数都扩大到原来的 100 倍，积就扩大到原来的 10000 倍。",
    truth: "T",
    solution_steps: ["一个因数扩大 100 倍，积扩大 100 倍", "两个因数都扩大 100 倍，积扩大 100 × 100 = 10000 倍", "正确"],
    hints: [{ text: "100 × 100 = ?", penalty: 1 }],
    tags: [...EXAM_TAGS, "小数乘法"],
  }),
  makeTF({
    ...UNIT_DAS,
    id: "G4B_exam_tf_8",
    skillId: "decimal_meaning_place",
    skillName: "小数的性质",
    ability: ["concept"],
    examPriority: "MUST_BIG",
    difficulty: 2,
    stem: "在一个小数的末尾添上 0 或去掉 0，小数的大小不变。",
    truth: "T",
    solution_steps: ["这是小数的性质", "如 3.5 = 3.50 = 3.500；0.60 = 0.6", "大小不变，正确"],
    hints: [{ text: "这是“小数的性质”", penalty: 1 }],
    tags: [...EXAM_TAGS, "小数意义"],
  }),
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B9 (v0.36.87, 数学出题 loop iter11)
 * 解决问题变式加厚：年龄差倍/差倍/相遇/和倍 + 字母表示数变式 + 积的小数位数 +
 * 小数四则混合脱式 + 找规律 + 三视图 + 小数加减应用。tag from_test/exam/期末题。
 * =========================================================================== */
const examFinalPackG4B9: Question[] = [
  // 年龄差倍（列方程，U5）
  makeApp({
    ...UNIT_EQ,
    id: "G4B_exam_age_1",
    skillId: "equation_two_step_word",
    skillName: "差倍列方程",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "妈妈比小明大 28 岁，今年妈妈的年龄是小明的 5 倍。",
    clues: ["妈妈比小明大 28 岁", "妈妈的年龄是小明的 5 倍", "小明在上四年级"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "设小明 x 岁，妈妈 5x 岁，5x − x = 28", correct: true },
      { id: "B", text: "5x + x = 28", correct: false, errorTag: "sum_vs_diff" },
      { id: "C", text: "x − 5 = 28", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "小明今年几岁？",
    finalValue: 7,
    finalUnit: "岁",
    finalDistractors: [35, 28, 4],
    expression: "5x-x=28",
    solution_steps: ["设小明 x 岁，妈妈 5x 岁", "5x − x = 28，4x = 28，x = 7", "小明 7 岁（妈妈 35 岁）"],
    check: "35 − 7 = 28，正确",
    tags: [...EXAM_TAGS, "列方程", "差倍"],
  }),
  // 差倍（列方程，U5）
  makeApp({
    ...UNIT_EQ,
    id: "G4B_exam_diff_1",
    skillId: "equation_sum_difference",
    skillName: "差倍列方程",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "甲数比乙数多 36，甲数是乙数的 4 倍。",
    clues: ["甲数比乙数多 36", "甲数是乙数的 4 倍", "甲乙都是整数"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "设乙数 x，甲数 4x，4x − x = 36", correct: true },
      { id: "B", text: "4x + x = 36", correct: false, errorTag: "sum_vs_diff" },
      { id: "C", text: "x − 4 = 36", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "乙数是多少？",
    finalValue: 12,
    finalUnit: "",
    finalDistractors: [9, 48, 36],
    expression: "4x-x=36",
    solution_steps: ["设乙数 x，甲数 4x", "4x − x = 36，3x = 36，x = 12", "乙数 12（甲数 48）"],
    check: "48 − 12 = 36，正确",
    tags: [...EXAM_TAGS, "列方程", "差倍"],
  }),
  // 相遇求时间（列方程/算术，U5）
  makeApp({
    ...UNIT_EQ,
    id: "G4B_exam_meet_2",
    skillId: "equation_meeting_problem",
    skillName: "相遇问题",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "两地相距 600 米，甲、乙两人从两地同时出发，相向而行。甲每分钟走 40 米，乙每分钟走 35 米。",
    clues: ["两地相距 600 米", "甲每分钟走 40 米", "乙每分钟走 35 米"],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "相遇时间 = 总路程 ÷ (甲速 + 乙速)", correct: true },
      { id: "B", text: "相遇时间 = 总路程 ÷ (甲速 − 乙速)", correct: false, errorTag: "sum_vs_diff" },
      { id: "C", text: "相遇时间 = 总路程 ÷ 甲速", correct: false, errorTag: "miss_one_mover" },
    ],
    finalPrompt: "几分钟后两人相遇？",
    finalValue: 8,
    finalUnit: "分钟",
    finalDistractors: [15, 17, 6],
    expression: "600÷(40+35)",
    solution_steps: ["速度和：40 + 35 = 75 米/分", "相遇时间：600 ÷ 75 = 8 分钟"],
    check: "75 × 8 = 600，正确",
    tags: [...EXAM_TAGS, "相遇"],
  }),
  // 和倍（列方程，U5）
  makeApp({
    ...UNIT_EQ,
    id: "G4B_exam_sum_1",
    skillId: "equation_sum_difference",
    skillName: "和倍列方程",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "果园里桃树和梨树一共 120 棵，桃树是梨树的 2 倍。",
    clues: ["桃树和梨树一共 120 棵", "桃树是梨树的 2 倍", "果园在山脚下"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "设梨树 x 棵，桃树 2x 棵，x + 2x = 120", correct: true },
      { id: "B", text: "2x − x = 120", correct: false, errorTag: "sum_vs_diff" },
      { id: "C", text: "x + 2 = 120", correct: false, errorTag: "ignore_multiple" },
    ],
    finalPrompt: "桃树有多少棵？",
    finalValue: 80,
    finalUnit: "棵",
    finalDistractors: [40, 60, 240],
    expression: "x+2x=120",
    solution_steps: ["设梨树 x 棵，桃树 2x 棵", "x + 2x = 120，3x = 120，x = 40（梨树）", "桃树：2 × 40 = 80 棵"],
    check: "40 + 80 = 120，正确",
    tags: [...EXAM_TAGS, "列方程", "和倍"],
  }),
  // 字母表示数变式（U5）
  makeChoice({
    ...UNIT_EQ,
    id: "G4B_exam_letter_3",
    skillId: "letter_expression",
    skillName: "用字母表示数",
    ability: ["modeling", "concept"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    cognitive: "reasoning",
    stem: "一支铅笔 a 元，一支钢笔比铅笔贵 3 元。买 1 支铅笔和 1 支钢笔一共（ ）元。",
    options: [
      { id: "A", text: "2a + 3" },
      { id: "B", text: "2a − 3", errorTag: "sign_error" },
      { id: "C", text: "a + 3", errorTag: "miss_one_item" },
    ],
    correctId: "A",
    solution_steps: ["铅笔 a 元", "钢笔 (a + 3) 元", "一共：a + (a + 3) = 2a + 3 元"],
    tags: [...EXAM_TAGS, "字母表示数"],
  }),
  // 积的小数位数（U3）
  makeChoice({
    ...UNIT_DMUL,
    id: "G4B_exam_digits_1",
    skillId: "decimal_product_digits",
    skillName: "积的小数位数",
    ability: ["concept", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 2,
    cognitive: "reasoning",
    stem: "0.7 × 0.8 的积有几位小数？",
    options: [
      { id: "A", text: "一位", errorTag: "digit_count_error" },
      { id: "B", text: "两位" },
      { id: "C", text: "三位", errorTag: "digit_count_error" },
    ],
    correctId: "B",
    solution_steps: ["两个因数都是一位小数", "积的小数位数 = 1 + 1 = 2 位", "0.7 × 0.8 = 0.56，正是两位小数"],
    tags: [...EXAM_TAGS, "小数乘法"],
  }),
  // 小数四则混合脱式（运算律单元，含中括号）
  makeSpeed({
    ...UNIT_LAWS,
    id: "G4B_exam_mixed_1",
    skillId: "mixed_ops_brackets",
    skillName: "小数四则混合",
    ability: ["calculation", "strategy"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "脱式计算：0.6 × [ 12 − ( 1.38 + 1.87 ) ] = ？",
    value: 5.25,
    distractors: [5.2, 7.2, 6.45],
    hints: [{ text: "先算小括号：1.38 + 1.87 = 3.25", penalty: 1 }, { text: "再中括号：12 − 3.25 = 8.75，最后 × 0.6", penalty: 2 }],
    tags: [...EXAM_TAGS, "脱式计算"],
  }),
  // 找规律·等差（U1）
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_exam_pattern_3",
    skillId: "decimal_meaning_place",
    skillName: "找规律",
    ability: ["reasoning", "calculation"],
    examPriority: "HIGH_BIG",
    difficulty: 3,
    stem: "找规律填数：1.5，3，4.5，6，（ ）。括号里填几？",
    value: 7.5,
    distractors: [7, 9, 6.5],
    hints: [{ text: "每个数比前一个多 1.5", penalty: 1 }],
    tags: [...EXAM_TAGS, "找规律"],
  }),
  // 三视图·正方体（U4）
  makeChoice({
    ...UNIT_OBS,
    id: "G4B_exam_obs_3",
    skillId: "observe_front_top_left",
    skillName: "观察物体",
    ability: ["spatial", "concept"],
    examPriority: "HIGH_BIG",
    difficulty: 2,
    cognitive: "reasoning",
    stem: "一个正方体，从前面、上面、左面看到的形状都是（ ）。",
    options: [
      { id: "A", text: "正方形" },
      { id: "B", text: "长方形", errorTag: "shape_error" },
      { id: "C", text: "三角形", errorTag: "shape_error" },
    ],
    correctId: "A",
    solution_steps: ["正方体的每个面都是正方形", "从前面、上面、左面看到的都是一个正方形"],
    tags: [...EXAM_TAGS, "观察物体"],
  }),
  // 小数加减应用·求原数（U1）
  makeApp({
    ...UNIT_DAS,
    id: "G4B_exam_rope_1",
    skillId: "decimal_inverse_problem",
    skillName: "小数加减应用",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "一根绳子用去 3.6 米，还剩 4.85 米。",
    clues: ["用去 3.6 米", "还剩 4.85 米", "绳子是新买的"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "原来长度 = 用去的 + 剩下的", correct: true },
      { id: "B", text: "原来长度 = 剩下的 − 用去的", correct: false, errorTag: "op_inverse" },
      { id: "C", text: "原来长度 = 用去的 − 剩下的", correct: false, errorTag: "op_inverse" },
    ],
    finalPrompt: "这根绳子原来长多少米？",
    finalValue: 8.45,
    finalUnit: "米",
    finalDistractors: [1.25, 8.35, 7.45],
    expression: "3.6+4.85",
    solution_steps: ["原来长度 = 用去 + 剩下", "3.6 + 4.85 = 8.45 米"],
    check: "8.45 − 3.6 = 4.85，正确",
    tags: [...EXAM_TAGS, "小数加减"],
  }),
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B10 (v0.36.88, 数学出题 loop iter12)
 * 细分考点变式：货比三家最优(真题2024 Q6)/小数排序/估算够不够/小数大小比较/
 * 三角形按边分类/小数乘法意义/单位换算(元角)/估算加法。tag from_test/exam/期末题。
 * =========================================================================== */
const examFinalPackG4B10: Question[] = [
  // 货比三家·最优方案（真题 2024 Q6，U3）
  makeChoice({
    ...UNIT_DMUL,
    id: "G4B_exam_shop_best_1",
    skillId: "decimal_segment_pricing",
    skillName: "最优购买方案",
    ability: ["reasoning", "strategy"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    cognitive: "reasoning",
    stem: "阿姨要各买一个电吹风、电火锅、空调扇。A 店：电吹风 39 元、电火锅 168.8 元、空调扇 74.2 元；B 店：38.5 元、200 元、88.8 元；C 店：40.6 元、150 元、76 元。每样都挑最便宜的买，最少花多少元？",
    options: [
      { id: "A", text: "262.7 元（电吹风 38.5 + 电火锅 150 + 空调扇 74.2）" },
      { id: "B", text: "282 元（每样都在同一家买）", errorTag: "not_optimal" },
      { id: "C", text: "250 元", errorTag: "calc_error" },
    ],
    correctId: "A",
    solution_steps: [
      "电吹风最便宜：B 店 38.5 元",
      "电火锅最便宜：C 店 150 元",
      "空调扇最便宜：A 店 74.2 元",
      "共：38.5 + 150 + 74.2 = 262.7 元",
    ],
    tags: [...EXAM_TAGS, "最优方案"],
  }),
  // 小数排序·找最小（U1）
  makeChoice({
    ...UNIT_DAS,
    id: "G4B_exam_sort_1",
    skillId: "decimal_compare",
    skillName: "小数大小比较",
    ability: ["concept", "reasoning"],
    examPriority: "HIGH_BIG",
    difficulty: 3,
    cognitive: "reasoning",
    stem: "把 0.45、0.5、0.405、0.54 从小到大排列，最小的是（ ）。",
    options: [
      { id: "A", text: "0.405" },
      { id: "B", text: "0.45", errorTag: "compare_error" },
      { id: "C", text: "0.5", errorTag: "compare_error" },
    ],
    correctId: "A",
    solution_steps: ["先比十分位：0.405 和 0.45 的十分位都是 4，比 0.5、0.54 的 5 小", "再比 0.405 与 0.45 的百分位：0 < 5", "所以 0.405 最小"],
    tags: [...EXAM_TAGS, "小数比较"],
  }),
  // 小数大小比较·填符号（U1）
  makeChoice({
    ...UNIT_DAS,
    id: "G4B_exam_cmp_2",
    skillId: "decimal_compare",
    skillName: "小数大小比较",
    ability: ["concept", "reasoning"],
    examPriority: "HIGH_BIG",
    difficulty: 2,
    cognitive: "reasoning",
    stem: "在 6.05 ○ 6.5 的 ○ 里填上正确的符号。",
    options: [
      { id: "A", text: "<" },
      { id: "B", text: ">", errorTag: "compare_error" },
      { id: "C", text: "=", errorTag: "compare_error" },
    ],
    correctId: "A",
    solution_steps: ["整数部分都是 6，比十分位", "6.05 的十分位是 0，6.5 的十分位是 5", "0 < 5，所以 6.05 < 6.5"],
    tags: [...EXAM_TAGS, "小数比较"],
  }),
  // 估算·钱够不够（U3）
  makeChoice({
    ...UNIT_DMUL,
    id: "G4B_exam_enough_1",
    skillId: "decimal_price_quantity",
    skillName: "小数乘法·估算应用",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    cognitive: "reasoning",
    stem: "每本笔记本 8.5 元，老师要买 6 本。带 50 元够吗？",
    options: [
      { id: "A", text: "不够，还差 1 元（8.5×6=51 元）" },
      { id: "B", text: "够，还剩 1 元", errorTag: "calc_error" },
      { id: "C", text: "刚好 50 元", errorTag: "calc_error" },
    ],
    correctId: "A",
    solution_steps: ["总价：8.5 × 6 = 51 元", "51 元 > 50 元", "带 50 元不够，还差 51 − 50 = 1 元"],
    tags: [...EXAM_TAGS, "小数乘法", "估算"],
  }),
  // 三角形按边分类（U2）
  makeChoice({
    ...UNIT_TRI,
    id: "G4B_exam_tri_side_1",
    skillId: "triangle_classification",
    skillName: "三角形按边分类",
    ability: ["concept"],
    examPriority: "HIGH_BIG",
    difficulty: 2,
    stem: "三条边都相等的三角形叫做（ ）。",
    options: [
      { id: "A", text: "等边三角形（也叫正三角形）" },
      { id: "B", text: "等腰三角形", errorTag: "concept_confuse" },
      { id: "C", text: "直角三角形", errorTag: "concept_confuse" },
    ],
    correctId: "A",
    solution_steps: ["三条边都相等 → 等边三角形（正三角形）", "只有两条边相等才叫等腰三角形（等边是特殊的等腰）"],
    tags: [...EXAM_TAGS, "三角形"],
  }),
  // 小数乘法的意义（U3）
  makeChoice({
    ...UNIT_DMUL,
    id: "G4B_exam_mul_mean_1",
    skillId: "decimal_mul_meaning",
    skillName: "小数乘法的意义",
    ability: ["concept"],
    examPriority: "HIGH_BIG",
    difficulty: 2,
    stem: "算式 0.6 × 4 表示的意思是（ ）。",
    options: [
      { id: "A", text: "4 个 0.6 相加（也就是 0.6 的 4 倍）" },
      { id: "B", text: "0.6 个 4 相加", errorTag: "meaning_confuse" },
      { id: "C", text: "4 比 0.6 多多少", errorTag: "meaning_confuse" },
    ],
    correctId: "A",
    solution_steps: ["一个数乘整数，表示几个这个数相加", "0.6 × 4 = 4 个 0.6 相加 = 0.6 + 0.6 + 0.6 + 0.6 = 2.4"],
    tags: [...EXAM_TAGS, "小数乘法"],
  }),
  // 单位换算·元角（U1）
  makeSpeed({
    ...UNIT_DAS,
    id: "G4B_exam_conv_5",
    skillId: "decimal_unit_conversion",
    skillName: "单位换算",
    ability: ["concept", "calculation"],
    examPriority: "HIGH_BIG",
    difficulty: 2,
    stem: "3.2 元 = （ ）角。（1 元 = 10 角）",
    value: 32,
    unit: "角",
    distractors: [3.2, 320, 12],
    hints: [{ text: "1 元 = 10 角，3.2 × 10", penalty: 1 }],
    tags: [...EXAM_TAGS, "单位换算"],
  }),
  // 估算·加法（U1）
  makeChoice({
    ...UNIT_DAS,
    id: "G4B_exam_estimate_2",
    skillId: "decimal_add_sub_vertical",
    skillName: "小数加法·估算",
    ability: ["calculation", "reasoning"],
    examPriority: "HIGH_BIG",
    difficulty: 2,
    cognitive: "reasoning",
    stem: "妈妈买菜花了 12.8 元和 7.6 元，用“四舍五入到个位”估算，大约一共花了多少元？",
    options: [
      { id: "A", text: "大约 21 元（12.8≈13，7.6≈8，13+8=21）" },
      { id: "B", text: "大约 30 元", errorTag: "estimate_error" },
      { id: "C", text: "大约 15 元", errorTag: "estimate_error" },
    ],
    correctId: "A",
    solution_steps: ["12.8 ≈ 13，7.6 ≈ 8（四舍五入到个位）", "13 + 8 = 21，大约 21 元", "（精确值 12.8 + 7.6 = 20.4 元）"],
    tags: [...EXAM_TAGS, "估算"],
  }),
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B11 (v0.36.91, 数学出题 loop iter13)
 * 覆盖度自评发现 U4 观察物体最薄(3 道)→补 3 道概念题平衡。tag from_test/exam/期末题。
 * (本 iter 另确认 scheduler.buildMockExam 已对 from_test 加权 -1.0 + 每单元保底, 期末备考
 *  中心确实优先抽 exam 题, 见 docs/math-exam-loop-state.md。)
 * =========================================================================== */
const examFinalPackG4B11: Question[] = [
  makeChoice({
    ...UNIT_OBS,
    id: "G4B_exam_obs_4",
    skillId: "observe_front_top_left",
    skillName: "观察物体",
    ability: ["spatial", "concept"],
    examPriority: "HIGH_BIG",
    difficulty: 3,
    cognitive: "reasoning",
    stem: "观察一个长方体，站在一个位置最多能同时看到它的几个面？",
    options: [
      { id: "A", text: "3 个面" },
      { id: "B", text: "2 个面", errorTag: "spatial_error" },
      { id: "C", text: "6 个面", errorTag: "spatial_error" },
    ],
    correctId: "A",
    solution_steps: ["长方体有 6 个面", "站在一个角的位置看，最多能同时看到上面、前面、侧面这 3 个面", "看不到的是后面、下面和另一个侧面"],
    tags: [...EXAM_TAGS, "观察物体"],
  }),
  makeTF({
    ...UNIT_OBS,
    id: "G4B_exam_obs_5",
    skillId: "observe_front_top_left",
    skillName: "观察物体",
    ability: ["spatial", "concept"],
    examPriority: "HIGH_BIG",
    difficulty: 2,
    stem: "把一个长方体横着放在桌上，从上面看到的形状是一个长方形。",
    truth: "T",
    solution_steps: ["长方体横放，上面那个面是长方形", "从上面往下看，看到的就是这个长方形"],
    tags: [...EXAM_TAGS, "观察物体"],
  }),
  makeChoice({
    ...UNIT_OBS,
    id: "G4B_exam_obs_6",
    skillId: "observe_front_top_left",
    skillName: "观察物体",
    ability: ["spatial", "reasoning"],
    examPriority: "HIGH_BIG",
    difficulty: 3,
    cognitive: "reasoning",
    stem: "用 4 个同样大小的小正方体摆成一个 2 个长、2 个宽、1 个高的长方体。从上面看到的形状是（ ）。",
    options: [
      { id: "A", text: "由 4 个小正方形组成的大正方形（2 行 2 列）" },
      { id: "B", text: "一排 4 个小正方形", errorTag: "spatial_error" },
      { id: "C", text: "一个小正方形", errorTag: "spatial_error" },
    ],
    correctId: "A",
    solution_steps: ["2 长 × 2 宽 × 1 高，从上往下看", "看到的是 2 行 2 列共 4 个小正方形拼成的大正方形"],
    tags: [...EXAM_TAGS, "观察物体"],
  }),
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B12 (v0.36.92, 数学出题 loop iter14·维护期)
 * 平衡 U6 平均数(偏薄)：求缺失数据/已知平均求某次成绩/平均数范围。
 * (本 iter 另做质量回归: 14 道早期 exam 题过 4 模型复核全 OK。) tag from_test/exam/期末题。
 * =========================================================================== */
const examFinalPackG4B12: Question[] = [
  // 平均数·求缺失的一个数（U6）
  makeApp({
    ...UNIT_DATA,
    id: "G4B_exam_avg_miss_2",
    skillId: "average_inverse_missing",
    skillName: "平均数·求缺失数据",
    ability: ["modeling", "data"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "5 个数的平均数是 8，其中 4 个数的和是 35。求第 5 个数。",
    clues: ["5 个数的平均数是 8", "其中 4 个数的和是 35", "这些数都是整数"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "第 5 个数 = 5 个数的总和(8×5) − 前 4 个数的和(35)", correct: true },
      { id: "B", text: "第 5 个数 = 8 − 35 ÷ 4", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "第 5 个数 = 35 ÷ 4", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "第 5 个数是多少？",
    finalValue: 5,
    finalUnit: "",
    finalDistractors: [3, 8, 40],
    expression: "8×5-35",
    solution_steps: ["5 个数的总和：8 × 5 = 40", "第 5 个数：40 − 35 = 5"],
    check: "(35 + 5) ÷ 5 = 8，正确",
    tags: [...EXAM_TAGS, "平均数"],
  }),
  // 平均数·求需要达到的成绩（U6）
  makeApp({
    ...UNIT_DATA,
    id: "G4B_exam_avg_need_1",
    skillId: "average_inverse_missing",
    skillName: "平均数·求某次成绩",
    ability: ["modeling", "data"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "小明前 4 次数学测验的平均成绩是 90 分。第 5 次要考多少分，才能使 5 次的平均成绩达到 92 分？",
    clues: ["前 4 次平均成绩 90 分", "要使 5 次平均成绩达到 92 分", "小明很努力"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "第 5 次成绩 = 5 次总分(92×5) − 前 4 次总分(90×4)", correct: true },
      { id: "B", text: "第 5 次成绩 = 92 + 2", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "第 5 次成绩 = 92 × 5 ÷ 4", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "第 5 次要考多少分？",
    finalValue: 100,
    finalUnit: "分",
    finalDistractors: [94, 98, 110],
    expression: "92×5-90×4",
    solution_steps: ["5 次总分：92 × 5 = 460 分", "前 4 次总分：90 × 4 = 360 分", "第 5 次：460 − 360 = 100 分"],
    check: "(360 + 100) ÷ 5 = 92，正确",
    tags: [...EXAM_TAGS, "平均数"],
  }),
  // 平均数·求一个数据使平均数为定值（U6）
  makeSpeed({
    ...UNIT_DATA,
    id: "G4B_exam_avg_x_1",
    skillId: "average_compute",
    skillName: "平均数",
    ability: ["data", "calculation"],
    examPriority: "HIGH_BIG",
    difficulty: 3,
    stem: "12、15、18 和另一个数，这 4 个数的平均数是 15。另一个数是多少？",
    value: 15,
    distractors: [13, 16, 45],
    hints: [{ text: "4 个数的总和 = 15 × 4 = 60", penalty: 1 }, { text: "再减去 12 + 15 + 18", penalty: 2 }],
    tags: [...EXAM_TAGS, "平均数"],
  }),
  // 平均数·范围判断（U6）
  makeChoice({
    ...UNIT_DATA,
    id: "G4B_exam_avg_range_2",
    skillId: "average_meaning",
    skillName: "平均数的意义",
    ability: ["data", "reasoning"],
    examPriority: "HIGH_BIG",
    difficulty: 3,
    cognitive: "reasoning",
    stem: "一组数据中，最大的数是 20，最小的数是 8。这组数据的平均数（ ）。",
    options: [
      { id: "A", text: "一定在 8 和 20 之间" },
      { id: "B", text: "可能是 5", errorTag: "average_range_error" },
      { id: "C", text: "可能是 25", errorTag: "average_range_error" },
    ],
    correctId: "A",
    solution_steps: ["平均数不会小于最小值，也不会大于最大值", "最小 8、最大 20", "所以平均数一定在 8 和 20 之间"],
    tags: [...EXAM_TAGS, "平均数"],
  }),
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B13 (v0.36.93, 数学出题 loop iter15·维护期)
 * 加厚已验证可渲染的游戏玩法多样性：📊chart_detective 平均数 / 🃏memory_match 小数⇄分数·
 * 元角分 / 🛝decimal_shifter 小数点移动。全真题考点。tag from_test/exam/期末题。
 * =========================================================================== */
const examFinalPackG4B13: Question[] = [
  // 📊 求平均数
  {
    ...base, question_id: "G4B_exam_chart_3", term: "下册",
    unit_id: "G4B_U6_DATA", unit_name: "数据的表示和分析",
    skill_id: "average_compute", skill_name: "求平均数",
    ability_dimension: ["data", "calculation"], exam_priority: "MUST_BIG",
    game_type: "chart_detective", play_as: "chart_detective",
    cognitive_level: "procedural", difficulty: 3, estimated_time_seconds: 45,
    stem: "把虚线拖到 5 名同学跳远成绩的平均数位置（单位：厘米）：88、92、85、90、95。",
    question_format: "numeric", answer: { type: "number", value: 90 },
    solution_steps: ["总数：88+92+85+90+95 = 450", "450 ÷ 5 = 90"],
    hints: [{ text: "总和 ÷ 5", penalty: 1 }],
    common_errors: [{ tag: "average_formula_error", error: "漏加数据", remediation: "5 个都加上再除以 5。" }],
    feedback_correct: "平均数定位准！", feedback_wrong: "5 个加起来除以 5 试试。",
    tags: ["bars:88,92,85,90,95", "step:1", ...EXAM_TAGS, "平均数"],
  },
  // 📊 求平均数
  {
    ...base, question_id: "G4B_exam_chart_4", term: "下册",
    unit_id: "G4B_U6_DATA", unit_name: "数据的表示和分析",
    skill_id: "average_compute", skill_name: "求平均数",
    ability_dimension: ["data", "calculation"], exam_priority: "HIGH_BIG",
    game_type: "chart_detective", play_as: "chart_detective",
    cognitive_level: "procedural", difficulty: 2, estimated_time_seconds: 40,
    stem: "把虚线拖到 5 天卖出冰淇淋数量的平均数位置（单位：个）：30、40、35、45、50。",
    question_format: "numeric", answer: { type: "number", value: 40 },
    solution_steps: ["总数：30+40+35+45+50 = 200", "200 ÷ 5 = 40"],
    hints: [{ text: "总和 ÷ 5", penalty: 1 }],
    common_errors: [{ tag: "average_formula_error", error: "漏加数据", remediation: "把 5 天都加上。" }],
    feedback_correct: "对！平均每天 40 个。", feedback_wrong: "200 ÷ 5 = ?",
    tags: ["bars:30,40,35,45,50", "step:1", ...EXAM_TAGS, "平均数"],
  },
  // 🃏 小数 ⇄ 分数 配对
  {
    ...base, question_id: "G4B_exam_memory_3", term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB", unit_name: "小数的意义和加减法",
    skill_id: "decimal_meaning_place", skill_name: "小数与分数",
    ability_dimension: ["concept"], exam_priority: "HIGH_BIG",
    game_type: "memory_match", play_as: "memory_match",
    cognitive_level: "recall", difficulty: 2, estimated_time_seconds: 40,
    stem: "把相等的小数和分数配对：",
    question_format: "numeric", answer: { type: "number", value: 1 },
    solution_steps: ["0.1 = 1/10", "0.3 = 3/10", "0.7 = 7/10", "0.9 = 9/10"],
    hints: [{ text: "一位小数 = 十分之几", penalty: 1 }],
    common_errors: [{ tag: "place_value_error", error: "分母用错", remediation: "一位小数的分母是 10。" }],
    feedback_correct: "全部配对成功！", feedback_wrong: "一位小数都是十分之几。",
    tags: ["pair:0.1|1/10", "pair:0.3|3/10", "pair:0.7|7/10", "pair:0.9|9/10", ...EXAM_TAGS, "小数意义"],
  },
  // 🃏 元角分 配对
  {
    ...base, question_id: "G4B_exam_memory_4", term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB", unit_name: "小数的意义和加减法",
    skill_id: "decimal_unit_conversion", skill_name: "元角分换算",
    ability_dimension: ["concept", "calculation"], exam_priority: "HIGH_BIG",
    game_type: "memory_match", play_as: "memory_match",
    cognitive_level: "procedural", difficulty: 2, estimated_time_seconds: 40,
    stem: "把相等的金额配对（元 ↔ 元角分）：",
    question_format: "numeric", answer: { type: "number", value: 1 },
    solution_steps: ["1.5 元 = 1 元 5 角", "3.2 元 = 3 元 2 角", "0.8 元 = 8 角", "2.05 元 = 2 元 5 分"],
    hints: [{ text: "1 元 = 10 角，1 角 = 10 分", penalty: 1 }],
    common_errors: [{ tag: "unit_conversion_error", error: "角和分混淆", remediation: "十分位是角，百分位是分。" }],
    feedback_correct: "换算很准！", feedback_wrong: "十分位表示角，百分位表示分。",
    tags: ["pair:1.5 元|1 元 5 角", "pair:3.2 元|3 元 2 角", "pair:0.8 元|8 角", "pair:2.05 元|2 元 5 分", ...EXAM_TAGS, "单位换算"],
  },
  // 🛝 小数点移动·扩大10倍
  {
    ...base, question_id: "G4B_exam_shift_5", term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB", unit_name: "小数的意义和加减法",
    skill_id: "decimal_point_shift", skill_name: "小数点移动",
    ability_dimension: ["concept", "calculation"], exam_priority: "MUST_BIG",
    game_type: "decimal_shifter", play_as: "decimal_shifter",
    cognitive_level: "procedural", difficulty: 2, estimated_time_seconds: 25,
    stem: "把 2.5 扩大到原来的 10 倍，小数点向右移动，结果是多少？",
    question_format: "numeric", answer: { type: "number", value: 25 },
    solution_steps: ["扩大 10 倍，小数点向右移 1 位", "2.5 → 25"],
    hints: [{ text: "扩大 10 倍 = 右移 1 位", penalty: 1 }],
    common_errors: [{ tag: "shift_count_error", error: "移错位数", remediation: "10 倍移 1 位。" }],
    feedback_correct: "对！2.5 → 25。", feedback_wrong: "扩大 10 倍向右移 1 位。",
    tags: ["start:2.5", "shift:right:1", "factor:×10", ...EXAM_TAGS, "小数点移动"],
  },
  // 🛝 小数点移动·扩大100倍补0
  {
    ...base, question_id: "G4B_exam_shift_6", term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB", unit_name: "小数的意义和加减法",
    skill_id: "decimal_point_shift", skill_name: "小数点移动",
    ability_dimension: ["concept", "calculation"], exam_priority: "MUST_BIG",
    game_type: "decimal_shifter", play_as: "decimal_shifter",
    cognitive_level: "procedural", difficulty: 3, estimated_time_seconds: 25,
    stem: "把 0.08 扩大到原来的 100 倍，小数点向右移动，结果是多少？",
    question_format: "numeric", answer: { type: "number", value: 8 },
    solution_steps: ["扩大 100 倍，小数点向右移 2 位", "0.08 → 8"],
    hints: [{ text: "扩大 100 倍 = 右移 2 位", penalty: 1 }],
    common_errors: [{ tag: "shift_count_error", error: "只移 1 位", remediation: "100 倍移 2 位。" }],
    feedback_correct: "对！0.08 → 8。", feedback_wrong: "100 倍向右移 2 位。",
    tags: ["start:0.08", "shift:right:2", "factor:×100", ...EXAM_TAGS, "小数点移动"],
  },
  // 🛝 小数点移动·缩小到1/100
  {
    ...base, question_id: "G4B_exam_shift_7", term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB", unit_name: "小数的意义和加减法",
    skill_id: "decimal_point_shift", skill_name: "小数点移动",
    ability_dimension: ["concept", "calculation"], exam_priority: "MUST_BIG",
    game_type: "decimal_shifter", play_as: "decimal_shifter",
    cognitive_level: "procedural", difficulty: 3, estimated_time_seconds: 25,
    stem: "把 35 缩小到原来的 1/100，小数点向左移动，结果是多少？",
    question_format: "numeric", answer: { type: "number", value: 0.35 },
    solution_steps: ["缩小到 1/100，小数点向左移 2 位", "35 → 0.35"],
    hints: [{ text: "缩小到 1/100 = 左移 2 位", penalty: 1 }],
    common_errors: [{ tag: "shift_direction_error", error: "方向或位数错", remediation: "缩小向左移，1/100 移 2 位。" }],
    feedback_correct: "对！35 → 0.35。", feedback_wrong: "缩小到 1/100，向左移 2 位。",
    tags: ["start:35", "shift:left:2", "factor:÷100", ...EXAM_TAGS, "小数点移动"],
  },
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B14 (v0.36.94, 数学出题 loop iter16)
 * 🎮 激活 💸折扣漂移 discount_drift (之前未激活)。折扣=小数乘法/小数点移动应用。
 * discount 字段类型由 DiscountSpec(core/types.ts) typecheck 强校验; 组件无 spec 时降级
 * plain_choice → 安全。options.text = 折后价数字(显示为 ¥text), answer=正确 option id。
 * tag from_test/exam/期末题。
 * =========================================================================== */
const examFinalPackG4B14: Question[] = [
  {
    ...base, question_id: "G4B_exam_discount_1", term: "下册",
    unit_id: "G4B_U3_DECIMAL_MULTIPLY", unit_name: "小数乘法",
    skill_id: "decimal_price_quantity", skill_name: "折扣应用",
    ability_dimension: ["modeling", "calculation"], exam_priority: "HIGH_BIG",
    game_type: "discount_drift", play_as: "discount_drift",
    cognitive_level: "application", difficulty: 3, estimated_time_seconds: 30,
    stem: "一件衣服原价 100 元，打 8 折出售。现价是多少元？（8 折就是按原价的 0.8 计算）",
    question_format: "single_choice",
    options: [
      { id: "a", text: "80" },
      { id: "b", text: "20", errorTag: "discount_rate_confuse" },
      { id: "c", text: "12.5", errorTag: "wrong_operation" },
      { id: "d", text: "92", errorTag: "yuan_off_confuse" },
    ],
    answer: { type: "choice", value: "a" },
    discount: { itemName: "外套", emoji: "🧥", originalPrice: 100, discount: { kind: "percent", value: 80 } },
    solution_steps: ["8 折 = 按原价的 0.8 算", "100 × 0.8 = 80 元"],
    hints: [{ text: "8 折 = ×0.8", penalty: 1 }],
    common_errors: [{ tag: "discount_rate_confuse", error: "把 8 折当成 0.2", remediation: "8 折是付 80%，×0.8。" }],
    feedback_correct: "对！100 × 0.8 = 80 元。", feedback_wrong: "8 折是按 0.8 算：100 × 0.8。",
    tags: [...EXAM_TAGS, "折扣", "小数乘法"],
  },
  {
    ...base, question_id: "G4B_exam_discount_2", term: "下册",
    unit_id: "G4B_U3_DECIMAL_MULTIPLY", unit_name: "小数乘法",
    skill_id: "decimal_price_quantity", skill_name: "折扣应用",
    ability_dimension: ["modeling", "calculation"], exam_priority: "HIGH_BIG",
    game_type: "discount_drift", play_as: "discount_drift",
    cognitive_level: "application", difficulty: 3, estimated_time_seconds: 30,
    stem: "一个书包原价 50 元，打 9 折出售。现价是多少元？（9 折按原价的 0.9 计算）",
    question_format: "single_choice",
    options: [
      { id: "a", text: "45" },
      { id: "b", text: "5", errorTag: "discount_rate_confuse" },
      { id: "c", text: "41", errorTag: "yuan_off_confuse" },
      { id: "d", text: "55", errorTag: "wrong_operation" },
    ],
    answer: { type: "choice", value: "a" },
    discount: { itemName: "书包", emoji: "🎒", originalPrice: 50, discount: { kind: "percent", value: 90 } },
    solution_steps: ["9 折 = 按原价的 0.9 算", "50 × 0.9 = 45 元"],
    hints: [{ text: "9 折 = ×0.9", penalty: 1 }],
    common_errors: [{ tag: "yuan_off_confuse", error: "把 9 折当成减 9 元", remediation: "9 折是 ×0.9，不是减 9 元。" }],
    feedback_correct: "对！50 × 0.9 = 45 元。", feedback_wrong: "9 折是按 0.9 算：50 × 0.9。",
    tags: [...EXAM_TAGS, "折扣", "小数乘法"],
  },
  {
    ...base, question_id: "G4B_exam_discount_3", term: "下册",
    unit_id: "G4B_U3_DECIMAL_MULTIPLY", unit_name: "小数乘法",
    skill_id: "decimal_price_quantity", skill_name: "折扣应用",
    ability_dimension: ["modeling", "calculation"], exam_priority: "HIGH_BIG",
    game_type: "discount_drift", play_as: "discount_drift",
    cognitive_level: "application", difficulty: 2, estimated_time_seconds: 25,
    stem: "一个玩具原价 80 元，打 5 折（半价，按原价的 0.5 计算）出售。现价是多少元？",
    question_format: "single_choice",
    options: [
      { id: "a", text: "40" },
      { id: "b", text: "16", errorTag: "discount_rate_confuse" },
      { id: "c", text: "75", errorTag: "yuan_off_confuse" },
      { id: "d", text: "30", errorTag: "calc_error" },
    ],
    answer: { type: "choice", value: "a" },
    discount: { itemName: "玩具", emoji: "🧸", originalPrice: 80, discount: { kind: "percent", value: 50 } },
    solution_steps: ["5 折（半价）= 按原价的 0.5 算", "80 × 0.5 = 40 元"],
    hints: [{ text: "5 折就是半价，×0.5", penalty: 1 }],
    common_errors: [{ tag: "discount_rate_confuse", error: "把 5 折当成 ×0.2", remediation: "5 折 = 半价 = ×0.5。" }],
    feedback_correct: "对！80 × 0.5 = 40 元。", feedback_wrong: "5 折是半价：80 × 0.5 = 40。",
    tags: [...EXAM_TAGS, "折扣", "小数乘法"],
  },
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B15 (v0.36.96, 数学出题 loop iter17)
 * 🎮 激活 🪙凑钱挑战 coin_combo (之前未激活)。凑钱=元角分/小数加法。coin_combo 字段
 * (CoinComboSpec) typecheck 强校验; 组件按 correctIndices 自判, 每题的目标组合已验证唯一
 * (不存在另一种子集也凑到 target, 避免误判正确组合)。tag from_test/exam/期末题。
 * =========================================================================== */
const examFinalPackG4B15: Question[] = [
  {
    ...base, question_id: "G4B_exam_coin_1", term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB", unit_name: "小数的意义和加减法",
    skill_id: "decimal_add_sub_vertical", skill_name: "元角分·小数加法",
    ability_dimension: ["modeling", "calculation"], exam_priority: "HIGH_BIG",
    game_type: "coin_combo", play_as: "coin_combo",
    cognitive_level: "application", difficulty: 3, estimated_time_seconds: 35,
    stem: "买一支 3.5 元的笔，点选下面的钱正好凑出 3.5 元。",
    question_format: "numeric", answer: { type: "number", value: 3.5 },
    coin_combo: { coins: [5, 0.5, 1, 0.1, 2], target: 3.5, correctIndices: [1, 2, 4] },
    solution_steps: ["0.5 + 1 + 2 = 3.5 元", "选 0.5 元、1 元、2 元三张正好凑出 3.5 元"],
    hints: [{ text: "先找大面值，再用小面值补足", penalty: 1 }],
    common_errors: [{ tag: "coin_mismatch", error: "凑多或凑少", remediation: "把选中的金额加起来核对是否等于 3.5。" }],
    feedback_correct: "凑对了！0.5+1+2=3.5 元。", feedback_wrong: "再加一加：要正好等于 3.5 元。",
    tags: [...EXAM_TAGS, "凑钱", "小数加法"],
  },
  {
    ...base, question_id: "G4B_exam_coin_2", term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB", unit_name: "小数的意义和加减法",
    skill_id: "decimal_add_sub_vertical", skill_name: "元角分·小数加法",
    ability_dimension: ["modeling", "calculation"], exam_priority: "HIGH_BIG",
    game_type: "coin_combo", play_as: "coin_combo",
    cognitive_level: "application", difficulty: 3, estimated_time_seconds: 35,
    stem: "点选下面的钱正好凑出 1.6 元。",
    question_format: "numeric", answer: { type: "number", value: 1.6 },
    coin_combo: { coins: [1, 5, 0.5, 2, 0.1], target: 1.6, correctIndices: [0, 2, 4] },
    solution_steps: ["1 + 0.5 + 0.1 = 1.6 元", "选 1 元、0.5 元、0.1 元正好凑出 1.6 元"],
    hints: [{ text: "1.6 元 = 1 元 6 角，想想 6 角怎么凑", penalty: 1 }],
    common_errors: [{ tag: "coin_mismatch", error: "角的部分凑错", remediation: "6 角 = 5 角 + 1 角。" }],
    feedback_correct: "凑对了！1+0.5+0.1=1.6 元。", feedback_wrong: "1.6 元里有 1 元和 6 角，再试试。",
    tags: [...EXAM_TAGS, "凑钱", "小数加法"],
  },
  {
    ...base, question_id: "G4B_exam_coin_3", term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB", unit_name: "小数的意义和加减法",
    skill_id: "decimal_add_sub_vertical", skill_name: "元角分·小数加法",
    ability_dimension: ["modeling", "calculation"], exam_priority: "HIGH_BIG",
    game_type: "coin_combo", play_as: "coin_combo",
    cognitive_level: "application", difficulty: 3, estimated_time_seconds: 35,
    stem: "买一个 7.5 元的笔记本，点选下面的钱正好凑出 7.5 元。",
    question_format: "numeric", answer: { type: "number", value: 7.5 },
    coin_combo: { coins: [10, 0.5, 1, 5, 2], target: 7.5, correctIndices: [1, 3, 4] },
    solution_steps: ["0.5 + 5 + 2 = 7.5 元", "选 0.5 元、5 元、2 元正好凑出 7.5 元"],
    hints: [{ text: "先用大面值 5 元，再补 2.5 元", penalty: 1 }],
    common_errors: [{ tag: "coin_mismatch", error: "用了 10 元就超了", remediation: "10 元比 7.5 元大，不能用。" }],
    feedback_correct: "凑对了！5+2+0.5=7.5 元。", feedback_wrong: "10 元太大，用 5+2+0.5 试试。",
    tags: [...EXAM_TAGS, "凑钱", "小数加法"],
  },
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B16 (v0.36.97, 数学出题 loop iter18)
 * 🎮 激活 🧩方程拼装 equation_builder。本质=拼"可求值的综合算式"(组件 slot 数字、check 求值
 * 比对; 用 tryEvaluateExpression 验, 支持 +−×÷()小数)。故用于 综合算式 而非含未知数的方程。
 * 数据走 word_problem_steps.equation_or_expression(组件 deriveEquationSpec 的 fallback 路径)
 * + answer numeric。play_as=equation_builder。tag from_test/exam/期末题。
 * =========================================================================== */
const eqBuildBase = {
  ...base, term: "下册" as const,
  unit_id: "G4B_U3_DECIMAL_MULTIPLY", unit_name: "小数乘法",
  ability_dimension: ["modeling", "calculation"] as AbilityId[],
  exam_priority: "HIGH_BIG" as ExamPriority,
  game_type: "equation_balance", play_as: "equation_builder" as GameTemplate,
  cognitive_level: "application" as const, question_format: "numeric" as const,
};
const examFinalPackG4B16: Question[] = [
  {
    ...eqBuildBase, question_id: "G4B_exam_eqbuild_1",
    skill_id: "decimal_price_quantity", skill_name: "拼算式·总价",
    difficulty: 2, estimated_time_seconds: 35,
    stem: "苹果每千克 6.5 元，买 3.2 千克。用数字卡片拼出求总价的算式。",
    answer: { type: "number", value: 20.8 },
    word_problem_steps: { known: ["苹果每千克 6.5 元", "买 3.2 千克"], question: "一共多少元？", relationship: "总价 = 单价 × 数量", equation_or_expression: "6.5*3.2", check: "6.5×3.2=20.8" },
    solution_steps: ["总价 = 单价 × 数量", "6.5 × 3.2 = 20.8 元"],
    hints: [{ text: "总价 = 单价 × 数量", penalty: 1 }],
    common_errors: [{ tag: "relation_model_error", error: "数字放错位置", remediation: "单价 × 数量。" }],
    feedback_correct: "算式拼对了！6.5 × 3.2。", feedback_wrong: "总价 = 单价 × 数量，再拼一次。",
    tags: [...EXAM_TAGS, "方程拼装", "小数乘法"],
  },
  {
    ...eqBuildBase, question_id: "G4B_exam_eqbuild_2",
    skill_id: "decimal_speed_distance", skill_name: "拼算式·路程",
    difficulty: 2, estimated_time_seconds: 35,
    stem: "一辆汽车每小时行 65.5 千米，行了 4 小时。用数字卡片拼出求路程的算式。",
    answer: { type: "number", value: 262 },
    word_problem_steps: { known: ["每小时行 65.5 千米", "行了 4 小时"], question: "一共行多少千米？", relationship: "路程 = 速度 × 时间", equation_or_expression: "65.5*4", check: "65.5×4=262" },
    solution_steps: ["路程 = 速度 × 时间", "65.5 × 4 = 262 千米"],
    hints: [{ text: "路程 = 速度 × 时间", penalty: 1 }],
    common_errors: [{ tag: "relation_model_error", error: "数字放错", remediation: "速度 × 时间。" }],
    feedback_correct: "算式拼对了！65.5 × 4。", feedback_wrong: "路程 = 速度 × 时间。",
    tags: [...EXAM_TAGS, "方程拼装", "小数乘法"],
  },
  {
    ...eqBuildBase, question_id: "G4B_exam_eqbuild_3",
    skill_id: "decimal_mul_mix", skill_name: "拼算式·综合",
    difficulty: 4, estimated_time_seconds: 50,
    stem: "买 8 个篮球（每个 45.5 元）和 6 个足球（每个 38 元）。用数字卡片拼出求总价的算式。",
    answer: { type: "number", value: 592 },
    word_problem_steps: { known: ["篮球每个 45.5 元，买 8 个", "足球每个 38 元，买 6 个"], question: "一共多少元？", relationship: "总价 = 篮球单价 × 数量 + 足球单价 × 数量", equation_or_expression: "45.5*8+38*6", check: "364+228=592" },
    solution_steps: ["篮球：45.5 × 8 = 364 元", "足球：38 × 6 = 228 元", "合计：364 + 228 = 592 元"],
    hints: [{ text: "两种球分别 单价 × 数量，再相加", penalty: 1 }],
    common_errors: [{ tag: "relation_model_error", error: "把单价或数量混用", remediation: "篮球单价配篮球数量。" }],
    feedback_correct: "综合算式拼对了！45.5×8+38×6。", feedback_wrong: "分别算两种球再相加。",
    tags: [...EXAM_TAGS, "方程拼装", "小数乘法"],
  },
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B17 (v0.36.98, 数学出题 loop iter19)
 * 🎮 激活 💎数字寻宝 number_hunt。5×5 网格挑出符合条件的数(小数比较 / 数位)。
 * number_hunt 字段(NumberHuntSpec grid[25]/rule/targetIndices)typecheck 校验; 组件按
 * targetIndices 自判。每格已逐一核对。tag from_test/exam/期末题。
 * =========================================================================== */
const examFinalPackG4B17: Question[] = [
  {
    ...base, question_id: "G4B_exam_hunt_1", term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB", unit_name: "小数的意义和加减法",
    skill_id: "decimal_compare", skill_name: "小数大小比较",
    ability_dimension: ["concept", "reasoning"], exam_priority: "HIGH_BIG",
    game_type: "number_hunt", play_as: "number_hunt",
    cognitive_level: "reasoning", difficulty: 3, estimated_time_seconds: 45,
    stem: "在下面的数中，找出所有大于 1 的小数（点选出来）。",
    question_format: "numeric", answer: { type: "number", value: 6 },
    number_hunt: {
      grid: [
        0.5, 0.8, 1.2, 0.3, 0.9,
        0.7, 0.4, 0.6, 2.5, 0.2,
        1.5, 0.1, 0.95, 1.4, 0.75,
        0.35, 3.2, 0.55, 0.85, 0.65,
        0.25, 1.8, 0.15, 0.99, 0.05,
      ],
      rule: "找出所有大于 1 的小数",
      targetIndices: [2, 8, 10, 13, 16, 21],
    },
    solution_steps: ["大于 1 的数：1.2、2.5、1.5、1.4、3.2、1.8", "注意 0.95、0.99 都小于 1，不能选"],
    hints: [{ text: "整数部分大于等于 1 且不等于 1 的；只看是不是比 1 大", penalty: 1 }],
    common_errors: [{ tag: "compare_error", error: "把 0.95、0.99 当成大于 1", remediation: "0.95、0.99 都比 1 小。" }],
    feedback_correct: "全找对了！6 个大于 1 的小数。", feedback_wrong: "再看一遍，0.9 几的都比 1 小。",
    tags: [...EXAM_TAGS, "小数比较"],
  },
  {
    ...base, question_id: "G4B_exam_hunt_2", term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB", unit_name: "小数的意义和加减法",
    skill_id: "decimal_meaning_place", skill_name: "数位意义",
    ability_dimension: ["concept"], exam_priority: "HIGH_BIG",
    game_type: "number_hunt", play_as: "number_hunt",
    cognitive_level: "reasoning", difficulty: 3, estimated_time_seconds: 45,
    stem: "在下面的数中，找出所有十分位上是 5 的小数（点选出来）。",
    question_format: "numeric", answer: { type: "number", value: 6 },
    number_hunt: {
      grid: [
        2.5, 0.3, 1.8, 0.52, 4.2,
        0.7, 3.5, 0.9, 1.2, 0.58,
        6.1, 0.4, 2.56, 0.8, 1.1,
        0.6, 7.51, 0.2, 3.3, 0.95,
        1.4, 0.85, 5.0, 0.1, 2.2,
      ],
      rule: "找出所有十分位上是 5 的小数",
      targetIndices: [0, 3, 6, 9, 12, 16],
    },
    solution_steps: ["十分位 = 小数点后第一位", "十分位是 5 的：2.5、0.52、3.5、0.58、2.56、7.51", "注意 5.0 的十分位是 0，0.85 的十分位是 8，不能选"],
    hints: [{ text: "十分位是小数点后第一位数字", penalty: 1 }],
    common_errors: [{ tag: "place_value_error", error: "把整数部分是 5 的（5.0）也选了", remediation: "看的是十分位，不是整数部分。" }],
    feedback_correct: "全找对了！6 个十分位是 5 的小数。", feedback_wrong: "十分位是小数点后第一位，再找找。",
    tags: [...EXAM_TAGS, "小数意义"],
  },
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B18 (v0.36.99, 数学出题 loop iter21)
 * 补 U2 真实缺口: 四边形(平行四边形/梯形)——之前只覆盖三角形, 四边形是 U2"认识三角形和
 * 四边形"核心考点(真题2024有梯形/平行四边形题)。新建 G4B skill quadrilateral_classify。
 * tag from_test/exam/期末题。
 * =========================================================================== */
const examFinalPackG4B18: Question[] = [
  makeChoice({
    ...UNIT_TRI,
    id: "G4B_exam_quad_1",
    skillId: "quadrilateral_classify",
    skillName: "四边形分类",
    ability: ["concept", "spatial"],
    examPriority: "HIGH_BIG",
    difficulty: 2,
    stem: "只有一组对边平行的四边形叫做（ ）。",
    options: [
      { id: "A", text: "梯形" },
      { id: "B", text: "平行四边形", errorTag: "concept_confuse" },
      { id: "C", text: "长方形", errorTag: "concept_confuse" },
    ],
    correctId: "A",
    solution_steps: ["只有一组对边平行 → 梯形", "两组对边都平行才是平行四边形"],
    tags: [...EXAM_TAGS, "四边形"],
  }),
  makeChoice({
    ...UNIT_TRI,
    id: "G4B_exam_quad_2",
    skillId: "quadrilateral_classify",
    skillName: "四边形特征",
    ability: ["concept", "spatial"],
    examPriority: "HIGH_BIG",
    difficulty: 2,
    stem: "两组对边分别平行的四边形是（ ）。",
    options: [
      { id: "A", text: "平行四边形" },
      { id: "B", text: "梯形", errorTag: "concept_confuse" },
      { id: "C", text: "三角形", errorTag: "concept_confuse" },
    ],
    correctId: "A",
    solution_steps: ["两组对边分别平行 → 平行四边形", "长方形、正方形都是特殊的平行四边形"],
    tags: [...EXAM_TAGS, "四边形"],
  }),
  makeTF({
    ...UNIT_TRI,
    id: "G4B_exam_quad_3",
    skillId: "quadrilateral_classify",
    skillName: "四边形从属关系",
    ability: ["concept", "spatial"],
    examPriority: "HIGH_BIG",
    difficulty: 3,
    stem: "长方形是一种特殊的平行四边形。",
    truth: "T",
    solution_steps: ["长方形两组对边分别平行，符合平行四边形的特征", "它是有一个角是直角的特殊平行四边形，所以是特殊的平行四边形"],
    tags: [...EXAM_TAGS, "四边形"],
  }),
  makeTF({
    ...UNIT_TRI,
    id: "G4B_exam_quad_4",
    skillId: "quadrilateral_classify",
    skillName: "梯形与平行四边形关系",
    ability: ["concept", "spatial"],
    examPriority: "HIGH_BIG",
    difficulty: 3,
    stem: "梯形也是一种平行四边形。",
    truth: "F",
    solution_steps: ["梯形只有一组对边平行", "平行四边形两组对边都平行", "两者是并列关系，梯形不是平行四边形"],
    hints: [{ text: "梯形只有一组对边平行", penalty: 1 }],
    tags: [...EXAM_TAGS, "四边形"],
  }),
  makeTF({
    ...UNIT_TRI,
    id: "G4B_exam_quad_5",
    skillId: "quadrilateral_classify",
    skillName: "平行四边形特性",
    ability: ["concept", "spatial"],
    examPriority: "HIGH_BIG",
    difficulty: 2,
    stem: "平行四边形容易变形，三角形具有稳定性。",
    truth: "T",
    solution_steps: ["平行四边形拉一拉会变形（不稳定），生活中的伸缩门用了这个特性", "三角形不易变形（稳定），所以自行车架、电线杆支架做成三角形"],
    tags: [...EXAM_TAGS, "四边形", "三角形"],
  }),
  makeChoice({
    ...UNIT_TRI,
    id: "G4B_exam_quad_6",
    skillId: "quadrilateral_classify",
    skillName: "四边形内角和",
    ability: ["concept", "calculation"],
    examPriority: "HIGH_BIG",
    difficulty: 3,
    cognitive: "reasoning",
    stem: "任意一个四边形，它的四个内角的和是（ ）。",
    options: [
      { id: "A", text: "360°" },
      { id: "B", text: "180°", errorTag: "angle_sum_error" },
      { id: "C", text: "720°", errorTag: "angle_sum_error" },
    ],
    correctId: "A",
    solution_steps: ["一个四边形可以分成 2 个三角形", "每个三角形内角和 180°", "所以四边形内角和 = 180° × 2 = 360°"],
    tags: [...EXAM_TAGS, "四边形", "内角和"],
  }),
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B19 (v0.36.100, 数学出题 loop iter22)
 * 补覆盖缺口(逐 skill 审计发现): equation_meaning_balance 方程的意义(0 exam→补)。
 * 另: 本 iter 修了 makeVR 的 tags bug(之前 tags=vertLines 把 exam tag 冲掉) + 给 4 道竖式
 * exam 题、eqdef 补上 exam tag。tag from_test/exam/期末题。
 * =========================================================================== */
const examFinalPackG4B19: Question[] = [
  makeTF({
    ...UNIT_EQ,
    id: "G4B_exam_eqdef_2",
    skillId: "equation_meaning_balance",
    skillName: "方程的意义",
    ability: ["concept"],
    examPriority: "MUST_BIG",
    difficulty: 2,
    stem: "含有未知数的等式叫做方程。",
    truth: "T",
    solution_steps: ["方程必须满足两个条件：① 是等式（有等号）② 含有未知数", "“含有未知数的等式”正是方程的定义"],
    tags: [...EXAM_TAGS, "方程意义"],
  }),
  makeChoice({
    ...UNIT_EQ,
    id: "G4B_exam_eqdef_3",
    skillId: "equation_meaning_balance",
    skillName: "方程的意义",
    ability: ["concept", "reasoning"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    cognitive: "reasoning",
    stem: "下面各式中，是方程的是（ ）。",
    options: [
      { id: "A", text: "3x + 5 = 20" },
      { id: "B", text: "8 − 3 = 5", errorTag: "no_unknown" },
      { id: "C", text: "2x − 1 > 7", errorTag: "not_equation_sign" },
    ],
    correctId: "A",
    solution_steps: ["方程 = 含未知数 + 等式", "B 没有未知数（只是算式）", "C 用的是“>”不是等号（是不等式）", "只有 A 既含未知数 x，又有等号，是方程"],
    tags: [...EXAM_TAGS, "方程意义"],
  }),
  makeChoice({
    ...UNIT_EQ,
    id: "G4B_exam_eqdef_4",
    skillId: "equation_meaning_balance",
    skillName: "方程与等式关系",
    ability: ["concept", "reasoning"],
    examPriority: "HIGH_BIG",
    difficulty: 3,
    cognitive: "reasoning",
    stem: "关于方程和等式，下面说法正确的是（ ）。",
    options: [
      { id: "A", text: "方程一定是等式，等式不一定是方程" },
      { id: "B", text: "等式一定是方程", errorTag: "concept_confuse" },
      { id: "C", text: "方程不是等式", errorTag: "concept_confuse" },
    ],
    correctId: "A",
    solution_steps: ["方程是“含未知数的等式”，所以方程一定是等式", "但等式不一定含未知数（如 3+2=5 是等式不是方程）", "所以方程一定是等式，等式不一定是方程"],
    tags: [...EXAM_TAGS, "方程意义"],
  }),
];

/* ===========================================================================
 * 期末备考题包 examFinalPackG4B20 (v0.36.101, 数学出题 loop iter23)
 * 均衡薄 skill(逐 skill 审计 ⚠️1 的)：三角形内角和应用/小数乘加混合/工作总量/两步方程/
 * 已知平均求总和。各 +1。tag from_test/exam/期末题。
 * =========================================================================== */
const examFinalPackG4B20: Question[] = [
  // 三角形内角和应用（等腰三角形求底角，U2）
  makeChoice({
    ...UNIT_TRI,
    id: "G4B_exam_angsum_2",
    skillId: "triangle_angle_sum",
    skillName: "三角形内角和应用",
    ability: ["calculation", "spatial"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    cognitive: "reasoning",
    stem: "一个等腰三角形的顶角是 100°，它的一个底角是多少度？",
    options: [
      { id: "A", text: "40°" },
      { id: "B", text: "80°", errorTag: "angle_calc_error" },
      { id: "C", text: "50°", errorTag: "forgot_two_base" },
    ],
    correctId: "A",
    solution_steps: ["等腰三角形两个底角相等", "两底角之和 = 180° − 100° = 80°", "每个底角 = 80° ÷ 2 = 40°"],
    tags: [...EXAM_TAGS, "三角形", "内角和"],
  }),
  // 小数乘加混合（U3）
  makeSpeed({
    ...UNIT_DMUL,
    id: "G4B_exam_mulmix_1",
    skillId: "decimal_mul_mix",
    skillName: "小数乘加混合",
    ability: ["calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "计算：4.5 × 3 − 2.5 = ？（先算乘法）",
    value: 11,
    distractors: [13.5, 16, 9.5],
    hints: [{ text: "先算 4.5 × 3 = 13.5，再减 2.5", penalty: 1 }],
    tags: [...EXAM_TAGS, "小数乘法"],
  }),
  // 工作总量应用（U3）
  makeApp({
    ...UNIT_DMUL,
    id: "G4B_exam_work_1",
    skillId: "decimal_work_total",
    skillName: "工作总量",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 3,
    stem: "一台机器每小时加工 12.5 个零件，工作了 6 小时。",
    clues: ["每小时加工 12.5 个零件", "工作了 6 小时", "机器是新的"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "工作总量 = 每小时加工数 × 工作时间", correct: true },
      { id: "B", text: "工作总量 = 每小时加工数 ÷ 工作时间", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "工作总量 = 每小时加工数 + 工作时间", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "一共加工多少个零件？",
    finalValue: 75,
    finalUnit: "个",
    finalDistractors: [18.5, 750, 2],
    expression: "12.5*6",
    solution_steps: ["工作总量 = 每小时加工数 × 时间", "12.5 × 6 = 75 个"],
    check: "12.5 × 6 = 75，正确",
    tags: [...EXAM_TAGS, "小数乘法"],
  }),
  // 两步方程应用（U5）
  makeApp({
    ...UNIT_EQ,
    id: "G4B_exam_eq2_1",
    skillId: "equation_two_step_word",
    skillName: "两步方程应用",
    ability: ["modeling", "calculation"],
    examPriority: "MUST_BIG",
    difficulty: 4,
    stem: "妈妈买了 4 千克苹果，付了 50 元，找回 24 元。苹果每千克多少元？",
    clues: ["买了 4 千克苹果", "付了 50 元", "找回 24 元"],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "设每千克 x 元，列方程 4x + 24 = 50（即 4x = 50 − 24）", correct: true },
      { id: "B", text: "4x = 50 + 24", correct: false, errorTag: "op_inverse" },
      { id: "C", text: "4x = 50", correct: false, errorTag: "ignore_change" },
    ],
    finalPrompt: "苹果每千克多少元？",
    finalValue: 6.5,
    finalUnit: "元",
    finalDistractors: [12.5, 18.5, 6],
    expression: "4x+24=50",
    solution_steps: ["花的钱：50 − 24 = 26 元", "每千克：26 ÷ 4 = 6.5 元"],
    check: "6.5 × 4 + 24 = 50，正确",
    tags: [...EXAM_TAGS, "列方程"],
  }),
  // 已知平均数求总和（U6）
  makeSpeed({
    ...UNIT_DATA,
    id: "G4B_exam_avgtotal_1",
    skillId: "average_inverse_total",
    skillName: "已知平均数求总和",
    ability: ["data", "calculation"],
    examPriority: "HIGH_BIG",
    difficulty: 2,
    stem: "5 个数的平均数是 12，这 5 个数的总和是多少？",
    value: 60,
    distractors: [17, 2.4, 55],
    hints: [{ text: "总和 = 平均数 × 个数 = 12 × 5", penalty: 1 }],
    tags: [...EXAM_TAGS, "平均数"],
  }),
];

const SEED_QUESTIONS_RAW: Question[] = [
  ...decimalPriceQuantity,
  ...decimalSpeedDistance,
  ...decimalWorkTotal,
  ...decimalSegment,
  ...decimalMulMix,
  ...decimalMulSimplify,
  ...decimalMulVertical,
  ...decimalMulMeaning,
  ...decimalPointShift,
  ...decimalProductDigits,
  ...decimalAddSubVertical,
  ...decimalAddSubSimplify,
  ...decimalInverseProblem,
  ...decimalMeaning,
  ...decimalUnitConversion,
  ...decimalCompare,
  ...equationsSet,
  ...averages,
  ...triangleSet,
  ...observeSet,
  ...upperBookSet,
  ...expansionV03,
  ...expansionV04,
  ...EXAM_PAPER_PACK,
  ...MUST_BIG_PACK,
  ...GAP_FILL_PACK_G4B,
  ...GAP_FILL_PACK_G4B_V2,
  ...GAP_FILL_PACK_G4B_V3,
  ...AI_GEN_G4B_PACK,
  ...AI_GEN_G4B_U14_PACK,
  ...DOT_GRID_DEMO_PACK,
  ...examFinalPackG4B,
  ...examFinalPackG4B2,
  ...examFinalPackG4B3,
  ...examFinalPackG4B4,
  ...examFinalPackG4B5,
  ...examFinalPackG4B6,
  ...examFinalPackG4B7,
  ...examFinalPackG4B8,
  ...examFinalPackG4B9,
  ...examFinalPackG4B10,
  ...examFinalPackG4B11,
  ...examFinalPackG4B12,
  ...examFinalPackG4B13,
  ...examFinalPackG4B14,
  ...examFinalPackG4B15,
  ...examFinalPackG4B16,
  ...examFinalPackG4B17,
  ...examFinalPackG4B18,
  ...examFinalPackG4B19,
  ...examFinalPackG4B20,
];

// v0.35.20 iter 49: 把 LLM-backfilled metadata overlay 应用上去.
// 空 overlay {} 时无副作用. backfill 跑完 questions-backfilled-metadata.json
// 有内容后, 主路径 EstimationGate / SpeedMatch / Scratch / MultiStep 触发率提升.
export const SEED_QUESTIONS: Question[] = applyReadingTimeFloor(applyMetadataBackfill(SEED_QUESTIONS_RAW));
