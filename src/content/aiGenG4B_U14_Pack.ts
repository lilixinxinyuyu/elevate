/**
 * AI_GEN_G4B_U14_PACK — v0.30.12 G4B U1-U4 必考 skill 补强包
 *
 * 触发：v0.30.10 inventory 显示 11 个必考 skill 距 30 道目标差 49 道。
 * 用浏览器自动化跑 /api/generate/questions（DashScope qwen-plus），count=4/批
 * 4 并发 ~5 分钟。本文件由 scripts/_emit-g4b-u14-pack.mjs 转译，**勿手改**。
 *
 * 总数：60 道
 * 难度：D2=18 / D3=8 / D4=34
 *
 * 涵盖技能：
 *   decimal_price_quantity:9, decimal_mul_meaning:3, decimal_meaning_place:10, triangle_classification:6, decimal_product_digits:7, decimal_add_sub_vertical:8, triangle_angle_sum:4, decimal_mul_simplify:5, decimal_add_sub_simplify:8
 */

import type { Question } from "../core/types";

export const AI_GEN_G4B_U14_PACK: Question[] = [
  {
    "question_id": "AI_G4B_SHOP_001__mos6vr8t_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_price_quantity",
    "skill_name": "总价=单价×数量，购物问题",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 50,
    "stem": "一包饼干 5.8 元，小红买了 7 包；一瓶果汁 9.5 元，她又买了 3 瓶。一共要付多少元？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "69.1"
      },
      {
        "id": "B",
        "text": "5.8"
      },
      {
        "id": "C",
        "text": "691.0"
      },
      {
        "id": "D",
        "text": "40.6"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先算饼干总价：5.8 × 7 = 40.6（元）；再算果汁总价：9.5 × 3 = 28.5（元）；最后相加：40.6 + 28.5 = 69.1（元）"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiply_quantity",
        "error": "只写了单价，没乘数量，如只写 5.8 或 9.5",
        "remediation": "记住：总价 = 单价 × 数量，每种商品都要算清楚再相加！"
      },
      {
        "tag": "decimal_point_error",
        "error": "小数点位置错，如把 5.8 × 7 算成 58 × 7 = 406，漏掉小数点变成 406.0",
        "remediation": "5.8 是 58 个 0.1，所以 5.8 × 7 = 40.6，小数位数要和原来一样（1 位）"
      }
    ],
    "feedback_correct": "太棒啦！你把两种商品的总价都算对了，还准确相加～",
    "feedback_wrong": "别灰心！检查一下：每种商品是不是都用‘单价×数量’算过？小数点有没有放对位置？",
    "hints": [
      {
        "text": "先分别算出饼干和果汁的总价，再把两个结果加起来。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:cookie-5.8-7|juice-9.5-3"
    ],
    "exam_priority": "HIGH_SMALL"
  },
  {
    "question_id": "AI_G4B_SHOP_002__mos6vr8t_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_price_quantity",
    "skill_name": "总价=单价×数量，购物问题",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 50,
    "stem": "文具店卖彩色铅笔，每盒 12.6 元；小明买了 4 盒，付给收银员 60 元。应找回多少元？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "9.6"
      },
      {
        "id": "B",
        "text": "12.6"
      },
      {
        "id": "C",
        "text": "96.0"
      },
      {
        "id": "D",
        "text": "47.4"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先算总价：12.6 × 4 = 50.4（元）；再算找回钱：60 − 50.4 = 9.6（元）"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiply_quantity",
        "error": "直接用 60 − 12.6，忘了乘 4 盒",
        "remediation": "注意：小明买了 4 盒，不是 1 盒！必须先算总花费，再找零。"
      },
      {
        "tag": "operation_error",
        "error": "加减号搞反，如算成 60 + 50.4 = 110.4",
        "remediation": "找零是‘付的钱’减去‘花的钱’，一定是减法哦！"
      }
    ],
    "feedback_correct": "真细心！你既算对了总价，又用减法算出了正确找零～",
    "feedback_wrong": "加油！记得分两步：第一步算总共花了多少钱，第二步用付的钱减它～",
    "hints": [
      {
        "text": "先算 4 盒铅笔一共多少钱，再用 60 元减去这个数。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:colored_pencil-12.6-4"
    ],
    "exam_priority": "MUST_SMALL"
  },
  {
    "question_id": "AI_G4B_SM_001__mos6vr8t_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_price_quantity",
    "skill_name": "总价=单价×数量，购物问题",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 2,
    "estimated_time_seconds": 50,
    "stem": "一包饼干 5.6 元，小红买了 3 包。她付了 20 元，应找回多少元？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "2.2"
      },
      {
        "id": "B",
        "text": "5.6"
      },
      {
        "id": "C",
        "text": "16.8"
      },
      {
        "id": "D",
        "text": "3.2"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "D"
    },
    "solution_steps": [
      "先算总价：5.6 × 3 = 16.8（元）；再算找回：20 − 16.8 = 3.2（元）"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiplication",
        "error": "直接用 20 − 5.6，忘了乘数量 3",
        "remediation": "记得先算总共花了多少钱：单价 × 数量"
      },
      {
        "tag": "decimal_point_error",
        "error": "算 5.6 × 3 得 168 或 1.68，小数点位置错",
        "remediation": "5.6 是 56 个 0.1，×3 = 168 个 0.1，即 16.8"
      }
    ],
    "feedback_correct": "答对啦！先算总价再找零，思路真清晰～",
    "feedback_wrong": "再想想：要先算一共花了多少钱，才能知道找回多少哦！",
    "hints": [
      {
        "text": "第一步：算 3 包饼干一共多少钱？第二步：用 20 元减去这个钱。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:cookie-5.6-3"
    ],
    "exam_priority": "HIGH_SMALL"
  },
  {
    "question_id": "AI_G4B_SM_002__mos6vr8t_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_price_quantity",
    "skill_name": "总价=单价×数量，购物问题",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 50,
    "stem": "文具店卖铅笔每支 1.25 元，橡皮每块 0.9 元。小明买 4 支铅笔和 5 块橡皮，共需多少元？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "9.5"
      },
      {
        "id": "B",
        "text": "1.25"
      },
      {
        "id": "C",
        "text": "95.0"
      },
      {
        "id": "D",
        "text": "5.0"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "铅笔总价：1.25 × 4 = 5.00（元）；橡皮总价：0.9 × 5 = 4.50（元）；合计：5.00 + 4.50 = 9.50（元）"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiplication",
        "error": "只选了铅笔单价 1.25 或橡皮单价 0.9，没乘数量",
        "remediation": "每种商品都要算‘单价 × 数量’，再相加"
      },
      {
        "tag": "decimal_point_error",
        "error": "1.25 × 4 算成 125 × 4 = 500，漏掉小数点得 500 或 50.0",
        "remediation": "1.25 是 125 个 0.01，×4 = 500 个 0.01 = 5.00"
      }
    ],
    "feedback_correct": "太棒了！两种商品分别算总价再相加，你就是购物小能手！",
    "feedback_wrong": "别急～记得每种商品都算‘单价 × 数量’，再把两部分加起来哦！",
    "hints": [
      {
        "text": "分开算：4 支铅笔多少钱？5 块橡皮多少钱？最后加起来。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:pencil-1.25-4|eraser-0.9-5"
    ],
    "exam_priority": "MUST_SMALL"
  },
  {
    "question_id": "AI_G4B_SM_001__mos6vwaz_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_price_quantity",
    "skill_name": "总价=单价×数量，购物问题",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 50,
    "stem": "文具店卖荧光笔，每支 4.2 元。小红买了 7 支，她付了 50 元，应找回多少元？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "20.6"
      },
      {
        "id": "B",
        "text": "4.2"
      },
      {
        "id": "C",
        "text": "29.4"
      },
      {
        "id": "D",
        "text": "30.6"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先算总价：4.2 × 7 = 29.4（元）；再算找回：50 − 29.4 = 20.6（元）"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiplication",
        "error": "直接用 50 − 4.2，忘了乘数量 7",
        "remediation": "单价要乘数量才得总价，不能只用单价去减！"
      },
      {
        "tag": "decimal_point_error",
        "error": "算 4.2 × 7 得 294 或 2.94，小数点位置错",
        "remediation": "4.2 是一位小数，乘整数后积也是一位小数：4.2 × 7 = 29.4"
      }
    ],
    "feedback_correct": "答对啦！先算总价再找零，思路真清晰～",
    "feedback_wrong": "再检查一下：总价是单价×数量，别漏乘哦！",
    "hints": [
      {
        "text": "第一步：算出 7 支荧光笔一共多少钱？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:fluorescent_pen-4.2-7"
    ],
    "exam_priority": "HIGH_BIG"
  },
  {
    "question_id": "AI_G4B_SM_002__mos6vwaz_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_price_quantity",
    "skill_name": "总价=单价×数量，购物问题",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 50,
    "stem": "超市里苹果每千克 13.6 元，橙子每千克 9.8 元。妈妈买了 2.5 千克苹果和 1.5 千克橙子，一共应付多少元？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "48.7"
      },
      {
        "id": "B",
        "text": "13.6"
      },
      {
        "id": "C",
        "text": "49.7"
      },
      {
        "id": "D",
        "text": "34.0"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "苹果总价：13.6 × 2.5 = 34.0（元）；橙子总价：9.8 × 1.5 = 14.7（元）；合计：34.0 + 14.7 = 48.7（元）"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiplication",
        "error": "只加单价 13.6 + 9.8，没乘各自重量",
        "remediation": "不同重量要分别算总价，再相加！"
      },
      {
        "tag": "decimal_point_error",
        "error": "算 9.8 × 1.5 得 147 或 1.47，小数点错位",
        "remediation": "9.8（1位小数）×1.5（1位小数）= 积有2位小数：9.8×1.5=14.70 → 写作14.7"
      }
    ],
    "feedback_correct": "太棒啦！两种水果分开算总价再相加，步骤全对～",
    "feedback_wrong": "记得：每种商品都要‘单价×数量’，再把所有总价加起来哦！",
    "hints": [
      {
        "text": "先分别算苹果和橙子的总价，再把两个结果加起来。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:apple-13.6-2.5|orange-9.8-1.5"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_G4B_SM_002__mos6vwaz_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_price_quantity",
    "skill_name": "总价=单价×数量，购物问题",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 50,
    "stem": "文具店卖两种本子：横线本每本 4.2 元，方格本每本 5.8 元。小明买了 2 本横线本和 3 本方格本，一共要付多少元？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "25.8"
      },
      {
        "id": "B",
        "text": "10.0"
      },
      {
        "id": "C",
        "text": "24.0"
      },
      {
        "id": "D",
        "text": "27.0"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "横线本总价：4.2 × 2 = 8.4（元）；方格本总价：5.8 × 3 = 17.4（元）；合计：8.4 + 17.4 = 25.8（元）"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiplication",
        "error": "只加单价：4.2 + 5.8 = 10.0，忘了乘数量，误选 B",
        "remediation": "每种本子都买了多本，必须先算各自的总价！"
      },
      {
        "tag": "operation_error",
        "error": "算成 4.2 × 2 − 5.8 × 3 或其他加减反了，得 24.0 或 27.0，误选 C 或 D",
        "remediation": "题目说‘一共要付’，是加法，不是减法哦～"
      }
    ],
    "feedback_correct": "太厉害啦！两种本子分开算再相加，思路超清晰！",
    "feedback_wrong": "别急，把‘2 本横线本’和‘3 本方格本’分别算出钱，最后加起来就好～",
    "hints": [
      {
        "text": "先算横线本共多少元，再算方格本共多少元，最后把两个结果加起来。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:ruled_notebook-4.2-2|grid_notebook-5.8-3"
    ],
    "exam_priority": "MUST_SMALL"
  },
  {
    "question_id": "AI_G4B_SM_001__mos6wlc6_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_price_quantity",
    "skill_name": "总价=单价×数量，购物问题",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 50,
    "stem": "文具店卖彩色铅笔，每盒 12.6 元，小红买了 3 盒。她付了 50 元，应找回多少元？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "12.2"
      },
      {
        "id": "B",
        "text": "37.8"
      },
      {
        "id": "C",
        "text": "12.6"
      },
      {
        "id": "D",
        "text": "378"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先算总价：12.6 × 3 = 37.8（元）；再算找回：50 − 37.8 = 12.2（元）"
    ],
    "common_errors": [
      {
        "tag": "forgot_subtraction",
        "error": "只算出总价 37.8 元就选作答案，忘了找零",
        "remediation": "题目问的是‘应找回多少元’，不是‘一共花了多少元’，要记得用付的钱减去花的钱"
      },
      {
        "tag": "decimal_point_error",
        "error": "12.6 × 3 算成 126 × 3 = 378，漏掉小数点，得 378 元",
        "remediation": "小数乘整数时，先按整数乘，再从右往左数一位点小数点——12.6 有一位小数，结果也应有一位小数：37.8"
      }
    ],
    "feedback_correct": "答对啦！你既算对了总价，又记得找零，真是购物小能手！",
    "feedback_wrong": "再读一遍问题哦～‘应找回多少元’说明要算‘付的钱减去花的钱’。",
    "hints": [
      {
        "text": "第一步：算出3盒铅笔一共多少钱？第二步：用50元减去这个钱数。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:colored_pencil-12.6-3"
    ],
    "exam_priority": "HIGH_SMALL"
  },
  {
    "question_id": "AI_G4B_SM_002__mos6wlc6_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_price_quantity",
    "skill_name": "总价=单价×数量，购物问题",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 50,
    "stem": "周末超市促销：苹果 5.8 元/千克，香蕉 3.2 元/千克。妈妈买了 2 千克苹果和 4 千克香蕉，一共付了多少元？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "24.4"
      },
      {
        "id": "B",
        "text": "9.0"
      },
      {
        "id": "C",
        "text": "2.44"
      },
      {
        "id": "D",
        "text": "244"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "苹果总价：5.8 × 2 = 11.6（元）；香蕉总价：3.2 × 4 = 12.8（元）；合计：11.6 + 12.8 = 24.4（元）"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiplication",
        "error": "直接把单价相加再乘数量，如（5.8 + 3.2）× 2 或（5.8 + 3.2）× 4，没分商品单独算总价",
        "remediation": "不同商品单价不同、数量也不同，必须分别算出每种的总价，再相加"
      },
      {
        "tag": "decimal_point_error",
        "error": "5.8 × 2 算成 58 × 2 = 116，写成 116 元；或 3.2 × 4 算成 32 × 4 = 128，写成 128 元，导致总和错成 244 元",
        "remediation": "小数乘整数：先当整数乘，再看因数有几位小数，积就保留几位小数。5.8 有1位小数 → 5.8×2=11.6；3.2 有1位小数 → 3.2×4=12.8"
      }
    ],
    "feedback_correct": "太棒啦！你分清了两种水果，分别算总价再相加，思路超清晰！",
    "feedback_wrong": "别急～先算苹果花了多少钱，再算香蕉花了多少钱，最后把两个钱加起来哦。",
    "hints": [
      {
        "text": "苹果花的钱 = 5.8 × 2；香蕉花的钱 = 3.2 × 4；总共 = 两个结果相加。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:apple-5.8-2|banana-3.2-4"
    ],
    "exam_priority": "MUST_SMALL"
  },
  {
    "question_id": "AI_decimal_mul_meaning_002__mos6x22w_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_meaning",
    "skill_name": "小数乘法意义",
    "ability_dimension": [
      "modeling"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小明用 0.16 升油漆刷一块木板，他要刷 7 块同样的木板。下面哪句话最准确地说明了 0.16 × 7 的意义？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "7 升油漆里有多少个 0.16 升"
      },
      {
        "id": "B",
        "text": "7 块木板一共需要多少升油漆"
      },
      {
        "id": "C",
        "text": "每块木板用油漆量是 7 升的 0.16 倍"
      },
      {
        "id": "D",
        "text": "0.16 升油漆可以刷 7 块木板"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "0.16 升是每块木板用量，7 是木板块数，所以 0.16 × 7 表示 7 块木板的总用量，即总量 = 单位量 × 数量。"
    ],
    "common_errors": [
      {
        "tag": "inverse_interpretation",
        "error": "把 0.16 × 7 错当成‘7 里面有几个 0.16’（即除法意义）",
        "remediation": "乘法中，第一个数是‘每份是多少’，第二个整数是‘有几份’，结果是‘一共是多少’。"
      },
      {
        "tag": "misassign_role",
        "error": "混淆单位量和份数角色，如认为 0.16 是份数",
        "remediation": "圈出题干关键词：‘每块…0.16 升’→单位量；‘7 块’→份数；问‘一共’→求总量。"
      }
    ],
    "feedback_correct": "太棒了！你读懂了小数乘法在实际问题中的‘单位量 × 数量 = 总量’含义！",
    "feedback_wrong": "别急，抓住两个关键：‘每块’是多少？‘几块’？合起来就是一共多少哦～",
    "hints": [
      {
        "text": "找一找题干里的‘每…’和‘几…’——它们分别对应乘法算式里的哪个数？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_meaning_002__mos6xqxa_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_meaning",
    "skill_name": "小数乘法意义",
    "ability_dimension": [
      "modeling"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "李老师买 7 支自动铅笔，每支 1.6 元。下面哪句话正确表达了‘1.6 × 7’的意义？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "7 支铅笔一共多少元"
      },
      {
        "id": "B",
        "text": "1.6 支铅笔多少钱"
      },
      {
        "id": "C",
        "text": "每支铅笔 7 元，买 1.6 支要多少钱"
      },
      {
        "id": "D",
        "text": "1.6 元可以买几支铅笔"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "1.6 × 7 中，1.6 是每支单价（每份数），7 是数量（份数），乘积表示总价，即 7 支铅笔的总钱数。"
    ],
    "common_errors": [
      {
        "tag": "swap_factor_meaning",
        "error": "把两个因数的角色弄反，认为 1.6 是份数、7 是每份量",
        "remediation": "牢记：小数 × 整数中，整数一定是‘份数’（如支数、包数、次数），小数是‘每份的量’（如单价、每包重量）。"
      },
      {
        "tag": "misread_context",
        "error": "脱离情境，只看算式不读题干，误选与除法或反向问题相关的选项",
        "remediation": "读题时圈出关键词：‘买 7 支’‘每支 1.6 元’→ 求‘一共多少元’就是单价 × 数量。"
      }
    ],
    "feedback_correct": "太棒了！1.6 × 7 就是在算 7 支铅笔一共要付多少钱～",
    "feedback_wrong": "别着急，注意题目说的是‘买 7 支，每支 1.6 元’，想一想哪个选项在说‘总共’？",
    "hints": [
      {
        "text": "‘每支 1.6 元’是单价，‘7 支’是数量，单价 × 数量 = 总价。哪句说的是总价？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_meaning_002__mos6xw3r_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_meaning",
    "skill_name": "小数乘法意义",
    "ability_dimension": [
      "modeling"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小明用一根 0.12 米长的彩带剪成 6 段，每段长度相等。下面哪句话最准确地说明了 0.12 × 6 的意义？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "6 段彩带一共有多长"
      },
      {
        "id": "B",
        "text": "每段彩带的长度"
      },
      {
        "id": "C",
        "text": "把 0.12 米平均分成 6 份，求每份多少"
      },
      {
        "id": "D",
        "text": "0.12 米比 6 米短多少"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "0.12 × 6 表示 6 个 0.12 米合起来的总长度，即 6 段彩带的总长；而每段长度是 0.12 ÷ 6，不是乘法。"
    ],
    "common_errors": [
      {
        "tag": "confuse_multiply_divide",
        "error": "误把‘每段长度’当作乘法结果，混淆乘法与除法意义",
        "remediation": "乘法是‘合并几份’，除法才是‘平均分一份’。"
      },
      {
        "tag": "misread_context",
        "error": "看到‘剪成 6 段’就选 C，没注意题干问的是 0.12 × 6 的意义",
        "remediation": "先看算式结构：小数 × 整数 → 一定是‘整数个’该小数，不是分它。"
      }
    ],
    "feedback_correct": "真棒！0.12 × 6 就是在算 6 段 0.12 米彩带加起来有多长～",
    "feedback_wrong": "小心哦：题目问的是‘0.12 × 6’的意义，不是‘怎么剪’的问题。",
    "hints": [
      {
        "text": "回忆：‘每段 0.12 米，共 6 段’——总长怎么算？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_decimal_meaning_place_001__mos6xk9o_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_meaning_place",
    "skill_name": "小数意义、小数数位",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "在计数器上，小明用珠子表示一个小数：个位拨了2颗，十分位拨了0颗，百分位拨了9颗。这个小数是多少？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "2.09"
      },
      {
        "id": "B",
        "text": "2.9"
      },
      {
        "id": "C",
        "text": "2.009"
      },
      {
        "id": "D",
        "text": "20.9"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "个位是2 → 2，十分位是0 → 0.0，百分位是9 → 0.09，合起来是2 + 0.09 = 2.09"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误把百分位当十分位，写成2.9",
        "remediation": "百分位在小数点后第二位，要写成0.09，不是0.9"
      },
      {
        "tag": "place_value_missing",
        "error": "漏写十分位的0，写成2.9或2.009",
        "remediation": "计数器上十分位是0颗珠，必须写成0，即2.09中的‘0’不能省略"
      }
    ],
    "feedback_correct": "太棒啦！你准确理解了每个数位上的珠子代表的含义。",
    "feedback_wrong": "再想想哦～小数点后第一位是十分位，第二位才是百分位，别跳过‘0’呀！",
    "hints": [
      {
        "text": "个位、十分位、百分位分别对应小数点左边第1位、右边第1位、右边第2位。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_decimal_meaning_place_002__mos6xk9o_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_meaning_place",
    "skill_name": "小数意义、小数数位",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "老师说：‘一个三位小数，千分位上是7，其余各位都是0。’这个小数等于7个多少？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "0.001"
      },
      {
        "id": "B",
        "text": "0.01"
      },
      {
        "id": "C",
        "text": "0.1"
      },
      {
        "id": "D",
        "text": "1"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "三位小数指小数点后有三位，千分位是第三位，即0.001；7个0.001就是0.007，符合题意"
    ],
    "common_errors": [
      {
        "tag": "place_value_confusion",
        "error": "把千分位当成百分位，选0.01",
        "remediation": "千分位是小数点后第三位（如0.001），百分位是第二位（0.01）"
      },
      {
        "tag": "unit_misreading",
        "error": "误认为‘三位小数’指整数部分有三位，导致理解偏差",
        "remediation": "‘三位小数’只看小数点后面有几位数字，和整数部分无关"
      }
    ],
    "feedback_correct": "真厉害！你清楚地知道千分位对应的是0.001。",
    "feedback_wrong": "没关系～记住：小数点后第1位是十分位（0.1），第2位是百分位（0.01），第3位才是千分位（0.001）！",
    "hints": [
      {
        "text": "‘三位小数’就是小数点后有三个数字，比如0.123；千分位就是这三位中的最后一个位置。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_meaning_place_002__mos6xk9o_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_meaning_place",
    "skill_name": "小数意义、小数数位",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "一个三位小数，它的百位是0，十位是3，个位是0，十分位是8，百分位是0，千分位是5。这个数写作多少？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "30.805"
      },
      {
        "id": "B",
        "text": "3.805"
      },
      {
        "id": "C",
        "text": "030.805"
      },
      {
        "id": "D",
        "text": "30.85"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "百位、十位、个位组成整数部分：百位0、十位3、个位0 → 整数部分是30；小数部分：十分位8、百分位0、千分位5 → 小数是0.805；合起来是30.805。"
    ],
    "common_errors": [
      {
        "tag": "leading_zero_ignore",
        "error": "忽略百位和个位的0，直接写成3.805",
        "remediation": "注意题目明确说‘百位是0，十位是3，个位是0’，说明整数部分有三位数位，应为30（不是3）。"
      },
      {
        "tag": "place_value_misalign",
        "error": "把千分位5当成百分位，写成30.85",
        "remediation": "千分位是小数点后第三位，必须补0占位：0.805，不是0.85。"
      }
    ],
    "feedback_correct": "真厉害！你清楚区分了整数部分各数位和小数部分各数位的位置。",
    "feedback_wrong": "别灰心～再读一遍数位顺序：百位、十位、个位、十分位、百分位、千分位，每个位置都不能跳哦！",
    "hints": [
      {
        "text": "先写出整数部分（百位、十位、个位），再写小数部分（十分位、百分位、千分位），注意0要占位。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_001__mos6xons_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_meaning_place",
    "skill_name": "小数意义、小数数位",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "在计数器上，小明在百位拨了2颗珠，个位拨了0颗珠，十分位拨了8颗珠，百分位拨了3颗珠。这个小数是多少？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "200.83"
      },
      {
        "id": "B",
        "text": "20.83"
      },
      {
        "id": "C",
        "text": "2.83"
      },
      {
        "id": "D",
        "text": "200.083"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "百位是2→200，个位是0→0，十分位是8→0.8，百分位是3→0.03，合起来是200.83。"
    ],
    "common_errors": [
      {
        "tag": "place_value_misalignment",
        "error": "误将百位当作十位，写成20.83",
        "remediation": "记住：百位在个位左边第二位，2颗珠表示200，不是20。"
      },
      {
        "tag": "missing_zero_placeholder",
        "error": "忽略个位为0，直接写2.83",
        "remediation": "个位是0也要占位，不能跳过；200.83中个位是0，必须写出。"
      }
    ],
    "feedback_correct": "太棒啦！你准确读出了每个数位上的珠子代表的数值。",
    "feedback_wrong": "再想想哦～百位上的2颗珠可不是2，而是200呢！",
    "hints": [
      {
        "text": "百位表示几百，个位是0，十分位是0.1，百分位是0.01。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_002__mos6xons_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_meaning_place",
    "skill_name": "小数意义、小数数位",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "一个三位小数，它的千分位是6，十分位比千分位大2，百分位是0，整数部分是最大的一位数。这个小数是多少？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "9.806"
      },
      {
        "id": "B",
        "text": "9.608"
      },
      {
        "id": "C",
        "text": "9.860"
      },
      {
        "id": "D",
        "text": "9.086"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "整数部分是最大的一位数→9；千分位是6→0.006；十分位比千分位大2→6+2=8→0.8；百分位是0→0.00；所以是9.806。"
    ],
    "common_errors": [
      {
        "tag": "digit_position_swap",
        "error": "把十分位和千分位数字位置弄反，写成9.068或9.608",
        "remediation": "记口诀：‘十分、百分、千分’从左到右，小数点后第1、2、3位。"
      },
      {
        "tag": "misinterpret_difference",
        "error": "误以为‘十分位比千分位大2’是指数值差2（如0.1−0.006=0.094），而非数字大小差2",
        "remediation": "题中‘大2’指数字本身相差2，如8比6大2，不是小数位值相减。"
      }
    ],
    "feedback_correct": "真厉害！你把每一位的数字和关系都理得清清楚楚！",
    "feedback_wrong": "别灰心～注意‘十分位比千分位大2’说的是数字‘8比6大2’，不是小数大小哦！",
    "hints": [
      {
        "text": "先确定整数部分，再按‘十分位、百分位、千分位’顺序填数字，千分位是6，十分位就是6+2=8。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_001__mos6xons_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_meaning_place",
    "skill_name": "小数意义、小数数位",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "在计数器上，小明拨出一个小数：个位拨了2颗珠，百分位拨了9颗珠，其余数位都是0。这个小数是多少？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "2.09"
      },
      {
        "id": "B",
        "text": "2.9"
      },
      {
        "id": "C",
        "text": "0.29"
      },
      {
        "id": "D",
        "text": "2.009"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "个位是2，所以整数部分是2；百分位是9，即0.09；十分位没拨珠，为0；因此是2 + 0.09 = 2.09。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "把百分位当成十分位，误写成2.9",
        "remediation": "百分位在小数点后第二位，要写成0.09，不是0.9"
      },
      {
        "tag": "place_value_confusion",
        "error": "误将个位2和百分位9直接拼成0.29，忽略个位的计数单位",
        "remediation": "个位表示‘几个一’，必须写在小数点左边；百分位表示‘几个0.01’，写在小数点后第二位"
      }
    ],
    "feedback_correct": "太棒啦！你清楚每个数位代表的意义～",
    "feedback_wrong": "再想想：个位和百分位的位置关系，小数点不能丢哦！",
    "hints": [
      {
        "text": "个位在小数点左边第一位，百分位在小数点右边第二位。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_002__mos6xons_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_meaning_place",
    "skill_name": "小数意义、小数数位",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "下面哪句话准确描述了小数0.804中‘8’和‘4’所表示的意义？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "‘8’表示8个0.1，‘4’表示4个0.001"
      },
      {
        "id": "B",
        "text": "‘8’表示8个0.01，‘4’表示4个0.001"
      },
      {
        "id": "C",
        "text": "‘8’表示8个0.1，‘4’表示4个0.01"
      },
      {
        "id": "D",
        "text": "‘8’表示8个0.001，‘4’表示4个0.1"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "0.804的小数点后第一位是8，属于十分位，表示8个0.1；第三位是4，属于千分位，表示4个0.001。"
    ],
    "common_errors": [
      {
        "tag": "place_value_confusion",
        "error": "把‘8’误认为百分位（0.01），混淆十分位与百分位位置",
        "remediation": "从左往右：小数点后第1位是十分位，第2位是百分位，第3位是千分位"
      },
      {
        "tag": "decimal_point_error",
        "error": "把‘4’当成百分位（0.01）而非千分位（0.001）",
        "remediation": "0.804中，‘4’在第三位，对应千分位，即4×0.001"
      }
    ],
    "feedback_correct": "真厉害！你已经牢牢掌握了小数各数位的含义！",
    "feedback_wrong": "别灰心～记住：小数点后位置越靠前，单位越大哦！",
    "hints": [
      {
        "text": "写出来：0.804 = 0.8 + 0.004，再看每部分由什么组成。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_002__mos6y2wt_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_meaning_place",
    "skill_name": "小数意义、小数数位",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "用 4 颗珠子在计数器上表示一个小数，其中个位拨 0 颗、十分位拨 3 颗、千分位拨 1 颗，这个小数是多少？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "0.301"
      },
      {
        "id": "B",
        "text": "0.31"
      },
      {
        "id": "C",
        "text": "3.001"
      },
      {
        "id": "D",
        "text": "0.031"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "个位 0 颗 → 个位是 0；十分位 3 颗 → 十分位是 3；千分位 1 颗 → 千分位是 1；百分位没拨珠 → 百分位是 0；所以这个小数是 0.301。"
    ],
    "common_errors": [
      {
        "tag": "missing_zero_place",
        "error": "忽略百分位应补 0，写成 0.31（错把千分位当百分位）",
        "remediation": "计数器上没拨珠的位置要写 0 占位，0.31 表示十分位 3、百分位 1，没有千分位"
      },
      {
        "tag": "place_shift_error",
        "error": "误将千分位拨珠理解为百分位，选了 D",
        "remediation": "千分位是小数点后第三位，从左往右数：第1位=十分位，第2位=百分位，第3位=千分位"
      }
    ],
    "feedback_correct": "真厉害！会看计数器各数位上的珠子啦～",
    "feedback_wrong": "别灰心！注意：没拨珠的数位要用 0 占位哦～",
    "hints": [
      {
        "text": "十分位是第几位？千分位是第几位？中间没拨珠的位置写几？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_001__mos6y2wt_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_meaning_place",
    "skill_name": "小数意义、小数数位",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "0.809 中的“9”在百分位上吗？请选出正确解释。",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "不在，它在千分位上，表示 9 个 0.001"
      },
      {
        "id": "B",
        "text": "在，它在百分位上，表示 9 个 0.01"
      },
      {
        "id": "C",
        "text": "不在，它在十分位上，表示 9 个 0.1"
      },
      {
        "id": "D",
        "text": "在，它在个位上，表示 9 个 1"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "小数从左往右：小数点后第一位是十分位（0.1），第二位是百分位（0.01），第三位是千分位（0.001）；0.809 的‘9’在第三位，所以是千分位。"
    ],
    "common_errors": [
      {
        "tag": "place_value_confusion",
        "error": "把小数数位顺序记反，误认为小数点后第一位是百分位",
        "remediation": "记住口诀：‘点后一、二、三——十分、百分、千分’"
      },
      {
        "tag": "digit_position_misread",
        "error": "看错数字位置，把 0.809 中的 9 当作百分位上的数",
        "remediation": "用计数器或画数位表，标出每一位名称后再对齐数字"
      }
    ],
    "feedback_correct": "太棒啦！你清楚小数每一位的名称和含义～",
    "feedback_wrong": "没关系，再看看小数点后第几位对应什么位哦！",
    "hints": [
      {
        "text": "小数点后第一位是十分位，第二位是百分位，第三位是千分位。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_002__mos6y2wt_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_meaning_place",
    "skill_name": "小数意义、小数数位",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小明用 3 颗珠子在计数器上拨出一个两位小数，个位没有珠子，十分位有 2 颗，百分位有 1 颗。这个小数是多少？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "0.21"
      },
      {
        "id": "B",
        "text": "2.10"
      },
      {
        "id": "C",
        "text": "0.021"
      },
      {
        "id": "D",
        "text": "2.01"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "个位无珠→0；十分位2颗→2×0.1=0.2；百分位1颗→1×0.01=0.01；合起来是0.2+0.01=0.21。"
    ],
    "common_errors": [
      {
        "tag": "place_value_assignment_error",
        "error": "把十分位和百分位的数值单位弄混，如把百分位1颗当作0.1",
        "remediation": "牢记：十分位一颗珠=0.1，百分位一颗珠=0.01，千分位一颗珠=0.001"
      },
      {
        "tag": "leading_zero_omission",
        "error": "漏写个位的0，直接写成.21或21",
        "remediation": "两位小数必须写出个位和小数点，如0.21，不能省略前面的0"
      }
    ],
    "feedback_correct": "真厉害！你能把计数器上的珠子准确变成小数啦～",
    "feedback_wrong": "再想想：个位没珠子要写0，十分位和百分位分别代表多少呢？",
    "hints": [
      {
        "text": "个位是0，十分位2颗珠子表示0.2，百分位1颗表示0.01，加起来就是答案。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_TJ_001__mos6yiil_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_classification",
    "skill_name": "按角/边给三角形分类",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 30,
    "stem": "小明用三根吸管拼三角形，长度分别是 5 厘米、7 厘米和 10 厘米。这三条边能围成三角形吗？如果能，按角分属于哪一类？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "不能围成三角形"
      },
      {
        "id": "B",
        "text": "能，是锐角三角形"
      },
      {
        "id": "C",
        "text": "能，是直角三角形"
      },
      {
        "id": "D",
        "text": "能，是钝角三角形"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "D"
    },
    "solution_steps": [
      "先验证能否构成三角形：5+7=12＞10，5+10=15＞7，7+10=17＞5，满足三边关系；再判断最大角：因5²+7²=25+49=74＜10²=100，所以最大角＞90°，为钝角三角形。"
    ],
    "common_errors": [
      {
        "tag": "tri-sides:inequality_miss",
        "error": "只检查一组两边之和是否大于第三边，漏检其他两组。",
        "remediation": "必须同时验证：a+b>c、a+c>b、b+c>a，三者缺一不可。"
      },
      {
        "tag": "angle_classification:square_vs_obtuse",
        "error": "误以为5²+7²=10²（即74=100）成立，错判为直角三角形。",
        "remediation": "计算时要仔细：5²+7²=25+49=74，10²=100，74＜100，所以是钝角三角形。"
      }
    ],
    "feedback_correct": "答对啦！三边满足三角形条件，且最大角是钝角，真棒！",
    "feedback_wrong": "再想想哦～记得先验三边关系，再用平方比判断角哦！",
    "hints": [
      {
        "text": "三角形任意两边之和必须大于第三边；若a²+b²＜c²（c为最长边），则最大角是钝角。",
        "penalty": 2
      }
    ],
    "tags": [
      "ai_generated",
      "tri-sides:5,7,10"
    ],
    "exam_priority": "HIGH_BIG"
  },
  {
    "question_id": "AI_TJ_002__mos6yiil_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_classification",
    "skill_name": "按角/边给三角形分类",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 30,
    "stem": "一个三角形的三条边长分别是 9 厘米、12 厘米和 15 厘米。它能围成三角形吗？如果能，按边和按角分别属于什么类型？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "不能围成三角形"
      },
      {
        "id": "B",
        "text": "能，等腰三角形，也是直角三角形"
      },
      {
        "id": "C",
        "text": "能，不等边三角形，也是直角三角形"
      },
      {
        "id": "D",
        "text": "能，不等边三角形，也是锐角三角形"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "先验证：9+12=21＞15，9+15=24＞12，12+15=27＞9，能围成；三边互不相等→不等边三角形；又因9²+12²=81+144=225=15²，满足勾股定理→直角三角形。"
    ],
    "common_errors": [
      {
        "tag": "tri-sides:isosceles_misidentify",
        "error": "看到9、12、15中有倍数关系，误认为是等腰三角形。",
        "remediation": "等腰三角形需有两条边长度相等，而9≠12≠15，所以是不等边三角形。"
      },
      {
        "tag": "angle_classification:acute_vs_right",
        "error": "误算9²+12²=225，但没对比15²，直接猜是锐角三角形。",
        "remediation": "只要a²+b²=c²（c为最长边），就是直角三角形；这里225=15²，完全吻合！"
      }
    ],
    "feedback_correct": "太厉害了！你既看出它是不等边三角形，又发现它藏着直角的秘密～",
    "feedback_wrong": "别灰心！记住：边长全不同=不等边；9²+12²=15²=直角，这个组合很经典哦！",
    "hints": [
      {
        "text": "三边都不同→不等边三角形；若最短两边的平方和等于最长边的平方，则是直角三角形。",
        "penalty": 2
      }
    ],
    "tags": [
      "ai_generated",
      "tri-sides:9,12,15"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_TJ_001__mos6yiil_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_classification",
    "skill_name": "按角/边给三角形分类",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 30,
    "stem": "小明用三根木条拼一个三角形，长度分别是 5 厘米、12 厘米和 13 厘米。这个三角形按角分属于哪一类？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "锐角三角形"
      },
      {
        "id": "B",
        "text": "直角三角形"
      },
      {
        "id": "C",
        "text": "钝角三角形"
      },
      {
        "id": "D",
        "text": "无法判断"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "先验证能否构成三角形：5+12>13，5+13>12，12+13>5，满足；再看最大边13对应的角：5²+12²=25+144=169=13²，符合勾股定理，所以是直角三角形。"
    ],
    "common_errors": [
      {
        "tag": "tri-sides:pythagoras_misapply",
        "error": "误以为只要三边不等就是钝角三角形。",
        "remediation": "要算最大边的平方是否等于另两边平方和，相等才是直角。"
      },
      {
        "tag": "tri-sides:triangle_inequality_ignore",
        "error": "没检查三边能否围成三角形，直接分类。",
        "remediation": "任何分类前，先确认三边满足任意两边之和大于第三边。"
      }
    ],
    "hints": [
      {
        "text": "先用‘两边之和大于第三边’检查能不能围成三角形；再用‘最大边的平方’和‘另两边平方和’比较。",
        "penalty": 1
      }
    ],
    "feedback_correct": "答对啦！5-12-13是一组经典勾股数，围成的是直角三角形哦～",
    "feedback_wrong": "再想想：5²+12²等于多少？它和13²相等吗？相等就说明有一个直角！",
    "tags": [
      "ai_generated",
      "tri-sides:5,12,13"
    ],
    "exam_priority": "HIGH_BIG"
  },
  {
    "question_id": "AI_TJ_002__mos6yiil_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_classification",
    "skill_name": "按角/边给三角形分类",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 30,
    "stem": "一个三角形的三条边长分别是 7 厘米、10 厘米和 15 厘米。它按边分是什么三角形？按角分又是什么三角形？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "等腰三角形，锐角三角形"
      },
      {
        "id": "B",
        "text": "不等边三角形，钝角三角形"
      },
      {
        "id": "C",
        "text": "不等边三角形，直角三角形"
      },
      {
        "id": "D",
        "text": "等边三角形，锐角三角形"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "三边互不相等 → 是不等边三角形；最大边15对应角：7²+10²=49+100=149 < 225=15²，所以是钝角三角形。"
    ],
    "common_errors": [
      {
        "tag": "tri-sides:angle_type_confuse",
        "error": "看到7+10>15就以为是锐角三角形。",
        "remediation": "锐角需满足最大边平方＜另两边平方和；钝角是＞；直角是＝。"
      },
      {
        "tag": "tri-sides:side_classify_mistake",
        "error": "误把‘不等边’当成‘等腰’或‘等边’。",
        "remediation": "按边分：三边都不同叫不等边三角形（也叫 scalene），不是等腰也不是等边。"
      }
    ],
    "hints": [
      {
        "text": "先看三条边是否相等来判断‘按边分’；再用最大边的平方和另两边平方和比较，判断‘按角分’。",
        "penalty": 1
      }
    ],
    "feedback_correct": "太棒了！三边都不等，而且7²+10²＜15²，所以是不等边钝角三角形～",
    "feedback_wrong": "注意哦：7²+10²=149，而15²=225，149＜225，说明最大角大于90°，是钝角三角形！",
    "tags": [
      "ai_generated",
      "tri-sides:7,10,15"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_TJ_001__mos6z560_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_classification",
    "skill_name": "按角/边给三角形分类",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 30,
    "stem": "小明用三根木条拼三角形，长度分别是 5 厘米、7 厘米和 10 厘米。这三条边能围成三角形吗？如果能，按角分属于哪一类？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "不能围成三角形"
      },
      {
        "id": "B",
        "text": "能，是锐角三角形"
      },
      {
        "id": "C",
        "text": "能，是直角三角形"
      },
      {
        "id": "D",
        "text": "能，是钝角三角形"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "D"
    },
    "solution_steps": [
      "先验证能否构成三角形：5+7>10（12>10✓），5+10>7（15>7✓），7+10>5（17>5✓），能构成；再判断最大角：最长边10对应角最大，计算5²+7²=25+49=74 < 10²=100，所以是钝角三角形。"
    ],
    "common_errors": [
      {
        "tag": "tri-inequality_misapply",
        "error": "只检查一组边（如只看5+7>10）就判断能围成，忽略其他两边和。",
        "remediation": "三角形任意两边之和必须大于第三边，三组都要验！"
      },
      {
        "tag": "angle_classify_by_side_only",
        "error": "误以为最长边等于另两边平方和才是直角，却没算就选C；或看到7和5接近就猜锐角。",
        "remediation": "钝角三角形：最长边² > 另两边²和；锐角：最长边² < 另两边²和；直角：等于。"
      }
    ],
    "feedback_correct": "太棒啦！你既验证了三边关系，又用平方比较准确判断了角度类型！",
    "feedback_wrong": "别灰心～记住：三边要三组都验，最大角由最长边的平方和另两边平方和大小决定哦！",
    "hints": [
      {
        "text": "先检查三组边长是否都满足‘两边之和大于第三边’；再用勾股定理思想比大小：若a≤b<c，则看a²+b²与c²谁大。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-sides:5,7,10"
    ],
    "exam_priority": "HIGH_BIG"
  },
  {
    "question_id": "AI_TJ_002__mos6z560_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_classification",
    "skill_name": "按角/边给三角形分类",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 30,
    "stem": "一个三角形的三个内角中，有两个角的度数相等，且其中一个角是 40°。这个三角形按边分是什么三角形？按角分呢？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "等腰三角形，锐角三角形"
      },
      {
        "id": "B",
        "text": "等腰三角形，直角三角形"
      },
      {
        "id": "C",
        "text": "等腰三角形，钝角三角形"
      },
      {
        "id": "D",
        "text": "等边三角形，锐角三角形"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "已知两角相等且其中一个是40°，则另一相等角也是40°；第三个角=180°−40°−40°=100°；有两角相等→等腰三角形；最大角100°>90°→钝角三角形。"
    ],
    "common_errors": [
      {
        "tag": "angle_sum_forget",
        "error": "忘记三角形内角和是180°，直接认为两个40°就确定是等腰锐角。",
        "remediation": "所有三角形内角加起来一定是180°，缺哪个角就用180减另外两个！"
      },
      {
        "tag": "isosceles_assume_equilateral",
        "error": "看到两角相等就误以为三边都相等，选了等边三角形。",
        "remediation": "两角相等⇒两腰相等⇒等腰；三边都相等才叫等边——这里第三角是100°，三边不可能全等！"
      }
    ],
    "feedback_correct": "真厉害！你抓住了‘两角相等⇒等腰’和‘100°>90°⇒钝角’两个关键点！",
    "feedback_wrong": "加油！记住：等腰只要两角（或两边）相等；而钝角只需有一个角大于90°哦～",
    "hints": [
      {
        "text": "先用180°减去两个已知角，求出第三个角；再看有几个角相等（定边类），再看最大角是否大于90°（定角类）。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_decimal_product_digits_001__mos6ymvp_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_product_digits",
    "skill_name": "积的小数位数判断",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "0.8 × 0.06 的积一共有几位小数？（不考虑末尾的0）",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "1位"
      },
      {
        "id": "B",
        "text": "2位"
      },
      {
        "id": "C",
        "text": "3位"
      },
      {
        "id": "D",
        "text": "4位"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "0.8有1位小数，0.06有2位小数，积的小数位数等于两个因数小数位数之和：1+2=3位。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误将0.06看作1位小数，得出1+1=2位",
        "remediation": "数小数点后有几个数字：0.06是0、6共2位，不是1位。"
      },
      {
        "tag": "carry_missing",
        "error": "误以为末尾有0要减去，如算出0.048后认为末尾无0就只算2位",
        "remediation": "题目明确说‘不考虑末尾的0’，只需按因数小数位数相加，不看结果是否含0。"
      }
    ],
    "feedback_correct": "真棒！你准确数出了两个因数的小数位数并相加。",
    "feedback_wrong": "再想想：每个小数点后面有几个数字？把它们加起来就是积的小数位数哦。",
    "hints": [
      {
        "text": "先分别数0.8和0.06各有多少位小数，再相加。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_product_digits_002__mos6ymvp_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_product_digits",
    "skill_name": "积的小数位数判断",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "下面四组小数乘法中，哪一组的积的小数位数最多？（不考虑末尾的0）",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "3.2 × 0.5"
      },
      {
        "id": "B",
        "text": "0.07 × 0.9"
      },
      {
        "id": "C",
        "text": "1.04 × 0.003"
      },
      {
        "id": "D",
        "text": "0.6 × 0.08"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "A：3.2（1位）×0.5（1位）→积2位；B：0.07（2位）×0.9（1位）→积3位；C：1.04（2位）×0.003（3位）→积5位；D：0.6（1位）×0.08（2位）→积3位。最多的是C，共5位。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "把1.04误数为3位小数（多算小数点前的1），导致错误加成",
        "remediation": "只数小数点后面的数字：1.04是0和4，共2位；0.003是0、0、3，共3位。"
      },
      {
        "tag": "operation_confusion",
        "error": "误用积的大小代替小数位数，选了数值最大的选项",
        "remediation": "小数位数和积的大小无关，只看两个因数小数点后各有几位数字。"
      }
    ],
    "feedback_correct": "太厉害了！你仔细比较了每组因数的小数位数，找出了最多的那组。",
    "feedback_wrong": "别急，我们不用算出结果，只要分别数清每个因数的小数位数，再相加就能比啦！",
    "hints": [
      {
        "text": "逐个检查：A组两个因数分别有几位小数？B组呢？注意0.003有3位小数哦！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_product_digits_002__mos6z24y_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_product_digits",
    "skill_name": "积的小数位数判断",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "下面四组乘法中，哪一组的积的小数位数最多？（不考虑末尾的0）",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "3.2 × 0.5"
      },
      {
        "id": "B",
        "text": "0.07 × 0.9"
      },
      {
        "id": "C",
        "text": "1.04 × 0.003"
      },
      {
        "id": "D",
        "text": "0.6 × 0.08"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "A：3.2（1位）×0.5（1位）→积2位；B：0.07（2位）×0.9（1位）→积3位；C：1.04（2位）×0.003（3位）→积5位；D：0.6（1位）×0.08（2位）→积3位。所以C最多。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "把1.04误认为3位小数（数了小数点前的1），导致多算1位",
        "remediation": "只数小数点后的数字个数，1.04是2位小数。"
      },
      {
        "tag": "operation_reverse",
        "error": "误用加法代替乘法规则，如对C组算2+3=5但选了B组（误以为0.07×0.9有4位）",
        "remediation": "积的小数位数永远是两个因数小数位数之和，不看数值大小。"
      }
    ],
    "feedback_correct": "太厉害啦！你准确比较出了每组小数位数之和～",
    "feedback_wrong": "别灰心！记住：积的小数位数 = 第一个因数小数位数 + 第二个因数小数位数。",
    "hints": [
      {
        "text": "逐个数出每组两个因数各有几位小数，再相加，最后比大小。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_product_digits_001__mos6z24y_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_product_digits",
    "skill_name": "积的小数位数判断",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "不计算，直接判断 0.8 × 0.06 的积一共有几位小数？（不考虑末尾的0）",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "1位"
      },
      {
        "id": "B",
        "text": "2位"
      },
      {
        "id": "C",
        "text": "3位"
      },
      {
        "id": "D",
        "text": "4位"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "0.8有1位小数，0.06有2位小数，积的小数位数等于两个因数小数位数之和，1+2=3位。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误将0.8看作0位小数，得出2位",
        "remediation": "小数末尾的0不算，但小数点后的所有数字都算小数位数，0.8是1位小数。"
      },
      {
        "tag": "carry_missing",
        "error": "误以为积末尾有0可去掉，从而少算1位",
        "remediation": "题目明确要求‘不考虑末尾的0’，是指最后结果去掉末尾0后的小数位数，但判断时仍按原始小数位数之和确定。"
      }
    ],
    "feedback_correct": "真棒！你准确用上了‘因数小数位数相加’的方法！",
    "feedback_wrong": "再想想：每个因数各有多少位小数？加起来就是积的小数位数哦～",
    "hints": [
      {
        "text": "先数0.8有几位小数，再数0.06有几位小数，把它们加起来。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_product_digits_002__mos6z24y_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_product_digits",
    "skill_name": "积的小数位数判断",
    "ability_dimension": [
      "reasoning"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小明说：‘0.125 × 0.08 的积去掉末尾的0后，是三位小数。’他的说法对吗？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "对，积是0.01000，去掉末尾0后是0.01，是两位小数"
      },
      {
        "id": "B",
        "text": "错，积是0.01，是两位小数，不是三位小数"
      },
      {
        "id": "C",
        "text": "对，积是0.01000，去掉末尾0后是0.010，是三位小数"
      },
      {
        "id": "D",
        "text": "错，积是0.001，是三位小数，但去掉末尾0后仍是三位小数"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "0.125有3位小数，0.08有2位小数，积应有3+2=5位小数；实际计算得0.125×0.08=0.01000，去掉末尾0后为0.01，即两位小数。小明说‘是三位小数’错误。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误认为0.01000去掉末尾0后是0.010，仍保留三位小数",
        "remediation": "小数末尾的0可以去掉，0.010 = 0.01，小数位数以最简形式为准。"
      },
      {
        "tag": "miscount_digits",
        "error": "混淆‘积的原始小数位数’与‘化简后的小数位数’",
        "remediation": "题目问的是‘去掉末尾的0后’的小数位数，必须先化简再数位数。"
      }
    ],
    "feedback_correct": "太厉害了！你既会算小数位数，又会化简小数，思路超清晰！",
    "feedback_wrong": "别灰心～记住：先算出积的小数位数总和，再算出真实积、去掉末尾0，最后看化简后的结果有几位小数。",
    "hints": [
      {
        "text": "先算0.125和0.08各有几位小数，再算积应有几位小数；然后列竖式或心算验证真实积，最后去掉末尾0再数位数。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_product_digits_001__mos6z7xm_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_product_digits",
    "skill_name": "积的小数位数判断",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "不计算，直接判断 0.007 × 0.3 的积一共有几位小数？（不考虑末尾的0）",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "3位"
      },
      {
        "id": "B",
        "text": "4位"
      },
      {
        "id": "C",
        "text": "5位"
      },
      {
        "id": "D",
        "text": "6位"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "0.007有3位小数，0.3有1位小数，积的小数位数等于两个因数小数位数之和：3 + 1 = 4位。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误将0.007当作2位小数（忽略开头零），得出3+1=4但误选3位",
        "remediation": "数小数点后所有数字，包括中间和开头的0，0.007是3位小数。"
      },
      {
        "tag": "carry_missing",
        "error": "漏加小数位数，只看非零数字位数，如认为0.3是0位小数",
        "remediation": "记住：小数位数只看小数点后总位数，0.3是1位，0.03是2位，0.003是3位。"
      }
    ],
    "feedback_correct": "真棒！你准确数出了每个因数的小数位数并相加。",
    "feedback_wrong": "再想想：小数位数要从第一个数字开始数到末尾，包括所有的0哦。",
    "hints": [
      {
        "text": "先分别数出0.007和0.3各有多少位小数，再把它们加起来。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_product_digits_002__mos6z7xm_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_product_digits",
    "skill_name": "积的小数位数判断",
    "ability_dimension": [
      "reasoning"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小明在练习本上写了四道算式，并标出了他预测的积的小数位数（不考虑末尾的0）。哪一道预测是正确的？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "0.09 × 0.008 → 预测：5位"
      },
      {
        "id": "B",
        "text": "1.2 × 0.05 → 预测：2位"
      },
      {
        "id": "C",
        "text": "0.4 × 0.006 → 预测：3位"
      },
      {
        "id": "D",
        "text": "0.0003 × 0.7 → 预测：5位"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "D"
    },
    "solution_steps": [
      "A：0.09（2位）×0.008（3位）→积应为2+3=5位，正确；但需验证其他选项。B：1.2（1位）×0.05（2位）→1+2=3位，预测2位错误。C：0.4（1位）×0.006（3位）→1+3=4位，预测3位错误。D：0.0003（4位）×0.7（1位）→4+1=5位，预测5位正确。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误判整数部分影响小数位数，如认为1.2×0.05中1.2是整数，只算0.05的2位",
        "remediation": "小数位数只看小数点后的数字个数，1.2是1位小数，与整数部分无关。"
      },
      {
        "tag": "zero_counting_error",
        "error": "漏数小数末尾或开头的0，如把0.0003当成1位或3位小数",
        "remediation": "0.0003小数点后共4个数字（0、0、0、3），所以是4位小数。"
      }
    ],
    "feedback_correct": "太厉害了！你仔细检查了每道算式的小数位数，找出了唯一正确的预测。",
    "feedback_wrong": "别灰心！注意每个因数都要单独数清小数点后的所有数字位。",
    "hints": [
      {
        "text": "逐个检查每个选项：先数两个因数各自的小数位数，再相加，最后对比预测值。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_001__mos6znha_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_vertical",
    "skill_name": "小数加减竖式，小数点对齐",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "小明用竖式计算 6.4 + 12.75，他把小数点对齐后正确书写，下列哪一项是正确的和？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "19.15"
      },
      {
        "id": "B",
        "text": "18.15"
      },
      {
        "id": "C",
        "text": "19.115"
      },
      {
        "id": "D",
        "text": "76.75"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先补零使位数对齐：6.40 + 12.75；百分位0+5=5，十分位4+7=11（写1进1），个位6+2+1=9，十位0+1=1，结果是19.15。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "未补零导致小数点错位，如把6.4当成64计算",
        "remediation": "所有小数竖式都要先补零，让小数点严格对齐，再从右往左算。"
      },
      {
        "tag": "carry_missing",
        "error": "十分位相加满十未进1，得出18.15",
        "remediation": "记住：哪一位相加满十，就要向前一位进1，进的1要写在横线上方。"
      }
    ],
    "feedback_correct": "太棒啦！你牢牢记得小数点对齐、补零、进位三步哦～",
    "feedback_wrong": "没关系！检查一下有没有补零对齐，再算一遍就更准啦～",
    "hints": [
      {
        "text": "把6.4写成6.40，再和12.75竖式对齐，从百分位开始加起。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_002__mos6znha_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_vertical",
    "skill_name": "小数加减竖式，小数点对齐",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小红用竖式计算 20 − 3.68，她在草稿纸上写了四个不同写法，下列哪一项是小数点对齐且计算过程正确的竖式结果？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "16.32"
      },
      {
        "id": "B",
        "text": "17.68"
      },
      {
        "id": "C",
        "text": "16.42"
      },
      {
        "id": "D",
        "text": "17.32"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "把20写成20.00，与3.68小数点对齐；百分位0−8不够减，向十分位借1（变成10），但十分位是0，需继续向个位借1→个位变9，十分位得10，再借1给百分位→十分位剩9，百分位得10；10−8=2；十分位9−6=3；个位9−3=6；十位1−0=1；结果为16.32。"
    ],
    "common_errors": [
      {
        "tag": "borrowing_error",
        "error": "借位混乱，如个位2直接减3得-1，或漏借导致十分位0−6直接写6",
        "remediation": "整数减小数时，先把整数改写成同位数小数（如20→20.00），再从右往左逐位借位，每借1当10用。"
      },
      {
        "tag": "decimal_point_error",
        "error": "把3.68对齐到20个位右侧，误作20 − 3.68 = 20 − 368，结果过大",
        "remediation": "小数点必须上下对齐！20的个位‘0’要和3.68的个位‘3’对齐，不是和小数点对齐。"
      }
    ],
    "feedback_correct": "真厉害！你会把20变成20.00再认真借位，小数点对齐一步不落～",
    "feedback_wrong": "别灰心！试试把20写成20.00，再画一画借位箭头，马上就能理清啦～",
    "hints": [
      {
        "text": "把20看作20.00，和3.68的小数点上下对齐，再从百分位开始减，注意连续借位。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_001__mos6znha_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_vertical",
    "skill_name": "小数加减竖式，小数点对齐",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "小明用竖式计算 9.4 + 12.06，他把小数点对齐后正确书写了两个加数。下列哪一项是正确的和？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "21.46"
      },
      {
        "id": "B",
        "text": "21.10"
      },
      {
        "id": "C",
        "text": "106.46"
      },
      {
        "id": "D",
        "text": "21.06"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先对齐小数点：9.40 + 12.06；百分位0+6=6，十分位4+0=4，个位9+2=11（进1），十位0+1+1=2；结果是21.46。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "未补零直接对齐，把9.4当成9.4，误算为9.4 + 12.06 = 21.10（错把十分位当百分位）",
        "remediation": "小数加减前，要在末尾补0使位数相同，9.4要写成9.40再对齐。"
      },
      {
        "tag": "carry_missing",
        "error": "个位相加9+2=11，忘记向十位进1，得出11.46",
        "remediation": "竖式中满十要向前一位进1，个位11写1，十位加1。"
      }
    ],
    "feedback_correct": "太棒啦！你准确对齐了小数点，还补零完成了计算！",
    "feedback_wrong": "再检查一下小数点有没有对齐，9.4后面可以补一个0变成9.40哦～",
    "hints": [
      {
        "text": "记得把9.4写成9.40，再和12.06上下对齐小数点！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_002__mos6znha_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_vertical",
    "skill_name": "小数加减竖式，小数点对齐",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小红用竖式计算 20 − 3.75，她在草稿纸上写了四个不同写法。下列哪一项是小数点对齐且计算过程正确的竖式？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "  20.00\n−  3.75\n──────\n  16.25"
      },
      {
        "id": "B",
        "text": "  20.0\n−  3.75\n─────\n  16.25"
      },
      {
        "id": "C",
        "text": "  20\n− 3.75\n────\n 16.25"
      },
      {
        "id": "D",
        "text": "  20.00\n−  3.75\n──────\n  17.75"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "被减数20要写成20.00，与3.75小数点对齐；从百分位开始借位：0−5不够，向十分位借，十分位是0再向个位借，个位0向十位借，十位2变1，个位得10，再分给十分位，最终算出16.25。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "未将20补零对齐，如选项B、C，导致数位错乱，无法正确借位",
        "remediation": "整数减小数时，必须把整数改写成相同小数位数（如20→20.00），再对齐小数点。"
      },
      {
        "tag": "borrow_mistake",
        "error": "借位错误，如选项D，误算为20.00−3.75=17.75（未完成连续借位）",
        "remediation": "遇到连续0时，要从左起第一个非0数位开始借，并逐级传递，20.00的十位2借1给个位，个位10再借1给十分位……"
      }
    ],
    "feedback_correct": "真厉害！你不仅对齐了小数点，还稳稳处理了连续借位～",
    "feedback_wrong": "注意：20要变成20.00才能和3.75对齐哦，不然竖式就‘站不稳’啦！",
    "hints": [
      {
        "text": "20是整数，减小数前一定要补两个0变成20.00，让小数点对齐！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_001__mos6zo5v_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_vertical",
    "skill_name": "小数加减竖式，小数点对齐",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "用竖式计算 6.42 + 15.8。下列哪一项是正确写法？（注意小数点是否对齐）",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "  6.42\n+15.8 \n─────"
      },
      {
        "id": "B",
        "text": "  6.42\n+15.80\n─────"
      },
      {
        "id": "C",
        "text": "  6.42\n+158  \n─────"
      },
      {
        "id": "D",
        "text": " 642\n+1580\n─────"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "小数加法竖式必须小数点对齐，15.8 补零为 15.80 后与 6.42 对齐，个位、十分位、百分位一一对应。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "未补零导致小数点未对齐，如把 15.8 当作整数写在个位右对齐",
        "remediation": "所有小数都补零到相同位数再对齐小数点，15.8 → 15.80"
      },
      {
        "tag": "place_value_misalignment",
        "error": "直接去掉小数点当整数算，忽略小数意义",
        "remediation": "竖式中每一列代表相同计数单位，小数点是分界线，必须严格对齐"
      }
    ],
    "feedback_correct": "太棒啦！小数点对齐是竖式计算的关键哦～",
    "feedback_wrong": "再试一次吧！记住：先补零，再对齐小数点，让相同数位上下对齐。",
    "hints": [
      {
        "text": "想一想：15.8 的百分位上是什么数字？可以补一个0让它变成两位小数吗？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_002__mos6zo5v_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_vertical",
    "skill_name": "小数加减竖式，小数点对齐",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小刚在草稿纸上计算 20 − 3.75 时写了四个竖式，其中只有一项完全符合小数减法竖式规范（包括补零、小数点对齐、借位标注）。它是哪一个？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": " 20\n− 3.75\n─────"
      },
      {
        "id": "B",
        "text": " 20.00\n−  3.75\n──────"
      },
      {
        "id": "C",
        "text": " 20.0\n−  3.75\n──────"
      },
      {
        "id": "D",
        "text": " 2000\n− 375\n─────"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "整数减小数需补零成同位小数：20 写作 20.00；小数点严格对齐后，个位对个位（0↔0），十分位（0↔7），百分位（0↔5），才能正确借位计算。"
    ],
    "common_errors": [
      {
        "tag": "zero_padding_missing",
        "error": "20 没有补零就直接与 3.75 对齐，导致数位错乱",
        "remediation": "任何整数参与小数运算都要补足小数位，20 → 20.00（两位小数）"
      },
      {
        "tag": "decimal_point_error",
        "error": "小数点未对齐，如把 3.75 的 3 对齐 20 的 2，造成十位与个位混淆",
        "remediation": "竖式第一件事：在所有数下方画一条水平线，所有小数点垂直对齐，再写数字"
      }
    ],
    "feedback_correct": "你真细心！补零和对齐一个都不能少～",
    "feedback_wrong": "别灰心！遇到整数减小数，先把它变成‘带小数点的数’，比如 20 变成 20.00。",
    "hints": [
      {
        "text": "提示：20 是整数，但要和 3.75 做减法，它需要变成几位小数才方便对齐？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_001__mos6zo5v_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_vertical",
    "skill_name": "小数加减竖式，小数点对齐",
    "ability_dimension": [
      "calculation",
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "小明用竖式计算 9.4 + 0.63，他把小数点对齐后，正确写法是哪一项？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "  9.4\n+0.63\n─────"
      },
      {
        "id": "B",
        "text": "  9.40\n+0.63\n─────"
      },
      {
        "id": "C",
        "text": "  9.4\n+ 0.63\n─────"
      },
      {
        "id": "D",
        "text": "  9.4\n+0.63\n─────（小数点未对齐）"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "小数加法必须小数点对齐；9.4 可补零为 9.40，与 0.63 的百分位对齐，才能正确相加。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "直接右对齐数字，忽略小数点位置，如把 0.63 写在 9.4 末尾下方",
        "remediation": "记住：不是末尾对齐，而是小数点对齐！可在缺位处补 0 帮助对齐。"
      },
      {
        "tag": "carry_missing",
        "error": "对齐后计算时忘记进位，导致结果偏小",
        "remediation": "算完后检查：十分位 4+6=10，要向个位进 1；个位 9+0+1=10，再向十位进 1。"
      }
    ],
    "feedback_correct": "真棒！补零对齐小数点是竖式计算的关键一步！",
    "feedback_wrong": "别灰心～小数点对齐就像排队站直，补 0 是让队伍一样长哦！",
    "hints": [
      {
        "text": "想一想：9.4 等于多少个 0.01？把它写成百分位形式再对齐试试！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_002__mos6zo5v_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_vertical",
    "skill_name": "小数加减竖式，小数点对齐",
    "ability_dimension": [
      "calculation",
      "habit"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小华在草稿纸上做了三道小数减法竖式，只有一道完全正确（包括小数点对齐、补零、借位）。哪一道是正确的？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": " 12.05\n−  3.8\n──────\n   8.25"
      },
      {
        "id": "B",
        "text": " 12.05\n−  3.80\n──────\n   8.25"
      },
      {
        "id": "C",
        "text": " 12.05\n−  3.80\n──────\n   9.75"
      },
      {
        "id": "D",
        "text": " 12.05\n−  3.8\n──────\n   8.75"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "先补零使小数位数相同：3.8 → 3.80；再小数点对齐；计算：12.05 − 3.80 = 8.25。选项 A 和 D 未补零导致错位；C 计算错误（12.05−3.80≠9.75）；B 全部规范正确。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "未补零就直接右对齐，导致 3.8 错位到百分位，造成十分位减错",
        "remediation": "减法前一定先补零，让两个数的小数位数一样多，再对齐小数点。"
      },
      {
        "tag": "borrowing_error",
        "error": "个位 2−3 不够减时忘记向十位借 1，误算为 12−3=9",
        "remediation": "借位要标清楚：12.05 的个位是 2，但十分位是 0，需连续借位——从十位借 1 到个位，再从个位借 1 到十分位。"
      }
    ],
    "feedback_correct": "太厉害了！你发现了所有细节：补零、对齐、借位，一个都不能少！",
    "feedback_wrong": "没关系～竖式就像搭积木，每一块（小数点、零、借位标记）都要稳稳放好！",
    "hints": [
      {
        "text": "注意看每个选项的被减数和减数小数位数是否一致，再检查差的个位和十分位是否合理。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_TJ_001__mos6zttw_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_angle_sum",
    "skill_name": "三角形内角和",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 30,
    "stem": "一个三角形的两个内角分别是 52° 和 38°，第三个内角是多少度？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "80°"
      },
      {
        "id": "B",
        "text": "90°"
      },
      {
        "id": "C",
        "text": "100°"
      },
      {
        "id": "D",
        "text": "110°"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "三角形内角和是180°；52° + 38° = 90°；180° − 90° = 90°。"
    ],
    "common_errors": [
      {
        "tag": "addition_error",
        "error": "把52°和38°相加错算成80°或100°，导致结果偏差。",
        "remediation": "用竖式重新计算52+38，注意个位满十向十位进1。"
      },
      {
        "tag": "angle_sum_misremember",
        "error": "误记三角形内角和为100°或360°，导致减法错误。",
        "remediation": "牢记：所有三角形三个内角加起来一定是180°，可以画一个三角形剪角拼一拼验证。"
      }
    ],
    "feedback_correct": "答对啦！三个角加起来刚好是180°，真棒～",
    "feedback_wrong": "再想想哦，三角形三个角加起来永远是180°，别忘了用它来检查！",
    "hints": [
      {
        "text": "先算出已知两角的和，再用180°减去这个和。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-angle-sum:52,38,?"
    ],
    "exam_priority": "HIGH_BIG"
  },
  {
    "question_id": "AI_TJ_002__mos6zttw_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_angle_sum",
    "skill_name": "三角形内角和",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 30,
    "stem": "一个三角形中，最大角比最小角大50°，中间角是60°，那么最小角是多少度？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "30°"
      },
      {
        "id": "B",
        "text": "35°"
      },
      {
        "id": "C",
        "text": "40°"
      },
      {
        "id": "D",
        "text": "45°"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "设最小角为x°，则最大角为(x+50)°；三个角和为180°，所以x + (x+50) + 60 = 180；整理得2x + 110 = 180；2x = 70；x = 35。"
    ],
    "common_errors": [
      {
        "tag": "equation_setup_error",
        "error": "列式时漏掉中间角60°，写成x + (x+50) = 180，解得x=65。",
        "remediation": "题目明确说‘中间角是60°’，一定要把它加进总和里！"
      },
      {
        "tag": "arithmetic_error",
        "error": "解2x = 70时算成x = 70 ÷ 2 = 30（口算失误）。",
        "remediation": "用草稿纸列竖式：70 ÷ 2 = 35，多验算一次更安心～"
      }
    ],
    "feedback_correct": "太厉害了！你用方程抓住了三个角的关系，真会动脑筋！",
    "feedback_wrong": "没关系，把三个角都用x表示出来，再加起来等于180°，试试看～",
    "hints": [
      {
        "text": "用x表示最小角，那最大角就是x+50，中间角已知是60，三者相加等于180。",
        "penalty": 2
      }
    ],
    "tags": [
      "ai_generated",
      "tri-angle-sum:?,60,?+50"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_TJ_001__mos6zttw_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_angle_sum",
    "skill_name": "三角形内角和",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 30,
    "stem": "一个三角形的两个内角分别是 52° 和 38°，第三个内角是多少度？它是什么类型的三角形？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "90°，直角三角形"
      },
      {
        "id": "B",
        "text": "80°，锐角三角形"
      },
      {
        "id": "C",
        "text": "100°，钝角三角形"
      },
      {
        "id": "D",
        "text": "90°，等腰三角形"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "三角形内角和是180°。已知两角和为52°+38°=90°，所以第三个角是180°−90°=90°。有一个角是90°，所以是直角三角形。"
    ],
    "common_errors": [
      {
        "tag": "angle_sum_miscalc",
        "error": "误用180°减去一个角（如180°−52°=128°），漏减另一个角。",
        "remediation": "记住：三个角加起来必须等于180°，先算出已知两角的和，再用180°减这个和。"
      },
      {
        "tag": "classification_error",
        "error": "知道第三个角是90°，却选‘等腰三角形’，混淆了按角分类和按边分类。",
        "remediation": "按角分：有直角→直角三角形；按边分：要看三边是否相等或两腰相等——题干没给边长信息，不能判断等腰。"
      }
    ],
    "feedback_correct": "答对啦！180°减去两个已知角的和，正好得到90°，这就是直角三角形哦～",
    "feedback_wrong": "再想想：三角形三个角加起来一定是180°，别忘了先加已知两个角哦！",
    "hints": [
      {
        "text": "先把52°和38°加起来，再用180°减这个和。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-angle:52,38,90"
    ],
    "exam_priority": "HIGH_BIG"
  },
  {
    "question_id": "AI_TJ_002__mos6zttw_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_angle_sum",
    "skill_name": "三角形内角和",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 30,
    "stem": "小红画了一个三角形，量得其中两个角都是40°，她想知道第三个角的度数，以及这个三角形按角分类属于哪一种。",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "100°，钝角三角形"
      },
      {
        "id": "B",
        "text": "90°，直角三角形"
      },
      {
        "id": "C",
        "text": "80°，锐角三角形"
      },
      {
        "id": "D",
        "text": "100°，等腰三角形"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "三角形内角和是180°。已知两个角都是40°，和为40°+40°=80°，所以第三个角是180°−80°=100°。因为100°＞90°，所以是钝角三角形。"
    ],
    "common_errors": [
      {
        "tag": "misclassify_by_side",
        "error": "看到两个角相等就选‘等腰三角形’，但题目问的是按角分类。",
        "remediation": "‘等腰’是按边分类，题干只给了角度信息，无法确定边长关系；而100°＞90°，直接说明它是钝角三角形。"
      },
      {
        "tag": "arithmetic_carry",
        "error": "计算180−40−40时错算成100−40=60°，或漏减一个40°得140°。",
        "remediation": "可以分步算：40+40=80，再用180−80=100；或者用180−40=140，再140−40=100。"
      }
    ],
    "feedback_correct": "太棒了！两个40°加起来是80°，180°减80°得100°，大于90°就是钝角三角形～",
    "feedback_wrong": "别着急，把两个40°先加起来，再从180°里减掉，就能找到第三个角啦！",
    "hints": [
      {
        "text": "两个40°加起来是多少？用180°减去这个和，就得到第三个角。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-angle:40,40,100"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_decimal_mul_simplify_001__mos70av5_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_simplify",
    "skill_name": "小数乘法简便运算",
    "ability_dimension": [
      "calculation",
      "strategy"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "简算：2.8 × 4.5 + 7.2 × 4.5，下面哪种方法最简便？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "先算 2.8 × 4.5 = 12.6，再算 7.2 × 4.5 = 32.4，最后相加得 45.0"
      },
      {
        "id": "B",
        "text": "提取公因数 4.5，变成 (2.8 + 7.2) × 4.5 = 10 × 4.5 = 45"
      },
      {
        "id": "C",
        "text": "把 4.5 拆成 4 + 0.5，分别乘后再相加"
      },
      {
        "id": "D",
        "text": "用竖式计算两个乘法，再相加"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "观察两个乘法都有相同因数 4.5，可逆用乘法分配律：a×c + b×c = (a+b)×c。2.8 + 7.2 = 10，10 × 4.5 = 45。"
    ],
    "common_errors": [
      {
        "tag": "distribution_miss",
        "error": "没发现公因数，逐个计算再相加，费时且易错小数进位",
        "remediation": "做题前先看所有乘法有没有相同因数，有就优先用分配律合并"
      },
      {
        "tag": "decimal_point_error",
        "error": "算 10 × 4.5 时写成 4.5 或 450，漏掉小数点",
        "remediation": "记住：10 × 4.5 就是把 4.5 的小数点向右移一位，得 45.0"
      }
    ],
    "feedback_correct": "太棒啦！你发现了公因数，用分配律让计算又快又准！",
    "feedback_wrong": "再想想哦～两个乘法都含 4.5，就像‘买了两次同一种东西’，可以合起来算！",
    "hints": [
      {
        "text": "找一找：两个乘法里有没有相同的数？它能当‘公共朋友’帮我们简化！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_simplify_002__mos70av5_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_simplify",
    "skill_name": "小数乘法简便运算",
    "ability_dimension": [
      "calculation",
      "strategy"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小明用简便方法计算 1.25 × 3.2 × 8，他第一步把 3.2 拆成 4 × 0.8，接着怎么算最简便？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "先算 1.25 × 4 = 5，再算 5 × 0.8 = 4，最后 4 × 8 = 32"
      },
      {
        "id": "B",
        "text": "先算 1.25 × 8 = 10，再算 10 × 4 = 40，最后 40 × 0.8 = 32"
      },
      {
        "id": "C",
        "text": "先算 0.8 × 8 = 6.4，再算 1.25 × 6.4 = 8"
      },
      {
        "id": "D",
        "text": "按顺序从左到右：1.25 × 3.2 = 4，再 4 × 8 = 32"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "利用乘法交换律和结合律，先算 1.25 × 8 = 10（因为 1.25 和 8 是好朋友），再算 10 × 4 × 0.8 = 10 × (4 × 0.8) = 10 × 3.2 = 32；或更优：10 × 4 = 40，40 × 0.8 = 32。"
    ],
    "common_errors": [
      {
        "tag": "order_of_operations_error",
        "error": "没调整顺序，硬算 1.25 × 3.2，小数乘法出错率高",
        "remediation": "遇到 1.25、2.5、0.25 等，优先找 4、8、40 等配对，它们相乘得整数！"
      },
      {
        "tag": "decomposition_misuse",
        "error": "拆了 3.2 却没利用好新因数，比如先算 1.25 × 0.8=1，但忘了还有 4 和 8",
        "remediation": "拆是为了重组！拆完要立刻找能凑整的组合，比如 1.25 × 8 和 4 × 0.8 都是关键配对"
      }
    ],
    "feedback_correct": "聪明！你用‘找朋友’策略，让小数变整数，一步比一步更简单！",
    "feedback_wrong": "没关系～试试把 1.25 和 8 先拉手，它们一牵手就变成 10，后面就轻松多啦！",
    "hints": [
      {
        "text": "回忆：1.25 × 8 = 10，这是小数乘法里的‘黄金搭档’，看到就要马上圈出来！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_simplify_002__mos70av5_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_simplify",
    "skill_name": "小数乘法简便运算",
    "ability_dimension": [
      "calculation",
      "strategy"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小明用简便方法计算 1.25 × 3.2，他把 3.2 拆成 8 × 0.4，再算 1.25 × 8 × 0.4。他的做法对吗？为什么？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "对，因为 1.25 × 8 = 10，再 × 0.4 得 4，结果正确又简便"
      },
      {
        "id": "B",
        "text": "对，但拆法不简便，应该拆成 3 + 0.2 更好"
      },
      {
        "id": "C",
        "text": "不对，3.2 不能拆成 8 × 0.4，因为 8 × 0.4 = 3.2 是错的"
      },
      {
        "id": "D",
        "text": "不对，1.25 × 3.2 应该用竖式，不能拆"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "验证拆分：8 × 0.4 = 3.2，正确；再算 1.25 × 8 = 10（利用 1.25 × 8 = 10 的特殊关系），10 × 0.4 = 4；原式 1.25 × 3.2 = 4，结果一致，且两步都是整数运算，确实简便。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误以为 8 × 0.4 = 32 或 0.32，没掌握小数乘法口算",
        "remediation": "0.4 就是 4 个 0.1，8 × 0.4 = 8 × 4 × 0.1 = 32 × 0.1 = 3.2。"
      },
      {
        "tag": "simplify_misunderstand",
        "error": "认为只有加减才能拆，乘法不能拆因数来简化",
        "remediation": "乘法结合律允许我们重新组合因数，比如 a×b×c = a×(b×c)，只要拆得巧就更简单！"
      }
    ],
    "feedback_correct": "真厉害！你不仅会算，还懂为什么这样拆最聪明～",
    "feedback_wrong": "别急，先检查一下 8 × 0.4 等于多少？再想想 1.25 × 8 是不是特别好算？",
    "hints": [
      {
        "text": "回忆：1.25 和 8 是好朋友——1.25 × 8 = 10，这是小数乘法里常用的简便组合！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_simplify_001__mos711pp_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_simplify",
    "skill_name": "小数乘法简便运算",
    "ability_dimension": [
      "calculation",
      "strategy"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "简算：2.5 × 1.2 × 4，下面哪种方法最简便？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "先算 2.5 × 4 = 10，再算 10 × 1.2 = 12"
      },
      {
        "id": "B",
        "text": "先算 1.2 × 4 = 4.8，再算 2.5 × 4.8 = 12"
      },
      {
        "id": "C",
        "text": "列竖式计算 2.5 × 1.2 = 3.0，再 3.0 × 4 = 12"
      },
      {
        "id": "D",
        "text": "把 2.5 拆成 2 + 0.5，分别乘 1.2 × 4 再相加"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "利用乘法交换律和结合律，先算 2.5 × 4 = 10（整十数），再乘 1.2 更简便。"
    ],
    "common_errors": [
      {
        "tag": "commutative_error",
        "error": "未识别可交换顺序，死守从左到右计算",
        "remediation": "记住：多个数连乘时，可以调换顺序，优先凑整十、整百数。"
      },
      {
        "tag": "calculation_error",
        "error": "算 2.5 × 4 时误得 8 或 100",
        "remediation": "2.5 是 25 个 0.1，25 × 4 = 100，所以 2.5 × 4 = 10.0。"
      }
    ],
    "feedback_correct": "真棒！你发现了先算 2.5 × 4 能快速得到整十数，让计算更轻松～",
    "feedback_wrong": "再想想哦～2.5 和 4 相乘特别容易变成整十数，试试调换顺序吧！",
    "hints": [
      {
        "text": "想一想：哪个两个数相乘能得到整十数？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_simplify_002__mos711pp_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_simplify",
    "skill_name": "小数乘法简便运算",
    "ability_dimension": [
      "calculation",
      "strategy"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "王老师买跳绳和沙包共花了 7.8 元/套，买了 99 套。她用简便方法计算总价：7.8 × 99 = 7.8 × (100 − 1) = 780 − 7.8 = 772.2（元）。下面哪项是这种算法的依据？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "乘法分配律：a × (b − c) = a × b − a × c"
      },
      {
        "id": "B",
        "text": "乘法结合律：(a × b) × c = a × (b × c)"
      },
      {
        "id": "C",
        "text": "乘法交换律：a × b = b × a"
      },
      {
        "id": "D",
        "text": "小数点移动规律：乘 100 小数点右移两位"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "将 99 拆为 100 − 1，再用 7.8 分别乘 100 和 1，最后相减，这正是乘法分配律的应用。"
    ],
    "common_errors": [
      {
        "tag": "law_confusion",
        "error": "误以为是结合律或交换律，混淆运算律名称与作用",
        "remediation": "分配律一定含括号里的加或减；结合律只改括号位置，不拆数；交换律只调换乘数顺序。"
      },
      {
        "tag": "concept_error",
        "error": "认为‘拆数’本身是独立规则，未关联到运算律",
        "remediation": "所有简便运算都要有运算律作依据，拆数是为了匹配分配律、结合律等。"
      }
    ],
    "feedback_correct": "太厉害啦！你一眼看穿了背后的乘法分配律，这是小数简便运算的‘秘密武器’！",
    "feedback_wrong": "没关系～记住：看到‘×99’‘×101’这类数，常常要想到‘100−1’或‘100+1’，这就需要分配律帮忙哦！",
    "hints": [
      {
        "text": "观察算式中括号里是减法，且外面的数分别乘了括号里的两个数，这是哪个运算律的特点？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_001__mos70gnl_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_simplify",
    "skill_name": "小数加减简便计算",
    "ability_dimension": [
      "calculation",
      "strategy"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "简算：9.7 + 4.25 - 0.7，怎样算最简便？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "先算 9.7 - 0.7 = 9，再加 4.25 得 13.25"
      },
      {
        "id": "B",
        "text": "从左到右依次算：9.7 + 4.25 = 13.95，再减 0.7 得 13.25"
      },
      {
        "id": "C",
        "text": "先算 4.25 - 0.7 = 3.55，再加 9.7 得 13.25"
      },
      {
        "id": "D",
        "text": "把 9.7 和 4.25 合并成 13.95，再减 0.7，但不能交换顺序"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "观察发现 9.7 和 0.7 小数部分相同，相减得整数 9，再加 4.25 更简便。"
    ],
    "common_errors": [
      {
        "tag": "order_of_operations_error",
        "error": "死记硬背‘从左到右’，没发现可凑整的数对",
        "remediation": "先找能凑成整数或一位小数的两个数，再调整运算顺序。"
      },
      {
        "tag": "decimal_point_error",
        "error": "误将 9.7 - 0.7 算成 90 或 0.9",
        "remediation": "对齐小数点再计算：9.7 - 0.7 = 9.0，就是 9。"
      }
    ],
    "feedback_correct": "真棒！你发现了可以先减掉 0.7 让 9.7 变成整数，这是简便计算的小秘诀～",
    "feedback_wrong": "别灰心！记住：看到小数部分相同的数，优先组合计算更轻松哦。",
    "hints": [
      {
        "text": "想一想：哪两个数相减能得到整数？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_002__mos70gnl_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_simplify",
    "skill_name": "小数加减简便计算",
    "ability_dimension": [
      "calculation",
      "strategy"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "学校买跳绳花了18.6元，买毽子花了3.45元，付给收银员50元。找回多少钱？用简便方法计算，下面哪步是关键？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "先算 18.6 + 3.45 = 22.05，再用 50 - 22.05 = 27.95"
      },
      {
        "id": "B",
        "text": "把 18.6 拆成 18 + 0.6，再分别加减，但不简化总和"
      },
      {
        "id": "C",
        "text": "先用 50 - 18.6 = 31.4，再减 3.45，但 31.4 - 3.45 不简便"
      },
      {
        "id": "D",
        "text": "把 18.6 和 3.45 合起来看作约 22 元，但需精确计算；关键是先算 18.6 + 3.45 再整体减，无法进一步简便"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "50 - 18.6 - 3.45 可转化为 (50 - 18.6) - 3.45 = 31.4 - 3.45；而 31.4 - 3.45 中，31.4 和 3.45 的小数部分都含 .4，可看作 31.4 - 3.4 - 0.05 = 28 - 0.05 = 27.95，比直接加再减更易口算。"
    ],
    "common_errors": [
      {
        "tag": "missed_grouping",
        "error": "未意识到连续减法可分步计算，盲目先加再减，失去简便机会",
        "remediation": "遇到‘付钱找零’类题，优先考虑‘总钱数 - 第一项 - 第二项’，再观察能否分步减出整数。"
      },
      {
        "tag": "decimal_place_misalignment",
        "error": "计算 31.4 - 3.45 时没补零对齐，写成 31.4 - 3.45 = 27.95（错位误算）",
        "remediation": "小数减法一定要末尾补零对齐：31.40 - 3.45 = 27.95。"
      }
    ],
    "feedback_correct": "太厉害了！你抓住了‘先减整数部分再处理小数’这个简便关键，计算又快又准！",
    "feedback_wrong": "没关系！下次试试把大数先减去一个数，看看剩下的能不能和另一个数轻松相减～",
    "hints": [
      {
        "text": "想想：50 元先减跳绳的钱，剩下多少？这个数和毽子价格的小数部分有什么共同点？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_001__mos70gnl_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_simplify",
    "skill_name": "小数加减简便计算",
    "ability_dimension": [
      "calculation",
      "strategy"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "简算：9.75 - 2.3 - 1.7",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "5.75"
      },
      {
        "id": "B",
        "text": "9.75"
      },
      {
        "id": "C",
        "text": "7.75"
      },
      {
        "id": "D",
        "text": "6.75"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先算2.3 + 1.7 = 4，再用9.75 - 4 = 5.75"
    ],
    "common_errors": [
      {
        "tag": "carry_missing",
        "error": "误将2.3和1.7相减而非相加，导致多减一次",
        "remediation": "减去两个数，可以先加起来再减，这是简便计算的关键步骤"
      },
      {
        "tag": "decimal_point_error",
        "error": "把9.75看成975，或小数点对齐错误，算出575等整数结果",
        "remediation": "所有小数运算都要对齐小数点，9.75是九点七五，不是九百七十五"
      }
    ],
    "feedback_correct": "太棒啦！你发现了可以先把两个减数合起来算～",
    "feedback_wrong": "再试一次吧！记住：连续减两个数，等于减它们的和哦。",
    "hints": [
      {
        "text": "想一想：a - b - c 等于 a - (b + c) 吗？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_002__mos70gnl_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_simplify",
    "skill_name": "小数加减简便计算",
    "ability_dimension": [
      "calculation",
      "strategy"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "学校举办跳绳比赛，小刚三次成绩分别是12.8米、15.2米和13.6米。他想快速算出总长度，下面哪种方法最简便？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "12.8 + 15.2 + 13.6 = (12.8 + 15.2) + 13.6 = 28 + 13.6 = 41.6"
      },
      {
        "id": "B",
        "text": "12.8 + 15.2 + 13.6 = 12.8 + (15.2 + 13.6) = 12.8 + 28.8 = 41.6"
      },
      {
        "id": "C",
        "text": "12.8 + 15.2 + 13.6 = (12.8 + 13.6) + 15.2 = 26.4 + 15.2 = 41.6"
      },
      {
        "id": "D",
        "text": "直接列竖式从右往左一位位加：个位→十分位→百分位"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "观察发现12.8和15.2相加得整数28，可先算这两项，再加13.6，避免小数进位麻烦"
    ],
    "common_errors": [
      {
        "tag": "strategy_oversight",
        "error": "选D，忽略简便计算要求，只用常规竖式思维",
        "remediation": "题目明确问‘最简便方法’，要优先找能凑整的数组合"
      },
      {
        "tag": "decimal_point_error",
        "error": "在选项B中误算15.2+13.6=28.6（漏进位），导致结果错",
        "remediation": "加小数时，十分位2+6=8，个位5+3=8，十位1+1=2，所以是28.8"
      }
    ],
    "feedback_correct": "真会动脑筋！一眼看出12.8和15.2能凑整，这就是简便计算的小秘诀～",
    "feedback_wrong": "没关系！下次注意找‘能凑成整数’的两个小数，让计算变轻松～",
    "hints": [
      {
        "text": "看看哪两个数相加后小数部分变成0？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_001__mos70xhv_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_simplify",
    "skill_name": "小数加减简便计算",
    "ability_dimension": [
      "calculation",
      "strategy"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "简算：7.35 + 1.8 - 0.35，怎样算最简便？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "先算 7.35 + 1.8 = 9.15，再减 0.35 得 8.8"
      },
      {
        "id": "B",
        "text": "先算 7.35 - 0.35 = 7，再加 1.8 得 8.8"
      },
      {
        "id": "C",
        "text": "先算 1.8 - 0.35 = 1.45，再加 7.35 得 8.8"
      },
      {
        "id": "D",
        "text": "按顺序从左到右：7.35 + 1.8 = 9.15，9.15 - 0.35 = 8.8"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "观察发现 7.35 和 0.35 小数部分相同，先相减得整数 7，再加 1.8 更简便。"
    ],
    "common_errors": [
      {
        "tag": "grouping_error",
        "error": "没发现可凑整的数对，机械按顺序计算",
        "remediation": "做小数加减前先看有没有相同小数部分或能凑整的数，优先组合。"
      },
      {
        "tag": "operation_order_error",
        "error": "误以为必须从左到右计算，忽略加减法可交换结合（加法可交换，减法要谨慎）",
        "remediation": "记住：a + b - c 中，若 a 和 c 能相减得整数，可先算 a - c，再加 b。"
      }
    ],
    "feedback_correct": "真棒！你发现了 7.35 和 0.35 的小数部分相同，先相减让计算变轻松～",
    "feedback_wrong": "没关系！试试把小数部分一样的两个数先配对，就像好朋友一起走，计算就更简单啦！",
    "hints": [
      {
        "text": "看看哪两个数相减能得到整数？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_002__mos70xhv_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_simplify",
    "skill_name": "小数加减简便计算",
    "ability_dimension": [
      "calculation",
      "strategy"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "李老师批改作业用了2.45小时，备课用了1.55小时，写教案用了3.6小时。她一共用了多少小时？用简便方法计算。",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "2.45 + 1.55 + 3.6 = 4 + 3.6 = 7.6（小时）"
      },
      {
        "id": "B",
        "text": "2.45 + 3.6 + 1.55 = 6.05 + 1.55 = 7.6（小时）"
      },
      {
        "id": "C",
        "text": "(2.45 + 3.6) + 1.55 = 6.05 + 1.55 = 7.6（小时）"
      },
      {
        "id": "D",
        "text": "2.45 + 1.55 + 3.6 = 4.0 + 3.6 = 7.6（小时），但 2.45 + 1.55 实际是 4.00"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先观察：2.45 和 1.55 相加正好是 4.00（因为 0.45 + 0.55 = 1.00），再加 3.6 得 7.6，比逐个相加更简便。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "算 2.45 + 1.55 时漏进位，得出 3.90 或 4.0",
        "remediation": "小数加法要对齐小数点，百分位 5+5=10，向十分位进 1；十分位 4+5+1=10，向个位进 1；个位 2+1+1=4。"
      },
      {
        "tag": "missed_simplification",
        "error": "没有利用凑整策略，直接列竖式三步相加，耗时且易错",
        "remediation": "遇到多个小数相加，先找‘和为整数’的数对（如 0.45+0.55、0.2+0.8），优先组合。"
      }
    ],
    "feedback_correct": "太厉害了！你一眼看出 2.45 和 1.55 是一对‘好搭档’，一加就变成整数，真会巧算！",
    "feedback_wrong": "加油！下次看到小数，先悄悄问自己：‘哪两个数加起来是整数呀？’找到它们，计算就飞快啦！",
    "hints": [
      {
        "text": "2.45 和 1.55 的小数部分加起来是多少？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_001__mos70xhv_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_simplify",
    "skill_name": "小数加减简便计算",
    "ability_dimension": [
      "calculation",
      "strategy"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "简算：9.75 + 1.6 - 0.75，怎样算更简便？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "先算 9.75 + 1.6 = 11.35，再减 0.75 得 10.6"
      },
      {
        "id": "B",
        "text": "先算 9.75 - 0.75 = 9，再加 1.6 得 10.6"
      },
      {
        "id": "C",
        "text": "先算 1.6 - 0.75 = 0.85，再加 9.75 得 10.6"
      },
      {
        "id": "D",
        "text": "直接按顺序从左到右：9.75 + 1.6 - 0.75 = 10.6"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "观察发现 9.75 和 0.75 小数部分相同，先相减得整数 9，再加 1.6 更简便。"
    ],
    "common_errors": [
      {
        "tag": "missing_grouping",
        "error": "没发现可以凑整的数对，机械按顺序计算",
        "remediation": "找找有没有相同小数部分或能凑成整数的两个数，优先算它们。"
      },
      {
        "tag": "operation_order_error",
        "error": "错误认为必须从左到右，忽略加减法可交换结合（带符号移动）",
        "remediation": "记住：加减混合运算中，可以把带数字的项连同前面的‘+’或‘−’一起调换位置，只要不改变符号。"
      }
    ],
    "feedback_correct": "真棒！你发现了 9.75 和 0.75 能先抵消，让计算又快又准！",
    "feedback_wrong": "再想想哦～看看哪两个数合起来是整数？试试把它们先算！",
    "hints": [
      {
        "text": "找一找：哪个数减去 0.75 能变成整数？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_002__mos70xhv_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_add_sub_simplify",
    "skill_name": "小数加减简便计算",
    "ability_dimension": [
      "calculation",
      "strategy"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "学校运动会跳高预赛，小刚三次成绩分别是 1.28 米、0.92 米和 1.08 米。他想快速算出总成绩，下面哪种方法最简便？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "1.28 + 0.92 + 1.08 = (1.28 + 0.92) + 1.08 = 2.2 + 1.08 = 3.28"
      },
      {
        "id": "B",
        "text": "1.28 + 0.92 + 1.08 = 1.28 + (0.92 + 1.08) = 1.28 + 2.00 = 3.28"
      },
      {
        "id": "C",
        "text": "1.28 + 0.92 + 1.08 = (1.28 + 1.08) + 0.92 = 2.36 + 0.92 = 3.28"
      },
      {
        "id": "D",
        "text": "直接列竖式：1.28 + 0.92 + 1.08，逐位相加得 3.28"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "观察发现 0.92 和 1.08 相加正好是 2.00（百分位 2+8=10 进 1，十分位 9+0+1=10 进 1，个位 0+1+1=2），先算这对最简便。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误以为 0.92 + 1.08 = 1.910 或 2.10，小数点对齐出错",
        "remediation": "写竖式时务必对齐小数点，百分位对百分位，十分位对十分位。"
      },
      {
        "tag": "missed_optimal_pair",
        "error": "选了 A 或 C，虽结果对但没找到最简便组合（0.92+1.08=2.00 比其他两数组合更整）",
        "remediation": "优先找‘凑整’组合：和为整数、和为一位小数（如 0.5）、或差为整数的数对。"
      }
    ],
    "feedback_correct": "太厉害啦！你一眼就看出 0.92 和 1.08 是‘黄金搭档’，加起来刚好是 2 米！",
    "feedback_wrong": "没关系～再看看三个小数，哪两个加起来最容易变成整数呢？",
    "hints": [
      {
        "text": "想一想：0.92 加上多少等于 2？1.08 正好就是那个数！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  }
] as Question[];
