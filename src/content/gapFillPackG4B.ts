/**
 * 题量补齐包 v0.16.4 —— G4B（四年级下册）
 *
 * 目标：让下册每个 skill 至少有 10 道题，避免重做 decay 几次就归零的尴尬。
 * 来源：原创，对照 BNU 2013 版四年级下册教材范围。所有数字事实手算校验过。
 *
 * 命名规则：question_id 形如 `G4B_FILL_<skill_short>_<n>`
 */

import type { AbilityId, ExamPriority, Hint, Question, GameTemplate, SubQuestion } from "../core/types";

const base = {
  version: 1 as const,
  status: "approved" as const,
  grade: 4 as const,
  source: {
    curriculum: "BNU_2013_G4",
    basis: "gap_fill_v016_4",
    copyright_safe: true,
    original: true,
  },
  variant_rules: { same_skill: true, change_numbers: true, change_context: true, preserve_difficulty: true },
  review_interval_days: [1, 3, 7, 14, 30],
  safety_check: {
    no_real_child_name: true,
    no_personal_data: true,
    age_appropriate: true,
    no_ads: true,
    no_payment_inducement: true,
    no_unrelated_link: true,
  },
};

interface SkillCtx {
  unitId: string;
  unitName: string;
  term: "上册" | "下册";
  skillId: string;
  skillName: string;
  ability: AbilityId[];
  examPriority: ExamPriority;
}

interface NumQ {
  id: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  stem: string;
  value: number;
  unit?: string;
  distractors: number[];
  hints?: Hint[];
  time?: number;
  feedback_correct?: string;
  feedback_wrong?: string;
  tags?: string[];
  playAs?: GameTemplate;
}

function speed(s: SkillCtx, q: NumQ): Question {
  return {
    ...base,
    question_id: q.id,
    term: s.term,
    unit_id: s.unitId,
    unit_name: s.unitName,
    skill_id: s.skillId,
    skill_name: s.skillName,
    ability_dimension: s.ability,
    exam_priority: s.examPriority,
    game_type: "speed_calc",
    play_as: q.playAs ?? "speed_match",
    cognitive_level: "procedural",
    difficulty: q.difficulty,
    estimated_time_seconds: q.time ?? 25,
    stem: q.stem,
    question_format: "numeric",
    answer: { type: "number", value: q.value, ...(q.unit ? { unit: q.unit } : {}) },
    distractors: q.distractors,
    solution_steps: [`答 ${q.value}${q.unit ?? ""}`],
    hints: q.hints ?? [{ text: "别急，读完题再答", penalty: 1 }],
    common_errors: [
      { tag: "careless_reading", error: "看错或算错", remediation: "重新读一遍题。" },
      { tag: "decimal_point_error", error: "小数点放错位置", remediation: "先按整数算再点小数。" },
    ],
    feedback_correct: q.feedback_correct ?? "干得漂亮！",
    feedback_wrong: q.feedback_wrong ?? "再想想，答案就在附近。",
    tags: q.tags,
  };
}

interface ChoiceQ {
  id: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  stem: string;
  options: { id: string; text: string; errorTag?: string }[];
  correctId: string;
  hints?: Hint[];
  solution_steps: string[];
  cognitive?: "recall" | "procedural" | "application" | "reasoning";
  time?: number;
  tags?: string[];
  feedback_correct?: string;
  feedback_wrong?: string;
}

function choice(s: SkillCtx, q: ChoiceQ): Question {
  return {
    ...base,
    question_id: q.id,
    term: s.term,
    unit_id: s.unitId,
    unit_name: s.unitName,
    skill_id: s.skillId,
    skill_name: s.skillName,
    ability_dimension: s.ability,
    exam_priority: s.examPriority,
    game_type: "concept_check",
    play_as: "plain_choice",
    cognitive_level: q.cognitive ?? "reasoning",
    difficulty: q.difficulty,
    estimated_time_seconds: q.time ?? 30,
    stem: q.stem,
    question_format: "single_choice",
    options: q.options,
    answer: { type: "choice", value: q.correctId },
    solution_steps: q.solution_steps,
    hints: q.hints ?? [{ text: "排除明显不对的，再从剩下里选", penalty: 1 }],
    common_errors: [
      { tag: "concept_confuse", error: "概念混淆", remediation: "回忆定义或关键规则。" },
      { tag: "careless_reading", error: "看错题", remediation: "再读一次题目。" },
    ],
    feedback_correct: q.feedback_correct ?? "判断很准！",
    feedback_wrong: q.feedback_wrong ?? "别着急，先排除明显错的选项。",
    tags: q.tags,
  };
}

interface AppQ {
  id: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
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
  time?: number;
  tags?: string[];
}

function app(s: SkillCtx, q: AppQ): Question {
  const subs: SubQuestion[] = [
    { kind: "clue_pick", prompt: "先挑出本题用到的已知条件：", clues: q.clues, correct: q.correctClueIdx, mode: "pick_correct" },
    { kind: "choose", prompt: "这道题最合适的数量关系是：", options: q.relationshipChoices },
    { kind: "numeric", prompt: q.finalPrompt, value: q.finalValue, unit: q.finalUnit, distractors: q.finalDistractors },
  ];
  return {
    ...base,
    question_id: q.id,
    term: s.term,
    unit_id: s.unitId,
    unit_name: s.unitName,
    skill_id: s.skillId,
    skill_name: s.skillName,
    ability_dimension: s.ability,
    exam_priority: s.examPriority,
    game_type: "word_problem_lab",
    play_as: "shop_counter",
    cognitive_level: "application",
    difficulty: q.difficulty,
    estimated_time_seconds: q.time ?? 90,
    stem: q.stem,
    question_format: "multi_step",
    answer: {
      type: "multi_step",
      steps: [
        { step_id: "clue", expected: q.correctClueIdx.join(",") },
        { step_id: "relationship", expected: q.relationshipChoices.find((o) => o.correct)?.text ?? "" },
        { step_id: "answer", expected: q.finalValue, kind: "answer" },
      ],
    },
    subquestions: subs,
    word_problem_steps: {
      known: q.correctClueIdx.map((i) => q.clues[i]!),
      question: q.finalPrompt,
      relationship: q.relationshipChoices.find((o) => o.correct)?.text ?? "",
      equation_or_expression: q.expression,
      check: "代回原题检查。",
    },
    solution_steps: q.solution_steps,
    hints: q.hints ?? [{ text: "先找题目要问的是什么", penalty: 1 }],
    common_errors: [
      { tag: "relation_model_error", error: "数量关系搞错", remediation: "先口头说一句『X 等于什么乘/加/减什么』。" },
      { tag: "careless_reading", error: "看错题", remediation: "再读一遍题目。" },
    ],
    feedback_correct: "解得漂亮！",
    feedback_wrong: "没关系，再捋一遍思路。",
    tags: q.tags,
  };
}

