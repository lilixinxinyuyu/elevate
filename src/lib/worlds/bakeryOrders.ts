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
}

export const BAKERY_ORDERS: BakeryOrder[] = [
  // 单 1: 1/4 = 3 块
  {
    index: 1,
    customerEmoji: "👧",
    customerLine: "请给我 1/4 个 🍰 草莓蛋糕～",
    needSlices: 3,
    fractionLabel: "1/4",
    cakeTopColor: "#fda4af", // 草莓粉
    cakeAccentColor: "#dc2626",
    emoji: "🍰",
    hint: "1/4 = 12 块里的 3 块（12 ÷ 4 = 3）",
  },
  // 单 2: 1/3 = 4 块
  {
    index: 2,
    customerEmoji: "🧒",
    customerLine: "我要 1/3 个 🎂 巧克力蛋糕！",
    needSlices: 4,
    fractionLabel: "1/3",
    cakeTopColor: "#78350f", // 巧克力棕
    cakeAccentColor: "#fbbf24",
    emoji: "🎂",
    hint: "1/3 = 12 块里的 4 块（12 ÷ 3 = 4）",
  },
  // 单 3: 1/2 = 6 块
  {
    index: 3,
    customerEmoji: "👵",
    customerLine: "我要 1/2 个 🥮 抹茶蛋糕。",
    needSlices: 6,
    fractionLabel: "1/2",
    cakeTopColor: "#86efac", // 抹茶绿
    cakeAccentColor: "#16a34a",
    emoji: "🥮",
    hint: "1/2 = 12 块里的 6 块（12 ÷ 2 = 6）",
  },
];

/** 全蛋糕分块数 (固定 12 切块) */
export const CAKE_TOTAL_SLICES = 12;
