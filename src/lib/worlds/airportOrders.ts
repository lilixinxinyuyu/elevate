/**
 * v0.32.7: 登机口订单 —— 英语量词 + 复数训练 (G4 重点)。
 *
 * 玩法：旅客来登机，气泡说 "I have X backpacks and Y suitcases" (英文)，
 * 桌上摆 mixed 行李，Selena 把 X 个 backpack + Y 个 suitcase 拖到 cart。
 * 校验：每种行李数量精确匹配。
 *
 * 教育：练 plural -s (one bag → two bags) + 数字 + 简单 English item names。
 */

export type LuggageId = "backpack" | "suitcase" | "duffel";

export interface LuggageDef {
  id: LuggageId;
  emoji: string;
  english: string;
  englishPlural: string;
  zh: string;
}

export const LUGGAGE: Record<LuggageId, LuggageDef> = {
  backpack: { id: "backpack", emoji: "🎒", english: "backpack", englishPlural: "backpacks", zh: "背包" },
  suitcase: { id: "suitcase", emoji: "🧳", english: "suitcase", englishPlural: "suitcases", zh: "行李箱" },
  duffel: { id: "duffel", emoji: "👜", english: "duffel bag", englishPlural: "duffel bags", zh: "旅行袋" },
};

export interface AirportOrder {
  index: number;
  customerEmoji: string;
  /** 英语台词 + 中文 hint */
  customerLineEn: string;
  customerLineZh: string;
  /** 需要装载的行李数 */
  requests: { itemId: LuggageId; quantity: number }[];
  /** 桌上摆的总数（至少 ≥ requests），超量考验"精确数" */
  pool: { itemId: LuggageId; count: number }[];
  hint?: string;
}

/**
 * v0.32.45 (Ep21): airportOrders 难度升级（P0#3 同步推进）
 *  - 总件数从 1+1 / 3+2 / 2+1+1 升到 2+3 / 4+3 / 3+2+2 = 5/7/7 件
 *  - 单 1 教程引入 plural（之前单数误导）
 *  - 单 2 增量 mix 3 种
 *  - 单 3 全部用复数 + 7 件
 *  pool 多 1-2 件考验"精确数"
 */
export const AIRPORT_ORDERS: AirportOrder[] = [
  // 单 1: 教程 — 已经引入复数 2+3 = 5 件
  {
    index: 1,
    customerEmoji: "🧑‍✈️",
    customerLineEn: "Hi! I have 2 backpacks and 3 suitcases. Please load them up!",
    customerLineZh: "你好！我有 2 个背包和 3 个行李箱，请装上车～",
    requests: [
      { itemId: "backpack", quantity: 2 },
      { itemId: "suitcase", quantity: 3 },
    ],
    pool: [
      { itemId: "backpack", count: 4 },
      { itemId: "suitcase", count: 4 },
    ],
    hint: "backpacks / suitcases 都是复数（+s）；数清楚 2+3=5 件",
  },
  // 单 2: 3 种 mix 7 件
  {
    index: 2,
    customerEmoji: "👨‍👩‍👧",
    customerLineEn: "We have 4 backpacks, 2 suitcases and 1 duffel bag.",
    customerLineZh: "我们有 4 个背包、2 个行李箱和 1 个旅行袋。",
    requests: [
      { itemId: "backpack", quantity: 4 },
      { itemId: "suitcase", quantity: 2 },
      { itemId: "duffel", quantity: 1 },
    ],
    pool: [
      { itemId: "backpack", count: 5 },
      { itemId: "suitcase", count: 3 },
      { itemId: "duffel", count: 3 },
    ],
    hint: "duffel bag = 旅行袋（单数 1 个不加 -s）；总数 4+2+1=7 件",
  },
  // 单 3: 期末难度 — 3 种全复数 7 件
  {
    index: 3,
    customerEmoji: "👴",
    customerLineEn: "I need 3 duffel bags, 2 backpacks and 2 suitcases.",
    customerLineZh: "我要装 3 个旅行袋、2 个背包和 2 个行李箱。",
    requests: [
      { itemId: "duffel", quantity: 3 },
      { itemId: "backpack", quantity: 2 },
      { itemId: "suitcase", quantity: 2 },
    ],
    pool: [
      { itemId: "duffel", count: 4 },
      { itemId: "backpack", count: 3 },
      { itemId: "suitcase", count: 3 },
    ],
    hint: "3 种 全复数 +s（duffel bags / backpacks / suitcases）；总数 3+2+2=7 件",
  },
];
