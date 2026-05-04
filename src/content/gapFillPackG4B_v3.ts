/**
 * 题量补齐包 v0.16.6 —— G4B 第三轮
 *
 * 把剩 11 个还不到 20 道的 skill 全部补到 20 道。
 * 难度分布按 D1:2 / D2:3-4 / D3:2-3 / D4:1-2 配置。
 *
 * 这一轮覆盖：
 *   decimal_meaning_place / decimal_unit_conversion
 *   triangle_inequality / triangle_angle_sum / triangle_classification
 *   decimal_mul_meaning / decimal_mul_vertical / decimal_product_digits
 *   decimal_price_quantity / observe_front_top_left / data_bar_chart
 */

import type { AbilityId, ExamPriority, Hint, Question, GameTemplate } from "../core/types";

const base = {
  version: 1 as const,
  status: "approved" as const,
  grade: 4 as const,
  source: { curriculum: "BNU_2013_G4", basis: "gap_fill_v016_6", copyright_safe: true, original: true },
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

interface NumQ { id: string; difficulty: 1|2|3|4|5; stem: string; value: number; unit?: string; distractors: number[]; hints?: Hint[]; time?: number; tags?: string[]; playAs?: GameTemplate; }
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
    hints: q.hints ?? [{ text: "别急，分两步想", penalty: 1 }],
    common_errors: [
      { tag: "careless_reading", error: "看错或算错", remediation: "重新读题。" },
      { tag: "decimal_point_error", error: "小数点放错位", remediation: "整数算完再点回小数。" },
    ],
    feedback_correct: "干得漂亮！",
    feedback_wrong: "再想想。",
    tags: q.tags,
  };
}

interface ChoiceQ { id: string; difficulty: 1|2|3|4|5; stem: string; options: { id: string; text: string; errorTag?: string }[]; correctId: string; solution_steps: string[]; hints?: Hint[]; time?: number; cognitive?: "recall"|"procedural"|"application"|"reasoning"; tags?: string[]; }
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
    hints: q.hints ?? [{ text: "排除明显错的", penalty: 1 }],
    common_errors: [
      { tag: "concept_confuse", error: "概念混淆", remediation: "回忆定义。" },
      { tag: "careless_reading", error: "看错题", remediation: "再读一次。" },
    ],
    feedback_correct: "判断很准！",
    feedback_wrong: "先排除明显错的。",
    tags: q.tags,
  };
}

/* ============================================================
   U1 · 小数意义 / 单位换算 / 比较
   ============================================================ */