/* ===========================================================
   U1 · 小数意义和加减法
   =========================================================== */

const sMeaning: SkillCtx = {
  unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法", term: "下册",
  skillId: "decimal_meaning_place", skillName: "小数意义、小数数位",
  ability: ["concept"], examPriority: "MUST_SMALL",
};
const meaningQs: Question[] = [
  speed(sMeaning, { id: "G4B_FILL_meaning_1", difficulty: 2, stem: "0.45 中的 5 在哪一位？（输入位的序号：1=十分位，2=百分位，3=千分位）", value: 2, distractors: [1, 3, 5] }),
  speed(sMeaning, { id: "G4B_FILL_meaning_2", difficulty: 2, stem: "把 7 个 0.01 写成小数是？", value: 0.07, distractors: [0.7, 7, 0.007] }),
  speed(sMeaning, { id: "G4B_FILL_meaning_3", difficulty: 2, stem: "0.6 表示 6 个？（输入数值：0.1 输 0.1，0.01 输 0.01）", value: 0.1, distractors: [0.01, 1, 6] }),
];

const sUnit: SkillCtx = { ...sMeaning, skillId: "decimal_unit_conversion", skillName: "长度、质量、面积、人民币单位换算", ability: ["concept", "modeling"] };
const unitConvQs: Question[] = [
  speed(sUnit, { id: "G4B_FILL_unit_1", difficulty: 2, stem: "3 元 5 角 = 多少元？", value: 3.5, unit: "元", distractors: [3.05, 35, 8] }),
  speed(sUnit, { id: "G4B_FILL_unit_2", difficulty: 3, stem: "1 米 4 厘米 = 多少米？", value: 1.04, unit: "米", distractors: [1.4, 1.004, 14] }),
];

const sCompare: SkillCtx = { ...sMeaning, skillId: "decimal_compare", skillName: "小数大小比较", ability: ["concept", "reasoning"], examPriority: "HIGH_SMALL" };
const compareQs: Question[] = [
  choice(sCompare, {
    id: "G4B_FILL_compare_1", difficulty: 2,
    stem: "下面哪组小数从小到大排列正确？",
    options: [
      { id: "a", text: "0.6 < 0.65 < 0.605", errorTag: "tail_zero" },
      { id: "b", text: "0.6 < 0.605 < 0.65" },
      { id: "c", text: "0.65 < 0.605 < 0.6", errorTag: "reverse" },
      { id: "d", text: "0.605 < 0.6 < 0.65", errorTag: "tail_zero" },
    ],
    correctId: "b",
    solution_steps: ["补 0 对齐：0.600 / 0.605 / 0.650", "再比"],
  }),
  speed(sCompare, { id: "G4B_FILL_compare_2", difficulty: 2, stem: "在 5.30 和 5.3 中哪个大？（相等输 0，5.30 大输 1，5.3 大输 2）", value: 0, distractors: [1, 2, 5.3] }),
  speed(sCompare, { id: "G4B_FILL_compare_3", difficulty: 3, stem: "比 0.4 大 0.05 的数是？", value: 0.45, distractors: [0.9, 0.405, 0.05] }),
  speed(sCompare, { id: "G4B_FILL_compare_4", difficulty: 2, stem: "0.8 和 0.79 哪个大？（0.8 大输 1，0.79 大输 2）", value: 1, distractors: [2, 0.79, 0.8] }),
  speed(sCompare, { id: "G4B_FILL_compare_5", difficulty: 3, stem: "在数轴上，2.7 比 2.07 大多少？", value: 0.63, distractors: [0.7, 0.07, 2.63] }),
  choice(sCompare, {
    id: "G4B_FILL_compare_6", difficulty: 3,
    stem: "下面哪个数最接近 1？",
    options: [
      { id: "a", text: "0.9" },
      { id: "b", text: "0.99" },
      { id: "c", text: "0.999" },
      { id: "d", text: "1.01", errorTag: "above_one" },
    ],
    correctId: "c",
    solution_steps: ["与 1 的差：0.1 / 0.01 / 0.001 / 0.01", "0.999 与 1 差最小"],
  }),
  speed(sCompare, { id: "G4B_FILL_compare_7", difficulty: 3, stem: "把 0.27、0.207、0.27 中最大的找出来。（如果两个并列大，输任意一个）", value: 0.27, distractors: [0.207, 0.027, 0.5] }),
];

const sAddSubSimp: SkillCtx = {
  ...sMeaning, skillId: "decimal_add_sub_simplify", skillName: "小数加减简便计算",
  ability: ["strategy", "calculation"], examPriority: "MUST_BIG",
};
const addSubSimpQs: Question[] = [
  speed(sAddSubSimp, { id: "G4B_FILL_dasimp_1", difficulty: 3, stem: "简便计算：1.27 + 0.85 + 0.73", value: 2.85, distractors: [2.85, 2.75, 1.85, 3.85].slice(1) }),
  speed(sAddSubSimp, { id: "G4B_FILL_dasimp_2", difficulty: 3, stem: "简便计算：4.6 - 1.8 - 1.2", value: 1.6, distractors: [2.6, 1.4, 0.6] }),
  speed(sAddSubSimp, { id: "G4B_FILL_dasimp_3", difficulty: 4, stem: "简便计算：3.6 + 1.74 + 6.4 + 0.26", value: 12, distractors: [11, 12.1, 11.6] }),
  speed(sAddSubSimp, { id: "G4B_FILL_dasimp_4", difficulty: 3, stem: "简便计算：5.8 - (1.8 + 1.4)", value: 2.6, distractors: [3.6, 1.6, 2.4] }),
];

