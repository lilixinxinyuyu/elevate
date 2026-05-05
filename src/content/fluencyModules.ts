/**
 * Fluency 模块定义 — 每个模块是一个题目生成器。
 *
 * 核心约定：
 *   - 模块**不绑 unit**，跨学期通用
 *   - 内容按 grade 数组过滤（G3 只看 5×5；G4 看 9×9）
 *   - 干扰项手工设计（贴近常见错误），不靠 AI
 *
 * Phase 2 doc: docs/phase2-plan.md (Axis 3)
 */

import type { FluencyModule, FluencyProblem } from "../core/fluencyTypes";

// ---------------------------------------------------------------------------
// 干扰项工具：根据 correct 生成 N 个不重复的合理错答
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/** 乘法干扰项：常见错误是 ±a / ±b / 邻近 product / 进位丢失 */
function distractorsForMul(a: number, b: number, n = 3): number[] {
  const correct = a * b;
  const candidates = new Set<number>();
  // 偏一格的乘积（最常见儿童错误）
  candidates.add(a * (b + 1));
  candidates.add(a * (b - 1));
  candidates.add((a + 1) * b);
  candidates.add((a - 1) * b);
  // ±十位（进位错）
  candidates.add(correct + 10);
  candidates.add(correct - 10);
  // ±1
  candidates.add(correct + 1);
  candidates.add(correct - 1);
  // ±9（对调数字）
  candidates.add(correct + 9);
  candidates.add(correct - 9);
  const valid = [...candidates].filter((x) => x > 0 && x !== correct);
  return shuffle(valid).slice(0, n);
}

/** 加减法干扰项 */
function distractorsForAddSub(correct: number, n = 3): number[] {
  const candidates = new Set<number>();
  for (const d of [1, 2, 9, 10, 11, -1, -2, -9, -10, -11]) {
    candidates.add(correct + d);
  }
  const valid = [...candidates].filter((x) => x >= 0 && x !== correct);
  return shuffle(valid).slice(0, n);
}

// ---------------------------------------------------------------------------
// 模块：9×9 乘法口诀
// ---------------------------------------------------------------------------

const mulTable9: FluencyModule = {
  id: "mul_table_9",
  name: "9×9 乘法口诀",
  shortLabel: "×9",
  description: "1-9 全表 81 题随机抽，目标 1.5 秒/题。",
  category: "multiplication",
  grades: [3, 4, 5, 6],
  themeColor: "from-amber-500 to-orange-500",
  icon: "✖️",
  generate: (): FluencyProblem => {
    const a = 1 + Math.floor(Math.random() * 9);
    const b = 1 + Math.floor(Math.random() * 9);
    return {
      key: `${a}x${b}`,
      stem: `${a} × ${b}`,
      correctAnswer: a * b,
      distractors: distractorsForMul(a, b),
    };
  },
  masteryThreshold: { p50LatencyMs: 1800, accuracy: 0.95, minAttempts: 100 },
};

// ---------------------------------------------------------------------------
// 模块：5×5 乘法口诀（G3 起步）
// ---------------------------------------------------------------------------

const mulTable5: FluencyModule = {
  id: "mul_table_5",
  name: "5×5 乘法口诀",
  shortLabel: "×5",
  description: "1-5 全表 25 题随机抽，乘法启蒙。",
  category: "multiplication",
  grades: [2, 3],
  themeColor: "from-yellow-400 to-amber-500",
  icon: "✖️",
  generate: (): FluencyProblem => {
    const a = 1 + Math.floor(Math.random() * 5);
    const b = 1 + Math.floor(Math.random() * 5);
    return {
      key: `${a}x${b}`,
      stem: `${a} × ${b}`,
      correctAnswer: a * b,
      distractors: distractorsForMul(a, b),
    };
  },
  masteryThreshold: { p50LatencyMs: 2000, accuracy: 0.95, minAttempts: 50 },
};

// ---------------------------------------------------------------------------
// 模块：20 以内加法
// ---------------------------------------------------------------------------

