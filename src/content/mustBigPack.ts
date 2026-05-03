/**
 * 期中 must-big skill 题量补强包（v0.9）
 *
 * 针对题量 < 5 的 MUST_BIG skill，每个补 3-5 道，让期中冲刺不至于
 * 反复出同 1-2 题。
 *
 * 重点 skill：
 *   - decimal_add_sub_simplify  (小数加减简便)
 *   - decimal_inverse_problem   (逆向应用题)
 *   - decimal_work_total / decimal_segment_pricing (工作量/分段)
 *   - equation_one_step_word    (列方程一步)
 *   - equation_two_step_word    (列方程两步)
 *   - equation_meeting_problem  (相遇问题)
 *   - equation_sum_difference   (和倍/差倍)
 *   - average_inverse_total / average_inverse_missing
 *
 * 这些题都是原创、生活化场景、避免出现敏感词。
 */

import type { AbilityId, ExamPriority, Hint, Question, GameTemplate, SubQuestion } from "../core/types";

const base = {
  version: 1 as const,
  status: "approved" as const,
  grade: 4 as const,
  source: {
    curriculum: "BNU_2013_G4",
    basis: "must_big_fillin_v09",
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

interface Skill {
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
  parent_tip?: string;
  tags?: string[];
  playAs?: GameTemplate;
}

function speed(s: Skill, q: NumQ): Question {
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
    hints: q.hints ?? [{ text: "分两步：先做什么，再做什么", penalty: 1 }],
    common_errors: [
      { tag: "careless_reading", error: "读题没读完", remediation: "重读一遍。" },
      { tag: "decimal_point_error", error: "小数点位置错", remediation: "整数算完再点回小数点。" },
    ],
    feedback_correct: q.feedback_correct ?? "干得漂亮！",
    feedback_wrong: q.feedback_wrong ?? "再想想——题目里关键的数字是哪几个？",
    parent_tip: q.parent_tip,
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
  parent_tip?: string;
  time?: number;
  tags?: string[];
}

function app(s: Skill, q: AppQ): Question {
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
      { tag: "relation_model_error", error: "数量关系搞错", remediation: "先口头说一句『X 等于什么乘什么』。" },
      { tag: "careless_reading", error: "看错题", remediation: "再读一遍题目。" },
    ],
    feedback_correct: "解得漂亮！",
    feedback_wrong: "没关系，再捋一遍思路。",
    parent_tip: q.parent_tip,
    tags: q.tags,
  };
}

/* ---------------- 小数加减简便 ---------------- */
const sDasSimp: Skill = {
  unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法", term: "下册",
  skillId: "decimal_add_sub_simplify", skillName: "小数加减简便计算",
  ability: ["strategy", "calculation"], examPriority: "MUST_BIG",
};

/* ---------------- 小数加减逆向 ---------------- */
const sDasInv: Skill = { ...sDasSimp, skillId: "decimal_inverse_problem", skillName: "已知和/差求未知量", ability: ["modeling", "reasoning"] };

/* ---------------- 小数乘 - 工程量 / 分段 ---------------- */
const sDmWork: Skill = {
  unitId: "G4B_U3_DECIMAL_MULTIPLY", unitName: "小数乘法", term: "下册",
  skillId: "decimal_work_total", skillName: "工程量/产量合计",
  ability: ["modeling", "calculation"], examPriority: "MUST_BIG",
};
const sDmSeg: Skill = { ...sDmWork, skillId: "decimal_segment_pricing", skillName: "基础分段计价", ability: ["modeling", "reasoning"] };
const sDmSpd: Skill = { ...sDmWork, skillId: "decimal_speed_distance", skillName: "路程=速度×时间" };

/* ---------------- 方程组 ---------------- */
const sEq1: Skill = {
  unitId: "G4B_U5_EQUATIONS", unitName: "认识方程", term: "下册",
  skillId: "equation_one_step_word", skillName: "列方程一步应用题",
  ability: ["modeling", "calculation"], examPriority: "MUST_BIG",
};
const sEq2: Skill = { ...sEq1, skillId: "equation_two_step_word", skillName: "列方程两步应用题", ability: ["modeling", "reasoning"] };
const sEqMt: Skill = { ...sEq1, skillId: "equation_meeting_problem", skillName: "相遇问题", ability: ["modeling", "reasoning"] };
const sEqSd: Skill = { ...sEq1, skillId: "equation_sum_difference", skillName: "和倍/差倍问题", ability: ["modeling", "reasoning"] };

