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

  it("v0.34.98 iter 32 P0-0a: 答错保底 ≥ 1, 答得稳 (ratio 1.5-4.0, difficulty ≥ 2) → 深思 +5", () => {
    const wrong = scoreAttempt({ question: baseQ, isCorrect: false, hintsOpened: 0, elapsedSeconds: 500, isReview: false, comboAfter: 0 });
    expect(wrong.total).toBeGreaterThanOrEqual(1);
    // est=60, elapsed=120 → ratio=2.0 ∈ [1.5, 4.0], difficulty=3 ≥ 2 → +5
    const inTime = scoreAttempt({ question: baseQ, isCorrect: true, hintsOpened: 0, elapsedSeconds: 30, isReview: false, comboAfter: 1 });
    const deepThink = scoreAttempt({ question: baseQ, isCorrect: true, hintsOpened: 0, elapsedSeconds: 120, isReview: false, comboAfter: 1 });
    expect(deepThink.timeBonus).toBe(5);
    expect(deepThink.slowThink).toBe(true);
    expect(deepThink.total).toBeGreaterThanOrEqual(inTime.total);
  });

  it("v0.34.98 iter 32 P0-0a: 答得太快 (ratio<0.4) tooFast=true, 不奖", () => {
    // est=60, elapsed=10 → ratio=0.167 < 0.4
    const fast = scoreAttempt({ question: baseQ, isCorrect: true, hintsOpened: 0, elapsedSeconds: 10, isReview: false, comboAfter: 1 });
    expect(fast.timeBonus).toBe(0);
    expect(fast.tooFast).toBe(true);
    expect(fast.slowThink).toBe(false);
  });

  it("v0.34.98 post-review: ratio > 4.0 → AFK, 不奖发呆刷分", () => {
    // est=60, elapsed=300 → ratio=5.0 > 4.0
    const afk = scoreAttempt({ question: baseQ, isCorrect: true, hintsOpened: 0, elapsedSeconds: 300, isReview: false, comboAfter: 1 });
    expect(afk.timeBonus).toBe(0);
    expect(afk.slowThink).toBe(false);
    expect(afk.tooFast).toBe(false);
  });

  it("v0.34.98 post-review: 简单 speed-eligible 题 (stem 'test', difficulty=1) 走老 speedBonus 路径", () => {
    // 简单 speed-eligible 题保留老 +5/+3/+2 — 爸爸明示 "简单速算还是要奖".
    // 这里验证: difficulty=1 + stem 简单 → isSpeedEligible=true → 用老 speedBonus → ratio=2.0 → -1 slow
    const easyQ = { ...baseQ, difficulty: 1 as const };
    const easySlow = scoreAttempt({ question: easyQ, isCorrect: true, hintsOpened: 0, elapsedSeconds: 120, isReview: false, comboAfter: 1 });
    // 老 speedBonus: ratio=2.0 > 1.5 → -1 (slow)
    expect(easySlow.timeBonus).toBe(-1);
    expect(easySlow.slowThink).toBe(false);
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

  // v0.30.7: tutor-assisted 答对 / 2nd attempt 的计分规则
  describe("v0.30.7 tutor-assisted + attemptOrdinal", () => {
    const baseInput = {
      question: baseQ,
      isCorrect: true as const,
      hintsOpened: 0,
      elapsedSeconds: 30,
      isReview: false,
      comboAfter: 5,
    };

    it("tutor-assisted 答对 = 0.7 base，无 combo 倍率，无速度奖励", () => {
      const independent = scoreAttempt({ ...baseInput });
      const tutorCorrect = scoreAttempt({ ...baseInput, usedTutor: true });
      expect(tutorCorrect.total).toBeLessThan(independent.total);
      expect(tutorCorrect.comboMul).toBe(1);
      expect(tutorCorrect.timeBonus).toBe(0);
    });

    it("tutor-assisted 不享受新 skill 奖励（防讲题刷新 skill 解锁）", () => {
      const r = scoreAttempt({ ...baseInput, usedTutor: true, isNewSkill: true });
      expect(r.newSkillBonus).toBe(0);
    });

    it("attemptOrdinal=2 (自己重做) 不享受 combo / 速度奖励", () => {
      const ordinal1 = scoreAttempt({ ...baseInput });
      const ordinal2 = scoreAttempt({ ...baseInput, attemptOrdinal: 2 });
      expect(ordinal2.comboMul).toBe(1);
      expect(ordinal2.timeBonus).toBe(0);
      expect(ordinal2.total).toBeLessThan(ordinal1.total);
    });

    it("attemptOrdinal=2 + usedTutor (讲题后做对) 比 ordinal=2 alone 还少", () => {
      const selfRetry = scoreAttempt({ ...baseInput, attemptOrdinal: 2, usedTutor: false });
      const tutorRetry = scoreAttempt({ ...baseInput, attemptOrdinal: 2, usedTutor: true });
      expect(tutorRetry.total).toBeLessThan(selfRetry.total);
    });

    it("错答时 usedTutor 不影响计分（错就是错）", () => {
      const wrongTutor = scoreAttempt({ ...baseInput, isCorrect: false, usedTutor: true });
      const wrongNoTutor = scoreAttempt({ ...baseInput, isCorrect: false, usedTutor: false });
      expect(wrongTutor.total).toBe(wrongNoTutor.total);
    });

    it("tutor-assisted 重复刷题被 repeatDecay 进一步削减（防刷讲题）", () => {
      // 第 1 次 tutor-correct: 0.7 × decay 1.0 = 0.7×base （v0.30.9 改 0.5）
      // 第 5 次 tutor-correct: 0.5 × decay 0 = 0
      const first = scoreAttempt({ ...baseInput, usedTutor: true, priorCorrectCount: 0 });
      const fifth = scoreAttempt({ ...baseInput, usedTutor: true, priorCorrectCount: 4 });
      expect(first.total).toBeGreaterThan(fifth.total);
      expect(fifth.total).toBe(0);
    });
  });

  // v0.30.12: 姊妹题刷分护栏
  describe("v0.30.12 sibling decay (防姊妹题刷分)", () => {
    const baseInput = {
      question: baseQ,
      isCorrect: true as const,
      hintsOpened: 0,
      elapsedSeconds: 30,
      isReview: false,
      comboAfter: 1,
    };

    it("学习期 (skillCorrectCount 0-7) 拿满 sibling 倍率", () => {
      const r1 = scoreAttempt({ ...baseInput, skillCorrectCount: 0 });
      const r7 = scoreAttempt({ ...baseInput, skillCorrectCount: 7 });
      expect(r1.total).toBe(r7.total); // 都是 1.0×
    });

    it("巩固期 (8-14) sibling 倍率 0.7，比学习期低", () => {
      const learn = scoreAttempt({ ...baseInput, skillCorrectCount: 5 });
      const consolidate = scoreAttempt({ ...baseInput, skillCorrectCount: 10 });
      expect(consolidate.total).toBeLessThan(learn.total);
    });

    it("熟练期 (15-22) sibling 倍率 0.4，更低", () => {
      const consolidate = scoreAttempt({ ...baseInput, skillCorrectCount: 10 });
      const proficient = scoreAttempt({ ...baseInput, skillCorrectCount: 18 });
      expect(proficient.total).toBeLessThan(consolidate.total);
    });

    it("深度饱和期 (23+) sibling 倍率 0.2，最低（仍非零给练手奖励）", () => {
      const proficient = scoreAttempt({ ...baseInput, skillCorrectCount: 20 });
      const saturated = scoreAttempt({ ...baseInput, skillCorrectCount: 50 });
      expect(saturated.total).toBeLessThan(proficient.total);
      expect(saturated.total).toBeGreaterThan(0); // 不归零，给最低 0.2 鼓励
    });

    it("错答时 sibling decay 不生效（错答本来就只 0.2× base）", () => {
      const r0 = scoreAttempt({ ...baseInput, isCorrect: false, skillCorrectCount: 0 });
      const r50 = scoreAttempt({ ...baseInput, isCorrect: false, skillCorrectCount: 50 });
      expect(r0.total).toBe(r50.total);
    });
  });
});
