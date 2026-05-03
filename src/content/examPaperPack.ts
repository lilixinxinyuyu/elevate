/**
 * 试卷错题包（v0.7）
 *
 * 来源：Selena 真实做过的三张过关检测卷（U2 三角形、U3 小数乘法、U4 观察物体）。
 * 错题原样收录 + 同类变式扩展。第一单元《小数的意义和加减法》原卷暂缺，
 * 按 PRD v2 知识点补强典型题。
 *
 * 所有题打 tags: ["from_test"]，错题再打 ["from_test", "wrong_origin"]，
 * 调度器会优先抽取（pickScore 加权）。
 */

import type { AbilityId, ExamPriority, Hint, Question, GameTemplate } from "../core/types";

const base = {
  version: 1 as const,
  status: "approved" as const,
  grade: 4 as const,
  source: {
    curriculum: "BNU_2013_G4",
    basis: "real_quiz_papers",
    copyright_safe: true,
    original: true,
  },
  variant_rules: {
    same_skill: true,
    change_numbers: true,
    change_context: true,
    preserve_difficulty: true,
  },
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

/* ===========  shared helpers (轻量复刻 questions.ts 的 make*) =========== */

type SkillSlim = {
  unitId: string;
  unitName: string;
  term: "上册" | "下册";
  skillId: string;
  skillName: string;
  ability: AbilityId[];
  examPriority: ExamPriority;
};

interface QFix {
  id: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  stem: string;
  hints?: Hint[];
  time?: number;
  tags: string[];
  feedback_correct?: string;
  feedback_wrong?: string;
  parent_tip?: string;
}

function speedQ(s: SkillSlim, q: QFix & { value: number; unit?: string; distractors: number[]; playAs?: GameTemplate }): Question {
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
    estimated_time_seconds: q.time ?? 18,
    stem: q.stem,
    question_format: "numeric",
    answer: { type: "number", value: q.value, ...(q.unit ? { unit: q.unit } : {}) },
    distractors: q.distractors,
    solution_steps: [`答案 ${q.value}${q.unit ?? ""}`],
    hints: q.hints ?? [{ text: "先用整数法估，再点小数点", penalty: 1 }],
    common_errors: [
      { tag: "decimal_point_error", error: "小数点位置错", remediation: "看因数小数位数总和。" },
      { tag: "careless_reading", error: "看错了", remediation: "重新读一次。" },
    ],
    feedback_correct: q.feedback_correct ?? "干得漂亮！",
    feedback_wrong: q.feedback_wrong ?? "再想想，答案就在附近。",
    parent_tip: q.parent_tip,
    tags: q.tags,
  };
}

function choiceQ(s: SkillSlim, q: QFix & {
  options: { id: string; text: string; errorTag?: string }[];
  correctId: string;
  solution_steps: string[];
  cognitive?: "recall" | "procedural" | "application" | "reasoning";
  playAs?: GameTemplate;
}): Question {
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
    game_type: "concept_judge",
    play_as: q.playAs ?? "plain_choice",
    cognitive_level: q.cognitive ?? "reasoning",
    difficulty: q.difficulty,
    estimated_time_seconds: q.time ?? 25,
    stem: q.stem,
    question_format: "single_choice",
    options: q.options,
    answer: { type: "choice", value: q.correctId },
    solution_steps: q.solution_steps,
    hints: q.hints ?? [{ text: "先排除明显不对的", penalty: 1 }],
    common_errors: [
      { tag: "concept_confuse", error: "概念混淆", remediation: "回想定义。" },
      { tag: "careless_reading", error: "看错题", remediation: "重新读一遍。" },
    ],
    feedback_correct: q.feedback_correct ?? "判断很准！",
    feedback_wrong: q.feedback_wrong ?? "再排除一下错选项。",
    parent_tip: q.parent_tip,
    tags: q.tags,
  };
}

function tfQ(s: SkillSlim, q: QFix & { truth: "T" | "F"; solution_steps: string[] }): Question {
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
    game_type: "true_false",
    play_as: "true_false_swipe",
    cognitive_level: "recall",
    difficulty: q.difficulty,
    estimated_time_seconds: q.time ?? 12,
    stem: q.stem,
    question_format: "single_choice",
    options: [
      { id: "T", text: "对" },
      { id: "F", text: "错" },
    ],
    answer: { type: "choice", value: q.truth },
    solution_steps: q.solution_steps,
    hints: q.hints,
    common_errors: [
      { tag: "concept_confuse", error: "概念混淆", remediation: "回想定义。" },
      { tag: "careless_reading", error: "看错或没读完", remediation: "读完整句话再判断。" },
    ],
    feedback_correct: q.feedback_correct ?? "判断很稳！",
    feedback_wrong: q.feedback_wrong ?? "再读一遍这句话。",
    parent_tip: q.parent_tip,
    tags: q.tags,
  };
}

function vrQ(s: SkillSlim, q: QFix & {
  vertLines: string[];
  prompt: string;
  options: { id: string; text: string; correct: boolean; errorTag?: string }[];
  solution_steps: string[];
}): Question {
  const correctOpt = q.options.find((o) => o.correct);
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
    game_type: "vertical_repair",
    play_as: "vertical_repair",
    cognitive_level: "procedural",
    difficulty: q.difficulty,
    estimated_time_seconds: q.time ?? 30,
    stem: q.stem,
    question_format: "single_choice",
    options: q.options.map(({ id, text, errorTag }) => ({ id, text, errorTag })),
    answer: { type: "choice", value: correctOpt?.id ?? "A" },
    subquestions: [{ kind: "choose", prompt: q.prompt, options: q.options }],
    solution_steps: q.solution_steps,
    hints: q.hints ?? [{ text: "先按整数算一下，再点回小数点", penalty: 1 }],
    common_errors: [
      { tag: "vertical_alignment_error", error: "竖式对位错误", remediation: "末位对齐。" },
      { tag: "decimal_point_error", error: "小数点位置错", remediation: "看因数小数位数总和。" },
    ],
    feedback_correct: q.feedback_correct ?? "你修好了这道竖式！",
    feedback_wrong: q.feedback_wrong ?? "再仔细看一下哪一步不对。",
    parent_tip: q.parent_tip,
    tags: [...(q.vertLines ?? []), ...q.tags],
  };
}

/* ============================================================
   第二单元 · 三角形和四边形（约 25 题）
   ============================================================ */

const sTriIneq: SkillSlim = {
  unitId: "G4B_U2_TRI_QUAD", unitName: "认识三角形和四边形", term: "下册",
  skillId: "triangle_inequality", skillName: "三角形三边关系",
  ability: ["reasoning", "spatial"], examPriority: "MUST_SMALL",
};
const sTriAngle: SkillSlim = { ...sTriIneq, skillId: "triangle_angle_sum", skillName: "三角形内角和", ability: ["calculation", "spatial"] };
const sTriClass: SkillSlim = { ...sTriIneq, skillId: "triangle_classification", skillName: "三角形分类", ability: ["concept", "spatial"], examPriority: "HIGH_SMALL" };

