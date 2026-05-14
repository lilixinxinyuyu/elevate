/**
 * v0.32.4: 百宝银行换零订单 —— 单位换算训练 (1元=10角=100分)。
 *
 * 玩法：顾客带 ¥X 来银行，Selena 用零钱柜里的钱币拖到"换零托盘"，
 * 累计金额 = 顾客金额时完成。任意 valid combo 都接受（10 个 1 角 ≠ 1 个 1 元 但都等于 ¥1）。
 *
 * 设计：3 单从易到难。1 元/2 元/3.5 元，对应"基础换零/复合面额/复杂组合"。
 */

import type { Coin } from "./storeOrders";
import { COINS } from "./storeOrders";

export interface BankOrder {
  index: number;
  customerEmoji: string;
  customerLine: string;
  /** 应换零总金额 (cent) */
  targetCent: number;
  /** 桌上摆出来的钱币堆 — 必须含至少一种有效组合等于 targetCent */
  poolCoins: { coin: Coin; count: number }[];
  hint?: string;
}

/** 找钱币定义 */
const C1 = COINS[0]!; // ¥1
const C05 = COINS[1]!; // ¥0.5
const C01 = COINS[2]!; // ¥0.1

/**
 * v0.32.45 (Ep21): 难度梯度大升级（爸爸 P0#3 同步推进）
 *  单 1: ¥1.70 — 教程，引入 元+角+分 混合 (¥1 + ¥0.5 + 2×¥0.1 = ¥1.70)
 *  单 2: ¥3.40 — 中等，多组合
 *  单 3: ¥6.80 — 期末难度，4-7 元间混合大额
 */
export const BANK_ORDERS: BankOrder[] = [
  // 单 1: 教程 — ¥1.70 引入混合面额
  {
    index: 1,
    customerEmoji: "🧓",
    customerLine: "你好啊小掌柜，我有 ¥1.70，能帮我换些零钱吗？",
    targetCent: 170, // ¥1.7
    poolCoins: [
      { coin: C1, count: 3 },
      { coin: C05, count: 4 },
      { coin: C01, count: 12 },
    ],
    hint: "¥1.70 = 1 元 + 7 角；可以 1×¥1 + 1×¥0.5 + 2×¥0.1, 或 17×¥0.1",
  },
  // 单 2: 中等 — ¥3.40 多组合
  {
    index: 2,
    customerEmoji: "👨‍🌾",
    customerLine: "我卖了一筐胡萝卜赚了 ¥3.40，麻烦换些零钱。",
    targetCent: 340, // ¥3.4
    poolCoins: [
      { coin: C1, count: 4 },
      { coin: C05, count: 5 },
      { coin: C01, count: 12 },
    ],
    hint: "¥3.40 = 3 元 + 4 角；可以 3×¥1 + 4×¥0.1, 或 2×¥1 + 2×¥0.5 + 4×¥0.1",
  },
  // 单 3: 期末难度 — ¥6.80 大额混合
  {
    index: 3,
    customerEmoji: "🧑‍🍳",
    customerLine: "今天面馆的收入是 ¥6.80，能换成零钱吗？",
    targetCent: 680, // ¥6.8
    poolCoins: [
      { coin: C1, count: 7 },
      { coin: C05, count: 6 },
      { coin: C01, count: 15 },
    ],
    hint: "¥6.80 = 6 元 + 8 角；想想 6×¥1 + 8×¥0.1, 或 5×¥1 + 3×¥0.5 + 3×¥0.1",
  },
];
