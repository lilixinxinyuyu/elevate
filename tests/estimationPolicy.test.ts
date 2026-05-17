import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DAILY_CAP,
  ESTIMATION_XP,
  MAGNITUDE_LABEL,
  dailyCapReached,
  detectMainOperator,
  extractNumbers,
  generateAcceptableRounds,
  getDailyCount,
  incrementDailyCount,
  isAcceptableRound,
  isComputeConsistent,
  magnitudeBucket,
  magnitudeChoicesAround,
  requiresEstimation,
  requiresEstimationByHeuristic,
} from "../src/core/estimationPolicy";
import type { Question } from "../src/core/types";

const base: Question = {
  question_id: "Q",
  version: 1,
  status: "approved",
  grade: 4,
  term: "下册",
  unit_id: "U",
  skill_id: "s",
  ability_dimension: ["calculation"],
  exam_priority: "NORMAL",
  game_type: "speed_calc",
  cognitive_level: "procedural",
  difficulty: 3,
  estimated_time_seconds: 60,
  stem: "312 × 47 = ?",
  question_format: "numeric",
  answer: { type: "number", value: 14664 },
  solution_steps: ["..."],
  common_errors: [
    { tag: "a", error: "e", remediation: "r" },
    { tag: "b", error: "e", remediation: "r" },
  ],
  feedback_correct: "good",
  feedback_wrong: "再试",
};

// Note: tests run in node env (no window). isEstimationGateV1() returns true by default.
// daily cap uses localStorage which is undefined in node — falls back to "not reached", so heuristic works.

describe("estimationPolicy.magnitudeBucket", () => {
  it("分档", () => {
    expect(magnitudeBucket(0)).toBe("ones");
    expect(magnitudeBucket(5)).toBe("ones");
    expect(magnitudeBucket(50)).toBe("tens");
    expect(magnitudeBucket(500)).toBe("hundreds");
    expect(magnitudeBucket(5000)).toBe("thousands");
    expect(magnitudeBucket(50000)).toBe("tenThousands");
    expect(magnitudeBucket(500000)).toBe("hundredThousands");
    expect(magnitudeBucket(5000000)).toBe("millions");
  });
  it("有 label", () => {
    expect(MAGNITUDE_LABEL.tens).toBe("几十");
    expect(MAGNITUDE_LABEL.tenThousands).toBe("万级");
  });
});

describe("estimationPolicy.magnitudeChoicesAround", () => {
  it("围绕中心 ±1 档", () => {
    const c = magnitudeChoicesAround(15000); // tenThousands
    expect(c).toContain("thousands");
    expect(c).toContain("tenThousands");
    expect(c).toContain("hundredThousands");
  });
  it("post-review: 强制 inject actualMagnitude 保证正解可选", () => {
    // 用户估算 100 (hundreds), 但 actual 真答案 100万 (millions)
    const c = magnitudeChoicesAround(100, "millions");
    expect(c).toContain("millions");
    // 仍然保留估算附近窗口
    expect(c).toContain("hundreds");
  });
  it("post-review: actualMagnitude 已在窗口内 → 不重复 inject", () => {
    const c = magnitudeChoicesAround(15000, "tenThousands");
    const tenThousandsCount = c.filter((m) => m === "tenThousands").length;
    expect(tenThousandsCount).toBe(1);
  });
});

describe("estimationPolicy.generateAcceptableRounds", () => {
  it("个位不 round", () => {
    expect(generateAcceptableRounds(7)).toEqual([7]);
  });
  it("47 → 40 或 50", () => {
    const r = generateAcceptableRounds(47);
    expect(r).toContain(50);
    expect(r).toContain(40);
  });
  it("312 → 300 / 310 / 320", () => {
    const r = generateAcceptableRounds(312);
    expect(r).toContain(300);
    expect(r).toContain(310);
    expect(r).toContain(320);
  });
  it("不接受相对误差 > 15% 的", () => {
    const r = generateAcceptableRounds(312);
    expect(r).not.toContain(200); // 312 - 200 = 112 > 312*0.15=46.8
    expect(r).not.toContain(400);
  });
});

describe("estimationPolicy.isAcceptableRound", () => {
  it("47 接受 50 / 40, 拒 60 / 37", () => {
    expect(isAcceptableRound(47, 50)).toBe(true);
    expect(isAcceptableRound(47, 40)).toBe(true);
    expect(isAcceptableRound(47, 60)).toBe(false);
    expect(isAcceptableRound(47, 37)).toBe(false);
  });
});