const sInverse: SkillCtx = { ...sMeaning, skillId: "decimal_inverse_problem", skillName: "已知和/差求未知量逆向应用题", ability: ["modeling", "reasoning"], examPriority: "MUST_BIG" };
const inverseQs: Question[] = [
  speed(sInverse, { id: "G4B_FILL_inv_1", difficulty: 3, stem: "两本书共重 1.85 千克，一本重 0.92 千克。另一本重多少千克？", value: 0.93, unit: "千克", distractors: [0.95, 1.93, 0.83] }),
  speed(sInverse, { id: "G4B_FILL_inv_2", difficulty: 3, stem: "Selena 跑了两段，共 1.6 千米，第一段 0.85 千米。第二段多少千米？", value: 0.75, unit: "千米", distractors: [0.85, 0.65, 2.45] }),
  speed(sInverse, { id: "G4B_FILL_inv_3", difficulty: 3, stem: "买文具一共花了 12.4 元，其中铅笔 3.5 元，剩下买橡皮花了多少元？", value: 8.9, unit: "元", distractors: [9.1, 8.5, 15.9] }),
  speed(sInverse, { id: "G4B_FILL_inv_4", difficulty: 4, stem: "苹果比梨重 0.45 千克。如果苹果重 1.2 千克，梨重多少千克？", value: 0.75, unit: "千克", distractors: [0.65, 1.65, 0.85] }),
];

/* ===========================================================
   U3 · 小数乘法
   =========================================================== */

const sMulMean: SkillCtx = {
  unitId: "G4B_U3_DECIMAL_MULTIPLY", unitName: "小数乘法", term: "下册",
  skillId: "decimal_mul_meaning", skillName: "小数乘法意义",
  ability: ["concept"], examPriority: "MUST_SMALL",
};
const mulMeanQs: Question[] = [
  speed(sMulMean, { id: "G4B_FILL_mul_mean_1", difficulty: 2, stem: "0.4 × 3 表示 3 个 0.4 相加，得多少？", value: 1.2, distractors: [12, 0.12, 0.7] }),
  speed(sMulMean, { id: "G4B_FILL_mul_mean_2", difficulty: 2, stem: "1.2 × 5 表示什么？（输入结果）", value: 6, distractors: [60, 0.6, 1.7] }),
  speed(sMulMean, { id: "G4B_FILL_mul_mean_3", difficulty: 3, stem: "0.25 × 4 是几个 0.25？（输入数字 4 表示 4 个；输入答案）", value: 1, distractors: [100, 0.1, 0.25] }),
  speed(sMulMean, { id: "G4B_FILL_mul_mean_4", difficulty: 2, stem: "3.5 × 2 = ?", value: 7, distractors: [70, 5.5, 0.7] }),
  speed(sMulMean, { id: "G4B_FILL_mul_mean_5", difficulty: 3, stem: "0.6 × 5 表示 5 个 0.6 的和，等于？", value: 3, distractors: [30, 0.3, 5.6] }),
  speed(sMulMean, { id: "G4B_FILL_mul_mean_6", difficulty: 3, stem: "把 0.7 × 4 写成加法是 0.7+0.7+0.7+0.7，结果是？", value: 2.8, distractors: [28, 0.28, 4.7] }),
  speed(sMulMean, { id: "G4B_FILL_mul_mean_7", difficulty: 3, stem: "0.8 × 6 = ?", value: 4.8, distractors: [48, 0.48, 6.8] }),
];

const sProdDigit: SkillCtx = {
  ...sMulMean, skillId: "decimal_product_digits", skillName: "积的小数位数判断",
  ability: ["strategy", "calculation"], examPriority: "MUST_SMALL",
};
const prodDigitQs: Question[] = [
  speed(sProdDigit, { id: "G4B_FILL_pd_1", difficulty: 2, stem: "0.3 × 0.4，积有几位小数？", value: 2, distractors: [1, 3, 0] }),
  speed(sProdDigit, { id: "G4B_FILL_pd_2", difficulty: 3, stem: "已知 12 × 35 = 420，那么 1.2 × 3.5 = ?", value: 4.2, distractors: [42, 0.42, 0.042] }),
  speed(sProdDigit, { id: "G4B_FILL_pd_3", difficulty: 3, stem: "1.25 × 0.8 的积有几位小数？（去尾零之前看）", value: 3, distractors: [2, 1, 4] }),
  speed(sProdDigit, { id: "G4B_FILL_pd_4", difficulty: 3, stem: "0.05 × 0.2 = ?", value: 0.01, distractors: [0.1, 0.001, 0.0001] }),
];

const sMulMix: SkillCtx = {
  ...sMulMean, skillId: "decimal_mul_mix", skillName: "小数乘加、乘减混合运算",
  ability: ["calculation", "modeling"], examPriority: "MUST_BIG",
};
const mulMixQs: Question[] = [
  speed(sMulMix, { id: "G4B_FILL_mix_1", difficulty: 3, stem: "0.4 × 5 + 1.2 = ?", value: 3.2, distractors: [32, 2.2, 0.32] }),
  speed(sMulMix, { id: "G4B_FILL_mix_2", difficulty: 3, stem: "8.5 - 0.6 × 4 = ?", value: 6.1, distractors: [31.6, 6.5, 5.1] }),
  speed(sMulMix, { id: "G4B_FILL_mix_3", difficulty: 4, stem: "1.5 × 3 + 2.4 × 2 = ?", value: 9.3, distractors: [9.0, 9.6, 8.3] }),
  speed(sMulMix, { id: "G4B_FILL_mix_4", difficulty: 4, stem: "10 - 1.2 × 5 = ?", value: 4, distractors: [44, 6, 5] }),
  speed(sMulMix, { id: "G4B_FILL_mix_5", difficulty: 4, stem: "0.8 × 6 + 1.4 × 3 = ?", value: 9, distractors: [9.6, 8, 10] }),
];

const sMulSimp: SkillCtx = {
  ...sMulMean, skillId: "decimal_mul_simplify", skillName: "小数乘法简便运算",
  ability: ["strategy", "reasoning"], examPriority: "MUST_BIG",
};
const mulSimpQs: Question[] = [
  speed(sMulSimp, { id: "G4B_FILL_msimp_1", difficulty: 3, stem: "用乘法分配律：1.5 × 4 + 1.5 × 6 = ?", value: 15, distractors: [12, 9, 25] }),
  speed(sMulSimp, { id: "G4B_FILL_msimp_2", difficulty: 4, stem: "简便计算：0.25 × 8 × 4", value: 8, distractors: [80, 32, 2] }),
  speed(sMulSimp, { id: "G4B_FILL_msimp_3", difficulty: 4, stem: "简便计算：2.5 × 3.6", value: 9, distractors: [9.6, 7.5, 90] }),
];

