/**
 * 语文 · C4B 阅读理解 multi-step 题包 (Phase 2 P2-4, v0.36.1).
 *
 * 期中考第 10-11 题型 "短文 + 多问". G4B 必考 + 失分大头.
 * 期中卷子原文: page 1 "假如我来当校长" + page 3 "健康食堂" 等.
 *
 * 题型设计:
 *  - 短文 150-250 字 (含在 stem 里)
 *  - 每短文 5 题 (主旨 / 概括 / 选词 / 推理 / 仿写)
 *  - 4 选 1 多步小题, 共享同一短文
 *
 * 3 短文 × 5 题 = 15 题:
 *  - 短文 1 (U1 乡村): 春天的乡下 (跟课文《乡下人家》风格)
 *  - 短文 2 (U2 科技): 神奇的纳米技术 (跟课文《纳米技术》风格)
 *  - 短文 3 (U3 自然): 白桦树下 (跟课文《白桦》《绿》风格)
 *
 * 跟之前 readingPack 不同的是: 此 pack 走多步题, 每题前都附完整短文 (用户
 * 答题时不需翻回去). 这是 G4B 阅读理解的真实考试形式.
 */

import type { Question } from "../../core/types";
import { pickChoice } from "./questionHelpers";

const U1 = "C4B_U1_NATURE";
const U2 = "C4B_U2_SCIENCE";
const U3 = "C4B_U3_POETRY";

const READING_U1 = "C4B_U1_READING";
const READING_U2 = "C4B_U2_READING";
const READING_U3 = "C4B_U3_READING";

// 短文 1: 春天的乡下 (U1)
const PASSAGE_1 = `📖 短文一·春天的乡下

春天到了, 乡下到处充满了生机. 桃花开得像火, 樱花白得像雪, 油菜花金黄一片, 远远望去像铺在田野上的金色地毯. 燕子从南方飞回来了, 在屋檐下叽叽喳喳地筑起了温暖的小巢. 小溪欢快地流着, 水里的小鱼自由自在地游来游去. 乡下的孩子们也忙起来了, 他们在田野里放风筝, 在小溪边追蝴蝶, 在桃树下捉迷藏. 春天的乡下, 真是个充满乐趣的地方.`;

// 短文 2: 神奇的纳米技术 (U2)
const PASSAGE_2 = `📖 短文二·神奇的纳米技术

纳米是一种长度单位, 1 纳米等于 10 亿分之一米. 这个尺寸非常非常小, 比头发丝还细 5 万倍. 在纳米尺度下, 物质会表现出神奇的性质. 比如普通的金子是黄色的, 但纳米金粉竟然是红色或紫色的. 科学家利用这种神奇性质, 发明了许多有用的东西. 比如纳米涂料让衣服不会脏, 纳米药物能精准送到病人需要的部位治病, 纳米材料让飞机变得更轻更结实. 纳米技术正在改变我们的生活, 让世界变得更美好.`;

// 短文 3: 白桦树下 (U3)
const PASSAGE_3 = `📖 短文三·白桦树下

我家门前有一棵白桦树, 它陪我度过了童年. 春天, 白桦树伸出嫩绿的新叶, 像一双双小手在风中招摇. 夏天, 浓密的枝叶为我们撑起一把巨大的绿伞, 我和小伙伴们在树下乘凉、玩耍. 秋天, 白桦的叶子变成金黄色, 落下来铺成一条金色的小路, 走在上面发出沙沙的声音. 冬天, 白桦披上了银装, 静静地站在雪地里, 像一位守护我们的卫士. 我爱这棵白桦树, 它不仅美丽, 还是我童年最好的朋友.`;

