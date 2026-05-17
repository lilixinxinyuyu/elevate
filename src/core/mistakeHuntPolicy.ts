/**
 * v0.35.2 (iter 36 P1-1): 改错挑战 — mistake hunt mini-game.
 *
 * 起源: Selena 43% master plan P1-1. 训练"校验答案"元认知.
 * 跟小学数学课本 "改错题" 对齐 — 给学生一道做完的题, 让她找出第一处错.
 *
 * v1 题型 (review 共识):
 *   A. Vertical (竖式) — 程序生成 + 定向突变
 *   C. Unit conversion — 固定题池, 10 进制 vs 60 进制混淆
 *
 * 题型 B (应用题) defer 到 v2 (review 共识 — 判定歧义大).
 */

export type BugType =
  | "carry_missed"
  | "partial_product_shift"
  | "sum_wrong"
  | "unit_decimal_confused"
  | "unit_sexagesimal_confused";

export interface BugCard {
  /** 渲染类型 */
  kind: "vertical" | "unit_conversion";
  /** 题面 (e.g., "312 × 47 = ?") */
  expression: string;
  /** 显示行 — 每行是一段渲染文本 */
  lines: string[];
  /** 哪一行是错的 (0-indexed). UI 只判定这一行点中. */
  buggyLineIdx: number;
  /** Bug 类型 (用于命中后的解释) */
  bugType: BugType;
  /** 错误数 / 内容 */
  wrongText: string;
  /** 正确数 / 内容 */
  correctText: string;
  /** 一句话解释 (例: "加和漏进位了") */
  explanation: string;
  /** 提示 (按 💡 时显示) */
  hint: string;
}

/* ──────────────────── 竖式找错 ──────────────────── */

/**
 * 生成 3 位 × 1 位 竖式 + 一处错.
 * 例: 312 × 7 = 2184 (正常 1 步, 不容易出错)
 */
function genVerticalMultiplySimple(a: number, b: number, rng: () => number): BugCard {
  const correct = a * b;
  // 故意 +/- 10-30 (模拟进位错)
  const delta = (Math.floor(rng() * 4) + 1) * 10;
  const wrong = rng() < 0.5 ? correct - delta : correct + delta;
  return {
    kind: "vertical",
    expression: `${a} × ${b} = ?`,
    lines: [
      `  ${String(a).padStart(4, " ")}`,
      `× ${String(b).padStart(4, " ")}`,
      `------`,
      `  ${String(wrong).padStart(4, " ")}`,
    ],
    buggyLineIdx: 3,
    bugType: "sum_wrong",
    wrongText: String(wrong),
    correctText: String(correct),
    explanation: `${a} × ${b} = ${correct}, 不是 ${wrong}`,
    hint: "把竖式从右往左算一遍, 注意进位",
  };
}

/**
 * 生成 3 位 × 2 位 竖式 + 一处错 (3 种突变之一).
 */