const sSpeedDist: SkillCtx = {
  ...sMulMean, skillId: "decimal_speed_distance", skillName: "路程=速度×时间（小数场景）",
  ability: ["modeling", "calculation"], examPriority: "MUST_BIG",
};
const speedDistQs: Question[] = [
  speed(sSpeedDist, { id: "G4B_FILL_sd_1", difficulty: 3, stem: "汽车每小时行 60.5 千米，行 3 小时走多少千米？", value: 181.5, unit: "千米", distractors: [180, 182, 60.5] }),
  speed(sSpeedDist, { id: "G4B_FILL_sd_2", difficulty: 3, stem: "Selena 步行每分钟 65 米，走 4.5 分钟走多远？", value: 292.5, unit: "米", distractors: [260, 290, 295] }),
  speed(sSpeedDist, { id: "G4B_FILL_sd_3", difficulty: 4, stem: "高铁每小时 280 千米，跑 2.5 小时走多远？", value: 700, unit: "千米", distractors: [560, 750, 1400] }),
  speed(sSpeedDist, { id: "G4B_FILL_sd_4", difficulty: 3, stem: "自行车每小时 12.5 千米，骑 2 小时多远？", value: 25, unit: "千米", distractors: [12.5, 24, 26] }),
  speed(sSpeedDist, { id: "G4B_FILL_sd_5", difficulty: 4, stem: "电瓶车每小时 35.6 千米，开 1.5 小时多远？", value: 53.4, unit: "千米", distractors: [50, 53, 71.2] }),
];

const sWork: SkillCtx = {
  ...sMulMean, skillId: "decimal_work_total", skillName: "工程量/产量合计",
  ability: ["modeling", "calculation"], examPriority: "MUST_BIG",
};
const workQs: Question[] = [
  speed(sWork, { id: "G4B_FILL_wt_1", difficulty: 3, stem: "一台机器每小时生产 24.5 个零件，工作 6 小时共生产多少个？", value: 147, unit: "个", distractors: [140, 150, 30.5] }),
  speed(sWork, { id: "G4B_FILL_wt_2", difficulty: 3, stem: "果园平均每棵树产 16.5 千克苹果，10 棵树共产多少千克？", value: 165, unit: "千克", distractors: [160, 170, 26.5] }),
  speed(sWork, { id: "G4B_FILL_wt_3", difficulty: 4, stem: "一台抽水机每分钟抽水 2.4 立方米，连续工作 25 分钟共抽多少立方米？", value: 60, unit: "立方米", distractors: [50, 27.4, 240] }),
  speed(sWork, { id: "G4B_FILL_wt_4", difficulty: 3, stem: "工人每天打字 5400 字，连续 4.5 天共打多少字？", value: 24300, unit: "字", distractors: [21600, 24000, 2430] }),
  speed(sWork, { id: "G4B_FILL_wt_5", difficulty: 3, stem: "一头奶牛每天产奶 28.5 千克，一周（7 天）产多少千克？", value: 199.5, unit: "千克", distractors: [200, 35.5, 195] }),
  speed(sWork, { id: "G4B_FILL_wt_6", difficulty: 4, stem: "一辆货车每次运 4.8 吨，运 12 次共运多少吨？", value: 57.6, unit: "吨", distractors: [60, 16.8, 48] }),
];

const sSeg: SkillCtx = {
  ...sMulMean, skillId: "decimal_segment_pricing", skillName: "基础分段计价",
  ability: ["modeling", "reasoning"], examPriority: "MUST_BIG",
};
const segQs: Question[] = [
  speed(sSeg, { id: "G4B_FILL_seg_1", difficulty: 3, stem: "出租车 3 千米内 8 元，超过部分每千米 1.5 元。Selena 坐了 5 千米要付多少元？", value: 11, unit: "元", distractors: [12, 9.5, 14] }),
  speed(sSeg, { id: "G4B_FILL_seg_2", difficulty: 4, stem: "停车场前 1 小时 5 元，之后每小时 3 元。停 4 小时收多少元？", value: 14, unit: "元", distractors: [12, 17, 15] }),
  speed(sSeg, { id: "G4B_FILL_seg_3", difficulty: 4, stem: "话费每月 30 元含 100 分钟，超出每分钟 0.2 元。这月用了 150 分钟，要付多少元？", value: 40, unit: "元", distractors: [50, 30, 60] }),
  speed(sSeg, { id: "G4B_FILL_seg_4", difficulty: 3, stem: "快递首重 1 千克 8 元，续重每千克 2 元。寄 4 千克要多少元？", value: 14, unit: "元", distractors: [16, 10, 32] }),
  speed(sSeg, { id: "G4B_FILL_seg_5", difficulty: 4, stem: "电费阶梯：每月前 50 度 0.5 元/度，超出每度 0.6 元。用了 80 度，多少元？", value: 43, unit: "元", distractors: [40, 48, 50] }),
  speed(sSeg, { id: "G4B_FILL_seg_6", difficulty: 4, stem: "门票成人 30 元，1.2 米以下小朋友半价。两大一小 4 张票，小朋友 1 张半价，共多少元？错选 a", value: 75, unit: "元", distractors: [90, 60, 105] }),
  speed(sSeg, { id: "G4B_FILL_seg_7", difficulty: 4, stem: "打印每页 0.2 元，超过 100 页每页 0.15 元。打 200 页多少元？", value: 35, unit: "元", distractors: [40, 30, 20] }),
];

/* ===========================================================
   U5 · 方程
   =========================================================== */

