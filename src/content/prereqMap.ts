/**
 * v0.35.70 — P0-5 前置降级诊断 step 1: 知识图谱 (G4B skill → 前置 skill 列表).
 *
 * Bruce directive (2026-05-19 user flow review):
 * "我同意 Gemini 独家的洞察. 确实, 如果这一道题有前置知识点的话, 应该确定前置知识点
 *  是已经掌握好了的. 然后这个量挺大的, 应该要 AI 自动生成, 不应该需要人工来处理."
 *
 * 设计:
 *  - 现行 retry policy: 错某 skill → 自动出**同 skill 同难度**变式 (FSRS 假设 "懂了易错")
 *  - 新 retry policy: 检查前置 skill mastery; 若 prereq mastery < 60 → 出 prereq skill 题
 *    (降级到更基础知识点确认是否真正掌握)
 *  - 类比 Khan Academy 知识图谱降级
 *
 * 数据来源:
 *  - 大部分 G4B skill 的前置 = G4A 同 unit / 同类型 skill (4 年级上册是下册自然前置)
 *  - 部分 G4B skill 的前置是 **G3** 整数四则运算 — 这些用 G3_PLACEHOLDER skill_id 标
 *    (G3 题库后续 AI 生成时填入)
 *
 * 用法:
 *   const prereqIds = getPrereqSkillIds("decimal_add_sub_vertical");
 *   // → ["int_add_sub_basic_g3", "decimal_meaning_place"]
 *
 *   if (hasPrereqs(skillId)) { 检查 mastery 决定降级出题 }
 */

/**
 * G3 placeholder skill ID — 真 G3 题库 (AI 生成) 后续填入 src/content/skills.ts.
 * 这里只是 graph 节点占位, 让 mapping 完整.
 *
 * 命名约定: `<topic>_g3` 后缀 = 3 年级前置概念.
 */
export const G3_PLACEHOLDER_SKILLS = [
  // 整数四则运算 (G3 必修, 是所有 G4 decimal/equation 的前置)
  "int_add_sub_basic_g3",      // 整数加减法基础 (3 位数加减, 不退位)
  "int_add_sub_vertical_g3",   // 整数加减竖式 (含退位)
  "int_mul_basic_g3",           // 一位数乘一位数 (口诀)
  "int_mul_2_by_1_g3",          // 两位数乘一位数
  "int_div_basic_g3",           // 一位数除法 (整除)
  // 单位换算
  "unit_length_g3",             // 长度单位 (km/m/cm/mm)
  "unit_money_g3",              // 人民币单位 (元/角/分)
  "unit_time_g3",               // 时间单位 (时/分/秒)
  "unit_weight_g3",             // 质量单位 (kg/g)
  // 应用题
  "word_problem_one_step_g3",   // 一步应用题
  "word_problem_two_step_g3",   // 两步应用题
  // 图形
  "angle_recognition_g3",       // 角的认识
  "shape_basic_g3",             // 基本图形识别
] as const;

export type G3PlaceholderSkill = typeof G3_PLACEHOLDER_SKILLS[number];

/**
 * G4B skill → 前置 skill IDs 映射.
 *
 * 每个 entry 列出 1-3 个前置, 按依赖紧密程度排序 (最强 prereq 在前).
 * 前置可以是:
 *  - 真 G4A skill ID (已存在 SKILLS 表)
 *  - G3 placeholder (后续 AI 生成题)
 *  - G4B 同 unit 更基础 skill (e.g. decimal_add_sub_vertical 前置 decimal_meaning_place)
 *
 * 用 satisfies enforce: 加新 G4B skill 必须考虑 prereq (空数组也行, 但要写出来).
 */
