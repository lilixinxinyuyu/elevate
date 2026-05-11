import { useState } from "react";
import type { Question, GameTemplate } from "../core/types";
import { GameShell } from "../components/game/GameShell";

/**
 * /math/playground — v0.31.87 题型试玩台
 *
 * 把 16 种 game template 各放一道**写死的示例题**，方便：
 *   1. Bruce 直接看每个新玩法的视觉/交互
 *   2. UI 改动后回归测试不用走"出题→存 D1→pick"
 *   3. 给 AI 出题写 prompt 时直接对照视觉
 *
 * 不会写库 / 不计 attempt / 不算 XP — 纯粹试玩台。
 */

const SAMPLES: Array<{
  id: string;
  label: string;
  emoji: string;
  question: Question;
  isNew?: boolean;
}> = [
  // ──── 新玩法（v0.31.87）────
  {
    id: "discount_drift",
    label: "折扣漂移",
    emoji: "💸",
    isNew: true,
    question: {
      question_id: "PG_discount_drift_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U3_DECIMAL_MULTIPLY",
      unit_name: "小数乘法",
      skill_id: "decimal_point_shift",
      skill_name: "小数点移动 / 折扣",
      ability_dimension: ["calculation", "modeling"],
      exam_priority: "MUST_BIG",
      game_type: "discount_drift",
      play_as: "discount_drift",
      cognitive_level: "application",
      difficulty: 3,
      question_format: "single_choice",
      estimated_time_seconds: 30,
      stem: "一件 ¥120 的连衣裙打 7 折，现价是多少元？",
      discount: {
        itemName: "连衣裙",
        emoji: "👗",
        originalPrice: 120,
        discount: { kind: "percent", value: 70 },
      },
      options: [
        { id: "A", text: "84" },
        { id: "B", text: "50", errorTag: "calc_subtract" },
        { id: "C", text: "70", errorTag: "discount_misread" },
        { id: "D", text: "108", errorTag: "off_by_one" },
      ],
      answer: { type: "choice", value: "A" },
      solution_steps: ["7 折 = 0.7", "120 × 0.7 = 84"],
      hints: [{ text: "X 折 = 付原价的 X×10%", penalty: 1 }],
      common_errors: [],
      feedback_correct: "💸 折扣高手！",
      feedback_wrong: "提示：7 折 = 付 70%",
      tags: ["sample"],
    } as unknown as Question,
  },
  {
    id: "coin_combo",
    label: "凑钱挑战",
    emoji: "🪙",
    isNew: true,
    question: {
      question_id: "PG_coin_combo_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U1_DECIMAL_ADD_SUB",
      unit_name: "小数加减",
      skill_id: "decimal_unit_conversion",
      skill_name: "元角分换算",
      ability_dimension: ["calculation", "strategy"],
      exam_priority: "MUST_SMALL",
      game_type: "coin_combo",
      play_as: "coin_combo",
      cognitive_level: "application",
      difficulty: 2,
      question_format: "multi_choice",
      estimated_time_seconds: 35,
      stem: "用下面的钱凑出 ¥8.5 元",
      coin_combo: {
        coins: [0.5, 1, 2, 3, 5],
        target: 8.5,
        correctIndices: [0, 3, 4],
      },
      answer: { type: "choice", value: "0,3,4" },
      solution_steps: ["0.5 + 3 + 5 = 8.5"],
      hints: [{ text: "看哪几个加起来正好等于目标", penalty: 1 }],
      common_errors: [],
      feedback_correct: "🪙 凑得真巧！",
      feedback_wrong: "差多少？",
      tags: ["sample"],
    } as unknown as Question,
  },
  {
    id: "time_heist",
    label: "时间窃贼",
    emoji: "⏰",
    isNew: true,
    question: {
      question_id: "PG_time_heist_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4A_U6_DIVISION",
      unit_name: "时间计算",
      skill_id: "speed_time_distance",
      skill_name: "时间运算",
      ability_dimension: ["calculation", "modeling"],
      exam_priority: "NORMAL",
      game_type: "time_heist",
      play_as: "time_heist",
      cognitive_level: "application",
      difficulty: 3,
      question_format: "single_choice",
      estimated_time_seconds: 35,
      stem: "Selena 7:30 开始练琴，8:15 结束。她练了多久？",
      time_heist: {
        mode: "duration",
        startTime: "07:30",
        endTime: "08:15",
        showOn: "start",
      },
      options: [
        { id: "A", text: "45 分钟" },
        { id: "B", text: "1 小时 15 分钟", errorTag: "carry" },
        { id: "C", text: "30 分钟", errorTag: "minute_off" },
        { id: "D", text: "1 小时", errorTag: "round_up" },
      ],
      answer: { type: "choice", value: "A" },
      solution_steps: ["8:15 - 7:30 = 45 分钟"],
      hints: [{ text: "分钟不够减，借 1 小时 = 60 分钟", penalty: 1 }],
      common_errors: [],
      feedback_correct: "⏰ 时间感超准！",
      feedback_wrong: "用结束减开始",
      tags: ["sample"],
    } as unknown as Question,
  },
  {
    id: "number_hunt",
    label: "数字寻宝",
    emoji: "💎",
    isNew: true,
    question: {
      question_id: "PG_number_hunt_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U1_DECIMAL_ADD_SUB",
      unit_name: "小数比较",
      skill_id: "decimal_compare",
      skill_name: "小数大小比较",
      ability_dimension: ["concept", "reasoning"],
      exam_priority: "HIGH",
      game_type: "number_hunt",
      play_as: "number_hunt",
      cognitive_level: "reasoning",
      difficulty: 3,
      question_format: "multi_choice",
      estimated_time_seconds: 45,
      stem: "把所有大于 1.5 的小数都找出来",
      number_hunt: {
        grid: [
          0.8, 1.6, 2.3, 0.9, 1.2,
          1.5, 1.7, 0.4, 2.1, 0.7,
          1.0, 1.8, 0.6, 2.5, 1.4,
          0.3, 1.9, 1.1, 2.0, 0.5,
          1.3, 0.2, 2.4, 1.65, 0.95,
        ],
        rule: "严格大于 1.5",
        targetIndices: [1, 2, 6, 8, 11, 13, 16, 18, 22, 23],
      },
      answer: { type: "choice", value: "1,2,6,8,11,13,16,18,22,23" },
      solution_steps: [
        "比 1.5 大：1.6 / 2.3 / 1.7 / 2.1 / 1.8 / 2.5 / 1.9 / 2.0 / 2.4 / 1.65",
      ],
      hints: [{ text: "整数 ≥ 2 一定大；十分位 ≥ 6 也大", penalty: 1 }],
      common_errors: [],
      feedback_correct: "💎 全找对了！",
      feedback_wrong: "再扫一遍，多了或少了？",
      tags: ["sample"],
    } as unknown as Question,
  },

  // ──── 之前 0 题的玩法（激活后第一次能看到）────
  {
    id: "speed_match",
    label: "闪电匹配",
    emoji: "⚡",
    isNew: true,
    question: {
      question_id: "PG_speed_match_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U3_DECIMAL_MULTIPLY",
      unit_name: "小数乘法",
      skill_id: "decimal_mul_meaning",
      skill_name: "速算",
      ability_dimension: ["calculation"],
      exam_priority: "HIGH",
      game_type: "speed_match",
      play_as: "speed_match",
      cognitive_level: "procedural",
      difficulty: 2,
      // v0.31.88: speed_match panel 只在 single_choice 走 options 分支；
      // numeric_choice 会进 numeric 分支但要求 answer.type=number → 都不命中 → 兜底 "OK"
      question_format: "single_choice",
      estimated_time_seconds: 12,
      stem: "0.6 × 5 = ?",
      options: [
        { id: "A", text: "3" },
        { id: "B", text: "30", errorTag: "decimal_misplace" },
        { id: "C", text: "0.3", errorTag: "extra_decimal" },
        { id: "D", text: "11", errorTag: "calc_random" },
      ],
      answer: { type: "choice", value: "A" },
      solution_steps: ["6 × 5 = 30，再把小数点回到 1 位 → 3"],
      hints: [{ text: "先按整数算，最后看小数位数", penalty: 1 }],
      common_errors: [],
      feedback_correct: "⚡ 反应快！",
      feedback_wrong: "小数位数对不对？",
      tags: ["sample"],
    } as unknown as Question,
  },
  {
    id: "clue_finder",
    label: "线索侦探",
    emoji: "🔍",
    isNew: true,
    question: {
      question_id: "PG_clue_finder_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U5_EQUATIONS",
      unit_name: "方程",
      skill_id: "equation_one_step_word",
      skill_name: "应用题读题",
      ability_dimension: ["modeling", "reasoning"],
      exam_priority: "HIGH",
      game_type: "clue_finder",
      play_as: "clue_finder",
      cognitive_level: "reasoning",
      difficulty: 3,
      question_format: "multi_choice",
      estimated_time_seconds: 50,
      stem: "选出**列方程**真正需要的条件：小红有一些苹果，吃了 3 个后还剩 5 个。",
      subquestions: [
        {
          kind: "clue_pick",
          prompt: "勾选必要条件",
          clues: ["吃了 3 个", "还剩 5 个", "苹果是红色的", "苹果在桌上"],
          correct: [0, 1],
        },
      ],
      answer: { type: "choice", value: "0,1" },
      solution_steps: ["列方程 x - 3 = 5，需要的是吃掉数 + 剩余数"],
      hints: [{ text: "和数学有关的条件才有用", penalty: 1 }],
      common_errors: [],
      feedback_correct: "🔍 找对了关键线索",
      feedback_wrong: "无关条件不要选",
      tags: ["sample"],
    } as unknown as Question,
  },
  {
    id: "sort_ladder",
    label: "数字阶梯",
    emoji: "🪜",
    isNew: true,
    question: {
      question_id: "PG_sort_ladder_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U1_DECIMAL_ADD_SUB",
      unit_name: "小数比较",
      skill_id: "decimal_compare",
      skill_name: "小数大小比较",
      ability_dimension: ["concept", "reasoning"],
      exam_priority: "HIGH",
      game_type: "sort_ladder",
      play_as: "sort_ladder",
      cognitive_level: "reasoning",
      difficulty: 2,
      question_format: "sort_ladder",
      estimated_time_seconds: 30,
      stem: "把这些小数从小到大排列",
      options: [
        { id: "a", text: "0.06" },
        { id: "b", text: "0.6" },
        { id: "c", text: "0.106" },
        { id: "d", text: "0.16" },
      ],
      answer: { type: "choice", value: "a,c,d,b" },
      solution_steps: ["0.06 < 0.106 < 0.16 < 0.6"],
      hints: [{ text: "看十分位、百分位、千分位", penalty: 1 }],
      common_errors: [],
      feedback_correct: "🪜 全部排对了",
      feedback_wrong: "比较小数从最高位开始",
      tags: ["sample"],
    } as unknown as Question,
  },
  {
    id: "true_false_swipe",
    label: "对错冲刺",
    emoji: "✓✗",
    isNew: true,
    question: {
      question_id: "PG_tfs_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U1_DECIMAL_ADD_SUB",
      unit_name: "小数",
      skill_id: "decimal_compare",
      skill_name: "判断对错",
      ability_dimension: ["concept", "reasoning"],
      exam_priority: "NORMAL",
      game_type: "true_false_swipe",
      play_as: "true_false_swipe",
      cognitive_level: "recall",
      difficulty: 1,
      question_format: "single_choice",
      estimated_time_seconds: 8,
      stem: "0.5 比 0.49 大。",
      options: [
        { id: "T", text: "对" },
        { id: "F", text: "错" },
      ],
      answer: { type: "choice", value: "T" },
      solution_steps: ["0.5 = 0.50，0.50 > 0.49"],
      hints: [{ text: "把小数位数补齐再比", penalty: 1 }],
      common_errors: [],
      feedback_correct: "✓",
      feedback_wrong: "再想想",
      tags: ["sample"],
    } as unknown as Question,
  },
  {
    id: "vertical_repair",
    label: "竖式修理厂",
    emoji: "🔧",
    isNew: true,
    question: {
      question_id: "PG_vr_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U1_DECIMAL_ADD_SUB",
      unit_name: "小数加减",
      skill_id: "decimal_add_sub_vertical",
      skill_name: "竖式计算",
      ability_dimension: ["calculation"],
      exam_priority: "HIGH",
      game_type: "vertical_repair",
      play_as: "vertical_repair",
      cognitive_level: "procedural",
      difficulty: 3,
      // v0.31.88: vertical_repair panel 需要 single_choice + 4 options。
      // v0.31.90: 之前 hl:11 把 11 渲染成单独高亮行，看起来像第 5 行。
      //   现在用 result:6.15(✗ wrong on purpose) → highlight 整行让题面与文案一致。
      question_format: "single_choice",
      estimated_time_seconds: 40,
      stem: "找错：下面这道小数加法的竖式，正确答案是什么？",
      options: [
        { id: "A", text: "6.15", errorTag: "carry_error" },
        { id: "B", text: "5.15", errorTag: "wrong_int" },
        { id: "C", text: "6.05", errorTag: "missed_tenths" },
        { id: "D", text: "5.95", errorTag: "off_by_two" },
      ],
      answer: { type: "choice", value: "A" },
      // tags：竖式 3 行（被加数 / 运算符 + 加数 / 结果），最后一行是题面写错的结果
      tags: ["sample", "vert:3.45", "op:+", "vert:2.70", "result:6.11"],
      solution_steps: [
        "百分位 5 + 0 = 5",
        "十分位 4 + 7 = 11，写 1 进 1",
        "个位 3 + 2 + 1（进位） = 6",
        "所以正确答案是 6.15。题里写 6.11 是十分位进位算错。",
      ],
      hints: [{ text: "看十分位 4 + 7 是不是 11", penalty: 1 }],
      common_errors: [],
      feedback_correct: "🔧 火眼金睛",
      feedback_wrong: "再核对十分位 + 进位",
    } as unknown as Question,
  },
  {
    id: "memory_match",
    label: "记忆配对",
    emoji: "🃏",
    isNew: true,
    question: {
      question_id: "PG_mm_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U1_DECIMAL_ADD_SUB",
      unit_name: "小数",
      skill_id: "decimal_meaning_place",
      skill_name: "小数意义",
      ability_dimension: ["concept"],
      exam_priority: "MUST_SMALL",
      game_type: "memory_match",
      play_as: "memory_match",
      cognitive_level: "recall",
      difficulty: 2,
      question_format: "single_choice",
      estimated_time_seconds: 30,
      stem: "把数字和它的读法配对（演示）",
      options: [
        { id: "A", text: "0.5 ↔ 五分之一", errorTag: "wrong_pair" },
        { id: "B", text: "0.5 ↔ 十分之五" },
      ],
      answer: { type: "choice", value: "B" },
      solution_steps: ["0.5 = 5/10 = 十分之五"],
      hints: [{ text: "0.X 是十分之 X", penalty: 1 }],
      common_errors: [],
      feedback_correct: "🃏 配对成功",
      feedback_wrong: "再想想分母",
      tags: ["sample"],
    } as unknown as Question,
  },
  {
    id: "shape_court",
    label: "图形法庭",
    emoji: "⚖️",
    isNew: true,
    question: {
      question_id: "PG_sc_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U2_TRI_QUAD",
      unit_name: "三角形",
      // v0.31.90: ShapeCourt 跟 TriangleJudge 区分 —
      //   ShapeCourt = "三根木棒能否围成三角形" 可视化判断 (T/F)
      //   TriangleJudge = 给角度 / 边长做分类 / 求边角
      skill_id: "triangle_inequality",
      skill_name: "三角形三边关系",
      ability_dimension: ["reasoning", "spatial"],
      exam_priority: "MUST_SMALL",
      game_type: "shape_court",
      play_as: "shape_court",
      cognitive_level: "reasoning",
      difficulty: 2,
      question_format: "single_choice",
      estimated_time_seconds: 20,
      stem: "三根木棒分别长 3 cm、4 cm、8 cm，能围成三角形吗？",
      tags: ["sample", "sticks:3,4,8"],
      options: [
        { id: "T", text: "能" },
        { id: "F", text: "不能" },
      ],
      answer: { type: "choice", value: "F" },
      solution_steps: ["任意两边和 > 第三边？3 + 4 = 7 < 8 → 不能"],
      hints: [{ text: "两条短边的和要大于最长边", penalty: 1 }],
      common_errors: [],
      feedback_correct: "⚖️ 判得对",
      feedback_wrong: "三边关系再算一下",
    } as unknown as Question,
  },
  {
    id: "chart_detective",
    label: "数据侦探",
    emoji: "📊",
    isNew: true,
    question: {
      question_id: "PG_cd_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U6_DATA",
      unit_name: "数据",
      skill_id: "data_bar_chart",
      skill_name: "条形统计图",
      ability_dimension: ["data", "reasoning"],
      exam_priority: "HIGH",
      game_type: "chart_detective",
      play_as: "chart_detective",
      cognitive_level: "application",
      difficulty: 2,
      // v0.31.88: chart_detective panel 是"拖动黄虚线到平均数位置"，不是 4 选 1。
      // 之前样例题问"最高那天"跟 UI 完全不匹配。改成找平均数。
      // bars: 5 天数据 (8, 12, 6, 10, 9)，平均 = 9。step=1。
      question_format: "numeric",
      estimated_time_seconds: 30,
      stem: "看条形图：5 天的数量分别是 8 / 12 / 6 / 10 / 9，把黄色虚线拖到平均数位置。",
      answer: { type: "number", value: 9 },
      tags: ["sample", "bars:8,12,6,10,9", "step:1"],
      solution_steps: ["(8+12+6+10+9) ÷ 5 = 45 ÷ 5 = 9"],
      hints: [{ text: "总和 ÷ 个数", penalty: 1 }],
      common_errors: [],
      feedback_correct: "📊 看图准",
      feedback_wrong: "比一下数",
    } as unknown as Question,
  },
  {
    id: "equation_builder",
    label: "方程拼装",
    emoji: "🧩",
    isNew: true,
    question: {
      question_id: "PG_eb_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U5_EQUATIONS",
      unit_name: "方程",
      skill_id: "distributive_law",
      skill_name: "乘法分配律",
      ability_dimension: ["strategy", "reasoning"],
      exam_priority: "MUST_BIG",
      game_type: "equation_builder",
      play_as: "equation_builder",
      cognitive_level: "procedural",
      difficulty: 3,
      // v0.31.88: equation_builder 需要 word_problem_steps.equation_or_expression 或
      // answer.multi_step 含 expression 步，否则会兜底到"500" 单数字（无拼装）。
      // 这里提供完整表达式让 panel 拆 token → 拼装的过程。
      // v0.31.90: 去掉 stem 里"下方拼出 25 × (8+12)"的答案泄漏
      question_format: "fill_blank",
      estimated_time_seconds: 30,
      stem: "用乘法分配律算更简单：25 × 8 + 25 × 12 = ?\n下方拼出一个用了分配律的更简表达式：",
      answer: { type: "number", value: 500 },
      word_problem_steps: {
        question: "用乘法分配律算总和",
        relationship: "(a+b)×c = a×c + b×c",
        equation_or_expression: "25*(8+12)",
      },
      solution_steps: ["25 × (8 + 12) = 25 × 20 = 500"],
      hints: [{ text: "提公因数 25 出来", penalty: 1 }],
      common_errors: [],
      feedback_correct: "🧩 提得漂亮",
      feedback_wrong: "找两个加数都有的因数",
      tags: ["sample"],
    } as unknown as Question,
  },

  // ──── 现有玩法（确认还工作）────
  {
    id: "plain_choice",
    label: "选择题",
    emoji: "📝",
    question: {
      question_id: "PG_pc_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U1_DECIMAL_ADD_SUB",
      unit_name: "小数",
      skill_id: "decimal_meaning_place",
      skill_name: "小数意义",
      ability_dimension: ["concept"],
      exam_priority: "MUST_SMALL",
      game_type: "plain_choice",
      play_as: "plain_choice",
      cognitive_level: "recall",
      difficulty: 2,
      question_format: "single_choice",
      estimated_time_seconds: 20,
      stem: "0.7 表示什么？",
      options: [
        { id: "A", text: "七分之一" },
        { id: "B", text: "十分之七" },
        { id: "C", text: "百分之七" },
        { id: "D", text: "七十" },
      ],
      answer: { type: "choice", value: "B" },
      solution_steps: ["0.7 = 7/10"],
      hints: [{ text: "0.X = 十分之 X", penalty: 1 }],
      common_errors: [],
      feedback_correct: "📝 对了",
      feedback_wrong: "想想分母",
      tags: ["sample"],
    } as unknown as Question,
  },
  {
    id: "shop_counter",
    label: "小数商店",
    emoji: "🛒",
    question: {
      question_id: "PG_shop_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U3_DECIMAL_MULTIPLY",
      unit_name: "小数乘法",
      skill_id: "decimal_price_quantity",
      skill_name: "购物",
      ability_dimension: ["calculation", "modeling"],
      exam_priority: "MUST_BIG",
      game_type: "shop_counter",
      play_as: "shop_counter",
      cognitive_level: "application",
      difficulty: 3,
      question_format: "multi_step",
      estimated_time_seconds: 50,
      stem: "苹果 ¥3.5/斤，香蕉 ¥2.8/斤。买 2 斤苹果 + 3 斤香蕉，一共多少钱？",
      // v0.31.88: subquestion kind 必须是 "numeric" / "choose" / "clue_pick"
      // （之前用了不存在的 "fill" → buildSubquestions 过滤掉 → 走 fallback）
      subquestions: [
        {
          kind: "numeric",
          prompt: "第 1 步：苹果总价 = 3.5 × 2 = ?",
          value: 7,
          unit: "元",
        },
        {
          kind: "numeric",
          prompt: "第 2 步：香蕉总价 = 2.8 × 3 = ?",
          value: 8.4,
          unit: "元",
        },
        {
          kind: "numeric",
          prompt: "第 3 步：合计 = 苹果 + 香蕉 = ?",
          value: 15.4,
          unit: "元",
        },
      ],
      answer: { type: "number", value: 15.4 },
      solution_steps: [
        "苹果 3.5×2=7",
        "香蕉 2.8×3=8.4",
        "合计 7+8.4=15.4",
      ],
      hints: [{ text: "单价 × 数量", penalty: 1 }],
      common_errors: [],
      feedback_correct: "🛒 算账小能手",
      feedback_wrong: "再核对",
      tags: ["sample"],
    } as unknown as Question,
  },
  {
    id: "decimal_shifter",
    label: "小数滑梯",
    emoji: "🛝",
    question: {
      question_id: "PG_ds_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
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
      question_format: "numeric",
      estimated_time_seconds: 25,
      stem: "把 3.45 的小数点向右移动一位，得到的数是 ___",
      answer: { type: "number", value: 34.5 },
      solution_steps: ["右移 1 位 = ×10，3.45 × 10 = 34.5"],
      hints: [{ text: "右移 = 变大", penalty: 1 }],
      common_errors: [],
      feedback_correct: "🛝 滑得准",
      feedback_wrong: "方向 / 位数？",
      tags: ["sample", "shift:right:1", "start:3.45"],
    } as unknown as Question,
  },
  {
    id: "balance_lab",
    label: "天平实验室",
    emoji: "⚖️",
    question: {
      question_id: "PG_bl_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U5_EQUATIONS",
      unit_name: "方程",
      skill_id: "equation_solve_simple",
      skill_name: "解方程",
      ability_dimension: ["calculation", "strategy"],
      exam_priority: "MUST_SMALL",
      game_type: "balance_lab",
      play_as: "balance_lab",
      cognitive_level: "procedural",
      difficulty: 3,
      // v0.31.88: balance_lab 是"天平操作"题：tags.eq 是初始方程，answer.number 是 x 解。
      // panel 通过等式两边操作（两边 -5、两边 ÷3）化简到 x=5。
      // 之前用 choice + 没 eq tag → parseEq 退化为 x=0 → useEffect 立刻判完。
      question_format: "numeric",
      estimated_time_seconds: 35,
      stem: "解方程 3x + 5 = 20。用下方按钮操作两边，把它化简到 x = ?",
      answer: { type: "number", value: 5 },
      tags: ["sample", "eq:3x+5=20"],
      solution_steps: ["两边 -5 → 3x = 15", "两边 ÷3 → x = 5"],
      hints: [{ text: "先减后除", penalty: 1 }],
      common_errors: [],
      feedback_correct: "⚖️ 平衡了",
      feedback_wrong: "等式两边都要做同样操作",
    } as unknown as Question,
  },
  {
    id: "cube_view",
    label: "立体观察",
    emoji: "🧊",
    question: {
      question_id: "PG_cv_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U4_OBSERVE_OBJECTS",
      unit_name: "观察物体",
      skill_id: "observe_front_top_left",
      skill_name: "三视图",
      ability_dimension: ["spatial"],
      exam_priority: "LOW_SMALL",
      game_type: "cube_view",
      play_as: "cube_view",
      cognitive_level: "application",
      difficulty: 2,
      // v0.31.90: 改成 single_choice 让能看到错答效果（4 选 1）
      // tags 提供 3D 立体 + 正视图渲染
      question_format: "single_choice",
      estimated_time_seconds: 30,
      stem: "下面立体图形从正面看到的形状如图，最少由几个正方体搭成？",
      tags: ["sample", "solid:0,0,0|1,0,0|2,0,0|0,1,0|1,1,0", "grid-front:3x2:1,1,1|1,1,0"],
      options: [
        { id: "A", text: "4 个", errorTag: "missed_hidden" },
        { id: "B", text: "5 个" },
        { id: "C", text: "6 个", errorTag: "over_count" },
        { id: "D", text: "7 个", errorTag: "wrong_layer" },
      ],
      answer: { type: "choice", value: "B" },
      solution_steps: ["底排 3 + 上排 2 = 5 个；前视图遮挡部分不显示但要算"],
      hints: [{ text: "前视看到的轮廓只是表面，被遮的也要数", penalty: 1 }],
      common_errors: [],
      feedback_correct: "🧊 空间感真好",
      feedback_wrong: "前视图只显示形状，后面遮的还要算",
    } as unknown as Question,
  },
  {
    id: "triangle_judge",
    label: "三角形法庭",
    emoji: "△",
    question: {
      question_id: "PG_tj_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U2_TRI_QUAD",
      unit_name: "三角形",
      skill_id: "triangle_inequality",
      skill_name: "三角形三边关系",
      ability_dimension: ["reasoning", "spatial"],
      exam_priority: "MUST_SMALL",
      game_type: "triangle_judge",
      play_as: "triangle_judge",
      cognitive_level: "reasoning",
      difficulty: 3,
      question_format: "single_choice",
      estimated_time_seconds: 25,
      stem: "三条边 3、4、5 能围成三角形吗？",
      options: [
        { id: "A", text: "能" },
        { id: "B", text: "不能" },
      ],
      answer: { type: "choice", value: "A" },
      solution_steps: ["3 + 4 = 7 > 5，可以围成"],
      hints: [{ text: "任意两边和 > 第三边", penalty: 1 }],
      common_errors: [],
      feedback_correct: "△ 围成了",
      feedback_wrong: "看三边关系",
      tags: ["sample"],
    } as unknown as Question,
  },
  {
    id: "dot_grid_draw",
    label: "点子图画图",
    emoji: "🟪",
    question: {
      question_id: "PG_dgd_001",
      subjectId: "math",
      version: 1,
      status: "approved",
      grade: 4,
      term: "下册",
      unit_id: "G4B_U2_TRI_QUAD",
      unit_name: "三角形",
      skill_id: "triangle_classification",
      skill_name: "三角形构造",
      ability_dimension: ["spatial", "concept"],
      exam_priority: "HIGH_SMALL",
      game_type: "dot_grid_draw",
      play_as: "dot_grid_draw",
      cognitive_level: "application",
      difficulty: 3,
      question_format: "geometry_operation",
      estimated_time_seconds: 60,
      stem: "在点子图上画一个等腰三角形",
      answer: { type: "choice", value: "isosceles_triangle" },
      dot_grid: {
        gridWidth: 6,
        gridHeight: 6,
        targetShape: "isosceles_triangle",
        minVertices: 3,
        maxVertices: 3,
      },
      solution_steps: ["选 3 个点，至少两条边相等"],
      hints: [{ text: "对称去找", penalty: 1 }],
      common_errors: [],
      feedback_correct: "画对了",
      feedback_wrong: "等腰要两边相等",
      tags: ["sample"],
    } as unknown as Question,
  },
];

