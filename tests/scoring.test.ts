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

  describe("v7 重做递减", () => {
    const baseInput = {
      question: baseQ,
      isCorrect: true,
      hintsOpened: 0,
      elapsedSeconds: 30,
      isReview: false,
      comboAfter: 1,
    };

    it("第 1 次答对（priorCorrect=0）满分，无 decay", () => {
      const first = scoreAttempt({ ...baseInput, priorCorrectCount: 0 });
      expect(first.repeatDecay).toBe(1.0);
      expect(first.total).toBeGreaterThan(0);
    });

    it("第 2 次答对（priorCorrect=1）= 50%", () => {
      const first = scoreAttempt({ ...baseInput, priorCorrectCount: 0 });
      const second = scoreAttempt({ ...baseInput, priorCorrectCount: 1 });
      expect(second.repeatDecay).toBe(0.5);
      // ~ 一半（受 round 影响有 ±1 容差）
      expect(second.total).toBeGreaterThan(0);
      expect(second.total).toBeLessThanOrEqual(Math.round(first.total * 0.5) + 1);
    });

    it("第 3、4 次答对：20%、10%", () => {
      const r3 = scoreAttempt({ ...baseInput, priorCorrectCount: 2 });
      const r4 = scoreAttempt({ ...baseInput, priorCorrectCount: 3 });
      expect(r3.repeatDecay).toBeCloseTo(0.2);
      expect(r4.repeatDecay).toBeCloseTo(0.1);
      expect(r3.total).toBeGreaterThan(r4.total);
    });

    it("第 5 次以后完全不加分（0%）", () => {
      const r5 = scoreAttempt({ ...baseInput, priorCorrectCount: 4 });
      const r99 = scoreAttempt({ ...baseInput, priorCorrectCount: 99 });
      expect(r5.repeatDecay).toBe(0);
      expect(r5.total).toBe(0);
      expect(r99.total).toBe(0);
    });

    it("答错不应用 decay（错答仍是错答的小分）", () => {
      const wrong1 = scoreAttempt({ ...baseInput, isCorrect: false, priorCorrectCount: 0 });
      const wrong5 = scoreAttempt({ ...baseInput, isCorrect: false, priorCorrectCount: 5 });
      expect(wrong1.total).toBe(wrong5.total);
      expect(wrong1.repeatDecay).toBe(1.0);
    });

    it("新 skill 首次答对 +5 XP", () => {
      const r = scoreAttempt({ ...baseInput, isNewSkill: true });
      const noBonus = scoreAttempt({ ...baseInput, isNewSkill: false });
      expect(r.newSkillBonus).toBe(5);
      expect(noBonus.newSkillBonus).toBe(0);
      expect(r.total).toBe(noBonus.total + 5);
    });

    it("新 skill 不被 decay 削掉：第 5 次答对 +5 仍然加（即使 decay 让答题分变 0）", () => {
      // 不应该出现这种 case（已经答对 5 次了，肯定不是新 skill），
      // 但保险起见验证 decay 不会影响 newSkillBonus 加成
      const r = scoreAttempt({ ...baseInput, priorCorrectCount: 99, isNewSkill: true });
      expect(r.total).toBe(5);
    });

    it("一道题最多累计挤出 1.8 倍 base XP（4 次答对总和）", () => {
      const sum = [0, 1, 2, 3].reduce((acc, prior) => {
        const r = scoreAttempt({ ...baseInput, priorCorrectCount: prior });
        return acc + r.total;
      }, 0);
      const single = scoreAttempt({ ...baseInput, priorCorrectCount: 0 }).total;
      // 1 + 0.5 + 0.2 + 0.1 = 1.8
      expect(sum / single).toBeCloseTo(1.8, 1);
    });
  });
});
