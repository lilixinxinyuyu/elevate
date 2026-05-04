import { describe, expect, it } from "vitest";
import {
  applyAttempt,
  backfillFromAttempts,
  clampMastery,
  computeMasteryScore,
  questionEloByDifficulty,
  STUDENT_ELO_BASE,
  updateMastery,
  updateStudentElo,
} from "../src/core/mastery";
import type { MasteryScore } from "../src/core/types";

const NOW = Date.UTC(2026, 4, 4); // 2026-05-04

function emptyMastery(skillId = "test_skill"): MasteryScore {
  return {
    id: `s1::${skillId}`,
    studentId: "s1",
    subjectId: "math",
    skillId,
    score: 0,
    attemptsCount: 0,
    correctCount: 0,
    updatedAt: NOW,
  };
}

describe("mastery — 工具函数", () => {
  it("clampMastery 始终在 0-100 之间", () => {
    expect(clampMastery(-10)).toBe(0);
    expect(clampMastery(150)).toBe(100);
    expect(clampMastery(42)).toBe(42);
  });

  it("questionEloByDifficulty: 1-5 → 1100-1900", () => {
    expect(questionEloByDifficulty(1)).toBe(1100);
    expect(questionEloByDifficulty(3)).toBe(1500);
    expect(questionEloByDifficulty(5)).toBe(1900);
    expect(questionEloByDifficulty(undefined)).toBe(1500); // 默认中等
  });
});

describe("mastery — Elo 更新", () => {
  it("答对难题：Elo 涨得多", () => {
    const newElo = updateStudentElo(1200, 1700, true);
    expect(newElo).toBeGreaterThan(1200);
    // 难题 P(对) ≈ 0.06，K=24 → +22
    expect(newElo - 1200).toBeGreaterThan(15);
  });

  it("答对简单题：Elo 几乎不涨", () => {
    const newElo = updateStudentElo(1700, 1100, true);
    expect(newElo - 1700).toBeLessThan(5);
  });

  it("答错简单题：Elo 跌得多", () => {
    const newElo = updateStudentElo(1700, 1100, false);
    expect(newElo).toBeLessThan(1700);
    expect(1700 - newElo).toBeGreaterThan(15);
  });

  it("答错难题：Elo 几乎不跌", () => {
    const newElo = updateStudentElo(1200, 1900, false);
    expect(1200 - newElo).toBeLessThan(5);
  });
});

