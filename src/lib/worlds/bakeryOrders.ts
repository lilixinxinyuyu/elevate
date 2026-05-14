/**
 * v0.32.5: 甜心面包店订单 —— 分数训练 (½, ¼, ⅓, ¾)。
 *
 * 玩法：每单 12-slice 蛋糕，顾客要 X/12 块（约分后是 ½/⅓/¼/etc）。
 * Selena 把对应数量的 slice 拖到顾客盘子，块数对了完成。
 *
 * 分母 12 让 ¼/⅓/½/¾ 都可整除（3/4/6/9 块）。
 */

export interface BakeryOrder {
  index: number;
  customerEmoji: string;
  customerLine: string;
  /** 要的块数（out of 12 total） */
  needSlices: number;
  /** 显示分数表示，e.g. "1/4" 或 "½" */
  fractionLabel: string;
  /** 蛋糕颜色（top）+ 装饰 emoji */
  cakeTopColor: string;
  cakeAccentColor: string;
  emoji: string;
  hint?: string;
  /**
   * v0.32.19：是否要求"扇形切"（相邻 slice）。
   * 默认 true — 数学意义：1/N 蛋糕 = 连续的 N/12 块，不是随便挑 N 块。
   * 玩家切的第一块为 anchor，之后必须切相邻于已切的 slice，
   * 切错位置 → wrong reject + slice 闪红不被切走。
   * 这是 v0.32.19 加的玩法辨识度差异化（双 CLI Ep5 review 主张）。
   */
  requireContiguous?: boolean;
}

/**
 * v0.32.46 (Ep22 P0#3)：3 单升级到 1/3 / 5/12 / 7/12
 *  - 单 1 (教程): 1/3 = 4 块（强化"约分分数 → /12 计数"概念）
 *  - 单 2: 5/12 = 5 块（非约分分数，G4B 期末难点）
 *  - 单 3: 7/12 = 7 块（非约分 + 大份额，扇形切判定更严格）
 *
 * 原 1/4 / 1/3 / 1/2 都是常见约分分数，对 G4B 偏简单。
 * 新方案让 Selena 接触"非约分分母 12 的分数"，培养"看 1/12 单位块算"思维。
 */
export const BAKERY_ORDERS: BakeryOrder[] = [
  // 单 1: 教程 — 1/3 = 4 块（约分分数 → 4/12 计数）
  {
    index: 1,
    customerEmoji: "👧",
    customerLine: "请给我 1/3 个 🍰 草莓蛋糕～整块的哦！",
    needSlices: 4,
    fractionLabel: "1/3",
    cakeTopColor: "#fda4af",
    cakeAccentColor: "#dc2626",
    emoji: "🍰",
    hint: "1/3 = 12 块里的 4 块（12 ÷ 3 = 4）；切成连续的扇形",
    requireContiguous: true,
  },
  // 单 2: 5/12 = 5 块（非约分）
  {
    index: 2,
    customerEmoji: "🧒",
    customerLine: "我要 5/12 个 🎂 巧克力蛋糕！要连着的～",
    needSlices: 5,
    fractionLabel: "5/12",
    cakeTopColor: "#78350f",
    cakeAccentColor: "#fbbf24",
    emoji: "🎂",
    hint: "5/12 直接读 — 12 块里的 5 块（不像 1/3、1/2，5/12 不能约分）",
    requireContiguous: true,
  },
  // 单 3: 7/12 = 7 块（非约分 + 大份额）
  {
    index: 3,
    customerEmoji: "👵",
    customerLine: "我要 7/12 个 🥮 抹茶蛋糕。要切大半个连着的～",
    needSlices: 7,
    fractionLabel: "7/12",
    cakeTopColor: "#86efac",
    cakeAccentColor: "#16a34a",
    emoji: "🥮",
    hint: "7/12 = 12 块里的 7 块（比一半多 1 块，非约分分数）",
    requireContiguous: true,
  },
];

/** 全蛋糕分块数 (固定 12 切块) */
export const CAKE_TOTAL_SLICES = 12;
