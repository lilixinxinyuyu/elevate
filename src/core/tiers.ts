/**
 * 段位（地理段位）系统
 *
 * 5 段：和平街小学 → 锦江区 → 成都市 → 四川省 → 全国
 * 每段都有一枚可佩戴的勋章。跨段升档触发解锁动画。
 *
 * **段位分布原则**（参考 LoL/赛季制游戏的金字塔分布）：
 * - 大多数玩家停在最低段（和平街小学），约 70% 范围
 * - 进入"区"级是真正的突破（top 30%）
 * - 进入市/省/国级越来越难（top 10% / 5% / 1%）
 * - 最高段（全国）极其罕见，留给真正的超凡选手
 *
 * **每学期一局**：
 * - 学期 4 个月就是一局完整赛季，结束清零下学期重开
 * - 4 个月 perfect = 1000 = 全国（顶段）
 * - 上册/下册是独立赛季，互不串
 *
 * 实际宽度分配（pyramid，反映学期末分布）：
 *   0-600    和平街小学  60% 孩子的家
 *   600-780  锦江区        中上 25%
 *   780-880  成都市        顶 10%
 *   880-960  四川省        顶 4%
 *   960-1000 全国          顶 1%（4 月 perfect）
 *
 * 段位区间想调整就改下面的 range —— 全部都是变量。
 */
export interface Tier {
  /** 唯一 ID，用作 meta 存储与勋章 ID */
  id: string;
  /** 段位地理标签（显示给 Selena） */
  name: string;
  /** 综合分门槛 [min, max)；最高段为 [min, max] 闭区间 */
  range: [number, number];
  /** 勋章名称（佩戴显示在头像旁的小标签） */
  badgeName: string;
  /** 勋章图标（emoji，跨平台可显示） */
  badgeIcon: string;
  /** 勋章描述（hover / 点开显示） */
  badgeDesc: string;
  /** 主题色调（Tailwind from-/to- 类前缀） */
  theme: {
    /** 卡片渐变 from 颜色 */
    fromColor: string;
    /** 卡片渐变 to 颜色 */
    toColor: string;
    /** 边框色 */
    borderColor: string;
    /** 主文字色 */
    textColor: string;
    /** 副文字色 */
    subTextColor: string;
  };
  /** 跨入此段的庆祝口号（解锁动画时显示） */
  unlockSlogan: string;
}

export const TIERS: Tier[] = [
  {
    id: "school",
    name: "和平街小学",
    // 0-600：60% 孩子的家
    range: [0, 600],
    badgeName: "和平校徽",
    badgeIcon: "🏫",
    badgeDesc: "你已经是和平街小学的小学徒啦！",
    theme: {
      fromColor: "from-sky-500/20",
      toColor: "to-cyan-500/10",
      borderColor: "border-sky-400/40",
      textColor: "text-sky-100",
      subTextColor: "text-sky-200/80",
    },
    unlockSlogan: "和平街小学，欢迎你！",
  },
  {
    id: "district",
    name: "锦江区",
    // 600-780：中上 25%
    range: [600, 780],
    badgeName: "锦江徽章",
    badgeIcon: "🏛️",
    badgeDesc: "锦江区四年级里你已经站到前列了。",
    theme: {
      fromColor: "from-emerald-500/25",
      toColor: "to-teal-500/15",
      borderColor: "border-emerald-400/50",
      textColor: "text-emerald-100",
      subTextColor: "text-emerald-200/80",
    },
    unlockSlogan: "🎉 出校了！锦江区赛道开启！",
  },
  {
    id: "city",
    name: "成都市",
    // 780-880：顶 10%
    range: [780, 880],
    badgeName: "蓉城勋章",
    badgeIcon: "🌆",
    badgeDesc: "蓉城小达人，整个成都市都看得到你的努力。",
    theme: {
      fromColor: "from-violet-500/25",
      toColor: "to-fuchsia-500/15",
      borderColor: "border-violet-400/50",
      textColor: "text-violet-100",
      subTextColor: "text-violet-200/80",
    },
    unlockSlogan: "🎊 锦江已征服！成都市赛道开启！",
  },
  {
    id: "province",
    name: "四川省",
    // 880-960：顶 4%
    range: [880, 960],
    badgeName: "天府之星",
    badgeIcon: "🐼",
    badgeDesc: "天府小神童，全省四年级里你已经名列前茅！",
    theme: {
      fromColor: "from-amber-500/25",
      toColor: "to-orange-500/15",
      borderColor: "border-amber-400/50",
      textColor: "text-amber-100",
      subTextColor: "text-amber-200/80",
    },
    unlockSlogan: "🌟 成都已通关！四川省赛道开启！",
  },
  {
    id: "country",
    name: "全国",
    // 960-1000：顶 1%，基本只有 4 个月 perfect 才能进
    range: [960, 1000],
    badgeName: "中华小数神",
    badgeIcon: "🇨🇳",
    badgeDesc: "全国四年级数学小神童，传说级。",
    theme: {
      fromColor: "from-rose-500/30",
      toColor: "to-red-500/20",
      borderColor: "border-rose-400/60",
      textColor: "text-rose-100",
      subTextColor: "text-rose-200/80",
    },
    unlockSlogan: "🏆 四川已统治！全国赛道开启！",
  },
];

