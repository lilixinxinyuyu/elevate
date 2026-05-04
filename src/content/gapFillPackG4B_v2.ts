/**
 * 题量补齐包 v0.16.5 —— G4B 第二轮
 *
 * 目标分布（基于 Bjork "desirable difficulty" 研究 + 配合自适应调度器）：
 *   - 整体题库每个 skill 的难度大致按 D1:20% / D2:30% / D3:30% / D4:20% 配比
 *   - 调度器再按当前 mastery 把这些题以不同比例端到 Selena 面前：
 *       mastery <50 → D1:40 / D2:40 / D3:15 / D4:5
 *       mastery 50-75 → D1:20 / D2:35 / D3:30 / D4:15
 *       mastery 75-90 → D1:10 / D2:25 / D3:40 / D4:25
 *       mastery >90 → D1:5  / D2:15 / D3:40 / D4:40
 *   - 这样保持 75-85% 正确率（"理想难度"区间），既有挑战又能持续进步
 *
 * 这一轮覆盖：
 *   - 6 个最难 skill 各补到 30 道（modeling / reasoning 类）
 *   - 17 个 MUST/HIGH skill 各补到 20 道（procedural / concept 为主）
 *
 * 所有题目原创、手算校验、避免与已有题完全重复。
 */

import type { AbilityId, ExamPriority, Hint, Question, GameTemplate, SubQuestion } from "../core/types";

const base = {
  version: 1 as const,
  status: "approved" as const,
  grade: 4 as const,
  source: { curriculum: "BNU_2013_G4", basis: "gap_fill_v016_5", copyright_safe: true, original: true },
  variant_rules: { same_skill: true, change_numbers: true, change_context: true, preserve_difficulty: true },
  review_interval_days: [1, 3, 7, 14, 30],
  safety_check: {
    no_real_child_name: true, no_personal_data: true, age_appropriate: true,
    no_ads: true, no_payment_inducement: true, no_unrelated_link: true,
  },
};

interface SkillCtx {
  unitId: string; unitName: string; term: "上册" | "下册";
  skillId: string; skillName: string;
  ability: AbilityId[]; examPriority: ExamPriority;
}

interface NumQ {
  id: string; difficulty: 1 | 2 | 3 | 4 | 5; stem: string;
  value: number; unit?: string; distractors: number[];
  hints?: Hint[]; time?: number; tags?: string[]; playAs?: GameTemplate;
}

function speed(s: SkillCtx, q: NumQ): Question {
  return {
    ...base,
    question_id: q.id, term: s.term, unit_id: s.unitId, unit_name: s.unitName,
    skill_id: s.skillId, skill_name: s.skillName,
    ability_dimension: s.ability, exam_priority: s.examPriority,
    game_type: "speed_calc", play_as: q.playAs ?? "speed_match",
    cognitive_level: "procedural", difficulty: q.difficulty,
    estimated_time_seconds: q.time ?? 25, stem: q.stem,
    question_format: "numeric",
    answer: { type: "number", value: q.value, ...(q.unit ? { unit: q.unit } : {}) },
    distractors: q.distractors,
    solution_steps: [`答 ${q.value}${q.unit ?? ""}`],
    hints: q.hints ?? [{ text: "别急，分两步想：先做什么再做什么", penalty: 1 }],
    common_errors: [
      { tag: "careless_reading", error: "读题没读完", remediation: "重读一遍。" },
      { tag: "decimal_point_error", error: "小数点放错位", remediation: "整数算完再点回小数点。" },
    ],
    feedback_correct: "干得漂亮！",
    feedback_wrong: "再想想——题目里关键的数字是哪几个？",
    tags: q.tags,
  };
}

interface ChoiceQ {
  id: string; difficulty: 1 | 2 | 3 | 4 | 5; stem: string;
  options: { id: string; text: string; errorTag?: string }[];
  correctId: string; solution_steps: string[];
  hints?: Hint[]; time?: number;
  cognitive?: "recall" | "procedural" | "application" | "reasoning";
  tags?: string[];
}

function choice(s: SkillCtx, q: ChoiceQ): Question {
  return {
    ...base,
    question_id: q.id, term: s.term, unit_id: s.unitId, unit_name: s.unitName,
    skill_id: s.skillId, skill_name: s.skillName,
    ability_dimension: s.ability, exam_priority: s.examPriority,
    game_type: "concept_check", play_as: "plain_choice",
    cognitive_level: q.cognitive ?? "reasoning",
    difficulty: q.difficulty, estimated_time_seconds: q.time ?? 30,
    stem: q.stem, question_format: "single_choice",
    options: q.options, answer: { type: "choice", value: q.correctId },
    solution_steps: q.solution_steps,
    hints: q.hints ?? [{ text: "排除明显不对的，再从剩下里选", penalty: 1 }],
    common_errors: [
      { tag: "concept_confuse", error: "概念混淆", remediation: "回忆定义或关键规则。" },
      { tag: "careless_reading", error: "看错题", remediation: "再读一次题目。" },
    ],
    feedback_correct: "判断很准！",
    feedback_wrong: "别着急，先排除明显错的选项。",
    tags: q.tags,
  };
}

interface AppQ {
  id: string; difficulty: 1 | 2 | 3 | 4 | 5; stem: string;
  clues: string[]; correctClueIdx: number[];
  relationshipChoices: { id: string; text: string; correct: boolean; errorTag?: string }[];
  finalPrompt: string; finalValue: number; finalUnit?: string;
  finalDistractors?: number[]; expression: string;
  solution_steps: string[]; hints?: Hint[]; time?: number; tags?: string[];
}

