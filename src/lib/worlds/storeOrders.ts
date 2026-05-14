/**
 * v0.32.3: 和平小卖部订单数据 + 校验逻辑。
 *
 * 设计原则（peer-review GPT-5.5）：
 *  - 所有金额用 **分 (cent)** 整数存储和计算，禁用 float（0.1+0.2=0.30000000004 灾难）
 *  - 显示时除以 100 转 ¥X.XX
 *  - Sprint 1 MVP: 3 单 cycle (教程 / 含 0.5 / 含 0.1+乘法)
 *  - 完成 3 单 → +1 装饰碎片 + 跳回百宝港地图
 *
 * 商品 emoji 用 KayKit food_ingredient_X 替代（更美）。
 */

/** 商品定义 */
export interface StoreItem {
  /** 内部 id */
  id: string;
  /** emoji 显示 */
  emoji: string;
  /** 名称 */
  name: string;
  /** 单价 (cent) */
  priceCent: number;
  /** KayKit GLTF 路径 */
  gltf: string;
}

const KAY_RB = "/env/kaykit/restaurant";

export const STORE_ITEMS: Record<string, StoreItem> = {
  carrot: {
    id: "carrot",
    emoji: "🥕",
    name: "胡萝卜",
    priceCent: 50, // ¥0.5
    gltf: `${KAY_RB}/food_ingredient_carrot.gltf`,
  },
  tomato: {
    id: "tomato",
    emoji: "🍅",
    name: "番茄",
    priceCent: 150, // ¥1.5
    gltf: `${KAY_RB}/food_ingredient_tomato.gltf`,
  },
  bun: {
    id: "bun",
    emoji: "🍞",
    name: "面包",
    priceCent: 120, // ¥1.2
    gltf: `${KAY_RB}/food_ingredient_bun.gltf`,
  },
  cheese: {
    id: "cheese",
    emoji: "🧀",
    name: "奶酪",
    priceCent: 200, // ¥2.0
    gltf: `${KAY_RB}/food_ingredient_cheese.gltf`,
  },
  potato: {
    id: "potato",
    emoji: "🥔",
    name: "土豆",
    priceCent: 80, // ¥0.8
    gltf: `${KAY_RB}/food_ingredient_potato.gltf`,
  },
  onion: {
    id: "onion",
    emoji: "🧅",
    name: "洋葱",
    priceCent: 70, // ¥0.7
    gltf: `${KAY_RB}/food_ingredient_onion.gltf`,
  },
};

/** 钱币面额定义（cent） */
export interface Coin {
  /** 面额 cent */
  valueCent: number;
  /** 显示文本 */
  label: string;
  /** 颜色（金/银/铜） */
  color: string;
  /** 半径 */
  radius: number;
}

export const COINS: Coin[] = [
  { valueCent: 100, label: "¥1", color: "#fbbf24", radius: 0.13 }, // 金
  { valueCent: 50, label: "¥0.5", color: "#cbd5e1", radius: 0.115 }, // 银
  { valueCent: 10, label: "¥0.1", color: "#b45309", radius: 0.1 }, // 铜
];

/** 单个商品需求 */
export interface OrderRequest {
  itemId: string;
  quantity: number;
}

/** 订单定义 */
export interface Order {
  /** 题号 */
  index: number;
  /** 客户气泡台词 */
  customerLine: string;
  /** 顾客 emoji */
  customerEmoji: string;
  /** 需要的商品 */
  requests: OrderRequest[];
  /** 顾客付款金额 cent (玩家要找零的来源) */
  paidCent: number;
  /** 教学提示（可选） */
  hint?: string;
}

/**
 * v0.32.44 (Ep20)：3 单难度梯度大幅提升（爸爸 P0#3 "幼儿园难度"）
 *  单 1: 2 件同类商品（教程，建立"单价 × 数量 + 找零"流程，¥0.5 × 2 = ¥1.0）
 *  单 2: 3 件不同商品（多件相加，G4B 小数加法）
 *  单 3: 5-6 件含奶酪 (¥2)，杂项总价 + 找零（接近期中题目）
 *
 * 价格不变（保持 STORE_ITEMS 模型/coin 兼容）：
 *  carrot ¥0.5 / tomato ¥1.5 / bun ¥1.2 / cheese ¥2.0 / potato ¥0.8 / onion ¥0.7
 */
export const ORDERS: Order[] = [
  // 单 1: 教程 — 2 件同类（单价 × 数量，¥0.5 × 2 = ¥1）
  {
    index: 1,
    customerEmoji: "🧑",
    customerLine: "你好！我要 2 个 🥕 胡萝卜，给你 ¥2",
    requests: [{ itemId: "carrot", quantity: 2 }],
    paidCent: 200,
    hint: "拖商品到扫码篮，应付 ¥0.5×2 = ¥1.0；找零 ¥2.0 - ¥1.0 = ¥1.0",
  },
  // 单 2: 3 件不同（小数加法 + 找零，期中难度）
  {
    index: 2,
    customerEmoji: "👩",
    customerLine: "我要 1 个 🍅 番茄、1 个 🥔 土豆 和 1 个 🧅 洋葱，给你 ¥5",
    requests: [
      { itemId: "tomato", quantity: 1 },
      { itemId: "potato", quantity: 1 },
      { itemId: "onion", quantity: 1 },
    ],
    paidCent: 500,
    hint: "应付 ¥1.5 + ¥0.8 + ¥0.7 = ¥3.0；找零 ¥5.0 - ¥3.0 = ¥2.0",
  },
  // 单 3: 6 件 mixed 含奶酪（小数加法 + 单价 × 数量 + 找零，期末难度）
  {
    index: 3,
    customerEmoji: "👨",
    customerLine: "请给我 2 个 🍞 面包、1 个 🧀 奶酪 和 3 个 🥕 胡萝卜，给你 ¥10",
    requests: [
      { itemId: "bun", quantity: 2 },
      { itemId: "cheese", quantity: 1 },
      { itemId: "carrot", quantity: 3 },
    ],
    paidCent: 1000,
    hint: "应付 ¥1.2×2 + ¥2.0 + ¥0.5×3 = ¥2.4 + ¥2.0 + ¥1.5 = ¥5.9；找零 ¥10.0 - ¥5.9 = ¥4.1",
  },
];

/** 计算订单应付总价 (cent) */
export function calcOrderTotalCent(order: Order): number {
  let total = 0;
  for (const req of order.requests) {
    const item = STORE_ITEMS[req.itemId];
    if (item) total += item.priceCent * req.quantity;
  }
  return total;
}

/** 计算订单应找零 (cent) */
export function calcOrderChangeCent(order: Order): number {
  return order.paidCent - calcOrderTotalCent(order);
}

/** 格式化 cent → ¥X.XX */
export function formatYuan(cent: number): string {
  const sign = cent < 0 ? "-" : "";
  const abs = Math.abs(cent);
  const yuan = Math.floor(abs / 100);
  const fen = abs % 100;
  return `${sign}¥${yuan}.${String(fen).padStart(2, "0")}`;
}
