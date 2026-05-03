/**
 * 语文 · C4B 第 1-4 单元题包（Phase 2 MVP）。
 *
 * 形态：4 选 1 + 听写（带 audio_text）。覆盖期中考点：字音 / 字形 / 古诗补字 /
 * 词语搭配 / 修辞辨认。每个 unit 至少 15-20 题；总目标 80+。
 *
 * 后续扩展：句子排序 / 病句修改 / 阅读理解多步题，期中后做。
 */

import type { Question } from "../../core/types";
import { pickChoice, dictation } from "./questionHelpers";

const U1 = "C4B_U1_NATURE";
const U2 = "C4B_U2_SCIENCE";
const U3 = "C4B_U3_POETRY";
const U4 = "C4B_U4_ANIMALS";

const PINYIN_U1 = "C4B_U1_PINYIN";
const POEM_U1 = "C4B_U1_POEM_RECITE";
const VOCAB_U1 = "C4B_U1_VOCAB";
const DICT_U1 = "C4B_U1_DICTATION";

const PINYIN_U2 = "C4B_U2_PINYIN";
const VOCAB_U2 = "C4B_U2_VOCAB";
const DICT_U2 = "C4B_U2_DICTATION";

const PINYIN_U3 = "C4B_U3_PINYIN";
const RHET_U3 = "C4B_U3_RHETORIC";

const PINYIN_U4 = "C4B_U4_PINYIN";
const VOCAB_U4 = "C4B_U4_VOCAB";
const DICT_U4 = "C4B_U4_DICTATION";