/* ---------------- 平均数逆向 ---------------- */
const sAvgT: Skill = {
  unitId: "G4B_U6_DATA", unitName: "数据的表示和分析", term: "下册",
  skillId: "average_inverse_total", skillName: "已知平均数求总数/份数",
  ability: ["modeling", "data"], examPriority: "MUST_BIG",
};
const sAvgM: Skill = { ...sAvgT, skillId: "average_inverse_missing", skillName: "已知平均数求其中一数", ability: ["modeling", "reasoning"] };

export const MUST_BIG_PACK: Question[] = [
  // ============= 小数加减简便 (5 道) =============
  speed(sDasSimp, {
    id: "MB_dass_1", difficulty: 3,
    stem: "12.7 + 5.6 + 7.3 = ?（凑整简便）",
    value: 25.6, distractors: [25.5, 24.6, 26.6],
    hints: [{ text: "12.7 + 7.3 凑成 20", penalty: 1 }],
  }),
  speed(sDasSimp, {
    id: "MB_dass_2", difficulty: 3,
    stem: "8.9 + 4.6 − 3.9 = ?（重排简便）",
    value: 9.6, distractors: [9.4, 9.0, 10.6],
    hints: [{ text: "把同小数末位的凑一起：8.9 − 3.9 + 4.6", penalty: 1 }],
  }),
  speed(sDasSimp, {
    id: "MB_dass_3", difficulty: 4,
    stem: "9.85 − 2.6 − 0.85 = ?（先减容易凑整的）",
    value: 6.4, distractors: [7.25, 6.0, 5.4],
    hints: [{ text: "9.85 − 0.85 = 9，再减 2.6", penalty: 1 }],
  }),
  speed(sDasSimp, {
    id: "MB_dass_4", difficulty: 3,
    stem: "0.7 + 1.4 + 1.3 + 0.6 = ?（两两凑整）",
    value: 4.0, distractors: [3.9, 4.1, 3.0],
    hints: [{ text: "0.7+1.3=2，1.4+0.6=2", penalty: 1 }],
  }),
  speed(sDasSimp, {
    id: "MB_dass_5", difficulty: 4,
    stem: "5.43 + 2.9 − 1.43 = ?",
    value: 6.9, distractors: [6.0, 7.9, 4.0],
    hints: [{ text: "5.43 − 1.43 = 4，再加 2.9", penalty: 1 }],
  }),

  // ============= 小数加减逆向 (5 道) =============
  app(sDasInv, {
    id: "MB_dasi_1", difficulty: 3,
    stem: "妈妈买苹果用了 23.5 元，付出 50 元，找回多少元？",
    clues: ["妈妈买苹果用了 23.5 元", "妈妈喜欢吃苹果", "付出 50 元", "苹果店在小区门口"],
    correctClueIdx: [0, 2],
    relationshipChoices: [
      { id: "A", text: "找回 = 付出 − 用去", correct: true },
      { id: "B", text: "找回 = 付出 + 用去", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "找回 = 用去 − 付出", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "找回多少元？",
    finalValue: 26.5, finalUnit: "元", finalDistractors: [73.5, 26, 27],
    expression: "50 − 23.5 = 26.5",
    solution_steps: ["50 − 23.5 = 26.5 元"],
    parent_tip: "经典找零问题。让她口头说一句『差 = 付出 − 用去』再列式。",
  }),
  app(sDasInv, {
    id: "MB_dasi_2", difficulty: 4,
    stem: "Selena 跳绳两周一共跳了 1248 个，第一周比第二周少跳 156 个。第二周跳了多少个？",
    clues: ["两周一共跳了 1248 个", "第一周比第二周少跳 156 个", "Selena 喜欢跳绳", "跳绳一根 25 元"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "(总数 + 差) ÷ 2", correct: true },
      { id: "B", text: "(总数 − 差) ÷ 2", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "总数 ÷ 2", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "第二周跳了多少个？",
    finalValue: 702, finalUnit: "个", finalDistractors: [546, 624, 1092],
    expression: "(1248 + 156) ÷ 2 = 702",
    solution_steps: ["和差问题：大数 = (和 + 差) ÷ 2", "(1248+156)÷2 = 1404÷2 = 702"],
    parent_tip: "和差问题模型——题面提到『一共』+『谁比谁多/少』就是这套。",
  }),
  app(sDasInv, {
    id: "MB_dasi_3", difficulty: 3,
    stem: "一根绳子第一段 2.6 米，第二段 1.8 米，剩下 0.6 米。这根绳子原来多长？",
    clues: ["第一段 2.6 米", "第二段 1.8 米", "剩下 0.6 米", "绳子是新买的"],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "总长 = 用过 + 剩下", correct: true },
      { id: "B", text: "总长 = 用过 − 剩下", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "原来绳子多长？",
    finalValue: 5, finalUnit: "米", finalDistractors: [4.4, 5.6, 4.8],
    expression: "2.6 + 1.8 + 0.6 = 5",
    solution_steps: ["所有部分加起来"],
  }),
  app(sDasInv, {
    id: "MB_dasi_4", difficulty: 4,
    stem: "兔子和小狗一共重 18.4 千克，兔子比小狗轻 5.6 千克。兔子重多少千克？",
    clues: ["一共重 18.4 千克", "兔子比小狗轻 5.6 千克", "兔子毛是白色", "小狗喜欢晒太阳"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "小数 = (和 − 差) ÷ 2", correct: true },
      { id: "B", text: "小数 = (和 + 差) ÷ 2", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "兔子多重？",
    finalValue: 6.4, finalUnit: "千克", finalDistractors: [12, 11.4, 9.2],
    expression: "(18.4 − 5.6) ÷ 2 = 6.4",
    solution_steps: ["(18.4−5.6)÷2 = 12.8÷2 = 6.4"],
  }),
  speed(sDasInv, {
    id: "MB_dasi_5", difficulty: 2,
    stem: "X 比 8.5 多 3.6，X = ?",
    value: 12.1, distractors: [4.9, 11.1, 13.1],
  }),

  // ============= 工程量 / 分段 (5 道) =============
  app(sDmWork, {
    id: "MB_work_1", difficulty: 3,
    stem: "工厂每小时生产零件 28.5 个，连续生产 6 小时，一共生产多少个？",
    clues: ["每小时生产 28.5 个", "连续 6 小时", "工厂在郊区", "工人很认真"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "总产量 = 每小时产量 × 时间", correct: true },
      { id: "B", text: "总产量 = 每小时产量 + 时间", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "一共生产多少个？",
    finalValue: 171, finalUnit: "个", finalDistractors: [34.5, 285, 17.1],
    expression: "28.5 × 6 = 171",
    solution_steps: ["28.5 × 6 = 171 个"],
  }),
  app(sDmWork, {
    id: "MB_work_2", difficulty: 3,
    stem: "妈妈在菜地浇水，每天浇 4.5 千克水。一周浇多少千克水？",
    clues: ["每天浇 4.5 千克", "一周 7 天", "菜地 5 平方米", "妈妈早上去"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "总量 = 每天的量 × 天数", correct: true },
      { id: "B", text: "总量 = 每天的量 + 天数", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "一周浇多少千克？",
    finalValue: 31.5, finalUnit: "千克", finalDistractors: [11.5, 31, 32.5],
    expression: "4.5 × 7 = 31.5",
    solution_steps: ["4.5 × 7 = 31.5 千克"],
  }),
  speed(sDmWork, {
    id: "MB_work_3", difficulty: 3,
    stem: "一台打印机每分钟打印 12.5 张纸，1.6 分钟打多少张？",
    value: 20, unit: "张", distractors: [2, 200, 14.1],
    hints: [{ text: "12.5 × 1.6", penalty: 1 }],
  }),

  app(sDmSeg, {
    id: "MB_seg_1", difficulty: 4,
    stem: "出租车起步价 9 元（前 3 千米），之后每千米 2.5 元。妈妈坐到 8 千米共付多少元？",
    clues: ["起步价 9 元", "起步价含 3 千米", "之后每千米 2.5 元", "总路程 8 千米"],
    correctClueIdx: [0, 2, 3],
    relationshipChoices: [
      { id: "A", text: "总价 = 起步价 + (总路程 − 3) × 单价", correct: true },
      { id: "B", text: "总价 = 起步价 + 总路程 × 单价", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "总价 = 总路程 × 单价", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "一共付多少元？",
    finalValue: 21.5, finalUnit: "元", finalDistractors: [29, 20, 14],
    expression: "9 + (8−3) × 2.5 = 21.5",
    solution_steps: ["超出 3 千米的部分 = 8−3=5 千米", "5 × 2.5 = 12.5", "9 + 12.5 = 21.5"],
    parent_tip: "分段计价的关键：分清「起步段」和「后续段」。她答错往往是把整个 8 千米都算 2.5 元。",
  }),
  app(sDmSeg, {
    id: "MB_seg_2", difficulty: 4,
    stem: "停车场前 1 小时 5 元，超出每小时 3.5 元。爸爸停了 4 小时，一共付多少元？",
    clues: ["前 1 小时 5 元", "超出每小时 3.5 元", "停了 4 小时", "停车场在商场地下"],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "5 + (4 − 1) × 3.5", correct: true },
      { id: "B", text: "4 × 3.5", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "一共多少元？",
    finalValue: 15.5, finalUnit: "元", finalDistractors: [14, 19, 17.5],
    expression: "5 + 3 × 3.5 = 15.5",
    solution_steps: ["超出 3 小时", "3 × 3.5 = 10.5", "5 + 10.5 = 15.5"],
  }),

  // ============= 速度 / 路程 / 时间 (2 道) =============
  speed(sDmSpd, {
    id: "MB_spd_1", difficulty: 3,
    stem: "汽车每小时行 60.5 千米，3 小时行多少千米？",
    value: 181.5, unit: "千米", distractors: [180, 63.5, 21.5],
  }),
  app(sDmSpd, {
    id: "MB_spd_2", difficulty: 4,
    stem: "兔子每分钟跑 280 米，乌龟每分钟爬 6.5 米。兔子跑 0.5 分钟比乌龟多走多少米？",
    clues: ["兔子每分钟 280 米", "乌龟每分钟 6.5 米", "兔子跑 0.5 分钟", "比赛在草地上"],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "差距 = 兔子的路程 − 乌龟的路程", correct: true },
      { id: "B", text: "差距 = 兔子的路程 + 乌龟的路程", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "兔子比乌龟多走多少米？",
    finalValue: 136.75, finalUnit: "米", finalDistractors: [143.25, 273.5, 6.75],
    expression: "280×0.5 − 6.5×0.5 = 140 − 3.25 = 136.75",
    solution_steps: ["兔子：280×0.5=140 米", "乌龟：6.5×0.5=3.25 米", "差：140 − 3.25 = 136.75 米"],
  }),

  // ============= 列方程一步 (5 道) =============
  speed(sEq1, {
    id: "MB_eq1_1", difficulty: 3,
    stem: "x + 2.6 = 8.4，x = ?",
    value: 5.8, distractors: [11, 6.2, 5.6],
    playAs: "balance_lab",
    tags: ["eq:x+2.6=8.4"],
  }),
  speed(sEq1, {
    id: "MB_eq1_2", difficulty: 3,
    stem: "x − 1.5 = 4.7，x = ?",
    value: 6.2, distractors: [3.2, 5.7, 6.0],
    playAs: "balance_lab",
    tags: ["eq:x-1.5=4.7"],
  }),
  speed(sEq1, {
    id: "MB_eq1_3", difficulty: 3,
    stem: "3x = 18.6，x = ?",
    value: 6.2, distractors: [15.6, 21.6, 5.6],
    playAs: "balance_lab",
    tags: ["eq:3x=18.6"],
  }),
  speed(sEq1, {
    id: "MB_eq1_4", difficulty: 3,
    stem: "x ÷ 5 = 4.2，x = ?",
    value: 21, distractors: [0.84, 9.2, 20],
    playAs: "balance_lab",
    tags: ["eq:x/5=4.2"],
  }),
  app(sEq1, {
    id: "MB_eq1_5", difficulty: 4,
    stem: "一袋牛奶比一袋酸奶贵 3.6 元。牛奶 12.5 元一袋。酸奶多少元一袋？（设酸奶 x 元，列方程）",
    clues: ["牛奶比酸奶贵 3.6 元", "牛奶 12.5 元", "妈妈买了 2 袋酸奶", "牛奶在冰柜里"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "x + 3.6 = 12.5", correct: true },
      { id: "B", text: "x − 3.6 = 12.5", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "x × 3.6 = 12.5", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "酸奶多少元？",
    finalValue: 8.9, finalUnit: "元", finalDistractors: [16.1, 9.1, 8.5],
    expression: "x + 3.6 = 12.5 → x = 12.5 − 3.6 = 8.9",
    solution_steps: ["牛奶 = 酸奶 + 3.6", "x + 3.6 = 12.5", "x = 8.9 元"],
  }),

  // ============= 列方程两步 (4 道) =============
  app(sEq2, {
    id: "MB_eq2_1", difficulty: 4,
    stem: "买 3 支水彩笔和 1 个橡皮共 18.5 元。橡皮 2 元，水彩笔每支多少元？（设每支 x 元）",
    clues: ["3 支水彩笔 + 1 个橡皮 = 18.5", "橡皮 2 元", "笔是新的", "Selena 喜欢画画"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "3x + 2 = 18.5", correct: true },
      { id: "B", text: "3x − 2 = 18.5", correct: false, errorTag: "relation_model_error" },
      { id: "C", text: "x + 2 = 18.5", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "每支水彩笔多少元？",
    finalValue: 5.5, finalUnit: "元", finalDistractors: [6.83, 6.5, 4.5],
    expression: "3x + 2 = 18.5 → x = 5.5",
    solution_steps: ["3x = 18.5 − 2 = 16.5", "x = 16.5 ÷ 3 = 5.5 元"],
  }),
  app(sEq2, {
    id: "MB_eq2_2", difficulty: 4,
    stem: "Selena 比哥哥小 4 岁，她和哥哥年龄之和是 22。哥哥几岁？（设哥哥 x 岁）",
    clues: ["Selena 比哥哥小 4 岁", "年龄之和 22", "Selena 上 4 年级", "哥哥喜欢踢球"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "x + (x − 4) = 22", correct: true },
      { id: "B", text: "x + (x + 4) = 22", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "哥哥几岁？",
    finalValue: 13, finalUnit: "岁", finalDistractors: [9, 11, 18],
    expression: "x + (x−4) = 22 → 2x = 26 → x = 13",
    solution_steps: ["设哥哥 x 岁，Selena = x − 4", "x + x − 4 = 22", "2x = 26，x = 13 岁"],
  }),
  app(sEq2, {
    id: "MB_eq2_3", difficulty: 4,
    stem: "Selena 跳绳一周（每天都跳）一共跳了 532 个。前 5 天每天 70 个，后 2 天每天跳多少个？（设后 2 天每天 x 个）",
    clues: ["一周共 532 个", "前 5 天每天 70 个", "后 2 天每天 x 个", "她跳得很认真"],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "5 × 70 + 2x = 532", correct: true },
      { id: "B", text: "70 + 2x = 532", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "后 2 天每天跳多少个？",
    finalValue: 91, finalUnit: "个", finalDistractors: [73, 100, 80],
    expression: "350 + 2x = 532 → x = 91",
    solution_steps: ["前 5 天 = 350", "2x = 532 − 350 = 182", "x = 91 个"],
  }),
  app(sEq2, {
    id: "MB_eq2_4", difficulty: 4,
    stem: "一辆出租车起步价 9 元（含 3 千米），后续每千米 2.5 元。妈妈付 24 元，一共坐了多少千米？（设 x 千米）",
    clues: ["起步价 9 元含 3 千米", "之后每千米 2.5 元", "付了 24 元", "她去了商场"],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "9 + 2.5(x − 3) = 24", correct: true },
      { id: "B", text: "9 + 2.5x = 24", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "总共坐了多少千米？",
    finalValue: 9, finalUnit: "千米", finalDistractors: [6, 9.6, 8.4],
    expression: "9 + 2.5(x−3) = 24 → x = 9",
    solution_steps: ["2.5(x−3) = 15", "x − 3 = 6", "x = 9 千米"],
  }),

  // ============= 相遇问题 (3 道) =============
  app(sEqMt, {
    id: "MB_meet_1", difficulty: 4,
    stem: "甲乙两地相距 240 千米。一辆汽车每小时 60 千米，从甲出发；另一辆每小时 80 千米，同时从乙相向开来。多少小时后相遇？（设 x 小时）",
    clues: ["相距 240 千米", "甲车 60 km/h", "乙车 80 km/h", "他们同时出发"],
    correctClueIdx: [0, 1, 2, 3],
    relationshipChoices: [
      { id: "A", text: "(60 + 80) × x = 240", correct: true },
      { id: "B", text: "60 × x + 80 = 240", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "多少小时后相遇？",
    finalValue: 1.71, finalUnit: "小时", finalDistractors: [3, 4, 1.5],
    expression: "140x = 240 → x ≈ 1.71",
    solution_steps: ["相遇时两车走的路程之和 = 240", "速度和 × 时间 = 总路程", "(60+80)x = 240 → x = 240÷140 ≈ 1.71 小时"],
  }),
  app(sEqMt, {
    id: "MB_meet_2", difficulty: 3,
    stem: "Selena 和好朋友从校门两端相向走来。Selena 每分钟 60 米，朋友每分钟 50 米。校园 220 米长。多少分钟后相遇？",
    clues: ["Selena 60 米/分", "朋友 50 米/分", "校园 220 米", "她们都背着书包"],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "(60+50) × t = 220", correct: true },
      { id: "B", text: "60t = 220", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "多少分钟相遇？",
    finalValue: 2, finalUnit: "分钟", finalDistractors: [1, 4, 22],
    expression: "110t = 220 → t = 2",
    solution_steps: ["速度和 60+50 = 110", "时间 = 220÷110 = 2 分钟"],
  }),
  app(sEqMt, {
    id: "MB_meet_3", difficulty: 4,
    stem: "两辆自行车从相距 12 千米的两地同时相向出发，3 小时后相遇。一辆每小时 2.4 千米，另一辆每小时多少千米？",
    clues: ["相距 12 千米", "3 小时相遇", "一辆 2.4 千米/小时", "他们都很守时"],
    correctClueIdx: [0, 1, 2],
    relationshipChoices: [
      { id: "A", text: "(2.4 + x) × 3 = 12", correct: true },
      { id: "B", text: "2.4x + 3 = 12", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "另一辆每小时多少千米？",
    finalValue: 1.6, finalUnit: "千米/小时", finalDistractors: [4, 2, 3.6],
    expression: "(2.4+x)×3 = 12 → x = 1.6",
    solution_steps: ["速度和 = 12÷3 = 4", "x = 4 − 2.4 = 1.6 千米/小时"],
  }),

  // ============= 和倍/差倍 (3 道) =============
  app(sEqSd, {
    id: "MB_sd_1", difficulty: 4,
    stem: "妈妈买的香蕉是苹果的 3 倍，香蕉和苹果一共 24 个。苹果有几个？（设苹果 x 个）",
    clues: ["香蕉是苹果的 3 倍", "一共 24 个", "苹果是红色的", "妈妈喜欢做水果沙拉"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "x + 3x = 24", correct: true },
      { id: "B", text: "x + x/3 = 24", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "苹果有几个？",
    finalValue: 6, finalUnit: "个", finalDistractors: [8, 12, 18],
    expression: "4x = 24 → x = 6",
    solution_steps: ["设苹果 x，香蕉 3x，4x = 24，x = 6"],
  }),
  app(sEqSd, {
    id: "MB_sd_2", difficulty: 4,
    stem: "爸爸的年龄是 Selena 的 4 倍，他们年龄相差 27 岁。Selena 几岁？（设 Selena x 岁）",
    clues: ["爸爸 = Selena 的 4 倍", "相差 27 岁", "爸爸喜欢看书", "Selena 上 4 年级"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "4x − x = 27", correct: true },
      { id: "B", text: "4x + x = 27", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "Selena 几岁？",
    finalValue: 9, finalUnit: "岁", finalDistractors: [27, 36, 6.75],
    expression: "3x = 27 → x = 9",
    solution_steps: ["爸 − Selena = 27", "4x − x = 3x = 27", "x = 9 岁"],
  }),
  app(sEqSd, {
    id: "MB_sd_3", difficulty: 4,
    stem: "图书馆故事书是科普书的 2 倍，比科普书多 64 本。两种各多少本？（设科普 x 本）",
    clues: ["故事书是科普书的 2 倍", "故事书比科普多 64 本", "图书馆每周开门", "Selena 喜欢看故事"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "2x − x = 64", correct: true },
      { id: "B", text: "2x + x = 64", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "科普书多少本？",
    finalValue: 64, finalUnit: "本", finalDistractors: [128, 32, 192],
    expression: "x = 64",
    solution_steps: ["2x − x = x = 64 本科普", "故事书 = 128 本"],
  }),

  // ============= 平均数逆向 (5 道) =============
  app(sAvgT, {
    id: "MB_avgT_1", difficulty: 3,
    stem: "5 个同学跳绳的平均成绩是 168 个。5 人一共跳了多少个？",
    clues: ["5 个同学", "平均 168 个", "他们都喜欢跳绳", "下午跳的"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "总数 = 平均数 × 份数", correct: true },
      { id: "B", text: "总数 = 平均数 + 份数", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "5 人一共跳多少个？",
    finalValue: 840, finalUnit: "个", finalDistractors: [173, 33.6, 168],
    expression: "168 × 5 = 840",
    solution_steps: ["总数 = 平均 × 份数 = 168 × 5 = 840"],
  }),
  app(sAvgT, {
    id: "MB_avgT_2", difficulty: 3,
    stem: "Selena 一周看书共 168 页，平均每天看几页？（一周 7 天）",
    clues: ["共 168 页", "一周 7 天", "她爱看故事书", "晚上看"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "平均 = 总数 ÷ 份数", correct: true },
      { id: "B", text: "平均 = 总数 × 份数", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "平均每天看几页？",
    finalValue: 24, finalUnit: "页", finalDistractors: [161, 175, 168],
    expression: "168 ÷ 7 = 24",
    solution_steps: ["168 ÷ 7 = 24 页/天"],
  }),
  speed(sAvgT, {
    id: "MB_avgT_3", difficulty: 2,
    stem: "4 个数的平均数是 7.5，这 4 个数的和是多少？",
    value: 30, distractors: [11.5, 1.875, 28],
    hints: [{ text: "和 = 平均 × 份数", penalty: 1 }],
  }),

  app(sAvgM, {
    id: "MB_avgM_1", difficulty: 4,
    stem: "三个同学考试的平均分是 88，前两个分别考了 85 和 92。第三个考了多少分？",
    clues: ["平均 88 分", "三个人", "第一个 85", "第二个 92"],
    correctClueIdx: [0, 1, 2, 3],
    relationshipChoices: [
      { id: "A", text: "第三 = 平均 × 份数 − 前两个之和", correct: true },
      { id: "B", text: "第三 = 平均 − 前两个之和", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "第三个多少分？",
    finalValue: 87, finalUnit: "分", finalDistractors: [89, 86, 90],
    expression: "88×3 − 85 − 92 = 87",
    solution_steps: ["总分 = 88×3 = 264", "264 − 85 − 92 = 87"],
    parent_tip: "已知平均数求其中一个：先求总和，再减去其余的。Selena 经常忘记先把平均数变回总和。",
  }),
  app(sAvgM, {
    id: "MB_avgM_2", difficulty: 4,
    stem: "Selena 5 次跳绳成绩的平均是 165 个，前 4 次是 158、170、162、168。第 5 次跳了多少个？",
    clues: ["5 次平均 165", "前 4 次：158, 170, 162, 168", "她每次都很努力", "在体育课上"],
    correctClueIdx: [0, 1],
    relationshipChoices: [
      { id: "A", text: "第 5 = 165×5 − (158+170+162+168)", correct: true },
      { id: "B", text: "第 5 = 165 − (158+170+162+168)/4", correct: false, errorTag: "relation_model_error" },
    ],
    finalPrompt: "第 5 次多少个？",
    finalValue: 167, finalUnit: "个", finalDistractors: [163, 172, 165],
    expression: "825 − 658 = 167",
    solution_steps: ["总数 = 165×5 = 825", "前 4 次和 = 658", "第 5 次 = 825 − 658 = 167"],
  }),
];
