/**
 * 语文 · 题包 v2（Phase 2.x）。
 *
 * 在 questions.ts 60+ 题基础上扩展更多题型：
 *  - 近义词 / 反义词
 *  - 关联词填空
 *  - 量词搭配
 *  - 多音字读音
 *  - 成语补字
 *  - 标点符号
 *  - 课内填空（课文原句）
 *  - 病句修改
 *  - 句子排序（用 4 种序号选项）
 *
 * 全部用 plain_choice 模板，4 选 1。
 *
 * 期中后扩展方向：句子修辞改写 / 课内阅读 / 文学常识 / 写作模板。
 */

import type { Question } from "../../core/types";
import { pickChoice } from "./questionHelpers";

const U1 = "C4B_U1_NATURE";
const U2 = "C4B_U2_SCIENCE";
const U3 = "C4B_U3_POETRY";
const U4 = "C4B_U4_ANIMALS";

const PINYIN_U1 = "C4B_U1_PINYIN";
const POEM_U1 = "C4B_U1_POEM_RECITE";
const VOCAB_U1 = "C4B_U1_VOCAB";
const PINYIN_U2 = "C4B_U2_PINYIN";
const VOCAB_U2 = "C4B_U2_VOCAB";
const PINYIN_U3 = "C4B_U3_PINYIN";
const RHET_U3 = "C4B_U3_RHETORIC";
const PINYIN_U4 = "C4B_U4_PINYIN";
const VOCAB_U4 = "C4B_U4_VOCAB";