function genVerticalMultiplyTwoDigit(a: number, b: number, rng: () => number): BugCard {
  const b1 = b % 10;
  const b2 = Math.floor(b / 10);
  const p1 = a * b1;
  const p2 = a * b2 * 10;
  const sum = p1 + p2;

  // 选一种突变:
  const which = Math.floor(rng() * 3);
  if (which === 0) {
    // sum_wrong: 加和错
    const delta = (Math.floor(rng() * 5) + 1) * 100;
    const wrongSum = rng() < 0.5 ? sum - delta : sum + delta;
    return {
      kind: "vertical",
      expression: `${a} × ${b} = ?`,
      lines: [
        `  ${String(a).padStart(6, " ")}`,
        `× ${String(b).padStart(6, " ")}`,
        `--------`,
        `  ${String(p1).padStart(6, " ")}`,
        ` ${String(p2 / 10).padStart(6, " ")} `,
        `--------`,
        `  ${String(wrongSum).padStart(6, " ")}`,
      ],
      buggyLineIdx: 6,
      bugType: "sum_wrong",
      wrongText: String(wrongSum),
      correctText: String(sum),
      explanation: `${p1} + ${p2} = ${sum}, 不是 ${wrongSum}. 加和漏进位了`,
      hint: "把最后那行加和重算一遍",
    };
  } else if (which === 1) {
    // partial_product_shift: 第二个部分积错位 (本来应该写在十位, 写到个位了)
    return {
      kind: "vertical",
      expression: `${a} × ${b} = ?`,
      lines: [
        `  ${String(a).padStart(6, " ")}`,
        `× ${String(b).padStart(6, " ")}`,
        `--------`,
        `  ${String(p1).padStart(6, " ")}`,
        `  ${String(p2 / 10).padStart(6, " ")}`, // 没空一格
        `--------`,
        `  ${String(p1 + (p2 / 10)).padStart(6, " ")}`,
      ],
      buggyLineIdx: 4,
      bugType: "partial_product_shift",
      wrongText: `${p2 / 10} (没空一格)`,
      correctText: `${p2 / 10} (左空一格 = ${p2})`,
      explanation: `第二行是 ${a} × ${b2} 个十 = ${p2}, 要左空一格`,
      hint: "看第二个部分积有没有左空一格",
    };
  } else {
    // 第一行部分积错 (carry_missed): 312 × 7 算错
    const wrongP1 = p1 - 10;
    const wrongSum2 = wrongP1 + p2;
    return {
      kind: "vertical",
      expression: `${a} × ${b} = ?`,
      lines: [
        `  ${String(a).padStart(6, " ")}`,
        `× ${String(b).padStart(6, " ")}`,
        `--------`,
        `  ${String(wrongP1).padStart(6, " ")}`,
        ` ${String(p2 / 10).padStart(6, " ")} `,
        `--------`,
        `  ${String(wrongSum2).padStart(6, " ")}`,
      ],
      buggyLineIdx: 3,
      bugType: "carry_missed",
      wrongText: String(wrongP1),
      correctText: String(p1),
      explanation: `${a} × ${b1} = ${p1}, 不是 ${wrongP1}. 漏了进位`,
      hint: `先算 ${a} × ${b1}, 注意进位`,
    };
  }
}

export function genVerticalBug(rng: () => number = Math.random): BugCard {
  // 60% 2 位数 × 2 位数 (更难, 更接近真题), 40% 3 位 × 1 位 (热身)
  if (rng() < 0.6) {
    const a = 100 + Math.floor(rng() * 900); // 100-999
    const b = 10 + Math.floor(rng() * 90);   // 10-99
    return genVerticalMultiplyTwoDigit(a, b, rng);
  } else {
    const a = 100 + Math.floor(rng() * 900);
    const b = 2 + Math.floor(rng() * 8);     // 2-9
    return genVerticalMultiplySimple(a, b, rng);
  }
}

/* ──────────────────── 单位换算找错 ──────────────────── */

interface UnitEntry {
  conversion: string;   // 比如 "2 小时 = 120 分钟"
  isWrong: boolean;
  correctValue?: string;
  bugType?: "unit_decimal_confused" | "unit_sexagesimal_confused";
}

