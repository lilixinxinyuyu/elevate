import { describe, it, expect } from "vitest";
import { computeRating, computeAbilityDiagnostic } from "../src/core/rating";
import {
  TIERS,
  tierFromScore,
  percentSurpassed,
  progressInTier,
  subRank,
  subRankRoman,
  subRankStars,
} from "../src/core/tiers";
import type { Attempt, MasteryScore } from "../src/core/types";

const NOW = new Date("2026-05-03T08:00:00").getTime();
const DAY = 24 * 60 * 60 * 1000;

function mkAttempt(opts: Partial<Attempt> & { isCorrect: boolean; daysAgo?: number; xp?: number }): Attempt {
  const days = opts.daysAgo ?? 0;
  const xp = opts.xp ?? (opts.isCorrect ? 14 : 3);
  const { daysAgo: _drop, xp: _drop2, ...rest } = opts;
  return {
    id: "a-" + Math.random(),
    studentId: "s1",
    questionId: "q-1",
    skillId: "decimal_addition",
    answer: 0,
    hintsOpened: 0,
    elapsedSeconds: 10,
    errorTags: [],
    scoreDelta: { total: xp, byAbility: {} },
    masteryDelta: 0,
    isReview: false,
    comboAtEnd: 1,
    createdAt: NOW - days * DAY,
    ...rest,
  };
}

function mkMastery(skillId: string, score: number): MasteryScore {
  return {
    id: `s1::${skillId}`,
    studentId: "s1",
    skillId,
    score,
    attemptsCount: 10,
    correctCount: 7,
    updatedAt: NOW,
  };
}

describe("computeRating (XP-based, no cap)", () => {
  it("空数据 → 0 XP，落在和平街小学起步段", () => {
    const r = computeRating([], [], NOW);
    expect(r.score).toBe(0);
    expect(r.tier.id).toBe("school");
    expect(r.percentSurpassed).toBe(50);
  });

  it("XP = sum of scoreDelta.total", () => {
    const attempts = [
      mkAttempt({ isCorrect: true, xp: 10 }),
      mkAttempt({ isCorrect: true, xp: 25 }),
      mkAttempt({ isCorrect: false, xp: 3 }),
    ];
    const r = computeRating(attempts, [], NOW);
    expect(r.score).toBe(38);
  });

  it("Selena 现状（~250 题, 平均 15 XP/题）应在和平街小学", () => {
    const attempts = Array.from({ length: 250 }, (_, i) =>
      mkAttempt({
        isCorrect: i % 4 !== 0,
        xp: i % 4 !== 0 ? 15 : 3,
        skillId: "decimal_meaning_place",
        questionId: `q${i % 10}`,
        daysAgo: i % 15,
      }),
    );
    const r = computeRating(attempts, [], NOW);
    expect(r.tier.id).toBe("school");
    // 大概 ~3000 XP
    expect(r.score).toBeGreaterThan(2500);
    expect(r.score).toBeLessThan(5000);
  });

  it("4 月 perfect → 全国（>=40000 XP）", () => {
    // 120 天 × 18 题/天 × 22 XP/题 = 47520
    const attempts: Attempt[] = [];
    for (let day = 0; day < 120; day++) {
      for (let q = 0; q < 18; q++) {
        attempts.push(mkAttempt({
          isCorrect: true,
          xp: 22,
          skillId: "decimal_meaning_place",
          questionId: `q${q}`,
          daysAgo: day,
        }));
      }
    }
    const r = computeRating(attempts, [], NOW);
    expect(r.score).toBeGreaterThanOrEqual(40000);
    expect(r.tier.id).toBe("country");
  });

  it("score 永远累加，跨过 40k 后还在涨（country uncapped）", () => {
    const a1k = Array.from({ length: 1000 }, () => mkAttempt({ isCorrect: true, xp: 50 }));
    const r1 = computeRating(a1k, [], NOW);
    expect(r1.score).toBe(50_000);
    expect(r1.tier.id).toBe("country");
    expect(r1.percentSurpassed).toBeGreaterThan(50);

    const a2k = [...a1k, ...Array.from({ length: 1000 }, () => mkAttempt({ isCorrect: true, xp: 50 }))];
    const r2 = computeRating(a2k, [], NOW);
    expect(r2.score).toBe(100_000);
    expect(r2.percentSurpassed).toBeGreaterThan(r1.percentSurpassed);
  });

  it("term 过滤：只算属于该学期的 attempts", () => {
    const attempts = [
      mkAttempt({ isCorrect: true, xp: 100, skillId: "large_place_value" }),     // 上册
      mkAttempt({ isCorrect: true, xp: 200, skillId: "decimal_meaning_place" }), // 下册
      mkAttempt({ isCorrect: true, xp: 300, skillId: "decimal_add_sub_vertical" }), // 下册
    ];
    const rUp = computeRating(attempts, [], NOW, "上册");
    const rDown = computeRating(attempts, [], NOW, "下册");
    const rAll = computeRating(attempts, [], NOW);
    expect(rUp.score).toBe(100);
    expect(rDown.score).toBe(500);
    expect(rAll.score).toBe(600);
  });
});