const addWithin20: FluencyModule = {
  id: "add_within_20",
  name: "20 以内加法",
  shortLabel: "+20",
  description: "和 ≤ 20 的两数加法（如 8 + 7），凑十法练习。",
  category: "addition",
  grades: [1, 2, 3, 4],
  themeColor: "from-emerald-500 to-teal-500",
  icon: "➕",
  generate: (): FluencyProblem => {
    const a = 1 + Math.floor(Math.random() * 19);
    const b = 1 + Math.floor(Math.random() * (20 - a));
    return {
      key: `${a}+${b}`,
      stem: `${a} + ${b}`,
      correctAnswer: a + b,
      distractors: distractorsForAddSub(a + b),
    };
  },
  masteryThreshold: { p50LatencyMs: 1500, accuracy: 0.95, minAttempts: 80 },
};

// ---------------------------------------------------------------------------
// 模块：20 以内减法
// ---------------------------------------------------------------------------

const subWithin20: FluencyModule = {
  id: "sub_within_20",
  name: "20 以内减法",
  shortLabel: "−20",
  description: "被减数 ≤ 20 的两数减法（如 15 − 8），破十法练习。",
  category: "subtraction",
  grades: [1, 2, 3, 4],
  themeColor: "from-rose-500 to-pink-500",
  icon: "➖",
  generate: (): FluencyProblem => {
    const a = 2 + Math.floor(Math.random() * 19); // 2-20
    const b = 1 + Math.floor(Math.random() * a); // 1..a
    return {
      key: `${a}-${b}`,
      stem: `${a} − ${b}`,
      correctAnswer: a - b,
      distractors: distractorsForAddSub(a - b),
    };
  },
  masteryThreshold: { p50LatencyMs: 1500, accuracy: 0.95, minAttempts: 80 },
};

// ---------------------------------------------------------------------------
// 模块：100 以内加减口算简便（凑整）
// ---------------------------------------------------------------------------

const addSubSimplify100: FluencyModule = {
  id: "add_sub_simplify_100",
  name: "100 内凑整速算",
  shortLabel: "凑整",
  description: "如 25 + 75、48 + 52、100 − 37，凑整意识训练。",
  category: "mixed",
  grades: [3, 4, 5],
  themeColor: "from-indigo-500 to-violet-500",
  icon: "🎯",
  generate: (): FluencyProblem => {
    // 三种 pattern: a + (100-a) / a + b 凑十 / 100 - x
    const pattern = Math.floor(Math.random() * 3);
    let stem: string;
    let key: string;
    let correct: number;
    if (pattern === 0) {
      // a + (100-a)
      const a = 11 + Math.floor(Math.random() * 78); // 11-88
      stem = `${a} + ${100 - a}`;
      key = `${a}+${100 - a}`;
      correct = 100;
    } else if (pattern === 1) {
      // a + b 凑十（个位互补）
      const tensA = 1 + Math.floor(Math.random() * 8);
      const onesA = 1 + Math.floor(Math.random() * 9);
      const tensB = 1 + Math.floor(Math.random() * (9 - tensA));
      const onesB = 10 - onesA;
      const a = tensA * 10 + onesA;
      const b = tensB * 10 + onesB;
      stem = `${a} + ${b}`;
      key = `${a}+${b}`;
      correct = a + b;
    } else {
      // 100 - x
      const x = 11 + Math.floor(Math.random() * 78);
      stem = `100 − ${x}`;
      key = `100-${x}`;
      correct = 100 - x;
    }
    return { key, stem, correctAnswer: correct, distractors: distractorsForAddSub(correct) };
  },
  masteryThreshold: { p50LatencyMs: 2500, accuracy: 0.9, minAttempts: 60 },
};

// ---------------------------------------------------------------------------
// 总注册表
// ---------------------------------------------------------------------------

export const FLUENCY_MODULES: FluencyModule[] = [
  mulTable5,
  mulTable9,
  addWithin20,
  subWithin20,
  addSubSimplify100,
];

export function getFluencyModule(id: string): FluencyModule | null {
  return FLUENCY_MODULES.find((m) => m.id === id) ?? null;
}

/** 按 grade 过滤可用模块（学生 grade 在 module.grades 数组里就显示） */
export function getModulesForGrade(grade: number): FluencyModule[] {
  return FLUENCY_MODULES.filter((m) => m.grades.includes(grade));
}