export const PREREQ_MAP: Record<string, readonly string[]> = {
  // ──────── G4B U1: 小数加减 ────────
  // 小数意义 ← 整数概念
  decimal_meaning_place: ["int_add_sub_basic_g3"],
  // 小数加减竖式 ← 整数加减竖式 + 小数意义
  decimal_add_sub_vertical: ["int_add_sub_vertical_g3", "decimal_meaning_place"],
  // 小数加减简便 ← 简便整数运算 + 小数加减
  decimal_add_sub_simplify: ["simplify_integer", "decimal_add_sub_vertical"],
  // 小数大小比较 ← 整数大小比较 + 小数意义
  decimal_compare: ["int_add_sub_basic_g3", "decimal_meaning_place"],
  // 小数逆向应用题 ← 一步应用题 + 小数加减
  decimal_inverse_problem: ["word_problem_one_step_g3", "decimal_add_sub_vertical"],
  // 单位换算 ← 各类单位 G3 + 小数意义
  decimal_unit_conversion: ["unit_length_g3", "unit_money_g3", "decimal_meaning_place"],

  // ──────── G4B U2: 三角形和四边形 ────────
  triangle_inequality: ["angle_recognition_g3", "shape_basic_g3"],
  triangle_angle_sum: ["angle_types", "angle_measure"], // G4A 角的类型 + 量角
  triangle_classification: ["angle_types", "shape_basic_g3"],

  // ──────── G4B U3: 小数乘法 ────────
  decimal_mul_meaning: ["int_mul_basic_g3", "decimal_meaning_place"],
  decimal_point_shift: ["decimal_meaning_place"],
  decimal_mul_vertical: ["int_mul_3_by_2", "decimal_point_shift"], // G4A 三位数乘两位数 + 小数点
  decimal_product_digits: ["decimal_mul_vertical"],
  decimal_mul_mix: ["mixed_ops_brackets", "decimal_mul_vertical"], // G4A 四则混合
  decimal_mul_simplify: ["distributive_law", "decimal_mul_vertical"], // G4A 分配律
  // 应用题类
  decimal_price_quantity: ["word_problem_two_step_g3", "decimal_mul_vertical", "unit_money_g3"],
  decimal_speed_distance: ["speed_time_distance", "decimal_mul_vertical"], // G4A 路程时间速度
  decimal_work_total: ["word_problem_two_step_g3", "decimal_mul_vertical"],
  decimal_segment_pricing: ["word_problem_two_step_g3", "decimal_price_quantity"],

  // ──────── G4B U4: 观察物体 ────────
  observe_front_top_left: ["shape_basic_g3"],

  // ──────── G4B U5: 方程 ────────
  letter_expression: ["int_add_sub_basic_g3"],
  // 后续 G4B equation skills 待 SKILLS 完整后映射

  // ──────── G4B U6: 数据 ────────
  // 平均数 ← 加法 + 除法
  average_compute: ["int_add_sub_vertical_g3", "div_3_by_2_trial"], // G4A 除法
  average_inverse_total: ["average_compute", "word_problem_two_step_g3"],
  average_inverse_missing: ["average_compute", "word_problem_one_step_g3"],
  // 条形/折线图
  data_bar_chart: ["int_add_sub_basic_g3", "shape_basic_g3"],
};

/**
 * 取 skill 的前置列表. 没在 map 里返空数组.
 */
export function getPrereqSkillIds(skillId: string): readonly string[] {
  return PREREQ_MAP[skillId] ?? [];
}

/**
 * 判断 skill 是否有显式前置 (用于决定 retry 时是否检查前置 mastery).
 */
export function hasPrereqs(skillId: string): boolean {
  return (PREREQ_MAP[skillId]?.length ?? 0) > 0;
}

/**
 * 判断一个 skill ID 是否是 G3 placeholder (后续要 AI 生成题).
 */
export function isG3Placeholder(skillId: string): skillId is G3PlaceholderSkill {
  return (G3_PLACEHOLDER_SKILLS as readonly string[]).includes(skillId);
}

/**
 * 统计 graph 覆盖度 — 给 audit 用.
 */
export function getPrereqMapStats() {
  const skillsMapped = Object.keys(PREREQ_MAP).length;
  const totalEdges = Object.values(PREREQ_MAP).reduce((s, arr) => s + arr.length, 0);
  const distinctPrereqs = new Set<string>();
  for (const arr of Object.values(PREREQ_MAP)) {
    for (const id of arr) distinctPrereqs.add(id);
  }
  const g3Refs = [...distinctPrereqs].filter((id) => isG3Placeholder(id)).length;
  return {
    skillsMapped,
    totalEdges,
    distinctPrereqs: distinctPrereqs.size,
    g3Placeholders: g3Refs,
  };
}