export function PlaygroundPage() {
  const [currentId, setCurrentId] = useState<string>(SAMPLES[0]!.id);
  const [feedback, setFeedback] = useState<string>("");
  const [round, setRound] = useState(0);

  const sample = SAMPLES.find((s) => s.id === currentId) ?? SAMPLES[0]!;

  return (
    <div className="space-y-4">
      <section className="card-glow bg-gradient-to-br from-violet-500/15 to-pink-500/10 border-violet-400/20">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-3xl">🧪</div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-lg text-brand">
              玩法试玩台
            </h1>
            <div className="text-xs text-slate-400 mt-0.5">
              {SAMPLES.length} 种 game template 各一道示例题。**不计 attempt / 不存数据 / 不算 XP**，纯试玩。
            </div>
          </div>
          {/* v0.31.88: 从 admin 内 tab 渲染时不需要回首页，logo 一直在 */}
        </div>
      </section>

      {/* Sample picker */}
      <section className="card border-ink-700/60">
        <div className="text-xs text-slate-400 mb-2">选一个题型试玩 ↓ — 🆕 表示之前 0 题或全新</div>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => {
            const active = s.id === currentId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setCurrentId(s.id);
                  setRound((r) => r + 1);
                  setFeedback("");
                }}
                className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                  active
                    ? "bg-violet-500/30 border-violet-400/60 text-violet-100"
                    : "bg-white/5 border-ink-700/60 text-slate-300 hover:bg-white/10"
                }`}
              >
                <span className="mr-1">{s.emoji}</span>
                {s.label}
                {s.isNew && <span className="ml-1 text-amber-300">🆕</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* GameShell render */}
      <section
        key={`${sample.id}-${round}`}
        className="card border-ink-700/60 overflow-hidden"
      >
        <GameShell
          question={sample.question}
          index={0}
          total={1}
          xp={0}
          combo={0}
          countdownEnabled={false}
          examMode={false}
          showStarter={false}
          noRetry={true}
          onSubmit={async (result) => {
            setFeedback(
              result.isCorrect
                ? "✅ 答对了"
                : `❌ 答错了 (errorTags: ${(result.matchedErrorTags ?? []).join(", ") || "—"})`,
            );
            return { points: 0 };
          }}
          onNext={() => {
            setRound((r) => r + 1);
            setFeedback("");
          }}
        />
      </section>

      {feedback && (
        <section className="card border-ink-700/60 text-sm">
          <div className="text-slate-300">{feedback}</div>
          <button
            type="button"
            onClick={() => {
              setRound((r) => r + 1);
              setFeedback("");
            }}
            className="btn-ghost mt-2 text-xs px-3 py-1.5 border border-ink-700/60"
          >
            🔁 重置这道题
          </button>
        </section>
      )}

      <section className="card border-ink-700/40 text-xs text-slate-500">
        <div className="font-mono">
          play_as: <span className="text-violet-300">{sample.question.play_as as GameTemplate}</span>
        </div>
        <div className="font-mono mt-1">
          game_type: <span className="text-violet-300">{sample.question.game_type}</span>
        </div>
        <div className="font-mono mt-1">
          question_format: <span className="text-violet-300">{sample.question.question_format}</span>
        </div>
      </section>
    </div>
  );
}
