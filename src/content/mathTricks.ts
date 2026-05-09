/**
 * 巧算工具箱 v1（v0.31.71）：四年级 Selena 适用的核心心算技巧。
 *
 * 这些不算"教材内容"——是数学基本功层面的"快算/验算/估算"加速器。
 * 期中冲刺前给她一套 ~6-8 个核心 trick，每个都有：
 *  - 直觉（为什么管用）
 *  - 1-2 个 worked example
 *  - 3-5 道动手 practice（输入答案即时反馈）
 *
 * 后续可以做"巧算 trophy"系列、"巧算挑战赛"模式，先把内容铺好。
 */

export interface TrickStep {
  /** 这一步 visualize 的式子，比如 "99 + 47 = (100 - 1) + 47" */
  expr: string;
  /** 这一步在做什么的注解（中文一句话） */
  note?: string;
}

export interface TrickExample {
  /** 题面，比如 "99 + 47 = ?" */
  problem: string;
  /** 一步步推导，让 Selena 看明白思路 */
  steps: TrickStep[];
  /** 最终答案 */
  answer: string;
}

export interface TrickPractice {
  /** 题面，比如 "98 + 56 = ?" */
  question: string;
  /** 答案（数字字符串，方便比对） */
  answer: string;
  /** 一句话提示（在 Selena 卡住时弹） */
  hint: string;
}

export interface MathTrick {
  id: string;
  name: string;
  emoji: string;
  /** 一句话主标语 */
  tagline: string;
  /** 适用场景 */
  whenToUse: string;
  /** 核心原理（直觉解释） */
  principle: string;
  /** 1-2 个 worked example */
  examples: TrickExample[];
  /** 3-5 道动手练习 */
  practice: TrickPractice[];
}