describe("estimationPolicy.isComputeConsistent", () => {
  it("一致 ±5%", () => {
    expect(isComputeConsistent(300, 50, 15000, "×")).toBe(true);
    expect(isComputeConsistent(300, 50, 18000, "×")).toBe(false); // 差 3000 / 15000 = 20% 超出 ±5%
  });
  it("加法 OK", () => {
    expect(isComputeConsistent(300, 50, 350, "+")).toBe(true);
  });
  it("非数字 → false", () => {
    expect(isComputeConsistent(300, 50, NaN, "×")).toBe(false);
  });
});

describe("estimationPolicy.detectMainOperator", () => {
  it("识别乘", () => {
    expect(detectMainOperator("312 × 47")).toBe("×");
    expect(detectMainOperator("312 * 47")).toBe("×");
    expect(detectMainOperator("312 乘以 47")).toBe("×");
  });
  it("识别加", () => {
    expect(detectMainOperator("312 + 47")).toBe("+");
  });
  it("识别减", () => {
    expect(detectMainOperator("312 - 47")).toBe("-");
  });
  it("识别除", () => {
    expect(detectMainOperator("312 ÷ 47")).toBe("÷");
    expect(detectMainOperator("312 除以 47")).toBe("÷");
  });
  it("混合", () => {
    expect(detectMainOperator("312 × 47 + 8")).toBe("mixed");
  });
});

describe("estimationPolicy.extractNumbers", () => {
  it("整数 + 小数", () => {
    expect(extractNumbers("312 × 47 = ?")).toEqual([312, 47]);
    expect(extractNumbers("3.14 × 5 = ?")).toEqual([3.14, 5]);
  });
  it("最多 4 个", () => {
    expect(extractNumbers("1 2 3 4 5 6 7 8 9 10")).toHaveLength(4);
  });
});

describe("estimationPolicy.requiresEstimationByHeuristic", () => {
  it("简单 1 位 + - 不触发", () => {
    expect(requiresEstimationByHeuristic({ ...base, stem: "3+5=?", difficulty: 1 })).toBe(false);
  });
  it("3 位 × 触发", () => {
    expect(requiresEstimationByHeuristic(base)).toBe(true);
  });
  it("3 位 + 触发", () => {
    expect(requiresEstimationByHeuristic({ ...base, stem: "312 + 47 = ?" })).toBe(true);
  });
  it("3 位 - 不触发 (v1 排除)", () => {
    expect(requiresEstimationByHeuristic({ ...base, stem: "312 - 47 = ?" })).toBe(false);
  });
  it("3 位 ÷ 不触发 (v1 排除)", () => {
    expect(requiresEstimationByHeuristic({ ...base, stem: "312 ÷ 47 = ?" })).toBe(false);
  });
  it("应用题不触发", () => {
    expect(requiresEstimationByHeuristic({ ...base, stem: "小明买了 312 个苹果, 又买了 47 个, 一共多少?" })).toBe(false);
  });
  it("choice 答案不触发", () => {
    const q = { ...base, answer: { type: "choice" as const, value: "A" } };
    expect(requiresEstimationByHeuristic(q as Question)).toBe(false);
  });
});

describe("estimationPolicy.requiresEstimation (explicit override)", () => {
  it("explicit true + 支持的运算符 (×) 即使应用题也开", () => {
    const q: Question = {
      ...base,
      stem: "小明买了 312 箱苹果, 每箱 × 47 个, 一共多少?",
      requiresEstimation: true,
    };
    expect(requiresEstimation(q)).toBe(true);
  });
  it("explicit true + 不支持的运算符 (÷) → 仍然不触发 (post-review GPT)", () => {
    const q: Question = {
      ...base,
      stem: "312 ÷ 47 = ?",
      requiresEstimation: true,
    };
    expect(requiresEstimation(q)).toBe(false);
  });
  it("explicit false 即使 3 位也关", () => {
    expect(requiresEstimation({ ...base, requiresEstimation: false })).toBe(false);
  });
});

describe("estimationPolicy.XP", () => {
  it("总 +12 = Round(4) + Compute(4) + Magnitude(2) + AllPerfect(2)", () => {
    const total =
      ESTIMATION_XP.ROUND +
      ESTIMATION_XP.COMPUTE +
      ESTIMATION_XP.MAGNITUDE +
      ESTIMATION_XP.ALL_PERFECT_BONUS;
    expect(total).toBe(12);
  });
});

describe("estimationPolicy.dailyCapReached (node env safe)", () => {
  it("没 localStorage 时不阻断", () => {
    // node env has no localStorage → typeof window === undefined → returns false
    expect(dailyCapReached()).toBe(false);
    expect(getDailyCount()).toBe(0);
    expect(incrementDailyCount()).toBe(0);
  });
  it("DAILY_CAP 是 8", () => {
    expect(DAILY_CAP).toBe(8);
  });
});
