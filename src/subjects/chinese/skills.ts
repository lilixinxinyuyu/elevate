/**
 * 语文 · C4B 技能定义。
 *
 * 每个技能挂在一个 unit 下，标注 ability 维度 + examPriority。Phase 2 MVP 重点
 * 几个技能：拼音字音、字形辨析、古诗背诵、词语搭配、修辞辨认。Selena 期中考
 * 4 单元前内容。
 *
 * ability id 来自 src/subjects/chinese/index.ts 里的 CHINESE_ABILITIES：
 * phonics（字音）/ glyph（字形）/ vocabulary（词汇）/ sentence（句子）/
 * reading（阅读）/ expression（表达）/ accumulation（积累）。
 *
 * 但 Skill.ability 类型是 AbilityId[]（math 那套 calculation/concept/...），
 * Phase 2 MVP 暂时把语文 ability 也当 AbilityId 字符串塞进去（TS 的 union
 * 不严格校验，运行期是字符串数组）。Phase 3 把 AbilityId 改成 string 让 ts
 * 真正校验各学科自己的维度。
 */

import type { Skill } from "../../core/types";

// 借 ts-as-unknown 绕过类型校验（语文 ability id 不在 math AbilityId 里）。
// Phase 3 去耦合时统一改 AbilityId 为 string。
const ab = (...ids: string[]): Skill["ability"] => ids as Skill["ability"];