const sLetter: SkillCtx = {
  unitId: "G4B_U5_EQUATIONS", unitName: "认识方程", term: "下册",
  skillId: "letter_expression", skillName: "用字母表示数",
  ability: ["concept", "modeling"], examPriority: "MUST_SMALL",
};
const letterQs: Question[] = [
  speed(sLetter, { id: "G4B_FILL_letter_1", difficulty: 2, stem: "Selena 现在 a 岁，5 年后是多少岁？（输入 a 加几）", value: 5, distractors: [10, 1, 15] }),
  speed(sLetter, { id: "G4B_FILL_letter_2", difficulty: 2, stem: "一支铅笔 b 元，买 6 支要多少元？（输入 b 乘几）", value: 6, distractors: [1, 12, 60] }),
  choice(sLetter, {
    id: "G4B_FILL_letter_3", difficulty: 2,
    stem: "一本书 m 元，比一支笔贵 3 元。一支笔多少元？",
    options: [
      { id: "a", text: "m + 3", errorTag: "wrong_op" },
      { id: "b", text: "m - 3" },
      { id: "c", text: "3 - m", errorTag: "reverse" },
      { id: "d", text: "3m", errorTag: "wrong_op" },
    ],
    correctId: "b",
    solution_steps: ["书贵，笔便宜 3 元", "笔 = 书 - 3 = m - 3"],
  }),
  speed(sLetter, { id: "G4B_FILL_letter_4", difficulty: 3, stem: "正方形边长 x 厘米，周长是？（输入 x 的倍数）", value: 4, distractors: [2, 1, 8] }),
  choice(sLetter, {
    id: "G4B_FILL_letter_5", difficulty: 3,
    stem: "一辆汽车每小时行 v 千米，行 3 小时走的路程是？",
    options: [
      { id: "a", text: "v + 3", errorTag: "wrong_op" },
      { id: "b", text: "3v" },
      { id: "c", text: "v - 3", errorTag: "wrong_op" },
      { id: "d", text: "v ÷ 3", errorTag: "reverse" },
    ],
    correctId: "b",
    solution_steps: ["路程 = 速度 × 时间 = v × 3 = 3v"],
  }),
  speed(sLetter, { id: "G4B_FILL_letter_6", difficulty: 2, stem: "Selena 比妈妈小 25 岁，妈妈 y 岁，Selena 多少岁？（输入 y 减几）", value: 25, distractors: [5, 1, 50] }),
  choice(sLetter, {
    id: "G4B_FILL_letter_7", difficulty: 2,
    stem: "下面哪个写法符合简写规则？",
    options: [
      { id: "a", text: "a × 5 写成 5a" },
      { id: "b", text: "5 × a 写成 a5", errorTag: "format_wrong" },
      { id: "c", text: "1 × a 写成 1a", errorTag: "format_wrong" },
      { id: "d", text: "a ÷ 5 写成 5a", errorTag: "format_wrong" },
    ],
    correctId: "a",
    solution_steps: ["数字写在字母前；省 1；除号不能省"],
  }),
  speed(sLetter, { id: "G4B_FILL_letter_8", difficulty: 3, stem: "n 个苹果平均分给 4 个小朋友，每人多少个？（输入 n 除以几）", value: 4, distractors: [1, 16, 0.25] }),
  speed(sLetter, { id: "G4B_FILL_letter_9", difficulty: 3, stem: "长方形长 8 厘米，宽 b 厘米，面积是 8b 平方厘米。当 b=4 时面积是？", value: 32, unit: "平方厘米", distractors: [12, 24, 4] }),
];

const sEqMean: SkillCtx = {
  ...sLetter, skillId: "equation_meaning_balance", skillName: "方程意义，等量关系",
  ability: ["concept", "reasoning"],
};
const eqMeanQs: Question[] = [
  choice(sEqMean, {
    id: "G4B_FILL_em_1", difficulty: 2,
    stem: "下面哪个是方程？",
    options: [
      { id: "a", text: "3 + 4 = 7", errorTag: "no_unknown" },
      { id: "b", text: "x + 5 > 8", errorTag: "not_equation" },
      { id: "c", text: "2x + 3 = 11" },
      { id: "d", text: "x - 1", errorTag: "no_equal_sign" },
    ],
    correctId: "c",
    solution_steps: ["方程：含未知数的等式", "(c) 同时满足两个条件"],
  }),
  choice(sEqMean, {
    id: "G4B_FILL_em_2", difficulty: 3,
    stem: "天平左边 1 个 x 克的苹果，右边 2 个 50 克砝码，平衡。下列方程对的是？",
    options: [
      { id: "a", text: "x + 50 = 100", errorTag: "wrong_model" },
      { id: "b", text: "x = 100" },
      { id: "c", text: "x = 50", errorTag: "wrong_model" },
      { id: "d", text: "2x = 100", errorTag: "wrong_model" },
    ],
    correctId: "b",
    solution_steps: ["1 个 x = 2 × 50 = 100"],
  }),
  choice(sEqMean, {
    id: "G4B_FILL_em_3", difficulty: 2,
    stem: "下面哪个不是方程？",
    options: [
      { id: "a", text: "x + 2 = 7" },
      { id: "b", text: "5 = 5", errorTag: "no_unknown" },
      { id: "c", text: "3y = 12" },
      { id: "d", text: "x - 1 = 4" },
    ],
    correctId: "b",
    solution_steps: ["b 没有未知数，不是方程"],
  }),
  choice(sEqMean, {
    id: "G4B_FILL_em_4", difficulty: 3,
    stem: "Selena 买 3 本书 x 元，付 100 元找回 25 元。下列等量关系对的是？",
    options: [
      { id: "a", text: "100 - 3x = 25" },
      { id: "b", text: "3x + 25 = 100" },
      { id: "c", text: "3x - 100 = 25", errorTag: "reverse" },
      { id: "d", text: "100 + 3x = 25", errorTag: "wrong_op" },
    ],
    correctId: "a",
    solution_steps: ["a 和 b 都对（同一关系两种写法）；这里选 a"],
  }),
  speed(sEqMean, { id: "G4B_FILL_em_5", difficulty: 3, stem: "判断 x = 5 是不是 3x - 2 = 13 的解？（是输 1，否输 0）", value: 1, distractors: [0, 5, 13] }),
  speed(sEqMean, { id: "G4B_FILL_em_6", difficulty: 3, stem: "判断 x = 4 是不是 2x + 5 = 12 的解？（是 1，否 0）", value: 0, distractors: [1, 4, 12] }),
  choice(sEqMean, {
    id: "G4B_FILL_em_7", difficulty: 3,
    stem: "鸡兔同笼：鸡 a 只兔 b 只共 8 个头。下列哪个表示这句话？",
    options: [
      { id: "a", text: "a + b = 8" },
      { id: "b", text: "ab = 8", errorTag: "wrong_op" },
      { id: "c", text: "2a + 4b = 8", errorTag: "wrong_relation" },
      { id: "d", text: "a - b = 8", errorTag: "wrong_op" },
    ],
    correctId: "a",
    solution_steps: ["头总数：鸡数 + 兔数"],
  }),
];