const sMng: SkillCtx = { unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法", term: "下册", skillId: "decimal_meaning_place", skillName: "小数意义、小数数位", ability: ["concept"], examPriority: "MUST_SMALL" };
const mngQs: Question[] = [
  speed(sMng, { id: "G4B_v3_mng_1", difficulty: 1, stem: "0.7 表示 7 个 0.1。0.4 表示几个 0.1？", value: 4, distractors: [40, 0.4, 7] }),
  speed(sMng, { id: "G4B_v3_mng_2", difficulty: 1, stem: "5 个 0.1 写成小数是？", value: 0.5, distractors: [5, 0.05, 51] }),
  speed(sMng, { id: "G4B_v3_mng_3", difficulty: 2, stem: "0.83 中的 8 在哪一位？十分位→答 1，百分位→答 2，千分位→答 3", value: 1, distractors: [2, 3, 8] }),
  speed(sMng, { id: "G4B_v3_mng_4", difficulty: 2, stem: "12 个 0.01 写成小数是？", value: 0.12, distractors: [12, 1.2, 0.012] }),
  speed(sMng, { id: "G4B_v3_mng_5", difficulty: 2, stem: "3.05 里面的 5 表示 5 个多少？", value: 0.01, distractors: [0.1, 0.5, 0.05] }),
  speed(sMng, { id: "G4B_v3_mng_6", difficulty: 2, stem: "把 0.6 改写成 100 等分，是几个 0.01？", value: 60, distractors: [6, 0.06, 600] }),
  choice(sMng, { id: "G4B_v3_mng_7", difficulty: 3, stem: "下面对 4.205 解释正确的是？", options: [{ id: "a", text: "4 个一、2 个十分之一、5 个百分之一", errorTag: "place_skip" }, { id: "b", text: "4 个一、2 个十分之一、0 个百分之一、5 个千分之一" }, { id: "c", text: "4 个十、205 个百分之一", errorTag: "place_wrong" }, { id: "d", text: "42 个十分之一、5 个千分之一", errorTag: "place_wrong" }], correctId: "b", solution_steps: ["4.205 = 4 + 0.2 + 0.005 → 4 个一、2 个 0.1、0 个 0.01、5 个 0.001"] }),
  speed(sMng, { id: "G4B_v3_mng_8", difficulty: 3, stem: "由 3 个十、4 个一、6 个 0.01 组成的数是？", value: 34.06, distractors: [340.06, 34.6, 30.46] }),
  speed(sMng, { id: "G4B_v3_mng_9", difficulty: 3, stem: "0.025 是 25 个多少？", value: 0.001, distractors: [0.01, 0.1, 1] }),
  speed(sMng, { id: "G4B_v3_mng_10", difficulty: 4, stem: "由 5 个一、3 个 0.1、7 个 0.001 组成的数是多少？", value: 5.307, distractors: [5.37, 5.037, 537] }),
];

const sUC: SkillCtx = { ...sMng, skillId: "decimal_unit_conversion", skillName: "长度、质量、面积、人民币单位换算", ability: ["concept", "modeling"] };
const ucQs: Question[] = [
  speed(sUC, { id: "G4B_v3_uc_1", difficulty: 1, stem: "5 元 = 多少元？", value: 5, unit: "元", distractors: [50, 0.5, 500] }),
  speed(sUC, { id: "G4B_v3_uc_2", difficulty: 1, stem: "8 角 = ?元", value: 0.8, unit: "元", distractors: [8, 80, 0.08] }),
  speed(sUC, { id: "G4B_v3_uc_3", difficulty: 2, stem: "2 米 5 厘米 = ?米", value: 2.05, unit: "米", distractors: [2.5, 2.005, 25] }),
  speed(sUC, { id: "G4B_v3_uc_4", difficulty: 2, stem: "1 千克 250 克 = ?千克", value: 1.25, unit: "千克", distractors: [1.025, 1250, 12.5] }),
  speed(sUC, { id: "G4B_v3_uc_5", difficulty: 2, stem: "300 克 = ?千克", value: 0.3, unit: "千克", distractors: [3, 30, 0.03] }),
  speed(sUC, { id: "G4B_v3_uc_6", difficulty: 3, stem: "1 米 = ?分米", value: 10, unit: "分米", distractors: [1, 100, 0.1] }),
  speed(sUC, { id: "G4B_v3_uc_7", difficulty: 3, stem: "4.5 千米 = ?米", value: 4500, unit: "米", distractors: [450, 45, 45000] }),
  speed(sUC, { id: "G4B_v3_uc_8", difficulty: 3, stem: "350 平方厘米 = ?平方分米", value: 3.5, unit: "平方分米", distractors: [35, 0.35, 3500] }),
  speed(sUC, { id: "G4B_v3_uc_9", difficulty: 4, stem: "2 元 3 角 5 分 = ?元", value: 2.35, unit: "元", distractors: [2.305, 2.035, 235] }),
  speed(sUC, { id: "G4B_v3_uc_10", difficulty: 4, stem: "0.45 吨 = ?千克", value: 450, unit: "千克", distractors: [45, 4500, 0.045] }),
];

/* ============================================================
   U2 · 三角形 (三边/内角和/分类)
   ============================================================ */

const sTI: SkillCtx = { unitId: "G4B_U2_TRI_QUAD", unitName: "认识三角形和四边形", term: "下册", skillId: "triangle_inequality", skillName: "三角形三边关系", ability: ["reasoning", "spatial"], examPriority: "MUST_SMALL" };
const tiQs: Question[] = [
  speed(sTI, { id: "G4B_v3_ti_1", difficulty: 1, stem: "三边 3、4、5 能围成三角形吗？(能 1 不能 0)", value: 1, distractors: [0, 12, 5] }),
  choice(sTI, { id: "G4B_v3_ti_2", difficulty: 2, stem: "下面哪组三边不能围成三角形？", options: [{ id: "a", text: "5、5、5" }, { id: "b", text: "3、4、5" }, { id: "c", text: "1、2、5", errorTag: "violation" }, { id: "d", text: "6、6、8" }], correctId: "c", solution_steps: ["1+2=3 < 5 → 围不成"] }),
  speed(sTI, { id: "G4B_v3_ti_3", difficulty: 2, stem: "三边 6、6、12 能围成三角形吗？(能 1 不能 0)", value: 0, distractors: [1, 24, 6] }),
  speed(sTI, { id: "G4B_v3_ti_4", difficulty: 2, stem: "三边 7、8、9 能围成三角形吗？(能 1 不能 0)", value: 1, distractors: [0, 24, 16] }),
  choice(sTI, { id: "G4B_v3_ti_5", difficulty: 3, stem: "三角形两边 4 厘米和 9 厘米，第三边可能是？", options: [{ id: "a", text: "4 厘米", errorTag: "violation" }, { id: "b", text: "5 厘米", errorTag: "violation" }, { id: "c", text: "8 厘米" }, { id: "d", text: "13 厘米", errorTag: "violation" }], correctId: "c", solution_steps: ["第三边须 > |9-4|=5 且 < 9+4=13", "只有 8 满足"] }),
  speed(sTI, { id: "G4B_v3_ti_6", difficulty: 3, stem: "已知两边长 5 和 8 厘米，第三边长可以是哪个整数最大值？", value: 12, unit: "厘米", distractors: [13, 11, 3] }),
  speed(sTI, { id: "G4B_v3_ti_7", difficulty: 3, stem: "等腰三角形腰长 6 厘米，底边可能取的最大整数是？", value: 11, unit: "厘米", distractors: [12, 10, 6] }),
  speed(sTI, { id: "G4B_v3_ti_8", difficulty: 4, stem: "三角形三边都是整数，已知周长 12 厘米且为等腰，腰长可能是？(列其中一个)", value: 5, unit: "厘米", distractors: [6, 3, 4] }),
  choice(sTI, { id: "G4B_v3_ti_9", difficulty: 4, stem: "用 3 根小棒摆三角形，下哪组可以？", options: [{ id: "a", text: "2、3、6", errorTag: "violation" }, { id: "b", text: "4、5、9", errorTag: "violation" }, { id: "c", text: "5、6、10" }, { id: "d", text: "1、1、3", errorTag: "violation" }], correctId: "c", solution_steps: ["c：5+6=11 > 10，符合"] }),
];

const sAS: SkillCtx = { ...sTI, skillId: "triangle_angle_sum", skillName: "三角形内角和" };
const asQs: Question[] = [
  speed(sAS, { id: "G4B_v3_as_1", difficulty: 1, stem: "三角形三个内角和等于多少度？", value: 180, unit: "度", distractors: [90, 360, 270] }),
  speed(sAS, { id: "G4B_v3_as_2", difficulty: 2, stem: "三角形两角分别 60° 和 80°，第三个角多少度？", value: 40, unit: "度", distractors: [60, 140, 80] }),
  speed(sAS, { id: "G4B_v3_as_3", difficulty: 2, stem: "三角形两角各 50°，第三角？", value: 80, unit: "度", distractors: [180, 100, 50] }),
  speed(sAS, { id: "G4B_v3_as_4", difficulty: 2, stem: "直角三角形一锐角 35°，另一锐角多少度？", value: 55, unit: "度", distractors: [35, 145, 90] }),
  speed(sAS, { id: "G4B_v3_as_5", difficulty: 3, stem: "等腰三角形顶角 80°，底角多少度？", value: 50, unit: "度", distractors: [100, 80, 40] }),
  speed(sAS, { id: "G4B_v3_as_6", difficulty: 3, stem: "等腰三角形底角 45°，顶角多少度？", value: 90, unit: "度", distractors: [45, 135, 60] }),
  speed(sAS, { id: "G4B_v3_as_7", difficulty: 3, stem: "等边三角形每个角是多少度？", value: 60, unit: "度", distractors: [180, 90, 45] }),
  choice(sAS, { id: "G4B_v3_as_8", difficulty: 4, stem: "一个三角形，两个角的和是 110°，第三个角是？", options: [{ id: "a", text: "70°" }, { id: "b", text: "110°", errorTag: "concept" }, { id: "c", text: "180°", errorTag: "wrong_calc" }, { id: "d", text: "55°", errorTag: "wrong_calc" }], correctId: "a", solution_steps: ["180-110=70"] }),
  speed(sAS, { id: "G4B_v3_as_9", difficulty: 4, stem: "三角形一角 40°，另两角相等，每个相等的角多少度？", value: 70, unit: "度", distractors: [140, 40, 80] }),
];

const sTC: SkillCtx = { ...sTI, skillId: "triangle_classification", skillName: "按角/边给三角形分类", ability: ["concept", "spatial"], examPriority: "HIGH_SMALL" };
const tcQs: Question[] = [
  choice(sTC, { id: "G4B_v3_tc_1", difficulty: 1, stem: "有一个角是 90° 的三角形是？", options: [{ id: "a", text: "锐角三角形", errorTag: "confuse" }, { id: "b", text: "直角三角形" }, { id: "c", text: "钝角三角形", errorTag: "confuse" }, { id: "d", text: "等边三角形", errorTag: "concept" }], correctId: "b", solution_steps: ["按角分：有直角 → 直角三角形"] }),
  choice(sTC, { id: "G4B_v3_tc_2", difficulty: 1, stem: "三条边都相等的三角形叫？", options: [{ id: "a", text: "等腰三角形", errorTag: "subset" }, { id: "b", text: "等边三角形" }, { id: "c", text: "直角三角形", errorTag: "wrong" }, { id: "d", text: "锐角三角形", errorTag: "wrong" }], correctId: "b", solution_steps: ["三边相等 → 等边（也是特殊等腰）"] }),
  choice(sTC, { id: "G4B_v3_tc_3", difficulty: 2, stem: "有两条边相等的三角形叫？", options: [{ id: "a", text: "等腰三角形" }, { id: "b", text: "等边三角形", errorTag: "subset" }, { id: "c", text: "直角三角形", errorTag: "wrong" }, { id: "d", text: "锐角三角形", errorTag: "wrong" }], correctId: "a", solution_steps: ["两条边相等就是等腰"] }),
  choice(sTC, { id: "G4B_v3_tc_4", difficulty: 2, stem: "三个角都小于 90° 的三角形是？", options: [{ id: "a", text: "锐角三角形" }, { id: "b", text: "直角三角形", errorTag: "concept" }, { id: "c", text: "钝角三角形", errorTag: "concept" }, { id: "d", text: "等边三角形", errorTag: "subset" }], correctId: "a", solution_steps: ["三个角都是锐角 → 锐角三角形"] }),
  choice(sTC, { id: "G4B_v3_tc_5", difficulty: 2, stem: "等边三角形按角分属于哪类？", options: [{ id: "a", text: "锐角三角形" }, { id: "b", text: "直角三角形", errorTag: "wrong" }, { id: "c", text: "钝角三角形", errorTag: "wrong" }, { id: "d", text: "都不是", errorTag: "concept" }], correctId: "a", solution_steps: ["三个角都 60° (< 90°) → 锐角三角形"] }),
  choice(sTC, { id: "G4B_v3_tc_6", difficulty: 3, stem: "下面说法对的是？", options: [{ id: "a", text: "直角三角形可以是等腰", errorTag: "" }, { id: "b", text: "钝角三角形一定是等腰", errorTag: "wrong" }, { id: "c", text: "等边一定是钝角", errorTag: "wrong" }, { id: "d", text: "锐角一定是等腰", errorTag: "wrong" }], correctId: "a", solution_steps: ["a 对：例如 45°/45°/90° 的等腰直角三角形"] }),
  choice(sTC, { id: "G4B_v3_tc_7", difficulty: 3, stem: "一个三角形最大角 70°，最小角 50°，按角分是？", options: [{ id: "a", text: "锐角三角形" }, { id: "b", text: "直角三角形", errorTag: "wrong" }, { id: "c", text: "钝角三角形", errorTag: "wrong" }, { id: "d", text: "无法确定", errorTag: "concept" }], correctId: "a", solution_steps: ["三角形最大角才决定类型；70° < 90° → 锐角"] }),
  choice(sTC, { id: "G4B_v3_tc_8", difficulty: 4, stem: "已知三角形两个角 30° 和 50°，第三个角和分类？", options: [{ id: "a", text: "100°，钝角" }, { id: "b", text: "100°，锐角", errorTag: "wrong_class" }, { id: "c", text: "80°，锐角", errorTag: "wrong_calc" }, { id: "d", text: "80°，直角", errorTag: "wrong" }], correctId: "a", solution_steps: ["180-30-50=100° (>90°) → 钝角三角形"] }),
];

/* ============================================================
   U3 · 小数乘法 (意义/竖式/积位数/购物)
   ============================================================ */

const sMM: SkillCtx = { unitId: "G4B_U3_DECIMAL_MULTIPLY", unitName: "小数乘法", term: "下册", skillId: "decimal_mul_meaning", skillName: "小数乘法意义", ability: ["concept"], examPriority: "MUST_SMALL" };
const mmQs: Question[] = [
  speed(sMM, { id: "G4B_v3_mm_1", difficulty: 1, stem: "0.5 × 2 = ?", value: 1, distractors: [10, 0.1, 2.5] }),
  speed(sMM, { id: "G4B_v3_mm_2", difficulty: 1, stem: "0.3 × 3 = ?", value: 0.9, distractors: [9, 0.09, 6] }),
  speed(sMM, { id: "G4B_v3_mm_3", difficulty: 2, stem: "0.7 × 5 表示什么？(输入结果)", value: 3.5, distractors: [35, 0.35, 5.7] }),
  speed(sMM, { id: "G4B_v3_mm_4", difficulty: 2, stem: "1.5 × 4 = ?", value: 6, distractors: [60, 0.6, 5.4] }),
  speed(sMM, { id: "G4B_v3_mm_5", difficulty: 2, stem: "2.4 × 3 表示 3 个 2.4 相加，结果？", value: 7.2, distractors: [72, 0.72, 6.4] }),
  speed(sMM, { id: "G4B_v3_mm_6", difficulty: 2, stem: "0.9 × 6 = ?", value: 5.4, distractors: [54, 6.9, 0.54] }),
  speed(sMM, { id: "G4B_v3_mm_7", difficulty: 3, stem: "0.15 × 4 表示 4 个 0.15，等于？", value: 0.6, distractors: [6, 0.06, 4.15] }),
  speed(sMM, { id: "G4B_v3_mm_8", difficulty: 3, stem: "1.2 × 7 = ?", value: 8.4, distractors: [84, 0.84, 8.7] }),
  speed(sMM, { id: "G4B_v3_mm_9", difficulty: 3, stem: "0.45 × 2 = ?", value: 0.9, distractors: [9, 0.09, 0.47] }),
  speed(sMM, { id: "G4B_v3_mm_10", difficulty: 4, stem: "0.36 × 5 = ?", value: 1.8, distractors: [18, 0.18, 1.85] }),
];

const sMV: SkillCtx = { ...sMM, skillId: "decimal_mul_vertical", skillName: "小数乘法竖式", ability: ["calculation"], examPriority: "MUST_BIG" };
const mvQs: Question[] = [
  speed(sMV, { id: "G4B_v3_mv_1", difficulty: 3, stem: "0.78 × 9 = ?", value: 7.02, distractors: [70.2, 7.2, 6.92] }),
  speed(sMV, { id: "G4B_v3_mv_2", difficulty: 4, stem: "1.25 × 24 = ?", value: 30, distractors: [3, 300, 25.25] }),
  speed(sMV, { id: "G4B_v3_mv_3", difficulty: 4, stem: "2.36 × 15 = ?", value: 35.4, distractors: [354, 3.54, 35] }),
  speed(sMV, { id: "G4B_v3_mv_4", difficulty: 4, stem: "0.85 × 16 = ?", value: 13.6, distractors: [136, 1.36, 13.5] }),
];

const sPD: SkillCtx = { ...sMM, skillId: "decimal_product_digits", skillName: "积的小数位数判断", ability: ["strategy", "calculation"] };
const pdQs: Question[] = [
  speed(sPD, { id: "G4B_v3_pd_1", difficulty: 1, stem: "0.4 × 6 积有几位小数？", value: 1, distractors: [2, 0, 3] }),
  speed(sPD, { id: "G4B_v3_pd_2", difficulty: 1, stem: "1.2 × 0.5 积有几位小数？", value: 2, distractors: [1, 3, 0] }),
  speed(sPD, { id: "G4B_v3_pd_3", difficulty: 2, stem: "已知 35 × 28 = 980，那么 0.35 × 28 = ?", value: 9.8, distractors: [98, 0.98, 980] }),
  speed(sPD, { id: "G4B_v3_pd_4", difficulty: 2, stem: "已知 12 × 5 = 60，那么 1.2 × 0.5 = ?", value: 0.6, distractors: [6, 0.06, 60] }),
  speed(sPD, { id: "G4B_v3_pd_5", difficulty: 2, stem: "0.04 × 0.3 = ?", value: 0.012, distractors: [0.12, 1.2, 0.0012] }),
  speed(sPD, { id: "G4B_v3_pd_6", difficulty: 2, stem: "1.2 × 0.45 积有几位小数？", value: 3, distractors: [2, 1, 4] }),
  speed(sPD, { id: "G4B_v3_pd_7", difficulty: 3, stem: "1.5 × 1.2 = ?", value: 1.8, distractors: [18, 0.18, 2.7] }),
  speed(sPD, { id: "G4B_v3_pd_8", difficulty: 3, stem: "0.25 × 0.4 末尾去 0 后是？", value: 0.1, distractors: [0.10, 0.01, 1] }),
  speed(sPD, { id: "G4B_v3_pd_9", difficulty: 3, stem: "已知 25 × 36 = 900，那么 0.25 × 3.6 = ?", value: 0.9, distractors: [9, 0.09, 0.9] }),
  speed(sPD, { id: "G4B_v3_pd_10", difficulty: 4, stem: "0.05 × 0.04 = ?", value: 0.002, distractors: [0.02, 0.0002, 0.2] }),
];

const sPQ: SkillCtx = { ...sMM, skillId: "decimal_price_quantity", skillName: "总价=单价×数量，购物问题", ability: ["modeling", "calculation"], examPriority: "MUST_BIG" };
const pqQs: Question[] = [
  speed(sPQ, { id: "G4B_v3_pq_1", difficulty: 1, stem: "苹果 5 元一斤，买 3 斤多少元？", value: 15, unit: "元", distractors: [8, 25, 35] }),
  speed(sPQ, { id: "G4B_v3_pq_2", difficulty: 2, stem: "笔 2.5 元一支，买 4 支多少元？", value: 10, unit: "元", distractors: [6.5, 12.5, 8] }),
  speed(sPQ, { id: "G4B_v3_pq_3", difficulty: 2, stem: "牛奶 3.6 元一盒，5 盒多少元？", value: 18, unit: "元", distractors: [15, 20, 8.6] }),
  speed(sPQ, { id: "G4B_v3_pq_4", difficulty: 3, stem: "Selena 买 6 块橡皮，每块 0.8 元，共多少元？", value: 4.8, unit: "元", distractors: [4, 5, 6.8] }),
  speed(sPQ, { id: "G4B_v3_pq_5", difficulty: 3, stem: "面包 4.5 元一个，买 8 个共多少元？", value: 36, unit: "元", distractors: [12.5, 35, 40] }),
  speed(sPQ, { id: "G4B_v3_pq_6", difficulty: 3, stem: "汽油每升 7.8 元，加 12 升要多少元？", value: 93.6, unit: "元", distractors: [80, 100, 19.8] }),
  speed(sPQ, { id: "G4B_v3_pq_7", difficulty: 4, stem: "妈妈买 2.5 千克猪肉，每千克 32 元。共多少元？", value: 80, unit: "元", distractors: [64, 90, 34.5] }),
  speed(sPQ, { id: "G4B_v3_pq_8", difficulty: 4, stem: "Selena 买 3 件文具：尺子 2.5 元、笔记本 8.5 元、铅笔盒 15.4 元。共多少元？", value: 26.4, unit: "元", distractors: [25, 30, 11] }),
  speed(sPQ, { id: "G4B_v3_pq_9", difficulty: 4, stem: "饭店每位 38.5 元，5 个人共多少元？", value: 192.5, unit: "元", distractors: [200, 43.5, 190] }),
];

/* ============================================================
   U4 · 观察物体
   ============================================================ */

const sOb: SkillCtx = { unitId: "G4B_U4_OBSERVE_OBJECTS", unitName: "观察物体", term: "下册", skillId: "observe_front_top_left", skillName: "正面、上面、左面观察", ability: ["spatial"], examPriority: "LOW_SMALL" };
const obQs: Question[] = [
  choice(sOb, { id: "G4B_v3_ob_1", difficulty: 1, stem: "用 4 个相同的小正方体搭一个 2×2×1 的长方体。从正面看到的是？", options: [{ id: "a", text: "2 个并排的正方形" }, { id: "b", text: "4 个正方形", errorTag: "all_views" }, { id: "c", text: "1 个正方形", errorTag: "wrong" }, { id: "d", text: "3 个", errorTag: "wrong" }], correctId: "a", solution_steps: ["2×2×1 从正面看是一个 2×1 的长方形 = 2 个并排正方形"] }),
  choice(sOb, { id: "G4B_v3_ob_2", difficulty: 2, stem: "搭 3 个正方体排成一行。从上面看到几个正方形？", options: [{ id: "a", text: "1 个", errorTag: "wrong" }, { id: "b", text: "2 个", errorTag: "wrong" }, { id: "c", text: "3 个" }, { id: "d", text: "9 个", errorTag: "all_faces" }], correctId: "c", solution_steps: ["上面看到 3 个并排的正方形"] }),
  choice(sOb, { id: "G4B_v3_ob_3", difficulty: 2, stem: "用 5 个正方体搭一个L 形（4 个排成一行+第 1 列上面再叠 1 个）。从正面看是？", options: [{ id: "a", text: "L 形 (5 个正方形)" }, { id: "b", text: "T 形", errorTag: "wrong" }, { id: "c", text: "5 个排成一行", errorTag: "view_confuse" }, { id: "d", text: "2 行各 2 个", errorTag: "wrong" }], correctId: "a", solution_steps: ["从正面看到的就是 L 形"] }),
  choice(sOb, { id: "G4B_v3_ob_4", difficulty: 2, stem: "Selena 搭一个 3 个正方体竖直叠起来的柱子。从左面看到？", options: [{ id: "a", text: "3 个正方形竖排" }, { id: "b", text: "1 个正方形", errorTag: "view_confuse" }, { id: "c", text: "3 个横排", errorTag: "wrong" }, { id: "d", text: "9 个", errorTag: "wrong" }], correctId: "a", solution_steps: ["左面看到 3 个竖排"] }),
  choice(sOb, { id: "G4B_v3_ob_5", difficulty: 3, stem: "搭一个 2×2×2 的大正方体（共 8 块）。从正面看是？", options: [{ id: "a", text: "2×2 的正方形（4 个小正方形）" }, { id: "b", text: "8 个", errorTag: "all_faces" }, { id: "c", text: "1 个", errorTag: "wrong" }, { id: "d", text: "3×3", errorTag: "wrong" }], correctId: "a", solution_steps: ["从正面看就是一面，2×2 = 4 个小正方形"] }),
  choice(sOb, { id: "G4B_v3_ob_6", difficulty: 3, stem: "用 4 个正方体搭一个十字形（中间 1 块，前后左右各 1 块）。从上面看是？", options: [{ id: "a", text: "十字形" }, { id: "b", text: "4 个排成一行", errorTag: "wrong" }, { id: "c", text: "正方形", errorTag: "wrong" }, { id: "d", text: "L 形", errorTag: "wrong" }], correctId: "a", solution_steps: ["从上方俯视十字形 → 看到十字形"] }),
  choice(sOb, { id: "G4B_v3_ob_7", difficulty: 4, stem: "搭这样：底层 3 个排一行，上面只在中间叠 1 个。从正面看是？", options: [{ id: "a", text: "T 形（下 3 横、上 1 块）" }, { id: "b", text: "L 形", errorTag: "wrong" }, { id: "c", text: "正方形", errorTag: "wrong" }, { id: "d", text: "4 个一行", errorTag: "wrong" }], correctId: "a", solution_steps: ["正面观察就是底 3 上 1 → T 形"] }),
  choice(sOb, { id: "G4B_v3_ob_8", difficulty: 4, stem: "Selena 用 6 个正方体搭一个 3×2×1 的长方体。从左面看是？", options: [{ id: "a", text: "1 个正方形" }, { id: "b", text: "2 个并排", errorTag: "view_confuse" }, { id: "c", text: "3 个并排", errorTag: "view_confuse" }, { id: "d", text: "6 个", errorTag: "all_faces" }], correctId: "a", solution_steps: ["3×2×1 长方体，从左面（短边方向）看就是 1×1 的正方形"] }),
];

/* ============================================================
   U6 · 数据 / 条形图
   ============================================================ */

const sBC: SkillCtx = { unitId: "G4B_U6_DATA", unitName: "数据的表示和分析", term: "下册", skillId: "data_bar_chart", skillName: "条形统计图读图", ability: ["data", "calculation"], examPriority: "HIGH_SMALL" };
const bcQs: Question[] = [
  speed(sBC, { id: "G4B_v3_bc_1", difficulty: 1, stem: "条形图：A=15、B=20、C=10。最高的是哪个数？", value: 20, distractors: [10, 15, 45] }),
  speed(sBC, { id: "G4B_v3_bc_2", difficulty: 1, stem: "周一卖 30 杯，周二卖 25 杯。两天共卖几杯？", value: 55, unit: "杯", distractors: [5, 50, 60] }),
  speed(sBC, { id: "G4B_v3_bc_3", difficulty: 2, stem: "条形图：5 类水果数量 8、12、20、15、10。哪类最多？(输该数量)", value: 20, distractors: [12, 8, 65] }),
  speed(sBC, { id: "G4B_v3_bc_4", difficulty: 2, stem: "三班植树 24、30、18 棵。一共多少？", value: 72, unit: "棵", distractors: [70, 75, 30] }),
  speed(sBC, { id: "G4B_v3_bc_5", difficulty: 2, stem: "条形图：4 个班借书 25、30、28、22 本。最多比最少多几本？", value: 8, unit: "本", distractors: [7, 5, 105] }),
  speed(sBC, { id: "G4B_v3_bc_6", difficulty: 2, stem: "Selena 一周阅读分钟数 30、35、40、25、50、20、30，周中(周三)看了几分钟？", value: 40, unit: "分钟", distractors: [30, 35, 50] }),
  speed(sBC, { id: "G4B_v3_bc_7", difficulty: 3, stem: "5 班植树 12、18、25、20、15 棵。前 2 班合计是？", value: 30, unit: "棵", distractors: [40, 25, 90] }),
  speed(sBC, { id: "G4B_v3_bc_8", difficulty: 3, stem: "条形图：男生身高平均 145，女生平均 142。男生比女生平均高几厘米？", value: 3, unit: "厘米", distractors: [2, 287, 4] }),
  speed(sBC, { id: "G4B_v3_bc_9", difficulty: 3, stem: "周一到周五气温 18、20、22、24、20。最高比最低高几度？", value: 6, unit: "度", distractors: [4, 8, 104] }),
  speed(sBC, { id: "G4B_v3_bc_10", difficulty: 4, stem: "1-4 月卖出 320、450、380、500 件。平均每月几件？", value: 412.5, unit: "件", distractors: [400, 450, 1650] }),
];

/* ============================================================
   合并导出
   ============================================================ */
export const GAP_FILL_PACK_G4B_V3: Question[] = [
  ...mngQs, ...ucQs,
  ...tiQs, ...asQs, ...tcQs,
  ...mmQs, ...mvQs, ...pdQs, ...pqQs,
  ...obQs,
  ...bcQs,
];