/** 综合分 → 当前所在段位 */
export function tierFromScore(score: number): Tier {
  for (const t of TIERS) {
    if (score >= t.range[0] && score < t.range[1]) return t;
  }
  // 满分以上归到最后一段
  return TIERS[TIERS.length - 1]!;
}

/** 段位 ID → Tier */
export function tierById(id: string): Tier | undefined {
  return TIERS.find((t) => t.id === id);
}

/** 当前段位之后的下一段（最高段返回 null） */
export function nextTier(current: Tier): Tier | null {
  const idx = TIERS.findIndex((t) => t.id === current.id);
  if (idx < 0 || idx >= TIERS.length - 1) return null;
  return TIERS[idx + 1] ?? null;
}

/**
 * 段位内进度 [0..1]。score=range[0] → 0；score=range[1] → 1（截断）。
 */
export function progressInTier(score: number, tier: Tier): number {
  const [lo, hi] = tier.range;
  if (score <= lo) return 0;
  if (score >= hi) return 1;
  return (score - lo) / (hi - lo);
}

/**
 * 段位内"超过 X% 的同年级"友好曲线。
 * 进入新段位时显示 50%（新池子刚起步），段位顶点显示 89%（再涨跨段）。
 * 最高段（全国）顶点 99%。
 */
export function percentSurpassed(score: number, tier: Tier): number {
  const p = progressInTier(score, tier);
  const isTop = tier.id === "country";
  const lo = 50;
  const hi = isTop ? 99 : 89;
  return Math.round(lo + p * (hi - lo));
}

/** 距离下一段还差多少分 */
export function deltaToNextTier(score: number, tier: Tier): number {
  const next = nextTier(tier);
  if (!next) return 0;
  return Math.max(0, next.range[0] - score);
}

/** 列出所有段位的"顺序索引"，用于判定是否前进 */
export function tierIndex(id: string): number {
  return TIERS.findIndex((t) => t.id === id);
}

/**
 * 段内小段（★ I/II/III/IV，共 4 档）。
 * 进度 0-25% → I；25-50% → II；50-75% → III；75-100% → IV。
 * 返回 1-4 数字。
 */
export function subRank(score: number, tier: Tier): number {
  const p = progressInTier(score, tier);
  if (p < 0.25) return 1;
  if (p < 0.5) return 2;
  if (p < 0.75) return 3;
  return 4;
}

/** 罗马数字表示 */
export function subRankRoman(n: number): string {
  return ["", "I", "II", "III", "IV"][n] ?? `${n}`;
}

/** 星级字符串：实星 + 空星，例如 ★★★☆ */
export function subRankStars(n: number, total = 4): string {
  return "★".repeat(Math.max(0, Math.min(total, n))) + "☆".repeat(Math.max(0, total - n));
}

/** 段内全局唯一 ID（"district-3"），便于跨段升档判定时区分小段 */
export function tierStageId(tier: Tier, sub: number): string {
  return `${tier.id}-${sub}`;
}

/** 解析 "district-3" → { tier, sub } */
export function parseTierStage(id: string): { tierId: string; sub: number } | null {
  const m = /^(\w+)-(\d)$/.exec(id);
  if (!m) return null;
  return { tierId: m[1]!, sub: parseInt(m[2]!, 10) };
}

/** 给定 stage A 与 stage B，B 是否是 A 的"前进"（更高小段或更高大段） */
export function stageGreaterThan(a: { tierId: string; sub: number }, b: { tierId: string; sub: number }): boolean {
  const ai = tierIndex(a.tierId);
  const bi = tierIndex(b.tierId);
  if (ai !== bi) return ai > bi;
  return a.sub > b.sub;
}
