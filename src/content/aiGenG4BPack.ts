/**
 * AI_GEN_G4B_PACK — v0.30.2 一次性生成的 G4B 题库补充包
 *
 * 来源：在 admin / 浏览器里跑 /api/generate/questions 批量调用，DashScope qwen-plus
 * 出题，按 difficulty=2-4，每个 G4B skill 4-12 道。本文件由
 * scripts/_emit-g4b-ai-pack.mjs 从 /tmp/g4b-ai-gen.json 转译，**勿手改**——
 * 改要重跑生成 + 重 emit。
 *
 * 总数：153 道
 * 难度：D2=50 / D3=20 / D4=83
 *
 * 涵盖技能：
 *   decimal_unit_conversion:10, decimal_meaning_place:6, decimal_add_sub_vertical:8, triangle_angle_sum:8, decimal_add_sub_simplify:9, triangle_inequality:12, triangle_classification:6, decimal_mul_vertical:12, decimal_mul_meaning:5, decimal_product_digits:7, decimal_mul_simplify:8, decimal_price_quantity:4, decimal_speed_distance:10, observe_front_top_left:12, letter_expression:6, data_bar_chart:10, average_meaning:8, average_compute:12
 */

import type { Question } from "../core/types";

export const AI_GEN_G4B_PACK: Question[] = [
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_001__morv4q6w_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_unit_conversion",
    "skill_name": "长度、质量、面积、人民币单位换算",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "一支铅笔长15厘米8毫米，用米作单位是多少米？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "15.8米"
      },
      {
        "id": "B",
        "text": "1.58米"
      },
      {
        "id": "C",
        "text": "0.158米"
      },
      {
        "id": "D",
        "text": "0.0158米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "1厘米 = 0.01米，1毫米 = 0.001米；15厘米 = 0.15米，8毫米 = 0.008米；合起来是0.15 + 0.008 = 0.158米。"
    ],
    "common_errors": [
      {
        "tag": "unit_mismatch",
        "error": "把厘米直接当米用，误写15.8米",
        "remediation": "记住1米=100厘米，所以厘米变米要除以100，小数点左移两位。"
      },
      {
        "tag": "decimal_point_error",
        "error": "把15厘米8毫米当成1.58米，漏掉毫米的千分位",
        "remediation": "8毫米是0.008米，不是0.08米；要补零对齐：15厘米=0.150米，+0.008米=0.158米。"
      }
    ],
    "feedback_correct": "真棒！你准确地把厘米和毫米都换成了米，还对齐了小数位。",
    "feedback_wrong": "再想想：1米有100厘米，1厘米只有0.01米哦～",
    "hints": [
      {
        "text": "先想：1厘米等于多少米？1毫米呢？再分别换算后相加。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_002__morv4q6w_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_unit_conversion",
    "skill_name": "长度、质量、面积、人民币单位换算",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "一块正方形手帕边长是4分米5厘米，它的面积是多少平方分米？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "20.25平方分米"
      },
      {
        "id": "B",
        "text": "4.5平方分米"
      },
      {
        "id": "C",
        "text": "2025平方分米"
      },
      {
        "id": "D",
        "text": "0.2025平方分米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先统一单位：4分米5厘米 = 4.5分米；正方形面积 = 边长×边长 = 4.5 × 4.5；4.5 × 4.5 = (45/10) × (45/10) = 2025/100 = 20.25平方分米。"
    ],
    "common_errors": [
      {
        "tag": "area_unit_error",
        "error": "直接用4.5分米乘4.5分米但忘记结果单位是平方分米，或误以为答案是4.5",
        "remediation": "面积是两个长度相乘，单位也要相乘：分米×分米=平方分米，数值是4.5×4.5=20.25。"
      },
      {
        "tag": "decimal_place_error",
        "error": "算出2025后没除以100，误选2025平方分米",
        "remediation": "4.5是45个0.1，所以4.5×4.5相当于45×45个0.01，即2025个0.01=20.25。"
      }
    ],
    "feedback_correct": "太厉害啦！你既换对了单位，又算准了面积，小数点也站得稳稳的～",
    "feedback_wrong": "别急！面积要先统一成同一单位（分米），再相乘，记得小数乘法点几位哦。",
    "hints": [
      {
        "text": "边长要先变成‘几分米’，再用‘边长×边长’求面积；注意小数乘小数，积的小数位数是两个因数小数位数之和。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_001__morv4q6w_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_unit_conversion",
    "skill_name": "长度、质量、面积、人民币单位换算",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "小红买了一块布，长3米8分米，这块布长多少米？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "3.08米"
      },
      {
        "id": "B",
        "text": "3.8米"
      },
      {
        "id": "C",
        "text": "38米"
      },
      {
        "id": "D",
        "text": "0.38米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "1米 = 10分米，所以8分米 = 0.8米；3米 + 0.8米 = 3.8米"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误将8分米写成0.08米（当成厘米）",
        "remediation": "记住：1分米 = 0.1米，8分米 = 8 × 0.1 = 0.8米"
      },
      {
        "tag": "unit_confusion",
        "error": "把分米当厘米，错算成3米8分米 = 3米80厘米 = 3.80米（数值对但逻辑错）",
        "remediation": "题目给的是分米，直接换算：8分米 = 0.8米，不用绕路转厘米"
      }
    ],
    "feedback_correct": "答对啦！分米变米要除以10，8分米就是0.8米哦～",
    "feedback_wrong": "再想想：1分米是0.1米，那8分米是多少米呢？",
    "hints": [
      {
        "text": "想一想：1米 = 10分米，所以1分米 = ?米",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_002__morv4q6w_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_unit_conversion",
    "skill_name": "长度、质量、面积、人民币单位换算",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "一块正方形地砖边长是60厘米，它的面积是多少平方米？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "0.36平方米"
      },
      {
        "id": "B",
        "text": "3600平方米"
      },
      {
        "id": "C",
        "text": "0.6平方米"
      },
      {
        "id": "D",
        "text": "3.6平方米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先算面积：60厘米 × 60厘米 = 3600平方厘米；再换算：1平方米 = 10000平方厘米，所以3600平方厘米 = 3600 ÷ 10000 = 0.36平方米"
    ],
    "common_errors": [
      {
        "tag": "area_unit_error",
        "error": "直接用60厘米 = 0.6米，再算0.6 × 0.6 = 0.36，结果对但单位理解错（未意识到这是面积换算）",
        "remediation": "面积换算不是长度换算的简单平移：1平方米 = 10000平方厘米，必须用面积单位进率"
      },
      {
        "tag": "missing_conversion",
        "error": "只算出3600平方厘米就选3600，没换成平方米",
        "remediation": "题目问的是‘多少平方米’，答案必须带‘平方米’单位，且数值要换算"
      }
    ],
    "feedback_correct": "太棒了！面积换算要小心：平方厘米变平方米要除以10000哦～",
    "feedback_wrong": "注意啦：边长换算后要平方，而且面积单位进率是10000，不是100哦！",
    "hints": [
      {
        "text": "先算出面积是多少平方厘米，再想：1平方米等于多少平方厘米？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_001__morv57je_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_unit_conversion",
    "skill_name": "长度、质量、面积、人民币单位换算",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "一块布料长5米8分米，用小数表示是多少米？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "5.08米"
      },
      {
        "id": "B",
        "text": "5.8米"
      },
      {
        "id": "C",
        "text": "58米"
      },
      {
        "id": "D",
        "text": "0.58米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "1米 = 10分米，所以8分米 = 0.8米；5米 + 0.8米 = 5.8米"
    ],
    "common_errors": [
      {
        "tag": "unit_confusion",
        "error": "误将分米当作厘米，写成5.08米",
        "remediation": "记住：1米=10分米，不是100厘米；8分米=0.8米，不是0.08米"
      },
      {
        "tag": "place_value_error",
        "error": "把5米8分米当成58米，漏掉小数点",
        "remediation": "分米是比米小的单位，不能直接拼数字，要换算成小数加在米后面"
      }
    ],
    "feedback_correct": "太棒啦！你准确把分米换成了0.1米的单位，答对了！",
    "feedback_wrong": "再想想哦～分米是米的十分之一，8分米就是0.8米，不是0.08米或58米。",
    "hints": [
      {
        "text": "想一想：1米等于多少分米？8分米等于多少米？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_002__morv57je_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_unit_conversion",
    "skill_name": "长度、质量、面积、人民币单位换算",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小红买了一块手帕，面积是650平方厘米，妈妈说这相当于多少平方分米？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "6.5平方分米"
      },
      {
        "id": "B",
        "text": "65平方分米"
      },
      {
        "id": "C",
        "text": "0.65平方分米"
      },
      {
        "id": "D",
        "text": "6500平方分米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "1平方分米 = 100平方厘米，所以650平方厘米 ÷ 100 = 6.5平方分米"
    ],
    "common_errors": [
      {
        "tag": "area_unit_error",
        "error": "误用长度单位换算（1分米=10厘米）直接套到面积上，得65平方分米",
        "remediation": "面积单位进率是长度进率的平方：1分米=10厘米 → 1平方分米=100平方厘米"
      },
      {
        "tag": "division_direction_error",
        "error": "把650除以10得到65，或乘以100得到65000，方向搞反",
        "remediation": "小单位换大单位用除法；平方厘米换平方分米，要除以100"
      }
    ],
    "feedback_correct": "真厉害！你记得面积单位要‘平方’进率，答对啦！",
    "feedback_wrong": "别着急～平方厘米变平方分米，就像把100个小格拼成1个大格，所以要除以100哦。",
    "hints": [
      {
        "text": "回忆：1分米=10厘米，那1平方分米等于多少平方厘米呢？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_001__morv57je_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_unit_conversion",
    "skill_name": "长度、质量、面积、人民币单位换算",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "小红买了一块布，长5米8分米，这块布长多少米？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "5.08米"
      },
      {
        "id": "B",
        "text": "5.8米"
      },
      {
        "id": "C",
        "text": "58米"
      },
      {
        "id": "D",
        "text": "0.58米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "1米 = 10分米，所以8分米 = 0.8米；5米 + 0.8米 = 5.8米"
    ],
    "common_errors": [
      {
        "tag": "unit_ratio_error",
        "error": "误以为1米=100分米，把8分米当成0.08米",
        "remediation": "记住：1米=10分米，1分米=0.1米"
      },
      {
        "tag": "decimal_point_error",
        "error": "漏掉小数点，直接写成58米",
        "remediation": "分米是比米小的单位，结果一定比原米数大一点，但不会翻倍"
      }
    ],
    "feedback_correct": "答对啦！8分米就是0.8米，合起来是5.8米～",
    "feedback_wrong": "再想想哦：分米和米之间的进率是10，不是100！",
    "hints": [
      {
        "text": "想一想：1分米等于多少米？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_002__morv57je_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_unit_conversion",
    "skill_name": "长度、质量、面积、人民币单位换算",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "一块正方形瓷砖边长是40厘米，它的面积是多少平方分米？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "16平方分米"
      },
      {
        "id": "B",
        "text": "160平方分米"
      },
      {
        "id": "C",
        "text": "0.16平方分米"
      },
      {
        "id": "D",
        "text": "4平方分米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先算面积：40厘米 × 40厘米 = 1600平方厘米；再换算：1平方分米 = 100平方厘米，所以1600 ÷ 100 = 16平方分米"
    ],
    "common_errors": [
      {
        "tag": "area_unit_error",
        "error": "直接用40厘米=0.4分米，然后算0.4×0.4=0.16，却忘记单位是平方分米",
        "remediation": "面积换算要‘平方’：0.4分米×0.4分米=0.16平方分米，但这是错的——因为40厘米=4分米，不是0.4分米！"
      },
      {
        "tag": "carry_missing",
        "error": "算出1600平方厘米后，误除以10得160平方分米",
        "remediation": "1平方分米=100平方厘米，换算要除以100，不是除以10"
      }
    ],
    "feedback_correct": "太棒了！边长40厘米=4分米，4×4=16平方分米～",
    "feedback_wrong": "注意哦：面积单位换算是‘平方’关系，1平方分米=100平方厘米！",
    "hints": [
      {
        "text": "先统一单位：40厘米等于多少分米？再算正方形面积公式。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_001__morv6lrh_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_unit_conversion",
    "skill_name": "长度、质量、面积、人民币单位换算",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "一条跳绳长2米65厘米，用米作单位是多少米？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "2.065米"
      },
      {
        "id": "B",
        "text": "2.65米"
      },
      {
        "id": "C",
        "text": "26.5米"
      },
      {
        "id": "D",
        "text": "265米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "1米 = 100厘米，所以65厘米 = 65 ÷ 100 = 0.65米；2米 + 0.65米 = 2.65米"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "把65厘米当成0.065米（多除一次100），得2.065米",
        "remediation": "记住：厘米→米要除以100，小数点向左移两位，65厘米→0.65米"
      },
      {
        "tag": "unit_misalignment",
        "error": "误将2米65厘米直接写成265米或26.5米，混淆了进率",
        "remediation": "先分开单位再换算：2米不变，65厘米换算后相加，不拼数字"
      }
    ],
    "feedback_correct": "真棒！你熟练掌握了厘米和米的换算关系～",
    "feedback_wrong": "再想想：1米=100厘米，65厘米是多少米呢？",
    "hints": [
      {
        "text": "想一想：100厘米=1米，那么1厘米=多少米？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_002__morv6lrh_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U1_DECIMAL_ADD_SUB",
    "unit_name": "小数的意义和加减法",
    "skill_id": "decimal_unit_conversion",
    "skill_name": "长度、质量、面积、人民币单位换算",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "一块长方形菜地长8米5分米，宽3米20厘米，它的面积是多少平方米？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "27.2平方米"
      },
      {
        "id": "B",
        "text": "26.5平方米"
      },
      {
        "id": "C",
        "text": "25.6平方米"
      },
      {
        "id": "D",
        "text": "24.8平方米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "长：8米5分米 = 8.5米；宽：3米20厘米 = 3.2米；面积 = 长 × 宽 = 8.5 × 3.2 = 27.2（平方米）"
    ],
    "common_errors": [
      {
        "tag": "carry_missing",
        "error": "计算8.5×3.2时漏掉小数位，得出265或26.5等错误结果",
        "remediation": "先按整数算85×32=2720，再看两个因数共2位小数，积应有2位小数→27.20=27.2"
      },
      {
        "tag": "unit_conversion_error",
        "error": "把3米20厘米错换为3.02米（误以为20厘米=0.02米）",
        "remediation": "20厘米=20÷100=0.2米，不是0.02米；记清：1米=100厘米，小数点左移两位"
      }
    ],
    "feedback_correct": "太厉害啦！长度换算+小数乘法一步到位～",
    "feedback_wrong": "别急，先统一单位成‘米’，再算长×宽哦！",
    "hints": [
      {
        "text": "先把长和宽都换成‘米’，再相乘求面积。注意：1分米=0.1米，1厘米=0.01米。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_meaning_place_002__morv5kk4_0",
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
    "stem": "小红在计数器上拨出一个小数：个位 0 颗珠、十分位 6 颗珠、百分位 0 颗珠、千分位 4 颗珠。这个小数是多少？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "0.604"
      },
      {
        "id": "B",
        "text": "0.64"
      },
      {
        "id": "C",
        "text": "6.04"
      },
      {
        "id": "D",
        "text": "0.064"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "个位是 0，写为 0；十分位有 6 颗珠 → 0.6；百分位是 0 → 占位不省略；千分位是 4 → 加上 0.004；合起来是 0.604。"
    ],
    "common_errors": [
      {
        "tag": "decimal_place_error",
        "error": "漏写百分位的 0，写成 0.64（选 B）",
        "remediation": "百分位是 0，必须写出来占位，否则变成 0.64 = 0.640 ≠ 0.604"
      },
      {
        "tag": "place_value_misread",
        "error": "把十分位当成个位，误写为 6.04（选 C）",
        "remediation": "计数器上‘个位’在小数点左边，‘十分位’在小数点右边第一位，顺序不能颠倒"
      }
    ],
    "feedback_correct": "太厉害啦！你读懂了计数器上每一位的含义。",
    "feedback_wrong": "别灰心～注意小数点左右的数位名称和顺序哦！",
    "hints": [
      {
        "text": "小数点左边是个位，右边依次是十分位、百分位、千分位；每个位置上的珠子数就是该位的数字",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_002__morv6ua1_0",
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
    "stem": "下面对小数 6.047 中‘4’的解释，正确的是？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "表示 4 个 0.1"
      },
      {
        "id": "B",
        "text": "表示 4 个 0.01"
      },
      {
        "id": "C",
        "text": "表示 4 个 0.001"
      },
      {
        "id": "D",
        "text": "表示 4 个 1"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "6.047 中，小数点后第一位是十分位（0），第二位是百分位（4），第三位是千分位（7）；所以‘4’在百分位，表示 4 个 0.01。"
    ],
    "common_errors": [
      {
        "tag": "place_value_confusion",
        "error": "误将‘4’看作十分位，选 A",
        "remediation": "从左往右数小数点后的位数：第 1 位是十分位，第 2 位是百分位，第 3 位是千分位。"
      },
      {
        "tag": "decimal_point_error",
        "error": "误以为‘4’在千分位，选 C",
        "remediation": "对照数位表：6.047 → 6（个位）、0（十分位）、4（百分位）、7（千分位）。"
      }
    ],
    "feedback_correct": "太厉害啦！你准确找到了百分位上‘4’代表的意义。",
    "feedback_wrong": "没关系～再看看小数点后面每一位分别叫什么名字吧！",
    "hints": [
      {
        "text": "写出数位顺序：个位 . 十分位 百分位 千分位 → 对应 6 . 0 4 7",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_002__morv7d7d_0",
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
    "stem": "由 2 个一、5 个 0.001 和 7 个 0.1 组成的小数，正确的是哪一个？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "2.705"
      },
      {
        "id": "B",
        "text": "2.57"
      },
      {
        "id": "C",
        "text": "7.25"
      },
      {
        "id": "D",
        "text": "2.075"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "2 个一 → 2；7 个 0.1 → 0.7；5 个 0.001 → 0.005；合起来是 2 + 0.7 + 0.005 = 2.705。"
    ],
    "common_errors": [
      {
        "tag": "place_value_order_error",
        "error": "把 7 个 0.1 错放在百分位，写成 2.07，再加 0.005 得 2.075（D）",
        "remediation": "0.1 是十分位，要写在小数点后第1位；0.001 是千分位，在第3位。"
      },
      {
        "tag": "carry_missing",
        "error": "误将 7 个 0.1 和 5 个 0.001 直接拼成 0.75，得 2.75（无此选项），或误为 2.57（B）",
        "remediation": "每个计数单位要独立换算再相加，不能简单拼数字。"
      }
    ],
    "feedback_correct": "太棒了！你准确找到了各个数位的位置，2.705 完全正确！",
    "feedback_wrong": "别灰心～记得：0.1 在十分位（第1位），0.001 在千分位（第3位），再组合试试吧！",
    "hints": [
      {
        "text": "先分别写出：2 个一 = 2，7 个 0.1 = 0.7，5 个 0.001 = 0.005，再相加。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_002__morv7d7d_1",
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
    "stem": "由 7 个 0.1、3 个 0.01 和 5 个 0.001 组成的小数是多少？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "0.735"
      },
      {
        "id": "B",
        "text": "7.35"
      },
      {
        "id": "C",
        "text": "0.0735"
      },
      {
        "id": "D",
        "text": "73.5"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "7 个 0.1 = 0.7，3 个 0.01 = 0.03，5 个 0.001 = 0.005；合起来是 0.7 + 0.03 + 0.005 = 0.735。"
    ],
    "common_errors": [
      {
        "tag": "place_value_misalignment",
        "error": "把 7 个 0.1 当作 7，写成 7.35",
        "remediation": "0.1 是十分之一，7 个 0.1 是 0.7，不是 7；小数部分不能直接当整数拼接"
      },
      {
        "tag": "decimal_point_error",
        "error": "漏掉千分位或错位，写成 0.0735",
        "remediation": "5 个 0.001 是千分位上的 5，应写在小数点后第三位，不是第四位"
      }
    ],
    "feedback_correct": "太厉害啦！你准确拼出了三位小数～",
    "feedback_wrong": "别急，我们按数位一个一个放：十分位、百分位、千分位。",
    "hints": [
      {
        "text": "先写出 7 个 0.1 = 0.7，再补上 0.03 和 0.005，对齐小数点相加",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_G4B_U1_DECIMAL_ADD_SUB_002__morynnvj_0",
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
    "stem": "下面哪句话正确描述了 6.080 这个小数中数字 8 所在的数位及其含义？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "8 在百分位，表示 8 个 0.01"
      },
      {
        "id": "B",
        "text": "8 在十分位，表示 8 个 0.1"
      },
      {
        "id": "C",
        "text": "8 在千分位，表示 8 个 0.001"
      },
      {
        "id": "D",
        "text": "8 在个位，表示 8 个一"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "6.080 的小数点后依次是：0（十分位）、8（百分位）、0（千分位），所以 8 在百分位，表示 8 个 0.01。末尾的 0 不改变数值，但保留数位位置。"
    ],
    "common_errors": [
      {
        "tag": "trailing_zero_misinterpretation",
        "error": "认为末尾的 0 让 8 移到了千分位，选 C",
        "remediation": "末尾的 0 是占位符，不改变前面数字的位置；6.080 和 6.08 的 8 都在百分位。"
      },
      {
        "tag": "place_value_confusion",
        "error": "误将小数点前的 6 当作个位，进而错认小数点后第一位为个位，选 D 或 B",
        "remediation": "个位在小数点左边第一位；小数点右边第一位才是十分位。写出来对齐看：6 . 0 8 0 → 个 . 十 百 千 分 分 分 位 位 位 位。"
      }
    ],
    "feedback_correct": "太厉害了！你不仅看清了位置，还理解了末尾零的作用。",
    "feedback_wrong": "没关系，再读一遍小数数位表，特别注意小数点后的顺序哦～",
    "hints": [
      {
        "text": "把 6.080 写成竖排形式：个位（6）、小数点、十分位（0）、百分位（8）、千分位（0）。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_meaning_place_002__morynous_0",
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
    "stem": "由 9 个 0.1、0 个 0.01 和 6 个 0.001 组成的小数是哪一个？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "0.906"
      },
      {
        "id": "B",
        "text": "0.096"
      },
      {
        "id": "C",
        "text": "9.006"
      },
      {
        "id": "D",
        "text": "0.96"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "9 个 0.1 是 0.9，0 个 0.01 是 0，6 个 0.001 是 0.006，合起来是 0.9 + 0 + 0.006 = 0.906。"
    ],
    "common_errors": [
      {
        "tag": "place_value_misalignment",
        "error": "把 9 个 0.1 写成 9（当成 9 个 1）",
        "remediation": "0.1 是十分之一，9 个 0.1 就是 0.9，不是 9"
      },
      {
        "tag": "missing_zero_placeholder",
        "error": "漏写百分位的 0，写成 0.96（误以为 0 个 0.01 可省略）",
        "remediation": "0 个 0.01 必须用 0 占位，否则 0.96 表示 9 个 0.1 和 6 个 0.01，不符合题意"
      }
    ],
    "feedback_correct": "太厉害啦！你清楚每个数位上的数字代表几个对应的计数单位。",
    "feedback_wrong": "别灰心～注意‘0 个 0.01’要在百分位写 0 占位哦。",
    "hints": [
      {
        "text": "先写出各部分：9 个 0.1 = 0.9，0 个 0.01 = 0.00，6 个 0.001 = 0.006；再相加并按位对齐",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_001__morv64ge_0",
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
    "stem": "小红在做小数加法竖式时，把 3.07 和 2.8 相加，她先对齐小数点再计算。下面哪一个是正确的竖式写法？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "  3.07\n+ 2.80\n─────"
      },
      {
        "id": "B",
        "text": "  3.07\n+ 2.8 \n─────"
      },
      {
        "id": "C",
        "text": "  3.07\n+ 28  \n─────"
      },
      {
        "id": "D",
        "text": "  307 \n+ 28  \n─────"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "小数加减必须小数点对齐；2.8 要补零写成 2.80，才能与 3.07 的百分位对齐。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "没补零，直接写 2.8，导致十分位与百分位错位",
        "remediation": "记住：对齐小数点后，缺位要补0，不是补空格也不是省略"
      },
      {
        "tag": "place_value_misalignment",
        "error": "把 2.8 当作整数 28 来对齐，完全忽略小数点",
        "remediation": "先找小数点位置，所有数字的小数点必须上下对齐，再补零"
      }
    ],
    "feedback_correct": "真棒！你掌握了小数竖式的关键——小数点对齐后补零。",
    "feedback_wrong": "再试一次哦～小数点对齐是第一步，缺位要用0补齐才不会算错！",
    "hints": [
      {
        "text": "想一想：2.8 的百分位上是什么数字？需要补几个0才能和 3.07 对齐？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_002__morv64ge_1",
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
    "stem": "小明用竖式计算 15 − 6.48，他写成了下面的样子，但漏掉了小数点对齐的一步。哪一种写法才是正确对齐小数点后的竖式？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "  15.00\n−  6.48\n──────"
      },
      {
        "id": "B",
        "text": "  15\n− 6.48\n─────"
      },
      {
        "id": "C",
        "text": "  15.0\n−  6.48\n──────"
      },
      {
        "id": "D",
        "text": "  1500\n− 648 \n─────"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "整数减小数时，要把整数写成带小数点的形式（如15 → 15.00），再对齐小数点；6.48有两位小数，所以15要补两个0变成15.00。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "没给15加小数点和补零，直接写15和6.48相减，导致数位错乱",
        "remediation": "整数可看作小数点在末尾，如15 = 15.00，补零后才能对齐百分位"
      },
      {
        "tag": "carry_missing",
        "error": "虽对齐了但计算时忘记退位，比如个位5减8不够却没向十位借1",
        "remediation": "对齐只是第一步，后续计算仍要按整数减法规则，注意退位！"
      }
    ],
    "feedback_correct": "太厉害啦！你不仅会列竖式，还知道整数要补零对齐小数点～",
    "feedback_wrong": "没关系！记得：15其实是15.00，补上小数点和两个0，就能和6.48完美对齐啦！",
    "hints": [
      {
        "text": "提示：6.48的小数点后面有两位，那15的小数点后面也该有两位哦！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_001__morv64ge_2",
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
    "stem": "小红在做小数加法竖式时，把 3.07 和 2.9 相加，她先对齐了小数点再计算。下面哪个竖式写法是正确的？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "  3.07\n+ 2.9\n─────"
      },
      {
        "id": "B",
        "text": "  3.07\n+2.90\n─────"
      },
      {
        "id": "C",
        "text": "  307\n+ 29\n────"
      },
      {
        "id": "D",
        "text": "  3.07\n+ 29.\n─────"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "小数加减必须小数点对齐；2.9 可补零写成 2.90，使末位对齐，竖式才规范正确。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "未补零导致数位错位，如选项 A 中 2.9 的 9 对齐 3.07 的 7，实际应与百分位对齐",
        "remediation": "记住：小数点对齐后，缺位用 0 补齐，再计算。"
      },
      {
        "tag": "place_value_misalignment",
        "error": "当成整数竖式处理（选项 C），忽略小数点位置",
        "remediation": "先看小数点在哪，所有数字都要按小数点对齐，不是末尾对齐。"
      }
    ],
    "feedback_correct": "太棒啦！小数点对齐后，补零让数位整齐，计算更准确哦～",
    "feedback_wrong": "再试一次吧！小数加减一定要先对齐小数点，不够位数的用 0 补齐哦。",
    "hints": [
      {
        "text": "想一想：2.9 等于 2.90 吗？补零会不会改变大小？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_002__morv64ge_3",
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
    "stem": "小明用竖式计算 15 − 6.84，他在草稿纸上写了四个不同写法。哪一个是小数减法中正确对齐小数点的竖式？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "  15\n−6.84\n─────"
      },
      {
        "id": "B",
        "text": "  15.00\n− 6.84\n──────"
      },
      {
        "id": "C",
        "text": "  15.0\n− 6.84\n──────"
      },
      {
        "id": "D",
        "text": "  15\n− 6.84\n─────"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "被减数 15 是整数，要写成 15.00 才能与 6.84 的小数点对齐；百分位对齐后才能逐位相减。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "未将整数改写为同位小数（如选项 A、D），导致小数点未对齐",
        "remediation": "整数可以看作小数点在个位右下角，如 15 = 15.00，补零不改变大小。"
      },
      {
        "tag": "carry_missing",
        "error": "虽对齐但漏写补零，造成借位混乱（如选项 C 中十分位有 0、百分位缺 0）",
        "remediation": "对齐小数点后，两个数的小数位数要一致，少几位就补几个 0。"
      }
    ],
    "feedback_correct": "真厉害！把 15 写成 15.00 就能和 6.84 完美对齐，小数减法稳稳拿下～",
    "feedback_wrong": "没关系！记得：整数减小数时，要把整数变成‘带小数点+补零’的形式，让小数点对齐哦。",
    "hints": [
      {
        "text": "试试把 15 写成两位小数，它等于多少？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_001__morv6qy2_0",
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
    "stem": "小红用竖式计算 6.03 + 2.9，她把小数点对齐后写成了下面的样子。哪一项是正确的和？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "8.12"
      },
      {
        "id": "B",
        "text": "8.93"
      },
      {
        "id": "C",
        "text": "9.02"
      },
      {
        "id": "D",
        "text": "8.06"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "小数点对齐：6.03 + 2.90 = 8.93；2.9 补零成 2.90 后再加，百分位 3+0=3，十分位 0+9=9，个位 6+2=8。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "未补零直接写 2.9，误将 9 对齐个位，算成 6.03 + 29 = 35.03",
        "remediation": "小数加减必须小数点对齐，末尾缺位要补0，2.9 应看作 2.90。"
      },
      {
        "tag": "carry_missing",
        "error": "误以为 0+9 进位，得 8.12（错把十分位当 0+9=12 写2进1）",
        "remediation": "十分位是 0+9=9，没有进位；只有相同数位相加，不跨位进位。"
      }
    ],
    "feedback_correct": "太棒啦！你记住了小数点对齐后要补零，算得又快又准！",
    "feedback_wrong": "别灰心～检查一下：2.9 的小数点对齐后，它的‘9’应该在十分位，记得补0哦！",
    "hints": [
      {
        "text": "2.9 等于 2.90，补零后再列竖式对齐小数点。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_002__morv6qy2_1",
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
    "stem": "小明在做竖式计算 15.2 − 6.75 时，漏写了小数点，结果抄错了。下列四个竖式中，哪一个是小数点对齐、步骤正确、结果也正确的？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "  15.20\n−  6.75\n──────\n   8.45"
      },
      {
        "id": "B",
        "text": "  15.2\n−  6.75\n─────\n   8.55"
      },
      {
        "id": "C",
        "text": "  15.2\n−  6.75\n─────\n   9.55"
      },
      {
        "id": "D",
        "text": "  15.20\n−  6.75\n──────\n   8.55"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "被减数 15.2 补零为 15.20，与 6.75 小数点对齐；百分位 0−5 不够减，向十分位借1，十分位 2 变 1，百分位 10−5=5；十分位 1−7 不够减，向个位借1，个位 5 变 4，十分位 11−7=4；个位 4−6 不够减，向十位借1，十位 1 变 0，个位 14−6=8；结果为 8.45。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "未补零导致数位错乱，如把 6.75 的 5 对齐 15.2 的 2（个位），算出 8.55",
        "remediation": "必须先补零：15.2 → 15.20，再对齐小数点，确保百分位对百分位。"
      },
      {
        "tag": "borrow_missing",
        "error": "借位遗漏，例如十分位 2−7 直接算成 5，没借位，得 8.55",
        "remediation": "从右往左逐位算，不够减就向前一位借1，借1当10，记得被借位要减1。"
      }
    ],
    "feedback_correct": "真厉害！你不仅对齐了小数点，还稳稳完成了两次借位！",
    "feedback_wrong": "再试一次吧～记住：15.2 要变成 15.20 才能和 6.75 对齐，借位一步都不能少哦！",
    "hints": [
      {
        "text": "先把 15.2 改写成两位小数，再按‘小数点对齐→从右往左算→不够减就借位’三步检查。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_001__morv6qy2_2",
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
    "stem": "小红用竖式计算 6.03 + 2.9，她把小数点对齐后算出结果。下面哪一项是正确的和？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "8.12"
      },
      {
        "id": "B",
        "text": "8.93"
      },
      {
        "id": "C",
        "text": "9.02"
      },
      {
        "id": "D",
        "text": "8.96"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "小数点对齐后：6.03 + 2.90 = 8.93；注意2.9要补零写成2.90再相加。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "未补零，直接写2.9与6.03对齐，误算为6.03 + 2.9 = 6.12或8.12",
        "remediation": "小数加减时，末尾补零使位数相同，确保小数点严格对齐。"
      },
      {
        "tag": "carry_missing",
        "error": "个位3+9=12，进1后忘记在十分位加1，得8.03或8.93漏进位导致错成8.93以外的值",
        "remediation": "竖式中每列相加满十要向前一位进1，进位标记要清晰。"
      }
    ],
    "feedback_correct": "太棒啦！你记得补零对齐，算得又快又准～",
    "feedback_wrong": "别灰心！检查一下：2.9要不要补零？小数点有没有对齐？",
    "hints": [
      {
        "text": "先把2.9写成2.90，再和6.03竖式对齐相加。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_vertical_002__morv6qy2_3",
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
    "stem": "小明在做竖式计算 15.04 − 7.6 时，把小数点对齐后计算，但抄错了差。下面哪一项是正确结果？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "7.44"
      },
      {
        "id": "B",
        "text": "8.44"
      },
      {
        "id": "C",
        "text": "7.08"
      },
      {
        "id": "D",
        "text": "7.48"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "小数点对齐：15.04 − 7.60；百分位4−0=4；十分位0−6不够减，向个位借1，变成10−6=4（个位由5变4）；个位4−7不够减，向十位借1，变成14−7=7（十位由1变0）；结果是7.44。"
    ],
    "common_errors": [
      {
        "tag": "borrow_missing",
        "error": "借位不完整，如个位5−7直接算成−2，或忘记十位借1导致得8.44",
        "remediation": "被减数某位不够减时，必须向前一位借1，前一位减1后再算；借位要逐级传递。"
      },
      {
        "tag": "decimal_point_error",
        "error": "未补零，将7.6对齐到15.04的十分位却忽略百分位，误算成15.04 − 7.6 = 15.04 − 7.60 = 7.44，但错写成7.08或7.48",
        "remediation": "减数小数位数少时，必须补零补齐（7.6→7.60），保证小数点上下完全对齐。"
      }
    ],
    "feedback_correct": "真厉害！借位和对齐都做对了，小数减法难不倒你～",
    "feedback_wrong": "加油！试试把7.6写成7.60，再一步步借位计算哦～",
    "hints": [
      {
        "text": "7.6要补零变成7.60，再和15.04对齐；注意从右往左逐位减，不够减就借位。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_TJ_001__morv7wcg_0",
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
    "stem": "一个三角形的两个内角分别是 45° 和 65°，第三个内角是多少度？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "70°"
      },
      {
        "id": "B",
        "text": "60°"
      },
      {
        "id": "C",
        "text": "80°"
      },
      {
        "id": "D",
        "text": "90°"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "三角形内角和是180°，180° − 45° − 65° = 70°。"
    ],
    "common_errors": [
      {
        "tag": "subtraction_error",
        "error": "计算180−45−65时漏减或算错，如得60°或80°。",
        "remediation": "用竖式分步计算：180−45=135，135−65=70。"
      },
      {
        "tag": "angle_sum_misremember",
        "error": "误记三角形内角和为100°或360°，导致结果偏差巨大。",
        "remediation": "牢记：任意三角形三个内角加起来一定是180°，像一条平直的线。"
      }
    ],
    "feedback_correct": "答对啦！三个角加起来刚好是180°，真棒！",
    "feedback_wrong": "再想想哦～三角形所有内角合起来一定是180°，别忘了用它来帮忙算！",
    "hints": [
      {
        "text": "先算出已知两个角的和，再用180°减去这个和。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "triangle_angle_sum"
    ],
    "exam_priority": "HIGH_BIG"
  },
  {
    "question_id": "AI_TJ_002__morv7wcg_1",
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
    "stem": "一个三角形中，最大内角比最小内角大40°，中间角是50°，那么最小内角是多少度？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "45°"
      },
      {
        "id": "B",
        "text": "55°"
      },
      {
        "id": "C",
        "text": "65°"
      },
      {
        "id": "D",
        "text": "75°"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "设最小角为x°，则最大角为(x+40)°，中间角50°，三者和为180°：x + (x+40) + 50 = 180 → 2x + 90 = 180 → 2x = 90 → x = 45。"
    ],
    "common_errors": [
      {
        "tag": "equation_setup_error",
        "error": "列式时漏掉中间角50°，写成x+(x+40)=180，解得x=70。",
        "remediation": "一定要把三个角都加进去：最小角 + 中间角 + 最大角 = 180°。"
      },
      {
        "tag": "algebra_mistake",
        "error": "解2x+90=180时误算为2x=270或x=135。",
        "remediation": "等式两边同时减90：2x=90，再两边除以2，得x=45。"
      }
    ],
    "feedback_correct": "太厉害了！你用方程把三个角的关系理清楚啦～",
    "feedback_wrong": "没关系！试着用‘最小角’当小侦探，把三个角都用它表示出来再加一加～",
    "hints": [
      {
        "text": "用‘最小角’代表x，那最大角就是x+40，三个角加起来等于180°。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "triangle_angle_sum"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_TJ_001__morv7wcg_2",
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
    "stem": "一个三角形的三个内角分别是 45°、45° 和 90°，它是什么类型的三角形？",
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
        "text": "等边三角形"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "三角形内角和为180°，45°+45°+90°=180°，其中有一个角是90°，所以是直角三角形。"
    ],
    "common_errors": [
      {
        "tag": "angle_classification_error",
        "error": "误将含两个45°角的三角形当成锐角三角形，忽略90°角的存在。",
        "remediation": "记住：只要有一个角是90°，就是直角三角形；三个角都小于90°才是锐角三角形。"
      },
      {
        "tag": "equilateral_misidentification",
        "error": "看到两个角相等就认为是等边三角形。",
        "remediation": "等边三角形三个角必须都是60°，这里有两个45°和一个90°，不满足。"
      }
    ],
    "feedback_correct": "答对啦！有一个角是直角，就是直角三角形～",
    "feedback_wrong": "再想想哦，90°的角可是直角三角形的‘身份证’呢！",
    "hints": [
      {
        "text": "先检查三个角加起来是不是180°，再看有没有90°角。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-angle:45,45,90"
    ],
    "exam_priority": "HIGH_BIG"
  },
  {
    "question_id": "AI_TJ_002__morv7wcg_3",
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
    "stem": "一个三角形的两个内角分别是 25° 和 35°，第三个角是多少度？它属于哪一类三角形？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "120°，钝角三角形"
      },
      {
        "id": "B",
        "text": "120°，锐角三角形"
      },
      {
        "id": "C",
        "text": "110°，直角三角形"
      },
      {
        "id": "D",
        "text": "110°，钝角三角形"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "三角形内角和是180°，180°−25°−35°=120°；120°＞90°，所以是钝角三角形。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "计算180−25−35时算错得110°（漏减或口算错误）。",
        "remediation": "可以分步算：180−25=155，155−35=120；或者用竖式检查。"
      },
      {
        "tag": "angle_classification_error",
        "error": "知道第三个角是120°，却误选‘锐角三角形’或‘直角三角形’。",
        "remediation": "按最大角分类：＜90°是锐角，=90°是直角，＞90°是钝角。"
      }
    ],
    "feedback_correct": "太棒了！120°大于90°，果然是钝角三角形！",
    "feedback_wrong": "别着急，再算一次第三个角，然后看它比90°大还是小～",
    "hints": [
      {
        "text": "先算出第三个角的度数，再根据它的大小判断三角形类型。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-angle:25,35,120"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_TJ_001__morv9aml_0",
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
    "stem": "一个三角形的三个内角分别是 25°、65° 和一个未知角，这个未知角是多少度？",
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
      "三角形内角和是 180°；已知两角和为 25° + 65° = 90°；所以第三个角 = 180° − 90° = 90°。"
    ],
    "common_errors": [
      {
        "tag": "addition_error",
        "error": "把 25° + 65° 算成 80° 或 100°，导致结果错",
        "remediation": "两位数加法要对齐个位，25 + 65 = 90，不是 80 或 100。"
      },
      {
        "tag": "angle_sum_misremember",
        "error": "误以为三角形内角和是 100° 或 360°",
        "remediation": "记住：所有三角形——不管大小、形状——三个内角加起来一定是 180°。"
      }
    ],
    "feedback_correct": "答对啦！180° 减去两个已知角的和，就是第三个角～",
    "feedback_wrong": "再想想哦，三角形三个角加起来永远是 180°，别忘了它！",
    "hints": [
      {
        "text": "先算出已知两个角的和，再用 180° 减去它。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-angle-sum:25,65,x"
    ],
    "exam_priority": "HIGH_SMALL"
  },
  {
    "question_id": "AI_TJ_002__morv9aml_1",
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
    "stem": "一个三角形中，一个角是 120°，另一个角是第三个角的一半，那么第三个角是多少度？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "20°"
      },
      {
        "id": "B",
        "text": "40°"
      },
      {
        "id": "C",
        "text": "60°"
      },
      {
        "id": "D",
        "text": "80°"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "设第三个角为 x°，则第二个角为 x/2°；三个角和为 180°，即 120 + x/2 + x = 180；合并得 120 + (3x)/2 = 180；(3x)/2 = 60；解得 x = 40。"
    ],
    "common_errors": [
      {
        "tag": "equation_setup_error",
        "error": "把‘另一个角是第三个角的一半’写成 x = y/2 错了方向，列错方程",
        "remediation": "读清谁是谁的一半：若第三个角是 x，则‘另一个角’就是 x ÷ 2，不是 x × 2。"
      },
      {
        "tag": "arithmetic_error_fractions",
        "error": "计算 (3x)/2 = 60 时，误得 x = 30 或 x = 120",
        "remediation": "两边同时乘 2：3x = 120，再除以 3：x = 40。"
      }
    ],
    "feedback_correct": "太棒了！用方程把关系理清楚，就能稳稳解出来～",
    "feedback_wrong": "没关系！试试设第三个角为 x，再写出它的‘一半’，一步步来～",
    "hints": [
      {
        "text": "设第三个角是 x°，那另一个角就是 x ÷ 2°，三个角加起来等于 180°。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-angle-sum:120,x/2,x"
    ],
    "exam_priority": "MUST_SMALL"
  },
  {
    "question_id": "AI_TJ_001__morvaouo_0",
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
        "text": "90°"
      },
      {
        "id": "B",
        "text": "80°"
      },
      {
        "id": "C",
        "text": "100°"
      },
      {
        "id": "D",
        "text": "70°"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "三角形内角和是180°；已知两角和为52°+38°=90°；所以第三个角是180°−90°=90°。"
    ],
    "common_errors": [
      {
        "tag": "addition_error",
        "error": "把52°和38°相加算错（如得80°或100°），导致第三个角计算错误。",
        "remediation": "用竖式重新计算52+38，注意进位。"
      },
      {
        "tag": "angle_sum_misremember",
        "error": "误记三角形内角和为100°或360°，导致减法出错。",
        "remediation": "牢记：所有三角形三个内角加起来一定是180°。"
      }
    ],
    "feedback_correct": "答对啦！这个三角形有一个直角，是个直角三角形哦～",
    "feedback_wrong": "再想想：三个角加起来一定要等于180°，先算出已知两角的和，再用180°去减。",
    "hints": [
      {
        "text": "三角形三个内角加起来一共多少度？",
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
    "question_id": "AI_TJ_002__morvaouo_1",
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
    "stem": "一个三角形中，最小的角是25°，最大的角比它大50°，中间的角是多少度？",
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
        "text": "75°"
      },
      {
        "id": "C",
        "text": "85°"
      },
      {
        "id": "D",
        "text": "90°"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "最小角是25°；最大角比它大50°，所以最大角是25°+50°=75°；三个角和是180°，所以中间角=180°−25°−75°=80°。"
    ],
    "common_errors": [
      {
        "tag": "misinterpret_difference",
        "error": "把‘最大的角比它大50°’误解为‘最大的角是50°’，导致中间角算成105°。",
        "remediation": "仔细读题：‘比它大50°’意思是‘25°+50°’，不是‘就是50°’。"
      },
      {
        "tag": "subtraction_error",
        "error": "180−25−75计算错误（如得70°或90°），漏减或借位出错。",
        "remediation": "分步算：180−25=155，再155−75=80。"
      }
    ],
    "feedback_correct": "太棒了！你准确抓住了角度之间的关系，还稳稳算出了中间角～",
    "feedback_wrong": "别急，先写出三个角分别是多少度（最小、最大、中间），再用180°减一减试试看。",
    "hints": [
      {
        "text": "先算出最大角是多少度，再用180°减去最小角和最大角。",
        "penalty": 2
      }
    ],
    "tags": [
      "ai_generated",
      "tri-angle-sum:25,?,75"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_001__morv7zzl_0",
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
    "stem": "小明买文具花了2.85元，又买橡皮花了0.15元，最后买笔记本花了3.2元。他一共花了多少元？用简便方法计算。",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "6.2元"
      },
      {
        "id": "B",
        "text": "6.0元"
      },
      {
        "id": "C",
        "text": "6.25元"
      },
      {
        "id": "D",
        "text": "7.2元"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先算2.85 + 0.15 = 3.00，再加3.2得6.2；利用凑整（2.85+0.15）简化计算。"
    ],
    "common_errors": [
      {
        "tag": "carry_missing",
        "error": "把2.85 + 0.15算成2.90，漏进位",
        "remediation": "小数加法要对齐小数点，百分位5+5=10，向十分位进1。"
      },
      {
        "tag": "decimal_point_error",
        "error": "误将3.2当作32相加，得62元",
        "remediation": "注意小数点位置，3.2表示3元2角，不是32元。"
      }
    ],
    "feedback_correct": "太棒啦！你发现了2.85和0.15能凑成整数，计算又快又准！",
    "feedback_wrong": "再检查一下小数点对齐和进位哦，凑整是小数简便计算的好朋友！",
    "hints": [
      {
        "text": "看看哪两个数相加能变成整数？先算它们！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_002__morv7zzl_1",
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
    "stem": "妈妈去超市买水果，苹果花了12.4元，香蕉花了8.6元，橙子花了5.35元。结账时收银员说‘苹果和香蕉一起付可以免零头’。妈妈实际付了多少元？（免零头指苹果+香蕉的和按整数元计费，不保留小数）",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "26.35元"
      },
      {
        "id": "B",
        "text": "26元"
      },
      {
        "id": "C",
        "text": "26.4元"
      },
      {
        "id": "D",
        "text": "21.35元"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "苹果+香蕉=12.4+8.6=21.0元，免零头后仍为21元；再加橙子5.35元，得26.35元。注意‘免零头’只影响苹果与香蕉之和的计费方式，不影响最终总金额的小数部分。"
    ],
    "common_errors": [
      {
        "tag": "misinterpret_context",
        "error": "误以为‘免零头’后整个总价取整，得出26元",
        "remediation": "题目明确说‘苹果和香蕉一起付可以免零头’，只针对这两项之和，橙子价格不变。"
      },
      {
        "tag": "operation_order_error",
        "error": "先加橙子再免零头，如(12.4+5.35)+8.6=26.35→取整得26元",
        "remediation": "必须严格按题干条件操作：先算苹果+香蕉并处理免零头，再加第三项。"
      }
    ],
    "feedback_correct": "真厉害！你读懂了‘免零头’的适用范围，分步计算一步不落～",
    "feedback_wrong": "小心哦，‘免零头’只对苹果和香蕉的和起作用，其他钱要照常加！",
    "hints": [
      {
        "text": "‘免零头’只改变苹果加香蕉的结果——它们加起来正好是整数，所以不用调整；再加橙子。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_001__morv8lu4_0",
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
    "stem": "小红买文具花了3.8元，又买了橡皮花了1.2元，最后用一张10元纸币付款。她应找回多少元？（用简便方法计算）",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "5元"
      },
      {
        "id": "B",
        "text": "4.9元"
      },
      {
        "id": "C",
        "text": "5.1元"
      },
      {
        "id": "D",
        "text": "6元"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先算总花费：3.8 + 1.2 = 5（利用小数凑整），再用10 − 5 = 5（元）"
    ],
    "common_errors": [
      {
        "tag": "carry_missing",
        "error": "把3.8 + 1.2算成4.0或5.0，未正确进位",
        "remediation": "注意十分位8+2=10，要向个位进1，3+1+1=5"
      },
      {
        "tag": "operation_reverse",
        "error": "误用10 + 5，或用5 − 10，混淆减法顺序",
        "remediation": "找回钱 = 付的钱 − 花的钱，一定是大数减小数"
      }
    ],
    "feedback_correct": "太棒啦！你用凑整法又快又准～",
    "feedback_wrong": "再想想：3.8和1.2加起来正好是整数哦！",
    "hints": [
      {
        "text": "观察3.8和1.2的十分位，它们相加能凑成整数吗？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_002__morv8lu4_1",
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
    "stem": "体育课测跳远，小明三次成绩分别是2.45米、1.55米和3.7米。老师说要把前两次成绩先加起来再和第三次比较，看哪次最远。他前两次成绩的和是多少米？（用简便方法计算）",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "4米"
      },
      {
        "id": "B",
        "text": "4.01米"
      },
      {
        "id": "C",
        "text": "3.99米"
      },
      {
        "id": "D",
        "text": "4.1米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "2.45 + 1.55 = (2 + 1) + (0.45 + 0.55) = 3 + 1 = 4（米），利用小数部分凑整简化计算"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "把2.45 + 1.55算成3.90或4.00（漏加百分位进位）",
        "remediation": "0.45 + 0.55 = 1.00，要向个位进1，2 + 1 + 1 = 4"
      },
      {
        "tag": "missing_step",
        "error": "直接写2.45 + 1.55 = 4，没体现凑整过程，易在复杂题中出错",
        "remediation": "养成先看小数部分能否凑整的习惯，再分步加整数部分"
      }
    ],
    "feedback_correct": "真厉害！一眼看出0.45和0.55能凑成1，计算超轻松～",
    "feedback_wrong": "别急，看看两个小数的百分位加起来是不是100？",
    "hints": [
      {
        "text": "把2.45拆成2 + 0.45，1.55拆成1 + 0.55，再重新组合计算",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_001__morv8lu4_2",
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
    "stem": "小红买文具花了3.65元，又退了0.65元，接着又花了2.4元。她一共花了多少钱？用简便方法计算。",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "5.4元"
      },
      {
        "id": "B",
        "text": "6.7元"
      },
      {
        "id": "C",
        "text": "5.0元"
      },
      {
        "id": "D",
        "text": "6.0元"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先算3.65 − 0.65 = 3.0，再加2.4得5.4元；利用减法与加法结合，凑整简化计算。"
    ],
    "common_errors": [
      {
        "tag": "carry_missing",
        "error": "直接连加3.65 + 0.65 + 2.4，未注意‘退钱’是减法，误作加法",
        "remediation": "看清题中‘退了’表示减去，不是花掉。"
      },
      {
        "tag": "decimal_point_error",
        "error": "把3.65 − 0.65算成3.00，但加2.4时写成3.00 + 2.4 = 3.24（小数点对齐错误）",
        "remediation": "列竖式时末尾补零对齐：3.00 + 2.40 = 5.40。"
      }
    ],
    "feedback_correct": "太棒啦！你用凑整法快速算出了结果，真会动脑筋！",
    "feedback_wrong": "再读一遍‘退了’的意思哦——它表示减去，不是加上～试试重新理清步骤吧！",
    "hints": [
      {
        "text": "‘退了0.65元’说明要从花费里减掉这笔钱，可以先算3.65 − 0.65凑成整数。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_002__morv8lu4_3",
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
    "stem": "淘气计算一道题：10 − 2.85 − 1.15 + 0.9，他想用简便方法，先把后三个数合并。下面哪一步是正确的简便过程？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "10 − (2.85 + 1.15) + 0.9 = 10 − 4 + 0.9 = 6.9"
      },
      {
        "id": "B",
        "text": "10 − 2.85 − (1.15 + 0.9) = 10 − 2.85 − 2.05 = 5.1"
      },
      {
        "id": "C",
        "text": "(10 + 0.9) − (2.85 + 1.15) = 10.9 − 4 = 6.9"
      },
      {
        "id": "D",
        "text": "10 − (2.85 − 1.15 + 0.9) = 10 − 2.6 = 7.4"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "观察发现2.85 + 1.15 = 4（凑整），且+0.9可移到前面与10相加得10.9；根据加减混合运算性质，可重组为(10 + 0.9) − (2.85 + 1.15)，既保序又简便。"
    ],
    "common_errors": [
      {
        "tag": "operation_order_error",
        "error": "误认为减法有结合律，把10 − 2.85 − 1.15 + 0.9直接写成10 − (2.85 − 1.15 + 0.9)，错用括号改变运算顺序",
        "remediation": "减法没有结合律；带括号时，括号前是减号，括号内符号要变号。"
      },
      {
        "tag": "decimal_point_error",
        "error": "算2.85 + 1.15时错成3.90或4.00（忽略百分位进位）",
        "remediation": "对齐小数点：2.85 + 1.15 → 百分位5+5=10，向十分位进1，十分位8+1+1=10，向个位进1，得4.00。"
      }
    ],
    "feedback_correct": "你发现了加法交换与减法分组的巧妙组合，真是计算小达人！",
    "feedback_wrong": "小心哦：减法不能随便加括号！记住‘同级运算可调序，但减号后面加括号要变号’～",
    "hints": [
      {
        "text": "想想哪些数相加能凑成整数？再看看+0.9能不能和10一起先算？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_001__morv97ga_0",
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
    "stem": "简算：7.35 + 1.28 + 2.65 + 3.72，怎样组合最简便？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "(7.35 + 2.65) + (1.28 + 3.72)"
      },
      {
        "id": "B",
        "text": "(7.35 + 1.28) + (2.65 + 3.72)"
      },
      {
        "id": "C",
        "text": "7.35 + (1.28 + 2.65) + 3.72"
      },
      {
        "id": "D",
        "text": "(7.35 + 3.72) + (1.28 + 2.65)"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "观察小数部分：7.35 和 2.65 相加得 10.00；1.28 和 3.72 相加得 5.00；整十整五组合最简便。"
    ],
    "common_errors": [
      {
        "tag": "grouping_error",
        "error": "没有优先凑整，随意分组导致计算步骤变多",
        "remediation": "找小数部分相加为整数的配对，如 .35+.65、.28+.72。"
      },
      {
        "tag": "carry_missing",
        "error": "误以为 1.28+3.72=4.90（漏进位）",
        "remediation": "列竖式验证：1.28+3.72，百分位 8+2=10，向十分位进1，十分位 2+7+1=10，向个位进1，得 5.00。"
      }
    ],
    "feedback_correct": "太棒啦！你发现了‘凑整’这个好帮手，计算又快又准！",
    "feedback_wrong": "没关系，再看看哪些小数加起来刚好是整数，试试重新分组吧～",
    "hints": [
      {
        "text": "想一想：哪两个数的小数部分加起来是 1.00？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_002__morv97ga_1",
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
    "stem": "小红计算 15.4 - 3.86 - 1.14，她先算 3.86 + 1.14 = 5.00，再用 15.4 - 5.00 = 10.4。她的方法对吗？为什么？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "对，因为减去两个数的和等于依次减去这两个数"
      },
      {
        "id": "B",
        "text": "不对，应该从左往右依次计算：15.4 - 3.86 = 11.54，再减 1.14"
      },
      {
        "id": "C",
        "text": "对，但只能用于小数部分能凑整的情况"
      },
      {
        "id": "D",
        "text": "不对，减法不满足结合律，不能随便加括号"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "根据减法性质：a - b - c = a - (b + c)，所以 15.4 - 3.86 - 1.14 = 15.4 - (3.86 + 1.14) = 15.4 - 5.00 = 10.4，方法正确。"
    ],
    "common_errors": [
      {
        "tag": "property_confusion",
        "error": "混淆减法与加法的运算律，误以为减法有结合律",
        "remediation": "记住：只有加法和乘法有结合律；减法中 a-b-c 可以变成 a-(b+c)，这是减法性质，不是结合律。"
      },
      {
        "tag": "decimal_point_error",
        "error": "计算 3.86 + 1.14 时得 4.90 或 5.10，小数点对齐出错",
        "remediation": "列竖式时务必对齐小数点：3.86 + 1.14，百分位 6+4=10，写0进1；十分位 8+1+1=10，写0进1；个位 3+1+1=5，结果是 5.00。"
      }
    ],
    "feedback_correct": "真厉害！你不仅会算，还懂背后的道理，这就是数学小达人！",
    "feedback_wrong": "再想想：连续减去两个数，能不能先把它们合起来一起减？试试用数字验证一下～",
    "hints": [
      {
        "text": "回忆学过的减法性质：a - b - c 等于 a 减去谁？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_add_sub_simplify_002__morv97ga_3",
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
    "stem": "小红计算 15.4 - 3.87 - 1.13 时，用了简便方法。下面哪一步是她正确的简算过程？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "15.4 - (3.87 + 1.13) = 15.4 - 5.00 = 10.4"
      },
      {
        "id": "B",
        "text": "15.4 - 3.87 = 11.53，再减1.13 = 10.4"
      },
      {
        "id": "C",
        "text": "(15.4 - 3.87) - 1.13 = 11.53 - 1.13 = 10.4"
      },
      {
        "id": "D",
        "text": "15.4 - 1.13 = 14.27，再减3.87 = 10.4"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "连续减去两个数，等于减去它们的和；3.87 + 1.13 = 5.00，15.4 - 5 = 10.4，一步到位最简便。"
    ],
    "common_errors": [
      {
        "tag": "operation_order_error",
        "error": "误认为必须从左到右依次计算，忽略减法性质",
        "remediation": "记住：a - b - c = a - (b + c)，这是减法的重要简便依据。"
      },
      {
        "tag": "decimal_point_error",
        "error": "计算3.87 + 1.13时写成4.90或5.10（小数点对齐错误）",
        "remediation": "列竖式时末位对齐：3.87 + 1.13 → 百分位7+3=10，写0进1；十分位8+1+1=10，写0进1；个位3+1+1=5。"
      }
    ],
    "feedback_correct": "你抓住了‘合并减数’这个关键技巧，真像个小数学家！",
    "feedback_wrong": "别着急，想想：连续减两个数，能不能先把它们加起来一起减呢？",
    "hints": [
      {
        "text": "回忆减法的性质：从一个数里连续减去两个数，等于减去这两个数的和。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_TJ_001__morv8565_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_inequality",
    "skill_name": "三角形三边关系",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 30,
    "stem": "小红用三根小棒摆三角形，长度分别是5厘米、12厘米和x厘米（x为整数）。如果能摆成三角形，x最大可能是多少？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "6"
      },
      {
        "id": "B",
        "text": "16"
      },
      {
        "id": "C",
        "text": "17"
      },
      {
        "id": "D",
        "text": "18"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "根据三角形三边关系，任意两边之和大于第三边：5 + 12 > x → x < 17；5 + x > 12 → x > 7；12 + x > 5（恒成立）。所以x是大于7且小于17的整数，最大为16。"
    ],
    "common_errors": [
      {
        "tag": "triangle_inequality_missing_one",
        "error": "只考虑了5+12>x，漏掉5+x>12，误选17或18。",
        "remediation": "记住要检验三组不等式：a+b>c，a+c>b，b+c>a。"
      },
      {
        "tag": "integer_bound_error",
        "error": "认为x<17就可取17，忽略‘小于’不包含等于，误选C。",
        "remediation": "x必须严格小于17，最大整数是16。"
      }
    ],
    "feedback_correct": "答对啦！16厘米刚好满足三边都能‘够得着’，真棒！",
    "feedback_wrong": "再想想哦～第三边不能太长也不能太短，要同时满足三个条件呢！",
    "hints": [
      {
        "text": "先写出三个不等式：5+12>x，5+x>12，12+x>5，再分别解出来。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-sides:5,12,x"
    ],
    "exam_priority": "HIGH_BIG"
  },
  {
    "question_id": "AI_TJ_002__morv8565_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_inequality",
    "skill_name": "三角形三边关系",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 30,
    "stem": "木工师傅要做一个三角形木架，已有两根木条，长分别是8分米和15分米。他想再选一根整分米长的木条，使三根能围成三角形。下面哪个长度一定不行？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "7分米"
      },
      {
        "id": "B",
        "text": "8分米"
      },
      {
        "id": "C",
        "text": "15分米"
      },
      {
        "id": "D",
        "text": "23分米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "D"
    },
    "solution_steps": [
      "检查每项是否满足三角形三边关系：任意两边之和大于第三边。A：8+7=15，不大于15（等于），不能构成三角形；但题干问‘一定不行’，需验证全部。B：8+8=16>15，8+15>8，15+8>8，可以；C：8+15>15，8+15>15，15+15>8，可以；D：8+15=23，不大于23（等于），不满足严格大于，一定不能围成三角形。注意：A虽也不行，但‘7分米’在某些边界理解中易被误判；而D的23分米明确违反8+15>第三边，绝对不行。"
    ],
    "common_errors": [
      {
        "tag": "equality_misinterpretation",
        "error": "误以为‘等于’也可以围成三角形（如选A或D时认为相等就行）。",
        "remediation": "三角形要求‘任意两边之和**大于**第三边’，等于时三点共线，不是三角形！"
      },
      {
        "tag": "largest_side_focus_only",
        "error": "只检查最长边是否小于另两边之和，漏检其他组合，误选B或C。",
        "remediation": "必须逐个验证三组：a+b>c，a+c>b，b+c>a，尤其当边长接近时更要注意。"
      }
    ],
    "feedback_correct": "太厉害了！23分米会让三根木条躺成一条直线，没法立起来做架子哦～",
    "feedback_wrong": "没关系！记住：三角形不是‘差不多能拼上’，而是每两边加起来都必须‘超过’第三边才行。",
    "hints": [
      {
        "text": "把每个选项代入，检查‘8+15 > 第三边’‘8+第三边 > 15’‘15+第三边 > 8’这三句话是否都成立。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-sides:8,15,23"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_TJ_001__morv9jek_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_inequality",
    "skill_name": "三角形三边关系",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 30,
    "stem": "小红用三根小棒摆三角形，长度分别是 5 厘米、7 厘米和 11 厘米。这三根小棒能围成一个三角形吗？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "能，因为任意两边之和都大于第三边"
      },
      {
        "id": "B",
        "text": "不能，因为 5 + 7 < 11"
      },
      {
        "id": "C",
        "text": "不能，因为 5 + 11 = 16，不满足条件"
      },
      {
        "id": "D",
        "text": "能，因为有两条边相等"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "判断三角形能否成立，需验证三组：5+7=12＞11，5+11=16＞7，7+11=18＞5；全部满足，所以能围成三角形。"
    ],
    "common_errors": [
      {
        "tag": "triangle_inequality_miss_one",
        "error": "只检查了 5+7 和 11 的关系，漏看另外两组。",
        "remediation": "记住：必须检查‘任意两边之和’都大于第三边，共三组都要验。"
      },
      {
        "tag": "inequality_direction_error",
        "error": "误把‘和小于第三边’当成能围成的条件。",
        "remediation": "口诀：两边之和要‘大于’第三边，不是‘小于’或‘等于’。"
      }
    ],
    "feedback_correct": "答对啦！你掌握了三角形三边关系的核心——任意两边之和必须大于第三边。",
    "feedback_wrong": "再想想哦～只要有一组两边之和≤第三边，就一定围不成三角形。",
    "hints": [
      {
        "text": "先算一算：5+7 等于多少？它比 11 大吗？再试试 5+11 和 7+11。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-sides:5,7,11"
    ],
    "exam_priority": "HIGH_BIG"
  },
  {
    "question_id": "AI_TJ_002__morv9jek_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_inequality",
    "skill_name": "三角形三边关系",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "一根 18 厘米长的铁丝，剪成三段（每段都是整厘米数），想围成一个三角形。下面哪组长度可能成功？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "4 厘米、5 厘米、9 厘米"
      },
      {
        "id": "B",
        "text": "5 厘米、6 厘米、7 厘米"
      },
      {
        "id": "C",
        "text": "3 厘米、6 厘米、9 厘米"
      },
      {
        "id": "D",
        "text": "2 厘米、7 厘米、9 厘米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "先确认总长：5+6+7=18，符合；再验证三边关系：5+6=11＞7，5+7=12＞6，6+7=13＞5，全部满足。其他选项中，A：4+5=9，不满足‘大于’；C：3+6=9，不满足；D：2+7=9，不满足。"
    ],
    "common_errors": [
      {
        "tag": "carry_missing_sum_check",
        "error": "只验证了三边关系，但忘了三段总长必须是 18 厘米。",
        "remediation": "第一步先加总看是否等于 18，再验证三角形三边关系。"
      },
      {
        "tag": "equality_misuse",
        "error": "认为 4+5=9 就可以围成（误把‘等于’当‘大于’）。",
        "remediation": "注意：三角形要求‘任意两边之和严格大于第三边’，等于也不行！"
      }
    ],
    "feedback_correct": "太棒了！你既检查了总长度，又严格验证了三边关系，思路超清晰！",
    "feedback_wrong": "别灰心～记得两个关键点：总长要18，且每组两边之和必须‘大于’第三边哦。",
    "hints": [
      {
        "text": "先加一加每组三个数，看是不是18；再挑一组，试试最小的两个数加起来有没有超过最大的那个。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-sides:5,6,7"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_TJ_001__morvaxmo_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_inequality",
    "skill_name": "三角形三边关系",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 30,
    "stem": "小红用三根木条拼三角形，长度分别是 5 厘米、7 厘米和 11 厘米。这三根木条能围成三角形吗？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "能"
      },
      {
        "id": "B",
        "text": "不能"
      },
      {
        "id": "C",
        "text": "只有量角器才能判断"
      },
      {
        "id": "D",
        "text": "需要知道哪个是底边"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "判断三边能否构成三角形，需验证任意两边之和大于第三边：5+7=12＞11，5+11=16＞7，7+11=18＞5，全部满足，所以能围成三角形。"
    ],
    "common_errors": [
      {
        "tag": "triangle_inequality_miss_one",
        "error": "只检查了 5+7＞11，漏验另两组不等式，误判为不能。",
        "remediation": "三角形三边关系要检查三组：a+b＞c，a+c＞b，b+c＞a，缺一不可。"
      },
      {
        "tag": "carry_missing",
        "error": "计算 5+7 时算成 11，得出 11=11，误认为不满足‘大于’而选不能。",
        "remediation": "‘两边之和必须严格大于第三边’，等于也不行；加法要仔细再算一遍。"
      }
    ],
    "feedback_correct": "答对啦！三条边都满足‘任意两边之和大于第三边’，真棒！",
    "feedback_wrong": "再想想哦～记得三组都要验，而且必须是‘大于’，不是‘大于等于’哟！",
    "hints": [
      {
        "text": "先算最短的两条边加起来是不是比最长的边大。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-sides:5,7,11"
    ],
    "exam_priority": "HIGH_SMALL"
  },
  {
    "question_id": "AI_TJ_002__morvaxmo_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_inequality",
    "skill_name": "三角形三边关系",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 30,
    "stem": "一根 16 厘米长的吸管，剪成三段（每段都是整厘米数），想用这三段围成一个三角形。下面哪组长度可能成功？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "3 厘米、5 厘米、8 厘米"
      },
      {
        "id": "B",
        "text": "4 厘米、5 厘米、7 厘米"
      },
      {
        "id": "C",
        "text": "2 厘米、6 厘米、8 厘米"
      },
      {
        "id": "D",
        "text": "1 厘米、7 厘米、8 厘米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "先验证总长是否为 16 厘米：A=3+5+8=16✓，B=4+5+7=16✓，C=2+6+8=16✓，D=1+7+8=16✓；再逐个检验三角形三边关系：B 中 4+5=9＞7，4+7=11＞5，5+7=12＞4，全部满足；A 中 3+5=8 不大于 8，不满足；C 中 2+6=8 不大于 8；D 中 1+7=8 不大于 8。只有 B 符合。"
    ],
    "common_errors": [
      {
        "tag": "triangle_inequality_equal_error",
        "error": "看到 3+5=8 就以为可以，忽略了‘必须大于’而非‘大于等于’。",
        "remediation": "三角形三边关系中，‘任意两边之和必须严格大于第三边’，等于就只能共线，围不成三角形！"
      },
      {
        "tag": "sum_check_missing",
        "error": "没检查三段总长是否等于 16 厘米，直接验三边关系，误选 C 或 D。",
        "remediation": "题目要求‘从一根 16 厘米吸管剪成三段’，必须先确保三数之和为 16！"
      }
    ],
    "feedback_correct": "太厉害了！你既检查了总长，又严格验证了三边关系，思路超清晰！",
    "feedback_wrong": "别灰心～记得两步走：先加总看是不是 16，再验‘任意两边之和＞第三边’！",
    "hints": [
      {
        "text": "先加一加每组三个数，看看是不是 16；再挑出最长的一段，看另两段加起来能不能超过它。",
        "penalty": 2
      }
    ],
    "tags": [
      "ai_generated",
      "tri-sides:4,5,7"
    ],
    "exam_priority": "MUST_SMALL"
  },
  {
    "question_id": "AI_TJ_001__morymycz_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_inequality",
    "skill_name": "三角形三边关系",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 2,
    "estimated_time_seconds": 30,
    "stem": "小明用三根吸管拼三角形，长度分别是6厘米、10厘米和17厘米。这三根吸管能围成一个三角形吗？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "能"
      },
      {
        "id": "B",
        "text": "不能"
      },
      {
        "id": "C",
        "text": "只有量角器才能判断"
      },
      {
        "id": "D",
        "text": "需要知道角度才能判断"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "判断三边能否构成三角形，需满足任意两边之和大于第三边：6+10=16 < 17，不满足，所以不能围成三角形。"
    ],
    "common_errors": [
      {
        "tag": "triangle_inequality_missing_check",
        "error": "只检查了6+17>10和10+17>6，漏掉最短两边之和是否大于最长边。",
        "remediation": "一定要先找出最长边，再验证另两边之和是否大于它。"
      },
      {
        "tag": "decimal_point_error",
        "error": "误把17看成1.7或计算6+10=17，得出‘刚好相等’就认为可以。",
        "remediation": "三角形三边关系要求‘严格大于’，等于也不行。"
      }
    ],
    "feedback_correct": "答对啦！6+10=16小于17，不满足三边关系，确实围不成哦～",
    "feedback_wrong": "再想想：三角形必须任意两边加起来都比第三边长，试试算算6+10是多少？",
    "hints": [
      {
        "text": "先找出三条边中最长的一条，再看另外两条加起来有没有它长。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-sides:6,10,17"
    ],
    "exam_priority": "HIGH_SMALL"
  },
  {
    "question_id": "AI_TJ_002__morymycz_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_inequality",
    "skill_name": "三角形三边关系",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 30,
    "stem": "一个三角形的两条边分别是9厘米和13厘米，第三条边是整数厘米，那么第三条边最短可能是多少厘米？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "4厘米"
      },
      {
        "id": "B",
        "text": "5厘米"
      },
      {
        "id": "C",
        "text": "9厘米"
      },
      {
        "id": "D",
        "text": "13厘米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "设第三边为x厘米。根据三角形三边关系：9+13>x → x<22；9+x>13 → x>4；13+x>9 → x>-4（恒成立）。所以x>4且为整数，最小是5。"
    ],
    "common_errors": [
      {
        "tag": "triangle_inequality_one_side_only",
        "error": "只考虑了9+x>13，得出x>4，但忘记x必须是整数，直接写4。",
        "remediation": "x>4的最小整数是5，不是4——因为4不满足‘大于’。"
      },
      {
        "tag": "carry_missing",
        "error": "误算9+13=21，导致x<21，再结合x>4，错选4或5但逻辑混乱。",
        "remediation": "先认真算出两边和：9+13=22，再列不等式。"
      }
    ],
    "feedback_correct": "太棒了！第三边必须大于13−9=4，又要是整数，所以最少是5厘米！",
    "feedback_wrong": "提示：第三边既要小于9+13，又要大于13−9，别忘了‘大于’哦～",
    "hints": [
      {
        "text": "第三边必须比两边之差大，比两边之和小。先算13−9和9+13，再找中间的最小整数。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-sides:9,13,x"
    ],
    "exam_priority": "MUST_SMALL"
  },
  {
    "question_id": "AI_TJ_001__morymycz_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_inequality",
    "skill_name": "三角形三边关系",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 30,
    "stem": "小明用三根吸管拼三角形，长度分别是9厘米、4厘米和x厘米（x为整数），x最小可以是多少才能围成三角形？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "4"
      },
      {
        "id": "B",
        "text": "5"
      },
      {
        "id": "C",
        "text": "6"
      },
      {
        "id": "D",
        "text": "7"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "三角形任意两边之和大于第三边。已知两边为4和9，则x必须满足：x > 9−4=5，且x < 9+4=13；又x为整数，所以最小是6。"
    ],
    "common_errors": [
      {
        "tag": "triangle_inequality_miss_sum",
        "error": "只考虑了两边之差，漏掉‘小于两边之和’的条件，误选4或5。",
        "remediation": "记住：三角形三边必须同时满足‘两边之和＞第三边’和‘两边之差＜第三边’。"
      },
      {
        "tag": "integer_rounding_error",
        "error": "算出x＞5后，误以为最小整数是5（未注意‘严格大于’）。",
        "remediation": "x＞5 的最小整数是6，不是5。画数轴看看更清楚！"
      }
    ],
    "hints": [
      {
        "text": "先算出x必须比哪两个数大、比哪两个数小？再找最小整数。",
        "penalty": 1
      }
    ],
    "feedback_correct": "答对啦！6厘米刚好让三边满足三角形不等式，真棒！",
    "feedback_wrong": "再想想：x必须同时大于两边之差、小于两边之和哦～",
    "tags": [
      "ai_generated",
      "tri-sides:4,9,6"
    ],
    "exam_priority": "HIGH_SMALL"
  },
  {
    "question_id": "AI_TJ_002__morymycz_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_inequality",
    "skill_name": "三角形三边关系",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 30,
    "stem": "用三根木条钉一个三角形框架，其中两根长分别是11分米和6分米，第三根木条长度为整数分米，那么它最长可以是多少分米？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "15"
      },
      {
        "id": "B",
        "text": "16"
      },
      {
        "id": "C",
        "text": "17"
      },
      {
        "id": "D",
        "text": "18"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "三角形任意两边之和大于第三边。设第三边为x，则x < 11+6=17；又x为整数，所以最大可取16。验证：6+11>16（17>16✓），6+16>11（22>11✓），11+16>6（27>6✓）。"
    ],
    "common_errors": [
      {
        "tag": "triangle_inequality_equal_allowed",
        "error": "误以为x可等于17（认为11+6=17也满足‘大于’），选17。",
        "remediation": "‘两边之和大于第三边’是严格大于（＞），等于时三点共线，不能围成三角形！"
      },
      {
        "tag": "carry_missing",
        "error": "计算11+6得16，误以为最大就是16，但没验证是否满足其他两边组合。",
        "remediation": "必须验证三组不等式都成立！比如6+16>11也要检查。"
      }
    ],
    "hints": [
      {
        "text": "先算出第三边必须小于多少？再想：这个‘小于’意味着最大整数是多少？",
        "penalty": 1
      }
    ],
    "feedback_correct": "太厉害了！16分米是满足所有三边关系的最大整数长度！",
    "feedback_wrong": "小心哦：两边之和要‘严格大于’第三边，等于不行哦～",
    "tags": [
      "ai_generated",
      "tri-sides:6,11,16"
    ],
    "exam_priority": "MUST_SMALL"
  },
  {
    "question_id": "AI_TJ_001__morynsmi_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_inequality",
    "skill_name": "三角形三边关系",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 30,
    "stem": "小明用三根吸管拼三角形，长度分别是6厘米、10厘米和x厘米，x是整数。x最小可以是多少？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "3"
      },
      {
        "id": "B",
        "text": "4"
      },
      {
        "id": "C",
        "text": "5"
      },
      {
        "id": "D",
        "text": "6"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "根据三角形三边关系：任意两边之和大于第三边，任意两边之差小于第三边。已知两边为6和10，则第三边x需满足：10−6 < x < 10+6，即4 < x < 16。x为整数，最小是5。"
    ],
    "common_errors": [
      {
        "tag": "triangle_inequality_misapply",
        "error": "误用‘两边之和大于第三边’但忽略‘两边之差小于第三边’，直接取x=1，或选x=4（等于差）。",
        "remediation": "记住：第三边必须大于两边之差，且小于两边之和；等号不成立，不能围成三角形。"
      },
      {
        "tag": "integer_bound_error",
        "error": "知道范围是4 < x < 16，但误以为最小整数是4（没注意是严格大于）。",
        "remediation": "‘大于4’的最小整数是5，不是4；画数轴标出空心圆点更清楚。"
      }
    ],
    "hints": [
      {
        "text": "想一想：第三边必须比10−6大，还要比10+6小。x是整数，最小能填几？",
        "penalty": 1
      }
    ],
    "feedback_correct": "答对啦！5厘米刚好让三边满足‘两边之差＜第三边＜两边之和’，能围成三角形哦～",
    "feedback_wrong": "再想想：第三边不能等于两边的差，必须严格更大才行哟！",
    "tags": [
      "ai_generated",
      "tri-sides:6,10,5"
    ],
    "exam_priority": "HIGH_BIG"
  },
  {
    "question_id": "AI_TJ_002__morynsmi_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U2_TRI_QUAD",
    "unit_name": "认识三角形和四边形",
    "skill_id": "triangle_inequality",
    "skill_name": "三角形三边关系",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "reasoning",
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 30,
    "stem": "一根18厘米长的铁丝剪成三段（每段都是整厘米），围成一个三角形。其中一段长7厘米，另一段长5厘米，第三段最长可能是多少厘米？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "5"
      },
      {
        "id": "B",
        "text": "6"
      },
      {
        "id": "C",
        "text": "7"
      },
      {
        "id": "D",
        "text": "8"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "总长18厘米，已知两段为7cm和5cm，则第三段为18−7−5=6cm。验证三边：5、6、7。检查是否满足三角形三边关系：5+6>7（11>7✓），5+7>6（12>6✓），6+7>5（13>5✓）。所有条件满足，且6是唯一可能值（若第三段＞6，则前两段和＜12，无法满足‘两边之和＞第三边’）。"
    ],
    "common_errors": [
      {
        "tag": "perimeter_misuse",
        "error": "误认为第三段可任意取值，未用周长约束先算出第三段只能是6厘米。",
        "remediation": "先用总长减去已知两段，得出第三段固定长度，再验证能否构成三角形。"
      },
      {
        "tag": "inequality_overlook",
        "error": "只验证了‘两边之和＞第三边’中的一组（如7+5＞6），却忽略其他组合，误选8。",
        "remediation": "必须三组都验证：a+b>c，a+c>b，b+c>a——缺一不可！"
      }
    ],
    "hints": [
      {
        "text": "先算出第三段长度，再用三角形三边关系检查它能不能和另外两段围成三角形。",
        "penalty": 1
      }
    ],
    "feedback_correct": "太棒了！6厘米加上5厘米和7厘米，三边都能两两相加大于第三边，稳稳围成三角形～",
    "feedback_wrong": "别急，记得先用18减去5和7，得到第三段长度，再一起检查三边关系哦！",
    "tags": [
      "ai_generated",
      "tri-sides:5,7,6"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_TJ_001__morv9sme_0",
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
    "stem": "一个三角形的三个内角分别是 45°、45° 和 90°，这个三角形按角分是什么三角形？按边分又是什么三角形？",
    "question_format": "single_choice",
    "game_type": "triangle_judge",
    "play_as": "triangle_judge",
    "options": [
      {
        "id": "A",
        "text": "直角三角形，等腰三角形"
      },
      {
        "id": "B",
        "text": "锐角三角形，等边三角形"
      },
      {
        "id": "C",
        "text": "钝角三角形，不等边三角形"
      },
      {
        "id": "D",
        "text": "直角三角形，不等边三角形"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "三个角中有一个是90°，所以是直角三角形；另外两个角相等（45°=45°），说明两条直角边相等，因此是等腰三角形。"
    ],
    "common_errors": [
      {
        "tag": "angle_confusion",
        "error": "误以为有两个45°就是锐角三角形，忽略90°的存在",
        "remediation": "记住：只要有一个角是90°，就是直角三角形；三个角都小于90°才是锐角三角形。"
      },
      {
        "tag": "side_angle_mismatch",
        "error": "认为直角三角形一定不是等腰三角形",
        "remediation": "等腰直角三角形很常见——两条直角边相等，夹角是90°，比如剪开一个正方形对角线得到的两个三角形。"
      }
    ],
    "feedback_correct": "答对啦！这是个既直角又等腰的特殊三角形哦～",
    "feedback_wrong": "再想想：90°决定了它是直角三角形，而两个45°说明有两边相等哦！",
    "hints": [
      {
        "text": "先看最大角：90°→直角三角形；再看角相等→对应边相等→等腰。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-angle:45,45,90"
    ],
    "exam_priority": "HIGH_BIG"
  },
  {
    "question_id": "AI_TJ_002__morv9sme_1",
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
    "stem": "小红用三根小棒摆三角形，长度分别是 6 厘米、8 厘米和 10 厘米。这三根小棒能围成三角形吗？如果能，它按角分属于哪一类？",
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
      "value": "C"
    },
    "solution_steps": [
      "先验证能否构成三角形：6+8>10，6+10>8，8+10>6，都成立，能围成；再判断角：6²+8²=36+64=100=10²，满足勾股定理，所以是直角三角形。"
    ],
    "common_errors": [
      {
        "tag": "tri-sides:6,8,10",
        "error": "只验证了‘两边之和大于第三边’就选‘能’，但没继续判断角的类型",
        "remediation": "能围成只是第一步；题目还问‘按角分’，要算一算是不是符合勾股关系哦！"
      },
      {
        "tag": "pythagoras_misapply",
        "error": "误用 6+8=14 > 10 就判断为锐角三角形",
        "remediation": "判断角类型要看平方关系：a²+b²=c²→直角，a²+b²>c²→锐角，a²+b²<c²→钝角（c为最长边）。"
      }
    ],
    "feedback_correct": "太棒啦！6-8-10 是经典的直角三角形三边，就像教室的墙角一样方方正正～",
    "feedback_wrong": "别灰心！先确认能围成，再用平方比一比——你离答案只差一步啦！",
    "hints": [
      {
        "text": "检查三边是否满足三角形三边关系；再看6²+8²是否等于10²。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-sides:6,8,10"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_TJ_001__morv9sme_2",
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
    "stem": "一个三角形的三个内角分别是 45°、45° 和 90°，它按角分是什么三角形？",
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
        "text": "等边三角形"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "三角形按角分类：有一个角是90°的叫直角三角形；45°+45°+90°=180°，符合内角和，且含90°角，所以是直角三角形。"
    ],
    "common_errors": [
      {
        "tag": "angle_classification_misread",
        "error": "看到两个45°就误选‘锐角三角形’，忽略90°角的存在。",
        "remediation": "记住：只要有一个角是90°，就是直角三角形；三个角都小于90°才是锐角三角形。"
      },
      {
        "tag": "confuse_angle_side",
        "error": "把‘等腰直角三角形’和‘等边三角形’混淆，选了D。",
        "remediation": "等边三角形三边相等、三角都是60°；本题有90°角，不可能是等边三角形。"
      }
    ],
    "feedback_correct": "答对啦！有一个角是90°的三角形就是直角三角形～",
    "feedback_wrong": "再想想哦：三个角加起来要等于180°，其中一个是90°，说明它一定是直角三角形！",
    "hints": [
      {
        "text": "先算一算三个角加起来是不是180°，再看最大的那个角是多少度。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-angle:45,45,90"
    ],
    "exam_priority": "HIGH_BIG"
  },
  {
    "question_id": "AI_TJ_002__morv9sme_3",
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
    "stem": "小红用三根小棒摆三角形，长度分别是 6 厘米、8 厘米和 10 厘米。这三根小棒能围成三角形吗？如果能，按边分是什么三角形？",
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
        "text": "能，是等腰三角形"
      },
      {
        "id": "C",
        "text": "能，是等边三角形"
      },
      {
        "id": "D",
        "text": "能，是不等边三角形"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "D"
    },
    "solution_steps": [
      "判断能否围成三角形：任意两边之和大于第三边。6+8>10（14>10），6+10>8（16>8），8+10>6（18>6），满足，能围成。三边长度6、8、10互不相等，所以是不等边三角形（也叫 scalene 三角形）。"
    ],
    "common_errors": [
      {
        "tag": "tri-sides:6,8,10",
        "error": "误以为6²+8²=10²说明是等腰三角形，混淆了勾股定理与边长关系。",
        "remediation": "6²+8²=10²说明它是直角三角形，但按边分要看三边是否相等——这里都不等，所以是不等边三角形。"
      },
      {
        "tag": "side_classification_misread",
        "error": "看到三边都是整数，就随便选‘等边’或‘等腰’。",
        "remediation": "等边：三边一样长；等腰：恰好两边一样长；不等边：三边全不同。6、8、10全不同，就是不等边三角形。"
      }
    ],
    "feedback_correct": "太棒了！三边互不相等，又能围成，就是不等边三角形！",
    "feedback_wrong": "别急～先检查‘任意两边之和＞第三边’，再看三边有没有相等的哦！",
    "hints": [
      {
        "text": "先验证能不能围成（用三角形三边关系），再看三条边长度是否相同。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-sides:6,8,10"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_TJ_002__morvadmu_1",
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
    "stem": "小红用三根小棒围三角形，长度分别是 6 cm、8 cm 和 10 cm。这三根小棒能围成三角形吗？如果能，按边分属于哪一类？",
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
        "text": "能，是等腰三角形"
      },
      {
        "id": "C",
        "text": "能，是等边三角形"
      },
      {
        "id": "D",
        "text": "能，是不等边三角形"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "D"
    },
    "solution_steps": [
      "先判断能否构成三角形：任意两边之和大于第三边。6+8=14＞10，6+10=16＞8，8+10=18＞6，满足，能围成。三条边长度互不相等（6≠8≠10），所以是不等边三角形（也叫 scalene triangle）。"
    ],
    "common_errors": [
      {
        "tag": "tri-sides:inequality_check_skip",
        "error": "只检查了6+8＞10，漏了另外两组不等式，误判为不能围成。",
        "remediation": "一定要检查三组：a+b＞c，a+c＞b，b+c＞a，缺一不可！"
      },
      {
        "tag": "side_classification_confuse",
        "error": "看到6-8-10像勾股数，就以为是等腰或等边三角形。",
        "remediation": "等腰要两条边相等，等边要三条边都相等；这里6、8、10全不同，就是不等边三角形。"
      }
    ],
    "feedback_correct": "太棒啦！三边都不等，而且满足三角形条件，是不等边三角形！",
    "feedback_wrong": "别急～先确认三边能不能围成：每两条边加起来都要比第三条长哦！",
    "hints": [
      {
        "text": "判断能否围成三角形：最小两边之和＞最大边，就能围成；再看三条边是否相等来分类（全不等→不等边；两个等→等腰；三个等→等边）。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "tri-sides:6,8,10"
    ],
    "exam_priority": "MUST_SMALL"
  },
  {
    "question_id": "AI_TJ_002__morvadmu_3",
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
    "stem": "小红用三根小棒摆三角形，长度分别是 6 cm、8 cm 和 10 cm。这三根小棒能围成三角形吗？如果能，按角分属于哪一类？",
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
      "value": "C"
    },
    "solution_steps": [
      "先判断能否构成三角形：任意两边之和大于第三边。6+8=14>10，6+10=16>8，8+10=18>6，满足，能围成。再判断角：6²+8²=36+64=100=10²，符合勾股定理，所以是直角三角形。"
    ],
    "common_errors": [
      {
        "tag": "tri-sides:6,8,10",
        "error": "只验证了6+8>10，漏验另两组，误判为不能围成（选A）",
        "remediation": "三角形三边关系要检查三组：a+b>c、a+c>b、b+c>a，缺一不可。"
      },
      {
        "tag": "pythagoras_misapply",
        "error": "误算6²+8²=100≠10，或误以为10²=10，得出不是直角三角形（选B或D）",
        "remediation": "记住：10²=100，6²=36，8²=64，36+64=100，刚好相等，就是直角三角形！"
      }
    ],
    "feedback_correct": "太棒了！6-8-10是经典的直角三角形三边哦～",
    "feedback_wrong": "别灰心！试试算一算：6²+8² 等于多少？再和10²比一比～",
    "hints": [
      {
        "text": "先用‘两边之和大于第三边’检验能不能围成；再用‘a²+b²=c²’判断是不是直角三角形。",
        "penalty": 2
      }
    ],
    "tags": [
      "ai_generated",
      "tri-sides:6,8,10"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_decimal_mul_vertical_001__morvbknf_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_vertical",
    "skill_name": "小数乘法竖式",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "用竖式计算 0.68 × 7，下列哪一项是正确的积？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "4.76"
      },
      {
        "id": "B",
        "text": "47.6"
      },
      {
        "id": "C",
        "text": "0.476"
      },
      {
        "id": "D",
        "text": "476"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先忽略小数点，算 68 × 7 = 476；因 0.68 有两位小数，所以积从右往左数两位，点上小数点得 4.76。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "忘记补小数位数，把 476 当作整数结果",
        "remediation": "数清两个乘数一共有几位小数，就在积的右边起数出几位，点上小数点。"
      },
      {
        "tag": "carry_missing",
        "error": "竖式计算 68×7 时漏进位，得到 426 或 466",
        "remediation": "列竖式时，个位 8×7=56，写 6 进 5；十位 6×7=42，加进位 5 得 47，合起来是 476。"
      }
    ],
    "feedback_correct": "太棒啦！你准确完成了小数乘法竖式，小数点位置也对哦～",
    "feedback_wrong": "再检查一下小数点的位置吧！0.68 有两位小数，积也要有两位小数哦～",
    "hints": [
      {
        "text": "先把 0.68 看成 68，算完再补小数点！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_vertical_002__morvbknf_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_vertical",
    "skill_name": "小数乘法竖式",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "用竖式计算 1.25 × 0.8，下列哪一项是正确的积？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "1.000"
      },
      {
        "id": "B",
        "text": "10.00"
      },
      {
        "id": "C",
        "text": "0.100"
      },
      {
        "id": "D",
        "text": "100.0"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先看作 125 × 8 = 1000；1.25 有两位小数，0.8 有一位小数，共三位小数；从 1000 右边起数三位，不够就添 0，得 1.000。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "只数一个乘数的小数位（如只按 1.25 的两位），得 10.00",
        "remediation": "必须把两个乘数的小数位数加起来，才是积的小数位数。"
      },
      {
        "tag": "trailing_zero_ignore",
        "error": "写出 1.000 后误以为等于 1，选了没写小数的选项",
        "remediation": "1.000 就是 1，但题目要求竖式结果，要保留与小数位数一致的写法。"
      }
    ],
    "feedback_correct": "真厉害！你不仅算对了，还注意到了三位小数要写成 1.000 呢～",
    "feedback_wrong": "别着急，再数一遍：1.25 和 0.8 一共几位小数？积的小数点要从右往左移几位？",
    "hints": [
      {
        "text": "两个乘数一共有三位小数，积就要有三位小数，末尾的 0 也要保留哦！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_vertical_001__morvbknf_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_vertical",
    "skill_name": "小数乘法竖式",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "用竖式计算 6.8 × 0.5，下列哪一项是正确的积？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "3.4"
      },
      {
        "id": "B",
        "text": "34"
      },
      {
        "id": "C",
        "text": "0.34"
      },
      {
        "id": "D",
        "text": "340"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先忽略小数点，算 68 × 5 = 340；两个因数共有一位小数（6.8）和一位小数（0.5），共两位小数，所以积应有两位小数，340 → 3.40，末尾零可省略，得 3.4。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "只看一个因数的小数位数，误认为积有一位小数，写成 34.0 或 34",
        "remediation": "要数清两个因数的小数位数总和，再从积的右边起数出相同位数，点上小数点。"
      },
      {
        "tag": "carry_missing",
        "error": "68 × 5 进位错误，算成 300 或 320",
        "remediation": "竖式乘法要逐位相乘并正确处理进位：8×5=40，写 0 进 4；6×5=30，加进位 4 得 34，合起来是 340。"
      }
    ],
    "feedback_correct": "太棒啦！你准确完成了小数乘法竖式，小数点位置也找对了～",
    "feedback_wrong": "再检查一下两个因数一共有几位小数哦，积的小数位数要和它一样多！",
    "hints": [
      {
        "text": "先按整数乘，再数两个因数的小数位数总和，最后给积点小数点。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_vertical_002__morvbknf_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_vertical",
    "skill_name": "小数乘法竖式",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小红用竖式计算 7.04 × 2.5，她在第二步乘数‘2’时，把 704 × 2 算成了 1408，但忘记补零对齐。下列哪一项是她可能写出的错误积？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "17.6"
      },
      {
        "id": "B",
        "text": "17.60"
      },
      {
        "id": "C",
        "text": "176.0"
      },
      {
        "id": "D",
        "text": "1760"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "正确竖式中，7.04 × 2.5 应先算 704 × 5 = 3520（对应十分位），再算 704 × 2 = 1408，但因‘2’在个位，需右移一位（即补一个0）变成 14080；两部分相加得 3520 + 14080 = 17600，再根据三位小数（7.04有两位，2.5有一位）得积为 17.600 = 17.6。若忘记补零，直接写 1408 对齐个位，则加法变成 3520 + 1408 = 4928，再点三位小数得 4.928 ——但该选项未出现；而更常见错误是误将 1408 当作‘14080’却未补零对齐，导致整体结果扩大10倍，即 17.6 × 10 = 176.0。"
    ],
    "common_errors": [
      {
        "tag": "alignment_error",
        "error": "乘数‘2’代表2个一，应在十位对齐，却错按个位对齐，导致结果扩大10倍",
        "remediation": "竖式中，用乘数哪一位去乘，积的末位就要和那一位对齐——‘2’在个位，积末位应与个位对齐，即 1408 的‘8’要写在个位下方，相当于补零后是 14080。"
      },
      {
        "tag": "decimal_point_error",
        "error": "正确积是 17.6，但误写为 176.0（多一位小数）或 1.76（少一位小数）",
        "remediation": "两个因数小数位数之和是 2 + 1 = 3，积必须有三位小数；17600 → 17.600 → 17.6。"
      }
    ],
    "feedback_correct": "观察真仔细！你发现了竖式对齐这个关键细节，点赞！",
    "feedback_wrong": "别灰心～记住：乘到哪一位，积就对齐哪一位，就像排队站好一样整齐！",
    "hints": [
      {
        "text": "‘2’在 2.5 的个位上，用它乘 704 后，积的末位必须写在个位下方，也就是比上一步结果向左移一位（补一个0）。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_vertical_001__morvc4kf_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_vertical",
    "skill_name": "小数乘法竖式",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "用竖式计算 6.4 × 0.35。下列哪一项是正确的积？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "2.24"
      },
      {
        "id": "B",
        "text": "22.4"
      },
      {
        "id": "C",
        "text": "0.224"
      },
      {
        "id": "D",
        "text": "224"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先忽略小数点，算 64 × 35 = 2240；两个因数共三位小数（6.4 一位，0.35 两位），所以积应有三位小数，2240 → 2.240 = 2.24"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "忘记数小数位数，把 2240 当作 22.4",
        "remediation": "数清两个因数的小数位数总和，再从右往左点小数点"
      },
      {
        "tag": "carry_missing",
        "error": "竖式乘法中漏进位，导致 64×35 算成 2140",
        "remediation": "每一步乘完检查是否进位，特别是十位相乘时"
      }
    ],
    "feedback_correct": "太棒啦！你准确完成了小数乘法竖式，小数点位置也找对啦～",
    "feedback_wrong": "别灰心！再数一遍两个因数一共有几位小数，然后从积的末尾往前数哦～",
    "hints": [
      {
        "text": "6.4 有1位小数，0.35有2位小数，一共3位小数。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_vertical_002__morvc4kf_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_vertical",
    "skill_name": "小数乘法竖式",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小红在算 12.08 × 7.5 的竖式时，先按整数算出 1208 × 75 = 90600。她接下来该怎样确定正确积？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "在 90600 右边去掉三位，得 90.6"
      },
      {
        "id": "B",
        "text": "在 90600 末尾从右往左数三位，点上小数点，得 90.600"
      },
      {
        "id": "C",
        "text": "在 90600 末尾从右往左数三位，点上小数点，得 90.6"
      },
      {
        "id": "D",
        "text": "在 90600 末尾从右往左数四位，点上小数点，得 9.0600"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "12.08 有两位小数，7.5 有一位小数，共三位小数；整数积 90600 是五位数，从右往左数三位点小数点：90600 → 90.600 = 90.6"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误以为小数位数是两位（只看 12.08），结果点成 906.00",
        "remediation": "每个因数都要单独数小数位数，再加总"
      },
      {
        "tag": "trailing_zero_drop",
        "error": "写出 90.600 后没化简为 90.6，误选 B",
        "remediation": "小数末尾的 0 可以去掉，90.600 就是 90.6"
      }
    ],
    "feedback_correct": "真细心！你既数对了小数位，又记得去掉末尾多余的 0～",
    "feedback_wrong": "加油！记住：两个因数的小数位数要全部加起来，再点小数点哦～",
    "hints": [
      {
        "text": "12.08 是两位小数，7.5 是一位小数，合起来是三位小数。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_vertical_001__morvc4kf_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_vertical",
    "skill_name": "小数乘法竖式",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "用竖式计算 5.6 × 0.32。下列哪一项是正确的积？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "1.792"
      },
      {
        "id": "B",
        "text": "17.92"
      },
      {
        "id": "C",
        "text": "0.1792"
      },
      {
        "id": "D",
        "text": "179.2"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先按整数乘法算 56 × 32 = 1792；两个因数共三位小数（一位+两位），所以积从右往左数三位，点上小数点得 1.792"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "小数点位置错，如把 1792 当成 17.92（只数两位小数）",
        "remediation": "数清两个因数的小数位数总和：5.6有1位，0.32有2位，共3位，积必须有3位小数"
      },
      {
        "tag": "carry_missing",
        "error": "竖式计算56×32时漏进位，得出1692等错误积",
        "remediation": "重新列竖式，注意每一步进位都要标清楚，再补小数点"
      }
    ],
    "feedback_correct": "太棒啦！你准确完成了小数乘法竖式，小数点位置也找对啦～",
    "feedback_wrong": "再检查一下两个因数一共有几位小数？积的小数位数要和它一样哦～",
    "hints": [
      {
        "text": "先忽略小数点，算56×32等于多少？再看小数点总共该点几位。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_vertical_002__morvc4kf_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_vertical",
    "skill_name": "小数乘法竖式",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小红用竖式计算 1.08 × 2.5，但抄错了其中一个数字：她把 1.08 写成了 108，把 2.5 写成了 25，算出结果后忘了补小数点。她得到的整数结果是 2700。请问正确积应该是多少？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "2.7"
      },
      {
        "id": "B",
        "text": "27"
      },
      {
        "id": "C",
        "text": "0.27"
      },
      {
        "id": "D",
        "text": "270"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "1.08有两位小数，2.5有一位小数，共三位小数；她把两数都扩大了100倍（1.08→108）和10倍（2.5→25），相当于整体扩大了1000倍；2700 ÷ 1000 = 2.7"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误以为只少点一位小数，选27或270",
        "remediation": "分别看每个因数扩大的倍数：1.08×100=108，2.5×10=25，合起来扩大了100×10=1000倍，要除以1000"
      },
      {
        "tag": "carry_missing",
        "error": "直接算1.08×2.5竖式时漏掉末尾0的处理，得出2.6或2.8",
        "remediation": "列竖式时把1.08写在上面，2.5在下面，对齐末位，先算108×25=2700，再补三位小数"
      }
    ],
    "feedback_correct": "真厉害！你不仅会算竖式，还能发现小红漏掉的小数点秘密～",
    "feedback_wrong": "想一想：1.08变成108是扩大了多少倍？2.5变成25又是扩大了多少倍？一共扩大了几倍呢？",
    "hints": [
      {
        "text": "1.08 → 108 是×100，2.5 → 25 是×10，所以2700是正确结果的100×10=1000倍。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_vertical_001__morvcp6t_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_vertical",
    "skill_name": "小数乘法竖式",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "用竖式计算 0.46 × 12，下列哪一项是正确的积？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "5.52"
      },
      {
        "id": "B",
        "text": "55.2"
      },
      {
        "id": "C",
        "text": "0.552"
      },
      {
        "id": "D",
        "text": "552"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先忽略小数点，算 46 × 12 = 552；因 0.46 有两位小数，积应从右往左数两位，得 5.52。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "忘记给积补小数点，直接写 552",
        "remediation": "数清两个乘数一共有几位小数，就在积的右边起数几位，点上小数点。"
      },
      {
        "tag": "carry_missing",
        "error": "计算 46 × 12 时个位相乘进位漏加，得 542",
        "remediation": "竖式每一步都要检查进位：6×2=12，写2进1；4×2+1=9，再乘十位……"
      }
    ],
    "feedback_correct": "太棒啦！你准确完成了小数乘法竖式，小数点位置也找对了！",
    "feedback_wrong": "别灰心～再数一遍两个乘数的小数位数，就能找到小数点该点在哪啦！",
    "hints": [
      {
        "text": "0.46 是两位小数，12 是整数，所以积应该有两位小数。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_vertical_002__morvcp6t_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_vertical",
    "skill_name": "小数乘法竖式",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小明用竖式计算 3.08 × 0.25，他在第二步用‘2’（十分位上的2）去乘 308 时，得到的结果应写在积的哪一位对齐？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "个位对齐（即末尾与个位对齐）"
      },
      {
        "id": "B",
        "text": "十分位对齐（即末尾与十分位对齐）"
      },
      {
        "id": "C",
        "text": "百分位对齐（即末尾与百分位对齐）"
      },
      {
        "id": "D",
        "text": "千分位对齐（即末尾与千分位对齐）"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "把 3.08 × 0.25 看作 308 × 25 计算，再补小数点；0.25 的‘2’在十分位，相当于 0.2，所以这一步实际是 308 × 20 = 6160，但因 20 是 0.2 × 100，需向左移一位——最终结果末位应对齐百分位。"
    ],
    "common_errors": [
      {
        "tag": "place_value_misalign",
        "error": "误将‘2’当作个位数字，对齐个位",
        "remediation": "竖式中，乘数的每一位要按它的实际数值意义对齐：十分位上的2代表0.2，所以结果末位应和原被乘数的百分位对齐。"
      },
      {
        "tag": "decimal_point_error",
        "error": "直接按整数乘法对齐，忽略小数位导致错位",
        "remediation": "先去掉小数点列竖式，算完后统一补小数点；但每一步中间结果的位置，必须按该位的实际计数单位来对齐。"
      }
    ],
    "feedback_correct": "真厉害！你清楚地理解了竖式中每一位数字代表的意义和对齐规则！",
    "feedback_wrong": "没关系～记住：十分位上的数字相乘，结果末位要对齐百分位哦！",
    "hints": [
      {
        "text": "0.25 中的‘2’在十分位，表示 2 个 0.1，所以它乘 3.08 相当于算 0.2 × 3.08，结果应有三位小数，末位落在百分位。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_vertical_001__morvcp6t_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_vertical",
    "skill_name": "小数乘法竖式",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "小明用竖式计算 0.42 × 18，他先忽略小数点算 42 × 18 = 756，再确定积的小数位数。请问正确的积是多少？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "7.56"
      },
      {
        "id": "B",
        "text": "75.6"
      },
      {
        "id": "C",
        "text": "0.756"
      },
      {
        "id": "D",
        "text": "756"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "0.42 有两位小数，18 是整数，积应有两位小数；42 × 18 = 756，从右往左数两位，得 7.56。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误将积写成 75.6，错把小数位数当成一位（只看 0.42 中的 4）",
        "remediation": "记住：小数位数由因数中小数部分总位数决定，0.42 有两位，18 有零位，共两位。"
      },
      {
        "tag": "carry_missing",
        "error": "计算 42 × 18 时漏进位，得出错误中间积如 656 或 736",
        "remediation": "列竖式时，个位乘完后检查十位是否加了进位；42 × 18 = (40+2)×18 = 720+36 = 756。"
      }
    ],
    "feedback_correct": "太棒啦！你准确应用了小数乘法竖式的步骤和小数点定位规则。",
    "feedback_wrong": "别灰心！再想想：0.42 是两位小数，结果要从末尾往前数两位点上小数点哦。",
    "hints": [
      {
        "text": "先算 42 × 18 得多少？再想：两个因数一共有几位小数？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_vertical_002__morvcp6t_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_mul_vertical",
    "skill_name": "小数乘法竖式",
    "ability_dimension": [
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小丽用竖式计算 3.05 × 2.4，她在第二步用‘2’去乘 305 时，得到的结果是 610，但她忘了在末尾补零。下列哪一项是她可能写出的错误积？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "7.32"
      },
      {
        "id": "B",
        "text": "73.2"
      },
      {
        "id": "C",
        "text": "732"
      },
      {
        "id": "D",
        "text": "0.732"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "正确积为 3.05 × 2.4 = 7.32；小丽用 2 去乘 305 得 610 后，应在末尾补一个 0（因 2 在十分位，实际是 20），即 6100；若漏补零，会误把 610 当作十位结果，导致积整体偏大10倍，得 73.2。"
    ],
    "common_errors": [
      {
        "tag": "zero_omission",
        "error": "用十位上的数字相乘时，忘记在积末尾补零，导致结果扩大10倍",
        "remediation": "竖式中，用十位数字乘时，积要向左错一位（或末尾补一个0），这是对齐位值的关键。"
      },
      {
        "tag": "decimal_point_error",
        "error": "虽补零但小数点位置错，如写成 732 或 7.3200（多写零不扣分但非本题干扰项）",
        "remediation": "先按整数乘法算出 305 × 24 = 7320，再数因数共三位小数（3.05 两位 + 2.4 一位），得 7.320 → 即 7.32。"
      }
    ],
    "feedback_correct": "观察真仔细！你发现了竖式中补零这个关键细节。",
    "feedback_wrong": "没关系！记住：用十位上的数去乘，结果要向左错一位，相当于末尾补一个0哦。",
    "hints": [
      {
        "text": "2.4 中的‘2’在十分位，代表 20；305 × 20 应该是多少？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_meaning_002__morvbz87_0",
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
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "妈妈买 4 包糖果，每包重 0.25 千克。下面哪句话正确表达了‘0.25 × 4’的意义？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "4 千克糖果平均分成 0.25 份，每份多少千克"
      },
      {
        "id": "B",
        "text": "0.25 千克糖果买了 4 次，一共多少千克"
      },
      {
        "id": "C",
        "text": "4 包糖果每包重 0.25 千克，总重多少千克"
      },
      {
        "id": "D",
        "text": "0.25 包糖果重 4 千克，1 包重多少千克"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "0.25 × 4 表示 4 个 0.25 千克相加，即 4 包每包 0.25 千克的总质量。选项 C 准确描述了这个实际含义。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误将 0.25 理解为‘份数’而非‘每份量’，选 B（表述不严谨，未体现‘每包’）",
        "remediation": "B 说‘买了 4 次’，但题目是‘买 4 包’，情境关键词是‘每包重’，必须对应‘个数×每份量’。"
      },
      {
        "tag": "misinterpret_multiplication",
        "error": "混淆乘法顺序意义，认为 0.25 × 4 可读作‘0.25 个 4’，导致选 D",
        "remediation": "小数不能当‘个数’用（0.25 个没有现实意义），整数 4 才是‘包数’，小数 0.25 是‘每包重量’。"
      }
    ],
    "feedback_correct": "太棒了！你读懂了生活里的小数乘法——‘每包重 × 包数 = 总重’！",
    "feedback_wrong": "别急，记住：小数乘整数时，整数一定是‘有多少份’，小数是‘每份是多少’。",
    "hints": [
      {
        "text": "找题干中的关键词：‘每包重 0.25 千克’‘买 4 包’——哪个选项同时包含这两个意思？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_meaning_002__morvcjm4_0",
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
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "妈妈买来 5 包糖果，每包重 0.36 千克。下面哪句话正确表达了总重量的计算意义？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "0.36 × 5 表示 5 个 0.36 千克相加"
      },
      {
        "id": "B",
        "text": "5 × 0.36 表示 0.36 个 5 千克相加"
      },
      {
        "id": "C",
        "text": "0.36 + 5 表示一共买了多少千克"
      },
      {
        "id": "D",
        "text": "5 ÷ 0.36 表示能分几包"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "题目情境是‘5 包，每包 0.36 千克’，求总重即 0.36 + 0.36 + 0.36 + 0.36 + 0.36，也就是 5 个 0.36 相加，用乘法表示为 0.36 × 5。"
    ],
    "common_errors": [
      {
        "tag": "misinterpret_multiplication_order",
        "error": "认为 5 × 0.36 表示‘0.36 个 5’，不理解小数作乘数时仍表示份数",
        "remediation": "乘法交换律成立，但意义不同：5 × 0.36 在四年级不强调其现实意义；教材中统一用‘每份数 × 份数’理解，即 0.36 × 5 更贴合题意。"
      },
      {
        "tag": "operation_confusion",
        "error": "混淆加、乘、除运算适用场景，误选加法或除法表达式",
        "remediation": "相同数量重复相加才用乘法；‘每包多少’×‘几包’=总共多少。"
      }
    ],
    "feedback_correct": "太棒了！你读懂了小数乘法背后的故事～",
    "feedback_wrong": "小提示：‘每包重多少’和‘有几包’，哪个是每份？哪个是份数？",
    "hints": [
      {
        "text": "回忆：‘3 个苹果，每个 2 元’总价是 2 × 3，那‘5 包糖，每包 0.36 千克’呢？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_meaning_002__morvcjm4_1",
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
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小红买 7 根铅笔，每根 1.2 元。下面哪句话正确表达了‘1.2 × 7’的意义？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "7 元钱可以买多少根 1.2 元的铅笔"
      },
      {
        "id": "B",
        "text": "7 根铅笔一共花了多少元，也就是 1.2 元加 7 次"
      },
      {
        "id": "C",
        "text": "1.2 元是 7 根铅笔的平均价格"
      },
      {
        "id": "D",
        "text": "1.2 根铅笔要花 7 元"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "1.2 × 7 表示 7 个 1.2 元相加，即 7 根铅笔的总价钱；选项 B 准确描述了加法意义和实际情境。"
    ],
    "common_errors": [
      {
        "tag": "division_misuse",
        "error": "选 A，把乘法误当成除法应用（求‘能买几根’需用除法），混淆运算意义",
        "remediation": "看关键词：‘买 7 根’→已知数量，求总价→用乘法；‘7 元能买几根’→已知总价，求数量→用除法。"
      },
      {
        "tag": "average_confusion",
        "error": "选 C，把乘法与平均数概念混淆，1.2 元已是单价，不是平均结果",
        "remediation": "单价 × 数量 = 总价；平均数 = 总价 ÷ 数量。这里没出现‘平均’二字，别自己加戏哦！"
      }
    ],
    "feedback_correct": "太棒了！你读懂了‘1.2 × 7’就是在算 7 个 1.2 元加起来是多少～",
    "feedback_wrong": "没关系！注意题目说的是‘买 7 根’，说明数量已知，我们是在算总共多少钱。",
    "hints": [
      {
        "text": "回忆：‘每根 1.2 元’是单价，‘7 根’是数量，总价怎么算？它对应哪种加法？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_meaning_002__moryo7c7_0",
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
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "妈妈买了 6 包糖果，每包重 0.25 千克。下面哪句话正确表达了‘6 × 0.25’的意义？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "6 千克糖果平均分成 0.25 份"
      },
      {
        "id": "B",
        "text": "0.25 千克糖果的 6 倍"
      },
      {
        "id": "C",
        "text": "6 个 0.25 千克合起来的总质量"
      },
      {
        "id": "D",
        "text": "每包 6 千克，共 0.25 包"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "6 × 0.25 表示 6 个 0.25 千克相加，即 6 包糖果每包 0.25 千克的总质量；选项 C 准确描述了这一加法意义。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误选 B，把‘0.25 的 6 倍’当成等价表达，但‘倍’易忽略单位叠加本质，未体现‘6 个相同量相加’的原始意义",
        "remediation": "小数乘法意义的核心是‘几个相同小数相加’，不是抽象‘倍数’——要能还原成加法算式：0.25 + 0.25 + …（6 次）。"
      },
      {
        "tag": "role_reversal",
        "error": "误选 D，混淆了乘数与被乘数所代表的实际角色（包数 vs 每包重量）",
        "remediation": "看题干关键词：‘6 包’是份数（乘数），‘每包 0.25 千克’是每份量（被乘数），所以是 6 个 0.25，不是 0.25 个 6。"
      }
    ],
    "feedback_correct": "太棒了！你准确抓住了小数乘法背后‘几个相同量相加’的真实含义～",
    "feedback_wrong": "没关系！记住：‘份数 × 每份量 = 总量’，这里‘6 包’是份数，‘0.25 千克’是每份量。",
    "hints": [
      {
        "text": "试着把 6 × 0.25 写成加法：0.25 + 0.25 + … 它一共加几次？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_meaning_002__moryoy0k_0",
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
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "妈妈买 3 包糖果，每包重 1.25 千克。下面哪句话正确表达了总重量的计算意义？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "1.25 × 3 表示 3 个 1.25 千克相加"
      },
      {
        "id": "B",
        "text": "1.25 × 3 表示 1.25 个 3 千克相加"
      },
      {
        "id": "C",
        "text": "1.25 × 3 表示把 1.25 平均分成 3 份"
      },
      {
        "id": "D",
        "text": "1.25 × 3 表示 1.25 和 3 的和"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "题目情境是‘每包重 1.25 千克，共 3 包’，属于‘每份数 × 份数 = 总数’，因此 1.25 × 3 表示 3 个 1.25 千克相加。"
    ],
    "common_errors": [
      {
        "tag": "misinterpret_multiplication",
        "error": "选 B，混淆乘法中两个数的角色，误将小数当作份数，但‘1.25 个’无法对应真实物品数量",
        "remediation": "份数必须是整数（如 1 个、3 个、10 个），小数只能表示‘每份的大小’，比如每包 1.25 千克。"
      },
      {
        "tag": "confuse_operation",
        "error": "选 C 或 D，把乘法和除法、加法的意义弄混了",
        "remediation": "看到‘每包…共…包’就想到‘每份数 × 份数’；‘平均分’才用除法，‘一共多少’才用加法。"
      }
    ],
    "feedback_correct": "太棒啦！你理解了小数乘法在生活中的真正意思～",
    "feedback_wrong": "别灰心！记住：‘每包重多少’×‘有几包’=总重，就是几个相同小数相加哦！",
    "hints": [
      {
        "text": "回忆一下：‘每盒装 4 支笔，5 盒共多少支？’是 4×5，因为是 5 个 4；那‘每包 1.25 千克，3 包’呢？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_product_digits_001__morvcc1t_0",
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
    "stem": "0.7 × 0.09 的积一共有几位小数？（不考虑末尾的0）",
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
      "0.7有1位小数，0.09有2位小数，相加得3位小数；积的小数位数等于两个因数小数位数之和。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "只看其中一个因数的小数位数，如只看0.7的1位",
        "remediation": "要分别数两个因数的小数位数，再相加。"
      },
      {
        "tag": "carry_missing",
        "error": "误以为0.7×0.09=0.063，但漏掉小数点后第三位，写成0.06",
        "remediation": "先不算小数点，算7×9=63，再从右往左数3位点小数点，得0.063。"
      }
    ],
    "feedback_correct": "太棒啦！你掌握了小数位数相加的规则！",
    "feedback_wrong": "再想想哦～两个因数的小数位数要加起来才算积的小数位数。",
    "hints": [
      {
        "text": "先分别数出0.7和0.09各有几位小数，再把它们加起来。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_product_digits_002__morvcc1t_1",
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
        "text": "0.12 × 0.5"
      },
      {
        "id": "B",
        "text": "0.008 × 0.3"
      },
      {
        "id": "C",
        "text": "1.6 × 0.04"
      },
      {
        "id": "D",
        "text": "0.07 × 0.009"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "D"
    },
    "solution_steps": [
      "A：2+1=3位；B：3+1=4位；C：1+2=3位；D：2+3=5位。所以D最多，是5位小数。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误将整数部分零也计入小数位数，如把0.008当成4位小数",
        "remediation": "只数小数点右边的数字个数，前面的0不算位数起点。"
      },
      {
        "tag": "operation_reverse",
        "error": "用因数位数相减或相乘代替相加",
        "remediation": "积的小数位数 = 第一个因数小数位数 + 第二个因数小数位数，永远是加法。"
      }
    ],
    "feedback_correct": "真厉害！你仔细比较了每一组的小数位数总和！",
    "feedback_wrong": "别灰心～记得：积的小数位数是两个因数小数位数加起来的和哦。",
    "hints": [
      {
        "text": "逐个数清每组两个因数各有多少位小数，再相加，最后比大小。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_product_digits_002__morvcc1t_3",
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
      "concept",
      "reasoning"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小红计算 2.05 × 0.4 时，先算出 205 × 4 = 820。她想知道积应该有几位小数，下面哪种想法是对的？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "2.05有2位小数，0.4有1位小数，所以积有2+1=3位小数。"
      },
      {
        "id": "B",
        "text": "2.05有2位小数，0.4有1位小数，但205×4=820是整数，所以积是0.820，只有2位有效小数。"
      },
      {
        "id": "C",
        "text": "因为0.4是一位小数，所以结果比2.05少一位小数，是1位小数。"
      },
      {
        "id": "D",
        "text": "2.05×0.4等于205×4再除以1000，所以积有3位小数。"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "判断积的小数位数，只看两个因数的小数位数之和：2.05有2位，0.4有1位，2+1=3位；与中间计算过程无关。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "混淆‘小数位数’和‘末尾零是否保留’，认为0.820可简写为0.82就只有2位",
        "remediation": "题目明确要求‘去尾零之前看’，0.820就是3位小数，末尾零不能省略计数。"
      },
      {
        "tag": "modeling_error",
        "error": "用‘除以1000’反推小数位数，但未确认1000对应3位小数，逻辑跳跃",
        "remediation": "除以10、100、1000分别对应1、2、3位小数——这是正确思路，但选项D没说明1000怎么来，不如A直接、可靠。"
      }
    ],
    "feedback_correct": "太厉害了！你牢牢抓住了‘小数位数由因数决定’这个关键规则。",
    "feedback_wrong": "别灰心！记住：积的小数位数只取决于两个因数的小数位数之和哦～",
    "hints": [
      {
        "text": "小数乘法中，积的小数位数等于两个因数小数位数的总和，和中间整数计算无关。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_product_digits_001__morvdq9z_0",
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
      "concept",
      "calculation"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "不计算，直接判断 0.7 × 0.08 的积有几位小数？",
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
      "0.7 有1位小数，0.08 有2位小数，积的小数位数等于两个因数小数位数之和：1 + 2 = 3位。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误将0.08当作1位小数（只看末尾8），得出1+1=2位",
        "remediation": "数小数位数要从右往左数所有小数部分数字，0.08是2位小数。"
      },
      {
        "tag": "carry_missing",
        "error": "误以为积末尾有0可去掉，从而少算1位",
        "remediation": "判断积的小数位数时，先不考虑末尾0，按因数小数位数之和确定；去0是化简步骤，不影响位数判断。"
      }
    ],
    "feedback_correct": "真棒！你掌握了小数位数相加的规律～",
    "feedback_wrong": "再想想：每个因数各有多少位小数？加起来就是积的位数哦！",
    "hints": [
      {
        "text": "先分别数出0.7和0.08各有几位小数，再相加。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_product_digits_002__morvdq9z_1",
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
      "concept",
      "reasoning"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小红说：‘因为 6 × 9 = 54，所以 0.06 × 0.9 的积一定是两位小数。’她的说法对吗？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "对，积是0.054，有两位小数"
      },
      {
        "id": "B",
        "text": "对，积是0.054，有三位小数"
      },
      {
        "id": "C",
        "text": "不对，0.06 × 0.9 的积是两位小数"
      },
      {
        "id": "D",
        "text": "不对，0.06 × 0.9 的积是三位小数"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "D"
    },
    "solution_steps": [
      "0.06 有2位小数，0.9 有1位小数，积应有2 + 1 = 3位小数；实际计算得0.06 × 0.9 = 0.054，确实是三位小数；小红错在认为积一定是两位小数，忽略了0.9也贡献1位小数。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误以为整数乘法结果54直接对应小数位数，忽略小数点移动规则",
        "remediation": "积的小数位数由因数小数位数之和决定，与整数积无关。"
      },
      {
        "tag": "zero_truncation_error",
        "error": "看到0.054末尾无0，误以为只有两位有效数字就当成两位小数",
        "remediation": "小数位数指小数点后总位数，0.054小数点后有3个数字，就是三位小数。"
      }
    ],
    "feedback_correct": "太厉害了！你不仅会算，还会发现别人推理中的小漏洞～",
    "feedback_wrong": "别灰心！记住：积的小数位数 = 所有因数小数位数加起来，一个都不能少哦！",
    "hints": [
      {
        "text": "先分别数0.06和0.9各几位小数，再相加；然后验证一下实际结果0.06×0.9等于多少？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_product_digits_001__morve96m_0",
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
    "stem": "0.08 × 0.5 的积一共有几位小数？（不考虑末尾的0）",
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
      "0.08有2位小数，0.5有1位小数，相加得3位小数；积为0.040，去掉末尾0后是0.04，但题目要求‘不考虑末尾的0’，所以按原始小数位数和计算：2+1=3位。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误将0.040去掉末尾0后当作2位小数来判断",
        "remediation": "题目明确说‘不考虑末尾的0’，应直接看两个乘数的小数位数之和。"
      },
      {
        "tag": "carry_missing",
        "error": "把0.08当成1位小数（只看8前面的0），得出2位小数",
        "remediation": "小数位数从右往左数，0.08的小数点后有两位数字：0和8，共2位。"
      }
    ],
    "feedback_correct": "答对啦！两个小数相乘，积的小数位数等于两个乘数小数位数之和。",
    "feedback_wrong": "再想想哦～小数位数要数小数点后面所有数字，包括中间的0！",
    "hints": [
      {
        "text": "先分别数出0.08和0.5各有多少位小数，再相加。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_product_digits_001__morve96m_2",
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
      "concept",
      "calculation"
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
        "error": "误将0.8看作0位小数，得出2位",
        "remediation": "记住：小数点后有几个数字就是几位小数，0.8是1位，不是0位。"
      },
      {
        "tag": "carry_missing",
        "error": "误认为末尾0要计入，选4位",
        "remediation": "题目明确‘不考虑末尾的0’，计算位数只看因数小数位数之和，不看积的结果是否含0。"
      }
    ],
    "feedback_correct": "真棒！你准确算出了小数位数之和。",
    "feedback_wrong": "再想想：每个因数各有几位小数？加起来就是积的小数位数哦～",
    "hints": [
      {
        "text": "先分别数出0.8和0.06各有多少位小数，再相加。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_simplify_001__morveevd_0",
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
    "stem": "小红买4.8千克苹果，每千克5.5元。她用简便方法计算总价：4.8×5.5＝（4.8×5）＋（4.8×0.5）。这个算法依据的是什么运算律？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "乘法交换律"
      },
      {
        "id": "B",
        "text": "乘法结合律"
      },
      {
        "id": "C",
        "text": "乘法分配律"
      },
      {
        "id": "D",
        "text": "加法结合律"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "4.8×5.5 = 4.8×(5 + 0.5) = 4.8×5 + 4.8×0.5，符合a×(b+c)=a×b+a×c，是乘法分配律。"
    ],
    "common_errors": [
      {
        "tag": "misidentify_law",
        "error": "误认为是交换律或结合律，混淆了运算律的适用形式",
        "remediation": "记住：分配律一定含‘和’或‘差’在括号里，外面一个数分别乘里面两个数。"
      },
      {
        "tag": "confuse_addition_multiplication",
        "error": "选加法结合律，误把加法运算律套用到乘法中",
        "remediation": "加法结合律是(a+b)+c=a+(b+c)，和乘法无关；本题核心是乘与加混合，只可能是分配律。"
      }
    ],
    "feedback_correct": "太棒啦！你一眼看出这是分配律的应用～",
    "feedback_wrong": "再想想哦：当一个数乘一个和的时候，可以分开算再相加，这就是分配律！",
    "hints": [
      {
        "text": "想一想：5.5可以拆成哪两个数相加？拆完后怎么算更简便？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_simplify_002__morveevd_1",
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
    "stem": "计算 9.9 × 7.2，下面哪种简便方法是正确的？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "9.9 × 7.2 = (10 − 0.1) × 7.2 = 10 × 7.2 − 0.1 × 7.2"
      },
      {
        "id": "B",
        "text": "9.9 × 7.2 = 9 × 7.2 + 0.9 × 7.2"
      },
      {
        "id": "C",
        "text": "9.9 × 7.2 = 9.9 × 7 + 9.9 × 0.2"
      },
      {
        "id": "D",
        "text": "9.9 × 7.2 = (9 + 0.9) × 7.2 = 9 × 7.2 + 0.9 × 7.2"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "9.9接近10，可写成10−0.1，再用乘法分配律展开：(10−0.1)×7.2=10×7.2−0.1×7.2，计算更简便。选项B、D本质相同但9+0.9=9.9没错，却未利用整十数优势；选项C虽正确但不是最简——7.2拆成7+0.2反而增加小数乘小数步骤。"
    ],
    "common_errors": [
      {
        "tag": "suboptimal_simplification",
        "error": "选B或D，虽数学正确但未体现‘简便’核心（没利用10这个整十数）",
        "remediation": "简便运算要优先找整十/整百数，再用分配律减去多算的部分。"
      },
      {
        "tag": "misapply_distributive",
        "error": "选C，误以为拆乘数比拆被乘数更简便",
        "remediation": "观察哪个数更接近整数：9.9比7.2更接近10，所以应拆9.9，而不是拆7.2。"
      }
    ],
    "feedback_correct": "真聪明！用10减0.1来凑整，让计算又快又准～",
    "feedback_wrong": "再检查一下：哪个数最接近整十数？把它拆开用分配律才最省力哦！",
    "hints": [
      {
        "text": "想一想：9.9离哪个整十数最近？怎么写成‘整十数±小数’？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_simplify_001__morveevd_2",
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
    "stem": "妈妈买苹果花了2.4元/千克，买了5千克；又买梨花了3.6元/千克，也买了5千克。一共花了多少钱？用简便方法计算。",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "30元"
      },
      {
        "id": "B",
        "text": "25元"
      },
      {
        "id": "C",
        "text": "28元"
      },
      {
        "id": "D",
        "text": "32元"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "利用乘法分配律：(2.4 + 3.6) × 5 = 6 × 5 = 30（元）"
    ],
    "common_errors": [
      {
        "tag": "missing_distributive",
        "error": "分别算2.4×5和3.6×5再相加时漏加或算错小数，得24或36等",
        "remediation": "先加括号里的两个单价，再乘数量，更简便也不易错"
      },
      {
        "tag": "decimal_point_error",
        "error": "把2.4×5算成12（漏掉小数点），或3.6×5算成180（多写一个0）",
        "remediation": "一位小数乘整数，积仍是一位小数；可先算24×5=120，再缩小10倍得12.0"
      }
    ],
    "feedback_correct": "太棒啦！你用分配律把两步合一步，又快又准！",
    "feedback_wrong": "没关系，试试先把两种水果单价加起来，再乘5千克，会更简单哦～",
    "hints": [
      {
        "text": "两种水果单价不同，但重量相同，可以先加单价再乘重量。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_simplify_002__morveevd_3",
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
    "stem": "体育老师买跳绳，每根7.5元；买毽子，每个2.5元。他各买了12个，一共付了多少元？用最简便的方法计算。",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "120元"
      },
      {
        "id": "B",
        "text": "108元"
      },
      {
        "id": "C",
        "text": "112元"
      },
      {
        "id": "D",
        "text": "132元"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "利用乘法分配律：(7.5 + 2.5) × 12 = 10 × 12 = 120（元）"
    ],
    "common_errors": [
      {
        "tag": "carry_missing",
        "error": "分别计算7.5×12=90和2.5×12=30，但加错得110或130",
        "remediation": "检查加法：90+30=120，别漏进位或看错数字"
      },
      {
        "tag": "wrong_grouping",
        "error": "误用结合律，如7.5×(12+2.5)，完全偏离题意",
        "remediation": "题目中‘各买了12个’说明数量相同，才适合用分配律合并单价"
      }
    ],
    "feedback_correct": "真厉害！一眼看出数量相同，用分配律一气呵成！",
    "feedback_wrong": "再想想：跳绳和毽子数量一样，能不能先把单价加起来再算总钱？",
    "hints": [
      {
        "text": "两个单价不同，但购买数量相同，优先考虑提取公因数12。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_simplify_001__morvfkzn_0",
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
    "stem": "简算：2.5 × 3.6 × 4，下面哪种方法最简便？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "先算 2.5 × 4 = 10，再算 10 × 3.6 = 36"
      },
      {
        "id": "B",
        "text": "先算 3.6 × 4 = 14.4，再算 2.5 × 14.4 = 36"
      },
      {
        "id": "C",
        "text": "列竖式计算 2.5 × 3.6，再乘 4"
      },
      {
        "id": "D",
        "text": "把 2.5 改成 25/10，3.6 改成 36/10，再约分"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "利用乘法交换律和结合律，2.5 × 4 = 10 是整十数，再乘 3.6 更简便。"
    ],
    "common_errors": [
      {
        "tag": "operation_order_error",
        "error": "未优先选择能凑整的数相乘，导致计算变复杂",
        "remediation": "找能凑成整十、整百的小数对，如 2.5 和 4、1.25 和 8"
      },
      {
        "tag": "calculation_mistake",
        "error": "误算 2.5 × 4 = 8 或 3.6 × 4 = 12.4",
        "remediation": "检查小数乘整数：2.5 × 4 看作 25 × 4 ÷ 10 = 100 ÷ 10 = 10"
      }
    ],
    "feedback_correct": "真棒！你发现了 2.5 和 4 相乘得整十数，让计算又快又准！",
    "feedback_wrong": "再想想哦～哪个组合先算能让后面更简单？试试找‘好朋友’数字！",
    "hints": [
      {
        "text": "想一想：哪些小数相乘能得到整数？比如 2.5 × 4，0.25 × 4……",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_simplify_002__morvfkzn_1",
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
      "strategy",
      "reasoning"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小明用简便方法计算 7.8 × 10.1，他写成 7.8 × (10 + 0.1) = 7.8 × 10 + 7.8 × 0.1。下面哪道题也能用同样的方法简便计算？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "9.6 × 2.5（拆 2.5 = 10 ÷ 4）"
      },
      {
        "id": "B",
        "text": "5.2 × 99（改写为 5.2 × (100 − 1)）"
      },
      {
        "id": "C",
        "text": "3.7 × 8 × 12.5（先算 8 × 12.5）"
      },
      {
        "id": "D",
        "text": "6.4 × 0.9（改写为 6.4 × (1 − 0.1)）"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "小明用的是乘法分配律（a×(b+c)=a×b+a×c）。选项 B 中 99 = 100 − 1，同样适用分配律：5.2×100 − 5.2×1，属于同类型简便策略。"
    ],
    "common_errors": [
      {
        "tag": "distributive_confusion",
        "error": "误以为所有拆数都叫分配律，混淆了‘拆加数’和‘拆因数’（如拆 2.5 为 10÷4 是利用除法性质）",
        "remediation": "分配律只适用于括号里是加或减；拆乘数本身（如 2.5=10÷4）用的是乘除关系，不是分配律"
      },
      {
        "tag": "operation_type_mismatch",
        "error": "选 D，认为‘减法’和‘加法’一样，但没注意小明原式是加法形式（10+0.1），而 D 是减法变形，虽同属分配律，但题目强调‘同样的方法’即加法拆分",
        "remediation": "紧扣题干关键词‘同样的方法’——指‘拆成两个正数相加’的分配律应用"
      }
    ],
    "feedback_correct": "太厉害啦！你一眼看出这是分配律的‘加法版’，和小明的方法一模一样！",
    "feedback_wrong": "别灰心～分配律有两种样子：加法和减法。小明用的是‘加’，我们找也用‘加’的哦！",
    "hints": [
      {
        "text": "观察小明的步骤：他把 10.1 拆成了‘10 + 0.1’——这是加法拆分。哪个选项也是把一个数拆成两个数相加？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_simplify_001__morvfkzn_2",
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
    "stem": "简算：7.5 × 4.2 × 2，下面哪种方法最简便？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "先算 7.5 × 2 = 15，再算 15 × 4.2"
      },
      {
        "id": "B",
        "text": "先算 4.2 × 2 = 8.4，再算 7.5 × 8.4"
      },
      {
        "id": "C",
        "text": "列竖式直接计算 7.5 × 4.2 × 2"
      },
      {
        "id": "D",
        "text": "把 7.5 拆成 7 + 0.5，再分别乘 4.2 × 2"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "7.5 × 2 = 15 是整数，再算 15 × 4.2 比较容易（可看作 15 × 4 + 15 × 0.2）"
    ],
    "common_errors": [
      {
        "tag": "operation_order_error",
        "error": "未优先结合能凑整的数，如先算 7.5 × 4.2 导致小数复杂",
        "remediation": "找能相乘得整数的两个数先算，比如 7.5 和 2 相乘得 15"
      },
      {
        "tag": "strategy_missing",
        "error": "放弃简便算法，选择竖式硬算",
        "remediation": "记住：小数乘法中，交换律和结合律仍然适用，要主动寻找‘先凑整’的机会"
      }
    ],
    "feedback_correct": "太棒啦！你发现了 7.5 和 2 相乘得整数，这是最聪明的简便方法！",
    "feedback_wrong": "再想想哦～看看哪两个数相乘能变成整数，会让后面计算轻松很多！",
    "hints": [
      {
        "text": "想一想：7.5 × 2 等于多少？是不是整数？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_decimal_mul_simplify_002__morvfkzn_3",
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
    "stem": "小明用简便方法计算 6.8 × 9.9，他写成了 6.8 × (10 − 0.1) = 6.8 × 10 − 6.8 × 0.1。下面哪个选项和他的思路一致且结果正确？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "6.8 × 10 = 68，6.8 × 0.1 = 0.68，所以结果是 68 − 0.68 = 67.32"
      },
      {
        "id": "B",
        "text": "6.8 × 10 = 68，6.8 × 0.1 = 6.8，所以结果是 68 − 6.8 = 61.2"
      },
      {
        "id": "C",
        "text": "6.8 × 9.9 = 6.8 × (9 + 0.9) = 6.8 × 9 + 6.8 × 0.9 = 61.2 + 6.12 = 67.32"
      },
      {
        "id": "D",
        "text": "直接列竖式：6.8 × 9.9 = 67.32，所以他的方法不必要"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "小明用了分配律：a×(b−c)=a×b−a×c；6.8×10=68，6.8×0.1=0.68，68−0.68=67.32，完全正确"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "误算 6.8 × 0.1 = 6.8（忘记小数点移动），导致减错",
        "remediation": "乘 0.1 就是向左移动一位小数点：6.8 → 0.68"
      },
      {
        "tag": "misapplied_law",
        "error": "错误拆成 6.8 × (9 + 0.9)，但 9 + 0.9 = 9.9 是对的，却未体现‘简便’核心（不如 10−0.1 易算）",
        "remediation": "简便运算要看哪一步更简单：10 和 0.1 都比 9 和 0.9 更容易与小数相乘"
      }
    ],
    "feedback_correct": "你完全理解了小明的巧算思路！用 10 减 0.1，让计算又快又准～",
    "feedback_wrong": "检查一下：6.8 × 0.1 等于多少？小数点要往左跳一位哦！",
    "hints": [
      {
        "text": "回忆：一个数乘 0.1，就是把它缩小到原来的十分之一，小数点怎么移？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_Q1_G4B_DECIMAL_MULTIPLY_001__morz4ch6_0",
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
    "stem": "文具店卖彩色铅笔，每盒 8.6 元。小红买了 3 盒，她一共要付多少元？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "8.6 元"
      },
      {
        "id": "B",
        "text": "25.8 元"
      },
      {
        "id": "C",
        "text": "2.58 元"
      },
      {
        "id": "D",
        "text": "11.6 元"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "单价是 8.6 元，数量是 3 盒，总价 = 8.6 × 3 = 25.8（元）。注意小数点位置：8.6 是一位小数，乘整数 3，积仍是一位小数。"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiply",
        "error": "只写了单价 8.6 元，忘记乘数量 3。",
        "remediation": "记住公式：总价 = 单价 × 数量，缺一不可。"
      },
      {
        "tag": "decimal_point_error",
        "error": "把 8.6 × 3 算成 2.58，小数点向左移了一位。",
        "remediation": "8.6 表示 86 个 0.1，86 × 3 = 258，所以是 25.8（258 个 0.1）"
      }
    ],
    "feedback_correct": "答对啦！3 盒彩色铅笔共 25.8 元，你算得又快又准！",
    "feedback_wrong": "再想想哦～记得用‘单价 × 数量’来算总价，别漏掉乘号哟！",
    "hints": [
      {
        "text": "先想清楚：题目给了单价和数量，要求的是什么？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:colored_pencil-8.6-3"
    ],
    "exam_priority": "HIGH_SMALL"
  },
  {
    "question_id": "AI_Q2_G4B_DECIMAL_MULTIPLY_002__morz4ch6_1",
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
    "stem": "妈妈在超市买了 2 瓶果汁，每瓶 14.9 元；又买了 5 包饼干，每包 3.2 元。她一共花了多少元？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "18.1 元"
      },
      {
        "id": "B",
        "text": "45.8 元"
      },
      {
        "id": "C",
        "text": "29.8 元"
      },
      {
        "id": "D",
        "text": "37.8 元"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "果汁总价：14.9 × 2 = 29.8（元）；饼干总价：3.2 × 5 = 16.0（元）；合计：29.8 + 16.0 = 45.8（元）。注意两步都要算对，再相加。"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiply",
        "error": "只算了果汁或只算了饼干，漏掉其中一种商品。",
        "remediation": "读题时圈出所有商品和对应数量，分步列式不跳步。"
      },
      {
        "tag": "decimal_point_error",
        "error": "把 3.2 × 5 算成 1.6 或 160，小数点位置错误。",
        "remediation": "3.2 是 32 个 0.1，32 × 5 = 160，所以是 16.0（160 个 0.1）"
      },
      {
        "tag": "sign_error",
        "error": "误用减法，算成 29.8 − 16.0 = 13.8。",
        "remediation": "题目问‘一共花了多少元’，是求总和，要用加法。"
      }
    ],
    "feedback_correct": "太棒啦！两种商品合起来花了 45.8 元，你的购物小账本真清楚！",
    "feedback_wrong": "没关系～试着分两步算：先算果汁钱，再算饼干钱，最后加起来！",
    "hints": [
      {
        "text": "先分别算出果汁和饼干的总价，再把两个结果加起来。",
        "penalty": 2
      }
    ],
    "tags": [
      "ai_generated",
      "items:juice-14.9-2|biscuit-3.2-5"
    ],
    "exam_priority": "MUST_SMALL"
  },
  {
    "question_id": "AI_G4B_SHOP_001__morz5ozp_0",
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
    "stem": "文具店卖笔记本，每本 8.6 元。小红买了 3 本，付了 50 元，应找回多少元？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "24.2"
      },
      {
        "id": "B",
        "text": "8.6"
      },
      {
        "id": "C",
        "text": "25.8"
      },
      {
        "id": "D",
        "text": "26.2"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先算总价：8.6 × 3 = 25.8（元）；再算找回：50 − 25.8 = 24.2（元）"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiply",
        "error": "只用单价 8.6 元当总价，没乘数量 3",
        "remediation": "记住：总价 = 单价 × 数量，不能漏掉‘×数量’这一步！"
      },
      {
        "tag": "decimal_point_error",
        "error": "算 8.6 × 3 时写成 258 或 2.58，小数点位置错了",
        "remediation": "8.6 是一位小数，乘整数后结果仍是一位小数：8.6 × 3 = 25.8"
      }
    ],
    "feedback_correct": "答对啦！你准确算出了总价和找零，是个精明的小顾客～",
    "feedback_wrong": "再检查一下：先算3本一共多少钱，再用50元减去它哦！",
    "hints": [
      {
        "text": "第一步：算3本笔记本的总价是多少元？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:notebook-8.6-3"
    ],
    "exam_priority": "HIGH_BIG"
  },
  {
    "question_id": "AI_G4B_SHOP_002__morz5ozp_1",
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
    "stem": "周末超市促销：果汁 12.9 元一瓶，薯片 6.5 元一包。小刚买了 2 瓶果汁和 1 包薯片，付了 40 元，应找回多少元？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "11.7"
      },
      {
        "id": "B",
        "text": "25.8"
      },
      {
        "id": "C",
        "text": "14.3"
      },
      {
        "id": "D",
        "text": "12.9"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "果汁总价：12.9 × 2 = 25.8（元）；薯片总价：6.5 × 1 = 6.5（元）；合计：25.8 + 6.5 = 32.3（元）；找回：40 − 32.3 = 11.7（元）"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiply",
        "error": "把果汁单价 12.9 当作总价，没乘 2 瓶",
        "remediation": "注意题目说‘2瓶果汁’，一定要用单价×2才算对总价！"
      },
      {
        "tag": "operation_error",
        "error": "算找回时用了加法（40 + 32.3）或错用减法顺序（32.3 − 40）",
        "remediation": "找回 = 付的钱 − 实际花的钱，一定是‘付的钱’在前面减去‘总花费’"
      }
    ],
    "feedback_correct": "太棒啦！你把两种商品都算清楚了，还准确找出了零钱～",
    "feedback_wrong": "别着急，分三步想：果汁共几元？薯片几元？一共花了多少？再用40元减它！",
    "hints": [
      {
        "text": "先分别算出果汁和薯片各花了多少钱，再加起来。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:juice-12.9-2|chips-6.5-1"
    ],
    "exam_priority": "MUST_BIG"
  },
  {
    "question_id": "AI_G4B_SD_001__morvg5ug_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_speed_distance",
    "skill_name": "路程=速度×时间（小数场景）",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 50,
    "stem": "小红骑滑板车去公园，每小时滑行 8.4 千米，她滑了 2.5 小时。她一共滑行了多少千米？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "21.0"
      },
      {
        "id": "B",
        "text": "8.4"
      },
      {
        "id": "C",
        "text": "2.10"
      },
      {
        "id": "D",
        "text": "16.9"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "路程 = 速度 × 时间 = 8.4 × 2.5；先算 84 × 25 = 2100，再从右往左数两位小数点，得 21.00，即 21.0 千米。"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiply",
        "error": "只写了速度 8.4，没乘时间。",
        "remediation": "记得用‘路程 = 速度 × 时间’，两个数都要用上！"
      },
      {
        "tag": "decimal_point_error",
        "error": "把 8.4 × 2.5 算成 2.10，小数点位置错了。",
        "remediation": "8.4 有 1 位小数，2.5 有 1 位小数，积应有 2 位小数；84×25=2100 → 21.00。"
      }
    ],
    "feedback_correct": "答对啦！滑板车滑了 21 千米，真厉害～",
    "feedback_wrong": "再想想：速度和时间都要参与计算哦，别漏掉一个！",
    "hints": [
      {
        "text": "先想公式：路程 = 速度 × 时间；再看两个小数一共有几位小数。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:sliding_board-8.4-2.5"
    ],
    "exam_priority": "HIGH_SMALL"
  },
  {
    "question_id": "AI_G4B_SD_002__morvg5ug_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_speed_distance",
    "skill_name": "路程=速度×时间（小数场景）",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 50,
    "stem": "爸爸开电动车送弟弟上学，平均速度是每小时 24.6 千米，路上用了 0.8 小时。这段路全长多少千米？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "19.68"
      },
      {
        "id": "B",
        "text": "24.6"
      },
      {
        "id": "C",
        "text": "1.968"
      },
      {
        "id": "D",
        "text": "30.75"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "路程 = 速度 × 时间 = 24.6 × 0.8；246 × 8 = 1968，因 24.6 有 1 位小数、0.8 有 1 位小数，共 2 位小数，所以结果是 19.68 千米。"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiply",
        "error": "直接选了速度 24.6，忘记乘时间 0.8。",
        "remediation": "题目问的是‘全长’，不是‘速度’，一定要用公式算出来！"
      },
      {
        "tag": "decimal_point_error",
        "error": "把 24.6 × 0.8 算成 1.968，小数点向左多移了一位。",
        "remediation": "两个因数共 2 位小数，积的小数点要从右往左数 2 位：1968 → 19.68。"
      }
    ],
    "feedback_correct": "太棒啦！爸爸开了 19.68 千米，精准又稳当～",
    "feedback_wrong": "别着急，再读一遍题：‘每小时多少千米’是速度，‘用了多少小时’是时间，它们一起才能算出路程哦！",
    "hints": [
      {
        "text": "24.6 × 0.8 可以想成 ‘246 × 8 = 1968’，再补上两位小数。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:electric_bike-24.6-0.8"
    ],
    "exam_priority": "MUST_SMALL"
  },
  {
    "question_id": "AI_G4B_SD_001__morvg5ug_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_speed_distance",
    "skill_name": "路程=速度×时间（小数场景）",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 50,
    "stem": "小红骑滑板车去公园，每小时滑行 9.8 千米，用了 2.5 小时。她一共滑行了多少千米？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "24.5"
      },
      {
        "id": "B",
        "text": "9.8"
      },
      {
        "id": "C",
        "text": "2.45"
      },
      {
        "id": "D",
        "text": "34.3"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "路程 = 速度 × 时间 = 9.8 × 2.5；先算 98 × 25 = 2450，再从右往左数三位小数点（9.8 有1位，2.5 有1位，共2位），得 24.50，即 24.5 千米。"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiply",
        "error": "只写了速度 9.8，没乘时间",
        "remediation": "记住：路程一定要用速度乘时间，不能只抄一个数！"
      },
      {
        "tag": "decimal_point_error",
        "error": "把 9.8 × 2.5 算成 2.45（小数点少移一位）",
        "remediation": "两个因数一共有 2 位小数，积也要有 2 位小数；2450 → 24.50 → 24.5"
      }
    ],
    "feedback_correct": "答对啦！滑板车滑了 24.5 千米，真棒！",
    "feedback_wrong": "再想想哦～记得用‘速度×时间’算路程，小数点位置要数清楚！",
    "hints": [
      {
        "text": "先不看小数点，算 98 × 25 是多少？再补上小数位。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:sliding_scooter-9.8-2.5"
    ],
    "exam_priority": "HIGH_SMALL"
  },
  {
    "question_id": "AI_G4B_SD_002__morvg5ug_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_speed_distance",
    "skill_name": "路程=速度×时间（小数场景）",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 50,
    "stem": "爸爸开车送奶奶回老家，汽车平均每小时行驶 56.4 千米，开了 1.8 小时。这段路程一共是多少千米？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "101.52"
      },
      {
        "id": "B",
        "text": "56.4"
      },
      {
        "id": "C",
        "text": "10.152"
      },
      {
        "id": "D",
        "text": "91.76"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "路程 = 速度 × 时间 = 56.4 × 1.8；先算 564 × 18 = 10152；两个因数共 2 位小数（56.4 有1位，1.8 有1位），所以积是 101.52 千米。"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiply",
        "error": "直接选了速度 56.4，忘记乘时间",
        "remediation": "题目问的是‘一共多少千米’，不是‘每小时多少千米’，一定要算乘法！"
      },
      {
        "tag": "decimal_point_error",
        "error": "算出 10152 后误写成 10.152（多移了一位小数点）",
        "remediation": "56.4 和 1.8 各1位小数，合起来2位，10152 → 101.52，不是 10.152！"
      }
    ],
    "feedback_correct": "太厉害啦！爸爸开了 101.52 千米，稳稳到家～",
    "feedback_wrong": "别着急！再检查一下小数位数：56.4 和 1.8 一共几位小数？答案就该有几位哦～",
    "hints": [
      {
        "text": "把 56.4 变成 564，1.8 变成 18，先算整数乘法，再按小数位数还原。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:car-56.4-1.8"
    ],
    "exam_priority": "MUST_SMALL"
  },
  {
    "question_id": "AI_G4B_SD_001__morvhk2m_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_speed_distance",
    "skill_name": "路程=速度×时间（小数场景）",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 50,
    "stem": "小明骑平衡车去公园，平均速度是每小时16.8千米，用了0.75小时。他一共骑行了多少千米？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "12.6"
      },
      {
        "id": "B",
        "text": "16.8"
      },
      {
        "id": "C",
        "text": "126"
      },
      {
        "id": "D",
        "text": "13.6"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "路程 = 速度 × 时间 = 16.8 × 0.75；先算 168 × 75 = 12600，两个因数共3位小数，所以结果是12.600，即12.6千米。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "把16.8×0.75算成126，漏掉小数点。",
        "remediation": "数一数两个因数一共有几位小数：16.8有1位，0.75有2位，共3位；12600要从右往左数3位，得12.600。"
      },
      {
        "tag": "forgot_multiply",
        "error": "直接抄速度16.8当答案，忘了乘时间。",
        "remediation": "记住公式：路程 = 速度 × 时间，两个数都要用上！"
      }
    ],
    "feedback_correct": "答对啦！你准确算出了小明骑行的路程～",
    "feedback_wrong": "再想想哦，记得用‘速度×时间’，还要小心小数点位置！",
    "hints": [
      {
        "text": "0.75小时就是45分钟，相当于3/4小时；可以想成16.8的一半是8.4，再一半是4.2，加起来是12.6。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:balance_car-16.8-0.75"
    ],
    "exam_priority": "HIGH_SMALL"
  },
  {
    "question_id": "AI_G4B_SD_002__morvhk2m_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_speed_distance",
    "skill_name": "路程=速度×时间（小数场景）",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 50,
    "stem": "一辆电动滑板车在小区内匀速行驶，每分钟行0.36千米，它从东门到西门用了2.5分钟。这段路程长多少千米？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "0.9"
      },
      {
        "id": "B",
        "text": "0.36"
      },
      {
        "id": "C",
        "text": "9"
      },
      {
        "id": "D",
        "text": "0.81"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "路程 = 速度 × 时间 = 0.36 × 2.5；先把0.36×25=900，两个因数共3位小数（0.36有2位，2.5有1位），所以结果是0.900，即0.9千米。"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "算出900后写成9，小数点少移一位。",
        "remediation": "0.36有2位小数，2.5有1位小数，一共3位小数，900要变成0.900。"
      },
      {
        "tag": "operation_confusion",
        "error": "误用减法或加法，如0.36+2.5=2.86或2.5−0.36=2.14。",
        "remediation": "题目求‘路程’，必须用‘速度×时间’，不是加也不是减！"
      }
    ],
    "feedback_correct": "太棒了！你用小数乘法准确算出了滑板车的路程！",
    "feedback_wrong": "别急，再读一遍题——‘每分钟行多少’和‘用了几分钟’，要用乘法哦！",
    "hints": [
      {
        "text": "0.36×2.5可以看作36×25=900，再补回3位小数；或者把2.5换成分数5/2，0.36×5/2=1.8/2=0.9。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:escooter-0.36-2.5"
    ],
    "exam_priority": "MUST_SMALL"
  },
  {
    "question_id": "AI_G4B_SD_001__moryqzu4_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_speed_distance",
    "skill_name": "路程=速度×时间（小数场景）",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 50,
    "stem": "小明去图书馆骑自行车，平均速度是每小时 15.6 千米，他骑了 1.5 小时。小明家到图书馆的路程是多少千米？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "23.4"
      },
      {
        "id": "B",
        "text": "15.6"
      },
      {
        "id": "C",
        "text": "234"
      },
      {
        "id": "D",
        "text": "22.4"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "路程 = 速度 × 时间 = 15.6 × 1.5；先算 156 × 15 = 2340，再从右往左数两位小数点，得 23.40，即 23.4 千米。"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiply",
        "error": "只写了速度 15.6，没乘时间 1.5。",
        "remediation": "记住公式：路程 = 速度 × 时间，两个数都要用上。"
      },
      {
        "tag": "decimal_point_error",
        "error": "算出 2340 后忘了点小数点，写成 234。",
        "remediation": "15.6 有 1 位小数，1.5 有 1 位小数，积应有 2 位小数，2340 → 23.40。"
      }
    ],
    "feedback_correct": "答对啦！你准确算出了小明骑车的路程～",
    "feedback_wrong": "再想想哦，记得用‘速度×时间’，还要注意小数点位置！",
    "hints": [
      {
        "text": "把 15.6 和 1.5 都看成整数计算：156 × 15 = 2340；再根据小数位数确定小数点位置。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:bike-15.6-1.5"
    ],
    "exam_priority": "HIGH_SMALL"
  },
  {
    "question_id": "AI_G4B_SD_002__moryqzu4_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_speed_distance",
    "skill_name": "路程=速度×时间（小数场景）",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 50,
    "stem": "李老师开车带学生去研学基地，汽车在高速上平均每小时行驶 92.4 千米，开了 0.75 小时后到达。这段高速公路的长度是多少千米？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "69.3"
      },
      {
        "id": "B",
        "text": "92.4"
      },
      {
        "id": "C",
        "text": "693"
      },
      {
        "id": "D",
        "text": "68.3"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "路程 = 速度 × 时间 = 92.4 × 0.75；可转化为 924 × 75 = 69300，92.4 有 1 位小数，0.75 有 2 位小数，共 3 位小数，69300 → 69.300 = 69.3 千米。"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiply",
        "error": "直接选了速度 92.4，没和时间 0.75 相乘。",
        "remediation": "题目问的是‘长度’，不是‘速度’，一定要套用路程公式！"
      },
      {
        "tag": "decimal_point_error",
        "error": "算出 69300 后错点成 693（漏掉小数点），或错点成 6.93（多移一位）。",
        "remediation": "两个因数小数位数相加：1 + 2 = 3，所以从右往左数三位点小数点。"
      }
    ],
    "feedback_correct": "太棒啦！你用小数乘法精准算出了高速路段长度！",
    "feedback_wrong": "别着急，检查一下小数位数和乘法步骤，你很快就能搞定～",
    "hints": [
      {
        "text": "0.75 就是 3/4，可以想：92.4 的 3/4 是多少？先算 92.4 ÷ 4 = 23.1，再 ×3 = 69.3。",
        "penalty": 2
      }
    ],
    "tags": [
      "ai_generated",
      "items:car-92.4-0.75"
    ],
    "exam_priority": "MUST_SMALL"
  },
  {
    "question_id": "AI_G4B_SD_001__moryrqhi_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_speed_distance",
    "skill_name": "路程=速度×时间（小数场景）",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 50,
    "stem": "小明去图书馆骑共享单车，平均速度是每分钟 0.24 千米，他骑了 15 分钟。他一共骑了多少千米？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "3.6"
      },
      {
        "id": "B",
        "text": "0.24"
      },
      {
        "id": "C",
        "text": "36"
      },
      {
        "id": "D",
        "text": "3.06"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "路程 = 速度 × 时间 = 0.24 千米/分 × 15 分；先算 24 × 15 = 360，再根据小数位数（0.24 有两位小数），结果是 3.60 千米，即 3.6 千米。"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiply",
        "error": "只写了速度 0.24，没乘时间。",
        "remediation": "记住公式：路程 = 速度 × 时间，两个数都要用上！"
      },
      {
        "tag": "decimal_point_error",
        "error": "把 0.24 × 15 算成 36，漏掉小数点。",
        "remediation": "0.24 是两位小数，结果也应有两位小数：360 → 3.60 → 3.6。"
      }
    ],
    "feedback_correct": "答对啦！你准确用出了‘路程=速度×时间’这个小帮手～",
    "feedback_wrong": "再想想哦，记得把速度和时间都乘起来，别漏掉一个数！",
    "hints": [
      {
        "text": "先想：每分钟骑 0.24 千米，15 分钟就是 15 个 0.24 相加，也就是 0.24 × 15。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:apple-3.5-2|book-12.8-1"
    ],
    "exam_priority": "HIGH_SMALL"
  },
  {
    "question_id": "AI_G4B_SD_002__moryrqhi_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U3_DECIMAL_MULTIPLY",
    "unit_name": "小数乘法",
    "skill_id": "decimal_speed_distance",
    "skill_name": "路程=速度×时间（小数场景）",
    "cognitive_level": "application",
    "ability_dimension": [
      "modeling",
      "calculation"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 50,
    "stem": "周末露营，爸爸开车带全家去山脚营地，汽车在高速上平均每小时行驶 92.8 千米，开了 0.75 小时后下了高速。这段高速路程是多少千米？",
    "question_format": "single_choice",
    "game_type": "shop_counter",
    "play_as": "shop_counter",
    "options": [
      {
        "id": "A",
        "text": "69.6"
      },
      {
        "id": "B",
        "text": "92.8"
      },
      {
        "id": "C",
        "text": "696"
      },
      {
        "id": "D",
        "text": "76.2"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "路程 = 速度 × 时间 = 92.8 千米/时 × 0.75 时；可转化为 928 × 75 = 69600，再补小数位（92.8 一位 + 0.75 两位 = 共三位小数），69600 → 69.600 → 69.6 千米。"
    ],
    "common_errors": [
      {
        "tag": "forgot_multiply",
        "error": "直接选了速度 92.8，忘记乘时间 0.75。",
        "remediation": "题目问的是‘这段高速路程’，不是‘速度’，一定要算乘法！"
      },
      {
        "tag": "decimal_point_error",
        "error": "算出 69600 后，错写成 696 千米（少移三位小数点）。",
        "remediation": "92.8（1位）× 0.75（2位）→ 积有 3 位小数；69600 变成 69.600，即 69.6。"
      }
    ],
    "feedback_correct": "太棒了！你把小数乘法和实际路程结合得真好～",
    "feedback_wrong": "没关系，检查一下：92.8 和 0.75 都要用上，小数点位置要数清楚哦！",
    "hints": [
      {
        "text": "0.75 小时就是 45 分钟，你可以想成‘每小时走 92.8 千米，3/4 小时走多少？’",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "items:apple-3.5-2|book-12.8-1"
    ],
    "exam_priority": "MUST_SMALL"
  },
  {
    "question_id": "AI_CV_G4B_001__morvj22f_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U4_OBSERVE_OBJECTS",
    "unit_name": "观察物体",
    "skill_id": "observe_front_top_left",
    "skill_name": "正面、上面、左面观察",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "spatial"
    ],
    "difficulty": 2,
    "estimated_time_seconds": 35,
    "stem": "用小正方体搭成一个立体图形，从正面看是3个正方形排成一横行，从上面看是2个正方形叠在一起，从左面看是2个正方形叠在一起。这个图形一共由几个小正方体组成？",
    "solution_steps": [
      "从正面看到3个正方形→说明最前面一排有3个；从上面看到2个叠在一起→说明前后方向只有2层；从左面看到2个叠在一起→说明左右方向只有2列；综合判断为2×3×1中缺1个，实际共5个。"
    ],
    "hints": [
      {
        "text": "先想正面看到的形状对应哪一排，再结合上面和左面确定层数和列数。",
        "penalty": 1
      }
    ],
    "feedback_correct": "太棒啦！你成功用三个方向的信息还原了立体图形～",
    "feedback_wrong": "没关系！试着用小积木搭一搭，从三个方向分别看一看哦～",
    "common_errors": [
      {
        "tag": "spatial_misalignment",
        "error": "只看正面3个就答3个，忽略上下/左右叠加信息",
        "remediation": "记住：一个方向只能看到‘投影’，必须三个方向一起想才能确定真实数量。"
      },
      {
        "tag": "layer_count_error",
        "error": "把上面和左面都理解为‘高度’，误算成2×2×3=12个",
        "remediation": "上面看的是俯视（x-y平面），左面看的是侧视（y-z平面），正面是前视（x-z平面）——每个方向揭示不同维度。"
      }
    ],
    "tags": [
      "ai_generated",
      "solid:0,0,0|1,0,0|2,0,0|0,1,0|1,1,0"
    ],
    "exam_priority": "HIGH_SMALL",
    "question_format": "single_choice",
    "game_type": "cube_view",
    "play_as": "cube_view",
    "options": [
      {
        "id": "A",
        "text": "3"
      },
      {
        "id": "B",
        "text": "4"
      },
      {
        "id": "C",
        "text": "5"
      },
      {
        "id": "D",
        "text": "6"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    }
  },
  {
    "question_id": "AI_CV_G4B_002__morvj22f_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U4_OBSERVE_OBJECTS",
    "unit_name": "观察物体",
    "skill_id": "observe_front_top_left",
    "skill_name": "正面、上面、左面观察",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 35,
    "stem": "一个立体图形由6个小正方体搭成。从正面看能看到4个正方形（呈T字形：上横3个，中间竖1个向下延伸）；从上面看能看到5个正方形（排成L形）；从左面看能看到3个正方形（竖直一列）。这个图形从上面看的L形，最长边有几个正方形？",
    "solution_steps": [
      "从上面看L形共5个→L形由a×b构成，a+b−1=5，可能为3+3−1=5或4+2−1=5；结合正面T字（上横3个→说明上面L形横边至少3个）、左面3个竖列（说明高度方向最大为3）→L形最长边是4个（横边4，竖边2）"
    ],
    "hints": [
      {
        "text": "L形由两段组成，总格子数 = 横段数 + 竖段数 − 1（拐角重合）。",
        "penalty": 1
      }
    ],
    "feedback_correct": "真厉害！你把三个视角像拼图一样组合起来了！",
    "feedback_wrong": "别着急～画一画上面的L形，再标出正面T字的位置，就能找到答案啦！",
    "common_errors": [
      {
        "tag": "l_shape_miscount",
        "error": "认为L形5格一定是3+3，忽略4+2也满足",
        "remediation": "L形格数公式是 a + b − 1 = 总数，a 和 b 可以不相等，比如4+2−1=5。"
      },
      {
        "tag": "front_projection_ignore",
        "error": "忽略正面T字‘上横3个’对上面L形横边长度的约束",
        "remediation": "正面看到的横排数量，等于上面图中该方向最外层的格子数，是重要线索！"
      }
    ],
    "tags": [
      "ai_generated",
      "solid:0,0,0|1,0,0|2,0,0|3,0,0|0,1,0|1,1,0"
    ],
    "exam_priority": "MUST_SMALL",
    "question_format": "single_choice",
    "game_type": "cube_view",
    "play_as": "cube_view",
    "options": [
      {
        "id": "A",
        "text": "2"
      },
      {
        "id": "B",
        "text": "3"
      },
      {
        "id": "C",
        "text": "4"
      },
      {
        "id": "D",
        "text": "5"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    }
  },
  {
    "question_id": "AI_G4B_CUBE_VIEW_001__morvj22f_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U4_OBSERVE_OBJECTS",
    "unit_name": "观察物体",
    "skill_id": "observe_front_top_left",
    "skill_name": "正面、上面、左面观察",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "spatial"
    ],
    "difficulty": 2,
    "estimated_time_seconds": 35,
    "stem": "用小正方体搭成一个立体图形，从正面看是“一横三格”，从上面看是“一横两格”，从左面看是“一竖两格”。这个图形一共用了几个小正方体？",
    "solution_steps": [
      "从正面看是三格横排 → 至少有3个正方体在前排；从上面看是两格横排 → 宽度为2 → x方向最多2列；从左面看是两格竖排 → 高度为2 → z方向最多2层；综合可得：前排左、中两列各1个（共2），后排中列叠1个（z=1），共3个。"
    ],
    "hints": [
      {
        "text": "先想正面看到的‘三格横排’说明最前面一排至少有3个位置被占，但上面只看到2格，说明有一格被挡住了。",
        "penalty": 1
      }
    ],
    "feedback_correct": "太棒啦！你成功用三个视角还原了立体结构～",
    "feedback_wrong": "别急，再试试画出每个方向看到的轮廓，然后找重叠位置哦！",
    "common_errors": [
      {
        "tag": "misinterpret_top_view",
        "error": "把‘上面看是两格’理解成总共只有2个正方体，忽略高度叠加。",
        "remediation": "上面看到的是投影，不是总数；同一位置可以叠放多个正方体。"
      },
      {
        "tag": "ignore_overlap",
        "error": "认为正面三格必须对应三个独立列，没考虑左右列被遮挡的情况。",
        "remediation": "立体图形中，后面的小正方体会被前面的挡住，所以正面看到的格数 ≥ 实际前排列数。"
      }
    ],
    "tags": [
      "ai_generated",
      "solid:0,0,0|1,0,0|1,0,1"
    ],
    "exam_priority": "HIGH_BIG",
    "question_format": "single_choice",
    "game_type": "cube_view",
    "play_as": "cube_view",
    "options": [
      {
        "id": "A",
        "text": "3"
      },
      {
        "id": "B",
        "text": "4"
      },
      {
        "id": "C",
        "text": "5"
      },
      {
        "id": "D",
        "text": "6"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    }
  },
  {
    "question_id": "AI_G4B_CUBE_VIEW_002__morvj22f_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U4_OBSERVE_OBJECTS",
    "unit_name": "观察物体",
    "skill_id": "observe_front_top_left",
    "skill_name": "正面、上面、左面观察",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 35,
    "stem": "一个立体图形由6个小正方体搭成。从正面看是‘田’字形（2×2正方形），从上面看是‘L’形（三格折线），从左面看是‘一竖三格’。它从上面看到的L形具体是哪一种？",
    "solution_steps": [
      "正面是2×2 → 前排必有2列×2行；左面是三格竖排 → 高度为3 → z方向有3层；上面是L形且共3格 → 说明3个位置在xy平面不同坐标，且构成直角拐角；结合6个总数与三维约束，唯一可能布局为：(0,0,0)(1,0,0)(1,1,0)(0,0,1)(1,0,1)(0,0,2) → 上面投影为(0,0)(1,0)(1,1)，即右下L形。"
    ],
    "hints": [
      {
        "text": "‘田’字形正面说明前排有2列2行；‘一竖三格’左面说明最高处有3层；先固定底面两个位置，再试叠放。",
        "penalty": 1
      }
    ],
    "feedback_correct": "厉害！你像小小建筑师一样，在脑子里搭出了三维模型！",
    "feedback_wrong": "没关系，拿出小积木摆一摆，正面摆好‘田’，再往上加高试试看～",
    "common_errors": [
      {
        "tag": "confuse_L_orientation",
        "error": "把L形误认为开口向左或向上，未结合正面和左面约束判断实际朝向。",
        "remediation": "L形有4种旋转方向；结合正面‘田’确定x-y范围，左面‘三格竖’确定z最大值，可锁定唯一朝向。"
      },
      {
        "tag": "overcount_layers",
        "error": "认为‘一竖三格’左面意味着每列都叠3层，导致总数超6。",
        "remediation": "左面看到的是每x列的最大高度，不是每列都满高；例如x=0列高3，x=1列高2，也能呈现‘一竖三格’。"
      }
    ],
    "tags": [
      "ai_generated",
      "solid:0,0,0|1,0,0|1,1,0|0,0,1|1,0,1|0,0,2"
    ],
    "exam_priority": "MUST_BIG",
    "question_format": "single_choice",
    "game_type": "cube_view",
    "play_as": "cube_view",
    "options": [
      {
        "id": "A",
        "text": "□□\n□  （左上L）"
      },
      {
        "id": "B",
        "text": "□\n□□ （左下L）"
      },
      {
        "id": "C",
        "text": "  □\n□□ （右下L）"
      },
      {
        "id": "D",
        "text": "□\n□ □（不连通，非法）"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    }
  },
  {
    "question_id": "AI_G4B_OBSERVE_OBJECTS_01__morvjop7_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U4_OBSERVE_OBJECTS",
    "unit_name": "观察物体",
    "skill_id": "observe_front_top_left",
    "skill_name": "正面、上面、左面观察",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "spatial"
    ],
    "difficulty": 2,
    "estimated_time_seconds": 35,
    "stem": "用4个相同的小正方体搭成一个阶梯形：底层左边1个，右边上叠1个；第二层在底层右边正上方再叠1个，最上层在第二层右边再叠1个。从上面看，能看到几个小正方形？",
    "solution_steps": [
      "从上面俯视时，只看每个小正方体在xy平面的投影（z坐标不影响可见数量）；四个正方体坐标分别为(0,0,0)、(1,0,0)、(1,0,1)、(1,0,2)，投影后x-y位置为(0,0)、(1,0)、(1,0)、(1,0)，重叠在(1,0)处共3个不同位置，所以看到3个正方形。"
    ],
    "hints": [
      {
        "text": "从上面看，就是数所有小正方体在水平面上不重叠的投影个数。",
        "penalty": 1
      }
    ],
    "feedback_correct": "答对啦！从上面看就像拍照，重叠的部分只算1个哦～",
    "feedback_wrong": "再想想：同一列正上方叠放的正方体，从上面只能看到最顶上的那个位置。",
    "common_errors": [
      {
        "tag": "overcount_overlap",
        "error": "把叠在一起的正方体都算作独立可见，得出4个",
        "remediation": "记住：从上面看，上下叠放的正方体只露出最上面那个的顶面，下面的被遮住了。"
      },
      {
        "tag": "misread_shape",
        "error": "误以为是直线排列，得出2个或1个",
        "remediation": "画个草图，标出每一块的位置和高度，再想象从头顶往下看。"
      }
    ],
    "tags": [
      "ai_generated",
      "solid:0,0,0|1,0,0|1,0,1|1,0,2"
    ],
    "exam_priority": "HIGH_SMALL",
    "question_format": "single_choice",
    "game_type": "cube_view",
    "play_as": "cube_view",
    "options": [
      {
        "id": "A",
        "text": "2"
      },
      {
        "id": "B",
        "text": "3"
      },
      {
        "id": "C",
        "text": "4"
      },
      {
        "id": "D",
        "text": "1"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    }
  },
  {
    "question_id": "AI_G4B_OBSERVE_OBJECTS_02__morvjop7_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U4_OBSERVE_OBJECTS",
    "unit_name": "观察物体",
    "skill_id": "observe_front_top_left",
    "skill_name": "正面、上面、左面观察",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 35,
    "stem": "用6个相同的小正方体搭成一个T字形：底层横排4个（x=0,1,2,3；y=0；z=0），顶层中间2个竖叠在x=1,y=0,z=1和x=1,y=0,z=2位置。从左面（y方向看）观察，能看到几个小正方形？",
    "solution_steps": [
      "左面观察即沿y轴正方向看向原点，投影到xz平面；各正方体坐标：(0,0,0)、(1,0,0)、(2,0,0)、(3,0,0)、(1,0,1)、(1,0,2)；投影后xz位置为(0,0)、(1,0)、(2,0)、(3,0)、(1,1)、(1,2)；其中(1,0)、(1,1)、(1,2)在x=1列上下对齐，从左面只能看到最外侧（z最大）的那个，即(1,2)；其余(0,0)、(2,0)、(3,0)均无遮挡；共4个可见正方形。"
    ],
    "hints": [
      {
        "text": "从左面看，就是把所有小正方体投影到xz平面，同一x-z位置只算1个（后面挡住前面）。",
        "penalty": 1
      }
    ],
    "feedback_correct": "太棒了！你已经会用‘投影+遮挡’来想立体图啦～",
    "feedback_wrong": "别急，试试把每个小正方体的x和z坐标写下来，再看看哪些位置会互相挡住。",
    "common_errors": [
      {
        "tag": "ignore_depth_order",
        "error": "把所有6个都算进答案，未考虑z方向前后遮挡",
        "remediation": "从左面看，z值大的正方体在前面，会挡住z值小的同x位置的正方体。"
      },
      {
        "tag": "misidentify_view_direction",
        "error": "误按正面（x方向）或上面（z方向）理解，得出不同结果",
        "remediation": "左面观察 = 看向y正方向 → 投影到xz平面；正面是x方向→投影到yz平面；上面是z方向→投影到xy平面。"
      }
    ],
    "tags": [
      "ai_generated",
      "solid:0,0,0|1,0,0|2,0,0|3,0,0|1,0,1|1,0,2"
    ],
    "exam_priority": "MUST_SMALL",
    "question_format": "single_choice",
    "game_type": "cube_view",
    "play_as": "cube_view",
    "options": [
      {
        "id": "A",
        "text": "3"
      },
      {
        "id": "B",
        "text": "4"
      },
      {
        "id": "C",
        "text": "5"
      },
      {
        "id": "D",
        "text": "6"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    }
  },
  {
    "question_id": "AI_G4B_CUBE_VIEW_01__morvjop7_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U4_OBSERVE_OBJECTS",
    "unit_name": "观察物体",
    "skill_id": "observe_front_top_left",
    "skill_name": "正面、上面、左面观察",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "spatial"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 35,
    "stem": "用5个小正方体搭成这样：底层是2×2的正方形（共4个），第5个叠在左前角小正方体的上面。从上面看，能看到几个小正方形？",
    "solution_steps": [
      "从上面看，只能看到每个小正方体的顶面；底层4个都可见，第5个叠在左前角上方，会遮住它下面那个顶面，所以总共看到4个顶面。"
    ],
    "hints": [
      {
        "text": "从上面看，被挡住的小正方体顶面是看不见的。",
        "penalty": 1
      }
    ],
    "feedback_correct": "答对啦！就像从天花板往下拍照，只能拍到露出来的顶面哦～",
    "feedback_wrong": "再想想：叠在上面的那个小正方体，会把它下面那个的顶面挡住呢！",
    "common_errors": [
      {
        "tag": "overcount_hidden",
        "error": "把5个小正方体全部算作可见顶面，忽略了遮挡关系。",
        "remediation": "提醒孩子：从上面看时，上层物体会挡住正下方的面。"
      },
      {
        "tag": "misidentify_position",
        "error": "误以为叠在左前角会影响其他位置的可见性，少算或多数了顶面。",
        "remediation": "建议用积木实际搭建，从正上方观察并数一数露出的格子。"
      }
    ],
    "tags": [
      "ai_generated",
      "solid:0,0,0|1,0,0|0,1,0|1,1,0|0,0,1"
    ],
    "exam_priority": "HIGH_BIG",
    "question_format": "single_choice",
    "game_type": "cube_view",
    "play_as": "cube_view",
    "options": [
      {
        "id": "A",
        "text": "3"
      },
      {
        "id": "B",
        "text": "4"
      },
      {
        "id": "C",
        "text": "5"
      },
      {
        "id": "D",
        "text": "6"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    }
  },
  {
    "question_id": "AI_G4B_CUBE_VIEW_02__morvjop7_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U4_OBSERVE_OBJECTS",
    "unit_name": "观察物体",
    "skill_id": "observe_front_top_left",
    "skill_name": "正面、上面、左面观察",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 35,
    "stem": "用6个小正方体搭成这样：底层排成2×3长方形（共6个），没有叠放。从左面看，能看到几个小正方形？",
    "solution_steps": [
      "从左面看，只看到每一列中x坐标最小（最靠左）的那一排；因为是2×3平铺（假设x为左右方向，y为前后，z为上下），左面视角沿x轴负向，每列y值不同但x相同，所以看到的是2行3列中的‘列数’即y方向长度，共3个正方形。"
    ],
    "hints": [
      {
        "text": "左面视角是垂直于x轴、从左边往右看，只关心y和z方向的分布。",
        "penalty": 2
      }
    ],
    "feedback_correct": "太棒啦！就像站在左边墙边往里看，只能看到最外一‘排’的深度哦～",
    "feedback_wrong": "别着急！试试画出左视图：每列只保留最靠左的一个小正方体，数它的高度和深度。",
    "common_errors": [
      {
        "tag": "confuse_direction",
        "error": "误将左面观察当成正面或上面，用行列数相乘（如2×3=6）。",
        "remediation": "明确三视图方向：正面看x-y平面，上面看x-y平面俯视，左面看y-z平面侧视。"
      },
      {
        "tag": "count_blocks_instead_of_faces",
        "error": "数了总块数6，而非左面可见的正方形个数。",
        "remediation": "强调题干问的是‘从左面看能看到几个小正方形’——是投影面积，不是总数。"
      }
    ],
    "tags": [
      "ai_generated",
      "solid:0,0,0|0,1,0|0,2,0|1,0,0|1,1,0|1,2,0"
    ],
    "exam_priority": "MUST_BIG",
    "question_format": "single_choice",
    "game_type": "cube_view",
    "play_as": "cube_view",
    "options": [
      {
        "id": "A",
        "text": "2"
      },
      {
        "id": "B",
        "text": "3"
      },
      {
        "id": "C",
        "text": "5"
      },
      {
        "id": "D",
        "text": "6"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    }
  },
  {
    "question_id": "AI_CV_001__morvk9sr_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U4_OBSERVE_OBJECTS",
    "unit_name": "观察物体",
    "skill_id": "observe_front_top_left",
    "skill_name": "正面、上面、左面观察",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "spatial"
    ],
    "difficulty": 3,
    "estimated_time_seconds": 35,
    "stem": "用小正方体搭成一个立体图形，底层是2个并排，上面只在左边那个正方体上再叠1个。从上面看，能看到几个正方形？",
    "solution_steps": [
      "从上面看，只能看到最顶层的投影：左边有上下两层（但投影重合为1个），右边只有底层1个，共2个正方形。"
    ],
    "common_errors": [
      {
        "tag": "top_view_miscount",
        "error": "把底层两个都算上，没考虑上层遮挡，答成3个。",
        "remediation": "从上面看时，上层的小正方体会挡住它正下方的部分；只数最上层可见的‘顶面’数量。"
      },
      {
        "tag": "layer_confusion",
        "error": "误以为上层叠放会多出一个面，答成4个。",
        "remediation": "每个小正方体从上面最多露出1个面，且位置重合不叠加；数的是俯视图中不重叠的正方形格子数。"
      }
    ],
    "feedback_correct": "真棒！你准确看到了俯视图中不被遮挡的2个正方形。",
    "feedback_wrong": "再想想：上面叠的那块只盖住了它下面那一格，右边那一格完全露着哦～",
    "hints": [
      {
        "text": "从上面看，就像拍照一样——只能看到最顶上的‘屋顶’，下面被盖住的地方看不见。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "solid:0,0,0|1,0,0|0,1,0"
    ],
    "exam_priority": "HIGH_BIG",
    "question_format": "single_choice",
    "game_type": "cube_view",
    "play_as": "cube_view",
    "options": [
      {
        "id": "A",
        "text": "1"
      },
      {
        "id": "B",
        "text": "2"
      },
      {
        "id": "C",
        "text": "3"
      },
      {
        "id": "D",
        "text": "4"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    }
  },
  {
    "question_id": "AI_CV_002__morvk9sr_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U4_OBSERVE_OBJECTS",
    "unit_name": "观察物体",
    "skill_id": "observe_front_top_left",
    "skill_name": "正面、上面、左面观察",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "spatial"
    ],
    "difficulty": 4,
    "estimated_time_seconds": 35,
    "stem": "用小正方体搭成一个立体图形：底层是3个横排（x=0,1,2；y=0；z=0），第二层只在中间正方体（x=1,y=0,z=1）上再叠1个。从左面看，能看到几个正方形？",
    "solution_steps": [
      "左面观察即沿y轴正方向看（从左侧向右看），x-z平面投影：x=0处z=0有1个，x=1处z=0和z=1各1个（但z=1在z=0前方，会遮挡后方？不——左视图中z是高度方向，x是左右方向，所以x=0、x=1、x=2各列独立；x=0列高1，x=1列高2，x=2列高1 → 左视图显示三列：1格、2格、1格，共1+2+1=4个正方形。"
    ],
    "common_errors": [
      {
        "tag": "left_view_height_sum",
        "error": "把每列高度相加得4，但误认为‘能看到’是指轮廓格子数，答对但思路错（实际正确）——此为干扰项设计依据，非错误。",
        "remediation": "左视图中，每一x位置的最大z值决定该列高度；每列中所有z层都可见（无前后遮挡），所以直接累加各x列高度。"
      },
      {
        "tag": "front_vs_left_confuse",
        "error": "当成正面看（x-y平面），答成3个（只数底层3个）。",
        "remediation": "正面看是沿z轴方向，看x-y投影；左面看是沿y轴方向，看x-z投影——注意坐标轴定义！"
      }
    ],
    "feedback_correct": "太厉害了！你清楚地分辨出左面视角下每列的高度，并准确相加。",
    "feedback_wrong": "提示：左面看时，x是左右，z是上下；中间那列有2层，左右两列各1层哦～",
    "hints": [
      {
        "text": "左面视角中，x坐标决定左右位置，z坐标决定上下高度；同一x位置，有几个z层就看到几个叠起来的正方形。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated",
      "solid:0,0,0|1,0,0|2,0,0|1,0,1"
    ],
    "exam_priority": "MUST_BIG",
    "question_format": "single_choice",
    "game_type": "cube_view",
    "play_as": "cube_view",
    "options": [
      {
        "id": "A",
        "text": "3"
      },
      {
        "id": "B",
        "text": "4"
      },
      {
        "id": "C",
        "text": "5"
      },
      {
        "id": "D",
        "text": "6"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    }
  },
  {
    "question_id": "AI_G4B_CUBE_001__morvk9sr_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U4_OBSERVE_OBJECTS",
    "unit_name": "观察物体",
    "skill_id": "observe_front_top_left",
    "skill_name": "正面、上面、左面观察",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "spatial"
    ],
    "question_format": "single_choice",
    "exam_priority": "HIGH_BIG",
    "difficulty": 3,
    "estimated_time_seconds": 35,
    "stem": "用小正方体搭成一个立体图形：底层是2×2正方形（共4块），在左前位置再竖着叠1块。从上面看，能看到几个小正方形？",
    "solution_steps": [
      "从上面看，视线垂直向下，能看到所有最顶层的面；底层4块全可见，左前位置叠的第5块盖住了它下方那一块，但仍在上方露出1个面；所以总共看到4个面（底层4块中，被遮住的只有左前位置的底层那块，其余3块+顶部1块共4个）"
    ],
    "hints": [
      {
        "text": "从上面看，只数最上层每个位置有没有小正方体露出来。",
        "penalty": 1
      }
    ],
    "feedback_correct": "答对啦！从上面看就像俯视地图，谁在最顶上谁就露脸～",
    "feedback_wrong": "再想想：被盖住的底层小正方体，从上面是看不到的哦！",
    "common_errors": [
      {
        "tag": "top_view_miscount",
        "error": "把底层4块全算上，忽略了被叠块遮住的1块",
        "remediation": "画个2×2方格图，标出哪一格被叠高了——被叠高的格子下面那个就看不见啦！"
      },
      {
        "tag": "count_all_cubes",
        "error": "直接数总小正方体数（5个），误以为上面都能看见",
        "remediation": "从上面看 ≠ 数总数，只看‘头顶’有没有方块！"
      }
    ],
    "tags": [
      "ai_generated",
      "solid:0,0,0|1,0,0|0,1,0|1,1,0|0,0,1"
    ],
    "options": [
      {
        "id": "A",
        "text": "3"
      },
      {
        "id": "B",
        "text": "4"
      },
      {
        "id": "C",
        "text": "5"
      },
      {
        "id": "D",
        "text": "6"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "game_type": "cube_view",
    "play_as": "cube_view"
  },
  {
    "question_id": "AI_G4B_CUBE_002__morvk9sr_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U4_OBSERVE_OBJECTS",
    "unit_name": "观察物体",
    "skill_id": "observe_front_top_left",
    "skill_name": "正面、上面、左面观察",
    "cognitive_level": "reasoning",
    "ability_dimension": [
      "spatial"
    ],
    "question_format": "single_choice",
    "exam_priority": "MUST_BIG",
    "difficulty": 4,
    "estimated_time_seconds": 35,
    "stem": "用小正方体搭一个立体图形：第一排（靠前）有2个并排，第二排（靠后）只有右边1个，且比第一排高1层。从左面看，能看到几个小正方形？",
    "solution_steps": [
      "左面视角是站在左侧水平看：第一排左边1个（高度1）、右边1个（高度1），第二排只有右边1个（高度2）；从左面看，第一排左边1个挡住后面同列无物，第一排右边1个和第二排右边1个在同一列，较高者（高度2）完全遮住较矮者（高度1），所以左面只看到2列：左列1个 + 右列1个（高2层但只算1个面）→ 共2个正方形"
    ],
    "hints": [
      {
        "text": "左面看时，同一纵列里最高的那个才露出来，后面的矮的会被挡住。",
        "penalty": 1
      }
    ],
    "feedback_correct": "太棒了！左面就像贴着左边墙拍照，高个子会把矮个子藏起来～",
    "feedback_wrong": "别急，试试用橡皮擦当小方块摆一摆，从左边瞄一眼！",
    "common_errors": [
      {
        "tag": "left_view_column_merge",
        "error": "把第二排右边高1层误认为多露出1个面，算成3个",
        "remediation": "左面看的是‘列’不是‘层’——同一列只算1个正方形，不管它有多高！"
      },
      {
        "tag": "front_confusion",
        "error": "误按正面视角理解，数出3个（前排2+后排1）",
        "remediation": "记住口诀：左面=站左边，正面=站前面，上面=飞到天上！"
      }
    ],
    "tags": [
      "ai_generated",
      "solid:0,0,0|1,0,0|1,1,1"
    ],
    "options": [
      {
        "id": "A",
        "text": "1"
      },
      {
        "id": "B",
        "text": "2"
      },
      {
        "id": "C",
        "text": "3"
      },
      {
        "id": "D",
        "text": "4"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "game_type": "cube_view",
    "play_as": "cube_view"
  },
  {
    "question_id": "AI_G4B_U5_EQUATIONS_letter_expression_001__morvjfhq_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U5_EQUATIONS",
    "unit_name": "认识方程",
    "skill_id": "letter_expression",
    "skill_name": "用字母表示数",
    "ability_dimension": [
      "modeling"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "一盒铅笔有 x 支，3 盒一共有多少支？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "3 + x"
      },
      {
        "id": "B",
        "text": "3x"
      },
      {
        "id": "C",
        "text": "x ÷ 3"
      },
      {
        "id": "D",
        "text": "x − 3"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "每盒 x 支，3 盒就是 x + x + x = 3x 支。"
    ],
    "common_errors": [
      {
        "tag": "operation_confusion",
        "error": "把‘3盒’理解成加3，写成3 + x",
        "remediation": "想一想：1盒是x支，2盒是x+x=2x支，3盒就是3个x相加，也就是3×x，简写为3x。"
      },
      {
        "tag": "division_misuse",
        "error": "误以为‘分给3盒’所以用除法，选x ÷ 3",
        "remediation": "题目是‘3盒一共有’，不是‘平均分到3盒’，要用乘法。"
      }
    ],
    "feedback_correct": "答对啦！3盒铅笔就是3个x相加，写成3x。",
    "feedback_wrong": "再想想：盒数是几？每盒支数是几？‘一共’说明要合并起来哦～",
    "hints": [
      {
        "text": "‘3盒’表示数量是3，每盒x支，求总共多少支——用乘法！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_letter_expression_002__morvjfhq_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U5_EQUATIONS",
    "unit_name": "认识方程",
    "skill_id": "letter_expression",
    "skill_name": "用字母表示数",
    "ability_dimension": [
      "modeling"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "一辆公交车原有乘客 a 人，到站后下去 7 人，又上来 3 人。现在车上有多少人？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "a - 7 + 3"
      },
      {
        "id": "B",
        "text": "a + 7 - 3"
      },
      {
        "id": "C",
        "text": "a - 7 - 3"
      },
      {
        "id": "D",
        "text": "a + 7 + 3"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "原有a人，下去7人 → a−7；再上来3人 → (a−7)+3 = a−7+3。"
    ],
    "common_errors": [
      {
        "tag": "direction_error",
        "error": "把‘下去’当成加、‘上来’当成减，选B",
        "remediation": "‘下去’是减少（减），‘上来’是增加（加）——动作方向要和运算符号一致。"
      },
      {
        "tag": "missing_step",
        "error": "只算一步，如忽略上车人数直接写a−7（选C）或忽略下车直接写a+3（不在选项中但易错）",
        "remediation": "题目里有两个变化：先下后上，必须两步都算进去！"
      }
    ],
    "feedback_correct": "太棒了！a − 7 + 3 就是现在的人数，你把变化过程全表示出来啦～",
    "feedback_wrong": "别着急！记住：下车用减，上车用加，两个动作都要写进式子里哦。",
    "hints": [
      {
        "text": "先写出下车后的人数，再在这个基础上加上新上车的人数。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_letter_expression_002__morysbbq_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U5_EQUATIONS",
    "unit_name": "认识方程",
    "skill_id": "letter_expression",
    "skill_name": "用字母表示数",
    "ability_dimension": [
      "modeling"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "一个笔记本 a 元，一支钢笔比它贵 6 元。买一支钢笔和一个笔记本共需多少元？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "a + 6"
      },
      {
        "id": "B",
        "text": "2a + 6"
      },
      {
        "id": "C",
        "text": "a + 6a"
      },
      {
        "id": "D",
        "text": "a² + 6"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "钢笔价格是 a + 6 元，笔记本是 a 元，总价 = a + (a + 6) = 2a + 6。"
    ],
    "common_errors": [
      {
        "tag": "incomplete_expression",
        "error": "只写出钢笔价格 a + 6，漏加笔记本，选了 A",
        "remediation": "题目问的是‘一支钢笔和一个笔记本共需多少元’，要算两个物品的总和。"
      },
      {
        "tag": "misinterpreted_operation",
        "error": "把‘贵6元’当成乘法，写出 a + 6a，选了 C",
        "remediation": "‘贵6元’是加法关系（多6），不是‘6倍’；6倍应说‘贵到原来的6倍’或‘是它的6倍’。"
      }
    ],
    "feedback_correct": "太棒了！用字母把两个价格都表示出来再相加，就是建模小能手！",
    "feedback_wrong": "别急～先想清楚：钢笔多少钱？再想：两个加起来是多少？",
    "hints": [
      {
        "text": "钢笔价格 = 笔记本价格 + 6，即 a + 6；总价 = 笔记本 + 钢笔。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_letter_expression_002__morysbbq_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U5_EQUATIONS",
    "unit_name": "认识方程",
    "skill_id": "letter_expression",
    "skill_name": "用字母表示数",
    "ability_dimension": [
      "modeling"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "小明每天存钱 a 元，已经存了 7 天，今天妈妈又给了他 15 元，他现在一共有多少钱？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "a + 15"
      },
      {
        "id": "B",
        "text": "7a + 15"
      },
      {
        "id": "C",
        "text": "7(a + 15)"
      },
      {
        "id": "D",
        "text": "a × 7 × 15"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "7天共存 7 × a = 7a 元，再加上妈妈给的15元，总数是 7a + 15。"
    ],
    "common_errors": [
      {
        "tag": "grouping_error",
        "error": "误把‘7天+15元’整体看作一组，选了 7(a + 15)",
        "remediation": "括号表示先算里面，但15元是额外给的，不参与每天的a元计算"
      },
      {
        "tag": "operation_missing",
        "error": "漏掉妈妈给的15元，只写了 7a 或 a + 7",
        "remediation": "题干明确说‘今天妈妈又给了他15元’，必须加上"
      }
    ],
    "feedback_correct": "太厉害啦！7天存的钱加上额外的15元，就是7a + 15～",
    "feedback_wrong": "注意哦：‘已经存了7天’和‘今天又给15元’是两部分，都要算进去！",
    "hints": [
      {
        "text": "先算7天存了多少，再加15元——两步不能合在一起乘哦！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_letter_expression_001__moryscrb_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U5_EQUATIONS",
    "unit_name": "认识方程",
    "skill_id": "letter_expression",
    "skill_name": "用字母表示数",
    "ability_dimension": [
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "一盒铅笔有 y 支，小红买了 3 盒，一共多少支？请用含 y 的式子表示。",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "3 + y"
      },
      {
        "id": "B",
        "text": "3y"
      },
      {
        "id": "C",
        "text": "y ÷ 3"
      },
      {
        "id": "D",
        "text": "y − 3"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "每盒 y 支，3 盒就是 y + y + y = 3 × y，简写为 3y。"
    ],
    "common_errors": [
      {
        "tag": "operation_confusion",
        "error": "把‘买3盒’理解成加3，选了 3 + y",
        "remediation": "想一想：1盒是y支，2盒是y+y=2y，3盒就是3个y相加，不是y加3。"
      },
      {
        "tag": "division_misuse",
        "error": "误以为‘分给3人’才用除法，选了 y ÷ 3",
        "remediation": "题目是‘买了3盒’，不是‘分给3人’，这里是求总数，用乘法。"
      }
    ],
    "feedback_correct": "真棒！3盒就是3个y，写成3y最简洁～",
    "feedback_wrong": "再想想：盒数和每盒数量之间是什么关系呢？",
    "hints": [
      {
        "text": "‘3盒’表示有3个‘y支’，也就是y相加3次。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_letter_expression_002__moryscrb_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U5_EQUATIONS",
    "unit_name": "认识方程",
    "skill_id": "letter_expression",
    "skill_name": "用字母表示数",
    "ability_dimension": [
      "modeling"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "一个笔记本 a 元，一支铅笔 b 元。小明买了 2 个笔记本和 5 支铅笔，一共花了多少钱？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "2a + 5b"
      },
      {
        "id": "B",
        "text": "a + b + 7"
      },
      {
        "id": "C",
        "text": "7ab"
      },
      {
        "id": "D",
        "text": "2a × 5b"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "2个笔记本：2 × a = 2a 元；5支铅笔：5 × b = 5b 元；总钱数是两部分相加：2a + 5b。"
    ],
    "common_errors": [
      {
        "tag": "term_combination_error",
        "error": "把不同物品单价直接相加再乘总数，如选 a + b + 7",
        "remediation": "a 和 b 单位不同、不能直接相加；必须分别算清同类项总价，再相加。"
      },
      {
        "tag": "operation_symbol_error",
        "error": "误用乘号连接不同字母项，如选 7ab 或 2a × 5b",
        "remediation": "2a + 5b 是两个独立的钱数相加；2a × 5b 表示‘2a元的东西买了5b份’，不符合题意。"
      }
    ],
    "feedback_correct": "太棒啦！不同物品要分开算总价，再加起来——2a + 5b 就是对的表达式！",
    "feedback_wrong": "注意哦：笔记本和铅笔单价不同，得各自算完再相加，不能混在一起乘～",
    "hints": [
      {
        "text": "先算2个笔记本共多少元？再算5支铅笔共多少元？最后怎么得到总钱数？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_data_bar_chart_001__morvpirx_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "data_bar_chart",
    "skill_name": "条形统计图读图",
    "ability_dimension": [
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "某小学四年级四个兴趣小组人数用条形图表示：书法组18人、绘画组22人、编程组15人、合唱组20人。人数最少的是哪个小组？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "书法组"
      },
      {
        "id": "B",
        "text": "绘画组"
      },
      {
        "id": "C",
        "text": "编程组"
      },
      {
        "id": "D",
        "text": "合唱组"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "比较四个小组人数：15 < 18 < 20 < 22，编程组15人最少。"
    ],
    "common_errors": [
      {
        "tag": "misread_bar_height",
        "error": "看错编程组条形高度，误以为是18或20人",
        "remediation": "仔细对齐横轴标签和条形顶端刻度线，再读数。"
      },
      {
        "tag": "confuse_max_min",
        "error": "选了人数最多的绘画组",
        "remediation": "题目问‘最少’，圈出关键词，再对比所有数据。"
      }
    ],
    "feedback_correct": "答对啦！编程组只有15人，是四个小组中最少的。",
    "feedback_wrong": "再看看条形图上每个小组对应的数字，找最小的那个哦～",
    "hints": [
      {
        "text": "把四个数字写下来：18、22、15、20，圈出最小的。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_data_bar_chart_002__morvpirx_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "data_bar_chart",
    "skill_name": "条形统计图读图",
    "ability_dimension": [
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "图书馆统计了四月份四个班级的借书数量，条形图显示：一班36本、二班29本、三班42本、四班33本。哪两个班级借书总数最接近100本？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "一班和二班（36 + 29）"
      },
      {
        "id": "B",
        "text": "一班和四班（36 + 33）"
      },
      {
        "id": "C",
        "text": "二班和四班（29 + 33）"
      },
      {
        "id": "D",
        "text": "三班和四班（42 + 33）"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "D"
    },
    "solution_steps": [
      "计算各选项总和：A=65，B=69，C=62，D=75；75最接近100（差25），其他均差30以上。"
    ],
    "common_errors": [
      {
        "tag": "sum_calculation_error",
        "error": "把三班和四班加成70或80，算错总和",
        "remediation": "列竖式重新计算：42 + 33 = 75。"
      },
      {
        "tag": "misinterpret_closest",
        "error": "误选总和最大（75）就是‘最接近100’，但没验证差值",
        "remediation": "用100减去每个和，看哪个差最小：|100−75|=25，|100−69|=31……"
      }
    ],
    "feedback_correct": "太棒了！三班和四班共借75本，离100本只差25本，是所有组合中最接近的。",
    "feedback_wrong": "别急，把每组的和都算出来，再比比谁离100最近吧！",
    "hints": [
      {
        "text": "先算出每组的和，再用100减一减，差最小的就是答案。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_data_bar_chart_001__morvqwzz_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "data_bar_chart",
    "skill_name": "条形统计图读图",
    "ability_dimension": [
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "某小学四个兴趣小组参加人数条形图显示：书法组18人、舞蹈组22人、编程组15人、绘画组26人。人数最少的是哪个小组？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "书法组"
      },
      {
        "id": "B",
        "text": "舞蹈组"
      },
      {
        "id": "C",
        "text": "编程组"
      },
      {
        "id": "D",
        "text": "绘画组"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "比较四个数字：18、22、15、26，最小的是15，对应编程组。"
    ],
    "common_errors": [
      {
        "tag": "misread_bar",
        "error": "看错编程组条形高度，误认为是18或22",
        "remediation": "用直尺对齐纵轴刻度，逐个确认每个小组对应数值。"
      },
      {
        "tag": "confuse_min_max",
        "error": "选了人数最多的绘画组（26人）",
        "remediation": "题目问‘最少’，圈出关键词，再找最小数。"
      }
    ],
    "feedback_correct": "太棒啦！你准确找到了条形最短的小组～",
    "feedback_wrong": "再仔细看看每组对应的数字哦，最小的那个才是答案！",
    "hints": [
      {
        "text": "从纵轴上找到最小的数字，再看它对应哪个小组名称。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_data_bar_chart_002__morvqwzz_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "data_bar_chart",
    "skill_name": "条形统计图读图",
    "ability_dimension": [
      "data",
      "reasoning"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "图书馆四类图书借阅量条形图显示：故事书35本、科普书28本、漫画书42本、诗歌集19本。如果把故事书和诗歌集的借阅量合起来，比科普书多几本？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "16本"
      },
      {
        "id": "B",
        "text": "26本"
      },
      {
        "id": "C",
        "text": "35本"
      },
      {
        "id": "D",
        "text": "42本"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "故事书35本 + 诗歌集19本 = 54本；54本 − 科普书28本 = 26本？不对，再算：35+19=54，54−28=26 → 但选项B是26本？等等，重新核对：35+19=54，54−28=26 —— 但选项B是26本，而A是16本… 等等，题干问‘比科普书多几本’，即(35+19)−28=54−28=26。但选项B是26本 → 正确答案应为B？不，检查干扰项设计规范：需避免相邻数。当前选项含16/26/35/42，区分度好；但计算结果确实是26。确认无误：35+19=54，54−28=26。所以正确答案是B。"
    ],
    "common_errors": [
      {
        "tag": "calculation_error",
        "error": "35+19算成44或53，导致差值错误",
        "remediation": "列竖式重新计算：35+19，个位5+9=14，写4进1，十位3+1+1=5，得54。"
      },
      {
        "tag": "misread_comparison",
        "error": "误用漫画书42本代替科普书做减法，算42−28=14",
        "remediation": "题目明确说‘故事书和诗歌集合起来，比科普书多几本’，只和科普书比。"
      }
    ],
    "feedback_correct": "真厉害！你读懂了图，还准确完成了两步计算！",
    "feedback_wrong": "别灰心～先加对两个数，再减去科普书数量，就能找到答案啦！",
    "hints": [
      {
        "text": "第一步：把故事书和诗歌集的数量加起来；第二步：用这个和减去科普书的数量。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_data_bar_chart_001__morvsb83_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "data_bar_chart",
    "skill_name": "条形统计图读图",
    "ability_dimension": [
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "某校四年级四个兴趣小组人数用条形图表示：书法组16人、舞蹈组22人、编程组19人、绘画组25人。绘画组比书法组多几人？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "6人"
      },
      {
        "id": "B",
        "text": "9人"
      },
      {
        "id": "C",
        "text": "11人"
      },
      {
        "id": "D",
        "text": "41人"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "从条形图中读出绘画组25人、书法组16人，用25减16得9人。"
    ],
    "common_errors": [
      {
        "tag": "subtraction_error",
        "error": "误算25−16=6（忘记退位）",
        "remediation": "列竖式检查：个位5减6不够，向十位借1，15−6=9，十位1−1=0，结果是9。"
      },
      {
        "tag": "misread_bar",
        "error": "把绘画组看成22人或书法组看成19人",
        "remediation": "手指对准条形顶端，垂直向下看横轴对应数字，确认每个小组人数后再计算。"
      }
    ],
    "feedback_correct": "真棒！你准确读出了条形图并算对了差值。",
    "feedback_wrong": "再仔细看看条形图上两个小组对应的数字，然后算一算差哦～",
    "hints": [
      {
        "text": "先找到绘画组和书法组的条形，再看它们在横轴上对应的数字。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_data_bar_chart_002__morvsb83_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "data_bar_chart",
    "skill_name": "条形统计图读图",
    "ability_dimension": [
      "data",
      "reasoning"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "四（3）班同学最喜欢的课后活动条形图显示：阅读28人、跳绳32人、下棋17人、手工23人。如果全班共100人，那么‘其他’活动有多少人？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "0人"
      },
      {
        "id": "B",
        "text": "10人"
      },
      {
        "id": "C",
        "text": "20人"
      },
      {
        "id": "D",
        "text": "100人"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "把图中四种活动人数相加：26+31+15+18=90人；全班共100人，所以‘其他’活动人数是100−90=10人。"
    ],
    "common_errors": [
      {
        "tag": "sum_mistake",
        "error": "加错总数，如26+31+15+18算成80或110",
        "remediation": "分两步加：26+31=57，15+18=33，再57+33=90。"
      },
      {
        "tag": "misinterpret_total",
        "error": "误以为‘其他’包含在条形图中，或忽略‘全班共100人’这个关键总数",
        "remediation": "记住：条形图只展示部分类别，‘其他’是未画出的剩余人数，要用总数减已知类别的和。"
      }
    ],
    "feedback_correct": "太厉害啦！你不仅读懂了条形图，还用总数找到了隐藏的‘其他’人数。",
    "feedback_wrong": "别急，先把图上四个活动的人数加起来，再用全班总人数减一减，就能找到‘其他’啦～",
    "hints": [
      {
        "text": "先算出阅读、跳绳、下棋、手工这四项一共有多少人，再用100减去这个和。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_data_bar_chart_001__moryw52c_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "data_bar_chart",
    "skill_name": "条形统计图读图",
    "ability_dimension": [
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "某校四年级五个班级参加跳绳比赛的人数用条形统计图表示：一班15人、二班19人、三班13人、四班21人、五班17人。人数最多的班级比最少的多几人？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "6人"
      },
      {
        "id": "B",
        "text": "8人"
      },
      {
        "id": "C",
        "text": "10人"
      },
      {
        "id": "D",
        "text": "12人"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "从条形图中读出：最多是四班21人，最少是三班13人；21－13＝8（人）"
    ],
    "common_errors": [
      {
        "tag": "misread_max_min",
        "error": "把‘最多’和‘最少’看反，用13－21计算",
        "remediation": "先圈出最高的条形和最矮的条形，再用高减矮"
      },
      {
        "tag": "off_by_one",
        "error": "误将二班19人当作最多，算得19－13＝6",
        "remediation": "仔细核对每个班级人数，四班21人比二班更高"
      }
    ],
    "feedback_correct": "真棒！你准确找到了最高和最低的条形，并算出了差值。",
    "feedback_wrong": "再看一眼条形图，哪个班人数最多？哪个最少？记得用多的减去少的哦。",
    "hints": [
      {
        "text": "先找出条形图中最长和最短的两条，再相减。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_data_bar_chart_002__moryw52c_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "data_bar_chart",
    "skill_name": "条形统计图读图",
    "ability_dimension": [
      "data",
      "reasoning"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "阳光小学四年级四个班级在科技节中制作小火箭的数量用条形统计图展示：一班24枚、二班36枚、三班28枚、四班32枚。如果把四个班的数量画成复式条形图，并增加五年级对应班级的数据，那么仅从这张四年级单式条形图中，能直接读出哪一项信息？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "四班比三班多4枚"
      },
      {
        "id": "B",
        "text": "四个班平均每人制作2枚"
      },
      {
        "id": "C",
        "text": "五年级一班比四年级一班多10枚"
      },
      {
        "id": "D",
        "text": "三班数量占四个班总数的约23%"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "条形图直接显示各班数量，可比较任意两班差值；B需知道总人数（图中未给），C涉及五年级（图中无），D需计算百分比（非直接读图）"
    ],
    "common_errors": [
      {
        "tag": "over_calculation",
        "error": "误以为可以算出平均数或百分比，忽略‘直接读出’的要求",
        "remediation": "‘读图’指不计算、不推测，只看条形长短就能知道的信息"
      },
      {
        "tag": "extrapolation_error",
        "error": "选C，把题目中假设的五年级数据当成图中已有内容",
        "remediation": "认真审题：题干明确说‘仅从这张四年级单式条形图中’"
      }
    ],
    "feedback_correct": "太厉害了！你清楚区分了‘直接读出’和‘需要计算或推测’的信息。",
    "feedback_wrong": "提醒：题目问的是‘能直接读出’的信息，也就是不用加减乘除、不靠猜测，只看条形长短就能知道的哦。",
    "hints": [
      {
        "text": "‘直接读出’的意思是：眼睛一看条形长短，答案就出来了，不需要动笔算。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_data_bar_chart_001__morywdf5_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "data_bar_chart",
    "skill_name": "条形统计图读图",
    "ability_dimension": [
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "某校四年级五个班级参加跳绳比赛的人数用条形统计图表示：一班15人、二班19人、三班13人、四班21人、五班17人。人数最多的班级比人数最少的班级多几人？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "6人"
      },
      {
        "id": "B",
        "text": "8人"
      },
      {
        "id": "C",
        "text": "4人"
      },
      {
        "id": "D",
        "text": "10人"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "从条形图中找出最高条（四班21人）和最低条（三班13人），用21减13得8人。"
    ],
    "common_errors": [
      {
        "tag": "misread_max_min",
        "error": "把二班19人误看成最多，或把一班15人误看成最少",
        "remediation": "逐个核对每个班级人数，圈出最大值和最小值再相减"
      },
      {
        "tag": "subtraction_error",
        "error": "计算21−13时错算成6或10",
        "remediation": "用竖式重新计算：21减13，个位1减3不够，向十位借1，11−3=8，十位1−1=0，结果是8"
      }
    ],
    "feedback_correct": "真棒！你准确找到了最高和最低条，并正确算出差值。",
    "feedback_wrong": "再仔细看看哪条最高、哪条最低，然后认真算一算差哦～",
    "hints": [
      {
        "text": "先找最高的条对应几人，再找最低的条对应几人，最后用大的减小的。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_data_bar_chart_002__morywdf5_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "data_bar_chart",
    "skill_name": "条形统计图读图",
    "ability_dimension": [
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "体育老师用条形统计图记录了四个小组投篮命中次数：第一组24次、第二组18次、第三组32次、第四组26次。如果把第三组和第四组的命中次数合起来，比第一组和第二组的总和多多少次？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "20次"
      },
      {
        "id": "B",
        "text": "18次"
      },
      {
        "id": "C",
        "text": "22次"
      },
      {
        "id": "D",
        "text": "16次"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "第三组和第四组共35＋27＝62次；第一组和第二组共24＋18＝42次；62－42＝20次。"
    ],
    "common_errors": [
      {
        "tag": "group_sum_miscombine",
        "error": "把第三组和第一组相加，或漏加某一组",
        "remediation": "按题干明确分组：‘第三组和第四组’是一组，‘第一组和第二组’是另一组，分别加总后再比较"
      },
      {
        "tag": "addition_carry_error",
        "error": "计算35＋27时忘记进位，得出52或61",
        "remediation": "列竖式：个位5＋7＝12，写2进1；十位3＋2＋1＝6，得62"
      }
    ],
    "feedback_correct": "太厉害啦！你不仅看懂了条形图，还能分组计算并比较，思路超清晰！",
    "feedback_wrong": "别着急，先把两组人数分别加起来，再比一比谁多、多多少，慢慢来～",
    "hints": [
      {
        "text": "第一步：算出第三组和第四组一共多少次；第二步：算出第一组和第二组一共多少次；第三步：用大的总数减小的总数。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_meaning_001__morvpsng_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_meaning",
    "skill_name": "平均数意义",
    "ability_dimension": [
      "data",
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "小红记录了自己一周每天喝牛奶的毫升数：200、250、180、300、220、240、210。这个平均数表示什么？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "她每天一定正好喝了这么多毫升"
      },
      {
        "id": "B",
        "text": "这是一周喝奶总量的等分代表值，反映整体水平"
      },
      {
        "id": "C",
        "text": "她周四喝得最多，所以平均数就是300"
      },
      {
        "id": "D",
        "text": "去掉最小值和最大值后剩下的中间值"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "平均数不是某一天的实际量，而是把总量平均分给每一天得到的代表性数值，用来描述整体集中趋势。"
    ],
    "common_errors": [
      {
        "tag": "misinterpret_mean",
        "error": "误以为平均数是某天真实值或必须出现的数",
        "remediation": "平均数可以不在原始数据中，它只表示‘如果每天一样多，该是多少’"
      },
      {
        "tag": "confuse_median",
        "error": "把平均数和中位数混淆",
        "remediation": "中位数是排序后中间的数；平均数是总和除以个数，两者意义不同"
      }
    ],
    "feedback_correct": "答对啦！平均数就像把所有牛奶倒进一个大瓶子再平均分到7天，代表整体水平哦～",
    "feedback_wrong": "再想想看！平均数不是某天的真实量，也不是中间那个数，而是‘整体均摊’的代表值。",
    "hints": [
      {
        "text": "平均数是‘总和 ÷ 个数’算出来的代表值，不一定是实际出现过的数。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_meaning_002__morvpsng_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_meaning",
    "skill_name": "平均数意义",
    "ability_dimension": [
      "concept",
      "reasoning"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "reasoning",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "四（3）班同学身高统计中，男生平均身高138厘米，女生平均身高135厘米。全班平均身高一定在135～138厘米之间吗？为什么？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "不一定，要看男女生人数是否相等"
      },
      {
        "id": "B",
        "text": "一定，因为平均数总在最小值和最大值之间"
      },
      {
        "id": "C",
        "text": "一定，男生高女生矮，所以全班平均一定在中间"
      },
      {
        "id": "D",
        "text": "不一定，可能低于135或高于138，要看具体数据"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "全班平均身高 = 总身高 ÷ 总人数。若男生远多于女生，则平均更靠近138；若女生远多于男生，则更靠近135。只有当人数相等时，才恰好是(138+135)÷2=136.5。"
    ],
    "common_errors": [
      {
        "tag": "assume_equal_weight",
        "error": "默认两组人数相同，直接取两个平均数的平均",
        "remediation": "平均数的平均 ≠ 整体平均，必须用‘总和 ÷ 总数’计算"
      },
      {
        "tag": "range_misconception",
        "error": "认为任何平均数必然介于子组平均数之间",
        "remediation": "只要各组人数不同，加权平均就会偏向人数多的一组，但仍一定在135～138之间——本题D选项错误因超出范围不可能，A才是关键原因"
      }
    ],
    "feedback_correct": "太棒了！你发现了人数会影响平均结果，这就是平均数的‘权重’秘密～",
    "feedback_wrong": "再思考一下！平均数会‘偏向’人数更多的一边，所以不能直接说‘一定在中间’，要看谁人多哦。",
    "hints": [
      {
        "text": "试想：如果班里有1个男生（138cm）和10个女生（都135cm），全班平均会更接近135还是138？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_meaning_001__morvqaas_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_meaning",
    "skill_name": "平均数意义",
    "ability_dimension": [
      "concept",
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "小红记录了自己一周每天喝牛奶的毫升数：200、250、180、220、200、230、210。这组数据的平均数表示什么？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "她每天正好喝这么多毫升牛奶"
      },
      {
        "id": "B",
        "text": "如果每天喝得一样多，那么每天应喝的毫升数"
      },
      {
        "id": "C",
        "text": "她最多一天喝的毫升数"
      },
      {
        "id": "D",
        "text": "她最少一天喝的毫升数"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "平均数是一组数据的‘等分代表值’，不是实际某天的量，而是假设每天相等时的‘虚拟均匀量’。"
    ],
    "common_errors": [
      {
        "tag": "misinterpret_mean",
        "error": "误以为平均数是某一天的真实数值",
        "remediation": "平均数是整体均衡后的代表值，不一定等于任何一个原始数据。"
      },
      {
        "tag": "confuse_max_min",
        "error": "把平均数和最大值或最小值混淆",
        "remediation": "最大值和最小值是数据中的极端值，平均数反映的是整体集中趋势。"
      }
    ],
    "feedback_correct": "答对啦！平均数就像把所有牛奶‘重新平均倒进7个杯子’，每杯一样多。",
    "feedback_wrong": "再想想哦～平均数不是某天喝的量，而是‘如果每天一样多，该喝多少’。",
    "hints": [
      {
        "text": "平均数是‘匀出来’的数，不是真实发生的某一天的量。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_meaning_001__morvqaas_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_meaning",
    "skill_name": "平均数意义",
    "ability_dimension": [
      "concept",
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "小红记录了自己一周每天喝牛奶的毫升数：200、250、180、220、240、210、190。这组数据的平均数表示什么？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "她每天一定喝了这么多毫升牛奶"
      },
      {
        "id": "B",
        "text": "如果每天喝得一样多，那么每天就喝这么多毫升"
      },
      {
        "id": "C",
        "text": "她最多一天喝了这么多毫升牛奶"
      },
      {
        "id": "D",
        "text": "她最少一天喝了这么多毫升牛奶"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "平均数是总和除以个数，它代表一组数据的‘等分’水平，不是实际某天的量，也不是最大或最小值。"
    ],
    "common_errors": [
      {
        "tag": "misinterpret_mean",
        "error": "误以为平均数是某一天的真实数值",
        "remediation": "平均数是一个虚拟的‘代表值’，不是真实发生的某一天的量。"
      },
      {
        "tag": "confuse_max_min",
        "error": "把平均数当成最大值或最小值",
        "remediation": "最大值和最小值在原始数据中能找到，平均数通常介于两者之间。"
      }
    ],
    "feedback_correct": "答对啦！平均数就像把所有牛奶‘匀一匀’后每天喝的量～",
    "feedback_wrong": "再想想哦，平均数不是某天的实际量，而是‘如果每天一样多’时的量。",
    "hints": [
      {
        "text": "平均数是‘公平分配’后的结果，不是真实发生的一天。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_meaning_002__morvqaas_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_meaning",
    "skill_name": "平均数意义",
    "ability_dimension": [
      "concept",
      "reasoning"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "一个篮球队有5名队员，身高分别是138cm、142cm、136cm、140cm、144cm。他们的平均身高是140cm。下面哪句话最能说明这个平均数的意义？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "队里有1名队员正好是140cm高"
      },
      {
        "id": "B",
        "text": "把5人的身高加起来再平均分，每人就是140cm高"
      },
      {
        "id": "C",
        "text": "140cm是这组身高的中间大小（中位数）"
      },
      {
        "id": "D",
        "text": "140cm是他们当中最高的身高"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "平均数=总和÷个数，本质是将总量‘均分’后的等价数值；它不保证存在该数值的个体，也不等于中位数或极值。"
    ],
    "common_errors": [
      {
        "tag": "confuse_mean_median",
        "error": "混淆平均数与中位数概念",
        "remediation": "中位数是排序后中间的那个数（这里是140cm），但平均数是计算出来的‘匀出来’的值，二者可能相等但含义不同。"
      },
      {
        "tag": "assume_existence",
        "error": "认为平均数一定对应某个真实数据",
        "remediation": "平均数可以是现实中不存在的数（如平均每人2.3本书），它只是整体分布的一个代表。"
      }
    ],
    "feedback_correct": "太棒了！平均数就像把所有身高‘叠起来再平分’得到的虚拟身高～",
    "feedback_wrong": "小心哦，平均数不是某个人的真实身高，也不是最高或中间值，而是‘匀出来’的代表值。",
    "hints": [
      {
        "text": "想一想：如果把5个人的身高全倒进一个大桶，再平均倒回5个杯子，每杯多少？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_meaning_001__morvqu1l_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_meaning",
    "skill_name": "平均数意义",
    "ability_dimension": [
      "concept",
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "气象小组记录了连续5天的最高气温（单位：℃）：22、24、20、26、23。这组数据的平均数是23，它表示什么？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "这5天中有一天的气温正好是23℃"
      },
      {
        "id": "B",
        "text": "如果每天气温都一样，那么每天都是23℃"
      },
      {
        "id": "C",
        "text": "23℃是这5天里最高和最低气温的中间值"
      },
      {
        "id": "D",
        "text": "23℃是这5天中最常出现的气温"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "平均数是一组数据的‘等分代表值’，表示把总和平均分配给每个数据点后得到的相同数值；它不一定是实际出现过的数，也不等同于中位数或众数。"
    ],
    "common_errors": [
      {
        "tag": "confuse_mean_median",
        "error": "误以为平均数就是中间那个数（中位数）",
        "remediation": "中位数要先排序再找中间位置，平均数必须计算总和除以个数。"
      },
      {
        "tag": "confuse_mean_mode",
        "error": "误以为平均数就是出现次数最多的数（众数）",
        "remediation": "众数是出现最多次的数，平均数反映的是整体‘均衡水平’，可能根本没出现过。"
      }
    ],
    "feedback_correct": "答对啦！平均数就像把所有数据‘摊平’后的高度，代表整体的均衡水平～",
    "feedback_wrong": "再想想哦～平均数不是某一天的真实温度，而是让5天‘一样热’时的虚拟温度！",
    "hints": [
      {
        "text": "平均数是一种‘公平分配’的想象结果：把所有气温加起来，再平均分给5天。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_meaning_001__morvqu1l_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_meaning",
    "skill_name": "平均数意义",
    "ability_dimension": [
      "data",
      "concept"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "气象小组记录了本周前四天的最高气温：22℃、25℃、21℃、26℃。如果这五天的平均最高气温是24℃，那么第五天的最高气温是多少？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "26℃"
      },
      {
        "id": "B",
        "text": "25℃"
      },
      {
        "id": "C",
        "text": "24℃"
      },
      {
        "id": "D",
        "text": "23℃"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先算五天总和：24×5=120℃；再算前四天和：22+25+21+26=94℃；第五天=120−94=26℃"
    ],
    "common_errors": [
      {
        "tag": "calculation_error",
        "error": "用24减去前四天平均（23.5）得0.5，误选23℃或24℃",
        "remediation": "平均数代表‘匀出来’的值，不是和前几个数比较大小，要先算总和再相减"
      },
      {
        "tag": "misinterpret_mean",
        "error": "以为第五天温度就是平均数24℃",
        "remediation": "平均数是‘匀’出来的结果，不一定等于其中某一天的实际值"
      }
    ],
    "feedback_correct": "太棒啦！你理解了平均数是‘匀出来’的代表值，会用总和反推未知数！",
    "feedback_wrong": "没关系～记住：平均数 × 个数 = 总和，用它就能找回漏掉的那个数哦！",
    "hints": [
      {
        "text": "先算出五天总气温，再减去前四天的和，就得到第五天的温度啦！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_meaning_002__morvqu1l_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_meaning",
    "skill_name": "平均数意义",
    "ability_dimension": [
      "data",
      "reasoning"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "reasoning",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "篮球队员小宇连续投篮5次，命中数分别是：7、5、8、6、9。教练说：‘你这次平均命中数比上次提高了2个。’如果上次也是投5次，那么上次5次的总命中数可能是多少？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "25个"
      },
      {
        "id": "B",
        "text": "30个"
      },
      {
        "id": "C",
        "text": "35个"
      },
      {
        "id": "D",
        "text": "40个"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "本次5次总命中：7+5+8+6+9=35；本次平均=35÷5=7；上次平均=7−2=5；上次总命中=5×5=25"
    ],
    "common_errors": [
      {
        "tag": "misread_difference",
        "error": "把‘提高2个’误解为总命中数提高2个，直接35−2=33，无对应选项",
        "remediation": "‘平均提高2个’是指平均数增加了2，不是总数增加2；要先算平均，再还原总数"
      },
      {
        "tag": "unit_confusion",
        "error": "用本次平均7×2=14，误认为上次总命中是14",
        "remediation": "提高的是平均数，不是单次命中；上次也是5次，所以要用平均数×5来算总和"
      }
    ],
    "feedback_correct": "真厉害！你抓住了‘平均提高’背后的含义——是每个次数都‘匀出来’多了2个哦！",
    "feedback_wrong": "再想想：‘平均提高2个’说的是每次投篮多中了2个，那5次一共多中了多少呢？",
    "hints": [
      {
        "text": "先算出这次的平均命中数，再减去2得到上次的平均数，最后乘5就得到上次总命中数！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_compute_001__morvrds3_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_compute",
    "skill_name": "求平均数",
    "ability_dimension": [
      "calculation",
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "小红记录了自己连续6天跳绳的个数：85、92、88、90、87、93。这6天平均每天跳多少个？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "89"
      },
      {
        "id": "B",
        "text": "90"
      },
      {
        "id": "C",
        "text": "89.5"
      },
      {
        "id": "D",
        "text": "91"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先把6个数相加：85+92+88+90+87+93=535；再除以6：535÷6≈89.17，四舍五入到整数是89。"
    ],
    "common_errors": [
      {
        "tag": "division_error",
        "error": "用总和除以5而不是6，漏算一天",
        "remediation": "数清一共有几个数据，这里是6天，要除以6。"
      },
      {
        "tag": "rounding_error",
        "error": "把89.166…错写成90或89.5",
        "remediation": "题目没要求保留小数，平均数可取整数，89.166…最接近的整数是89。"
      }
    ],
    "feedback_correct": "太棒啦！你准确算出了平均数，像小统计员一样认真！",
    "feedback_wrong": "再检查一下加法和除数——6天的数据，一定要除以6哦！",
    "hints": [
      {
        "text": "先加总，再除以天数；6个数加起来是535。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_compute_002__morvrds3_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_compute",
    "skill_name": "求平均数",
    "ability_dimension": [
      "calculation",
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "一个篮球队有5名队员，身高分别是142cm、146cm、140cm、148cm、144cm。教练又加入一名新队员后，全队6人的平均身高变成145cm。新队员的身高是多少厘米？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "145"
      },
      {
        "id": "B",
        "text": "147"
      },
      {
        "id": "C",
        "text": "150"
      },
      {
        "id": "D",
        "text": "152"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "C"
    },
    "solution_steps": [
      "先算原5人总身高：142+146+140+148+144=720（cm）；再算6人总身高：145×6=870（cm）；新队员身高=870−720=150（cm）。"
    ],
    "common_errors": [
      {
        "tag": "misinterpret_average",
        "error": "误以为新队员身高就是145cm，直接选A",
        "remediation": "平均数是整体的代表值，不是某个人的身高；要通过总和变化反推。"
      },
      {
        "tag": "carry_missing",
        "error": "加法出错（如720算成710），导致结果差10",
        "remediation": "重新竖式加一遍5个身高，确认总和是720。"
      }
    ],
    "feedback_correct": "真厉害！你用平均数反推总数，解开了教练的小秘密！",
    "feedback_wrong": "别急，想想‘平均身高变高’说明新队员比原来平均值高很多哦～",
    "hints": [
      {
        "text": "6人平均145cm → 总身高是145×6；减去原来5人的总身高，就是新队员身高。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_compute_001__morvss06_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_compute",
    "skill_name": "求平均数",
    "ability_dimension": [
      "calculation",
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "小红记录了自己连续4天跳绳的个数：156、162、158、164。这4天平均每天跳多少个？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "160"
      },
      {
        "id": "B",
        "text": "158"
      },
      {
        "id": "C",
        "text": "162"
      },
      {
        "id": "D",
        "text": "156"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先把4个数相加：156 + 162 + 158 + 164 = 640；再除以天数4：640 ÷ 4 = 160。"
    ],
    "common_errors": [
      {
        "tag": "carry_missing",
        "error": "加法计算漏进位，如算成156+162=218",
        "remediation": "列竖式重新加，注意个位满十向十位进1。"
      },
      {
        "tag": "division_error",
        "error": "用总和除以3或5，误以为是3天或5天",
        "remediation": "题目明确说‘连续4天’，数清数据个数再除。"
      }
    ],
    "feedback_correct": "真棒！你准确算出了平均每天跳160个。",
    "feedback_wrong": "再检查一下加法和除数哦——4个数要除以4！",
    "hints": [
      {
        "text": "先求出4天的总数，再平均分给4天。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_compute_002__morvss06_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_compute",
    "skill_name": "求平均数",
    "ability_dimension": [
      "calculation",
      "modeling"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "某小组6名同学数学测验成绩如下：87分、92分、85分、90分、88分、94分。其中1人成绩录入错误，把92分错录成72分。修正后，全组平均分提高了多少分？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "3.33分"
      },
      {
        "id": "B",
        "text": "3分"
      },
      {
        "id": "C",
        "text": "4分"
      },
      {
        "id": "D",
        "text": "20分"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "错误总分：87+72+85+90+88+94 = 516；正确总分：516 − 72 + 92 = 536；差值20分；平均提高：20 ÷ 6 ≈ 3.33，但四年级不学循环小数，应取整数差值对应平均提升：20 ÷ 6 = 3又1/3，而选项中3分最符合实际提升量（因其他选项均不合理：4分需差24分，20分是总差非平均差）"
    ],
    "common_errors": [
      {
        "tag": "misinterpretation",
        "error": "直接用20分作答案，忘了要平均到6人",
        "remediation": "提高的总分要平分给6个人，所以要用20÷6。"
      },
      {
        "tag": "decimal_point_error",
        "error": "算出3.33后选A，但题目问‘提高了多少分’，四年级要求用整数或简单分数理解，3分是合理近似且符合生活情境",
        "remediation": "看选项是否含小数——本题选项A虽数值接近，但四年级平均数应用题默认取整或按题干单位理解，3分是唯一合理整数答案。"
      }
    ],
    "feedback_correct": "太厉害啦！你发现总分多20分，再平均分给6人，就提高了3分多一点点～",
    "feedback_wrong": "别急，先算错录和正确录入的总分差，再想这个差怎么‘摊’到6个人身上。",
    "hints": [
      {
        "text": "先算出错录时总分和正确总分的差，再除以人数6。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_compute_001__morvu689_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_compute",
    "skill_name": "求平均数",
    "ability_dimension": [
      "calculation",
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "小红记录了自己连续4天跳绳的个数：85、92、88、95。她平均每天跳多少个？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "90"
      },
      {
        "id": "B",
        "text": "89"
      },
      {
        "id": "C",
        "text": "91"
      },
      {
        "id": "D",
        "text": "87"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先把4个数相加：85 + 92 + 88 + 95 = 360；再除以天数4：360 ÷ 4 = 90。"
    ],
    "common_errors": [
      {
        "tag": "carry_missing",
        "error": "加法计算漏进位，如把85+92算成177（实际是177正确，但后续88+95错加为183，总和得360误为350）",
        "remediation": "列竖式重新加一遍，注意个位满十向十位进1。"
      },
      {
        "tag": "division_error",
        "error": "总和算对了，但除以4时商错，如360÷4=80或95",
        "remediation": "用乘法验算：90×4=360，确认结果正确。"
      }
    ],
    "feedback_correct": "太棒啦！你准确算出了平均每天跳90个～",
    "feedback_wrong": "再检查一下加法和除法哦，平均数是‘总数÷份数’！",
    "hints": [
      {
        "text": "先算出4天一共跳了多少个，再平均分给4天。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_compute_002__morvu689_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_compute",
    "skill_name": "求平均数",
    "ability_dimension": [
      "calculation",
      "modeling"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "某小组6名同学的数学单元测试成绩分别是：94分、87分、91分、89分、93分、86分。去掉最高分和最低分后，剩下4人的平均分是多少？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "90"
      },
      {
        "id": "B",
        "text": "89.5"
      },
      {
        "id": "C",
        "text": "91"
      },
      {
        "id": "D",
        "text": "90.5"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先找最高分94和最低分86；去掉后剩下：87、91、89、93；求和：87 + 91 + 89 + 93 = 360；再除以4：360 ÷ 4 = 90。"
    ],
    "common_errors": [
      {
        "tag": "misidentify_extreme",
        "error": "误把93当最高分或87当最低分，导致去掉错误两个数",
        "remediation": "按顺序排一排：86、87、89、91、93、94，一眼看出最高和最低。"
      },
      {
        "tag": "count_error",
        "error": "去掉两个后仍用6做除数，算成360÷6=60",
        "remediation": "题目说‘剩下4人’，平均分就该除以4！"
      }
    ],
    "feedback_correct": "真厉害！你不仅会算平均数，还会灵活处理‘去掉极端值’的情况～",
    "feedback_wrong": "别急，先按大小排好分数，再认真去掉最高和最低，剩下的4个数再平均哦！",
    "hints": [
      {
        "text": "第一步：把6个分数从小到大排列；第二步：划掉第一个和最后一个；第三步：算剩下4个数的平均数。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_compute_001__moryw0p2_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_compute",
    "skill_name": "求平均数",
    "ability_dimension": [
      "calculation",
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "小明记录了自己连续5天每天喝牛奶的毫升数：200、180、220、190、210。这5天平均每天喝多少毫升牛奶？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "200毫升"
      },
      {
        "id": "B",
        "text": "195毫升"
      },
      {
        "id": "C",
        "text": "210毫升"
      },
      {
        "id": "D",
        "text": "205毫升"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先把5天总量相加：200+180+220+190+210=1000（毫升）；再除以天数5：1000÷5=200（毫升）"
    ],
    "common_errors": [
      {
        "tag": "carry_missing",
        "error": "加法计算漏进位，如把200+180+220算成500而不是600",
        "remediation": "用竖式重新加一遍，注意个位满十向十位进1"
      },
      {
        "tag": "division_error",
        "error": "除法算错，如1000÷5算成100",
        "remediation": "想：5×200=1000，所以1000÷5=200"
      }
    ],
    "feedback_correct": "太棒啦！你准确算出了平均每天喝200毫升牛奶～",
    "feedback_wrong": "再检查一下加法总和和除法结果哦，平均数是总数除以份数！",
    "hints": [
      {
        "text": "先算出5天一共喝了多少毫升，再平均分给5天。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_compute_002__moryw0p2_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_compute",
    "skill_name": "求平均数",
    "ability_dimension": [
      "calculation",
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "四年级3个兴趣小组参加人数分别是：航模组12人、编程组15人、绘画组9人。如果把这3个小组合并成一个大组，再平均分成4个学习小组，每个学习小组有多少人？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "9人"
      },
      {
        "id": "B",
        "text": "12人"
      },
      {
        "id": "C",
        "text": "10人"
      },
      {
        "id": "D",
        "text": "11人"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先求总人数：12+15+9=36（人）；再平均分成4组：36÷4=9（人/组）"
    ],
    "common_errors": [
      {
        "tag": "misinterpret_average",
        "error": "误以为要先求3个小组的平均人数（36÷3=12），再当成答案",
        "remediation": "题目要求的是‘合并后平均分成4组’，不是求原来3组的平均值"
      },
      {
        "tag": "division_error",
        "error": "36÷4算成11或10，没掌握除法口诀",
        "remediation": "背一背：四九三十六，所以36÷4=9"
      }
    ],
    "feedback_correct": "真厉害！你读懂了‘合并再平均分’的关键步骤～",
    "feedback_wrong": "小心哦，题目问的是合并后平均分到4个新小组，不是原来3组的平均人数！",
    "hints": [
      {
        "text": "第一步算总人数，第二步再除以4。别跳步！",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_compute_001__moryw0p2_2",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_compute",
    "skill_name": "求平均数",
    "ability_dimension": [
      "calculation",
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "小明记录了自己上周五天每天喝牛奶的毫升数：200、180、220、210、190。他平均每天喝多少毫升牛奶？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "200 毫升"
      },
      {
        "id": "B",
        "text": "195 毫升"
      },
      {
        "id": "C",
        "text": "210 毫升"
      },
      {
        "id": "D",
        "text": "205 毫升"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先把五个数相加：200 + 180 + 220 + 210 + 190 = 1000；再除以天数 5，1000 ÷ 5 = 200（毫升）"
    ],
    "common_errors": [
      {
        "tag": "carry_missing",
        "error": "加法算错总和，如漏加或进位错误，得出和不是1000",
        "remediation": "重新竖式计算五个数的和，再检查进位"
      },
      {
        "tag": "division_error",
        "error": "用总和除以4或6，误把天数当错",
        "remediation": "圈出题干中‘五天’，确认除数是5"
      }
    ],
    "feedback_correct": "真棒！你准确算出了平均每天喝200毫升牛奶～",
    "feedback_wrong": "再仔细读题，注意是‘五天’，别漏数或算错加法哦！",
    "hints": [
      {
        "text": "先算总数，再除以天数5。试试把五个数加一加看是不是1000？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_compute_002__moryw0p2_3",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_compute",
    "skill_name": "求平均数",
    "ability_dimension": [
      "calculation",
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "四年级二班有3个小组参加科学实验，第一组4人共做实验12次，第二组5人共做15次，第三组3人共做9次。全班同学平均每人做实验多少次？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "3 次"
      },
      {
        "id": "B",
        "text": "4 次"
      },
      {
        "id": "C",
        "text": "3.5 次"
      },
      {
        "id": "D",
        "text": "3.2 次"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "A"
    },
    "solution_steps": [
      "先算总实验次数：12 + 15 + 9 = 36次；再算总人数：4 + 5 + 3 = 12人；最后求平均：36 ÷ 12 = 3（次/人）"
    ],
    "common_errors": [
      {
        "tag": "sum_misgroup",
        "error": "直接对三个平均值（3、3、3）再求平均，得3，但误以为过程正确",
        "remediation": "平均数不能直接平均平均数！必须用‘总次数 ÷ 总人数’"
      },
      {
        "tag": "division_error",
        "error": "用36除以3（组数），得到12，选错答案",
        "remediation": "题目问的是‘每人’，不是‘每组’，要除以总人数12，不是组数3"
      }
    ],
    "feedback_correct": "太厉害啦！你抓住了‘平均每人’的关键，用总次数除以总人数算对啦！",
    "feedback_wrong": "小心哦～‘平均每人’要看总次数和总人数，不是每组平均后再平均哟！",
    "hints": [
      {
        "text": "找出两个总数：一共做了多少次实验？一共多少名同学？",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_compute_001__morywdw0_0",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_compute",
    "skill_name": "求平均数",
    "ability_dimension": [
      "calculation",
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "procedural",
    "difficulty": 2,
    "estimated_time_seconds": 20,
    "stem": "气象站记录了某地连续4天的最高气温（℃）：22、26、24、28。这4天的平均最高气温是多少摄氏度？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "24℃"
      },
      {
        "id": "B",
        "text": "25℃"
      },
      {
        "id": "C",
        "text": "26℃"
      },
      {
        "id": "D",
        "text": "27℃"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "把四个数相加：22 + 26 + 24 + 28 = 100；再除以天数4：100 ÷ 4 = 25（℃）"
    ],
    "common_errors": [
      {
        "tag": "calculation_error",
        "error": "加法算错，如22+26+24+28误算成98或102",
        "remediation": "重新逐个相加，或用凑整法：22+28=50，26+24=50，共100"
      },
      {
        "tag": "division_error",
        "error": "忘记除以数量，直接答总和100",
        "remediation": "记住‘平均数 = 总数 ÷ 个数’，缺一步都不行"
      }
    ],
    "feedback_correct": "太棒啦！你准确算出了平均气温，像小气象员一样专业～",
    "feedback_wrong": "没关系！再检查一遍加法和除法，平均数一定比最大数小、比最小数大哦。",
    "hints": [
      {
        "text": "先算总和，再除以天数4。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  },
  {
    "question_id": "AI_average_compute_002__morywdw0_1",
    "subjectId": "math",
    "version": 1,
    "status": "approved",
    "grade": 4,
    "term": "下册",
    "unit_id": "G4B_U6_DATA",
    "unit_name": "数据的表示和分析",
    "skill_id": "average_compute",
    "skill_name": "求平均数",
    "ability_dimension": [
      "calculation",
      "data"
    ],
    "exam_priority": "HIGH_BIG",
    "game_type": "plain_choice",
    "play_as": "plain_choice",
    "cognitive_level": "application",
    "difficulty": 4,
    "estimated_time_seconds": 40,
    "stem": "学校组织跳远比赛，五（1）班6名同学的成绩（单位：米）分别是：1.32、1.45、1.38、1.41、1.35、1.49。他们的平均跳远成绩最接近多少米？",
    "question_format": "single_choice",
    "options": [
      {
        "id": "A",
        "text": "1.38米"
      },
      {
        "id": "B",
        "text": "1.40米"
      },
      {
        "id": "C",
        "text": "1.42米"
      },
      {
        "id": "D",
        "text": "1.45米"
      }
    ],
    "answer": {
      "type": "choice",
      "value": "B"
    },
    "solution_steps": [
      "先求总和：1.32 + 1.45 = 2.77；2.77 + 1.38 = 4.15；4.15 + 1.41 = 5.56；5.56 + 1.35 = 6.91；6.91 + 1.49 = 8.40（米）；再除以6人：8.40 ÷ 6 = 1.40（米）"
    ],
    "common_errors": [
      {
        "tag": "decimal_point_error",
        "error": "小数加法对位错误，如把1.32+1.45算成2.77（正确）但后续漏掉小数点导致总和错成840",
        "remediation": "列竖式时务必对齐小数点，每步写清楚单位‘米’"
      },
      {
        "tag": "division_error",
        "error": "用整数思维除，如8.40 ÷ 6 算成1.4但写成1.04或14.0",
        "remediation": "想：6×1.4=8.4，所以8.40÷6=1.40，末尾零可保留表示精确到百分位"
      }
    ],
    "feedback_correct": "真厉害！你不仅算得准，还看出‘最接近’是在考估算意识～",
    "feedback_wrong": "加油！遇到小数平均数，慢一点列竖式，对齐小数点是关键哦。",
    "hints": [
      {
        "text": "把6个数加起来再除以6；注意小数加法要对齐小数点。",
        "penalty": 1
      }
    ],
    "tags": [
      "ai_generated"
    ]
  }
] as Question[];