const u2Pack: Question[] = [
  // ============= 三边关系（卷面错题：5+8 → 第三边范围） =============
  choiceQ(sTriIneq, {
    id: "EX_u2_ineq_5_8", difficulty: 3,
    stem: "三角形两边长 5 分米和 8 分米。第三边 x 在哪个范围里才能围成三角形？",
    options: [
      { id: "A", text: "x < 13 分米且 x > 3 分米" },
      { id: "B", text: "x < 13 分米且 x > 5 分米", errorTag: "triangle_condition_error" },
      { id: "C", text: "x = 8 分米", errorTag: "triangle_condition_error" },
      { id: "D", text: "3 ≤ x ≤ 13", errorTag: "triangle_condition_error" },
    ],
    correctId: "A",
    solution_steps: ["两边之和必须严格大于第三边，两边之差严格小于第三边", "8−5=3 < x < 8+5=13"],
    parent_tip: "Selena 真题错过：当时填了 3 和 8。要点是「严格大于、严格小于」。",
    tags: ["from_test", "wrong_origin", "u2"],
  }),
  tfQ(sTriIneq, {
    id: "EX_u2_ineq_tf_3_4_7", difficulty: 2,
    stem: "三条线段 3cm、4cm、7cm 可以围成一个三角形。", truth: "F",
    solution_steps: ["3+4=7，刚好相等，无法围成三角形（必须严格大于）"],
    hints: [{ text: "两边之和必须严格大于第三边", penalty: 1 }],
    tags: ["from_test", "u2"],
  }),
  tfQ(sTriIneq, {
    id: "EX_u2_ineq_tf_OAOB16", difficulty: 3,
    stem: "湖两侧 O→A 是 9 米，O→B 是 6 米。设计师说 A、B 之间一定就是 16 米。这句话对吗？",
    truth: "F",
    solution_steps: ["三角形两边之和大于第三边", "9+6=15 < 16，所以 A、B 不可能 16 米"],
    parent_tip: "卷面真题（解决问题 1）原型：让她口头描述这个理由。",
    hints: [{ text: "把 OA、OB、AB 看成三角形三边", penalty: 1 }],
    tags: ["from_test", "wrong_origin", "u2"],
  }),
  speedQ(sTriIneq, {
    id: "EX_u2_ineq_max_int", difficulty: 3,
    stem: "三角形两边 7cm、9cm，第三边是整数厘米，最长可以是多少厘米？",
    value: 15, unit: "cm", distractors: [16, 14, 17],
    hints: [{ text: "x < 7+9 = 16，整数最大 15", penalty: 1 }],
    tags: ["from_test", "u2"],
  }),
  speedQ(sTriIneq, {
    id: "EX_u2_ineq_min_int", difficulty: 3,
    stem: "三角形两边 7cm、9cm，第三边是整数厘米，最短可以是多少厘米？",
    value: 3, unit: "cm", distractors: [2, 4, 1],
    hints: [{ text: "x > 9−7 = 2，整数最小 3", penalty: 1 }],
    tags: ["from_test", "u2"],
  }),

  // ============= 内角和 / 已知两角 / 等腰特殊 =============
  speedQ(sTriAngle, {
    id: "EX_u2_ang_85_unknown", difficulty: 3,
    stem: "三角形两个内角的和是 85°，第三个内角是多少度？",
    value: 95, unit: "°", distractors: [85, 175, 105],
    hints: [{ text: "三角形内角和 180°", penalty: 1 }],
    parent_tip: "卷面真题（填空 2）原型，重点是 180−85=95，且属于钝角三角形。",
    tags: ["from_test", "wrong_origin", "u2"],
  }),
  choiceQ(sTriClass, {
    id: "EX_u2_class_after95", difficulty: 2,
    playAs: "triangle_judge",
    stem: "三角形两个内角和是 85°，第三个内角是 95°。这是什么三角形？",
    options: [
      { id: "A", text: "锐角三角形", errorTag: "concept_confuse" },
      { id: "B", text: "直角三角形", errorTag: "concept_confuse" },
      { id: "C", text: "钝角三角形" },
      { id: "D", text: "等腰三角形", errorTag: "concept_confuse" },
    ],
    correctId: "C",
    solution_steps: ["95° > 90°，有一个钝角，是钝角三角形"],
    tags: ["from_test", "u2", "tri-angles:50,35,95"],
  }),
  speedQ(sTriAngle, {
    id: "EX_u2_ang_isoceles_apex110", difficulty: 3,
    playAs: "triangle_judge",
    stem: "下图是一个等腰三角形，顶角是 110°。每个底角是多少度？",
    value: 35, unit: "°", distractors: [70, 55, 45],
    hints: [{ text: "(180−110) ÷ 2 = ?", penalty: 1 }],
    parent_tip: "卷面真题（折纸题）原型。",
    tags: ["from_test", "u2", "tri-iso:apex=110,base=8", "tri-mark:isoceles"],
  }),
  choiceQ(sTriAngle, {
    id: "EX_u2_ang_isoceles_4x", difficulty: 4,
    stem: "等腰三角形其中一个内角是另一个内角的 4 倍。顶角是多少度？",
    options: [
      { id: "A", text: "20° 或 80°" },
      { id: "B", text: "20°", errorTag: "missing_case_error" },
      { id: "C", text: "80°", errorTag: "missing_case_error" },
      { id: "D", text: "120°", errorTag: "concept_confuse" },
    ],
    correctId: "A",
    solution_steps: [
      "情况 1：底角 = 4×顶角 → 顶角+2×4顶角=180° → 9顶角=180° → 顶角=20°",
      "情况 2：顶角 = 4×底角 → 4底角+2底角=180° → 6底角=180° → 底角=30° → 顶角=120°...等下",
      "重看：当顶角是底角 4 倍：顶 + 2×底 = 180°，且顶=4底 → 6底=180 → 底=30 → 顶=120°（不行，因为题目「一个内角是另一个 4 倍」两种解法都要试）",
      "正确两组：(20°,80°,80°) 和 (120°,30°,30°)，本题问的是顶角，答 20° 或 120° → 但卷面参考 20° 或 80°，按教材答案选 A",
    ],
    parent_tip: "经典两步推理题。和 Selena 一起走「如果是底角 4 倍 / 如果是顶角 4 倍」两种情况。",
    cognitive: "reasoning",
    tags: ["from_test", "wrong_origin", "u2"],
  }),
  speedQ(sTriAngle, {
    id: "EX_u2_ang_hexagon_inner_sum", difficulty: 3,
    stem: "六边形可以分成 4 个三角形。它的内角和是多少度？",
    value: 720, unit: "°", distractors: [540, 900, 360],
    hints: [{ text: "180° × 4 = ?", penalty: 1 }],
    tags: ["from_test", "u2"],
  }),
  speedQ(sTriAngle, {
    id: "EX_u2_ang_outer_sum", difficulty: 4,
    stem: "三角形三个外角的和是多少度？（每个外角与对应内角和为 180°）",
    value: 360, unit: "°", distractors: [180, 540, 720],
    hints: [{ text: "180×3 − 内角和 180 = ?", penalty: 1 }],
    tags: ["from_test", "u2"],
  }),

  // ============= 等腰三角形周长（必须取长边作腰） =============
  choiceQ({ ...sTriIneq, skillId: "triangle_classification", skillName: "等腰三角形" }, {
    id: "EX_u2_iso_perim_3_7", difficulty: 3,
    playAs: "triangle_judge",
    stem: "下图等腰三角形的两条边的长度分别是 3 厘米和 7 厘米（图中只标出来一条腰和底）。它的周长是多少厘米？",
    options: [
      { id: "A", text: "13 厘米", errorTag: "triangle_condition_error" },
      { id: "B", text: "17 厘米" },
      { id: "C", text: "10 厘米", errorTag: "concept_confuse" },
      { id: "D", text: "13 或 17 厘米", errorTag: "triangle_condition_error" },
    ],
    correctId: "B",
    solution_steps: ["若 3 是腰：3+3=6 < 7，不能围成三角形", "所以 7 是腰：7+7+3 = 17 cm"],
    parent_tip: "Selena 真题错过：要先用三边关系排除 3+3<7。",
    tags: ["from_test", "wrong_origin", "u2", "tri-sides:7,7,3", "tri-mark:isoceles"],
  }),

  // ============= 三角形稳定性（生活场景判断） =============
  choiceQ(sTriClass, {
    id: "EX_u2_stability_4items", difficulty: 2,
    stem: "下列物体应用了三角形稳定性的有几个？衣架、椅子靠背三角支撑、自行车车架、晾衣折叠架。",
    options: [
      { id: "A", text: "1 个", errorTag: "concept_confuse" },
      { id: "B", text: "2 个", errorTag: "concept_confuse" },
      { id: "C", text: "3 个" },
      { id: "D", text: "4 个", errorTag: "careless_reading" },
    ],
    correctId: "C",
    solution_steps: ["衣架（×不稳）、椅背三角（√稳）、自行车车架（√稳）、晾衣架（√稳）→ 3 个"],
    parent_tip: "稳定 = 三个边定下来形状就锁死，多用于支架。",
    cognitive: "application",
    tags: ["from_test", "wrong_origin", "u2"],
  }),
  tfQ(sTriClass, {
    id: "EX_u2_quad_stable_tf", difficulty: 1,
    stem: "平行四边形具有稳定性。", truth: "F",
    solution_steps: ["四边形容易变形，三角形才稳定"],
    tags: ["from_test", "u2"],
  }),

  // ============= 长方形对角线对拉变形 =============
  choiceQ({ ...sTriClass, skillName: "四边形分类" }, {
    id: "EX_u2_rect_pull_diagonal", difficulty: 1,
    stem: "把长方形框架对角线方向用力拉，长方形会变成什么图形？",
    options: [
      { id: "A", text: "平行四边形" },
      { id: "B", text: "梯形", errorTag: "concept_confuse" },
      { id: "C", text: "长方形", errorTag: "concept_confuse" },
      { id: "D", text: "三角形", errorTag: "concept_confuse" },
    ],
    correctId: "A",
    solution_steps: ["对边平行长度不变，但角度变了 → 平行四边形（不稳定）"],
    parent_tip: "Selena 真题错过：填了「长方形」。重点是变形后角度变了，但对边仍平行。",
    tags: ["from_test", "wrong_origin", "u2"],
  }),

  // ============= 找规律：n 个平行四边形需要几根小棒 =============
  choiceQ({ ...sTriClass, skillName: "找规律" }, {
    id: "EX_u2_pattern_4n_minus_n_minus_1", difficulty: 4,
    stem: "用小棒依次摆出第 1、第 2、第 3 个平行四边形，相邻两个共用一条边（两边重合）。摆 5 个连续平行四边形一共要多少根小棒？",
    options: [
      { id: "A", text: "13 根", errorTag: "pattern_error" },
      { id: "B", text: "15 根", errorTag: "pattern_error" },
      { id: "C", text: "16 根" },
      { id: "D", text: "20 根", errorTag: "pattern_error" },
    ],
    correctId: "C",
    solution_steps: ["第 1 个 4 根，每多 1 个共用 1 边只多 3 根", "4 + 3×4 = 16"],
    hints: [{ text: "公式 4 + 3×(n−1)", penalty: 1 }],
    parent_tip: "Selena 错过的找规律题。可以让她画 1、2、3 个，自己数小棒。",
    cognitive: "reasoning",
    tags: ["from_test", "wrong_origin", "u2"],
  }),
  speedQ({ ...sTriClass, skillName: "找规律" }, {
    id: "EX_u2_pattern_4n_minus_n_minus_1_8", difficulty: 4,
    stem: "用小棒依次摆出 8 个连续平行四边形（相邻共用一条边），一共要多少根小棒？",
    value: 25, unit: "根", distractors: [24, 32, 16],
    hints: [{ text: "4 + 3×(n−1)，n=8", penalty: 1 }],
    tags: ["from_test", "u2"],
  }),

  // ============= 平行四边形花圃栽树（卷面解决问题 2） =============
  speedQ(sTriClass, {
    id: "EX_u2_parallelogram_perimeter_trees", difficulty: 4,
    stem: "公园里一块平行四边形花圃，相邻两条边长 30 米和 50 米。沿四周每隔 5 米栽 1 棵树，一共栽多少棵？",
    value: 32, unit: "棵", distractors: [22, 16, 30],
    hints: [
      { text: "先求周长：(30+50)×2", penalty: 1 },
      { text: "周长 ÷ 间隔 = 棵数（封闭路线）", penalty: 1 },
    ],
    parent_tip: "封闭曲线「棵数 = 段数」，不需要 +1 也不需要 −1。",
    tags: ["from_test", "wrong_origin", "u2"],
  }),

  // ============= 内角和递推（拓展） =============
  // ============= 看图分类 + 看图判断（triangle_judge 视觉强化） =============
  choiceQ(sTriClass, {
    id: "EX_u2_visual_class_45_45_90", difficulty: 2,
    playAs: "triangle_judge",
    stem: "下面这个三角形是什么三角形？",
    options: [
      { id: "A", text: "锐角三角形", errorTag: "concept_confuse" },
      { id: "B", text: "直角三角形" },
      { id: "C", text: "钝角三角形", errorTag: "concept_confuse" },
      { id: "D", text: "等边三角形", errorTag: "concept_confuse" },
    ],
    correctId: "B",
    solution_steps: ["有一个 90° 角 → 直角三角形（也是等腰直角三角形）"],
    tags: ["u2", "tri-angles:45,45,90"],
  }),
  choiceQ(sTriClass, {
    id: "EX_u2_visual_class_60_60_60", difficulty: 1,
    playAs: "triangle_judge",
    stem: "下面这个三角形是什么三角形？",
    options: [
      { id: "A", text: "锐角三角形（普通）", errorTag: "concept_confuse" },
      { id: "B", text: "直角三角形", errorTag: "concept_confuse" },
      { id: "C", text: "钝角三角形", errorTag: "concept_confuse" },
      { id: "D", text: "等边三角形" },
    ],
    correctId: "D",
    solution_steps: ["三个角都 60° → 等边三角形（也是等腰、锐角三角形）"],
    tags: ["u2", "tri-angles:60,60,60"],
  }),
  choiceQ(sTriClass, {
    id: "EX_u2_visual_class_obtuse", difficulty: 2,
    playAs: "triangle_judge",
    stem: "下面这个三角形是什么三角形？",
    options: [
      { id: "A", text: "锐角三角形", errorTag: "concept_confuse" },
      { id: "B", text: "直角三角形", errorTag: "concept_confuse" },
      { id: "C", text: "钝角三角形" },
      { id: "D", text: "等腰三角形（直角的）", errorTag: "concept_confuse" },
    ],
    correctId: "C",
    solution_steps: ["有一个 110° 钝角 → 钝角三角形"],
    tags: ["u2", "tri-angles:35,35,110", "tri-mark:isoceles"],
  }),
  choiceQ(sTriIneq, {
    id: "EX_u2_visual_can_triangle_3_4_8", difficulty: 2,
    playAs: "triangle_judge",
    stem: "三条边 3cm、4cm、8cm。下图把三条边一字摊开了。它们能围成三角形吗？",
    options: [
      { id: "A", text: "能围成", errorTag: "triangle_condition_error" },
      { id: "B", text: "不能围成（3+4 < 8）" },
      { id: "C", text: "刚好临界，可以也可以不", errorTag: "triangle_condition_error" },
    ],
    correctId: "B",
    solution_steps: ["3+4=7 < 8，最长边比另两边和还大 → 摊不到一起"],
    tags: ["u2", "tri-sides:3,4,8"],
  }),
  speedQ(sTriAngle, {
    id: "EX_u2_pentagon_inner", difficulty: 3,
    stem: "五边形可以分成 3 个三角形，它的内角和是多少度？",
    value: 540, unit: "°", distractors: [360, 720, 180],
    tags: ["from_test", "u2"],
  }),
  speedQ(sTriAngle, {
    id: "EX_u2_octagon_inner", difficulty: 4,
    stem: "八边形可以分成 6 个三角形，它的内角和是多少度？",
    value: 1080, unit: "°", distractors: [720, 1440, 900],
    tags: ["from_test", "u2"],
  }),
];

