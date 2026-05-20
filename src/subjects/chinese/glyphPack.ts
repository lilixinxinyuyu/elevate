/**
 * 语文 · C4B 字形侦探题包 (Phase 3 Sprint C2, v0.36.36).
 *
 * 期中考第 9 题型: 形声字 + 偏旁部首辨认 (G4B 大考点).
 * 游戏 game_type = "glyph_detective", game_data 带 hanzi(大汉字) + hanziDesc + optionEmojis.
 * 选项/答案/解析走标准 Question 字段 (options/answer/solution_steps), 没有 game_data
 * 时可回退 plain_choice 渲染.
 *
 * 难度梯度 (Selena 反馈"太简单"后调过): 形声字 → 会意字 → 形近字陷阱.
 * 覆盖 G4B 高频偏旁: 虫/木/犭/饣/氵/扌/讠/艹/灬/忄 + 青声旁形近字.
 *
 * 15 题:
 *  - 形声字结构 (蜻/桦/猫/饭): 4
 *  - 会意字 (明/森): 2
 *  - 形近字陷阱 (蓝篮/晴睛清请/萝箩): 3
 *  - 同偏旁归类 (氵/扌/讠/艹/灬/忄): 6
 */

import type { Question } from "../../core/types";

const G_U1 = "C4B_U1_NATURE";
const G_U2 = "C4B_U2_SCIENCE";
const G_U3 = "C4B_U3_POETRY";
const G_U4 = "C4B_U4_ANIMALS";
const GLYPH_SKILL = "C4B_GLYPH_RADICAL";

/** glyph 题缺省值 helper — 不跑 Zod, 直接造 Question (game_data 原样保留). */
function g(q: Partial<Question>): Question {
  return {
    version: 1,
    status: "approved",
    grade: 4,
    term: "下册",
    subjectId: "chinese",
    skill_id: GLYPH_SKILL,
    skill_name: "字形侦探",
    ability_dimension: ["accumulation"],
    exam_priority: "MUST_BIG",
    game_type: "glyph_detective",
    cognitive_level: "conceptual",
    estimated_time_seconds: 25,
    question_format: "single_choice",
    options: [],
    answer: { type: "choice", value: "a" },
    common_errors: [],
    feedback_correct: "破案！偏旁的规律被你抓住了。",
    feedback_wrong: "再仔细看，偏旁(形旁)往往告诉你字义。",
    solution_steps: [],
    hints: [],
    ...q,
  } as Question;
}