export const SEED_QUESTIONS_CHINESE_READING: Question[] = [
  // ============================================================
  // 短文 1: 春天的乡下 (5 题)
  // ============================================================
  pickChoice({
    id: "cn-u1-read-001",
    unit_id: U1,
    skill_id: READING_U1,
    ability: ["reading"],
    difficulty: 4,
    exam_priority: "MUST_BIG",
    stem: `${PASSAGE_1}\n\n🔹 第 1 题: 短文主要描写的是什么?`,
    options: [
      { id: "a", text: "春天乡下的生机和孩子们的乐趣" },
      { id: "b", text: "桃花和樱花的区别", errorTag: "narrow_focus" },
      { id: "c", text: "怎样捉迷藏", errorTag: "detail_only" },
      { id: "d", text: "燕子的生活习性", errorTag: "detail_only" },
    ],
    correct: "a",
    solution: ['短文从景物 (花/燕/溪) + 孩子活动 (放风筝/追蝶) 两条线描写春天乡下的生机. A 准确概括.'],
  }),
  pickChoice({
    id: "cn-u1-read-002",
    unit_id: U1,
    skill_id: READING_U1,
    ability: ["reading", "vocabulary"],
    difficulty: 3,
    stem: `${PASSAGE_1}\n\n🔹 第 2 题: 短文里 "桃花开得像火, 樱花白得像雪" 用了什么修辞?`,
    options: [
      { id: "a", text: "比喻 (X 像 Y)" },
      { id: "b", text: "拟人 (物当人)", errorTag: "wrong_rhetoric" },
      { id: "c", text: "排比 (3 个相同结构)", errorTag: "wrong_rhetoric" },
      { id: "d", text: "夸张 (放大特征)", errorTag: "wrong_rhetoric" },
    ],
    correct: "a",
    solution: ['"X 像 Y" 是比喻句. 桃花比火, 樱花比雪.'],
  }),
  pickChoice({
    id: "cn-u1-read-003",
    unit_id: U1,
    skill_id: READING_U1,
    ability: ["reading"],
    difficulty: 4,
    stem: `${PASSAGE_1}\n\n🔹 第 3 题: 短文里描写孩子在做的 3 件事是?`,
    options: [
      { id: "a", text: "放风筝 / 追蝴蝶 / 捉迷藏" },
      { id: "b", text: "种花 / 钓鱼 / 爬树", errorTag: "not_in_text" },
      { id: "c", text: "唱歌 / 跳舞 / 画画", errorTag: "not_in_text" },
      { id: "d", text: "种树 / 摘花 / 抓鱼", errorTag: "not_in_text" },
    ],
    correct: "a",
    solution: ['短文倒数第二句明确说: "在田野里放风筝, 在小溪边追蝴蝶, 在桃树下捉迷藏".'],
  }),
  pickChoice({
    id: "cn-u1-read-004",
    unit_id: U1,
    skill_id: READING_U1,
    ability: ["reading", "expression"],
    difficulty: 4,
    stem: `${PASSAGE_1}\n\n🔹 第 4 题: "金色的地毯" 在文中指什么?`,
    options: [
      { id: "a", text: "成片的油菜花" },
      { id: "b", text: "金色的稻田", errorTag: "not_in_text" },
      { id: "c", text: "黄色的沙土", errorTag: "not_in_text" },
      { id: "d", text: "金黄的落叶", errorTag: "not_in_text" },
    ],
    correct: "a",
    solution: ['"油菜花金黄一片, 远远望去像铺在田野上的金色地毯". 比喻油菜花.'],
  }),
  pickChoice({
    id: "cn-u1-read-005",
    unit_id: U1,
    skill_id: READING_U1,
    ability: ["reading", "expression"],
    difficulty: 4,
    exam_priority: "MUST_BIG",
    stem: `${PASSAGE_1}\n\n🔹 第 5 题: 这篇短文表达了作者怎样的感情?`,
    options: [
      { id: "a", text: "对春天乡下的喜爱和留恋" },
      { id: "b", text: "对花朵颜色的好奇", errorTag: "narrow_focus" },
      { id: "c", text: "对孩子玩耍的羡慕", errorTag: "narrow_focus" },
      { id: "d", text: "对城市生活的厌倦", errorTag: "not_in_text" },
    ],
    correct: "a",
    solution: ['末句 "春天的乡下, 真是个充满乐趣的地方" 直接表达喜爱. 全文用美的景物 + 孩子的乐趣双线烘托.'],
  }),

  // ============================================================
  // 短文 2: 神奇的纳米技术 (5 题)
  // ============================================================
  pickChoice({
    id: "cn-u2-read-001",
    unit_id: U2,
    skill_id: READING_U2,
    ability: ["reading"],
    difficulty: 4,
    exam_priority: "MUST_BIG",
    stem: `${PASSAGE_2}\n\n🔹 第 1 题: 短文主要介绍的是什么?`,
    options: [
      { id: "a", text: "纳米技术的神奇性质和实际应用" },
      { id: "b", text: "金子的颜色变化", errorTag: "detail_only" },
      { id: "c", text: "飞机的制造方法", errorTag: "detail_only" },
      { id: "d", text: "头发丝的粗细", errorTag: "detail_only" },
    ],
    correct: "a",
    solution: ['短文先解释纳米尺度 + 神奇性质, 再介绍 4 类应用 (涂料/药物/材料). 主题: 纳米技术 + 应用.'],
  }),
  pickChoice({
    id: "cn-u2-read-002",
    unit_id: U2,
    skill_id: READING_U2,
    ability: ["reading"],
    difficulty: 3,
    stem: `${PASSAGE_2}\n\n🔹 第 2 题: 1 纳米等于多少米?`,
    options: [
      { id: "a", text: "10 亿分之一米" },
      { id: "b", text: "1 万分之一米", errorTag: "not_in_text" },
      { id: "c", text: "1 米", errorTag: "not_in_text" },
      { id: "d", text: "1 厘米", errorTag: "not_in_text" },
    ],
    correct: "a",
    solution: ['短文第 2 句明确: "1 纳米等于 10 亿分之一米". 直接信息检索.'],
  }),
  pickChoice({
    id: "cn-u2-read-003",
    unit_id: U2,
    skill_id: READING_U2,
    ability: ["reading", "expression"],
    difficulty: 4,
    stem: `${PASSAGE_2}\n\n🔹 第 3 题: "比头发丝还细 5 万倍" 这句话用了什么写法?`,
    options: [
      { id: "a", text: "比较 (拿熟悉的东西来对比)" },
      { id: "b", text: "比喻 (X 像 Y)", errorTag: "wrong_rhetoric" },
      { id: "c", text: "拟人 (物当人)", errorTag: "wrong_rhetoric" },
      { id: "d", text: "排比 (3 个相同结构)", errorTag: "wrong_rhetoric" },
    ],
    correct: "a",
    solution: ['用 "头发丝" 这个熟悉的东西做对比, 让读者理解纳米有多小. 这是 "比较" 说明方法.'],
  }),
  pickChoice({
    id: "cn-u2-read-004",
    unit_id: U2,
    skill_id: READING_U2,
    ability: ["reading"],
    difficulty: 4,
    stem: `${PASSAGE_2}\n\n🔹 第 4 题: 短文中列出了几种纳米技术的应用?`,
    options: [
      { id: "a", text: "3 种 (涂料 / 药物 / 材料)" },
      { id: "b", text: "5 种", errorTag: "wrong_count" },
      { id: "c", text: "10 种", errorTag: "wrong_count" },
      { id: "d", text: "无具体应用", errorTag: "wrong_count" },
    ],
    correct: "a",
    solution: ['短文列举: "纳米涂料 (不脏) / 纳米药物 (送病部位) / 纳米材料 (飞机更轻结实)". 共 3 种.'],
  }),
  pickChoice({
    id: "cn-u2-read-005",
    unit_id: U2,
    skill_id: READING_U2,
    ability: ["reading", "expression"],
    difficulty: 4,
    exam_priority: "MUST_BIG",
    stem: `${PASSAGE_2}\n\n🔹 第 5 题: 末句 "纳米技术正在改变我们的生活, 让世界变得更美好" 主要表达?`,
    options: [
      { id: "a", text: "对纳米技术发展的赞美和期待" },
      { id: "b", text: "纳米技术已经完成", errorTag: "wrong_tense" },
      { id: "c", text: "世界已经美好了", errorTag: "wrong_focus" },
      { id: "d", text: "技术不重要", errorTag: "opposite" },
    ],
    correct: "a",
    solution: ['"正在改变" + "让世界更美好" 是赞美科技进步, 对未来充满期待.'],
  }),

  // ============================================================
  // 短文 3: 白桦树下 (5 题)
  // ============================================================
  pickChoice({
    id: "cn-u3-read-001",
    unit_id: U3,
    skill_id: READING_U3,
    ability: ["reading"],
    difficulty: 4,
    exam_priority: "MUST_BIG",
    stem: `${PASSAGE_3}\n\n🔹 第 1 题: 短文按什么顺序写白桦树?`,
    options: [
      { id: "a", text: "按四季顺序: 春 → 夏 → 秋 → 冬" },
      { id: "b", text: "按地点顺序", errorTag: "wrong_order" },
      { id: "c", text: "按事件顺序", errorTag: "wrong_order" },
      { id: "d", text: "按人物顺序", errorTag: "wrong_order" },
    ],
    correct: "a",
    solution: ['短文 4 个段落分别写: 春天 → 夏天 → 秋天 → 冬天. 时间 (季节) 顺序.'],
  }),
  pickChoice({
    id: "cn-u3-read-002",
    unit_id: U3,
    skill_id: READING_U3,
    ability: ["reading", "vocabulary"],
    difficulty: 4,
    stem: `${PASSAGE_3}\n\n🔹 第 2 题: "白桦披上了银装" 中的 "银装" 指的是什么?`,
    options: [
      { id: "a", text: "覆盖的白雪" },
      { id: "b", text: "白色的银饰", errorTag: "literal" },
      { id: "c", text: "白色的衣服", errorTag: "literal" },
      { id: "d", text: "银白的树皮", errorTag: "literal" },
    ],
    correct: "a",
    solution: ['"银装" 是比喻, 把覆盖白雪的树比作披银装的人. 冬天季节信息 + 拟人.'],
  }),
  pickChoice({
    id: "cn-u3-read-003",
    unit_id: U3,
    skill_id: READING_U3,
    ability: ["reading"],
    difficulty: 4,
    stem: `${PASSAGE_3}\n\n🔹 第 3 题: 文中用了几个比喻 / 拟人 修辞?`,
    options: [
      { id: "a", text: "至少 4 处 (嫩叶像小手 / 浓荫像绿伞 / 落叶像金路 / 银装/卫士)" },
      { id: "b", text: "只有 1 处", errorTag: "miss_count" },
      { id: "c", text: "全部都是直白描写", errorTag: "opposite" },
      { id: "d", text: "没有用修辞", errorTag: "opposite" },
    ],
    correct: "a",
    solution: ['四季各自至少一个修辞: "嫩绿的新叶像小手" / "巨大的绿伞" / "金色的小路" / "披上银装" + "像卫士".'],
  }),
  pickChoice({
    id: "cn-u3-read-004",
    unit_id: U3,
    skill_id: READING_U3,
    ability: ["reading", "expression"],
    difficulty: 4,
    stem: `${PASSAGE_3}\n\n🔹 第 4 题: "走在上面发出沙沙的声音" 中 "沙沙" 是?`,
    options: [
      { id: "a", text: "拟声词 (模拟落叶被踩的声音)" },
      { id: "b", text: "比喻", errorTag: "wrong_rhetoric" },
      { id: "c", text: "拟人", errorTag: "wrong_rhetoric" },
      { id: "d", text: "夸张", errorTag: "wrong_rhetoric" },
    ],
    correct: "a",
    solution: ['"沙沙" 模拟脚踩落叶的声音, 是拟声词 (象声词).'],
  }),
  pickChoice({
    id: "cn-u3-read-005",
    unit_id: U3,
    skill_id: READING_U3,
    ability: ["reading", "expression"],
    difficulty: 4,
    exam_priority: "MUST_BIG",
    stem: `${PASSAGE_3}\n\n🔹 第 5 题: 末句 "它不仅美丽, 还是我童年最好的朋友" 表达了?`,
    options: [
      { id: "a", text: "对白桦树的喜爱 + 童年的回忆" },
      { id: "b", text: "对童年朋友的怀念", errorTag: "narrow_focus" },
      { id: "c", text: "对自然美景的赞美", errorTag: "narrow_focus" },
      { id: "d", text: "对树木知识的学习", errorTag: "off_topic" },
    ],
    correct: "a",
    solution: ['"不仅 ... 还是..." 双重表达. 既爱树的美, 也把树当成童年的伙伴. A 全面概括.'],
  }),
];