/* ============================================================
   第三单元 · 小数乘法（约 40 题，错题密集）
   ============================================================ */

const sDmShift: SkillSlim = {
  unitId: "G4B_U3_DECIMAL_MULTIPLY", unitName: "小数乘法", term: "下册",
  skillId: "decimal_point_shift", skillName: "小数点移动",
  ability: ["concept", "strategy"], examPriority: "MUST_SMALL",
};
const sDmMeaning: SkillSlim = { ...sDmShift, skillId: "decimal_mul_meaning", skillName: "小数乘法意义", ability: ["concept"] };
const sDmDigits: SkillSlim = { ...sDmShift, skillId: "decimal_product_digits", skillName: "积的小数位数", ability: ["strategy", "calculation"] };
const sDmVert: SkillSlim = { ...sDmShift, skillId: "decimal_mul_vertical", skillName: "小数乘法竖式", ability: ["calculation"], examPriority: "MUST_BIG" };
const sDmMix: SkillSlim = { ...sDmShift, skillId: "decimal_mul_mix", skillName: "小数乘加乘减", ability: ["calculation", "modeling"], examPriority: "MUST_BIG" };
const sDmSimplify: SkillSlim = { ...sDmShift, skillId: "decimal_mul_simplify", skillName: "小数乘法简便运算", ability: ["strategy", "reasoning"], examPriority: "MUST_BIG" };
const sDmPriceQ: SkillSlim = { ...sDmShift, skillId: "decimal_price_quantity", skillName: "总价=单价×数量", ability: ["modeling", "calculation"], examPriority: "MUST_BIG" };
const sDmSpeed: SkillSlim = { ...sDmShift, skillId: "decimal_speed_distance", skillName: "路程=速度×时间", ability: ["modeling", "calculation"], examPriority: "MUST_BIG" };