describe("mastery — applyAttempt 增量", () => {
  it("第一次答题：score 基本为 0（数据不足惩罚）", () => {
    const r = applyAttempt(
      null,
      { questionId: "q1", difficulty: 3, isCorrect: true, ts: NOW },
      NOW,
    );
    expect(r.next.attemptsCount).toBe(1);
    expect(r.next.studentElo).toBeGreaterThan(STUDENT_ELO_BASE);
    // 1 题 / 5 = 20% 惩罚 + 多样性 1/4 → 不会到 50
    expect(r.next.score).toBeLessThan(40);
  });

  it("5 题全对（不同题面）：分数显著上升", () => {
    let prior: MasteryScore | null = null;
    for (let i = 1; i <= 5; i++) {
      const r = applyAttempt(
        prior,
        { questionId: `q${i}`, difficulty: 3, isCorrect: true, ts: NOW + i * 1000 },
        NOW + i * 1000,
      );
      prior = { ...emptyMastery(), ...r.next };
    }
    expect(prior!.score).toBeGreaterThan(40);
    // 但 Elo 还没爬到精通水平
    expect(prior!.score).toBeLessThan(80);
  });

  it("难题反复答对：Elo 推到精通水平 → 高分", () => {
    let prior: MasteryScore | null = null;
    for (let i = 1; i <= 20; i++) {
      const r = applyAttempt(
        prior,
        {
          questionId: `q${(i % 8) + 1}`, // 8 种不同题面，多样性满
          difficulty: 5,
          isCorrect: true,
          ts: NOW + i * 86_400_000, // 每天 1 题，不会被时间衰减
        },
        NOW + 20 * 86_400_000,
      );
      prior = { ...emptyMastery(), ...r.next };
    }
    expect(prior!.studentElo).toBeGreaterThan(1600);
    expect(prior!.score).toBeGreaterThan(75); // 至少"熟练"
  });

  it("简单题反复答对：分数到不了精通", () => {
    let prior: MasteryScore | null = null;
    for (let i = 1; i <= 30; i++) {
      const r = applyAttempt(
        prior,
        {
          questionId: `q${(i % 8) + 1}`,
          difficulty: 1, // 全部简单题
          isCorrect: true,
          ts: NOW + i * 1000,
        },
        NOW + i * 1000,
      );
      prior = { ...emptyMastery(), ...r.next };
    }
    // Elo 涨不上去（每次只 +0.X），eloComponent 接近 0.5
    expect(prior!.studentElo).toBeLessThan(1400);
    // → score < 75（无法成"熟练"，因为 eloComponent 不够）
    expect(prior!.score).toBeLessThan(75);
  });

  it("反复刷同 1 道题：多样性惩罚 → score × 0.7 封顶", () => {
    let prior: MasteryScore | null = null;
    for (let i = 0; i < 20; i++) {
      const r = applyAttempt(
        prior,
        { questionId: "q-same", difficulty: 5, isCorrect: true, ts: NOW + i * 1000 },
        NOW + i * 1000,
      );
      prior = { ...emptyMastery(), ...r.next };
    }
    // Elo 高但多样性 1/4 = 0.25 → score 受打折
    expect(prior!.studentElo).toBeGreaterThan(1500);
    expect(prior!.score).toBeLessThan(75);
  });

  it("最近 5 题错 3 题：fragility 上限 45", () => {
    let prior: MasteryScore | null = null;
    // 先 10 题全对建高分
    for (let i = 1; i <= 10; i++) {
      const r = applyAttempt(
        prior,
        { questionId: `q${i}`, difficulty: 4, isCorrect: true, ts: NOW + i * 1000 },
        NOW + i * 1000,
      );
      prior = { ...emptyMastery(), ...r.next };
    }
    const beforeFragile = prior!.score;
    // 再连错 3 题
    for (let i = 11; i <= 13; i++) {
      const r = applyAttempt(
        prior,
        { questionId: `q${i}`, difficulty: 4, isCorrect: false, ts: NOW + i * 1000 },
        NOW + i * 1000,
      );
      prior = { ...emptyMastery(), ...r.next };
    }
    expect(prior!.score).toBeLessThanOrEqual(45); // fragile 上限
    expect(prior!.score).toBeLessThan(beforeFragile);
  });

  it("21 天没答对：fragility 触发", () => {
    let prior: MasteryScore | null = null;
    for (let i = 1; i <= 10; i++) {
      const r = applyAttempt(
        prior,
        { questionId: `q${i}`, difficulty: 4, isCorrect: true, ts: NOW + i * 86_400_000 },
        NOW + i * 86_400_000,
      );
      prior = { ...emptyMastery(), ...r.next };
    }
    // 30 天后再算分
    const future = NOW + 40 * 86_400_000;
    const detail = computeMasteryScore({
      recent: prior!.recent ?? [],
      studentElo: prior!.studentElo!,
      attemptsCount: prior!.attemptsCount,
      lastSuccessAt: prior!.lastSuccessAt,
      now: future,
    });
    expect(detail.fragile).toBe(true);
    expect(detail.score).toBeLessThanOrEqual(45);
  });
});

describe("mastery — backfillFromAttempts", () => {
  it("空 attempts → score 0", () => {
    const r = backfillFromAttempts([], NOW);
    expect(r.score).toBe(0);
    expect(r.studentElo).toBe(STUDENT_ELO_BASE);
  });

  it("一串 attempts 重放结果一致", () => {
    const attempts = [
      { questionId: "q1", difficulty: 3, isCorrect: true, ts: NOW - 5000 },
      { questionId: "q2", difficulty: 4, isCorrect: false, ts: NOW - 4000 },
      { questionId: "q3", difficulty: 3, isCorrect: true, ts: NOW - 3000 },
    ];
    const r = backfillFromAttempts(attempts, NOW);
    expect(r.attemptsCount).toBe(3);
    expect(r.correctCount).toBe(2);
    expect(r.recent.length).toBe(3);
    expect(r.lastSuccessAt).toBe(NOW - 3000);
  });
});

describe("mastery — 老 updateMastery 兼容垫层", () => {
  it("答对会提高分数", () => {
    const next = updateMastery({
      oldScore: 50,
      difficulty: 3,
      isCorrect: true,
    });
    expect(next).toBeGreaterThan(50);
  });

  it("答错会降低分数", () => {
    const next = updateMastery({
      oldScore: 60,
      difficulty: 3,
      isCorrect: false,
    });
    expect(next).toBeLessThan(60);
  });

  it("分数夹在 0-100 之间", () => {
    const high = updateMastery({ oldScore: 99, difficulty: 5, isCorrect: true });
    const low = updateMastery({ oldScore: 1, difficulty: 5, isCorrect: false });
    expect(high).toBeLessThanOrEqual(100);
    expect(low).toBeGreaterThanOrEqual(0);
  });
});