const UNIT_POOL: Array<{ correct: UnitEntry; wrong: UnitEntry; explanation: string; hint: string }> = [
  {
    correct: { conversion: "1 千克 = 1000 克", isWrong: false },
    wrong: { conversion: "1 千克 = 100 克", isWrong: true, correctValue: "1000", bugType: "unit_decimal_confused" },
    explanation: "1 千克 = 1000 克 (千 = 1000), 不是 100",
    hint: "千 = 1000, 像千米和米的关系",
  },
  {
    correct: { conversion: "1 小时 = 60 分钟", isWrong: false },
    wrong: { conversion: "1 小时 = 100 分钟", isWrong: true, correctValue: "60", bugType: "unit_sexagesimal_confused" },
    explanation: "时间是 60 进制! 1 小时 = 60 分钟, 不是 100",
    hint: "时间是 60 进制, 不是 10 进制",
  },
  {
    correct: { conversion: "1 元 = 10 角", isWrong: false },
    wrong: { conversion: "1 元 = 100 角", isWrong: true, correctValue: "10", bugType: "unit_decimal_confused" },
    explanation: "1 元 = 10 角, 不是 100 (1 角 = 10 分)",
    hint: "钱: 元/角/分 是 10 进制",
  },
  {
    correct: { conversion: "1 米 = 100 厘米", isWrong: false },
    wrong: { conversion: "1 米 = 10 厘米", isWrong: true, correctValue: "100", bugType: "unit_decimal_confused" },
    explanation: "1 米 = 100 厘米 (1 米 = 10 分米 = 100 厘米)",
    hint: "米 → 分米 → 厘米, 每级 10 倍",
  },
  {
    correct: { conversion: "1 分钟 = 60 秒", isWrong: false },
    wrong: { conversion: "1 分钟 = 100 秒", isWrong: true, correctValue: "60", bugType: "unit_sexagesimal_confused" },
    explanation: "时间 60 进制, 1 分钟 = 60 秒",
    hint: "时间里的分和秒也是 60 进制",
  },
  {
    correct: { conversion: "1 千米 = 1000 米", isWrong: false },
    wrong: { conversion: "1 千米 = 100 米", isWrong: true, correctValue: "1000", bugType: "unit_decimal_confused" },
    explanation: "千 = 1000, 不论是千克还是千米",
    hint: "千 = 1000",
  },
  {
    correct: { conversion: "1 吨 = 1000 千克", isWrong: false },
    wrong: { conversion: "1 吨 = 100 千克", isWrong: true, correctValue: "1000", bugType: "unit_decimal_confused" },
    explanation: "重量大单位: 1 吨 = 1000 千克",
    hint: "吨 → 千克, 1000 倍",
  },
  {
    correct: { conversion: "1 升 = 1000 毫升", isWrong: false },
    wrong: { conversion: "1 升 = 100 毫升", isWrong: true, correctValue: "1000", bugType: "unit_decimal_confused" },
    explanation: "容积: 1 升 = 1000 毫升 ('毫'就是 1/1000)",
    hint: "毫 = 1/1000, 跟 mm/mL 一样",
  },
  {
    correct: { conversion: "1 厘米 = 10 毫米", isWrong: false },
    wrong: { conversion: "1 厘米 = 100 毫米", isWrong: true, correctValue: "10", bugType: "unit_decimal_confused" },
    explanation: "1 厘米 = 10 毫米 (厘米→毫米是 10 倍, 不是 100)",
    hint: "厘米 → 毫米 只差一级, 10 倍",
  },
  {
    correct: { conversion: "1 天 = 24 小时", isWrong: false },
    wrong: { conversion: "1 天 = 60 小时", isWrong: true, correctValue: "24", bugType: "unit_sexagesimal_confused" },
    explanation: "1 天 = 24 小时 (12/24 制), 不是 60",
    hint: "一天 24 小时",
  },
];

/**
 * 单位换算 bug — 从 pool 中抽 3 条正确 + 1 条错误 (混排).
 */
export function genUnitConversionBug(rng: () => number = Math.random): BugCard {
  // 抽 4 个 unique entry
  const indices = [...Array(UNIT_POOL.length).keys()];
  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
  const picked = indices.slice(0, 4).map((i) => UNIT_POOL[i]!);

  // 一个用 wrong 版本, 其它 3 个 correct
  const buggyPos = Math.floor(rng() * 4);
  const lines: string[] = [];
  let buggyEntry: typeof picked[0] | null = null;
  for (let i = 0; i < 4; i++) {
    const p = picked[i]!;
    if (i === buggyPos) {
      lines.push(p.wrong.conversion);
      buggyEntry = p;
    } else {
      lines.push(p.correct.conversion);
    }
  }

  if (!buggyEntry) throw new Error("no buggy entry");

  return {
    kind: "unit_conversion",
    expression: "下面 4 条换算, 哪一条错了?",
    lines,
    buggyLineIdx: buggyPos,
    bugType: buggyEntry.wrong.bugType ?? "unit_decimal_confused",
    wrongText: buggyEntry.wrong.conversion,
    correctText: `${buggyEntry.wrong.conversion.split("=")[0]}= ${buggyEntry.wrong.correctValue}`,
    explanation: buggyEntry.explanation,
    hint: buggyEntry.hint,
  };
}

/* ──────────────────── Session 生成 ──────────────────── */

/**
 * 生成 5 题 session: 3 个 vertical + 2 个 unit_conversion (review 共识比例).
 */
export function generateSession(rng: () => number = Math.random): BugCard[] {
  const cards: BugCard[] = [];
  for (let i = 0; i < 3; i++) cards.push(genVerticalBug(rng));
  for (let i = 0; i < 2; i++) cards.push(genUnitConversionBug(rng));
  // Shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return cards;
}

/* ──────────────────── XP 公式 ──────────────────── */

/**
 * XP 公式 (review 共识: 不倒扣, 递减奖励).
 * @param attempts 已尝试次数 (1 = 第 1 次点对; 2 = 第 1 次错 + 第 2 次对; ...)
 * @param hintUsed 是否用了提示
 */
export function calcXp(attempts: number, hintUsed: boolean): number {
  let base: number;
  if (attempts === 1) base = 15;
  else if (attempts === 2) base = 10;
  else if (attempts === 3) base = 5;
  else base = 0;
  if (hintUsed) base = Math.max(0, base - 2);
  return base;
}