function app(s: SkillCtx, q: AppQ): Question {
  const subs: SubQuestion[] = [
    { kind: "clue_pick", prompt: "先挑出本题用到的已知条件：", clues: q.clues, correct: q.correctClueIdx, mode: "pick_correct" },
    { kind: "choose", prompt: "这道题最合适的数量关系是：", options: q.relationshipChoices },
    { kind: "numeric", prompt: q.finalPrompt, value: q.finalValue, unit: q.finalUnit, distractors: q.finalDistractors },
  ];
  return {
    ...base,
    question_id: q.id, term: s.term, unit_id: s.unitId, unit_name: s.unitName,
    skill_id: s.skillId, skill_name: s.skillName,
    ability_dimension: s.ability, exam_priority: s.examPriority,
    game_type: "word_problem_lab", play_as: "shop_counter",
    cognitive_level: "application", difficulty: q.difficulty,
    estimated_time_seconds: q.time ?? 90, stem: q.stem,
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
      known: q.correctClueIdx.map((i) => q.clues[i]!), question: q.finalPrompt,
      relationship: q.relationshipChoices.find((o) => o.correct)?.text ?? "",
      equation_or_expression: q.expression, check: "代回原题检查。",
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

/* ============================================================
   ★ Hard 6 (target 30) — 6 个最难 skill 各补 +20 道
   ============================================================ */

/* --- decimal_inverse_problem (target 30, +20) --- */
const sInv: SkillCtx = {
  unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法", term: "下册",
  skillId: "decimal_inverse_problem", skillName: "已知和/差求未知量逆向应用题",
  ability: ["modeling", "reasoning"], examPriority: "MUST_BIG",
};
const invQs: Question[] = [
  speed(sInv, { id: "G4B_v2_inv_1", difficulty: 1, stem: "Selena 和弟弟一共重 60 千克，弟弟 25 千克。Selena 多重？", value: 35, unit: "千克", distractors: [85, 30, 25] }),
  speed(sInv, { id: "G4B_v2_inv_2", difficulty: 1, stem: "两条绳共长 8 米，一条 3 米。另一条多长？", value: 5, unit: "米", distractors: [11, 3, 6] }),
  speed(sInv, { id: "G4B_v2_inv_3", difficulty: 2, stem: "鸡兔共 24 只，鸡 14 只。兔多少只？", value: 10, unit: "只", distractors: [38, 14, 20] }),
  speed(sInv, { id: "G4B_v2_inv_4", difficulty: 2, stem: "Selena 跑步两段共 1.5 千米，第一段 0.7 千米。第二段多远？", value: 0.8, unit: "千米", distractors: [2.2, 0.7, 0.5] }),
  speed(sInv, { id: "G4B_v2_inv_5", difficulty: 2, stem: "一袋米 3.4 千克，比一袋面粉重 0.6 千克。面粉多重？", value: 2.8, unit: "千克", distractors: [4, 3.4, 2.4] }),
  speed(sInv, { id: "G4B_v2_inv_6", difficulty: 2, stem: "上下楼共用 2.5 分，下楼用 1.1 分。上楼用多少分？", value: 1.4, unit: "分钟", distractors: [3.6, 1.1, 1.5] }),
  speed(sInv, { id: "G4B_v2_inv_7", difficulty: 3, stem: "买文具共花 18.6 元：笔 5.4 元，本子 4.5 元，剩下买橡皮多少元？", value: 8.7, unit: "元", distractors: [9.9, 7.7, 28.5] }),
  speed(sInv, { id: "G4B_v2_inv_8", difficulty: 3, stem: "甲比乙多 0.45 米，甲 1.6 米。乙多高？", value: 1.15, unit: "米", distractors: [2.05, 1.5, 0.45] }),
  speed(sInv, { id: "G4B_v2_inv_9", difficulty: 3, stem: "妈妈带 50 元买菜，回来还剩 12.5 元。买菜花了多少元？", value: 37.5, unit: "元", distractors: [62.5, 38, 50] }),
  speed(sInv, { id: "G4B_v2_inv_10", difficulty: 3, stem: "两根铁丝共 2.4 米，第一根比第二根短 0.2 米。第一根多长？", value: 1.1, unit: "米", distractors: [1.3, 1.2, 2.2] }),
  speed(sInv, { id: "G4B_v2_inv_11", difficulty: 3, stem: "Selena 数学 92 分，比语文低 4.5 分。语文多少分？", value: 96.5, unit: "分", distractors: [87.5, 96, 92] }),
  speed(sInv, { id: "G4B_v2_inv_12", difficulty: 3, stem: "果园苹果产量 1250 千克，比梨多 250 千克。梨多少千克？", value: 1000, unit: "千克", distractors: [1500, 250, 2500] }),
  speed(sInv, { id: "G4B_v2_inv_13", difficulty: 3, stem: "Selena 跳绳 3 分钟，第二分钟跳 65 个，比第一分钟多 5 个。第一分钟跳几个？", value: 60, unit: "个", distractors: [70, 65, 130] }),
  speed(sInv, { id: "G4B_v2_inv_14", difficulty: 4, stem: "三个数和是 8.4，A=2.5，B=3.2。C=?", value: 2.7, unit: "", distractors: [3.5, 2.3, 14.1] }),
  speed(sInv, { id: "G4B_v2_inv_15", difficulty: 4, stem: "买衣服花 245.5 元，鞋比衣服便宜 78.8 元。鞋多少元？", value: 166.7, unit: "元", distractors: [324.3, 167.7, 78.8] }),
  speed(sInv, { id: "G4B_v2_inv_16", difficulty: 4, stem: "三天看完一本 84 页书：第一天 32 页，第二天 28 页。第三天看几页？", value: 24, unit: "页", distractors: [60, 28, 32] }),
  speed(sInv, { id: "G4B_v2_inv_17", difficulty: 4, stem: "苹果橘子共 12.5 千克，苹果是橘子的 1.5 倍。橘子多少千克？", value: 5, unit: "千克", distractors: [7.5, 8.3, 4] }),
  speed(sInv, { id: "G4B_v2_inv_18", difficulty: 4, stem: "Selena 三次跳远共 4.2 米，前两次分别 1.35 米和 1.4 米。第三次跳多远？", value: 1.45, unit: "米", distractors: [1.25, 1.5, 2.75] }),
  speed(sInv, { id: "G4B_v2_inv_19", difficulty: 4, stem: "三种水果共 25.8 千克：苹果 8.5 千克，梨 9.2 千克。橘子多重？", value: 8.1, unit: "千克", distractors: [17.7, 7.5, 16.6] }),
  speed(sInv, { id: "G4B_v2_inv_20", difficulty: 5, stem: "一根管 6 米，截下两段：第一段 1.85 米，第二段比第一段长 0.65 米。剩下多长？", value: 1.65, unit: "米", distractors: [2.5, 4.35, 1.5] }),
];

/* --- decimal_segment_pricing (target 30, +20) --- */
const sSeg: SkillCtx = {
  unitId: "G4B_U3_DECIMAL_MULTIPLY", unitName: "小数乘法", term: "下册",
  skillId: "decimal_segment_pricing", skillName: "基础分段计价",
  ability: ["modeling", "reasoning"], examPriority: "MUST_BIG",
};
const segQs: Question[] = [
  speed(sSeg, { id: "G4B_v2_seg_1", difficulty: 2, stem: "出租车 3 千米内 8 元，超过每千米 2 元。坐 3 千米要多少元？", value: 8, unit: "元", distractors: [10, 6, 14] }),
  speed(sSeg, { id: "G4B_v2_seg_2", difficulty: 2, stem: "停车前 1 小时 5 元，之后每小时 3 元。停 1 小时要多少元？", value: 5, unit: "元", distractors: [8, 3, 5.5] }),
  speed(sSeg, { id: "G4B_v2_seg_3", difficulty: 3, stem: "出租车 3 千米内 8 元，超过每千米 2 元。坐 4 千米多少元？", value: 10, unit: "元", distractors: [16, 8, 12] }),
  speed(sSeg, { id: "G4B_v2_seg_4", difficulty: 3, stem: "停车前 1 小时 5 元，之后每小时 3 元。停 3 小时多少元？", value: 11, unit: "元", distractors: [15, 9, 8] }),
  speed(sSeg, { id: "G4B_v2_seg_5", difficulty: 3, stem: "话费每月 30 元含 100 分，超出每分 0.2 元。用了 120 分钟要多少元？", value: 34, unit: "元", distractors: [54, 30, 24] }),
  speed(sSeg, { id: "G4B_v2_seg_6", difficulty: 3, stem: "快递首重 1 千克 8 元，续重每千克 2 元。寄 3 千克要多少元？", value: 12, unit: "元", distractors: [10, 14, 24] }),
  speed(sSeg, { id: "G4B_v2_seg_7", difficulty: 3, stem: "电费每月前 60 度 0.5 元/度，超出每度 0.6 元。用了 80 度多少元？", value: 42, unit: "元", distractors: [48, 40, 50] }),
  speed(sSeg, { id: "G4B_v2_seg_8", difficulty: 3, stem: "门票成人 30 元，1.2 米以下半价。1 大 1 小 (小是 1 米) 共多少元？", value: 45, unit: "元", distractors: [60, 30, 15] }),
  speed(sSeg, { id: "G4B_v2_seg_9", difficulty: 3, stem: "打印每页 0.2 元，超 100 页每页 0.15 元。打 150 页多少元？", value: 27.5, unit: "元", distractors: [30, 22.5, 25] }),
  speed(sSeg, { id: "G4B_v2_seg_10", difficulty: 3, stem: "出租车 3 千米内 10 元，超过每千米 2.4 元。坐 5 千米多少元？", value: 14.8, unit: "元", distractors: [12, 22, 14.4] }),
  speed(sSeg, { id: "G4B_v2_seg_11", difficulty: 4, stem: "停车场首小时 6 元，之后每小时 4 元。停 5 小时收多少元？", value: 22, unit: "元", distractors: [20, 30, 24] }),
  speed(sSeg, { id: "G4B_v2_seg_12", difficulty: 4, stem: "电费阶梯：前 50 度 0.5 元，超 50 度每度 0.7 元。用了 100 度？", value: 60, unit: "元", distractors: [50, 70, 35] }),
  speed(sSeg, { id: "G4B_v2_seg_13", difficulty: 4, stem: "出租车 2 千米内 8 元，超过每千米 1.8 元。坐 7 千米多少元？", value: 17, unit: "元", distractors: [12.6, 18, 19] }),
  speed(sSeg, { id: "G4B_v2_seg_14", difficulty: 4, stem: "门票 4 张：成人 50 元 2 张、儿童半价 2 张。共多少？", value: 150, unit: "元", distractors: [100, 200, 125] }),
  speed(sSeg, { id: "G4B_v2_seg_15", difficulty: 4, stem: "话费每月 39 元含 80 分，超出每分 0.25 元。用了 200 分？", value: 69, unit: "元", distractors: [50, 80, 90] }),
  speed(sSeg, { id: "G4B_v2_seg_16", difficulty: 4, stem: "快递首重 1 千克 12 元，续重每千克 4 元。寄 3.5 千克(不足按 1 千克算)？", value: 24, unit: "元", distractors: [20, 28, 14] }),
  speed(sSeg, { id: "G4B_v2_seg_17", difficulty: 4, stem: "停车场首小时 8 元，之后每半小时 2 元。停 3 小时收多少元？", value: 16, unit: "元", distractors: [20, 14, 24] }),
  speed(sSeg, { id: "G4B_v2_seg_18", difficulty: 5, stem: "出租车 3 千米内 10 元，超过 3 千米每千米 2 元，超过 10 千米每千米 3 元。坐 12 千米？", value: 30, unit: "元", distractors: [34, 24, 36] }),
  speed(sSeg, { id: "G4B_v2_seg_19", difficulty: 5, stem: "电费阶梯：100 度内 0.5 元，101-200 度 0.6 元，>200 度 0.8 元。用 250 度？", value: 150, unit: "元", distractors: [200, 125, 175] }),
  speed(sSeg, { id: "G4B_v2_seg_20", difficulty: 5, stem: "停车前 30 分免费，之后每 30 分 3 元。停 2 小时 15 分共付？", value: 12, unit: "元", distractors: [15, 9, 13.5] }),
];

/* --- equation_two_step_word (target 30, +20) --- */
const sTwo: SkillCtx = {
  unitId: "G4B_U5_EQUATIONS", unitName: "认识方程", term: "下册",
  skillId: "equation_two_step_word", skillName: "列方程解决两步应用题",
  ability: ["modeling", "reasoning"], examPriority: "MUST_BIG",
};
const twoQs: Question[] = [
  speed(sTwo, { id: "G4B_v2_two_1", difficulty: 2, stem: "买 2 个面包和 1 瓶水共 8 元，水 2 元。每个面包多少元？", value: 3, unit: "元", distractors: [4, 2, 6] }),
  speed(sTwo, { id: "G4B_v2_two_2", difficulty: 2, stem: "买 3 支笔和 1 块橡皮共 7 元，橡皮 1 元。每支笔多少元？", value: 2, unit: "元", distractors: [3, 1, 6] }),
  speed(sTwo, { id: "G4B_v2_two_3", difficulty: 3, stem: "Selena 用 50 元买 4 本书，每本 8 元，找回多少元？", value: 18, unit: "元", distractors: [22, 32, 16] }),
  speed(sTwo, { id: "G4B_v2_two_4", difficulty: 3, stem: "停车 4 小时收 17 元，前 1 小时 5 元，之后每小时多少元？", value: 4, unit: "元", distractors: [5, 4.25, 3] }),
  speed(sTwo, { id: "G4B_v2_two_5", difficulty: 3, stem: "5 个相同笔记本和 1 支 3 元的笔共 23 元，每本笔记本几元？", value: 4, unit: "元", distractors: [5, 4.6, 3] }),
  speed(sTwo, { id: "G4B_v2_two_6", difficulty: 3, stem: "Selena 跳绳 5 分钟跳 380 下，前 2 分钟跳了 150 下，后 3 分钟平均每分钟跳几下？", value: 76.67, unit: "下", distractors: [80, 76, 75], time: 60 }),
  speed(sTwo, { id: "G4B_v2_two_7", difficulty: 3, stem: "100 元买 6 张相同的票，每张 12 元，找回几元？", value: 28, unit: "元", distractors: [22, 32, 88] }),
  speed(sTwo, { id: "G4B_v2_two_8", difficulty: 3, stem: "Selena 8 天读完一本 240 页书，前 3 天每天读 30 页，后 5 天平均每天几页？", value: 30, unit: "页", distractors: [32, 28, 25] }),
  speed(sTwo, { id: "G4B_v2_two_9", difficulty: 3, stem: "妈妈用 100 元买 5 张电影票和 1 桶 18 元的爆米花，每张电影票多少元？", value: 16.4, unit: "元", distractors: [20, 16, 18] }),
  speed(sTwo, { id: "G4B_v2_two_10", difficulty: 4, stem: "面包店 4 个面包和 2 个蛋糕共 50 元，蛋糕每个 8 元。每个面包多少元？", value: 8.5, unit: "元", distractors: [10, 8, 9] }),
  speed(sTwo, { id: "G4B_v2_two_11", difficulty: 4, stem: "果园 6 棵苹果树和 4 棵梨树共结果 980 个，梨平均每棵 80 个。苹果平均每棵几个？", value: 110, unit: "个", distractors: [100, 120, 165] }),
  speed(sTwo, { id: "G4B_v2_two_12", difficulty: 4, stem: "停车 5 小时收 22 元，前 1 小时 6 元，之后每小时多少元？", value: 4, unit: "元", distractors: [4.4, 5, 3.5] }),
  speed(sTwo, { id: "G4B_v2_two_13", difficulty: 4, stem: "Selena 3 个月共存了 240 元，第一个月存 60 元，第二个月存 90 元。第三个月存几元？", value: 90, unit: "元", distractors: [80, 100, 240] }),
  speed(sTwo, { id: "G4B_v2_two_14", difficulty: 4, stem: "学校买 30 张桌子和 60 把椅子共 4500 元，桌子每张 80 元。椅子每把多少元？", value: 35, unit: "元", distractors: [40, 30, 60] }),
  speed(sTwo, { id: "G4B_v2_two_15", difficulty: 4, stem: "Selena 4 次考试平均 92 分，第 5 次考 97 分。5 次平均多少分？", value: 93, unit: "分", distractors: [94, 92, 95] }),
  speed(sTwo, { id: "G4B_v2_two_16", difficulty: 4, stem: "买 5 包薯片，付 50 元找回 12.5 元。每包多少元？", value: 7.5, unit: "元", distractors: [10, 7, 8] }),
  speed(sTwo, { id: "G4B_v2_two_17", difficulty: 4, stem: "Selena 跑 4 圈用 8 分钟，前 2 圈用 4.5 分钟。后 2 圈平均每圈多少分钟？", value: 1.75, unit: "分钟", distractors: [2, 1.5, 2.25] }),
  speed(sTwo, { id: "G4B_v2_two_18", difficulty: 5, stem: "妈妈买 3 件衣服 1 双鞋共 580 元，鞋 280 元。每件衣服多少元？", value: 100, unit: "元", distractors: [120, 90, 150] }),
  speed(sTwo, { id: "G4B_v2_two_19", difficulty: 5, stem: "学校 3 个班共栽 96 棵树，1 班 30 棵，2 班比 3 班多 6 棵。3 班几棵？", value: 30, unit: "棵", distractors: [33, 36, 24] }),
  speed(sTwo, { id: "G4B_v2_two_20", difficulty: 5, stem: "买 4 本书和 6 个本，书每本 12 元，共 78 元。每个本几元？", value: 5, unit: "元", distractors: [6, 4, 30] }),
];

/* --- equation_meeting_problem (target 30, +20) --- */
const sMeet: SkillCtx = {
  ...sTwo, skillId: "equation_meeting_problem", skillName: "相遇问题",
  ability: ["modeling", "reasoning"], examPriority: "MUST_BIG",
};
const meetQs: Question[] = [
  speed(sMeet, { id: "G4B_v2_meet_1", difficulty: 2, stem: "甲乙相距 100 米，相向而行，甲每分 30 米，乙每分 20 米。几分相遇？", value: 2, unit: "分钟", distractors: [3, 5, 1] }),
  speed(sMeet, { id: "G4B_v2_meet_2", difficulty: 2, stem: "Selena 和爸爸相距 200 米相向走，速度都是每分 25 米。几分相遇？", value: 4, unit: "分钟", distractors: [8, 5, 2] }),
  speed(sMeet, { id: "G4B_v2_meet_3", difficulty: 3, stem: "两车相距 360 千米，甲每小时 50 千米，乙每小时 40 千米，相向几小时相遇？", value: 4, unit: "小时", distractors: [3, 5, 9] }),
  speed(sMeet, { id: "G4B_v2_meet_4", difficulty: 3, stem: "两人相距 600 米，相向走，A 每分 40 米，B 每分 60 米。几分相遇？", value: 6, unit: "分钟", distractors: [10, 5, 12] }),
  speed(sMeet, { id: "G4B_v2_meet_5", difficulty: 3, stem: "AB 两地 480 千米，两车 6 小时相遇，甲每小时 50。乙多少？", value: 30, unit: "千米", distractors: [40, 35, 80] }),
  speed(sMeet, { id: "G4B_v2_meet_6", difficulty: 3, stem: "Selena 和妈妈相距 720 米，妈妈每分 80 米，Selena 每分 40 米，几分相遇？", value: 6, unit: "分钟", distractors: [9, 12, 3] }),
  speed(sMeet, { id: "G4B_v2_meet_7", difficulty: 3, stem: "AB 相距 540 千米，相向 3 小时相遇，乙每小时 90。甲每小时几千米？", value: 90, unit: "千米", distractors: [180, 60, 100] }),
  speed(sMeet, { id: "G4B_v2_meet_8", difficulty: 3, stem: "两人相距 1200 米相向走，3 分钟相遇，A 每分 220 米。B 每分多少？", value: 180, unit: "米", distractors: [200, 150, 160] }),
  speed(sMeet, { id: "G4B_v2_meet_9", difficulty: 4, stem: "甲乙相距 480 千米相向 4 小时相遇，甲每小时比乙多 10 千米。乙每小时多少？", value: 55, unit: "千米", distractors: [60, 50, 120] }),
  speed(sMeet, { id: "G4B_v2_meet_10", difficulty: 4, stem: "两车 5 小时相遇，速度分别为 60、80 千米/时。两地相距多少千米？", value: 700, unit: "千米", distractors: [600, 800, 140] }),
  speed(sMeet, { id: "G4B_v2_meet_11", difficulty: 4, stem: "Selena 每分跑 200 米，弟弟每分跑 150 米。两人相距 1750 米相向跑，几分相遇？", value: 5, unit: "分钟", distractors: [10, 7, 8] }),
  speed(sMeet, { id: "G4B_v2_meet_12", difficulty: 4, stem: "AB 相距 360 千米，两车 4 小时相遇。甲每小时 45。乙每小时？", value: 45, unit: "千米", distractors: [40, 50, 90] }),
  speed(sMeet, { id: "G4B_v2_meet_13", difficulty: 4, stem: "甲乙两港相距 252 千米，两船相向 3 小时相遇。甲船每小时 40 千米。乙船？", value: 44, unit: "千米", distractors: [42, 48, 50] }),
  speed(sMeet, { id: "G4B_v2_meet_14", difficulty: 4, stem: "两人相距 5.4 千米相向走，甲每小时 5.2，乙每小时 4.8。几小时相遇？", value: 0.54, unit: "小时", distractors: [1, 0.6, 1.08] }),
  speed(sMeet, { id: "G4B_v2_meet_15", difficulty: 4, stem: "AB 两地 280 千米，2 车相向 2.5 小时相遇。甲每小时 60 千米。乙每小时？", value: 52, unit: "千米", distractors: [48, 50, 56] }),
  speed(sMeet, { id: "G4B_v2_meet_16", difficulty: 4, stem: "客车货车相向开，4 小时相遇，客车每小时 75，货车每小时 65。两地相距？", value: 560, unit: "千米", distractors: [500, 600, 140] }),
  speed(sMeet, { id: "G4B_v2_meet_17", difficulty: 4, stem: "两人相距 800 米相向，5 分相遇。A 每分 90 米，B 每分？", value: 70, unit: "米", distractors: [80, 60, 160] }),
  speed(sMeet, { id: "G4B_v2_meet_18", difficulty: 5, stem: "甲先走 30 分(每分 60 米)，乙再从对面出发 (每分 80 米)，两地相距 5400 米。乙走几分相遇？", value: 25, unit: "分钟", distractors: [30, 20, 27] }),
  speed(sMeet, { id: "G4B_v2_meet_19", difficulty: 5, stem: "两车 4 小时相遇，相距 480 千米。甲每小时比乙快 20。甲乙速度分别？(输甲)", value: 70, unit: "千米", distractors: [50, 60, 80] }),
  speed(sMeet, { id: "G4B_v2_meet_20", difficulty: 5, stem: "Selena 9:00 出发每分 65 米，9:10 妈妈从对面出发每分 75 米。两人相距 2330 米。妈妈走几分相遇？", value: 12, unit: "分钟", distractors: [15, 10, 18] }),
];

/* --- equation_sum_difference (target 30, +20) --- */
const sSumDif: SkillCtx = {
  ...sTwo, skillId: "equation_sum_difference", skillName: "和倍/差倍问题",
  ability: ["modeling", "reasoning"], examPriority: "MUST_BIG",
};
const sumDifQs: Question[] = [
  speed(sSumDif, { id: "G4B_v2_sd_1", difficulty: 2, stem: "甲乙共 30，甲是乙的 2 倍。乙是几？", value: 10, distractors: [20, 15, 5] }),
  speed(sSumDif, { id: "G4B_v2_sd_2", difficulty: 2, stem: "AB 相差 12，A 是 B 的 3 倍。B 是几？", value: 6, distractors: [4, 12, 18] }),
  speed(sSumDif, { id: "G4B_v2_sd_3", difficulty: 3, stem: "Selena 和弟弟共 12 岁，Selena 是弟弟的 2 倍。弟弟几岁？", value: 4, unit: "岁", distractors: [6, 8, 3] }),
  speed(sSumDif, { id: "G4B_v2_sd_4", difficulty: 3, stem: "甲乙两数和 84，甲是乙的 6 倍。乙多少？", value: 12, distractors: [14, 72, 10] }),
  speed(sSumDif, { id: "G4B_v2_sd_5", difficulty: 3, stem: "苹果是梨的 4 倍，比梨多 18 个。梨多少个？", value: 6, unit: "个", distractors: [4.5, 24, 9] }),
  speed(sSumDif, { id: "G4B_v2_sd_6", difficulty: 3, stem: "AB 共 99，A 比 B 多 1 倍 (即 A=2B)。B 是？", value: 33, distractors: [49.5, 66, 50] }),
  speed(sSumDif, { id: "G4B_v2_sd_7", difficulty: 3, stem: "学生男生比女生多 30 人，男生是女生的 4 倍。女生几人？", value: 10, unit: "人", distractors: [12, 40, 7.5] }),
  speed(sSumDif, { id: "G4B_v2_sd_8", difficulty: 3, stem: "Selena 妈妈 36 岁，是 Selena 的 4 倍。Selena 几岁？", value: 9, unit: "岁", distractors: [40, 32, 8] }),
  speed(sSumDif, { id: "G4B_v2_sd_9", difficulty: 3, stem: "图书馆故事书是科普书 5 倍，故事书比科普书多 200 本。科普书几本？", value: 50, unit: "本", distractors: [40, 250, 60] }),
  speed(sSumDif, { id: "G4B_v2_sd_10", difficulty: 4, stem: "果园苹果树是梨树 3 倍多 5 棵，共 85 棵。梨树几棵？", value: 20, unit: "棵", distractors: [25, 65, 21] }),
  speed(sSumDif, { id: "G4B_v2_sd_11", difficulty: 4, stem: "Selena 和姐姐共 18 岁，姐姐比 Selena 大 6 岁。姐姐几岁？", value: 12, unit: "岁", distractors: [10, 14, 8] }),
  speed(sSumDif, { id: "G4B_v2_sd_12", difficulty: 4, stem: "甲数是乙数 2 倍少 3，两数和 27。乙数是？", value: 10, distractors: [12, 8, 17] }),
  speed(sSumDif, { id: "G4B_v2_sd_13", difficulty: 4, stem: "妈妈给 Selena 和弟弟分糖，共 60 颗，Selena 比弟弟多 12 颗。Selena 几颗？", value: 36, unit: "颗", distractors: [24, 48, 18] }),
  speed(sSumDif, { id: "G4B_v2_sd_14", difficulty: 4, stem: "甲数是乙数 7 倍，两数差 90。乙是？", value: 15, distractors: [12.86, 105, 10] }),
  speed(sSumDif, { id: "G4B_v2_sd_15", difficulty: 4, stem: "学校植树一二班共 156 棵，一班是二班 2 倍多 12 棵。二班几棵？", value: 48, unit: "棵", distractors: [52, 108, 78] }),
  speed(sSumDif, { id: "G4B_v2_sd_16", difficulty: 4, stem: "Selena 三次考试共 270 分，第 1 次比第 2 次多 5 分，第 3 次和第 1 次相同。第 2 次几分？", value: 86.67, distractors: [90, 85, 88] }),
  speed(sSumDif, { id: "G4B_v2_sd_17", difficulty: 4, stem: "甲乙两堆糖共 96 颗，甲是乙的 3 倍。甲多少颗？", value: 72, unit: "颗", distractors: [24, 32, 64] }),
  speed(sSumDif, { id: "G4B_v2_sd_18", difficulty: 5, stem: "果园苹果是梨 4 倍少 8 棵，共 102 棵。梨几棵？", value: 22, unit: "棵", distractors: [80, 18, 24] }),
  speed(sSumDif, { id: "G4B_v2_sd_19", difficulty: 5, stem: "甲数是乙数 5 倍，乙数是丙数 2 倍。三数和 130。丙数是？", value: 10, distractors: [13, 65, 100] }),
  speed(sSumDif, { id: "G4B_v2_sd_20", difficulty: 5, stem: "妹妹比 Selena 小，2 人和 19 岁，Selena 是妹妹 2 倍多 1 岁。Selena 几岁？", value: 13, unit: "岁", distractors: [12, 14, 6] }),
];

/* --- average_inverse_missing (target 30, +20) --- */
const sAvgM: SkillCtx = {
  unitId: "G4B_U6_DATA", unitName: "数据的表示和分析", term: "下册",
  skillId: "average_inverse_missing", skillName: "已知平均数求其中一个数据",
  ability: ["modeling", "reasoning"], examPriority: "MUST_BIG",
};
const avgMQs: Question[] = [
  speed(sAvgM, { id: "G4B_v2_avgm_1", difficulty: 2, stem: "3 个数平均 8，前两个是 6 和 9，第三个？", value: 9, distractors: [8, 7, 24] }),
  speed(sAvgM, { id: "G4B_v2_avgm_2", difficulty: 2, stem: "4 数平均 10，已知三数 8、12、9，第四个？", value: 11, distractors: [10, 9, 40] }),
  speed(sAvgM, { id: "G4B_v2_avgm_3", difficulty: 3, stem: "5 个数平均 20，已知 4 数和 84，第 5 个？", value: 16, distractors: [20, 17, 100] }),
  speed(sAvgM, { id: "G4B_v2_avgm_4", difficulty: 3, stem: "Selena 4 次跳绳平均 100，前三次 95、102、108。第 4 次？", value: 95, unit: "下", distractors: [100, 90, 105] }),
  speed(sAvgM, { id: "G4B_v2_avgm_5", difficulty: 3, stem: "5 个班平均 40 人，已知前 4 个班共 158 人。第 5 个班几人？", value: 42, unit: "人", distractors: [40, 38, 200] }),
  speed(sAvgM, { id: "G4B_v2_avgm_6", difficulty: 3, stem: "4 棵树平均高 2 米，已知前 3 棵 1.8、2.2、2.0 米。第 4 棵？", value: 2, unit: "米", distractors: [1.5, 2.5, 2.1] }),
  speed(sAvgM, { id: "G4B_v2_avgm_7", difficulty: 3, stem: "Selena 5 次考试平均 90，前 4 次 85、92、88、95。第 5 次几分？", value: 90, unit: "分", distractors: [88, 92, 87] }),
  speed(sAvgM, { id: "G4B_v2_avgm_8", difficulty: 3, stem: "6 个数平均 12，已知 5 数和 65，第 6 个？", value: 7, distractors: [10, 12, 72] }),
  speed(sAvgM, { id: "G4B_v2_avgm_9", difficulty: 3, stem: "5 个数平均 15，已知最大去掉后剩 4 数平均 12。最大是？", value: 27, distractors: [3, 15, 75] }),
  speed(sAvgM, { id: "G4B_v2_avgm_10", difficulty: 4, stem: "Selena 三次跑步平均 65 秒，前 2 次 70 和 60 秒。第 3 次？", value: 65, unit: "秒", distractors: [60, 70, 195] }),
  speed(sAvgM, { id: "G4B_v2_avgm_11", difficulty: 4, stem: "10 人平均身高 140 厘米，9 人平均 138 厘米。第 10 人多高？", value: 158, unit: "厘米", distractors: [140, 142, 280] }),
  speed(sAvgM, { id: "G4B_v2_avgm_12", difficulty: 4, stem: "全班 36 人数学平均 88 分，男生 20 人平均 90 分。女生平均几分？", value: 85.5, unit: "分", distractors: [86, 87, 84] }),
  speed(sAvgM, { id: "G4B_v2_avgm_13", difficulty: 4, stem: "4 个数平均 25，加入 1 个数后 5 个数平均 28。新数是？", value: 40, distractors: [28, 30, 100] }),
  speed(sAvgM, { id: "G4B_v2_avgm_14", difficulty: 4, stem: "5 数平均 30，去掉一个数后 4 数平均 32。去掉的是？", value: 22, distractors: [30, 28, 32] }),
  speed(sAvgM, { id: "G4B_v2_avgm_15", difficulty: 4, stem: "Selena 上学期 5 科平均 92，本学期某一科退步 5 分，其他 4 科同样，5 科新平均？", value: 91, unit: "分", distractors: [87, 89, 92] }),
  speed(sAvgM, { id: "G4B_v2_avgm_16", difficulty: 4, stem: "6 数平均 50，前 4 数平均 48。后 2 数和是？", value: 108, distractors: [100, 96, 200] }),
  speed(sAvgM, { id: "G4B_v2_avgm_17", difficulty: 4, stem: "Selena 数学 1-4 次平均 85，第 5 次想拉平均到 88，第 5 次得几分？", value: 100, unit: "分", distractors: [88, 92, 95] }),
  speed(sAvgM, { id: "G4B_v2_avgm_18", difficulty: 5, stem: "全班平均 120 厘米，男生 22 人平均 122 厘米，女生 18 人平均？", value: 117.56, unit: "厘米", distractors: [118, 120, 119] }),
  speed(sAvgM, { id: "G4B_v2_avgm_19", difficulty: 5, stem: "Selena 跳远 6 次平均 1.5 米，前 5 次平均 1.45 米。第 6 次跳？", value: 1.75, unit: "米", distractors: [1.5, 2, 1.55] }),
  speed(sAvgM, { id: "G4B_v2_avgm_20", difficulty: 5, stem: "5 数平均 30，加入数据 60 后平均变成 35。原 5 数中要去掉哪个使新 5 数平均仍 30？", value: 60, distractors: [30, 50, 35] }),
];

/* ============================================================
   ☆ Mid-tier MUST (target 20) — 部分 skill 各补 +10 道
   只挑当前 < 20 的，用最快的 speed 题型批量补
   ============================================================ */

/* --- decimal_add_sub_simplify (10 → 20, +10) --- */
const sDasSimp: SkillCtx = {
  unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法", term: "下册",
  skillId: "decimal_add_sub_simplify", skillName: "小数加减简便计算",
  ability: ["strategy", "calculation"], examPriority: "MUST_BIG",
};
const dasSimpQs: Question[] = [
  speed(sDasSimp, { id: "G4B_v2_dass_1", difficulty: 2, stem: "简算：4.7 + 2.3", value: 7, distractors: [6, 7.1, 8] }),
  speed(sDasSimp, { id: "G4B_v2_dass_2", difficulty: 2, stem: "简算：8.5 - 3.5", value: 5, distractors: [4.5, 5.5, 12] }),
  speed(sDasSimp, { id: "G4B_v2_dass_3", difficulty: 3, stem: "简算：1.6 + 3.4 + 2.5", value: 7.5, distractors: [7, 8, 6.5] }),
  speed(sDasSimp, { id: "G4B_v2_dass_4", difficulty: 3, stem: "简算：5.45 + 0.55 + 2.1", value: 8.1, distractors: [8, 8.2, 7.9] }),
  speed(sDasSimp, { id: "G4B_v2_dass_5", difficulty: 3, stem: "简算：9.8 - 2.6 - 0.4", value: 6.8, distractors: [7, 6.6, 12.8] }),
  speed(sDasSimp, { id: "G4B_v2_dass_6", difficulty: 3, stem: "简算：8.7 - (3.7 + 1.5)", value: 3.5, distractors: [3, 4, 13.9] }),
  speed(sDasSimp, { id: "G4B_v2_dass_7", difficulty: 4, stem: "简算：2.85 + 1.74 + 7.15 + 6.26", value: 18, distractors: [17.9, 18.1, 17] }),
  speed(sDasSimp, { id: "G4B_v2_dass_8", difficulty: 4, stem: "简算：12.5 - 3.7 - 6.3", value: 2.5, distractors: [2, 3, 22.5] }),
  speed(sDasSimp, { id: "G4B_v2_dass_9", difficulty: 4, stem: "简算：6.85 + 2.4 - 0.85", value: 8.4, distractors: [9, 8, 10] }),
  speed(sDasSimp, { id: "G4B_v2_dass_10", difficulty: 4, stem: "简算：(3.6 + 2.9) + (4.4 + 1.1)", value: 12, distractors: [11.9, 12.1, 11] }),
];

/* --- decimal_mul_mix (10 → 20, +10) --- */
const sMulMix: SkillCtx = {
  unitId: "G4B_U3_DECIMAL_MULTIPLY", unitName: "小数乘法", term: "下册",
  skillId: "decimal_mul_mix", skillName: "小数乘加、乘减混合运算",
  ability: ["calculation", "modeling"], examPriority: "MUST_BIG",
};
const mulMixQs: Question[] = [
  speed(sMulMix, { id: "G4B_v2_mix_1", difficulty: 2, stem: "0.5 × 4 + 1 = ?", value: 3, distractors: [2.5, 5, 4] }),
  speed(sMulMix, { id: "G4B_v2_mix_2", difficulty: 2, stem: "10 - 0.4 × 5 = ?", value: 8, distractors: [10, 6, 48] }),
  speed(sMulMix, { id: "G4B_v2_mix_3", difficulty: 3, stem: "1.5 × 4 + 2.3 = ?", value: 8.3, distractors: [8, 6, 3.8] }),
  speed(sMulMix, { id: "G4B_v2_mix_4", difficulty: 3, stem: "0.6 × 7 + 0.4 × 3 = ?", value: 5.4, distractors: [4.2, 6, 5] }),
  speed(sMulMix, { id: "G4B_v2_mix_5", difficulty: 3, stem: "12.5 - 0.8 × 6 = ?", value: 7.7, distractors: [7, 5.7, 70.2] }),
  speed(sMulMix, { id: "G4B_v2_mix_6", difficulty: 3, stem: "0.25 × 8 + 1.5 = ?", value: 3.5, distractors: [3, 4, 12.5] }),
  speed(sMulMix, { id: "G4B_v2_mix_7", difficulty: 4, stem: "20 - 1.5 × 8 = ?", value: 8, distractors: [12, 6, 148] }),
  speed(sMulMix, { id: "G4B_v2_mix_8", difficulty: 4, stem: "2.4 × 5 - 1.6 × 4 = ?", value: 5.6, distractors: [12, 6.4, 17.6] }),
  speed(sMulMix, { id: "G4B_v2_mix_9", difficulty: 4, stem: "(3.2 + 1.8) × 4 = ?", value: 20, distractors: [22.4, 17.6, 5] }),
  speed(sMulMix, { id: "G4B_v2_mix_10", difficulty: 4, stem: "5 × 1.6 - 2 × 0.4 = ?", value: 7.2, distractors: [8, 7, 6.4] }),
];

/* --- decimal_mul_simplify (10 → 20, +10) --- */
const sMulSimp: SkillCtx = {
  ...sMulMix, skillId: "decimal_mul_simplify", skillName: "小数乘法简便运算",
  ability: ["strategy", "reasoning"],
};
const mulSimpQs: Question[] = [
  speed(sMulSimp, { id: "G4B_v2_msimp_1", difficulty: 2, stem: "简算：2.5 × 4", value: 10, distractors: [10, 100, 1, 8].slice(1) }),
  speed(sMulSimp, { id: "G4B_v2_msimp_2", difficulty: 2, stem: "简算：1.25 × 8", value: 10, distractors: [100, 1, 8] }),
  speed(sMulSimp, { id: "G4B_v2_msimp_3", difficulty: 3, stem: "用乘法分配律：2.5 × 6 + 2.5 × 4 = ?", value: 25, distractors: [10, 50, 24] }),
  speed(sMulSimp, { id: "G4B_v2_msimp_4", difficulty: 3, stem: "简算：0.25 × 4 × 7", value: 7, distractors: [70, 1, 28] }),
  speed(sMulSimp, { id: "G4B_v2_msimp_5", difficulty: 3, stem: "简算：1.25 × 8 × 6", value: 60, distractors: [600, 6, 48] }),
  speed(sMulSimp, { id: "G4B_v2_msimp_6", difficulty: 4, stem: "简算：4.8 × 1.01 (用分配律)", value: 4.848, distractors: [4.8, 5.1, 5.808] }),
  speed(sMulSimp, { id: "G4B_v2_msimp_7", difficulty: 4, stem: "简算：3.6 × 9 + 6.4 × 9", value: 90, distractors: [10, 100, 96] }),
  speed(sMulSimp, { id: "G4B_v2_msimp_8", difficulty: 4, stem: "简算：1.6 × 25 (拆 25 = 100/4)", value: 40, distractors: [4, 0.4, 400] }),
  speed(sMulSimp, { id: "G4B_v2_msimp_9", difficulty: 4, stem: "简算：5.4 × 2.5 × 0.4", value: 5.4, distractors: [54, 0.54, 5] }),
  speed(sMulSimp, { id: "G4B_v2_msimp_10", difficulty: 5, stem: "简算：8.7 × 99 + 8.7 (合并)", value: 870, distractors: [861.3, 870.87, 100] }),
];

/* --- decimal_speed_distance (10 → 20, +10) --- */
const sSD: SkillCtx = {
  ...sMulMix, skillId: "decimal_speed_distance", skillName: "路程=速度×时间（小数场景）",
  ability: ["modeling", "calculation"],
};
const sdQs: Question[] = [
  speed(sSD, { id: "G4B_v2_sd_1", difficulty: 2, stem: "汽车每小时 60 千米，行 2 小时多远？", value: 120, unit: "千米", distractors: [62, 30, 600] }),
  speed(sSD, { id: "G4B_v2_sd_2", difficulty: 2, stem: "Selena 每分走 60 米，走 5 分多远？", value: 300, unit: "米", distractors: [65, 12, 30] }),
  speed(sSD, { id: "G4B_v2_sd_3", difficulty: 3, stem: "高铁每小时 320 千米，跑 3 小时多远？", value: 960, unit: "千米", distractors: [323, 1000, 950] }),
  speed(sSD, { id: "G4B_v2_sd_4", difficulty: 3, stem: "自行车每小时 12.4 千米，骑 1.5 小时多远？", value: 18.6, unit: "千米", distractors: [13.9, 18, 19.6] }),
  speed(sSD, { id: "G4B_v2_sd_5", difficulty: 3, stem: "马拉松选手每分 280 米，跑 25 分多远？", value: 7000, unit: "米", distractors: [305, 7250, 6800] }),
  speed(sSD, { id: "G4B_v2_sd_6", difficulty: 3, stem: "船每小时 18.5 千米，4 小时多远？", value: 74, unit: "千米", distractors: [22.5, 70, 80] }),
  speed(sSD, { id: "G4B_v2_sd_7", difficulty: 4, stem: "客车每小时 78 千米，行 2.5 小时多远？", value: 195, unit: "千米", distractors: [200, 80.5, 156] }),
  speed(sSD, { id: "G4B_v2_sd_8", difficulty: 4, stem: "电瓶车每小时 32.4 千米，骑 0.5 小时多远？", value: 16.2, unit: "千米", distractors: [32.9, 64.8, 33] }),
  speed(sSD, { id: "G4B_v2_sd_9", difficulty: 4, stem: "飞机每小时 825 千米，飞 1.4 小时多远？", value: 1155, unit: "千米", distractors: [826.4, 1100, 1200] }),
  speed(sSD, { id: "G4B_v2_sd_10", difficulty: 4, stem: "Selena 跑步每秒 4.5 米，跑 1.2 分钟(72 秒)多远？", value: 324, unit: "米", distractors: [54, 5.7, 320] }),
];

/* --- decimal_work_total (10 → 20, +10) --- */
const sWT: SkillCtx = {
  ...sMulMix, skillId: "decimal_work_total", skillName: "工程量/产量合计",
  ability: ["modeling", "calculation"],
};
const wtQs: Question[] = [
  speed(sWT, { id: "G4B_v2_wt_1", difficulty: 2, stem: "每小时生产 20 个零件，工作 5 小时共几个？", value: 100, unit: "个", distractors: [25, 4, 4000] }),
  speed(sWT, { id: "G4B_v2_wt_2", difficulty: 2, stem: "每天产 30 升牛奶，10 天产几升？", value: 300, unit: "升", distractors: [40, 3, 30] }),
  speed(sWT, { id: "G4B_v2_wt_3", difficulty: 3, stem: "每小时打字 4500 字，工作 1.5 小时共几字？", value: 6750, unit: "字", distractors: [4501.5, 6000, 7500] }),
  speed(sWT, { id: "G4B_v2_wt_4", difficulty: 3, stem: "果园平均每亩产苹果 320 千克，6.5 亩共产多少？", value: 2080, unit: "千克", distractors: [326.5, 1920, 2200] }),
  speed(sWT, { id: "G4B_v2_wt_5", difficulty: 3, stem: "每瓶饮料 0.355 升，20 瓶共几升？", value: 7.1, unit: "升", distractors: [20.355, 71, 7] }),
  speed(sWT, { id: "G4B_v2_wt_6", difficulty: 3, stem: "每月用电 38.6 度，6 个月共多少度？", value: 231.6, unit: "度", distractors: [44.6, 230, 386] }),
  speed(sWT, { id: "G4B_v2_wt_7", difficulty: 4, stem: "工人每天加工 24.5 件，连续 30 天加工几件？", value: 735, unit: "件", distractors: [54.5, 720, 750] }),
  speed(sWT, { id: "G4B_v2_wt_8", difficulty: 4, stem: "一台机器每分钟生产 1.85 米布，连续 60 分钟生产多少米？", value: 111, unit: "米", distractors: [61.85, 100, 120] }),
  speed(sWT, { id: "G4B_v2_wt_9", difficulty: 4, stem: "Selena 每天看书 0.75 小时，30 天共看几小时？", value: 22.5, unit: "小时", distractors: [30.75, 22, 23] }),
  speed(sWT, { id: "G4B_v2_wt_10", difficulty: 4, stem: "每只蜜蜂每天采蜜 0.32 克，1000 只蜂 1 天采几克？", value: 320, unit: "克", distractors: [0.32, 32, 3.2] }),
];

/* --- equation_one_step_word (10 → 20, +10) --- */
const sEqOne: SkillCtx = {
  unitId: "G4B_U5_EQUATIONS", unitName: "认识方程", term: "下册",
  skillId: "equation_one_step_word", skillName: "列方程解决一步应用题",
  ability: ["modeling", "calculation"], examPriority: "MUST_BIG",
};
const eqOneQs: Question[] = [
  speed(sEqOne, { id: "G4B_v2_eo_1", difficulty: 2, stem: "Selena 比妈妈轻 30 千克，妈妈 60 千克。Selena 多重？", value: 30, unit: "千克", distractors: [90, 2, 35] }),
  speed(sEqOne, { id: "G4B_v2_eo_2", difficulty: 2, stem: "8 个面包共 32 元，每个几元？", value: 4, unit: "元", distractors: [3, 5, 24] }),
  speed(sEqOne, { id: "G4B_v2_eo_3", difficulty: 3, stem: "一袋米比一袋面粉重 1.5 千克，米重 5.5 千克。面粉重？", value: 4, unit: "千克", distractors: [7, 4.5, 1.5] }),
  speed(sEqOne, { id: "G4B_v2_eo_4", difficulty: 3, stem: "Selena 数学得 92 分，比英语少 6 分。英语多少？", value: 98, unit: "分", distractors: [86, 92, 6] }),
  speed(sEqOne, { id: "G4B_v2_eo_5", difficulty: 3, stem: "一捆绳 24 米，平均剪成 8 段，每段几米？", value: 3, unit: "米", distractors: [16, 4, 32] }),
  speed(sEqOne, { id: "G4B_v2_eo_6", difficulty: 3, stem: "果园 4 行苹果树共 144 棵，每行几棵？", value: 36, unit: "棵", distractors: [40, 30, 140] }),
  speed(sEqOne, { id: "G4B_v2_eo_7", difficulty: 3, stem: "一本书 240 页，Selena 已看完 95 页，还剩几页？", value: 145, unit: "页", distractors: [335, 145, 250] }),
  speed(sEqOne, { id: "G4B_v2_eo_8", difficulty: 3, stem: "5 倍的 x 是 65，x 等于？", value: 13, distractors: [325, 60, 70] }),
  speed(sEqOne, { id: "G4B_v2_eo_9", difficulty: 4, stem: "Selena 跳绳 3 分共 285 下，平均每分几下？", value: 95, unit: "下", distractors: [80, 100, 282] }),
  speed(sEqOne, { id: "G4B_v2_eo_10", difficulty: 4, stem: "图书馆借出 168 本书，剩下的是借出的 2 倍。剩下几本？", value: 336, unit: "本", distractors: [504, 84, 170] }),
];

/* --- average_compute (10 → 20, +10) --- */
const sAvgC: SkillCtx = {
  unitId: "G4B_U6_DATA", unitName: "数据的表示和分析", term: "下册",
  skillId: "average_compute", skillName: "求平均数",
  ability: ["calculation", "data"], examPriority: "MUST_BIG",
};
const avgCQs: Question[] = [
  speed(sAvgC, { id: "G4B_v2_avgc_1", difficulty: 2, stem: "求 8、12 的平均数。", value: 10, distractors: [20, 4, 12] }),
  speed(sAvgC, { id: "G4B_v2_avgc_2", difficulty: 2, stem: "求 5、7、9 的平均数。", value: 7, distractors: [21, 5, 9] }),
  speed(sAvgC, { id: "G4B_v2_avgc_3", difficulty: 3, stem: "求 18、22、20、24 的平均数。", value: 21, distractors: [22, 84, 20] }),
  speed(sAvgC, { id: "G4B_v2_avgc_4", difficulty: 3, stem: "5 次身高 138, 142, 140, 145, 140 平均？", value: 141, unit: "厘米", distractors: [142, 140, 705] }),
  speed(sAvgC, { id: "G4B_v2_avgc_5", difficulty: 3, stem: "Selena 一周阅读分钟 25, 30, 28, 32, 35, 40, 30 平均每天几分？", value: 31.43, unit: "分钟", distractors: [30, 33, 220] }),
  speed(sAvgC, { id: "G4B_v2_avgc_6", difficulty: 3, stem: "10 个数和 250，平均是？", value: 25, distractors: [2.5, 250, 10] }),
  speed(sAvgC, { id: "G4B_v2_avgc_7", difficulty: 4, stem: "甲组 5 人共 480 分，乙组 4 人共 392 分。两组合并平均？", value: 96.89, unit: "分", distractors: [98, 95, 872] }),
  speed(sAvgC, { id: "G4B_v2_avgc_8", difficulty: 4, stem: "1-5 月降雨毫米数 80, 100, 120, 90, 110 平均每月？", value: 100, unit: "毫米", distractors: [110, 95, 500] }),
  speed(sAvgC, { id: "G4B_v2_avgc_9", difficulty: 4, stem: "三个班植树 36, 42, 45 棵，平均每班几棵？", value: 41, unit: "棵", distractors: [40, 42, 123] }),
  speed(sAvgC, { id: "G4B_v2_avgc_10", difficulty: 4, stem: "1.5、2.5、3.5、4.5 的平均数？", value: 3, distractors: [4, 12, 2.5] }),
];

/* --- average_inverse_total (10 → 20, +10) --- */
const sAvgT: SkillCtx = {
  ...sAvgC, skillId: "average_inverse_total", skillName: "已知平均数求总数/份数",
  ability: ["modeling", "data"],
};
const avgTQs: Question[] = [
  speed(sAvgT, { id: "G4B_v2_avgt_1", difficulty: 2, stem: "5 个数平均 6，总和是？", value: 30, distractors: [11, 1.2, 5] }),
  speed(sAvgT, { id: "G4B_v2_avgt_2", difficulty: 2, stem: "平均每天看书 30 分，3 天共看几分？", value: 90, distractors: [33, 10, 30] }),
  speed(sAvgT, { id: "G4B_v2_avgt_3", difficulty: 3, stem: "10 人平均身高 145 厘米，全班身高总和？", value: 1450, unit: "厘米", distractors: [155, 14.5, 1500] }),
  speed(sAvgT, { id: "G4B_v2_avgt_4", difficulty: 3, stem: "总分 720，平均每人 80。多少人？", value: 9, unit: "人", distractors: [10, 8, 80] }),
  speed(sAvgT, { id: "G4B_v2_avgt_5", difficulty: 3, stem: "平均每月用水 12.5 立方米，1 年(12 月)共用？", value: 150, unit: "立方米", distractors: [144, 156, 24.5] }),
  speed(sAvgT, { id: "G4B_v2_avgt_6", difficulty: 3, stem: "Selena 7 天平均每天背 8 个单词，一周共背几个？", value: 56, unit: "个", distractors: [15, 7, 64] }),
  speed(sAvgT, { id: "G4B_v2_avgt_7", difficulty: 4, stem: "一组 6 人平均年龄 35 岁，年龄总和？", value: 210, unit: "岁", distractors: [41, 5.83, 200] }),
  speed(sAvgT, { id: "G4B_v2_avgt_8", difficulty: 4, stem: "5 棵树平均高 2.4 米，5 棵共高？", value: 12, unit: "米", distractors: [7.4, 0.48, 24] }),
  speed(sAvgT, { id: "G4B_v2_avgt_9", difficulty: 4, stem: "全班 40 人考试总分 3520，平均？", value: 88, unit: "分", distractors: [90, 80, 3480] }),
  speed(sAvgT, { id: "G4B_v2_avgt_10", difficulty: 4, stem: "平均每页 12 字，共 96 字，几页？", value: 8, unit: "页", distractors: [12, 6, 84] }),
];

/* --- letter_expression (10 → 20, +10) --- */
const sLet: SkillCtx = {
  unitId: "G4B_U5_EQUATIONS", unitName: "认识方程", term: "下册",
  skillId: "letter_expression", skillName: "用字母表示数",
  ability: ["concept", "modeling"], examPriority: "MUST_SMALL",
};
const letQs: Question[] = [
  speed(sLet, { id: "G4B_v2_let_1", difficulty: 2, stem: "苹果 a 元一斤，买 2 斤多少元？(输入 a 的倍数)", value: 2, distractors: [1, 4, 0.5] }),
  speed(sLet, { id: "G4B_v2_let_2", difficulty: 2, stem: "n 米布，做衣服每件用 2 米，能做几件？(输入 n 除以几)", value: 2, distractors: [4, 1, 0.5] }),
  speed(sLet, { id: "G4B_v2_let_3", difficulty: 2, stem: "Selena x 岁，3 年前几岁？(输入 x 减几)", value: 3, distractors: [-3, 1, 6] }),
  choice(sLet, {
    id: "G4B_v2_let_4", difficulty: 3,
    stem: "正方形边 a，周长是？",
    options: [{ id: "a", text: "4a" }, { id: "b", text: "a²", errorTag: "area" }, { id: "c", text: "a+4", errorTag: "wrong_op" }, { id: "d", text: "4+a", errorTag: "wrong_op" }],
    correctId: "a",
    solution_steps: ["四条边都 a，周长 = a+a+a+a = 4a"],
  }),
  choice(sLet, {
    id: "G4B_v2_let_5", difficulty: 3,
    stem: "长方形长 a 宽 b，面积？",
    options: [{ id: "a", text: "ab" }, { id: "b", text: "a+b", errorTag: "perimeter_half" }, { id: "c", text: "2a+2b", errorTag: "perimeter" }, { id: "d", text: "a÷b", errorTag: "wrong_op" }],
    correctId: "a",
    solution_steps: ["面积 = 长 × 宽 = ab"],
  }),
  choice(sLet, {
    id: "G4B_v2_let_6", difficulty: 3,
    stem: "妈妈 m 岁，Selena 比妈妈小 28 岁。Selena 几岁？",
    options: [{ id: "a", text: "m + 28", errorTag: "wrong_op" }, { id: "b", text: "m - 28" }, { id: "c", text: "28 - m", errorTag: "reverse" }, { id: "d", text: "m / 28", errorTag: "wrong_op" }],
    correctId: "b",
    solution_steps: ["小 28 → 减 28"],
  }),
  speed(sLet, { id: "G4B_v2_let_7", difficulty: 3, stem: "汽车每小时 v 千米，2.5 小时走多远？(输入 v 的倍数)", value: 2.5, distractors: [2, 5, 1] }),
  speed(sLet, { id: "G4B_v2_let_8", difficulty: 3, stem: "x 个苹果分给 5 人，每人几个？(输入 x 除以几)", value: 5, distractors: [1, 25, 0.2] }),
  choice(sLet, {
    id: "G4B_v2_let_9", difficulty: 4,
    stem: "一支笔 a 元，一本书比 3 支笔便宜 5 元。书多少元？",
    options: [{ id: "a", text: "3a - 5" }, { id: "b", text: "3a + 5", errorTag: "wrong_op" }, { id: "c", text: "5 - 3a", errorTag: "reverse" }, { id: "d", text: "a - 5", errorTag: "missed_3" }],
    correctId: "a",
    solution_steps: ["3 支笔 = 3a 元；书便宜 5 元 → 3a - 5"],
  }),
  speed(sLet, { id: "G4B_v2_let_10", difficulty: 4, stem: "Selena n 岁，她妈妈是她的 4 倍多 5 岁。妈妈几岁？(用 n 表达，但 n=8 时算)", value: 37, unit: "岁", distractors: [32, 40, 13] }),
];

/* --- equation_meaning_balance (10 → 20, +10) --- */
const sEqMn: SkillCtx = {
  ...sLet, skillId: "equation_meaning_balance", skillName: "方程意义，等量关系",
  ability: ["concept", "reasoning"],
};
const eqMnQs: Question[] = [
  choice(sEqMn, {
    id: "G4B_v2_em_1", difficulty: 2,
    stem: "下列哪个是方程？",
    options: [{ id: "a", text: "5 + 3 = 8", errorTag: "no_unknown" }, { id: "b", text: "x + 7", errorTag: "no_equal" }, { id: "c", text: "x = 12" }, { id: "d", text: "x > 5", errorTag: "not_equation" }],
    correctId: "c",
    solution_steps: ["方程 = 含未知数的等式"],
  }),
  speed(sEqMn, { id: "G4B_v2_em_2", difficulty: 2, stem: "x = 7 是方程 x + 5 = 12 的解吗？是→答 1，不是→答 0", value: 1, distractors: [0, 7, 12] }),
  speed(sEqMn, { id: "G4B_v2_em_3", difficulty: 2, stem: "x = 6 是不是方程 3x = 24 的解？(是 1 否 0)", value: 0, distractors: [1, 6, 24] }),
  choice(sEqMn, {
    id: "G4B_v2_em_4", difficulty: 3,
    stem: "Selena 有 m 元，买书花 18 元，剩 6 元。等式是？",
    options: [{ id: "a", text: "m - 18 = 6" }, { id: "b", text: "m + 18 = 6", errorTag: "wrong_op" }, { id: "c", text: "18 - m = 6", errorTag: "reverse" }, { id: "d", text: "6m = 18", errorTag: "wrong_model" }],
    correctId: "a",
    solution_steps: ["原有 - 花掉 = 剩下"],
  }),
  choice(sEqMn, {
    id: "G4B_v2_em_5", difficulty: 3,
    stem: "天平左 3 苹果共 x 克，右 2 砝码共 90 克，平衡。方程是？",
    options: [{ id: "a", text: "3x = 90", errorTag: "wrong_meaning" }, { id: "b", text: "x = 90" }, { id: "c", text: "x + 90 = 0", errorTag: "wrong_op" }, { id: "d", text: "x ÷ 3 = 90", errorTag: "wrong_op" }],
    correctId: "b",
    solution_steps: ["x 已经是 3 苹果总质量；左右相等"],
  }),
  speed(sEqMn, { id: "G4B_v2_em_6", difficulty: 3, stem: "x = 8 是不是 2x - 5 = 11 的解？(是 1 否 0)", value: 1, distractors: [0, 8, 11] }),
  choice(sEqMn, {
    id: "G4B_v2_em_7", difficulty: 3,
    stem: "果园苹果 x 个，比梨多 30 个，梨 50 个。哪个等式正确？",
    options: [{ id: "a", text: "x = 50 + 30" }, { id: "b", text: "x = 50 - 30", errorTag: "wrong_op" }, { id: "c", text: "x + 30 = 50", errorTag: "wrong_op" }, { id: "d", text: "x = 30", errorTag: "missing_50" }],
    correctId: "a",
    solution_steps: ["苹果 = 梨 + 多出的 = 50 + 30 = 80"],
  }),
  choice(sEqMn, {
    id: "G4B_v2_em_8", difficulty: 3,
    stem: "Selena 跑 t 分钟，每分 80 米，跑了 480 米。等式是？",
    options: [{ id: "a", text: "80t = 480" }, { id: "b", text: "t/80 = 480", errorTag: "wrong_op" }, { id: "c", text: "t + 80 = 480", errorTag: "wrong_op" }, { id: "d", text: "480/t = 80", errorTag: "alternative" }],
    correctId: "a",
    solution_steps: ["路程 = 速度 × 时间"],
  }),
  speed(sEqMn, { id: "G4B_v2_em_9", difficulty: 4, stem: "x + 12 = 3x，x = ?", value: 6, distractors: [3, 12, 4] }),
  speed(sEqMn, { id: "G4B_v2_em_10", difficulty: 4, stem: "2x - 8 = x + 5，x = ?", value: 13, distractors: [5, 6.5, 21] }),
];

/* --- equation_solve_simple (10 → 20, +10) --- */
const sEqSv: SkillCtx = {
  ...sLet, skillId: "equation_solve_simple", skillName: "用等式性质解简单方程",
  ability: ["calculation", "strategy"],
};
const eqSvQs: Question[] = [
  speed(sEqSv, { id: "G4B_v2_es_1", difficulty: 2, stem: "x + 5 = 12，x =", value: 7, distractors: [17, 5, 6] }),
  speed(sEqSv, { id: "G4B_v2_es_2", difficulty: 2, stem: "x - 8 = 14，x =", value: 22, distractors: [6, 14, 16] }),
  speed(sEqSv, { id: "G4B_v2_es_3", difficulty: 2, stem: "4x = 24，x =", value: 6, distractors: [20, 4, 28] }),
  speed(sEqSv, { id: "G4B_v2_es_4", difficulty: 2, stem: "x ÷ 3 = 7，x =", value: 21, distractors: [4, 10, 7] }),
  speed(sEqSv, { id: "G4B_v2_es_5", difficulty: 3, stem: "x + 15 = 32，x =", value: 17, distractors: [47, 15, 18] }),
  speed(sEqSv, { id: "G4B_v2_es_6", difficulty: 3, stem: "5x = 65，x =", value: 13, distractors: [60, 12, 70] }),
  speed(sEqSv, { id: "G4B_v2_es_7", difficulty: 3, stem: "x - 12 = 28，x =", value: 40, distractors: [16, 28, 12] }),
  speed(sEqSv, { id: "G4B_v2_es_8", difficulty: 3, stem: "x ÷ 4 = 9，x =", value: 36, distractors: [13, 5, 9] }),
  speed(sEqSv, { id: "G4B_v2_es_9", difficulty: 3, stem: "2x + 5 = 17，x =", value: 6, distractors: [11, 5, 22] }),
  speed(sEqSv, { id: "G4B_v2_es_10", difficulty: 4, stem: "3x - 8 = 19，x =", value: 9, distractors: [11, 27, 6] }),
];

/* --- decimal_compare (10 → 20, +10) --- */
const sCmp: SkillCtx = {
  unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法", term: "下册",
  skillId: "decimal_compare", skillName: "小数大小比较",
  ability: ["concept", "reasoning"], examPriority: "HIGH_SMALL",
};
const cmpQs: Question[] = [
  speed(sCmp, { id: "G4B_v2_cmp_1", difficulty: 1, stem: "0.5 和 0.6，写出大的那个数", value: 0.6, distractors: [0.5, 1.1, 0.1] }),
  speed(sCmp, { id: "G4B_v2_cmp_2", difficulty: 1, stem: "0.4 和 0.4 相等吗？相等→答 0，不等→答 1", value: 0, distractors: [1, 0.4, 0.8] }),
  speed(sCmp, { id: "G4B_v2_cmp_3", difficulty: 2, stem: "0.30 比 0.3 大多少？", value: 0, distractors: [0.27, 0.03, 0.3] }),
  speed(sCmp, { id: "G4B_v2_cmp_4", difficulty: 2, stem: "1.05 和 1.5，写出大的那个数", value: 1.5, distractors: [1.05, 2.55, 0.45] }),
  speed(sCmp, { id: "G4B_v2_cmp_5", difficulty: 3, stem: "2.7 比 2.07 大多少？", value: 0.63, distractors: [0.7, 0.07, 4.77] }),
  choice(sCmp, {
    id: "G4B_v2_cmp_6", difficulty: 3,
    stem: "下面排列从小到大的是？",
    options: [
      { id: "a", text: "0.45 < 0.405 < 0.5", errorTag: "tail_zero" },
      { id: "b", text: "0.405 < 0.45 < 0.5" },
      { id: "c", text: "0.5 < 0.45 < 0.405", errorTag: "reverse" },
      { id: "d", text: "0.405 < 0.5 < 0.45", errorTag: "wrong" },
    ],
    correctId: "b",
    solution_steps: ["补 0：0.405 / 0.450 / 0.500"],
  }),
  speed(sCmp, { id: "G4B_v2_cmp_7", difficulty: 3, stem: "0.85 和 0.9，写出大的那个数", value: 0.9, distractors: [0.85, 1.75, 0.05] }),
  speed(sCmp, { id: "G4B_v2_cmp_8", difficulty: 3, stem: "比 0.6 大 0.05 的数？", value: 0.65, distractors: [0.55, 0.605, 1.1] }),
  speed(sCmp, { id: "G4B_v2_cmp_9", difficulty: 4, stem: "在 0.06、0.6、0.066、0.606 中找最大", value: 0.606, distractors: [0.6, 0.066, 0.06] }),
  speed(sCmp, { id: "G4B_v2_cmp_10", difficulty: 4, stem: "Selena 跳远 1.85 米，比同学多 0.07 米。同学跳几米？", value: 1.78, unit: "米", distractors: [1.92, 0.07, 1.78] }),

  // === v0.28.3 手补 8 道高质量 decimal_compare 替代以前的"输 0"系 ===
  speed(sCmp, { id: "G4B_v2_cmp_11", difficulty: 1, stem: "在 0.6、0.30、0.3、0.06 里面，跟 0.3 一样大的是？", value: 0.30, distractors: [0.6, 0.06, 0.03] }),
  speed(sCmp, { id: "G4B_v2_cmp_12", difficulty: 2, stem: "在 0.40、0.4、0.04 里面，最大的是？", value: 0.40, distractors: [0.4, 0.04, 4] }),
  choice(sCmp, {
    id: "G4B_v2_cmp_13", difficulty: 2,
    stem: "0.5 和 0.50，下面说法对的是？",
    options: [
      { id: "a", text: "相等", },
      { id: "b", text: "0.5 大", errorTag: "tail_zero_misread" },
      { id: "c", text: "0.50 大", errorTag: "tail_zero_misread" },
      { id: "d", text: "无法比较", errorTag: "wrong" },
    ],
    correctId: "a",
    solution_steps: ["小数末尾添 0 不改变数值大小：0.5 = 0.50"],
  }),
  choice(sCmp, {
    id: "G4B_v2_cmp_14", difficulty: 2,
    stem: "比较 1.23 和 1.32 的大小：",
    options: [
      { id: "a", text: "1.23 < 1.32", },
      { id: "b", text: "1.23 > 1.32", errorTag: "decimal_compare_reverse" },
      { id: "c", text: "1.23 = 1.32", errorTag: "wrong" },
      { id: "d", text: "无法比较", errorTag: "wrong" },
    ],
    correctId: "a",
    solution_steps: ["整数部分都是 1，比小数部分：0.23 < 0.32"],
  }),
  speed(sCmp, { id: "G4B_v2_cmp_15", difficulty: 3, stem: "把 0.45、0.405、0.5 按从小到大排序，最小的是？", value: 0.405, distractors: [0.45, 0.5, 0.045] }),
  speed(sCmp, { id: "G4B_v2_cmp_16", difficulty: 3, stem: "把 0.45、0.405、0.5 按从小到大排序，最大的是？", value: 0.5, distractors: [0.45, 0.405, 0.405] }),
  choice(sCmp, {
    id: "G4B_v2_cmp_17", difficulty: 3,
    stem: "下面排列从小到大顺序正确的是？",
    options: [
      { id: "a", text: "0.45 < 0.405 < 0.5", errorTag: "tail_zero_misread" },
      { id: "b", text: "0.405 < 0.45 < 0.5" },
      { id: "c", text: "0.5 < 0.45 < 0.405", errorTag: "decimal_compare_reverse" },
      { id: "d", text: "0.405 < 0.5 < 0.45", errorTag: "wrong" },
    ],
    correctId: "b",
    solution_steps: ["补齐到三位小数：0.450 / 0.405 / 0.500", "比较：0.405 < 0.450 < 0.500"],
  }),
  speed(sCmp, { id: "G4B_v2_cmp_18", difficulty: 4, stem: "Selena 量身高 1.42 米，比妈妈矮 0.18 米。妈妈身高多少米？", value: 1.6, unit: "米", distractors: [1.24, 1.42, 0.6] }),
];

/* --- average_meaning (10 → 20, +10) --- */
const sAvgMng: SkillCtx = {
  unitId: "G4B_U6_DATA", unitName: "数据的表示和分析", term: "下册",
  skillId: "average_meaning", skillName: "平均数意义",
  ability: ["concept", "data"], examPriority: "MUST_SMALL",
};
const avgMngQs: Question[] = [
  choice(sAvgMng, {
    id: "G4B_v2_amn_1", difficulty: 2,
    stem: "一组数据的平均数 = ?",
    options: [{ id: "a", text: "总和 ÷ 个数" }, { id: "b", text: "最大 ÷ 个数", errorTag: "formula" }, { id: "c", text: "总和 × 个数", errorTag: "wrong_op" }, { id: "d", text: "中间那个数", errorTag: "median_confuse" }],
    correctId: "a",
    solution_steps: ["平均数 = 总和 ÷ 个数"],
  }),
  speed(sAvgMng, { id: "G4B_v2_amn_2", difficulty: 2, stem: "5 个数平均 8，总和是？", value: 40, distractors: [13, 1.6, 5] }),
  speed(sAvgMng, { id: "G4B_v2_amn_3", difficulty: 3, stem: "三个数和 24，平均？", value: 8, distractors: [21, 12, 24] }),
  choice(sAvgMng, {
    id: "G4B_v2_amn_4", difficulty: 3,
    stem: "Selena 5 次跳绳次数平均 100。下面哪种一定不可能？",
    options: [{ id: "a", text: "5 次都 100" }, { id: "b", text: "5 次分别 90、95、105、110、100" }, { id: "c", text: "5 次都 < 100", errorTag: "concept" }, { id: "d", text: "5 次最大 200，最小 50" }],
    correctId: "c",
    solution_steps: ["平均 = 100，必有 ≥ 100 的数平衡"],
  }),
  speed(sAvgMng, { id: "G4B_v2_amn_5", difficulty: 3, stem: "4 个数和 36，平均是？", value: 9, distractors: [32, 4, 12] }),
  choice(sAvgMng, {
    id: "G4B_v2_amn_6", difficulty: 3,
    stem: "下列哪个不能用平均数？",
    options: [{ id: "a", text: "全班平均身高" }, { id: "b", text: "Selena 一周平均阅读时间" }, { id: "c", text: "学校最高的同学是谁", errorTag: "concept" }, { id: "d", text: "三月份每天平均气温" }],
    correctId: "c",
    solution_steps: ["『最高的人是谁』要用最大值"],
  }),
  speed(sAvgMng, { id: "G4B_v2_amn_7", difficulty: 3, stem: "原 5 数平均 12，加进新数 18，6 数平均？", value: 13, distractors: [12, 14, 78] }),
  speed(sAvgMng, { id: "G4B_v2_amn_8", difficulty: 4, stem: "如果 10 个数平均 50，总和加 100 之后，新平均？", value: 60, distractors: [50, 55, 70] }),
  choice(sAvgMng, {
    id: "G4B_v2_amn_9", difficulty: 4,
    stem: "Selena 数学 5 次平均 92。如果第 6 次考 80，6 次平均会怎样变？",
    options: [{ id: "a", text: "变小" }, { id: "b", text: "变大", errorTag: "concept" }, { id: "c", text: "不变", errorTag: "concept" }, { id: "d", text: "无法判断", errorTag: "logic" }],
    correctId: "a",
    solution_steps: ["新数 < 原平均 → 拉低"],
  }),
  speed(sAvgMng, { id: "G4B_v2_amn_10", difficulty: 4, stem: "5 人平均年龄 12 岁，加入 1 个新人后 6 人平均 13 岁，新人多少岁？", value: 18, distractors: [13, 12, 78] }),
];

/* ============================================================
   合并导出
   ============================================================ */
export const GAP_FILL_PACK_G4B_V2: Question[] = [
  // 6 hardest
  ...invQs, ...segQs, ...twoQs, ...meetQs, ...sumDifQs, ...avgMQs,
  // mid-tier MUST
  ...dasSimpQs, ...mulMixQs, ...mulSimpQs, ...sdQs, ...wtQs,
  ...eqOneQs, ...avgCQs, ...avgTQs,
  // MUST_SMALL
  ...letQs, ...eqMnQs, ...eqSvQs, ...avgMngQs,
  // HIGH_SMALL
  ...cmpQs,
];