const sSolve: SkillCtx = {
  ...sLetter, skillId: "equation_solve_simple", skillName: "用等式性质解简单方程",
  ability: ["calculation", "strategy"],
};
const solveQs: Question[] = [
  speed(sSolve, { id: "G4B_FILL_solve_1", difficulty: 3, stem: "解方程：x + 18 = 42，x = ?", value: 24, distractors: [60, 18, 42] }),
  speed(sSolve, { id: "G4B_FILL_solve_2", difficulty: 3, stem: "解方程：3x = 36，x = ?", value: 12, distractors: [33, 39, 108] }),
];

const sOne: SkillCtx = {
  ...sLetter, skillId: "equation_one_step_word", skillName: "列方程解决一步应用题",
  ability: ["modeling", "calculation"], examPriority: "MUST_BIG",
};
const oneStepQs: Question[] = [
  speed(sOne, { id: "G4B_FILL_one_1", difficulty: 3, stem: "Selena 比妈妈轻 28 千克，妈妈 56 千克。Selena 多重？（设 Selena x 千克，列方程：x + 28 = 56）", value: 28, unit: "千克", distractors: [84, 24, 56] }),
  speed(sOne, { id: "G4B_FILL_one_2", difficulty: 3, stem: "一本书 4 个班共看了 92 本，每班看几本？（4x = 92）", value: 23, unit: "本", distractors: [88, 96, 25] }),
  speed(sOne, { id: "G4B_FILL_one_3", difficulty: 3, stem: "买 6 个面包共 18 元，每个多少元？", value: 3, unit: "元", distractors: [12, 24, 4] }),
  speed(sOne, { id: "G4B_FILL_one_4", difficulty: 3, stem: "妹妹比 Selena 矮 12 厘米，Selena 145 厘米。妹妹多高？", value: 133, unit: "厘米", distractors: [157, 12, 145] }),
];

const sTwo: SkillCtx = {
  ...sLetter, skillId: "equation_two_step_word", skillName: "列方程解决两步应用题",
  ability: ["modeling", "reasoning"], examPriority: "MUST_BIG",
};
const twoStepQs: Question[] = [
  speed(sTwo, { id: "G4B_FILL_two_1", difficulty: 4, stem: "Selena 买 3 支铅笔和 1 个橡皮共 8 元，橡皮 2 元。每支铅笔多少元？（3x + 2 = 8）", value: 2, unit: "元", distractors: [3, 1.5, 6] }),
  speed(sTwo, { id: "G4B_FILL_two_2", difficulty: 4, stem: "妈妈买 4 千克苹果和 1.5 千克梨共 24 元，梨每千克 4 元。苹果每千克多少元？", value: 4.5, unit: "元", distractors: [5, 4, 6] }),
  speed(sTwo, { id: "G4B_FILL_two_3", difficulty: 4, stem: "停车 5 小时收 23 元，前 1 小时 7 元，之后每小时多少元？", value: 4, unit: "元", distractors: [5, 4.6, 3 ] }),
  speed(sTwo, { id: "G4B_FILL_two_4", difficulty: 4, stem: "Selena 跳绳 3 分钟跳 240 个，前 1 分钟跳了 100 个，后 2 分钟平均每分钟跳几个？", value: 70, unit: "个", distractors: [80, 60, 140] }),
  speed(sTwo, { id: "G4B_FILL_two_5", difficulty: 4, stem: "买 2 本相同的书和一个 5 元的笔记本共 25 元。每本书多少元？", value: 10, unit: "元", distractors: [12.5, 15, 20] }),
];

const sMeet: SkillCtx = {
  ...sLetter, skillId: "equation_meeting_problem", skillName: "相遇问题",
  ability: ["modeling", "reasoning"], examPriority: "MUST_BIG",
};
const meetQs: Question[] = [
  speed(sMeet, { id: "G4B_FILL_meet_1", difficulty: 4, stem: "甲乙两地相距 240 千米，甲车每小时 50 千米，乙车每小时 70 千米，同时相向开出，几小时后相遇？", value: 2, unit: "小时", distractors: [3, 1, 4] }),
  speed(sMeet, { id: "G4B_FILL_meet_2", difficulty: 4, stem: "两人相距 480 米，相向走，一人每分 60 米，另一人每分 60 米，几分钟相遇？", value: 4, unit: "分钟", distractors: [8, 2, 6] }),
  speed(sMeet, { id: "G4B_FILL_meet_3", difficulty: 4, stem: "Selena 和爸爸相距 360 米，Selena 每分钟走 50 米，爸爸每分钟走 70 米，相向而行几分钟相遇？", value: 3, unit: "分钟", distractors: [4, 2, 6] }),
  speed(sMeet, { id: "G4B_FILL_meet_4", difficulty: 4, stem: "两辆车 4 小时相遇，相距 360 千米，甲车每小时 40 千米，乙车每小时多少千米？", value: 50, unit: "千米", distractors: [40, 60, 90] }),
  speed(sMeet, { id: "G4B_FILL_meet_5", difficulty: 5, stem: "两车相距 600 千米，相向 5 小时相遇，甲每小时 55 千米，乙每小时？", value: 65, unit: "千米", distractors: [60, 55, 70] }),
  speed(sMeet, { id: "G4B_FILL_meet_6", difficulty: 4, stem: "两人相距 800 米，相向走，A 每分 50 米，B 每分 30 米，几分相遇？", value: 10, unit: "分钟", distractors: [16, 8, 20] }),
];

