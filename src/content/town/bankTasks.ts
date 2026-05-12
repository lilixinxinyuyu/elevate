/**
 * 银行的客户任务生成器 —— 客户走到柜台，给一个小数找零 / 凑总额任务。
 *
 * 设计：
 *  - 客户描述："我要存 ¥X.XX" 或 "我应付 ¥A，给了 ¥B，找零是多少？"
 *  - 玩家从钱币堆里拖钱币到托盘，托盘累加显示
 *  - 累加 == 目标 → 客户离开 + 加灵感
 *  - 不是 "选择题"，是 "凑出来"
 *
 * 数学技能：小数加法 / 找零 / 单位换算
 */

export type CoinValue = 0.05 | 0.1 | 0.5 | 1 | 5 | 10;

export const COIN_VALUES: CoinValue[] = [10, 5, 1, 0.5, 0.1, 0.05];

export const COIN_LABEL: Record<CoinValue, string> = {
  10: "¥10",
  5: "¥5",
  1: "¥1",
  0.5: "5角",
  0.1: "1角",
  0.05: "5分",
};

export const COIN_COLOR: Record<CoinValue, string> = {
  10: "#fbbf24", // 金
  5: "#a78bfa", // 紫
  1: "#fde047", // 黄
  0.5: "#fb923c", // 橙
  0.1: "#f87171", // 红
  0.05: "#94a3b8", // 银
};

export interface BankTask {
  kind: "deposit" | "change";
  target: number; // 目标金额（元，2 位小数精度）
  customer: string; // 客户头像 emoji
  question: string; // 客户对玩家说的话
  /** 出题用的随机种子（保证回放一致） */
  seed: number;
}

/**
 * 随机生成一个银行任务。难度 1-3 影响目标金额的复杂度。
 *  - 1：整数 + 角 (e.g. 3.5, 7.2)
 *  - 2：完整小数 (e.g. 6.85, 12.40)
 *  - 3：包含 5 分细节 (e.g. 4.65, 11.15)
 */
export function genBankTask(difficulty: 1 | 2 | 3 = 2): BankTask {
  const customers = ["🧑‍🌾", "👩‍🦱", "🧓", "👨‍🏫", "👩‍🚀", "🧑‍🎨", "👴", "👵"];
  const customer = customers[Math.floor(Math.random() * customers.length)]!;

  // 生成目标
  let target: number;
  if (difficulty === 1) {
    // 1-15 范围，0.x 是 0/2/5/7
    const whole = 1 + Math.floor(Math.random() * 14);
    const decimal = [0, 0.2, 0.5, 0.7][Math.floor(Math.random() * 4)]!;
    target = whole + decimal;
  } else if (difficulty === 2) {
    // 2-30，0.x 任意角分
    const whole = 2 + Math.floor(Math.random() * 29);
    const tenths = Math.floor(Math.random() * 10) / 10;
    const cents = [0, 0.05][Math.floor(Math.random() * 2)]!;
    target = whole + tenths + cents;
  } else {
    // 5-40，含 5 分
    const whole = 5 + Math.floor(Math.random() * 36);
    const tenths = Math.floor(Math.random() * 10) / 10;
    const cents = Math.floor(Math.random() * 2) * 0.05;
    target = whole + tenths + cents;
  }
  // 保留两位小数避免浮点漂移
  target = Math.round(target * 100) / 100;

  const kind: "deposit" | "change" = Math.random() < 0.6 ? "deposit" : "change";
  let question: string;
  if (kind === "deposit") {
    question = `我要存 ¥${target.toFixed(2)}`;
  } else {
    // 找零：给一个 paid 比 target 大的整数
    const paid = Math.ceil(target / 5) * 5; // 整 5 元的倍数
    const change = Math.round((paid - target) * 100) / 100;
    target = change;
    question = `我应付 ¥${(paid - change).toFixed(2)}，给了 ¥${paid}，请帮我找 ¥${change.toFixed(2)} 零钱`;
  }
  return {
    kind,
    target,
    customer,
    question,
    seed: Math.floor(Math.random() * 100000),
  };
}

/** 给目标金额拆出一个"标准最优"拆解（贪心）。仅用于展示提示。 */
export function greedySplit(target: number): Map<CoinValue, number> {
  const result = new Map<CoinValue, number>();
  let rem = Math.round(target * 100); // 整分
  for (const v of COIN_VALUES) {
    const cents = Math.round(v * 100);
    const count = Math.floor(rem / cents);
    if (count > 0) {
      result.set(v, count);
      rem -= count * cents;
    }
  }
  return result;
}