export const MATH_TRICKS: MathTrick[] = [
  // ─────────────────────────────────────────────────────────
  {
    id: "round-up",
    name: "凑整法",
    emoji: "🎯",
    tagline: "看到 99、98 就先凑成 100",
    whenToUse: "加减法时遇到 9、99、999 这样接近整十整百的数",
    principle: "把接近整数的部分先看成整数，最后再补回差额。99=100-1，999=1000-1。",
    examples: [
      {
        problem: "99 + 47 = ?",
        steps: [
          { expr: "99 + 47", note: "99 离 100 只差 1" },
          { expr: "= (100 - 1) + 47", note: "把 99 拆成 100 - 1" },
          { expr: "= 100 + 47 - 1", note: "重新组合" },
          { expr: "= 147 - 1" },
          { expr: "= 146" },
        ],
        answer: "146",
      },
      {
        problem: "156 - 99 = ?",
        steps: [
          { expr: "156 - 99", note: "减 99 等于减 100 再加 1" },
          { expr: "= 156 - 100 + 1" },
          { expr: "= 56 + 1" },
          { expr: "= 57" },
        ],
        answer: "57",
      },
    ],
    practice: [
      { question: "98 + 56 = ?", answer: "154", hint: "98 = 100 - 2，先加 100 再减 2" },
      { question: "245 - 99 = ?", answer: "146", hint: "减 99 = 减 100 + 1" },
      { question: "199 + 86 = ?", answer: "285", hint: "199 = 200 - 1" },
      { question: "300 - 198 = ?", answer: "102", hint: "减 198 = 减 200 + 2" },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: "split-add",
    name: "拆分加减",
    emoji: "🧩",
    tagline: "把数拆成整十 + 个位，分别算",
    whenToUse: "算两位数加减，没接近整十时",
    principle: "27 + 38 = (20+30) + (7+8) = 50 + 15 = 65。先算高位，再算低位，最后合。",
    examples: [
      {
        problem: "27 + 38 = ?",
        steps: [
          { expr: "27 + 38" },
          { expr: "= (20 + 30) + (7 + 8)", note: "拆成十位和个位" },
          { expr: "= 50 + 15" },
          { expr: "= 65" },
        ],
        answer: "65",
      },
      {
        problem: "63 - 28 = ?",
        steps: [
          { expr: "63 - 28" },
          { expr: "= 63 - 20 - 8", note: "先减整十 20" },
          { expr: "= 43 - 8", note: "再减个位 8" },
          { expr: "= 35" },
        ],
        answer: "35",
      },
    ],
    practice: [
      { question: "46 + 37 = ?", answer: "83", hint: "(40+30)+(6+7)" },
      { question: "85 - 29 = ?", answer: "56", hint: "85-20-9 = 65-9" },
      { question: "58 + 64 = ?", answer: "122", hint: "(50+60)+(8+4) = 110+12" },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: "split-divide",
    name: "拆分再合并（除法）",
    emoji: "🪓",
    tagline: "150÷2 = 140÷2 + 10÷2",
    whenToUse: "除法不好心算时，把被除数拆成「两个能整除的部分」",
    principle: "150 = 140 + 10，140÷2=70，10÷2=5，合起来 75。让每一段都好算。",
    examples: [
      {
        problem: "150 ÷ 2 = ?",
        steps: [
          { expr: "150 ÷ 2", note: "150 不直接算，先拆" },
          { expr: "= (140 + 10) ÷ 2", note: "140 是 2 的倍数（70），10 也好除" },
          { expr: "= 140 ÷ 2 + 10 ÷ 2" },
          { expr: "= 70 + 5" },
          { expr: "= 75" },
        ],
        answer: "75",
      },
      {
        problem: "168 ÷ 4 = ?",
        steps: [
          { expr: "168 ÷ 4" },
          { expr: "= (160 + 8) ÷ 4", note: "160÷4=40，8÷4=2，都好算" },
          { expr: "= 40 + 2" },
          { expr: "= 42" },
        ],
        answer: "42",
      },
    ],
    practice: [
      { question: "180 ÷ 3 = ?", answer: "60", hint: "180 = 180，直接 18÷3=6 → 60" },
      { question: "126 ÷ 6 = ?", answer: "21", hint: "(120+6)÷6 = 20+1" },
      { question: "232 ÷ 4 = ?", answer: "58", hint: "(200+32)÷4 = 50+8" },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: "borrow-ten",
    name: "借十法",
    emoji: "🪙",
    tagline: "13-7 → 13-3-4，分两步减",
    whenToUse: "退位减法、个位不够减时",
    principle: "13-7 个位不够减，就先减到 10，再用 10 减剩下的部分：13-3=10，10-7+3=...实际是 13-7=13-3-4=6。",
    examples: [
      {
        problem: "14 - 7 = ?",
        steps: [
          { expr: "14 - 7", note: "4 减 7 不够" },
          { expr: "= 14 - 4 - 3", note: "先减 4 凑到 10" },
          { expr: "= 10 - 3" },
          { expr: "= 7" },
        ],
        answer: "7",
      },
      {
        problem: "53 - 28 = ?",
        steps: [
          { expr: "53 - 28" },
          { expr: "= 53 - 20 - 8", note: "先减整十" },
          { expr: "= 33 - 8" },
          { expr: "= 33 - 3 - 5", note: "再借十" },
          { expr: "= 30 - 5" },
          { expr: "= 25" },
        ],
        answer: "25",
      },
    ],
    practice: [
      { question: "12 - 8 = ?", answer: "4", hint: "12-2-6 = 10-6" },
      { question: "31 - 17 = ?", answer: "14", hint: "31-10-7 = 21-1-6" },
      { question: "42 - 26 = ?", answer: "16", hint: "42-20-6 = 22-6 = 22-2-4" },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: "x25-shortcut",
    name: "×25 快算",
    emoji: "⚡",
    tagline: "×25 = ×100 ÷ 4",
    whenToUse: "看到 ×25、×125、×50 这种特殊数",
    principle: "因为 25 = 100÷4，所以 24×25 = 24×100÷4 = 2400÷4 = 600。同理 ×125 = ×1000÷8。",
    examples: [
      {
        problem: "24 × 25 = ?",
        steps: [
          { expr: "24 × 25" },
          { expr: "= 24 × 100 ÷ 4", note: "25 = 100÷4" },
          { expr: "= 2400 ÷ 4" },
          { expr: "= 600" },
        ],
        answer: "600",
      },
      {
        problem: "8 × 125 = ?",
        steps: [
          { expr: "8 × 125", note: "125 = 1000÷8" },
          { expr: "= 8 × 1000 ÷ 8" },
          { expr: "= 8000 ÷ 8" },
          { expr: "= 1000" },
        ],
        answer: "1000",
      },
    ],
    practice: [
      { question: "16 × 25 = ?", answer: "400", hint: "16×100÷4 = 1600÷4" },
      { question: "12 × 25 = ?", answer: "300", hint: "1200÷4" },
      { question: "32 × 125 = ?", answer: "4000", hint: "32×1000÷8 = 32000÷8" },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: "halve-double",
    name: "折半乘倍",
    emoji: "⚖️",
    tagline: "×5 → 折半再 ×10",
    whenToUse: "×5、×50、×500 时",
    principle: "因为 5 = 10÷2，所以 24×5 = 24÷2×10 = 12×10 = 120。先除以 2 再补 0，比直接 ×5 容易。",
    examples: [
      {
        problem: "24 × 5 = ?",
        steps: [
          { expr: "24 × 5" },
          { expr: "= 24 ÷ 2 × 10", note: "5 = 10÷2" },
          { expr: "= 12 × 10" },
          { expr: "= 120" },
        ],
        answer: "120",
      },
      {
        problem: "36 × 50 = ?",
        steps: [
          { expr: "36 × 50" },
          { expr: "= 36 ÷ 2 × 100", note: "50 = 100÷2" },
          { expr: "= 18 × 100" },
          { expr: "= 1800" },
        ],
        answer: "1800",
      },
    ],
    practice: [
      { question: "16 × 5 = ?", answer: "80", hint: "8 × 10" },
      { question: "48 × 5 = ?", answer: "240", hint: "24 × 10" },
      { question: "26 × 50 = ?", answer: "1300", hint: "13 × 100" },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: "x9-x11",
    name: "×9 / ×11 巧算",
    emoji: "🪞",
    tagline: "×9 = ×10 - 自己；×11 = ×10 + 自己",
    whenToUse: "乘 9 或 11 时",
    principle: "17×9 = 17×(10-1) = 170-17 = 153。17×11 = 17×(10+1) = 170+17 = 187。把 9 和 11 看成「10 旁边」。",
    examples: [
      {
        problem: "17 × 9 = ?",
        steps: [
          { expr: "17 × 9" },
          { expr: "= 17 × (10 - 1)" },
          { expr: "= 170 - 17" },
          { expr: "= 153" },
        ],
        answer: "153",
      },
      {
        problem: "23 × 11 = ?",
        steps: [
          { expr: "23 × 11" },
          { expr: "= 23 × (10 + 1)" },
          { expr: "= 230 + 23" },
          { expr: "= 253" },
        ],
        answer: "253",
      },
    ],
    practice: [
      { question: "25 × 9 = ?", answer: "225", hint: "250 - 25" },
      { question: "36 × 11 = ?", answer: "396", hint: "360 + 36" },
      { question: "48 × 9 = ?", answer: "432", hint: "480 - 48" },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: "pair-sum",
    name: "配对求和",
    emoji: "🤝",
    tagline: "1+2+…+10 = (1+10)×10÷2",
    whenToUse: "等差数列求和（连续整数、连续偶数等）",
    principle: "首尾配对：1+10=11，2+9=11，3+8=11…一共 5 对，每对都是 11。所以 5×11=55。公式：(首+末)×个数÷2。",
    examples: [
      {
        problem: "1 + 2 + 3 + … + 10 = ?",
        steps: [
          { expr: "1+2+3+…+10", note: "首=1, 末=10, 共 10 个数" },
          { expr: "= (1+10) × 10 ÷ 2" },
          { expr: "= 11 × 10 ÷ 2" },
          { expr: "= 110 ÷ 2" },
          { expr: "= 55" },
        ],
        answer: "55",
      },
      {
        problem: "2 + 4 + 6 + 8 + 10 = ?",
        steps: [
          { expr: "2+4+6+8+10", note: "等差数列，首=2，末=10，共 5 个" },
          { expr: "= (2+10) × 5 ÷ 2" },
          { expr: "= 12 × 5 ÷ 2" },
          { expr: "= 60 ÷ 2" },
          { expr: "= 30" },
        ],
        answer: "30",
      },
    ],
    practice: [
      { question: "1 + 2 + 3 + … + 20 = ?", answer: "210", hint: "(1+20)×20÷2 = 21×10" },
      { question: "5 + 10 + 15 + 20 + 25 = ?", answer: "75", hint: "(5+25)×5÷2 = 30×5÷2" },
      { question: "1 + 3 + 5 + 7 + 9 = ?", answer: "25", hint: "(1+9)×5÷2 = 10×5÷2" },
    ],
  },
];