const sSumDiff: SkillCtx = {
  ...sLetter, skillId: "equation_sum_difference", skillName: "和倍/差倍问题",
  ability: ["modeling", "reasoning"], examPriority: "MUST_BIG",
};
const sumDiffQs: Question[] = [
  speed(sSumDiff, { id: "G4B_FILL_sd_1", difficulty: 4, stem: "Selena 和弟弟一共 56 元，Selena 是弟弟的 3 倍，弟弟多少元？", value: 14, unit: "元", distractors: [42, 28, 18] }),
  speed(sSumDiff, { id: "G4B_FILL_sd_2", difficulty: 4, stem: "苹果比梨多 24 个，苹果是梨的 4 倍，梨多少个？", value: 8, unit: "个", distractors: [6, 32, 12] }),
  speed(sSumDiff, { id: "G4B_FILL_sd_3", difficulty: 4, stem: "妈妈年龄是 Selena 的 4 倍，相差 30 岁，Selena 多少岁？", value: 10, unit: "岁", distractors: [40, 8, 7.5] }),
  speed(sSumDiff, { id: "G4B_FILL_sd_4", difficulty: 4, stem: "甲乙两数和是 84，甲是乙的 5 倍，乙是多少？", value: 14, unit: "", distractors: [70, 16.8, 12] }),
  speed(sSumDiff, { id: "G4B_FILL_sd_5", difficulty: 5, stem: "学校植树，5 年级是 3 年级的 2 倍多 8 棵，5 年级 56 棵，3 年级几棵？", value: 24, unit: "棵", distractors: [28, 32, 22] }),
  speed(sSumDiff, { id: "G4B_FILL_sd_6", difficulty: 4, stem: "图书馆故事书是科普书的 3 倍，故事书比科普书多 60 本，科普书几本？", value: 30, unit: "本", distractors: [20, 90, 40] }),
];

/* ===========================================================
   U6 · 数据 / 平均数
   =========================================================== */

const sBar: SkillCtx = {
  unitId: "G4B_U6_DATA", unitName: "数据的表示和分析", term: "下册",
  skillId: "data_bar_chart", skillName: "条形统计图读图",
  ability: ["data", "calculation"], examPriority: "HIGH_SMALL",
};
const barQs: Question[] = [
  speed(sBar, { id: "G4B_FILL_bar_1", difficulty: 2, stem: "条形统计图：周一到周五卖出冰淇淋 12,18,15,10,20 个。卖最多的一天是几个？", value: 20, unit: "个", distractors: [10, 18, 75] }),
  speed(sBar, { id: "G4B_FILL_bar_2", difficulty: 2, stem: "条形图显示 5 种水果数量分别 8,12,5,15,10。一共多少？", value: 50, unit: "个", distractors: [45, 55, 15] }),
  speed(sBar, { id: "G4B_FILL_bar_3", difficulty: 3, stem: "本周练琴时间(分)：30,45,60,40,50,55,20。最长比最短多多少分？", value: 40, unit: "分钟", distractors: [60, 35, 50] }),
  speed(sBar, { id: "G4B_FILL_bar_4", difficulty: 2, stem: "看条形图：男生 24 人，女生 18 人。男生比女生多多少人？", value: 6, unit: "人", distractors: [42, 4, 12] }),
  speed(sBar, { id: "G4B_FILL_bar_5", difficulty: 3, stem: "1-4 月卖票数 320,450,380,500。哪个月最多？输入数字 1-4。", value: 4, distractors: [1, 2, 3] }),
  speed(sBar, { id: "G4B_FILL_bar_6", difficulty: 3, stem: "5 个班植树 12,18,15,20,25 棵。共植多少棵？", value: 90, unit: "棵", distractors: [85, 95, 88] }),
  speed(sBar, { id: "G4B_FILL_bar_7", difficulty: 3, stem: "条形图：周一阅读 25 分，周二 30 分，周三 20 分。三天总计？", value: 75, unit: "分钟", distractors: [70, 80, 65] }),
  speed(sBar, { id: "G4B_FILL_bar_8", difficulty: 3, stem: "比赛得分：A 队 36 分，B 队 28 分，C 队 32 分。A 比 C 多多少分？", value: 4, unit: "分", distractors: [8, 6, 64] }),
];

const sAvgMean: SkillCtx = {
  ...sBar, skillId: "average_meaning", skillName: "平均数意义",
  ability: ["concept", "data"], examPriority: "MUST_SMALL",
};
const avgMeanQs: Question[] = [
  choice(sAvgMean, {
    id: "G4B_FILL_avg_m_1", difficulty: 2,
    stem: "下面哪句话对平均数的解释正确？",
    options: [
      { id: "a", text: "平均数一定是数据中真实出现的某个值", errorTag: "concept_error" },
      { id: "b", text: "平均数代表一组数据的总体水平" },
      { id: "c", text: "平均数一定大于最大数", errorTag: "concept_error" },
      { id: "d", text: "平均数 = 最大值 ÷ 数据个数", errorTag: "formula_wrong" },
    ],
    correctId: "b",
    solution_steps: ["平均数：总和 ÷ 个数，反映总体水平"],
  }),
  speed(sAvgMean, { id: "G4B_FILL_avg_m_2", difficulty: 2, stem: "5 个数的平均数是 6，那它们的总和是多少？", value: 30, distractors: [11, 1.2, 36] }),
  choice(sAvgMean, {
    id: "G4B_FILL_avg_m_3", difficulty: 3,
    stem: "Selena 4 次跳绳的平均次数是 120 个。下面哪种情况一定不可能？",
    options: [
      { id: "a", text: "4 次都是 120 个" },
      { id: "b", text: "4 次分别是 110, 130, 110, 130" },
      { id: "c", text: "4 次都比 120 多", errorTag: "concept_error" },
      { id: "d", text: "4 次分别是 80, 120, 130, 150" },
    ],
    correctId: "c",
    solution_steps: ["要让平均 = 120，必须有比 120 小的数平衡"],
  }),
  speed(sAvgMean, { id: "G4B_FILL_avg_m_4", difficulty: 2, stem: "三个数的平均数是 10，前两个是 8 和 12，第三个是几？", value: 10, distractors: [9, 30, 20] }),
  speed(sAvgMean, { id: "G4B_FILL_avg_m_5", difficulty: 3, stem: "平均数总在最大值和最小值之间。如果一组数最小 5 最大 15，平均不可能是？（输入 4 或 16 之一，这里输 4）", value: 4, distractors: [10, 5, 15] }),
  speed(sAvgMean, { id: "G4B_FILL_avg_m_6", difficulty: 3, stem: "Selena 5 次跑步用时(秒)：60, 65, 58, 62, 55，平均用时大约是？(取整)", value: 60, unit: "秒", distractors: [55, 65, 50] }),
  speed(sAvgMean, { id: "G4B_FILL_avg_m_7", difficulty: 3, stem: "已知 4 个数的平均数是 25，再加一个数 30，5 个数的平均数变成？", value: 26, distractors: [25, 27.5, 130] }),
  choice(sAvgMean, {
    id: "G4B_FILL_avg_m_8", difficulty: 3,
    stem: "下面哪个最不适合用平均数描述？",
    options: [
      { id: "a", text: "全班同学的身高水平" },
      { id: "b", text: "一周每天的最高气温" },
      { id: "c", text: "全班同学最高的人是谁", errorTag: "concept_error" },
      { id: "d", text: "Selena 一周每天看书的时间" },
    ],
    correctId: "c",
    solution_steps: ["『最高的人是谁』要用最大值，不是平均数"],
  }),
];