describe("computeAbilityDiagnostic (composite for admin)", () => {
  it("0-1000 范围内", () => {
    const attempts = Array.from({ length: 100 }, (_, i) =>
      mkAttempt({ isCorrect: i < 76, daysAgo: i % 7 }),
    );
    const a = computeAbilityDiagnostic(attempts, [], null, NOW);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(1000);
  });

  it("题库小+重复刷不能让 mastery 飞", () => {
    const attempts: Attempt[] = [];
    for (let qi = 0; qi < 5; qi++) {
      for (let n = 0; n < 50; n++) {
        attempts.push(mkAttempt({
          isCorrect: true,
          skillId: "decimal_meaning_place",
          questionId: `q${qi}`,
          daysAgo: n % 30,
        }));
      }
    }
    const mastery = [mkMastery("decimal_meaning_place", 95)];
    const a = computeAbilityDiagnostic(attempts, mastery, null, NOW);
    // 5 道独立题 → cap 65
    expect(a.raw.weightedMastery).toBeLessThanOrEqual(65);
    expect(a.raw.rawWeightedMastery).toBeGreaterThanOrEqual(90);
  });

  // v0.30.12: volume 重写为 skill coverage（防姊妹题刷分）
  describe("volume = skill coverage v0.30.12", () => {
    it("1 skill 100 道独立答对 → coverage 仅 5 分（强反 farm）", () => {
      const attempts: Attempt[] = [];
      for (let i = 0; i < 100; i++) {
        attempts.push(mkAttempt({
          isCorrect: true,
          skillId: "decimal_meaning_place",
          questionId: `unique_q_${i}`, // 100 个 unique question ID
        }));
      }
      const a = computeAbilityDiagnostic(attempts, [], null, NOW);
      expect(a.raw.skillCoverageScore).toBe(5); // 1 skill × min(5, 100) = 5
      expect(a.components.volume).toBe(5);
    });

    it("30 skill × 5 道独立答对 → coverage 满分 150", () => {
      const attempts: Attempt[] = [];
      for (let s = 0; s < 32; s++) {
        for (let q = 0; q < 5; q++) {
          attempts.push(mkAttempt({
            isCorrect: true,
            skillId: `skill_${s}`,
            questionId: `s${s}_q${q}`,
          }));
        }
      }
      const a = computeAbilityDiagnostic(attempts, [], null, NOW);
      // 32 skill × 5 = 160 → cap 150
      expect(a.raw.skillCoverageScore).toBe(160);
      expect(a.components.volume).toBe(150);
    });

    it("30 skill × 1 道独立答对 → coverage 30 分（有广度但浅）", () => {
      const attempts: Attempt[] = [];
      for (let s = 0; s < 30; s++) {
        attempts.push(mkAttempt({
          isCorrect: true,
          skillId: `skill_${s}`,
          questionId: `s${s}_q0`,
        }));
      }
      const a = computeAbilityDiagnostic(attempts, [], null, NOW);
      expect(a.raw.skillCoverageScore).toBe(30);
      expect(a.components.volume).toBe(30);
    });

    it("错答不算入 coverage（只 unique correct 才算）", () => {
      const attempts: Attempt[] = [];
      for (let i = 0; i < 30; i++) {
        attempts.push(mkAttempt({
          isCorrect: false,
          skillId: "decimal_meaning_place",
          questionId: `wrong_${i}`,
        }));
      }
      const a = computeAbilityDiagnostic(attempts, [], null, NOW);
      expect(a.raw.skillCoverageScore).toBe(0);
      expect(a.components.volume).toBe(0);
    });

    it("同一道题答对多次只算 1 道（去重 questionId）", () => {
      const attempts: Attempt[] = [];
      for (let i = 0; i < 50; i++) {
        attempts.push(mkAttempt({
          isCorrect: true,
          skillId: "decimal_meaning_place",
          questionId: "same_question",
        }));
      }
      const a = computeAbilityDiagnostic(attempts, [], null, NOW);
      expect(a.raw.uniqueQuestionsCorrect).toBe(1);
      expect(a.raw.skillCoverageScore).toBe(1);
    });
  });

  // v0.30.12: 准确率把 tutor-correct 算 0.5（防讲题刷高准确率）
  it("tutor-correct 在 7 天准确率里只算 0.5", () => {
    const attempts: Attempt[] = [
      mkAttempt({ isCorrect: true, daysAgo: 1 }),
      mkAttempt({ isCorrect: true, daysAgo: 1, usedTutor: true }),
      mkAttempt({ isCorrect: true, daysAgo: 1, usedTutor: true }),
      mkAttempt({ isCorrect: false, daysAgo: 1 }),
    ];
    const a = computeAbilityDiagnostic(attempts, [], null, NOW);
    // (1 + 0.5 + 0.5) / 4 = 0.5
    expect(a.raw.accuracy7d).toBeCloseTo(0.5, 5);
  });
});