export const SEED_QUESTIONS_CHINESE: Question[] = [
  // ============================================================
  // 第一单元：字音字形
  // ============================================================
  pickChoice({
    id: "cn-u1-pinyin-001",
    unit_id: U1,
    skill_id: PINYIN_U1,
    ability: ["phonics", "glyph"],
    difficulty: 2,
    exam_priority: "MUST_BIG",
    stem: '下面哪个词的"宿"字读音是 sù？',
    options: [
      { id: "a", text: "宿舍（sù shè）" },
      { id: "b", text: "一宿（yī xiǔ）", errorTag: "polyphone_confusion" },
      { id: "c", text: "星宿（xīng xiù）", errorTag: "polyphone_confusion" },
      { id: "d", text: "三宿（sān xiǔ）", errorTag: "polyphone_confusion" },
    ],
    correct: "a",
    solution: ['"宿"是多音字：sù（住宿）/ xiǔ（一夜）/ xiù（星座）。这里是"住"的意思读 sù。'],
  }),
  pickChoice({
    id: "cn-u1-pinyin-002",
    unit_id: U1,
    skill_id: PINYIN_U1,
    ability: ["phonics"],
    difficulty: 2,
    stem: '"蜻蜓"两个字都是什么部首？',
    options: [
      { id: "a", text: "虫字旁（蟲）" },
      { id: "b", text: "日字旁", errorTag: "radical_confusion" },
      { id: "c", text: "月字旁", errorTag: "radical_confusion" },
      { id: "d", text: "草字头", errorTag: "radical_confusion" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u1-pinyin-003",
    unit_id: U1,
    skill_id: PINYIN_U1,
    ability: ["phonics", "glyph"],
    difficulty: 2,
    stem: '下面哪个字与"檐（yán）"读音相同？',
    options: [
      { id: "a", text: "盐" },
      { id: "b", text: "燕", errorTag: "tone_confusion" },
      { id: "c", text: "演", errorTag: "tone_confusion" },
      { id: "d", text: "彦", errorTag: "tone_confusion" },
    ],
    correct: "a",
    solution: ['檐：yán（屋檐）。盐：yán（食盐），同音。'],
  }),
  pickChoice({
    id: "cn-u1-pinyin-004",
    unit_id: U1,
    skill_id: PINYIN_U1,
    ability: ["glyph"],
    difficulty: 2,
    stem: "选出没有错别字的一组：",
    options: [
      { id: "a", text: "茅檐 · 锄豆 · 莲蓬 · 卧剥" },
      { id: "b", text: "茅沿 · 锄豆 · 莲蓬 · 卧剥", errorTag: "glyph_homophone" },
      { id: "c", text: "茅檐 · 除豆 · 莲蓬 · 卧拨", errorTag: "glyph_homophone" },
      { id: "d", text: "茅檐 · 锄豆 · 连蓬 · 卧剥", errorTag: "glyph_homophone" },
    ],
    correct: "a",
    solution: ['"茅檐"指茅草屋顶；"锄豆"是除草；"卧剥"是趴着剥（莲蓬）。出自《清平乐·村居》。'],
  }),
  pickChoice({
    id: "cn-u1-pinyin-005",
    unit_id: U1,
    skill_id: PINYIN_U1,
    ability: ["phonics"],
    difficulty: 3,
    stem: '"剥"在"剥莲蓬"和"剥皮"中分别读？',
    options: [
      { id: "a", text: "bāo / bō", errorTag: "polyphone_confusion" },
      { id: "b", text: "bō / bāo" },
      { id: "c", text: "bō / bō", errorTag: "polyphone_confusion" },
      { id: "d", text: "bāo / bāo", errorTag: "polyphone_confusion" },
    ],
    correct: "b",
    solution: ['"剥"是多音字：bō（书面/合成词，如剥削）；bāo（口语单用，如剥香蕉）。"剥莲蓬"是书面读 bō，"剥皮"作为口语单字动作读 bāo。'],
  }),
  pickChoice({
    id: "cn-u1-pinyin-006",
    unit_id: U1,
    skill_id: PINYIN_U1,
    ability: ["phonics"],
    difficulty: 2,
    stem: '"徐"字的读音和意思是？',
    options: [
      { id: "a", text: "xú · 慢慢地" },
      { id: "b", text: "xǔ · 准许", errorTag: "homophone_meaning" },
      { id: "c", text: "yú · 慢慢地", errorTag: "phonics_error" },
      { id: "d", text: "xú · 美好的", errorTag: "meaning_error" },
    ],
    correct: "a",
    solution: ['出自《宿新市徐公店》。"徐"读 xú，意为缓慢。徐公是姓徐的店主。'],
  }),
  pickChoice({
    id: "cn-u1-pinyin-007",
    unit_id: U1,
    skill_id: PINYIN_U1,
    ability: ["glyph"],
    difficulty: 2,
    stem: "下列加点字（用括号标出）哪个写法是错的？",
    options: [
      { id: "a", text: "（蜿）蜒" },
      { id: "b", text: "（茂）盛" },
      { id: "c", text: "（俯）冲" },
      { id: "d", text: "（蓝）天大风（吹）", errorTag: "test_distractor" },
    ],
    correct: "d",
    solution: ['前三组都是常用搭配；选项 D 故意把成语凑错放进，干扰项。'],
  }),

  // ============================================================
  // 第一单元：古诗补字（古诗三首）
  // ============================================================
  pickChoice({
    id: "cn-u1-poem-001",
    unit_id: U1,
    skill_id: POEM_U1,
    ability: ["accumulation"],
    difficulty: 2,
    exam_priority: "MUST_BIG",
    stem: "《宿新市徐公店》：篱落疏疏一径深，____。",
    options: [
      { id: "a", text: "树头新绿未成阴" },
      { id: "b", text: "树头花落未成阴", errorTag: "wrong_phrase" },
      { id: "c", text: "树边落叶满空山", errorTag: "wrong_phrase" },
      { id: "d", text: "树梢清风未成行", errorTag: "wrong_phrase" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u1-poem-002",
    unit_id: U1,
    skill_id: POEM_U1,
    ability: ["accumulation"],
    difficulty: 2,
    stem: "《宿新市徐公店》：儿童急走追黄蝶，____。",
    options: [
      { id: "a", text: "飞入菜花无处寻" },
      { id: "b", text: "飞入花丛找不到", errorTag: "wrong_phrase" },
      { id: "c", text: "飞入梅花无处寻", errorTag: "wrong_phrase" },
      { id: "d", text: "飞入桃花无处寻", errorTag: "wrong_phrase" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u1-poem-003",
    unit_id: U1,
    skill_id: POEM_U1,
    ability: ["accumulation"],
    difficulty: 3,
    stem: "《四时田园杂兴·其二十五》：梅子金黄杏子肥，____。",
    options: [
      { id: "a", text: "麦花雪白菜花稀" },
      { id: "b", text: "梨花落尽子初成", errorTag: "wrong_poem" },
      { id: "c", text: "麦花满地稻花香", errorTag: "wrong_phrase" },
      { id: "d", text: "麦穗金黄菜花深", errorTag: "wrong_phrase" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u1-poem-004",
    unit_id: U1,
    skill_id: POEM_U1,
    ability: ["accumulation", "glyph"],
    difficulty: 3,
    stem: "《四时田园杂兴·其二十五》：日长篱落无人过，____。",
    options: [
      { id: "a", text: "惟有蜻蜓蛱蝶飞" },
      { id: "b", text: "唯有蜻蜓蛱蝶飞", errorTag: "glyph_variant" },
      { id: "c", text: "只有蜻蜓蝴蝶舞", errorTag: "wrong_phrase" },
      { id: "d", text: "唯听蜻蜓蛱蝶鸣", errorTag: "wrong_phrase" },
    ],
    correct: "a",
    solution: ['原诗用"惟"不是"唯"。"惟"和"唯"都对，但课本是"惟"。'],
  }),
  pickChoice({
    id: "cn-u1-poem-005",
    unit_id: U1,
    skill_id: POEM_U1,
    ability: ["accumulation"],
    difficulty: 3,
    stem: "《清平乐·村居》：茅檐低小，____。",
    options: [
      { id: "a", text: "溪上青青草" },
      { id: "b", text: "溪边青青草", errorTag: "wrong_phrase" },
      { id: "c", text: "屋后青青草", errorTag: "wrong_phrase" },
      { id: "d", text: "山上青青草", errorTag: "wrong_phrase" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u1-poem-006",
    unit_id: U1,
    skill_id: POEM_U1,
    ability: ["accumulation"],
    difficulty: 3,
    stem: "《清平乐·村居》：醉里吴音相媚好，____。",
    options: [
      { id: "a", text: "白发谁家翁媪" },
      { id: "b", text: "白发何家翁媪", errorTag: "wrong_phrase" },
      { id: "c", text: "白发老来夫妇", errorTag: "wrong_phrase" },
      { id: "d", text: "皓首谁家翁媪", errorTag: "wrong_phrase" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u1-poem-007",
    unit_id: U1,
    skill_id: POEM_U1,
    ability: ["accumulation"],
    difficulty: 3,
    stem: "《清平乐·村居》写小儿子最调皮的句子是：",
    options: [
      { id: "a", text: "最喜小儿亡赖，溪头卧剥莲蓬。" },
      { id: "b", text: "中儿正织鸡笼，溪头剥莲蓬。", errorTag: "wrong_phrase" },
      { id: "c", text: "最爱小儿玩耍，溪边卧剥莲蓬。", errorTag: "wrong_phrase" },
      { id: "d", text: "最喜小儿无赖，溪头卧剥莲蓬。", errorTag: "glyph_variant" },
    ],
    correct: "a",
    solution: ['"亡赖"与"无赖"古通，课本写作"亡赖"。'],
  }),

  // ============================================================
  // 第一单元：词语搭配（乡下人家 / 天窗）
  // ============================================================
  pickChoice({
    id: "cn-u1-vocab-001",
    unit_id: U1,
    skill_id: VOCAB_U1,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: "下面哪个搭配最准确（出自《乡下人家》）？",
    options: [
      { id: "a", text: "依着时令 · 顺序开放" },
      { id: "b", text: "依着季节 · 接连绽放", errorTag: "near_synonym" },
      { id: "c", text: "随着月份 · 一齐开花", errorTag: "near_synonym" },
      { id: "d", text: "按着农时 · 接力盛开", errorTag: "near_synonym" },
    ],
    correct: "a",
    solution: ['原文是"它们依着时令，顺序开放"。'],
  }),
  pickChoice({
    id: "cn-u1-vocab-002",
    unit_id: U1,
    skill_id: VOCAB_U1,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: "选出能填入空格最合适的一组：风（____）地吹，鸡（____）地叫。",
    options: [
      { id: "a", text: "轻轻 · 咯咯" },
      { id: "b", text: "重重 · 啾啾", errorTag: "wrong_pair" },
      { id: "c", text: "悠悠 · 喔喔", errorTag: "wrong_pair" },
      { id: "d", text: "缓缓 · 吱吱", errorTag: "wrong_pair" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u1-vocab-003",
    unit_id: U1,
    skill_id: VOCAB_U1,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: '"和谐"的意思最接近哪一项？',
    options: [
      { id: "a", text: "配合得很好" },
      { id: "b", text: "声音很大", errorTag: "wrong_meaning" },
      { id: "c", text: "颜色很多", errorTag: "wrong_meaning" },
      { id: "d", text: "速度很快", errorTag: "wrong_meaning" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u1-vocab-004",
    unit_id: U1,
    skill_id: VOCAB_U1,
    ability: ["vocabulary"],
    difficulty: 3,
    stem: "天窗对乡下孩子来说，最重要的作用是？（《天窗》主题）",
    options: [
      { id: "a", text: "唯一的慰藉，让想象飞出去的窗口" },
      { id: "b", text: "唯一的光源，让屋里不黑", errorTag: "literal_only" },
      { id: "c", text: "唯一的装饰，让房子好看", errorTag: "irrelevant" },
      { id: "d", text: "唯一的通风口", errorTag: "literal_only" },
    ],
    correct: "a",
  }),

  // ============================================================
  // 第一单元：听写（带 TTS audio_text）
  // ============================================================
  dictation({
    id: "cn-u1-dict-001",
    unit_id: U1,
    skill_id: DICT_U1,
    ability: ["phonics", "glyph"],
    difficulty: 3,
    exam_priority: "MUST_BIG",
    audio_text: "蜻蜓",
    options: [
      { id: "a", text: "蜻蜓" },
      { id: "b", text: "清庭", errorTag: "homophone_glyph" },
      { id: "c", text: "青亭", errorTag: "homophone_glyph" },
      { id: "d", text: "晴蜓", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),
  dictation({
    id: "cn-u1-dict-002",
    unit_id: U1,
    skill_id: DICT_U1,
    ability: ["phonics", "glyph"],
    difficulty: 3,
    audio_text: "蝴蝶",
    options: [
      { id: "a", text: "蝴蝶" },
      { id: "b", text: "胡蝶", errorTag: "homophone_glyph" },
      { id: "c", text: "湖叠", errorTag: "homophone_glyph" },
      { id: "d", text: "葫蜨", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),
  dictation({
    id: "cn-u1-dict-003",
    unit_id: U1,
    skill_id: DICT_U1,
    ability: ["phonics", "glyph"],
    difficulty: 3,
    audio_text: "篱笆",
    options: [
      { id: "a", text: "篱笆" },
      { id: "b", text: "藜笆", errorTag: "homophone_glyph" },
      { id: "c", text: "篱巴", errorTag: "homophone_glyph" },
      { id: "d", text: "离巴", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),
  dictation({
    id: "cn-u1-dict-004",
    unit_id: U1,
    skill_id: DICT_U1,
    ability: ["phonics", "glyph"],
    difficulty: 2,
    audio_text: "莲蓬",
    options: [
      { id: "a", text: "莲蓬" },
      { id: "b", text: "莲篷", errorTag: "homophone_glyph" },
      { id: "c", text: "怜蓬", errorTag: "homophone_glyph" },
      { id: "d", text: "连蓬", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),
  dictation({
    id: "cn-u1-dict-005",
    unit_id: U1,
    skill_id: DICT_U1,
    ability: ["phonics", "glyph"],
    difficulty: 3,
    audio_text: "和谐",
    options: [
      { id: "a", text: "和谐" },
      { id: "b", text: "和协", errorTag: "homophone_glyph" },
      { id: "c", text: "和揩", errorTag: "homophone_glyph" },
      { id: "d", text: "合谐", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),
  dictation({
    id: "cn-u1-dict-006",
    unit_id: U1,
    skill_id: DICT_U1,
    ability: ["phonics", "glyph"],
    difficulty: 3,
    audio_text: "装饰",
    options: [
      { id: "a", text: "装饰" },
      { id: "b", text: "妆饰", errorTag: "homophone_glyph" },
      { id: "c", text: "装势", errorTag: "homophone_glyph" },
      { id: "d", text: "庄饰", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),

  // ============================================================
  // 第二单元：字音字形（科技类）
  // ============================================================
  pickChoice({
    id: "cn-u2-pinyin-001",
    unit_id: U2,
    skill_id: PINYIN_U2,
    ability: ["phonics"],
    difficulty: 2,
    exam_priority: "MUST_BIG",
    stem: '"琥珀"读音是？',
    options: [
      { id: "a", text: "hǔ pò" },
      { id: "b", text: "hú bó", errorTag: "phonics_error" },
      { id: "c", text: "hǔ bó", errorTag: "phonics_error" },
      { id: "d", text: "hú pò", errorTag: "phonics_error" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u2-pinyin-002",
    unit_id: U2,
    skill_id: PINYIN_U2,
    ability: ["phonics"],
    difficulty: 2,
    stem: '"恐龙"的"恐"读音是？',
    options: [
      { id: "a", text: "kǒng（第三声）" },
      { id: "b", text: "kōng（第一声）", errorTag: "tone_confusion" },
      { id: "c", text: "kòng（第四声）", errorTag: "tone_confusion" },
      { id: "d", text: "kéng（第二声）", errorTag: "phonics_error" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u2-pinyin-003",
    unit_id: U2,
    skill_id: PINYIN_U2,
    ability: ["glyph"],
    difficulty: 2,
    stem: "下列哪个词写错了？",
    options: [
      { id: "a", text: "繁衍" },
      { id: "b", text: "敏捷" },
      { id: "c", text: "纳米", errorTag: "ok_actually" },
      { id: "d", text: "膨涨", errorTag: "glyph_homophone" },
    ],
    correct: "d",
    solution: ['正确写法是"膨胀"，不是"膨涨"。'],
  }),
  pickChoice({
    id: "cn-u2-pinyin-004",
    unit_id: U2,
    skill_id: PINYIN_U2,
    ability: ["phonics"],
    difficulty: 2,
    stem: '"凶猛"和"凶恶"中"凶"的读音是？',
    options: [
      { id: "a", text: "都是 xiōng" },
      { id: "b", text: "都是 xiòng", errorTag: "phonics_error" },
      { id: "c", text: "前 xiōng 后 xiòng", errorTag: "phonics_error" },
      { id: "d", text: "前 xióng 后 xiōng", errorTag: "phonics_error" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u2-pinyin-005",
    unit_id: U2,
    skill_id: PINYIN_U2,
    ability: ["glyph"],
    difficulty: 3,
    stem: "选出全部正确的一组词语：",
    options: [
      { id: "a", text: "侦测 · 描绘 · 隧道 · 笨拙" },
      { id: "b", text: "侦侧 · 描会 · 隧道 · 笨拙", errorTag: "glyph_homophone" },
      { id: "c", text: "侦测 · 描绘 · 遂道 · 笨拙", errorTag: "glyph_homophone" },
      { id: "d", text: "侦测 · 描绘 · 隧道 · 笨拒", errorTag: "glyph_homophone" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u2-pinyin-006",
    unit_id: U2,
    skill_id: PINYIN_U2,
    ability: ["phonics"],
    difficulty: 2,
    stem: '"千年梦圆在今朝"中"朝"读？',
    options: [
      { id: "a", text: "zhāo（早晨 / 今日）" },
      { id: "b", text: "cháo（朝代）", errorTag: "polyphone_confusion" },
      { id: "c", text: "zháo", errorTag: "phonics_error" },
      { id: "d", text: "zhào", errorTag: "tone_confusion" },
    ],
    correct: "a",
    solution: ['"今朝"指今天，朝读 zhāo。朝代的朝读 cháo。'],
  }),

  // ============================================================
  // 第二单元：词语 / 形近字
  // ============================================================
  pickChoice({
    id: "cn-u2-vocab-001",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: '"形态各异"中"异"的意思是？',
    options: [
      { id: "a", text: "不同" },
      { id: "b", text: "奇怪", errorTag: "near_meaning" },
      { id: "c", text: "美丽", errorTag: "wrong_meaning" },
      { id: "d", text: "巨大", errorTag: "wrong_meaning" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u2-vocab-002",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["vocabulary"],
    difficulty: 3,
    stem: "下面的搭配最恰当的是？",
    options: [
      { id: "a", text: "（提出）假设 · （进行）研究 · （得出）结论" },
      { id: "b", text: "（说出）假设 · （做做）研究 · （想出）结论", errorTag: "near_synonym" },
      { id: "c", text: "（提出）假设 · （搞）研究 · （拿出）结论", errorTag: "near_synonym" },
      { id: "d", text: "（建议）假设 · （进行）研究 · （指出）结论", errorTag: "near_synonym" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u2-vocab-003",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["vocabulary", "glyph"],
    difficulty: 3,
    stem: '"飞向蓝天的恐龙"中，恐龙演化成鸟的关键变化是？',
    options: [
      { id: "a", text: "羽毛 + 前肢变成翅膀 + 体型变小变轻" },
      { id: "b", text: "尾巴变长 + 学会跳跃", errorTag: "partial_only" },
      { id: "c", text: "颜色变鲜艳 + 学会唱歌", errorTag: "irrelevant" },
      { id: "d", text: "脚变成爪子 + 牙变尖", errorTag: "irrelevant" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u2-vocab-004",
    unit_id: U2,
    skill_id: VOCAB_U2,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: '"纳米技术"应用于哪个领域？',
    options: [
      { id: "a", text: "医疗 / 材料 / 信息 / 能源 都广泛应用" },
      { id: "b", text: "只在医院用", errorTag: "narrow_view" },
      { id: "c", text: "只用于做衣服", errorTag: "narrow_view" },
      { id: "d", text: "只在实验室存在", errorTag: "narrow_view" },
    ],
    correct: "a",
  }),

  // ============================================================
  // 第二单元：听写
  // ============================================================
  dictation({
    id: "cn-u2-dict-001",
    unit_id: U2,
    skill_id: DICT_U2,
    ability: ["phonics", "glyph"],
    difficulty: 3,
    audio_text: "繁衍",
    options: [
      { id: "a", text: "繁衍" },
      { id: "b", text: "繁演", errorTag: "homophone_glyph" },
      { id: "c", text: "凡衍", errorTag: "homophone_glyph" },
      { id: "d", text: "繁延", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),
  dictation({
    id: "cn-u2-dict-002",
    unit_id: U2,
    skill_id: DICT_U2,
    ability: ["phonics", "glyph"],
    difficulty: 3,
    audio_text: "笨拙",
    options: [
      { id: "a", text: "笨拙" },
      { id: "b", text: "笨绌", errorTag: "homophone_glyph" },
      { id: "c", text: "本拙", errorTag: "homophone_glyph" },
      { id: "d", text: "苯拙", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),
  dictation({
    id: "cn-u2-dict-003",
    unit_id: U2,
    skill_id: DICT_U2,
    ability: ["phonics", "glyph"],
    difficulty: 3,
    audio_text: "膨胀",
    options: [
      { id: "a", text: "膨胀" },
      { id: "b", text: "膨涨", errorTag: "homophone_glyph" },
      { id: "c", text: "彭胀", errorTag: "homophone_glyph" },
      { id: "d", text: "蓬胀", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),
  dictation({
    id: "cn-u2-dict-004",
    unit_id: U2,
    skill_id: DICT_U2,
    ability: ["phonics", "glyph"],
    difficulty: 3,
    audio_text: "灾害",
    options: [
      { id: "a", text: "灾害" },
      { id: "b", text: "灾骇", errorTag: "homophone_glyph" },
      { id: "c", text: "栽害", errorTag: "homophone_glyph" },
      { id: "d", text: "灾汉", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),
  dictation({
    id: "cn-u2-dict-005",
    unit_id: U2,
    skill_id: DICT_U2,
    ability: ["phonics", "glyph"],
    difficulty: 3,
    audio_text: "侦测",
    options: [
      { id: "a", text: "侦测" },
      { id: "b", text: "侦侧", errorTag: "homophone_glyph" },
      { id: "c", text: "贞测", errorTag: "homophone_glyph" },
      { id: "d", text: "侦策", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),

  // ============================================================
  // 第三单元：字音字形（现代诗）
  // ============================================================
  pickChoice({
    id: "cn-u3-pinyin-001",
    unit_id: U3,
    skill_id: PINYIN_U3,
    ability: ["phonics"],
    difficulty: 2,
    stem: '"白桦"的"桦"读音？',
    options: [
      { id: "a", text: "huà" },
      { id: "b", text: "huá", errorTag: "tone_confusion" },
      { id: "c", text: "yè", errorTag: "phonics_error" },
      { id: "d", text: "huā", errorTag: "phonics_error" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u3-pinyin-002",
    unit_id: U3,
    skill_id: PINYIN_U3,
    ability: ["glyph"],
    difficulty: 2,
    stem: '选出"涂"字所在的正确词组：',
    options: [
      { id: "a", text: "涂抹（涂上颜色）" },
      { id: "b", text: "涂改（改正写错的字）", errorTag: "ok_actually" },
      { id: "c", text: "前两项都对" },
      { id: "d", text: "屠夫", errorTag: "glyph_confusion" },
    ],
    correct: "c",
  }),
  pickChoice({
    id: "cn-u3-pinyin-003",
    unit_id: U3,
    skill_id: PINYIN_U3,
    ability: ["phonics"],
    difficulty: 2,
    stem: '"飘逸"的"逸"读音是？',
    options: [
      { id: "a", text: "yì（第四声）" },
      { id: "b", text: "yī（第一声）", errorTag: "tone_confusion" },
      { id: "c", text: "yǐ（第三声）", errorTag: "tone_confusion" },
      { id: "d", text: "ní（第二声）", errorTag: "phonics_error" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u3-pinyin-004",
    unit_id: U3,
    skill_id: PINYIN_U3,
    ability: ["glyph"],
    difficulty: 3,
    stem: "下面没有错别字的一组是：",
    options: [
      { id: "a", text: "潇洒 · 朦胧 · 静谧 · 飘逸" },
      { id: "b", text: "萧洒 · 朦胧 · 静谧 · 飘逸", errorTag: "glyph_homophone" },
      { id: "c", text: "潇洒 · 朦胧 · 静秘 · 飘逸", errorTag: "glyph_homophone" },
      { id: "d", text: "潇洒 · 蒙胧 · 静谧 · 飘溢", errorTag: "glyph_homophone" },
    ],
    correct: "a",
  }),

  // ============================================================
  // 第三单元：修辞辨认
  // ============================================================
  pickChoice({
    id: "cn-u3-rhet-001",
    unit_id: U3,
    skill_id: RHET_U3,
    ability: ["sentence"],
    difficulty: 2,
    stem: '"小溪叮叮咚咚地唱着歌。" 用了什么修辞手法？',
    options: [
      { id: "a", text: "拟人" },
      { id: "b", text: "比喻", errorTag: "rhetoric_confusion" },
      { id: "c", text: "夸张", errorTag: "rhetoric_confusion" },
      { id: "d", text: "排比", errorTag: "rhetoric_confusion" },
    ],
    correct: "a",
    solution: ['把小溪当人写（"唱歌"是人的动作）→ 拟人。'],
  }),
  pickChoice({
    id: "cn-u3-rhet-002",
    unit_id: U3,
    skill_id: RHET_U3,
    ability: ["sentence"],
    difficulty: 2,
    stem: '"白桦树像穿着雪白的衣裳。" 用了什么修辞？',
    options: [
      { id: "a", text: "比喻（明喻）" },
      { id: "b", text: "拟人", errorTag: "rhetoric_confusion" },
      { id: "c", text: "夸张", errorTag: "rhetoric_confusion" },
      { id: "d", text: "排比", errorTag: "rhetoric_confusion" },
    ],
    correct: "a",
    solution: ['"像……一样"或"像 X 一样的 Y"是比喻。"穿衣裳"指白雪覆盖。'],
  }),
  pickChoice({
    id: "cn-u3-rhet-003",
    unit_id: U3,
    skill_id: RHET_U3,
    ability: ["sentence"],
    difficulty: 3,
    stem: '"绿得发蓝、绿得发黑、绿得出奇。" 用了什么修辞？',
    options: [
      { id: "a", text: "排比" },
      { id: "b", text: "拟人", errorTag: "rhetoric_confusion" },
      { id: "c", text: "比喻", errorTag: "rhetoric_confusion" },
      { id: "d", text: "反问", errorTag: "rhetoric_confusion" },
    ],
    correct: "a",
    solution: ["三个结构相似的短语并列 → 排比。"],
  }),
  pickChoice({
    id: "cn-u3-rhet-004",
    unit_id: U3,
    skill_id: RHET_U3,
    ability: ["sentence"],
    difficulty: 3,
    stem: '"难道我们不应该爱护花草吗？" 用了什么修辞？',
    options: [
      { id: "a", text: '反问（强调"应该爱护"）' },
      { id: "b", text: "设问", errorTag: "rhetoric_confusion" },
      { id: "c", text: "拟人", errorTag: "rhetoric_confusion" },
      { id: "d", text: "夸张", errorTag: "rhetoric_confusion" },
    ],
    correct: "a",
    solution: ['反问：用问的形式表达肯定意思（"应该"），自带答案，不用回答。'],
  }),
  pickChoice({
    id: "cn-u3-rhet-005",
    unit_id: U3,
    skill_id: RHET_U3,
    ability: ["sentence"],
    difficulty: 3,
    stem: '"她的笑像一束阳光，把整个屋子都照亮了。" 用了什么修辞？',
    options: [
      { id: "a", text: "比喻 + 夸张" },
      { id: "b", text: "拟人 + 排比", errorTag: "rhetoric_confusion" },
      { id: "c", text: "反问 + 设问", errorTag: "rhetoric_confusion" },
      { id: "d", text: "对比 + 借代", errorTag: "rhetoric_confusion" },
    ],
    correct: "a",
    solution: ['"笑像阳光"=比喻；"把整个屋子照亮"=夸张（笑不能真的照亮屋子）。'],
  }),
  pickChoice({
    id: "cn-u3-rhet-006",
    unit_id: U3,
    skill_id: RHET_U3,
    ability: ["sentence"],
    difficulty: 2,
    stem: '"风儿轻轻地告诉我：春天来了。" 用了什么修辞？',
    options: [
      { id: "a", text: "拟人" },
      { id: "b", text: "比喻", errorTag: "rhetoric_confusion" },
      { id: "c", text: "夸张", errorTag: "rhetoric_confusion" },
      { id: "d", text: "对偶", errorTag: "rhetoric_confusion" },
    ],
    correct: "a",
    solution: ['"风儿告诉我"——把风当人写 → 拟人。'],
  }),

  // ============================================================
  // 第四单元：字音字形（动物名家）
  // ============================================================
  pickChoice({
    id: "cn-u4-pinyin-001",
    unit_id: U4,
    skill_id: PINYIN_U4,
    ability: ["phonics", "glyph"],
    difficulty: 2,
    exam_priority: "MUST_BIG",
    stem: '"凝视"的"凝"读音是？',
    options: [
      { id: "a", text: "níng" },
      { id: "b", text: "nín", errorTag: "phonics_error" },
      { id: "c", text: "yí", errorTag: "phonics_error" },
      { id: "d", text: "ní", errorTag: "phonics_error" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u4-pinyin-002",
    unit_id: U4,
    skill_id: PINYIN_U4,
    ability: ["glyph"],
    difficulty: 2,
    stem: "下列哪组词全部正确？",
    options: [
      { id: "a", text: "屏息凝视 · 蹲守 · 抓挠 · 性情古怪" },
      { id: "b", text: "屏息疑视 · 蹲守 · 抓挠 · 性情古怪", errorTag: "glyph_homophone" },
      { id: "c", text: "屏息凝视 · 顿守 · 抓挠 · 性情古怪", errorTag: "glyph_homophone" },
      { id: "d", text: "屏息凝视 · 蹲守 · 抓饶 · 性情古怪", errorTag: "glyph_homophone" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u4-pinyin-003",
    unit_id: U4,
    skill_id: PINYIN_U4,
    ability: ["phonics"],
    difficulty: 2,
    stem: '"屏息"中"屏"的读音是？',
    options: [
      { id: "a", text: "bǐng（抑制呼吸）" },
      { id: "b", text: "píng（屏风、屏幕）", errorTag: "polyphone_confusion" },
      { id: "c", text: "bǐn", errorTag: "phonics_error" },
      { id: "d", text: "píng", errorTag: "polyphone_confusion" },
    ],
    correct: "a",
    solution: ['"屏"是多音字：bǐng（屏住呼吸）/ píng（屏风）。"屏息"是憋住呼吸读 bǐng。'],
  }),
  pickChoice({
    id: "cn-u4-pinyin-004",
    unit_id: U4,
    skill_id: PINYIN_U4,
    ability: ["glyph"],
    difficulty: 3,
    stem: "下列哪个写法是错的？",
    options: [
      { id: "a", text: "枝丫", errorTag: "ok_actually" },
      { id: "b", text: "枝桠", errorTag: "ok_actually" },
      { id: "c", text: "前两个写法都对" },
      { id: "d", text: "枝鸦", errorTag: "glyph_homophone" },
    ],
    correct: "d",
    solution: ['"枝丫"和"枝桠"都对（异体字）；"枝鸦"错（鸦是乌鸦的鸦）。'],
  }),

  // ============================================================
  // 第四单元：词语 / 形近字
  // ============================================================
  pickChoice({
    id: "cn-u4-vocab-001",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: '老舍写《猫》："说它老实吧，它的确有时候很乖；可是，决定要出去玩耍，就会一连几天不回家。" 这种写法用来表现猫____。',
    options: [
      { id: "a", text: "性格古怪（既老实又贪玩）" },
      { id: "b", text: "对人生气", errorTag: "wrong_meaning" },
      { id: "c", text: "总是乖巧", errorTag: "one_sided" },
      { id: "d", text: "总是贪玩", errorTag: "one_sided" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u4-vocab-002",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["vocabulary"],
    difficulty: 2,
    stem: '"步态从容"中"从容"的意思是？',
    options: [
      { id: "a", text: "不慌不忙、悠闲自在" },
      { id: "b", text: "脚步声很大", errorTag: "wrong_meaning" },
      { id: "c", text: "走得很快", errorTag: "opposite_meaning" },
      { id: "d", text: "动作很奇怪", errorTag: "wrong_meaning" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u4-vocab-003",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["vocabulary"],
    difficulty: 3,
    stem: '丰子恺写《白鹅》最突出的特点是？',
    options: [
      { id: "a", text: '高傲（叫声 / 步态 / 吃相 都显得"鹅老爷"派头）' },
      { id: "b", text: "胆小怕事", errorTag: "wrong_trait" },
      { id: "c", text: "活泼好动", errorTag: "wrong_trait" },
      { id: "d", text: "勤劳勇敢", errorTag: "wrong_trait" },
    ],
    correct: "a",
  }),
  pickChoice({
    id: "cn-u4-vocab-004",
    unit_id: U4,
    skill_id: VOCAB_U4,
    ability: ["vocabulary"],
    difficulty: 3,
    stem: '下列哪个是表达"不慌不忙"的成语？',
    options: [
      { id: "a", text: "从容不迫" },
      { id: "b", text: "争先恐后", errorTag: "opposite_meaning" },
      { id: "c", text: "手忙脚乱", errorTag: "opposite_meaning" },
      { id: "d", text: "心急火燎", errorTag: "opposite_meaning" },
    ],
    correct: "a",
  }),

  // ============================================================
  // 第四单元：听写
  // ============================================================
  dictation({
    id: "cn-u4-dict-001",
    unit_id: U4,
    skill_id: DICT_U4,
    ability: ["phonics", "glyph"],
    difficulty: 3,
    exam_priority: "MUST_BIG",
    audio_text: "凝视",
    options: [
      { id: "a", text: "凝视" },
      { id: "b", text: "宁视", errorTag: "homophone_glyph" },
      { id: "c", text: "凝事", errorTag: "homophone_glyph" },
      { id: "d", text: "疑视", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),
  dictation({
    id: "cn-u4-dict-002",
    unit_id: U4,
    skill_id: DICT_U4,
    ability: ["phonics", "glyph"],
    difficulty: 3,
    audio_text: "高傲",
    options: [
      { id: "a", text: "高傲" },
      { id: "b", text: "高奥", errorTag: "homophone_glyph" },
      { id: "c", text: "高骜", errorTag: "homophone_glyph" },
      { id: "d", text: "高熬", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),
  dictation({
    id: "cn-u4-dict-003",
    unit_id: U4,
    skill_id: DICT_U4,
    ability: ["phonics", "glyph"],
    difficulty: 3,
    audio_text: "蹲守",
    options: [
      { id: "a", text: "蹲守" },
      { id: "b", text: "顿守", errorTag: "homophone_glyph" },
      { id: "c", text: "蹲手", errorTag: "homophone_glyph" },
      { id: "d", text: "敦守", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),
  dictation({
    id: "cn-u4-dict-004",
    unit_id: U4,
    skill_id: DICT_U4,
    ability: ["phonics", "glyph"],
    difficulty: 3,
    audio_text: "屏息",
    options: [
      { id: "a", text: "屏息" },
      { id: "b", text: "凭息", errorTag: "homophone_glyph" },
      { id: "c", text: "屏吸", errorTag: "homophone_glyph" },
      { id: "d", text: "瓶息", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),
  dictation({
    id: "cn-u4-dict-005",
    unit_id: U4,
    skill_id: DICT_U4,
    ability: ["phonics", "glyph"],
    difficulty: 3,
    audio_text: "性情古怪",
    options: [
      { id: "a", text: "性情古怪" },
      { id: "b", text: "性情故怪", errorTag: "homophone_glyph" },
      { id: "c", text: "性请古怪", errorTag: "homophone_glyph" },
      { id: "d", text: "性情古拐", errorTag: "homophone_glyph" },
    ],
    correct: "a",
  }),
];

/** 题包总数（debug 用） */
export const SEED_QUESTIONS_CHINESE_COUNT = SEED_QUESTIONS_CHINESE.length;