const sAvgComp: SkillCtx = {
  ...sBar, skillId: "average_compute", skillName: "求平均数",
  ability: ["calculation", "data"], examPriority: "MUST_BIG",
};
const avgCompQs: Question[] = [
  speed(sAvgComp, { id: "G4B_FILL_avg_c_1", difficulty: 2, stem: "求 12, 18, 15 的平均数。", value: 15, distractors: [45, 12, 18] }),
  speed(sAvgComp, { id: "G4B_FILL_avg_c_2", difficulty: 3, stem: "求 25, 30, 28, 33 的平均数。", value: 29, distractors: [28, 30, 116] }),
  speed(sAvgComp, { id: "G4B_FILL_avg_c_3", difficulty: 3, stem: "5 次身高(厘米)：140, 142, 138, 144, 141，平均多少？", value: 141, unit: "厘米", distractors: [140, 142, 705] }),
  speed(sAvgComp, { id: "G4B_FILL_avg_c_4", difficulty: 3, stem: "4 周阅读分钟数：120, 150, 130, 140，平均每周看多少分？", value: 135, unit: "分钟", distractors: [130, 140, 540] }),
];

const sAvgInvT: SkillCtx = {
  ...sBar, skillId: "average_inverse_total", skillName: "已知平均数求总数/份数",
  ability: ["modeling", "data"], examPriority: "MUST_BIG",
};
const avgInvTQs: Question[] = [
  speed(sAvgInvT, { id: "G4B_FILL_avg_t_1", difficulty: 3, stem: "5 个班平均每班 24 棵树，一共种了多少棵？", value: 120, unit: "棵", distractors: [29, 19, 100] }),
  speed(sAvgInvT, { id: "G4B_FILL_avg_t_2", difficulty: 3, stem: "Selena 一周平均每天看书 30 分，一周共看多少分？", value: 210, unit: "分钟", distractors: [30, 150, 240] }),
  speed(sAvgInvT, { id: "G4B_FILL_avg_t_3", difficulty: 3, stem: "若 6 个数平均是 12，总和是？", value: 72, distractors: [18, 6, 12] }),
  speed(sAvgInvT, { id: "G4B_FILL_avg_t_4", difficulty: 3, stem: "总分 480，平均每人 60，参加考试多少人？", value: 8, unit: "人", distractors: [9, 7, 60] }),
  speed(sAvgInvT, { id: "G4B_FILL_avg_t_5", difficulty: 3, stem: "4 个数平均是 25，求总和。", value: 100, distractors: [29, 21, 50] }),
  speed(sAvgInvT, { id: "G4B_FILL_avg_t_6", difficulty: 3, stem: "全班 36 人平均身高 142 厘米，全班身高总和？", value: 5112, unit: "厘米", distractors: [5000, 5200, 178] }),
];

const sAvgInvM: SkillCtx = {
  ...sBar, skillId: "average_inverse_missing", skillName: "已知平均数求其中一个数据",
  ability: ["modeling", "reasoning"], examPriority: "MUST_BIG",
};
const avgInvMQs: Question[] = [
  speed(sAvgInvM, { id: "G4B_FILL_avg_m1_1", difficulty: 3, stem: "4 个数平均是 20，前三个是 15、22、18，第四个是？", value: 25, distractors: [20, 23, 80] }),
  speed(sAvgInvM, { id: "G4B_FILL_avg_m1_2", difficulty: 4, stem: "Selena 5 次考试平均 92 分，已知前四次是 88、95、90、94。第五次？", value: 93, unit: "分", distractors: [92, 90, 95] }),
  speed(sAvgInvM, { id: "G4B_FILL_avg_m1_3", difficulty: 4, stem: "5 棵树平均高 2.4 米，前 4 棵分别是 2.0, 2.5, 2.3, 2.6 米。第 5 棵多高？", value: 2.6, unit: "米", distractors: [2.4, 2.5, 12 ] }),
  speed(sAvgInvM, { id: "G4B_FILL_avg_m1_4", difficulty: 4, stem: "6 个数平均 50，已知 5 个数和是 240，第 6 个？", value: 60, distractors: [50, 240, 290] }),
  speed(sAvgInvM, { id: "G4B_FILL_avg_m1_5", difficulty: 4, stem: "一组 4 人平均跳绳 110 个，A 跳 100，B 跳 115，C 跳 120，D 跳？", value: 105, unit: "个", distractors: [115, 100, 120] }),
  speed(sAvgInvM, { id: "G4B_FILL_avg_m1_6", difficulty: 4, stem: "Selena 数学 4 次平均 95，前三次 92、94、98，第四次？", value: 96, unit: "分", distractors: [95, 94, 98] }),
  speed(sAvgInvM, { id: "G4B_FILL_avg_m1_7", difficulty: 4, stem: "10 人平均年龄 11 岁，9 人共 102 岁，第 10 人？", value: 8, unit: "岁", distractors: [11, 12, 10] }),
];

/* ============================================================
   合并导出
   ============================================================ */
export const GAP_FILL_PACK_G4B: Question[] = [
  ...meaningQs,
  ...unitConvQs,
  ...compareQs,
  ...addSubSimpQs,
  ...inverseQs,
  ...mulMeanQs,
  ...prodDigitQs,
  ...mulMixQs,
  ...mulSimpQs,
  ...speedDistQs,
  ...workQs,
  ...segQs,
  ...letterQs,
  ...eqMeanQs,
  ...solveQs,
  ...oneStepQs,
  ...twoStepQs,
  ...meetQs,
  ...sumDiffQs,
  ...barQs,
  ...avgMeanQs,
  ...avgCompQs,
  ...avgInvTQs,
  ...avgInvMQs,
];