export const SEED_QUESTIONS_CHINESE_V2: Question[] = [
  // =================================================================
  // 近义词
  // =================================================================
  pickChoice({
    id: "cn-syn-001",
    unit_id: U1,
    skill_id: VOCAB_U1,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: '"舒服"的近义词是？',
    options: [
      { id: "a", text: "舒适" },
      { id: "b", text: "辛苦", errorTag: "antonym_picked" },
      { id: "c", text: "拥挤", errorTag: "wrong_meaning" },
      { id: "d", text: "嘈杂", errorTag: "wrong_meaning" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-syn-002",
    unit_id: U1,
    skill_id: VOCAB_U1,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: '"辽阔"的近义词是？',
    options: [
      { id: "a", text: "广阔" },
      { id: "b", text: "狭窄", errorTag: "antonym_picked" },
      { id: "c", text: "拥挤", errorTag: "wrong_meaning" },
      { id: "d", text: "深沉", errorTag: "wrong_meaning" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-syn-003",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: '"敏捷"的近义词是？',
    options: [
      { id: "a", text: "灵活" },
      { id: "b", text: "缓慢", errorTag: "antonym_picked" },
      { id: "c", text: "笨拙", errorTag: "antonym_picked" },
      { id: "d", text: "粗糙", errorTag: "wrong_meaning" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-syn-004",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["vocabulary"],
    difficulty: 3,
    stem: '"凶猛"的近义词是？',
    options: [
      { id: "a", text: "猛烈" },
      { id: "b", text: "温和", errorTag: "antonym_picked" },
      { id: "c", text: "胆小", errorTag: "antonym_picked" },
      { id: "d", text: "聪明", errorTag: "wrong_meaning" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-syn-005",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: '"古怪"的近义词是？',
    options: [
      { id: "a", text: "奇怪" },
      { id: "b", text: "正常", errorTag: "antonym_picked" },
      { id: "c", text: "美丽", errorTag: "wrong_meaning" },
      { id: "d", text: "整齐", errorTag: "wrong_meaning" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-syn-006",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["vocabulary"],
    difficulty: 3,
    stem: '"高傲"的近义词是？',
    options: [
      { id: "a", text: "骄傲" },
      { id: "b", text: "谦虚", errorTag: "antonym_picked" },
      { id: "c", text: "勤劳", errorTag: "wrong_meaning" },
      { id: "d", text: "热情", errorTag: "wrong_meaning" },
    ],
    correct: "a",
  }),

  // =================================================================
  // 反义词
  // =================================================================
  pickChoice({
    id: "cn-ant-001",
    unit_id: U1,
    skill_id: VOCAB_U1,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: '"稀疏"的反义词是？',
    options: [
      { id: "a", text: "茂密" },
      { id: "b", text: "稀少", errorTag: "synonym_picked" },
      { id: "c", text: "空虚", errorTag: "wrong_meaning" },
      { id: "d", text: "细小", errorTag: "wrong_meaning" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-ant-002",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: '"巨大"的反义词是？',
    options: [
      { id: "a", text: "渺小" },
      { id: "b", text: "宏伟", errorTag: "synonym_picked" },
      { id: "c", text: "广阔", errorTag: "wrong_meaning" },
      { id: "d", text: "笨重", errorTag: "wrong_meaning" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-ant-003",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: '"喧闹"的反义词是？',
    options: [
      { id: "a", text: "安静" },
      { id: "b", text: "热闹", errorTag: "synonym_picked" },
      { id: "c", text: "响亮", errorTag: "synonym_picked" },
      { id: "d", text: "嘈杂", errorTag: "synonym_picked" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-ant-004",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["vocabulary"],
    difficulty: 3,
    stem: '"从容"的反义词是？',
    options: [
      { id: "a", text: "慌张" },
      { id: "b", text: "镇定", errorTag: "synonym_picked" },
      { id: "c", text: "平静", errorTag: "synonym_picked" },
      { id: "d", text: "缓慢", errorTag: "wrong_meaning" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-ant-005",
    unit_id: U3,
    skill_id: PINYIN_U3,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: '"洁白"的反义词是？',
    options: [
      { id: "a", text: "乌黑" },
      { id: "b", text: "雪白", errorTag: "synonym_picked" },
      { id: "c", text: "纯净", errorTag: "synonym_picked" },
      { id: "d", text: "明亮", errorTag: "wrong_meaning" },
    ],
    correct: "a",
  }),

  // =================================================================
  // 关联词填空
  // =================================================================
  pickChoice({
    id: "cn-conj-001",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["sentence"],
    difficulty: 3,
    stem: '在空格里填关联词："____ 他生病了，____ 还坚持上学。"',
    options: [
      { id: "a", text: "虽然 …… 但是" },
      { id: "b", text: "因为 …… 所以", errorTag: "wrong_logic" },
      { id: "c", text: "如果 …… 就", errorTag: "wrong_logic" },
      { id: "d", text: "只要 …… 就", errorTag: "wrong_logic" },
    ],
    correct: "a",
    solution: ["前后是转折关系：生病本应在家，却仍坚持上学，用'虽然……但是'。"],
  }),
  pickChoice({
    id: "cn-conj-002",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["sentence"],
    difficulty: 3,
    stem: '"____ 你不去，____ 我也不去。"',
    options: [
      { id: "a", text: "如果 …… 那么" },
      { id: "b", text: "虽然 …… 但是", errorTag: "wrong_logic" },
      { id: "c", text: "因为 …… 所以", errorTag: "wrong_logic" },
      { id: "d", text: "不仅 …… 而且", errorTag: "wrong_logic" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-conj-003",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["sentence"],
    difficulty: 3,
    stem: '"白桦树 ____ 美丽，____ 坚强。"',
    options: [
      { id: "a", text: "不仅 …… 而且" },
      { id: "b", text: "虽然 …… 但是", errorTag: "wrong_logic" },
      { id: "c", text: "如果 …… 就", errorTag: "wrong_logic" },
      { id: "d", text: "因为 …… 所以", errorTag: "wrong_logic" },
    ],
    correct: "a",
    solution: ["递进关系：'美丽'+'坚强'两个褒义并列加深，用'不仅……而且'。"],
  }),
  pickChoice({
    id: "cn-conj-004",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["sentence"],
    difficulty: 3,
    stem: '"猫 ____ 古怪，____ 我们都很喜欢它。"',
    options: [
      { id: "a", text: "尽管 …… 可是" },
      { id: "b", text: "因为 …… 所以", errorTag: "wrong_logic" },
      { id: "c", text: "只要 …… 就", errorTag: "wrong_logic" },
      { id: "d", text: "不是 …… 就是", errorTag: "wrong_logic" },
    ],
    correct: "a",
    solution: ["让步转折：尽管……可是。"],
  }),
  pickChoice({
    id: "cn-conj-005",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["sentence"],
    difficulty: 3,
    stem: '"____ 你按时复习，____ 一定能考好。"',
    options: [
      { id: "a", text: "只要 …… 就" },
      { id: "b", text: "虽然 …… 但是", errorTag: "wrong_logic" },
      { id: "c", text: "因为 …… 所以", errorTag: "wrong_logic" },
      { id: "d", text: "不仅 …… 而且", errorTag: "wrong_logic" },
    ],
    correct: "a",
    solution: ["条件关系：'只要……就'表示充分条件。"],
  }),

  // =================================================================
  // 量词搭配
  // =================================================================
  pickChoice({
    id: "cn-mw-001",
    unit_id: U1,
    skill_id: VOCAB_U1,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: "选出搭配正确的一组：",
    options: [
      { id: "a", text: "一（朵）花 · 一（群）羊 · 一（只）鸡" },
      { id: "b", text: "一（颗）花 · 一（个）羊 · 一（只）鸡", errorTag: "mw_error" },
      { id: "c", text: "一（朵）花 · 一（只）羊 · 一（颗）鸡", errorTag: "mw_error" },
      { id: "d", text: "一（个）花 · 一（条）羊 · 一（只）鸡", errorTag: "mw_error" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-mw-002",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: "下列搭配最准确的是：",
    options: [
      { id: "a", text: "一（块）琥珀 · 一（架）飞机 · 一（项）技术" },
      { id: "b", text: "一（个）琥珀 · 一（个）飞机 · 一（个）技术", errorTag: "mw_error" },
      { id: "c", text: "一（块）琥珀 · 一（条）飞机 · 一（项）技术", errorTag: "mw_error" },
      { id: "d", text: "一（颗）琥珀 · 一（架）飞机 · 一（次）技术", errorTag: "mw_error" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-mw-003",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: "选出搭配最自然的一组：",
    options: [
      { id: "a", text: "一（只）猫 · 一（群）鸡 · 一（只）鹅" },
      { id: "b", text: "一（条）猫 · 一（群）鸡 · 一（架）鹅", errorTag: "mw_error" },
      { id: "c", text: "一（只）猫 · 一（个）鸡 · 一（个）鹅", errorTag: "mw_error" },
      { id: "d", text: "一（位）猫 · 一（群）鸡 · 一（只）鹅", errorTag: "mw_error" },
    ],
    correct: "a",
  }),

  // =================================================================
  // 多音字读音
  // =================================================================
  pickChoice({
    id: "cn-poly-001",
    unit_id: U2,
    skill_id: PINYIN_U2,
    ability: ["phonics"],
    difficulty: 3,
    stem: '"恶"在"凶恶"和"恶心"中的读音是？',
    options: [
      { id: "a", text: "è / ě" },
      { id: "b", text: "ě / è", errorTag: "polyphone_confusion" },
      { id: "c", text: "wù / è", errorTag: "polyphone_confusion" },
      { id: "d", text: "è / wù", errorTag: "polyphone_confusion" },
    ],
    correct: "a",
    solution: ['"恶"三音：è（凶恶）/ ě（恶心）/ wù（厌恶）。'],
  }),
  pickChoice({
    id: "cn-poly-002",
    unit_id: U1,
    skill_id: PINYIN_U1,
    ability: ["phonics"],
    difficulty: 3,
    stem: '"挑"在"挑水"和"挑剔"中的读音是？',
    options: [
      { id: "a", text: "tiāo / tiāo（挑水）·tiāo / tī（挑剔）" },
      { id: "b", text: "tiǎo / tiāo", errorTag: "polyphone_confusion" },
      { id: "c", text: "tiáo / tiāo", errorTag: "polyphone_confusion" },
      { id: "d", text: "tāo / tiào", errorTag: "phonics_error" },
    ],
    correct: "a",
    solution: ['挑(tiāo)水 = 担水；挑(tiāo) 剔 / 挑(tiǎo)拨。常读 tiāo，挑拨意时读 tiǎo。'],
  }),
  pickChoice({
    id: "cn-poly-003",
    unit_id: U4,
    skill_id: PINYIN_U4,
    ability: ["phonics"],
    difficulty: 3,
    stem: '"得"在"得意"和"跑得快"中读？',
    options: [
      { id: "a", text: "dé / de" },
      { id: "b", text: "de / dé", errorTag: "polyphone_confusion" },
      { id: "c", text: "děi / de", errorTag: "polyphone_confusion" },
      { id: "d", text: "dě / de", errorTag: "phonics_error" },
    ],
    correct: "a",
    solution: ['"得"三音：dé（得到）/ de（结构助词："跑得快"）/ děi（必须，"我得走了"）。'],
  }),
  pickChoice({
    id: "cn-poly-004",
    unit_id: U1,
    skill_id: PINYIN_U1,
    ability: ["phonics"],
    difficulty: 3,
    stem: '"长"在"长大"和"长江"中读？',
    options: [
      { id: "a", text: "zhǎng / cháng" },
      { id: "b", text: "cháng / zhǎng", errorTag: "polyphone_confusion" },
      { id: "c", text: "zhāng / cháng", errorTag: "tone_confusion" },
      { id: "d", text: "都读 cháng", errorTag: "polyphone_confusion" },
    ],
    correct: "a",
    solution: ['"长"两音：zhǎng（生长，"长大"）/ cháng（长度，"长江"长城）。'],
  }),

  // =================================================================
  // 成语补字
  // =================================================================
  pickChoice({
    id: "cn-idiom-001",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["vocabulary", "accumulation"],
    difficulty: 3,
    stem: "成语补字：____ 先恐后",
    options: [
      { id: "a", text: "争" },
      { id: "b", text: "拼", errorTag: "idiom_glyph" },
      { id: "c", text: "急", errorTag: "idiom_glyph" },
      { id: "d", text: "真", errorTag: "idiom_glyph" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-idiom-002",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["vocabulary", "accumulation"],
    difficulty: 3,
    stem: "成语补字：千 ____ 万 ____（数量极多）",
    options: [
      { id: "a", text: '千变万化（也对："千言万语""千军万马"）' },
      { id: "b", text: "千万之间", errorTag: "idiom_form" },
      { id: "c", text: "千千万万", errorTag: "idiom_form" },
      { id: "d", text: "千秋万岁", errorTag: "idiom_meaning" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-idiom-003",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["vocabulary", "accumulation"],
    difficulty: 3,
    stem: "成语补字：____ 容 ____ 迫（不慌不忙）",
    options: [
      { id: "a", text: "从 / 不" },
      { id: "b", text: "纵 / 不", errorTag: "idiom_glyph" },
      { id: "c", text: "从 / 比", errorTag: "idiom_glyph" },
      { id: "d", text: "丛 / 不", errorTag: "idiom_glyph" },
    ],
    correct: "a",
    solution: ["从容不迫：形容不慌不忙。"],
  }),
  pickChoice({
    id: "cn-idiom-004",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["vocabulary", "accumulation"],
    difficulty: 3,
    stem: "成语补字：____ 死 ____ 生",
    options: [
      { id: "a", text: "出 / 入（出生入死）" },
      { id: "b", text: "贪 / 怕", errorTag: "idiom_form" },
      { id: "c", text: "舍 / 求", errorTag: "idiom_form" },
      { id: "d", text: "九 / 一", errorTag: "idiom_form" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-idiom-005",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["vocabulary", "accumulation"],
    difficulty: 3,
    stem: "成语补字：屏 ____ 凝 ____（形容专注）",
    options: [
      { id: "a", text: "息 / 视" },
      { id: "b", text: "气 / 视", errorTag: "idiom_glyph" },
      { id: "c", text: "息 / 看", errorTag: "idiom_glyph" },
      { id: "d", text: "声 / 视", errorTag: "idiom_glyph" },
    ],
    correct: "a",
    solution: ["屏息凝视：抑制呼吸、专注地看。"],
  }),

  // =================================================================
  // 病句修改
  // =================================================================
  pickChoice({
    id: "cn-fix-001",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["sentence"],
    difficulty: 3,
    stem: '修改病句："他大约是十岁左右。" 最佳改法：',
    options: [
      { id: "a", text: '他大约十岁。（去掉"是"和"左右"，避免重复表估计）' },
      { id: "b", text: "他大约是十岁。", errorTag: "partial_fix" },
      { id: "c", text: "他十岁左右。", errorTag: "ok_alt" },
      { id: "d", text: "他是十岁左右。", errorTag: "didnt_fix" },
    ],
    correct: "a",
    solution: ['"大约"和"左右"都表估计，重复。a 和 c 都正确，但 a 最规范。'],
  }),
  pickChoice({
    id: "cn-fix-002",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["sentence"],
    difficulty: 3,
    stem: '修改病句："我们要勇于改正并发现自己的错误。"',
    options: [
      { id: "a", text: "我们要勇于发现并改正自己的错误。（语序错：先发现再改正）" },
      { id: "b", text: "我们要发现并勇于改正自己的错误。", errorTag: "partial_fix" },
      { id: "c", text: "原句没问题。", errorTag: "didnt_see_error" },
      { id: "d", text: "我们要改正并发现自己的错误。", errorTag: "didnt_fix" },
    ],
    correct: "a",
    solution: ["逻辑顺序错：要先发现错误才能改正。"],
  }),
  pickChoice({
    id: "cn-fix-003",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["sentence"],
    difficulty: 3,
    stem: '修改病句："小明的学习成绩非常优秀的同学。" 最佳改法：',
    options: [
      { id: "a", text: "小明是学习成绩非常优秀的同学。" },
      { id: "b", text: "小明学习成绩非常优秀的同学。", errorTag: "didnt_fix" },
      { id: "c", text: "小明的学习成绩非常优秀。", errorTag: "ok_alt" },
      { id: "d", text: "小明的学习成绩是非常优秀的同学。", errorTag: "didnt_fix" },
    ],
    correct: "a",
    solution: ["句子主语和谓语对不上。a 加'是'让结构完整，c 改成只说成绩也通顺。"],
  }),
  pickChoice({
    id: "cn-fix-004",
    unit_id: U1,
    skill_id: VOCAB_U1,
    ability: ["sentence"],
    difficulty: 3,
    stem: '修改病句："春天到了，草地上盛开着许多五颜六色的红花。"',
    options: [
      { id: "a", text: "草地上盛开着许多五颜六色的花。（红花和五颜六色矛盾，去掉'红'）" },
      { id: "b", text: "草地上盛开着许多红色的花。", errorTag: "ok_alt" },
      { id: "c", text: "原句没问题。", errorTag: "didnt_see_error" },
      { id: "d", text: "草地上有许多五颜六色的红花。", errorTag: "didnt_fix" },
    ],
    correct: "a",
    solution: ["五颜六色与红花矛盾。"],
  }),

  // =================================================================
  // 句子排序
  // =================================================================
  pickChoice({
    id: "cn-order-001",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["sentence", "reading"],
    difficulty: 4,
    stem:
      "把下列句子排成一段通顺的话：①琥珀里有一只蜘蛛和一只苍蝇。②人们发现了一块琥珀。③这是几万年前的事。④通过琥珀可以推测当时发生的事情。",
    options: [
      { id: "a", text: "②①④③" },
      { id: "b", text: "①②③④", errorTag: "order_error" },
      { id: "c", text: "③②①④", errorTag: "order_error" },
      { id: "d", text: "②③①④", errorTag: "order_error" },
    ],
    correct: "a",
    solution: ["先发现琥珀（②），看到里面的虫子（①），通过它推测事情（④），最后说这是几万年前（③ 时间收尾）。"],
  }),
  pickChoice({
    id: "cn-order-002",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["sentence", "reading"],
    difficulty: 4,
    stem:
      "排序：①然后它会蹭你的腿。②猫想引起你注意时。③这时你就知道它饿了。④它先会喵喵地叫几声。",
    options: [
      { id: "a", text: "②④①③" },
      { id: "b", text: "②①④③", errorTag: "order_error" },
      { id: "c", text: "④②①③", errorTag: "order_error" },
      { id: "d", text: "②③④①", errorTag: "order_error" },
    ],
    correct: "a",
    solution: ["先讲场景（猫想引人注意），再讲先后动作（叫→蹭），最后讲推论（饿了）。"],
  }),
  pickChoice({
    id: "cn-order-003",
    unit_id: U1,
    skill_id: VOCAB_U1,
    ability: ["sentence", "reading"],
    difficulty: 4,
    stem:
      "排序：①小屋的天窗，是孩子们唯一的慰藉。②风雨之夜，孩子们被关在屋里。③他们望着天窗想象外面的世界。④于是他们快乐起来。",
    options: [
      { id: "a", text: "②①③④" },
      { id: "b", text: "①②③④", errorTag: "order_error" },
      { id: "c", text: "②③①④", errorTag: "order_error" },
      { id: "d", text: "①③②④", errorTag: "order_error" },
    ],
    correct: "a",
    solution: ["先讲场景（被关），引出主题（天窗是慰藉），再展开（想象），收尾（快乐）。"],
  }),

  // =================================================================
  // 标点符号
  // =================================================================
  pickChoice({
    id: "cn-punct-001",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["sentence"],
    difficulty: 2,
    stem: '"我喜欢苹果____梨____橘子____" 横线处依次填？',
    options: [
      { id: "a", text: "、 / 、 / 。" },
      { id: "b", text: "， / ， / 。", errorTag: "punct_error" },
      { id: "c", text: "、 / 、 / ！", errorTag: "punct_error" },
      { id: "d", text: "， / 、 / 。", errorTag: "punct_error" },
    ],
    correct: "a",
    solution: ["并列名词之间用顿号'、'，句末用'。'。"],
  }),
  pickChoice({
    id: "cn-punct-002",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["sentence"],
    difficulty: 3,
    stem: '"小红问____你今天去哪里____" 横线处依次是？',
    options: [
      { id: "a", text: "： / ？" },
      { id: "b", text: "， / 。", errorTag: "punct_error" },
      { id: "c", text: "： / 。", errorTag: "punct_error" },
      { id: "d", text: "， / ？", errorTag: "punct_error" },
    ],
    correct: "a",
    solution: ["'问'后用冒号引出说话内容；问句末用问号。"],
  }),
  pickChoice({
    id: "cn-punct-003",
    unit_id: U3,
    skill_id: PINYIN_U3,
    ability: ["sentence"],
    difficulty: 2,
    stem: '"啊____多么美丽的春天____" 横线处依次是？',
    options: [
      { id: "a", text: "， / ！" },
      { id: "b", text: "！ / 。", errorTag: "punct_error" },
      { id: "c", text: "： / ！", errorTag: "punct_error" },
      { id: "d", text: "， / 。", errorTag: "punct_error" },
    ],
    correct: "a",
    solution: ["感叹句末用'！'；'啊'后短停用逗号。"],
  }),

  // =================================================================
  // 课内填空（课文原句空 1-2 字）
  // =================================================================
  pickChoice({
    id: "cn-fill-001",
    unit_id: U1,
    skill_id: VOCAB_U1,
    ability: ["accumulation"],
    difficulty: 2,
    stem: '《乡下人家》："他们的屋后边，常常有一________瓜架。" 横线处填？',
    options: [
      { id: "a", text: "片" },
      { id: "b", text: "条", errorTag: "mw_error" },
      { id: "c", text: "块", errorTag: "mw_error" },
      { id: "d", text: "排", errorTag: "ok_alt" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-fill-002",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["accumulation"],
    difficulty: 3,
    stem: '《琥珀》："这一定是____千万年前的事情了。" 横线处填？',
    options: [
      { id: "a", text: "几" },
      { id: "b", text: "好", errorTag: "wrong_word" },
      { id: "c", text: "成", errorTag: "wrong_word" },
      { id: "d", text: "上", errorTag: "wrong_word" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-fill-003",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["accumulation"],
    difficulty: 3,
    stem: '《猫》："说它老实吧，它的____有时候很乖。" 横线处填？',
    options: [
      { id: "a", text: "确" },
      { id: "b", text: "实", errorTag: "wrong_word" },
      { id: "c", text: "却", errorTag: "wrong_word" },
      { id: "d", text: "也", errorTag: "wrong_word" },
    ],
    correct: "a",
    solution: ["原文：'说它老实吧，它的确有时候很乖；……'。"],
  }),
  pickChoice({
    id: "cn-fill-004",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["accumulation"],
    difficulty: 3,
    stem: '《白鹅》："它（鹅）的步态____更是傲慢了。" 横线处填？',
    options: [
      { id: "a", text: "从容" },
      { id: "b", text: "缓慢", errorTag: "near_synonym" },
      { id: "c", text: "悠然", errorTag: "near_synonym" },
      { id: "d", text: "稳健", errorTag: "near_synonym" },
    ],
    correct: "a",
    solution: ["丰子恺原文：'它的步态从容更是傲慢了'。"],
  }),

  // =================================================================
  // 修辞辨认（再补一些）
  // =================================================================
  pickChoice({
    id: "cn-rhet-extra-001",
    unit_id: U3,
    skill_id: RHET_U3,
    ability: ["sentence"],
    difficulty: 3,
    stem: '"红的像火，粉的像霞，白的像雪。" 用了什么修辞？',
    options: [
      { id: "a", text: "比喻 + 排比" },
      { id: "b", text: "拟人 + 比喻", errorTag: "rhetoric_confusion" },
      { id: "c", text: "夸张 + 排比", errorTag: "rhetoric_confusion" },
      { id: "d", text: "比喻 + 反问", errorTag: "rhetoric_confusion" },
    ],
    correct: "a",
    solution: ["三个'像 X'是比喻；三个结构相同的并列是排比。"],
  }),
  pickChoice({
    id: "cn-rhet-extra-002",
    unit_id: U3,
    skill_id: RHET_U3,
    ability: ["sentence"],
    difficulty: 3,
    stem: '"飞流直下三千尺" 用了什么修辞？',
    options: [
      { id: "a", text: "夸张" },
      { id: "b", text: "比喻", errorTag: "rhetoric_confusion" },
      { id: "c", text: "拟人", errorTag: "rhetoric_confusion" },
      { id: "d", text: "对偶", errorTag: "rhetoric_confusion" },
    ],
    correct: "a",
    solution: ["三千尺是把瀑布的高度夸大了，是夸张。"],
  }),
  pickChoice({
    id: "cn-rhet-extra-003",
    unit_id: U3,
    skill_id: RHET_U3,
    ability: ["sentence"],
    difficulty: 3,
    stem: '"问君能有几多愁？恰似一江春水向东流。" 用了什么修辞？',
    options: [
      { id: "a", text: "设问 + 比喻" },
      { id: "b", text: "拟人 + 排比", errorTag: "rhetoric_confusion" },
      { id: "c", text: "反问 + 夸张", errorTag: "rhetoric_confusion" },
      { id: "d", text: "对比 + 比喻", errorTag: "rhetoric_confusion" },
    ],
    correct: "a",
    solution: ["先自问'有多少愁'再自答'像一江春水'，前是设问后是比喻。"],
  }),

  // =================================================================
  // 字音字形（补足）
  // =================================================================
  pickChoice({
    id: "cn-extra-pinyin-001",
    unit_id: U1,
    skill_id: PINYIN_U1,
    ability: ["phonics"],
    difficulty: 2,
    stem: '"鸡冠"中"冠"读？',
    options: [
      { id: "a", text: "guān（皇冠 / 鸡冠）" },
      { id: "b", text: "guàn（冠军）", errorTag: "polyphone_confusion" },
      { id: "c", text: "guǎn", errorTag: "phonics_error" },
      { id: "d", text: "kuān", errorTag: "phonics_error" },
    ],
    correct: "a",
    solution: ['"冠"两音：guān（帽子 / 鸡冠 / 加冠）/ guàn（冠军 / 夺冠）。'],
  }),
  pickChoice({
    id: "cn-extra-pinyin-002",
    unit_id: U2,
    skill_id: PINYIN_U2,
    ability: ["phonics"],
    difficulty: 2,
    stem: '"恐龙"的"恐"组词哪个不对？',
    options: [
      { id: "a", text: '"恐流"（实际不是词）' },
      { id: "b", text: "恐惧", errorTag: "ok_actually" },
      { id: "c", text: "恐怕", errorTag: "ok_actually" },
      { id: "d", text: "惊恐", errorTag: "ok_actually" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-extra-pinyin-003",
    unit_id: U4,
    skill_id: PINYIN_U4,
    ability: ["glyph"],
    difficulty: 2,
    stem: "选出全对的一组：",
    options: [
      { id: "a", text: "捕捉 · 蹒跚 · 模仿 · 安静" },
      { id: "b", text: "捕捉 · 蹒跚 · 摸仿 · 安静", errorTag: "glyph_homophone" },
      { id: "c", text: "捕拙 · 蹒跚 · 模仿 · 安静", errorTag: "glyph_homophone" },
      { id: "d", text: "捕捉 · 璠跚 · 模仿 · 安净", errorTag: "glyph_homophone" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-extra-pinyin-004",
    unit_id: U1,
    skill_id: PINYIN_U1,
    ability: ["phonics"],
    difficulty: 2,
    stem: '"卷"在"试卷"和"卷起来"中读？',
    options: [
      { id: "a", text: "juàn / juǎn" },
      { id: "b", text: "juǎn / juàn", errorTag: "polyphone_confusion" },
      { id: "c", text: "都读 juàn", errorTag: "polyphone_confusion" },
      { id: "d", text: "都读 juǎn", errorTag: "polyphone_confusion" },
    ],
    correct: "a",
    solution: ['"卷"两音：juàn（试卷、考卷，名词）/ juǎn（卷起来，动词）。'],
  }),
  pickChoice({
    id: "cn-extra-pinyin-005",
    unit_id: U2,
    skill_id: PINYIN_U2,
    ability: ["glyph"],
    difficulty: 2,
    stem: "下列哪个词写错了？",
    options: [
      { id: "a", text: "辨认", errorTag: "ok_actually" },
      { id: "b", text: "辩论", errorTag: "ok_actually" },
      { id: "c", text: "辫子", errorTag: "ok_actually" },
      { id: "d", text: "辩别", errorTag: "glyph_homophone" },
    ],
    correct: "d",
    solution: ['"辨别"是用力分开两者；"辩论"是争论。'],
  }),
];

export const SEED_QUESTIONS_CHINESE_V2_COUNT = SEED_QUESTIONS_CHINESE_V2.length;