describe("TIERS (XP scale)", () => {
  it("5 段定义齐全，区间不重叠不留空", () => {
    expect(TIERS.length).toBe(5);
    for (let i = 0; i < TIERS.length - 1; i++) {
      expect(TIERS[i]!.range[1]).toBe(TIERS[i + 1]!.range[0]);
    }
    expect(TIERS[0]!.range[0]).toBe(0);
  });

  it("段位映射正确（XP 尺度）", () => {
    expect(tierFromScore(0).id).toBe("school");
    expect(tierFromScore(9999).id).toBe("school");
    expect(tierFromScore(10000).id).toBe("district");
    expect(tierFromScore(21999).id).toBe("district");
    expect(tierFromScore(22000).id).toBe("city");
    expect(tierFromScore(31999).id).toBe("city");
    expect(tierFromScore(32000).id).toBe("province");
    expect(tierFromScore(39999).id).toBe("province");
    expect(tierFromScore(40000).id).toBe("country");
    expect(tierFromScore(100000).id).toBe("country");
    expect(tierFromScore(999999).id).toBe("country");
  });

  it("段内进度 0 到 1", () => {
    const school = TIERS[0]!; // 0-10000
    expect(progressInTier(0, school)).toBe(0);
    expect(progressInTier(5000, school)).toBe(0.5);
    expect(progressInTier(10000, school)).toBe(1);
  });

  it("小段 4 档划分", () => {
    const school = TIERS[0]!; // 0-10000
    expect(subRank(0, school)).toBe(1);          // ★I 0-2500
    expect(subRank(2499, school)).toBe(1);
    expect(subRank(2500, school)).toBe(2);       // ★II 2500-5000
    expect(subRank(5000, school)).toBe(3);       // ★III 5000-7500
    expect(subRank(7500, school)).toBe(4);       // ★IV 7500-10000

    expect(subRankRoman(2)).toBe("II");
    expect(subRankStars(3)).toBe("★★★☆");
  });

  it("百分位：段内 50→89%，国段 log 渐进 99%", () => {
    expect(percentSurpassed(0, TIERS[0]!)).toBe(50);
    expect(percentSurpassed(9999, TIERS[0]!)).toBeGreaterThanOrEqual(89);
    expect(percentSurpassed(40000, TIERS[4]!)).toBe(50);
    expect(percentSurpassed(80000, TIERS[4]!)).toBeGreaterThan(80);
    expect(percentSurpassed(500000, TIERS[4]!)).toBeGreaterThanOrEqual(95);
  });
});
