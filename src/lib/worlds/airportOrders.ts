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

export const AIRPORT_ORDERS: AirportOrder[] = [
  // 单 1: 教程 — 简单数 1 + 1
  {
    index: 1,
    customerEmoji: "🧑‍✈️",
    customerLineEn: "Hello! I have 1 backpack and 1 suitcase. Help me load them~",
    customerLineZh: "你好！我有 1 个背包和 1 个行李箱，请帮我装上车～",
    requests: [
      { itemId: "backpack", quantity: 1 },
      { itemId: "suitcase", quantity: 1 },
    ],
    pool: [
      { itemId: "backpack", count: 2 },
      { itemId: "suitcase", count: 2 },
    ],
    hint: "听清楚说要几个 backpack（背包） 和 suitcase（行李箱）",
  },
  // 单 2: 复数 — 3 个 backpacks + 2 个 suitcases
  {
    index: 2,
    customerEmoji: "👨‍👩‍👧",
    customerLineEn: "We have 3 backpacks and 2 suitcases, please.",
    customerLineZh: "我们有 3 个背包和 2 个行李箱，请装一下～",
    requests: [
      { itemId: "backpack", quantity: 3 },
      { itemId: "suitcase", quantity: 2 },
    ],
    pool: [
      { itemId: "backpack", count: 4 },
      { itemId: "suitcase", count: 3 },
    ],
    hint: "backpacks (复数 +s) 表示多个；数清楚再装",
  },
  // 单 3: 引入第三种 + 更多数量
  {
    index: 3,
    customerEmoji: "👴",
    customerLineEn: "I need 2 duffel bags, 1 backpack and 1 suitcase.",
    customerLineZh: "我要装 2 个旅行袋、1 个背包和 1 个行李箱。",
    requests: [
      { itemId: "duffel", quantity: 2 },
      { itemId: "backpack", quantity: 1 },
      { itemId: "suitcase", quantity: 1 },
    ],
    pool: [
      { itemId: "duffel", count: 3 },
      { itemId: "backpack", count: 2 },
      { itemId: "suitcase", count: 2 },
    ],
    hint: "duffel bag = 旅行袋。3 种各装 N 个",
  },
];