export const SEED_QUESTIONS_CHINESE_GLYPH: Question[] = [
  // ── 形声字结构 ──
  g({
    question_id: "C4B_GLYPH_001",
    unit_id: G_U1,
    difficulty: 3,
    stem: '下面哪个不是 "蜻" 字的特点?',
    options: [
      { id: "a", text: "虫字旁表义 (跟虫有关)" },
      { id: "b", text: '"青" 是声旁 (qīng)' },
      { id: "c", text: '"青" 是形旁 (跟青色有关)' },
      { id: "d", text: "形声字 左形右声" },
    ],
    answer: { type: "choice", value: "c" },
    solution_steps: ['"蜻" 的 "青" 只是声旁(表音), 不是形旁。蜻蜓不一定青色, 但都是昆虫, 所以用虫字旁。'],
    game_data: { kind: "glyph_detective", hanzi: "蜻", hanziDesc: "形声字: 形旁表义 + 声旁表音 · 出自《宿新市徐公店》", optionEmojis: ["🐛", "🔊", "❌", "✏️"] },
  }),
  g({
    question_id: "C4B_GLYPH_002",
    unit_id: G_U3,
    difficulty: 3,
    stem: '下面哪一组字都是用 "木字旁" 表义?',
    options: [
      { id: "a", text: "桦 / 林 / 森 (都跟树有关)" },
      { id: "b", text: "桦 / 华 / 哗 (都同声旁)" },
      { id: "c", text: "桦 / 木 / 本 (字根都是木)" },
      { id: "d", text: "桦 / 树 / 枝 (都用木旁)" },
    ],
    answer: { type: "choice", value: "d" },
    solution_steps: ["桦/树/枝 左边都是木字旁(形旁), 跟树木有关。林/森是会意字(木叠加), 华/哗是声旁同源不跟树有关。"],
    game_data: { kind: "glyph_detective", hanzi: "桦", hanziDesc: "形声字: 木字旁 + 华 · 出自《白桦》", optionEmojis: ["🌳", "📣", "🪵", "🌲"] },
  }),
  g({
    question_id: "C4B_GLYPH_003",
    unit_id: G_U4,
    difficulty: 2,
    stem: '"猫" 字的偏旁辨认哪个对?',
    options: [
      { id: "a", text: "草字头 + 苗 (跟草有关)" },
      { id: "b", text: "反犬旁(犭) + 苗 (跟动物有关)" },
      { id: "c", text: "苗字旁 (跟植物有关)" },
      { id: "d", text: "部首是 苗 (字典查 苗)" },
    ],
    answer: { type: "choice", value: "b" },
    solution_steps: ['"猫" 部首是反犬旁(犭)表义(动物), "苗"是声旁(miáo)。同偏旁: 狗/狼/狐 都是反犬旁。'],
    game_data: { kind: "glyph_detective", hanzi: "猫", hanziDesc: "形声字: 反犬旁 + 苗 · 出自《猫》", optionEmojis: ["🌿", "🐕", "🌱", "🪴"] },
  }),
  g({
    question_id: "C4B_GLYPH_004",
    unit_id: G_U2,
    difficulty: 3,
    stem: '"饭 / 饺 / 饼 / 饿" 四字共同的偏旁是?',
    options: [
      { id: "a", text: "反字旁 (跟反字相关)" },
      { id: "b", text: "饣 (食字旁, 跟饮食有关)" },
      { id: "c", text: "钅 (金字旁)" },
      { id: "d", text: "亻 (单立人旁)" },
    ],
    answer: { type: "choice", value: "b" },
    solution_steps: ["饣是食字旁(简化), 跟饮食有关。饭/饺/饼/饿都是形声字: 饣表义(食物) + 右半声旁。期中第9题型核心。"],
    game_data: { kind: "glyph_detective", hanzi: "饭", hanziDesc: "形声字: 饣字旁 + 反 · 易跟 反 字混", optionEmojis: ["❌", "🍚", "🥢", "👤"] },
  }),

  // ── 会意字 ──
  g({
    question_id: "C4B_GLYPH_005",
    unit_id: G_U3,
    difficulty: 2,
    stem: '"明" 字是由什么组成的?',
    options: [
      { id: "a", text: "日 + 月 (太阳和月亮都明亮)" },
      { id: "b", text: "日 + 力 (太阳的力量)" },
      { id: "c", text: "月 + 月 (两个月亮)" },
      { id: "d", text: "白 + 月 (月亮发白)" },
    ],
    answer: { type: "choice", value: "a" },
    solution_steps: ['"明" = 日 + 月。古人把发光的太阳和月亮合在一起表示"光亮"。这是会意字(跟形声字不同)。'],
    game_data: { kind: "glyph_detective", hanzi: "明", hanziDesc: "会意字: 两个独立字组合表义", optionEmojis: ["🌞", "❌", "🌙", "⚪"] },
  }),
  g({
    question_id: "C4B_GLYPH_006",
    unit_id: G_U1,
    difficulty: 2,
    stem: '"木 / 林 / 森" 三字分别代表?',
    options: [
      { id: "a", text: "一棵 / 一片 / 很多 (数量递增表树多)" },
      { id: "b", text: "树根 / 树枝 / 树叶" },
      { id: "c", text: "都是形声字, 声旁是木" },
      { id: "d", text: "都是部首字, 不能拆" },
    ],
    answer: { type: "choice", value: "a" },
    solution_steps: ["木(1棵) → 林(2棵, 树丛) → 森(3棵, 茂密森林)。这是会意字的数量叠加表义。"],
    game_data: { kind: "glyph_detective", hanzi: "森", hanziDesc: "会意字: 数量决定意义", optionEmojis: ["🌲", "🍃", "🔊", "🪵"] },
  }),

  // ── 形近字陷阱 ──
  g({
    question_id: "C4B_GLYPH_007",
    unit_id: G_U2,
    difficulty: 4,
    stem: '对 "蓝 / 篮" 的辨认哪个对?',
    options: [
      { id: "a", text: "都用草字头 (跟植物有关)" },
      { id: "b", text: '"蓝" 草字头(蓝草染料) / "篮" 竹字头(竹编容器)' },
      { id: "c", text: "都用竹字头 (古代竹简文化)" },
      { id: "d", text: '"蓝" 竹字头 / "篮" 草字头' },
    ],
    answer: { type: "choice", value: "b" },
    solution_steps: ['"蓝"(草字头艹)是颜色, 古染料从蓝草提取; "篮"(竹字头⺮)是竹编容器, 后引申"篮球"。期中常错!'],
    game_data: { kind: "glyph_detective", hanzi: "蓝", hanziDesc: "形近字陷阱: 草字头 vs 竹字头", optionEmojis: ["🌿", "🎋", "🎍", "❌"] },
  }),
  g({
    question_id: "C4B_GLYPH_008",
    unit_id: G_U3,
    difficulty: 4,
    stem: '"晴 / 睛 / 清 / 请" 都带声旁"青", 偏旁配字义哪个对?',
    options: [
      { id: "a", text: "晴(日·天气) / 睛(目·眼睛) / 清(氵·水清) / 请(讠·说话)" },
      { id: "b", text: "晴(目) / 睛(日) / 清(讠) / 请(氵)" },
      { id: "c", text: "四个字偏旁一样, 只是声调不同" },
      { id: "d", text: "都用青字旁, 跟青色有关" },
    ],
    answer: { type: "choice", value: "a" },
    solution_steps: ["同声旁'青'(qīng), 不同形旁定字义: 日→晴(天)、目→睛(眼)、氵→清(水)、讠→请(说)。形旁就是破案的证据。"],
    game_data: { kind: "glyph_detective", hanzi: "睛", hanziDesc: "青声旁家族: 形旁不同, 字义不同 (G4B 高频)", optionEmojis: ["☀️", "❌", "🌀", "🎨"] },
  }),
  g({
    question_id: "C4B_GLYPH_009",
    unit_id: G_U1,
    difficulty: 4,
    stem: '"萝(萝卜) / 箩(箩筐)" 哪个辨认对?',
    options: [
      { id: "a", text: '"萝" 草字头(植物) / "箩" 竹字头(竹器)' },
      { id: "b", text: "都用草字头" },
      { id: "c", text: "都用竹字头" },
      { id: "d", text: '"萝" 竹字头 / "箩" 草字头' },
    ],
    answer: { type: "choice", value: "a" },
    solution_steps: ['"萝"(艹)是萝卜等植物; "箩"(⺮)是竹编的箩筐。形旁(草/竹)告诉你是植物还是竹器。'],
    game_data: { kind: "glyph_detective", hanzi: "箩", hanziDesc: "形近字陷阱: 草字头 vs 竹字头", optionEmojis: ["🥕", "🌿", "🎋", "❌"] },
  }),

  // ── 同偏旁归类 ──
  g({
    question_id: "C4B_GLYPH_010",
    unit_id: G_U1,
    difficulty: 2,
    stem: '下面哪一组字都是 "氵"(三点水) 旁, 跟水有关?',
    options: [
      { id: "a", text: "河 / 湖 / 海 / 流" },
      { id: "b", text: "河 / 何 / 荷 / 贺" },
      { id: "c", text: "冰 / 冷 / 冻 / 净" },
      { id: "d", text: "汪 / 王 / 主 / 住" },
    ],
    answer: { type: "choice", value: "a" },
    solution_steps: ["河/湖/海/流 都是三点水(氵), 跟水有关。冰/冷是两点水(冫, 跟冰冷有关)别混。"],
    game_data: { kind: "glyph_detective", hanzi: "湖", hanziDesc: "氵(三点水): 跟水/液体有关 · 出自《望洞庭》", optionEmojis: ["💧", "🔊", "🧊", "❌"] },
  }),
  g({
    question_id: "C4B_GLYPH_011",
    unit_id: G_U4,
    difficulty: 3,
    stem: '"扌"(提手旁) 的字大多跟什么有关?',
    options: [
      { id: "a", text: "手的动作 (打 / 扫 / 捉 / 提)" },
      { id: "b", text: "脚的动作 (跑 / 跳 / 踢)" },
      { id: "c", text: "嘴的动作 (吃 / 喝 / 叫)" },
      { id: "d", text: "眼睛 (看 / 盯 / 瞧)" },
    ],
    answer: { type: "choice", value: "a" },
    solution_steps: ["提手旁(扌)的字多跟手的动作有关: 打/扫/捉/提/抱/推。脚的动作用足字旁(跑/跳)。"],
    game_data: { kind: "glyph_detective", hanzi: "捉", hanziDesc: "扌(提手旁): 跟手的动作有关 · 出自《猫》捉老鼠", optionEmojis: ["✋", "🦵", "👄", "👀"] },
  }),
  g({
    question_id: "C4B_GLYPH_012",
    unit_id: G_U2,
    difficulty: 3,
    stem: '"讠"(言字旁) 的字大多跟什么有关?',
    options: [
      { id: "a", text: "说话 / 语言 (说 / 话 / 语 / 读)" },
      { id: "b", text: "走路 (远 / 近 / 进)" },
      { id: "c", text: "金属 (钢 / 铁 / 银)" },
      { id: "d", text: "丝线 (红 / 绿 / 细)" },
    ],
    answer: { type: "choice", value: "a" },
    solution_steps: ["言字旁(讠)的字多跟说话/语言有关: 说/话/语/读/讲/记。走之底(辶)才跟走路有关。"],
    game_data: { kind: "glyph_detective", hanzi: "语", hanziDesc: "讠(言字旁): 跟说话/语言有关", optionEmojis: ["💬", "🚶", "🔩", "🧵"] },
  }),
  g({
    question_id: "C4B_GLYPH_013",
    unit_id: G_U1,
    difficulty: 2,
    stem: '"艹"(草字头) 的字大多跟什么有关?',
    options: [
      { id: "a", text: "花草植物 (花 / 草 / 菜 / 苗)" },
      { id: "b", text: "天气 (晴 / 阴 / 雪)" },
      { id: "c", text: "房屋 (家 / 室 / 宅)" },
      { id: "d", text: "动物 (猫 / 狗 / 鸟)" },
    ],
    answer: { type: "choice", value: "a" },
    solution_steps: ["草字头(艹)的字多跟花草植物有关: 花/草/菜/苗/茶/荷。出自《乡下人家》的瓜架蔬菜。"],
    game_data: { kind: "glyph_detective", hanzi: "苗", hanziDesc: "艹(草字头): 跟花草植物有关", optionEmojis: ["🌱", "🌧️", "🏠", "🐱"] },
  }),
  g({
    question_id: "C4B_GLYPH_014",
    unit_id: G_U4,
    difficulty: 4,
    stem: '"灬"(四点底) 在 "热 / 照 / 煮" 里其实是什么变来的?',
    options: [
      { id: "a", text: "火 (跟火/加热有关)" },
      { id: "b", text: "水 (四点是水滴)" },
      { id: "c", text: "土 (四个土块)" },
      { id: "d", text: "只是装饰, 没意义" },
    ],
    answer: { type: "choice", value: "a" },
    solution_steps: ["四点底(灬)是'火'的变形, 跟火/加热有关: 热/照/煮/熟/煎。不是水滴, 这是常见误解。"],
    game_data: { kind: "glyph_detective", hanzi: "煮", hanziDesc: "灬(四点底): 是 火 的变形, 跟加热有关", optionEmojis: ["🔥", "💧", "🟫", "❌"] },
  }),
  g({
    question_id: "C4B_GLYPH_015",
    unit_id: G_U3,
    difficulty: 4,
    stem: '"忄"(竖心旁) 和 "心"(心字底) 的字大多跟什么有关?',
    options: [
      { id: "a", text: "心情/想法 (情 / 快 / 怕 / 想 / 念)" },
      { id: "b", text: "身体动作 (跑 / 跳 / 打)" },
      { id: "c", text: "天气变化 (晴 / 雨 / 风)" },
      { id: "d", text: "颜色 (红 / 蓝 / 绿)" },
    ],
    answer: { type: "choice", value: "a" },
    solution_steps: ["竖心旁(忄)和心字底(心)的字多跟心情/心理有关: 情/快/怕/愉/想/念/思。'青'+忄=情(心情)。"],
    game_data: { kind: "glyph_detective", hanzi: "情", hanziDesc: "忄(竖心旁): 跟心情/想法有关", optionEmojis: ["💗", "🏃", "🌦️", "🎨"] },
  }),
];
