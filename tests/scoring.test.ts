import { describe, expect, it } from "vitest";
import { comboMultiplier, levelFromXp, scoreAttempt } from "../src/core/scoring";
import type { Question } from "../src/core/types";

const baseQ: Question = {
  question_id: "Q1",
  version: 1,
  status: "approved",
  grade: 4,
  term: "下册",
  unit_id: "G4B_U3_DECIMAL_MULTIPLY",
  skill_id: "decimal_price_quantity",
  ability_dimension: ["modeling", "calculation"],
  exam_priority: "MUST_BIG",
  game_type: "decimal_shop",
  cognitive_level: "application",
  difficulty: 3,
  estimated_time_seconds: 60,
  stem: "test",
  question_format: "numeric",
  answer: { type: "number", value: 22.8 },
  solution_steps: ["..."],
  common_errors: [
    { tag: "a", error: "e", remediation: "r" },
    { tag: "b", error: "e", remediation: "r" },
  ],
  feedback_correct: "good",
  feedback_wrong: "再试试",
};

describe("scoring", () => {
  it("不点提示答对拿满分；提示越多扣越多", () => {
    const full = scoreAttempt({ question: baseQ, isCorrect: true, hintsOpened: 0, elapsedSeconds: 30, isReview: false, comboAfter: 1 });
    const one = scoreAttempt({ question: baseQ, isCorrect: true, hintsOpened: 1, elapsedSeconds: 30, isReview: false, comboAfter: 1 });
    const two = scoreAttempt({ question: baseQ, isCorrect: true, hintsOpened: 2, elapsedSeconds: 30, isReview: false, comboAfter: 1 });
    expect(full.total).toBeGreaterThan(one.total);
    expect(one.total).toBeGreaterThan(two.total);
    expect(one.hintPenalty).toBe(-1);
    expect(two.hintPenalty).toBe(-2);
  });

  it("连击倍率生效", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(3)).toBeCloseTo(1.2);
    expect(comboMultiplier(5)).toBeCloseTo(1.5);
    expect(comboMultiplier(10)).toBeCloseTo(2.0);
    const noCombo = scoreAttempt({ question: baseQ, isCorrect: true, hintsOpened: 0, elapsedSeconds: 30, isReview: false, comboAfter: 1 });
    const withCombo5 = scoreAttempt({ question: baseQ, isCorrect: true, hintsOpened: 0, elapsedSeconds: 30, isReview: false, comboAfter: 5 });
    expect(withCombo5.total).toBeGreaterThan(noCombo.total);
  });

  it("答错仍给至少 1 分尝试分（保底）", () => {
    const wrong = scoreAttempt({ question: baseQ, isCorrect: false, hintsOpened: 0, elapsedSeconds: 120, isReview: false, comboAfter: 0 });
    expect(wrong.total).toBeGreaterThanOrEqual(1);
  });

  it("超时不扣分：超时答对只是没有速度奖励", () => {
    const inTime = scoreAttempt({ question: baseQ, isCorrect: true, hintsOpened: 0, elapsedSeconds: 30, isReview: false, comboAfter: 1 });
    const outTime = scoreAttempt({ question: baseQ, isCorrect: true, hintsOpened: 0, elapsedSeconds: 500, isReview: false, comboAfter: 1 });
    expect(outTime.total).toBeLessThanOrEqual(inTime.total);
    expect(outTime.total).toBeGreaterThanOrEqual(1);
  });

  it("等级计算", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(499)).toBe(1);
    expect(levelFromXp(500)).toBe(2);
    expect(levelFromXp(1500)).toBe(4);
  });
});
