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
];
