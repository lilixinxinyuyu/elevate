import { describe, expect, it } from "vitest";
import {
  MENTAL_QUOTA_PER_DAY,
  canUseMentalCalc,
  getMentalCalcRemaining,
  isMeaningfulScratch,
  requiresScratch,
  requiresScratchByHeuristic,
  useMentalCalcQuota,
} from "../src/core/scratchPolicy";
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
  stem: "312 - 47 = ?", // 用减法 (estimation 不触发, scratch 应触发)
  question_format: "numeric",
  answer: { type: "number", value: 265 },
  solution_steps: ["..."],
  common_errors: [
    { tag: "a", error: "e", remediation: "r" },
    { tag: "b", error: "e", remediation: "r" },
  ],
  feedback_correct: "good",
  feedback_wrong: "再试",
};

describe("scratchPolicy.requiresScratchByHeuristic", () => {
  it("3 位减法 → 触发 (因 difficulty=3, estimation 不触发减法)", () => {
    expect(requiresScratchByHeuristic(base)).toBe(true);
  });
  it("1+2 简单 → 不触发", () => {
    expect(requiresScratchByHeuristic({ ...base, stem: "1+2=?", difficulty: 1 })).toBe(false);
  });
  it("difficulty ≥ 3 → 触发", () => {
    expect(requiresScratchByHeuristic({ ...base, stem: "5+5=?", difficulty: 3 })).toBe(true);
  });
  it("应用题 → 触发", () => {
    expect(requiresScratchByHeuristic({ ...base, stem: "小明买了苹果再买", difficulty: 2 })).toBe(true);
  });
  it("跟 EstimationGate 互斥 (3 位 × → estimation 触发 → scratch 不触发)", () => {
    const q: Question = { ...base, stem: "312 × 47 = ?", difficulty: 2 };
    // estimation triggers (3+ digit × OR +), so scratch should NOT trigger
    expect(requiresScratchByHeuristic(q)).toBe(false);
  });
  it("choice 答案 → 不触发", () => {
    const q = { ...base, answer: { type: "choice" as const, value: "A" } };
    expect(requiresScratchByHeuristic(q as Question)).toBe(false);
  });
});

describe("scratchPolicy.requiresScratch (explicit override)", () => {
  it("explicit true 强制开", () => {
    expect(requiresScratch({ ...base, requiresScratch: true })).toBe(true);
  });
  it("explicit false 强制关", () => {
    expect(requiresScratch({ ...base, requiresScratch: false })).toBe(false);
  });
});

describe("scratchPolicy.isMeaningfulScratch", () => {
  it("空 → false", () => {
    expect(isMeaningfulScratch("")).toBe(false);
    expect(isMeaningfulScratch("   ")).toBe(false);
  });
  it("太短 (≤ 2 char) → false", () => {
    expect(isMeaningfulScratch("12")).toBe(false);
    expect(isMeaningfulScratch("ab")).toBe(false);
  });
  it("3+ char 但没数字/运算符 → false", () => {
    expect(isMeaningfulScratch("abc")).toBe(false);
    expect(isMeaningfulScratch("hello")).toBe(false);
  });
  it("3+ char 且有数字 → true", () => {
    expect(isMeaningfulScratch("312")).toBe(true);
    expect(isMeaningfulScratch("12+5")).toBe(true);
  });
  it("竖式 → true", () => {
    expect(isMeaningfulScratch("  312\n× 47\n----")).toBe(true);
  });
});

describe("scratchPolicy.MENTAL_QUOTA_PER_DAY", () => {
  it("默认 3", () => {
    expect(MENTAL_QUOTA_PER_DAY).toBe(3);
  });
  it("node env 默认 remaining = 3 (无 localStorage)", () => {
    expect(getMentalCalcRemaining()).toBe(3);
    expect(canUseMentalCalc()).toBe(true);
  });
  it("useMentalCalcQuota 在 node env 不会 crash", () => {
    expect(() => useMentalCalcQuota()).not.toThrow();
  });
});
