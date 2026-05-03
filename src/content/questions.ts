import type { AbilityId, ExamPriority, Hint, Question, SubQuestion, GameTemplate } from "../core/types";
import { EXAM_PAPER_PACK } from "./examPaperPack";
import { MUST_BIG_PACK } from "./mustBigPack";
import { GAP_FILL_PACK_G4B } from "./gapFillPackG4B";
import { GAP_FILL_PACK_G4B_V2 } from "./gapFillPackG4B_v2";
import { GAP_FILL_PACK_G4B_V3 } from "./gapFillPackG4B_v3";

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
    tags: opts.vertLines,
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

export const SEED_QUESTIONS: Question[] = [
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
];
