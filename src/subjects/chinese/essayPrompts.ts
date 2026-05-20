/**
 * 语文 · C4B 自由作文题库 (Phase 3 Sprint C7, v0.36.37).
 *
 * G4B 期末作文占分大, Selena 最怕"不知道写什么". 把题库做厚 + 按人教版下册
 * 8 个习作单元对齐, 覆盖 写人/写事/写景/状物/想象/看图/续写/应用文.
 *
 * tier 两档:
 *  - 片段 (minChars 20): 写 2-3 句描写, 练好词好句 + 1 个修辞
 *  - 成篇 (minChars 50): 看题/看图写一小段, 有头有尾 → 小进 AI 点评
 *
 * 另: C7 页面有"🎲 小进出新题"按钮走 AI 即时生成, 题库 = 兜底 + 起步.
 */

export type EssayTier = "片段" | "成篇";

export type EssayPrompt = {
  id: string;
  label: string;
  title: string;
  guide: string;
  minChars: number;
  tier: EssayTier;
  /** 人教版 G4B 习作单元 / 题型分类 (展示 + 筛选用) */
  category?: string;
};

export const ESSAY_PROMPTS: EssayPrompt[] = [
  // ── 片段 · 写景 ──
  { id: "e-jing-1", label: "片段 · 写景", category: "写景", tier: "片段", minChars: 20,
    title: "用 2-3 句话描写「春天的校园」",
    guide: "调动颜色 + 一个比喻或拟人。例：操场边的柳树抽出嫩芽，像小姑娘的辫子在风里轻轻摆。" },
  { id: "e-jing-2", label: "片段 · 写景", category: "写景", tier: "片段", minChars: 20,
    title: "用 2-3 句话描写「雨后的天空」",
    guide: "写颜色和变化，用上「像」字句。想想彩虹、云朵、阳光。" },
  { id: "e-jing-3", label: "片段 · 写景", category: "写景", tier: "片段", minChars: 20,
    title: "用 2-3 句话描写「夜晚的星空」",
    guide: "星星可以拟人（眨眼/捉迷藏），月亮可以打比方。" },

  // ── 片段 · 状物 ──
  { id: "e-wu-1", label: "片段 · 写物", category: "状物", tier: "片段", minChars: 20,
    title: "用 2-3 句话描写你最喜欢的一样东西",
    guide: "写它的样子 + 你为什么喜欢。用上一个修辞。" },
  { id: "e-wu-2", label: "片段 · 写物", category: "状物", tier: "片段", minChars: 20,
    title: "用 2-3 句话描写一种水果",
    guide: "写颜色、形状、味道。让别人读了就想吃。" },
  { id: "e-wu-3", label: "片段 · 写物", category: "状物", tier: "片段", minChars: 25,
    title: "用 2-3 句话描写一种你喜欢的小动物的样子",
    guide: "抓住一个特点（毛色/眼睛/动作），用比喻让它活起来。（呼应《我的动物朋友》）" },

  // ── 片段 · 写人 ──
  { id: "e-ren-1", label: "片段 · 写人", category: "写人", tier: "片段", minChars: 25,
    title: "用 2-3 句话写一写你的好朋友长什么样",
    guide: "抓住外貌一个特点 + 一个让你印象深的小动作。" },
  { id: "e-ren-2", label: "片段 · 写人", category: "写人", tier: "片段", minChars: 25,
    title: "用 2-3 句话写写「我自己」的一个特点",
    guide: "可以写爱好/性格/外貌。用一件小事来证明。（呼应《我的“自画像”》）" },

  // ── 片段 · 想象 ──
  { id: "e-xiang-1", label: "片段 · 想象", category: "想象", tier: "片段", minChars: 25,
    title: "假如你有一支神笔，你会画什么？写 2-3 句",
    guide: "大胆想象 + 说说为什么。（呼应《我的奇思妙想》）" },

  // ── 成篇 · 看图写话 ──
  { id: "e-tu-1", label: "成篇 · 看图写话", category: "看图写话", tier: "成篇", minChars: 50,
    title: "看图写话：一个小朋友在雨中给老奶奶撑伞",
    guide: "写清楚：什么时间、谁、做了什么、结果怎样。50-100 字，有头有尾。" },
  { id: "e-tu-2", label: "成篇 · 看图写话", category: "看图写话", tier: "成篇", minChars: 50,
    title: "看图写话：周末，一家人在公园里放风筝",
    guide: "按顺序写：先…接着…最后…。加上人物的语言或心情。" },

  // ── 成篇 · 写事 ──
  { id: "e-shi-1", label: "成篇 · 题目作文", category: "写事", tier: "成篇", minChars: 50,
    title: "题目作文：《一件难忘的事》开头一段",
    guide: "用一句话点题 + 交代事情背景。开头要吸引人。50 字以上。" },
  { id: "e-shi-2", label: "成篇 · 题目作文", category: "写事", tier: "成篇", minChars: 60,
    title: "题目作文：《我学会了___》（先把题目补完整）",
    guide: "写学这件事的过程：遇到什么困难、怎么坚持、最后学会的心情。（呼应习作6）" },
  { id: "e-shi-3", label: "成篇 · 写事", category: "写事", tier: "成篇", minChars: 60,
    title: "写一件你和家人之间温暖的小事",
    guide: "选一个具体的瞬间，写清起因、经过、结果，结尾写感受。" },

  // ── 成篇 · 写景/游记 ──
  { id: "e-you-1", label: "成篇 · 游记", category: "游记", tier: "成篇", minChars: 60,
    title: "题目作文：《游___》（填一个你去过的地方）",
    guide: "按游览顺序写（移步换景）：进门看到…往前走…最后…。（呼应习作5）" },

  // ── 成篇 · 状物 ──
  { id: "e-wu-long-1", label: "成篇 · 状物", category: "状物", tier: "成篇", minChars: 60,
    title: "介绍你的一位「动物朋友」",
    guide: "写它的外形、生活习性、和你之间的故事，表达喜爱之情。（呼应习作4《我的动物朋友》）" },

  // ── 成篇 · 写景（我的乐园）──
  { id: "e-leyuan-1", label: "成篇 · 写景", category: "写景", tier: "成篇", minChars: 60,
    title: "题目作文：《我的乐园》",
    guide: "写一个你最喜欢的地方，它是什么样的、你在那做什么、带给你怎样的快乐。（呼应习作1）" },

  // ── 成篇 · 想象/故事新编 ──
  { id: "e-xiang-long-1", label: "成篇 · 想象", category: "想象", tier: "成篇", minChars: 60,
    title: "想象作文：未来的书包会有什么神奇功能？",
    guide: "大胆想象 + 写清它怎么帮到你。（呼应《我的奇思妙想》）" },
  { id: "e-gushi-1", label: "成篇 · 故事新编", category: "想象", tier: "成篇", minChars: 70,
    title: "故事新编：给《龟兔赛跑》编一个新结局",
    guide: "保留主角，换一个意想不到的结局，注意前后连贯。（呼应习作8 故事新编）" },

  // ── 成篇 · 应用文 ──
  { id: "e-app-1", label: "成篇 · 日记", category: "应用文", tier: "成篇", minChars: 50,
    title: "写一篇今天的日记",
    guide: "格式：第一行写日期和天气。正文写今天一件印象最深的事 + 你的心情。" },
  { id: "e-app-2", label: "成篇 · 书信", category: "应用文", tier: "成篇", minChars: 60,
    title: "给远方的爷爷奶奶写一段话（书信片段）",
    guide: "先问候，再说说你最近的学习或生活，最后表达想念。注意称呼和问候语。" },

  // ── 成篇 · 读后感/诗歌 ──
  { id: "e-shige-1", label: "片段 · 仿写诗歌", category: "诗歌", tier: "片段", minChars: 25,
    title: "仿照《绿》写 2-3 行小诗，主题「金色的秋天」",
    guide: "用重复和比喻，写出秋天的颜色和感觉。（呼应习作3 轻叩诗歌大门）" },
  { id: "e-dhg-1", label: "成篇 · 读后感", category: "读后感", tier: "成篇", minChars: 60,
    title: "写一本你最近读的书的读后感片段",
    guide: "先写书名和主要内容（一两句），再写你最受触动的地方和想法。" },
];