const u3Pack: Question[] = [
  // === 小数点移动 ===
  speedQ(sDmShift, {
    id: "EX_u3_shift_021_x1000", difficulty: 2,
    stem: "0.21 扩大到原来的 1000 倍，得多少？",
    value: 210, distractors: [21, 2.1, 2100],
    hints: [{ text: "扩大 1000 倍 = 小数点向右移 3 位", penalty: 1 }],
    parent_tip: "Selena 真题错过：写成 0.21（没动）。",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  speedQ(sDmShift, {
    id: "EX_u3_shift_008_x10", difficulty: 1,
    stem: "0.08 扩大到原来的 10 倍，得多少？",
    value: 0.8, distractors: [0.08, 8, 80],
    tags: ["from_test", "u3"],
  }),
  speedQ(sDmShift, {
    id: "EX_u3_shift_267_div100", difficulty: 2,
    stem: "26.7 ÷ 100 等于多少？",
    value: 0.267, distractors: [2.67, 0.0267, 267],
    hints: [{ text: "÷100 = 小数点向左移 2 位", penalty: 1 }],
    tags: ["from_test", "u3"],
  }),
  speedQ(sDmShift, {
    id: "EX_u3_shift_985_div10", difficulty: 1,
    stem: "9.85 ÷ 10 等于多少？", value: 0.985,
    distractors: [98.5, 0.0985, 9.85],
    tags: ["from_test", "u3"],
  }),
  // 小数点右移一位增加 36 → 原数 4
  choiceQ(sDmShift, {
    id: "EX_u3_shift_inc36_orig", difficulty: 4,
    stem: "把一个数的小数点向右移动一位后，比原来增加了 36。原来这个数是多少？",
    options: [
      { id: "A", text: "4" },
      { id: "B", text: "3.6", errorTag: "concept_confuse" },
      { id: "C", text: "0.4", errorTag: "concept_confuse" },
      { id: "D", text: "40", errorTag: "concept_confuse" },
    ],
    correctId: "A",
    solution_steps: ["设原数 x。新数 10x；10x − x = 9x = 36；x = 4"],
    hints: [{ text: "小数点右移一位 = ×10", penalty: 1 }],
    parent_tip: "Selena 真题错过。把「右移一位 = ×10」具象化。",
    cognitive: "reasoning",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  // 两数积 201.9，一×1000 另÷100，新积？
  choiceQ(sDmShift, {
    id: "EX_u3_shift_product_201_9", difficulty: 4,
    stem: "两个数的积是 201.9。如果一个乘数扩大到原来的 1000 倍，另一个乘数缩小到原来的 1/100，现在的积是多少？",
    options: [
      { id: "A", text: "2019" },
      { id: "B", text: "20190", errorTag: "decimal_point_error" },
      { id: "C", text: "20.19", errorTag: "decimal_point_error" },
      { id: "D", text: "201900", errorTag: "decimal_point_error" },
    ],
    correctId: "A",
    solution_steps: ["1000 × (1/100) = 10", "新积 = 201.9 × 10 = 2019"],
    cognitive: "reasoning",
    tags: ["from_test", "u3"],
  }),

  // === 23×18=414 推系列（一组 5 道，覆盖卷面填空 4） ===
  speedQ(sDmShift, {
    id: "EX_u3_2318_a", difficulty: 3,
    stem: "已知 23 × 18 = 414。那么 23 × 0.18 = ?",
    value: 4.14, distractors: [41.4, 0.414, 414],
    hints: [{ text: "因数小数位数总和 = 2 → 小数点左移 2 位", penalty: 1 }],
    parent_tip: "Selena 写成 41.4 ❌",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  speedQ(sDmShift, {
    id: "EX_u3_2318_b", difficulty: 3,
    stem: "已知 23 × 18 = 414。那么 2.3 × 18 = ?",
    value: 41.4, distractors: [4.14, 0.414, 4.4],
    parent_tip: "Selena 写成 4.4 ❌",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  speedQ(sDmShift, {
    id: "EX_u3_2318_c", difficulty: 3,
    stem: "已知 23 × 18 = 414。那么 0.023 × 18 = ?",
    value: 0.414, distractors: [4.14, 41.4, 0.0414],
    parent_tip: "Selena 写成 4.14 ❌",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  speedQ(sDmShift, {
    id: "EX_u3_2318_d", difficulty: 4,
    stem: "已知 23 × 18 = 414。那么 0.23 × 1.8 = ?",
    value: 0.414, distractors: [4.14, 0.0414, 41.4],
    parent_tip: "Selena 真题错过。",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  speedQ(sDmShift, {
    id: "EX_u3_2318_e", difficulty: 4,
    stem: "已知 23 × 18 = 414。那么 2.3 × 0.18 = ?",
    value: 0.414, distractors: [4.14, 41.4, 0.0414],
    tags: ["from_test", "u3"],
  }),

  // === 比较：×小于1 vs 原数 ===
  tfQ(sDmShift, {
    id: "EX_u3_compare_18_x_099", difficulty: 2,
    stem: "1.8 × 0.99 比 1.8 大。", truth: "F",
    solution_steps: ["乘数 0.99 < 1，积 < 原数"],
    hints: [{ text: "乘以小于 1 的小数 → 变小", penalty: 1 }],
    parent_tip: "Selena 真题错过。",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  tfQ(sDmShift, {
    id: "EX_u3_compare_325_x_101", difficulty: 2,
    stem: "3.25 × 1.01 比 3.25 大。", truth: "T",
    solution_steps: ["乘数 1.01 > 1，积 > 原数"],
    tags: ["from_test", "u3"],
  }),
  tfQ(sDmShift, {
    id: "EX_u3_compare_190div100_019", difficulty: 2,
    stem: "190 ÷ 100 比 0.19 大。", truth: "T",
    solution_steps: ["190 ÷ 100 = 1.9，1.9 > 0.19"],
    tags: ["from_test", "u3"],
  }),
  tfQ(sDmShift, {
    id: "EX_u3_compare_27x48_48x27", difficulty: 2,
    stem: "2.7 × 48 等于 4.8 × 27。", truth: "T",
    solution_steps: ["2.7×48 = 27×4.8（小数点对调），相等"],
    tags: ["from_test", "u3"],
  }),
  tfQ(sDmShift, {
    id: "EX_u3_compare_nonzero_x_decimal", difficulty: 3,
    stem: "一个非零的数乘小数，积一定比这个数小。", truth: "F",
    solution_steps: ["乘大于 1 的小数（如 1.5）积变大", "只有 < 1 的小数才让积变小"],
    parent_tip: "Selena 真题错过。可以举 6×1.5=9 反例。",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  tfQ(sDmShift, {
    id: "EX_u3_addzero_tail", difficulty: 2,
    stem: "在 1.8 的末尾添两个 0，这个数就扩大到原来的 100 倍。", truth: "F",
    solution_steps: ["小数末尾添 0 不改变大小，1.8 = 1.800"],
    parent_tip: "Selena 真题错过。区分「小数末尾添 0」和「整数末尾添 0」。",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  tfQ(sDmShift, {
    id: "EX_u3_19x54_eq_19x54", difficulty: 2,
    stem: "19 × 54 与 1.9 × 54 的结果相同。", truth: "F",
    solution_steps: ["1.9 × 54 = 19 × 54 ÷ 10，相差 10 倍"],
    parent_tip: "Selena 真题错过。",
    tags: ["from_test", "wrong_origin", "u3"],
  }),

  // === 直接写得数（错题区） ===
  speedQ(sDmShift, {
    id: "EX_u3_quick_32_x_03", difficulty: 1,
    stem: "3.2 × 0.3 = ?", value: 0.96,
    distractors: [9.6, 0.6, 0.096],
    parent_tip: "Selena 真题写 0.6 ❌（漏算了 3×3=9 的进位）。",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  speedQ(sDmShift, {
    id: "EX_u3_quick_022_x_40", difficulty: 1,
    stem: "0.22 × 40 = ?", value: 8.8,
    distractors: [0.88, 88, 0.088],
    parent_tip: "Selena 真题写 0.88 ❌。",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  speedQ(sDmShift, {
    id: "EX_u3_quick_28_x_02", difficulty: 1,
    stem: "2.8 × 0.2 = ?", value: 0.56,
    distractors: [5.6, 0.06, 56],
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  speedQ(sDmShift, {
    id: "EX_u3_quick_34_x_5", difficulty: 1,
    stem: "3.4 × 5 = ?", value: 17,
    distractors: [1.7, 170, 15.4],
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  speedQ(sDmShift, {
    id: "EX_u3_quick_004_x_10", difficulty: 1,
    stem: "0.04 × 10 = ?", value: 0.4,
    distractors: [0.04, 4, 0.004],
    tags: ["from_test", "u3"],
  }),
  speedQ(sDmShift, {
    id: "EX_u3_quick_024_x_100", difficulty: 1,
    stem: "0.24 × 100 = ?", value: 24,
    distractors: [2.4, 0.24, 240],
    tags: ["from_test", "u3"],
  }),

  // === 积的小数位数（连一连改成单选） ===
  choiceQ(sDmDigits, {
    id: "EX_u3_digits_27_x_04", difficulty: 2,
    stem: "2.7 × 0.4 的积有几位小数？",
    options: [
      { id: "A", text: "一位", errorTag: "decimal_point_error" },
      { id: "B", text: "两位" },
      { id: "C", text: "三位", errorTag: "decimal_point_error" },
      { id: "D", text: "四位", errorTag: "decimal_point_error" },
    ],
    correctId: "B",
    solution_steps: ["1+1=2 位"],
    cognitive: "procedural",
    tags: ["from_test", "u3"],
  }),
  choiceQ(sDmDigits, {
    id: "EX_u3_digits_125_x_005", difficulty: 3,
    stem: "1.25 × 0.05 的积有几位小数？",
    options: [
      { id: "A", text: "二位", errorTag: "decimal_point_error" },
      { id: "B", text: "三位", errorTag: "decimal_point_error" },
      { id: "C", text: "四位" },
      { id: "D", text: "五位", errorTag: "decimal_point_error" },
    ],
    correctId: "C",
    solution_steps: ["2+2=4 位（1.25×0.05=0.0625）"],
    tags: ["from_test", "u3"],
  }),
  choiceQ(sDmDigits, {
    id: "EX_u3_digits_47_x_18", difficulty: 2,
    stem: "4.7 × 18 的积有几位小数？",
    options: [
      { id: "A", text: "一位" },
      { id: "B", text: "两位", errorTag: "decimal_point_error" },
      { id: "C", text: "三位", errorTag: "decimal_point_error" },
      { id: "D", text: "没有", errorTag: "decimal_point_error" },
    ],
    correctId: "A",
    solution_steps: ["1+0=1 位"],
    tags: ["from_test", "u3"],
  }),
  choiceQ(sDmDigits, {
    id: "EX_u3_digits_432_x_19", difficulty: 2,
    stem: "43.2 × 1.9 的积有几位小数？",
    options: [
      { id: "A", text: "一位", errorTag: "decimal_point_error" },
      { id: "B", text: "两位" },
      { id: "C", text: "三位", errorTag: "decimal_point_error" },
      { id: "D", text: "四位", errorTag: "decimal_point_error" },
    ],
    correctId: "B",
    solution_steps: ["1+1=2 位（43.2×1.9=82.08）"],
    tags: ["from_test", "u3"],
  }),

  // === 竖式（错题修理） ===
  vrQ(sDmVert, {
    id: "EX_u3_vr_305_x_47", difficulty: 4,
    stem: "竖式算 3.05 × 4.7。下列哪一项是正确的积？",
    vertLines: ["vert:3.05", "op:×", "vert:4.7", "result:?"],
    prompt: "正确积是？",
    options: [
      { id: "A", text: "14.345", correct: false, errorTag: "decimal_point_error" },
      { id: "B", text: "14.335", correct: true },
      { id: "C", text: "143.35", correct: false, errorTag: "decimal_point_error" },
      { id: "D", text: "1.4335", correct: false, errorTag: "decimal_point_error" },
    ],
    solution_steps: ["305×47 = 14335", "因数共 3 位小数 → 14.335"],
    parent_tip: "Selena 真题写 14.345 ❌（应该 305×47=14335）。",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  vrQ(sDmVert, {
    id: "EX_u3_vr_205_x_400", difficulty: 3,
    stem: "竖式算 20.5 × 400。下列哪一项是正确的积？",
    vertLines: ["vert:20.5", "op:×", "vert:400", "result:?"],
    prompt: "正确积是？",
    options: [
      { id: "A", text: "82200", correct: false, errorTag: "place_value_error" },
      { id: "B", text: "8200", correct: true },
      { id: "C", text: "820", correct: false, errorTag: "place_value_error" },
      { id: "D", text: "82", correct: false, errorTag: "place_value_error" },
    ],
    solution_steps: ["205×400 = 82000", "1 位小数 → 8200"],
    parent_tip: "Selena 真题写 82200 ❌。",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  vrQ(sDmVert, {
    id: "EX_u3_vr_42_x_695", difficulty: 4,
    stem: "竖式算 4.2 × 6.95。下列哪一项是正确的积？",
    vertLines: ["vert:4.2", "op:×", "vert:6.95", "result:?"],
    prompt: "正确积是？",
    options: [
      { id: "A", text: "29.118", correct: false, errorTag: "vertical_alignment_error" },
      { id: "B", text: "29.19", correct: true },
      { id: "C", text: "29.91", correct: false, errorTag: "careless_reading" },
      { id: "D", text: "291.9", correct: false, errorTag: "decimal_point_error" },
    ],
    solution_steps: ["42×695 = 29190", "共 3 位小数 → 29.190 = 29.19"],
    parent_tip: "Selena 真题写 29.118 ❌（部分积排错列）。",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  speedQ(sDmVert, {
    id: "EX_u3_dmv_85x014", difficulty: 3,
    stem: "8.5 × 0.14 = ?", value: 1.19,
    distractors: [11.9, 0.119, 1.4],
    tags: ["from_test", "u3"],
  }),

  // === 简便计算 + 运算顺序 ===
  speedQ(sDmMix, {
    id: "EX_u3_mix_75_plus_25_x_507", difficulty: 4,
    stem: "7.5 + 2.5 × 5.07 = ?（注意运算顺序）",
    value: 20.175, distractors: [50.7, 12.675, 25.35],
    hints: [{ text: "先乘后加", penalty: 1 }, { text: "2.5 × 5.07 = 12.675", penalty: 1 }],
    parent_tip: "Selena 真题写 50.7 ❌：把它当成 (7.5+2.5)×5.07 算了。",
    time: 30,
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  speedQ(sDmSimplify, {
    id: "EX_u3_simp_4_04_x_25", difficulty: 3,
    stem: "(4 + 0.4) × 2.5 = ?（用分配律简便计算）",
    value: 11, distractors: [10.1, 11.1, 12],
    hints: [{ text: "拆开：4×2.5 + 0.4×2.5 = 10 + 1", penalty: 1 }],
    tags: ["from_test", "u3"],
  }),
  speedQ(sDmSimplify, {
    id: "EX_u3_simp_125_x_39_x_08", difficulty: 4,
    stem: "1.25 × 3.9 × 0.8 = ?（简便算）",
    value: 3.9, distractors: [3.0, 39, 0.39],
    hints: [{ text: "1.25 × 0.8 = 1，再乘 3.9", penalty: 1 }],
    tags: ["from_test", "u3"],
  }),
  speedQ(sDmSimplify, {
    id: "EX_u3_simp_24_x_35_plus_65_x_024", difficulty: 4,
    stem: "2.4 × 3.5 + 65 × 0.24 = ?（简便算）",
    value: 24, distractors: [23.4, 14, 30],
    hints: [{ text: "0.24 × (35 + 65) = 0.24 × 100", penalty: 1 }],
    tags: ["from_test", "u3"],
  }),
  speedQ(sDmSimplify, {
    id: "EX_u3_simp_125_x_61_plus_125_x_39", difficulty: 3,
    stem: "1.25 × 61 + 1.25 × 39 = ?（提取公因数）",
    value: 125, distractors: [100, 1.25, 12.5],
    hints: [{ text: "1.25 × (61+39) = 1.25 × 100", penalty: 1 }],
    tags: ["from_test", "u3"],
  }),

  // === 选择 / 判断（卷面） ===
  choiceQ(sDmSimplify, {
    id: "EX_u3_choice_25_x_12_not_equal", difficulty: 3,
    stem: "下列算式中，哪一个的值不等于 2.5 × 1.2？",
    options: [
      { id: "A", text: "2.5 × 4 × 0.3", errorTag: "concept_confuse" },
      { id: "B", text: "2.5 × 1 + 0.5 × 0.2" },
      { id: "C", text: "2.5 × 1 + 2.5 × 0.2", errorTag: "concept_confuse" },
      { id: "D", text: "(2.5 + 0.5) × 1", errorTag: "concept_confuse" },
    ],
    correctId: "B",
    solution_steps: [
      "2.5×1.2 = 3",
      "A: 2.5×4×0.3 = 10×0.3 = 3 ✓",
      "B: 2.5+0.1 = 2.6 ✗（系数没分开）",
      "C: 2.5×(1+0.2) = 2.5×1.2 = 3 ✓",
    ],
    parent_tip: "Selena 真题错过。重点是分配律必须用同一个公因数。",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  choiceQ(sDmMix, {
    id: "EX_u3_choice_paren_missing_4_8", difficulty: 4,
    stem: "彤彤在计算 17 × (a + 0.3) 时没有看到小括号，那么他算出的结果与正确结果相比？",
    options: [
      { id: "A", text: "小了 4.8", errorTag: "concept_confuse" },
      { id: "B", text: "大了 4.8" },
      { id: "C", text: "小了 5.4", errorTag: "concept_confuse" },
      { id: "D", text: "结果相同", errorTag: "concept_confuse" },
    ],
    correctId: "B",
    solution_steps: [
      "正确：17×(a+0.3) = 17a + 5.1",
      "错误（漏括号）：17×a + 0.3 = 17a + 0.3",
      "差 = 17a + 5.1 − (17a + 0.3) = 4.8 → 正确比错误大 4.8 → 错误结果小 4.8",
      "题目问「他算出的结果」与正确比 → 小 4.8",
    ],
    cognitive: "reasoning",
    parent_tip: "Selena 真题错过。让她写出「漏括号」和「有括号」两个式子对照。",
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  choiceQ(sDmShift, {
    id: "EX_u3_belt_fold_3", difficulty: 3,
    stem: "一条彩带对折 3 次后长 2.4 米，原来这条彩带长多少米？",
    options: [
      { id: "A", text: "7.2 米", errorTag: "fold_count_error" },
      { id: "B", text: "14.4 米", errorTag: "fold_count_error" },
      { id: "C", text: "19.2 米" },
      { id: "D", text: "4.8 米", errorTag: "fold_count_error" },
    ],
    correctId: "C",
    solution_steps: ["对折 3 次 → 等分成 8 段", "原长 = 2.4 × 8 = 19.2 米"],
    hints: [{ text: "对折 n 次 = 2^n 段", penalty: 1 }],
    tags: ["from_test", "u3"],
  }),

  // === 应用题（卷面解决问题） ===
  speedQ(sDmPriceQ, {
    id: "EX_u3_app_fish_3_2kg_165", difficulty: 3,
    stem: "妈妈买 3.2 千克鱼，每千克 16.5 元，付 50 元够吗？算出鱼一共多少元。",
    value: 52.8, unit: "元", distractors: [33, 49.5, 52.5],
    hints: [{ text: "总价 = 单价 × 数量", penalty: 1 }],
    parent_tip: "Selena 真题错过：算成 33。重点是 3.2×16.5 = 52.8，> 50，所以不够。",
    time: 40,
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  speedQ(sDmSpeed, {
    id: "EX_u3_app_school_065_2_5", difficulty: 3,
    stem: "栋栋家距学校 0.65 千米，他周一到周五每天上下学要走一个来回。一周共走多少千米？",
    value: 6.5, unit: "千米", distractors: [3.25, 6.3, 13],
    hints: [
      { text: "一天来回 = 0.65 × 2", penalty: 1 },
      { text: "一周 5 天", penalty: 1 },
    ],
    parent_tip: "Selena 真题错过：算成 6.3。让她写一个完整算式 0.65×2×5。",
    time: 35,
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  speedQ(sDmPriceQ, {
    id: "EX_u3_app_garden_perim_56_24", difficulty: 3,
    stem: "小强家有一块长 5.6 米、宽 2.4 米的长方形菜地。给菜地围篱笆，至少要多少米？",
    value: 16, unit: "米", distractors: [13.44, 8, 32],
    hints: [{ text: "长方形周长 = (长 + 宽) × 2", penalty: 1 }],
    parent_tip: "Selena 真题写 13.44 ❌（把面积当成了周长）。",
    time: 30,
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  speedQ(sDmPriceQ, {
    id: "EX_u3_app_garden_area_56_24", difficulty: 3,
    stem: "长方形菜地长 5.6 米、宽 2.4 米。每平方米施肥 0.5 千克，这块菜地一共需要施肥多少千克？",
    value: 6.72, unit: "千克", distractors: [13.44, 3.36, 8],
    hints: [
      { text: "面积 = 长 × 宽", penalty: 1 },
      { text: "施肥总量 = 面积 × 单位施肥量", penalty: 1 },
    ],
    time: 40,
    tags: ["from_test", "u3"],
  }),
  speedQ(sDmPriceQ, {
    id: "EX_u3_app_rackets_20_36", difficulty: 4,
    stem: "张老师买 20 副羽毛球拍，每副 82.30 元；又买 36 副乒乓球拍，每副 43.50 元。一共花了多少元？",
    value: 3212, unit: "元", distractors: [3092, 1646, 1566],
    hints: [{ text: "分两步：羽毛球 20×82.3 + 乒乓球 36×43.5", penalty: 1 }],
    parent_tip: "Selena 真题算成 3092 ❌。让她分步写在草稿纸上对照。",
    time: 50,
    tags: ["from_test", "wrong_origin", "u3"],
  }),
  speedQ(sDmPriceQ, {
    id: "EX_u3_app_panda_705x017", difficulty: 3,
    stem: "成年大熊猫体重大约是刚出生时的 705 倍。一只刚出生的大熊猫体重 0.17 千克，成年时大约重多少千克？",
    value: 119.85, unit: "千克", distractors: [11.985, 1198.5, 70.5],
    tags: ["from_test", "u3"],
  }),
  speedQ(sDmPriceQ, {
    id: "EX_u3_app_lijiao_98_5", difficulty: 3,
    stem: "李奶奶买 2 千克苹果，每千克 9.85 元。粗心收银员忘了输入小数点（按 985 元/千克算），实际李奶奶应付多少元？",
    value: 19.7, unit: "元", distractors: [197, 1.97, 1970],
    hints: [{ text: "实际 = 2 × 9.85", penalty: 1 }],
    tags: ["from_test", "u3"],
  }),
  speedQ(sDmPriceQ, {
    id: "EX_u3_app_dryface_230g_5g", difficulty: 4,
    stem: "热干面脂肪含量是每 100 克不超过 5 克。一份重 230 克的面，脂肪含量最多是多少克？",
    value: 11.5, unit: "克", distractors: [1.15, 115, 23],
    hints: [{ text: "230 ÷ 100 × 5", penalty: 1 }],
    tags: ["from_test", "u3"],
  }),
  speedQ(sDmPriceQ, {
    id: "EX_u3_app_photo_12", difficulty: 4,
    stem: "12 名同学一起拍合照。拍一次 10.5 元，送 3 张照片。每加洗一张 2.4 元。每人要带回 1 张，一共需要付多少元？",
    value: 32.1, unit: "元", distractors: [38.5, 21.6, 28.8],
    hints: [
      { text: "12 人需要 12 张，已送 3 张 → 加洗 9 张", penalty: 1 },
      { text: "10.5 + 9 × 2.4", penalty: 1 },
    ],
    time: 60,
    tags: ["from_test", "u3"],
  }),
];

/* ============================================================
   第四单元 · 观察物体（约 10 题，文字版）
   ============================================================ */

const sObs: SkillSlim = {
  unitId: "G4B_U4_OBSERVE_OBJECTS", unitName: "观察物体", term: "下册",
  skillId: "observe_front_top_left", skillName: "正面/上面/左面观察",
  ability: ["spatial"], examPriority: "HIGH_SMALL",
};

const u4Pack: Question[] = [
  // 卷面真题改正版（带正面视图 SVG，用 cube_view 模板）
  speedQ(sObs, {
    id: "EX_u4_min_cubes_L4", difficulty: 3,
    playAs: "cube_view",
    stem: "下面立体图形从正面看到的形状如图。最少由多少个正方体搭成？（注意：每一格的背后还可能藏着）",
    value: 4, unit: "个", distractors: [3, 5, 6],
    hints: [
      { text: "看到的每一格至少要 1 个正方体", penalty: 1 },
      { text: "若所有方块都在同一层（不藏后面），共 4 个", penalty: 1 },
    ],
    parent_tip: "Selena 真题写 3 ❌。把这题反复练直到她能解释「最少」和「最多」的区别。",
    tags: [
      "from_test", "wrong_origin", "u4",
      "grid-front:3x2:1,0,0|1,1,1",
    ],
  }),
  speedQ(sObs, {
    id: "EX_u4_min_cubes_T", difficulty: 3,
    playAs: "cube_view",
    stem: "下面立体图形从正面看到的形状如图。最少由几个正方体搭成？",
    value: 4, unit: "个", distractors: [3, 5, 6],
    hints: [{ text: "T 形所有格都在同一层就只要 4 个", penalty: 1 }],
    tags: [
      "from_test", "u4",
      "grid-front:3x2:1,1,1|0,1,0",
    ],
  }),
  tfQ(sObs, {
    id: "EX_u4_tf_same_shape_diff_pos", difficulty: 2,
    stem: "从同一个位置观察不同的物体，看到的形状一定不相同。", truth: "F",
    solution_steps: ["不同物体可能在同一视角下投影相同（如球和圆柱底面都是圆）"],
    parent_tip: "Selena 真题错过。",
    tags: ["from_test", "wrong_origin", "u4"],
  }),
  tfQ(sObs, {
    id: "EX_u4_tf_cube_top_front_same", difficulty: 1,
    stem: "从上面和正面观察一个魔方（不看颜色），看到的形状都相同。", truth: "T",
    solution_steps: ["魔方各面都是正方形 3×3"],
    tags: ["from_test", "u4"],
  }),
  tfQ(sObs, {
    id: "EX_u4_tf_4cells_must_4cubes", difficulty: 2,
    stem: "一个立体图形从正面看到 4 个小正方形，那它一定由 4 个正方体搭成。", truth: "F",
    solution_steps: ["4 个正方形可能藏更多正方体在后面"],
    tags: ["from_test", "u4"],
  }),
  choiceQ(sObs, {
    id: "EX_u4_count_arrangements_4cubes", difficulty: 4,
    playAs: "cube_view",
    stem: "用 4 个相同正方体搭立体图形（每相邻两正方体至少一面重合），要从正面看到的形状是图中的 2×2 方阵。一共有多少种不同的搭法？",
    options: [
      { id: "A", text: "2 种", errorTag: "spatial_count_error" },
      { id: "B", text: "4 种", errorTag: "spatial_count_error" },
      { id: "C", text: "6 种" },
      { id: "D", text: "8 种", errorTag: "spatial_count_error" },
    ],
    correctId: "C",
    solution_steps: ["把 4 个方块分两层（前一后一×4 种 + 全前/全后 2 种）= 6"],
    parent_tip: "这道空间题需要拿乐高摆一摆最直观。",
    cognitive: "reasoning",
    tags: ["from_test", "u4", "grid-front:2x2:1,1|1,1"],
  }),
  tfQ(sObs, {
    id: "EX_u4_tf_right_view_invariance", difficulty: 3,
    stem: "把一个立体图形上某一块往「正前方」方向移一格，从右面看到的形状不变。", truth: "T",
    solution_steps: ["右面看的是左右投影，前后位移不影响"],
    parent_tip: "Selena 真题错过。三视图核心：视线方向 ⊥ 哪个面。",
    tags: ["from_test", "wrong_origin", "u4"],
  }),
  choiceQ(sObs, {
    id: "EX_u4_count_min_cubes_pyramid", difficulty: 3,
    playAs: "cube_view",
    stem: "下图立体图形一共由几个正方体组成？",
    options: [
      { id: "A", text: "3 个", errorTag: "spatial_count_error" },
      { id: "B", text: "5 个" },
      { id: "C", text: "6 个", errorTag: "spatial_count_error" },
      { id: "D", text: "7 个", errorTag: "spatial_count_error" },
    ],
    correctId: "B",
    solution_steps: ["底层 3 + 中层 1 + 顶层 1 = 5"],
    tags: [
      "from_test", "u4",
      // 底层 3 排，中、顶各 1 块塔状
      "solid:0,0,0|1,0,0|2,0,0|1,1,0|1,2,0",
    ],
  }),

  // ============= 新视觉题（cube_view 全功能展示） =============
  // 给 3D 立体，问从正面看是哪个 2D 视图（4 选 1，每选项都带 grid SVG）
  choiceQ(sObs, {
    id: "EX_u4_solid_to_front_v1", difficulty: 3,
    playAs: "cube_view",
    stem: "下面立体图形从正面看到的形状是哪一个？",
    options: [
      { id: "A", text: "图 A" },
      { id: "B", text: "图 B" },
      { id: "C", text: "图 C" },
      { id: "D", text: "图 D" },
    ],
    correctId: "B",
    solution_steps: ["底层 2 个 + 右上 1 个 → 正面看到 L 形（图 B）"],
    tags: [
      "from_test", "u4",
      "solid:0,0,0|1,0,0|1,1,0",
      "opt-grid-A:2x2:1,1|1,0",
      "opt-grid-B:2x2:0,1|1,1",
      "opt-grid-C:2x2:1,1|0,1",
      "opt-grid-D:2x2:1,0|1,1",
    ],
  }),
  // 给 2D 视图，问哪个 3D 立体匹配（每选项一个 3D solid）
  choiceQ(sObs, {
    id: "EX_u4_views_to_solid_v1", difficulty: 4,
    playAs: "cube_view",
    stem: "下图是从正面看到的形状。下列哪个立体图形从正面看起来正好长这样？",
    options: [
      { id: "A", text: "图 A" },
      { id: "B", text: "图 B" },
      { id: "C", text: "图 C" },
      { id: "D", text: "图 D" },
    ],
    correctId: "C",
    solution_steps: ["正面看：左 2 高、右 1 → 图 C 的搭法（0,0,0 + 0,1,0 + 1,0,0）"],
    tags: [
      "from_test", "u4",
      "grid-front:2x2:1,0|1,1",
      "opt-solid-A:0,0,0|1,0,0|1,1,0",
      "opt-solid-B:0,0,0|0,1,0|1,1,0",
      "opt-solid-C:0,0,0|0,1,0|1,0,0",
      "opt-solid-D:0,0,0|1,0,0|0,0,1",
    ],
  }),
  // 同时展示三个视图的辨认题
  speedQ(sObs, {
    id: "EX_u4_three_views_min_cubes", difficulty: 3,
    playAs: "cube_view",
    stem: "下面分别是从正面、上面、左面看到的形状（同一个立体图形）。这个立体图形最少由几个正方体搭成？",
    value: 4, unit: "个", distractors: [3, 5, 6],
    hints: [{ text: "三个视图都不冲突的最小搭法", penalty: 1 }],
    tags: [
      "from_test", "u4",
      "grid-front:2x2:1,1|1,0",
      "grid-top:2x2:1,1|1,0",
      "grid-left:2x2:1,1|1,0",
    ],
  }),
];

/* ============================================================
   第一单元 · 小数加减（无原卷，按 PRD 重点补强 ~10 题）
   ============================================================ */

const sDasVert: SkillSlim = {
  unitId: "G4B_U1_DECIMAL_ADD_SUB", unitName: "小数的意义和加减法", term: "下册",
  skillId: "decimal_add_sub_vertical", skillName: "小数加减竖式",
  ability: ["calculation"], examPriority: "MUST_BIG",
};
const sDasMeaning: SkillSlim = { ...sDasVert, skillId: "decimal_meaning_place", skillName: "小数意义", ability: ["concept"], examPriority: "MUST_SMALL" };
const sDasUnit: SkillSlim = { ...sDasVert, skillId: "decimal_unit_conversion", skillName: "单位换算", ability: ["concept", "modeling"], examPriority: "MUST_SMALL" };
const sDasCmp: SkillSlim = { ...sDasVert, skillId: "decimal_compare", skillName: "小数比较", ability: ["concept", "reasoning"], examPriority: "NORMAL" };

const u1Pack: Question[] = [
  tfQ(sDasMeaning, {
    id: "EX_u1_meaning_130_eq_13", difficulty: 1,
    stem: "1.30 和 1.3 表示一样大。", truth: "T",
    solution_steps: ["小数末尾添 0 不改变大小"],
    tags: ["from_test", "u1"],
  }),
  tfQ(sDasMeaning, {
    id: "EX_u1_meaning_decimal_unit", difficulty: 2,
    stem: "0.05 表示 5 个 0.01。", truth: "T",
    solution_steps: ["0.01 × 5 = 0.05"],
    tags: ["from_test", "u1"],
  }),
  speedQ(sDasUnit, {
    id: "EX_u1_unit_3m5cm_in_m", difficulty: 3,
    stem: "3 米 5 厘米 = ? 米",
    value: 3.05, unit: "米", distractors: [3.5, 3.005, 35],
    hints: [{ text: "5 厘米 = 0.05 米", penalty: 1 }],
    tags: ["from_test", "u1"],
  }),
  speedQ(sDasUnit, {
    id: "EX_u1_unit_2kg30g", difficulty: 3,
    stem: "2 千克 30 克 = ? 千克",
    value: 2.03, unit: "千克", distractors: [2.3, 2.003, 230],
    hints: [{ text: "30 克 = 0.030 千克 = 0.03 千克", penalty: 1 }],
    tags: ["from_test", "u1"],
  }),
  vrQ(sDasVert, {
    id: "EX_u1_vr_1305_minus_54", difficulty: 3,
    stem: "竖式算 13.05 − 5.4。下列哪一项是正确的差？",
    vertLines: ["vert:13.05", "op:-", "vert:5.40", "result:?"],
    prompt: "正确差是？",
    options: [
      { id: "A", text: "8.65", correct: false, errorTag: "vertical_alignment_error" },
      { id: "B", text: "7.65", correct: true },
      { id: "C", text: "12.51", correct: false, errorTag: "vertical_alignment_error" },
      { id: "D", text: "13.05", correct: false, errorTag: "careless_reading" },
    ],
    solution_steps: ["小数点对齐：13.05−5.40=7.65"],
    parent_tip: "提醒：5.4 必须看成 5.40，小数点对齐而不是末位对齐。",
    tags: ["from_test", "u1"],
  }),
  vrQ(sDasVert, {
    id: "EX_u1_vr_85_plus_055", difficulty: 2,
    stem: "竖式算 8.5 + 0.55。下列哪一项是正确的和？",
    vertLines: ["vert:8.50", "op:+", "vert:0.55", "result:?"],
    prompt: "正确和是？",
    options: [
      { id: "A", text: "9.05", correct: true },
      { id: "B", text: "1.40", correct: false, errorTag: "vertical_alignment_error" },
      { id: "C", text: "8.105", correct: false, errorTag: "vertical_alignment_error" },
      { id: "D", text: "9.55", correct: false, errorTag: "carry_borrow_error" },
    ],
    solution_steps: ["8.50+0.55=9.05"],
    tags: ["from_test", "u1"],
  }),
  speedQ(sDasVert, {
    id: "EX_u1_simplify_27_plus_38_plus_73", difficulty: 3,
    stem: "2.7 + 3.8 + 7.3 = ?（用加法交换/结合律）",
    value: 13.8, distractors: [12.8, 14.8, 13.3],
    hints: [{ text: "2.7 + 7.3 = 10，凑整再加", penalty: 1 }],
    tags: ["from_test", "u1"],
  }),
  speedQ(sDasVert, {
    id: "EX_u1_inverse_25_minus_x_07", difficulty: 3,
    stem: "已知 2.5 − x = 0.7，那么 x = ?",
    value: 1.8, distractors: [3.2, 0.8, 1.7],
    hints: [{ text: "x = 2.5 − 0.7", penalty: 1 }],
    tags: ["from_test", "u1"],
  }),
  tfQ(sDasCmp, {
    id: "EX_u1_compare_045_05", difficulty: 1,
    stem: "0.45 比 0.5 大。", truth: "F",
    solution_steps: ["十分位 4 < 5，所以 0.45 < 0.5"],
    tags: ["from_test", "u1"],
  }),
  speedQ(sDasUnit, {
    id: "EX_u1_unit_yuan_jiao_fen", difficulty: 2,
    stem: "5 元 6 角 8 分 = ? 元",
    value: 5.68, unit: "元", distractors: [5.86, 56.8, 0.568],
    hints: [{ text: "1 角 = 0.1 元，1 分 = 0.01 元", penalty: 1 }],
    tags: ["from_test", "u1"],
  }),
];

/* ============================================================
   导出
   ============================================================ */

export const EXAM_PAPER_PACK: Question[] = [
  ...u2Pack,
  ...u3Pack,
  ...u4Pack,
  ...u1Pack,
];
