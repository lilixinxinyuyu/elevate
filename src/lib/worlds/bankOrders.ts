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

export const BANK_ORDERS: BankOrder[] = [
  // 单 1: 基础 — 1 元换成 1 角（10 个）
  {
    index: 1,
    customerEmoji: "🧓",
    customerLine: "你好啊小掌柜，我有 ¥1，能帮我换零吗？",
    targetCent: 100, // ¥1
    poolCoins: [
      { coin: C01, count: 12 }, // 1 角 × 12（够 10 个，多 2 个）
    ],
    hint: "1 元 = 10 个 1 角，把 ¥0.1 拖到托盘里凑齐 ¥1.00",
  },
  // 单 2: 复合 — 2 元换零（可以多种 valid 组合）
  {
    index: 2,
    customerEmoji: "👨‍🌾",
    customerLine: "我卖了一筐胡萝卜赚了 ¥2，麻烦换些零钱。",
    targetCent: 200, // ¥2
    poolCoins: [
      { coin: C1, count: 2 },
      { coin: C05, count: 4 },
      { coin: C01, count: 10 },
    ],
    hint: "凑齐 ¥2.00 — 可以用 2 个 ¥1, 或 4 个 ¥0.5, 或它们的组合",
  },
  // 单 3: 复杂 — 3.5 元换零
  {
    index: 3,
    customerEmoji: "🧑‍🍳",
    customerLine: "今天面馆的收入是 ¥3.50，能换成零钱吗？",
    targetCent: 350, // ¥3.5
    poolCoins: [
      { coin: C1, count: 3 },
      { coin: C05, count: 4 },
      { coin: C01, count: 10 },
    ],
    hint: "¥3.50 = 3 元 + 5 角，想想怎么拼？",
  },
];