export const SKILLS_CHINESE: Skill[] = [
  // ===== 第一单元 =====
  {
    id: "C4B_U1_PINYIN",
    subjectId: "chinese",
    unitId: "C4B_U1_NATURE",
    name: "字音字形（第一单元）",
    ability: ab("phonics", "glyph"),
    difficultyBase: 2,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U1_POEM_RECITE",
    subjectId: "chinese",
    unitId: "C4B_U1_NATURE",
    name: "古诗补字（宿新市 / 四时 / 清平乐）",
    ability: ab("accumulation", "glyph"),
    difficultyBase: 3,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U1_VOCAB",
    subjectId: "chinese",
    unitId: "C4B_U1_NATURE",
    name: "词语搭配（乡下人家 / 天窗）",
    ability: ab("vocabulary"),
    difficultyBase: 2,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U1_DICTATION",
    subjectId: "chinese",
    unitId: "C4B_U1_NATURE",
    name: "听写（第一单元词语）",
    ability: ab("phonics", "glyph"),
    difficultyBase: 3,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },

  // ===== 第二单元 =====
  {
    id: "C4B_U2_PINYIN",
    subjectId: "chinese",
    unitId: "C4B_U2_SCIENCE",
    name: "字音字形（第二单元）",
    ability: ab("phonics", "glyph"),
    difficultyBase: 2,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U2_VOCAB",
    subjectId: "chinese",
    unitId: "C4B_U2_SCIENCE",
    name: "科技词语 / 形近字辨析",
    ability: ab("vocabulary", "glyph"),
    difficultyBase: 3,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U2_DICTATION",
    subjectId: "chinese",
    unitId: "C4B_U2_SCIENCE",
    name: "听写（第二单元词语）",
    ability: ab("phonics", "glyph"),
    difficultyBase: 3,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },

  // ===== 第三单元 =====
  {
    id: "C4B_U3_PINYIN",
    subjectId: "chinese",
    unitId: "C4B_U3_POETRY",
    name: "字音字形（第三单元）",
    ability: ab("phonics", "glyph"),
    difficultyBase: 2,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U3_RHETORIC",
    subjectId: "chinese",
    unitId: "C4B_U3_POETRY",
    name: "修辞辨认（比喻 / 拟人 / 排比）",
    ability: ab("sentence", "expression"),
    difficultyBase: 3,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },

  // ===== 第四单元 =====
  {
    id: "C4B_U4_PINYIN",
    subjectId: "chinese",
    unitId: "C4B_U4_ANIMALS",
    name: "字音字形（第四单元）",
    ability: ab("phonics", "glyph"),
    difficultyBase: 2,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U4_VOCAB",
    subjectId: "chinese",
    unitId: "C4B_U4_ANIMALS",
    name: "动物描写词语 / 形近字",
    ability: ab("vocabulary", "glyph"),
    difficultyBase: 2,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    // v0.36.38: 字形侦探 cluster (C2) — 偏旁部首/形声字/会意字, 跨单元字形通考点.
    // 锚在 U4 (动物单元有犭/猫等好例), 题目本身跨 U1-U4 (hanziDesc 标真实出处).
    id: "C4B_GLYPH_RADICAL",
    subjectId: "chinese",
    unitId: "C4B_U4_ANIMALS",
    name: "字形侦探（偏旁部首 / 形声字）",
    ability: ab("glyph", "vocabulary"),
    difficultyBase: 3,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U4_DICTATION",
    subjectId: "chinese",
    unitId: "C4B_U4_ANIMALS",
    name: "听写（第四单元词语）",
    ability: ab("phonics", "glyph"),
    difficultyBase: 3,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },

  // ===== 第五单元 · 游记 =====
  {
    id: "C4B_U5_PINYIN",
    subjectId: "chinese",
    unitId: "C4B_U5_TRAVEL",
    name: "字音字形（第五单元）",
    ability: ab("phonics", "glyph"),
    difficultyBase: 2,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U5_VOCAB",
    subjectId: "chinese",
    unitId: "C4B_U5_TRAVEL",
    name: "游记词语 / 多音字（刹、荷、调）",
    ability: ab("vocabulary", "phonics"),
    difficultyBase: 3,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U5_ORDER",
    subjectId: "chinese",
    unitId: "C4B_U5_TRAVEL",
    name: "游览顺序 / 过渡句辨认",
    ability: ab("reading", "expression"),
    difficultyBase: 3,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U5_DICTATION",
    subjectId: "chinese",
    unitId: "C4B_U5_TRAVEL",
    name: "听写（第五单元词语）",
    ability: ab("phonics", "glyph"),
    difficultyBase: 3,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },

  // ============================================================
  // v0.35.93 (爸爸 2026-05-19) — 错别字 skill (P2-1)
  // 期中考第 4 题型 "李强来信 3 处错别字 + 1 处错用标点". G4B 高频考点.
  // 每 unit (U1-U4) 一个 TYPOS skill, 难度 3, examPriority MUST_BIG.
  // ============================================================
  {
    id: "C4B_U1_TYPOS",
    subjectId: "chinese",
    unitId: "C4B_U1_NATURE",
    name: "错别字辨认（第一单元）",
    ability: ab("glyph", "vocabulary"),
    difficultyBase: 3,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U2_TYPOS",
    subjectId: "chinese",
    unitId: "C4B_U2_SCIENCE",
    name: "错别字辨认（第二单元）",
    ability: ab("glyph", "vocabulary"),
    difficultyBase: 3,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U3_TYPOS",
    subjectId: "chinese",
    unitId: "C4B_U3_POETRY",
    name: "错别字辨认（第三单元）",
    ability: ab("glyph", "vocabulary"),
    difficultyBase: 3,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U4_TYPOS",
    subjectId: "chinese",
    unitId: "C4B_U4_ANIMALS",
    name: "错别字辨认（第四单元）",
    ability: ab("glyph", "vocabulary"),
    difficultyBase: 3,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },

  // ============================================================
  // v0.35.95 (爸爸 2026-05-19) — 病句修改 skill (P2-2)
  // 期中考第 5 题型 "找 1 处语序颠倒句子, 用修改符号修改". G4B 高频考点.
  // 涉及: 语序颠倒 / 成分残缺 / 搭配不当 / 重复啰嗦 / 前后矛盾.
  // ============================================================
  {
    id: "C4B_U1_BADSENT",
    subjectId: "chinese",
    unitId: "C4B_U1_NATURE",
    name: "病句修改（第一单元）",
    ability: ab("sentence", "expression"),
    difficultyBase: 4,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U2_BADSENT",
    subjectId: "chinese",
    unitId: "C4B_U2_SCIENCE",
    name: "病句修改（第二单元）",
    ability: ab("sentence", "expression"),
    difficultyBase: 4,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U3_BADSENT",
    subjectId: "chinese",
    unitId: "C4B_U3_POETRY",
    name: "病句修改（第三单元）",
    ability: ab("sentence", "expression"),
    difficultyBase: 4,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U4_BADSENT",
    subjectId: "chinese",
    unitId: "C4B_U4_ANIMALS",
    name: "病句修改（第四单元）",
    ability: ab("sentence", "expression"),
    difficultyBase: 4,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },

  // ============================================================
  // v0.35.98 (爸爸 2026-05-19) — 仿写句子 skill (P2-3)
  // 期中考第 16-17 题 "调动颜色描写句子 / 写一个使用拟人比喻的句子". G4B 中难.
  // ============================================================
  {
    id: "C4B_U1_IMITATE",
    subjectId: "chinese",
    unitId: "C4B_U1_NATURE",
    name: "仿写句子（第一单元）",
    ability: ab("sentence", "expression"),
    difficultyBase: 4,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U2_IMITATE",
    subjectId: "chinese",
    unitId: "C4B_U2_SCIENCE",
    name: "仿写句子（第二单元）",
    ability: ab("sentence", "expression"),
    difficultyBase: 4,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U3_IMITATE",
    subjectId: "chinese",
    unitId: "C4B_U3_POETRY",
    name: "仿写句子（第三单元）",
    ability: ab("sentence", "expression"),
    difficultyBase: 4,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U4_IMITATE",
    subjectId: "chinese",
    unitId: "C4B_U4_ANIMALS",
    name: "仿写句子（第四单元）",
    ability: ab("sentence", "expression"),
    difficultyBase: 4,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },

  // ============================================================
  // v0.36.1 (爸爸 2026-05-19) — 阅读理解 multi-step skill (P2-4)
  // 期中考第 10-11 题型 "短文 + 多问" — G4B 必考 + 失分大头.
  // 短文长度: 150-250 字. 每短文 5 题 (主旨 / 概括 / 选词 / 推理 / 仿写).
  // ============================================================
  {
    id: "C4B_U1_READING",
    subjectId: "chinese",
    unitId: "C4B_U1_NATURE",
    name: "阅读理解（第一单元短文）",
    ability: ab("reading", "expression"),
    difficultyBase: 4,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U2_READING",
    subjectId: "chinese",
    unitId: "C4B_U2_SCIENCE",
    name: "阅读理解（第二单元短文）",
    ability: ab("reading", "expression"),
    difficultyBase: 4,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U3_READING",
    subjectId: "chinese",
    unitId: "C4B_U3_POETRY",
    name: "阅读理解（第三单元短文）",
    ability: ab("reading", "expression"),
    difficultyBase: 4,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },

  // ============================================================
  // v0.36.74 (爸爸 2026-05-21) — 期末备考扩量：U5 补足 + U6/U7/U8 新建。
  // 对齐期中卷情境化题型（看拼音写词/错别字/病句/近义词辨析/修辞/说明方法/
  // 词语理解/古诗文常识/阅读多问）+ 人教版四下课本课后练习。全册期末考。
  // ============================================================

  // ===== 第五单元 · 游记（补） =====
  {
    id: "C4B_U5_RHETORIC",
    subjectId: "chinese",
    unitId: "C4B_U5_TRAVEL",
    name: "修辞 / 仿写（海上日出 · 七月的天山）",
    ability: ab("sentence", "expression"),
    difficultyBase: 3,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U5_READING",
    subjectId: "chinese",
    unitId: "C4B_U5_TRAVEL",
    name: "阅读理解（第五单元游记短文）",
    ability: ab("reading", "expression"),
    difficultyBase: 4,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },

  // ===== 第六单元 · 成长故事 + 文言文 =====
  {
    id: "C4B_U6_PINYIN",
    subjectId: "chinese",
    unitId: "C4B_U6_GROWTH",
    name: "字音字形（第六单元）",
    ability: ab("phonics", "glyph"),
    difficultyBase: 2,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U6_VOCAB",
    subjectId: "chinese",
    unitId: "C4B_U6_GROWTH",
    name: "词语搭配 / 形近字（雨来 · 芦花鞋）",
    ability: ab("vocabulary", "glyph"),
    difficultyBase: 3,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U6_WENYAN",
    subjectId: "chinese",
    unitId: "C4B_U6_GROWTH",
    name: "文言文二则（囊萤夜读 / 铁杵成针）",
    ability: ab("accumulation", "reading"),
    difficultyBase: 4,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U6_SUMMARY",
    subjectId: "chinese",
    unitId: "C4B_U6_GROWTH",
    name: "把握长文章主要内容（小英雄雨来）",
    ability: ab("reading", "expression"),
    difficultyBase: 4,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U6_READING",
    subjectId: "chinese",
    unitId: "C4B_U6_GROWTH",
    name: "阅读理解（第六单元短文）",
    ability: ab("reading", "expression"),
    difficultyBase: 4,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U6_DICTATION",
    subjectId: "chinese",
    unitId: "C4B_U6_GROWTH",
    name: "听写（第六单元词语）",
    ability: ab("phonics", "glyph"),
    difficultyBase: 3,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },

  // ===== 第七单元 · 人物品质 + 古诗 =====
  {
    id: "C4B_U7_PINYIN",
    subjectId: "chinese",
    unitId: "C4B_U7_CHARACTER",
    name: "字音字形（第七单元）",
    ability: ab("phonics", "glyph"),
    difficultyBase: 2,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U7_VOCAB",
    subjectId: "chinese",
    unitId: "C4B_U7_CHARACTER",
    name: "词语搭配 / 形近字（黄继光 · 诺曼底号）",
    ability: ab("vocabulary", "glyph"),
    difficultyBase: 3,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U7_POEM",
    subjectId: "chinese",
    unitId: "C4B_U7_CHARACTER",
    name: "古诗三首（芙蓉楼送辛渐 / 塞下曲 / 墨梅）",
    ability: ab("accumulation", "glyph"),
    difficultyBase: 3,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U7_CHARACTER_SKILL",
    subjectId: "chinese",
    unitId: "C4B_U7_CHARACTER",
    name: "感受人物品质（语言 / 动作 / 神态）",
    ability: ab("reading", "expression"),
    difficultyBase: 4,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U7_READING",
    subjectId: "chinese",
    unitId: "C4B_U7_CHARACTER",
    name: "阅读理解（第七单元短文）",
    ability: ab("reading", "expression"),
    difficultyBase: 4,
    priority: "VERY_HIGH",
    examPriority: "MUST_BIG",
  },
  {
    id: "C4B_U7_DICTATION",
    subjectId: "chinese",
    unitId: "C4B_U7_CHARACTER",
    name: "听写（第七单元词语）",
    ability: ab("phonics", "glyph"),
    difficultyBase: 3,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },

  // ===== 第八单元 · 童话故事 =====
  {
    id: "C4B_U8_PINYIN",
    subjectId: "chinese",
    unitId: "C4B_U8_FAIRYTALE",
    name: "字音字形（第八单元）",
    ability: ab("phonics", "glyph"),
    difficultyBase: 2,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U8_VOCAB",
    subjectId: "chinese",
    unitId: "C4B_U8_FAIRYTALE",
    name: "词语搭配 / 形近字（巨人的花园 · 海的女儿）",
    ability: ab("vocabulary", "glyph"),
    difficultyBase: 3,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U8_IMAGINE",
    subjectId: "chinese",
    unitId: "C4B_U8_FAIRYTALE",
    name: "童话想象 / 复述（宝葫芦 · 巨人的花园）",
    ability: ab("reading", "expression"),
    difficultyBase: 3,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U8_SENTENCE",
    subjectId: "chinese",
    unitId: "C4B_U8_FAIRYTALE",
    name: "句子 / 修辞（童话描写）",
    ability: ab("sentence", "expression"),
    difficultyBase: 3,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U8_READING",
    subjectId: "chinese",
    unitId: "C4B_U8_FAIRYTALE",
    name: "阅读理解（第八单元短文）",
    ability: ab("reading", "expression"),
    difficultyBase: 4,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
  {
    id: "C4B_U8_DICTATION",
    subjectId: "chinese",
    unitId: "C4B_U8_FAIRYTALE",
    name: "听写（第八单元词语）",
    ability: ab("phonics", "glyph"),
    difficultyBase: 3,
    priority: "HIGH",
    examPriority: "HIGH_BIG",
  },
];
