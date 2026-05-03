import { describe, it, expect } from "vitest";
import { computeRating } from "../src/core/rating";
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

function mkAttempt(opts: Partial<Attempt> & { isCorrect: boolean; daysAgo?: number }): Attempt {
  const days = opts.daysAgo ?? 0;
  const { daysAgo: _drop, ...rest } = opts;
  return {
    id: "a-" + Math.random(),
    studentId: "s1",
    questionId: "q-1",
    skillId: "decimal_addition",
    answer: 0,
    hintsOpened: 0,
    elapsedSeconds: 10,
    errorTags: [],
    scoreDelta: { total: 5, byAbility: {} },
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

describe("computeRating", () => {
  it("空数据返回 0 分，落在和平街小学起步段", () => {
    const r = computeRating([], [], NOW);
    expect(r.score).toBe(0);
    expect(r.tier.id).toBe("school");
    expect(r.percentSurpassed).toBe(50); // 段位起点 → 50%
  });

  it("题库小 + 重复刷不能让 mastery 飞", () => {
    // 5 道独立题，每道做 50 次，全对。mastery 真值会被 EWMA 顶到 95
    const attempts: Attempt[] = [];
    const skills = ["decimal_meaning_place", "decimal_add_sub_vertical"];
    for (const sk of skills) {
      for (let qi = 0; qi < 5; qi++) {
        for (let n = 0; n < 50; n++) {
          attempts.push(mkAttempt({
            isCorrect: true,
            skillId: sk,
            questionId: `${sk}_q${qi}`,
            daysAgo: n % 30,
          }));
        }
      }
    }
    // 真实 mastery 95（EWMA 顶到这）
    const mastery = skills.map((id) => mkMastery(id, 95));
    const r = computeRating(attempts, mastery, NOW);
    // effective_mastery 因为只看了 5 道独立题被封到 65（40 + 5×5）
    expect(r.raw.weightedMastery).toBeLessThanOrEqual(65);
    // 真原始 mastery 应该高得多
    expect(r.raw.rawWeightedMastery).toBeGreaterThanOrEqual(90);
    // 段位仍在和平街小学（防止刷分混到锦江）
    expect(r.tier.id).toBe("school");
  });

  it("Selena 当前数据落在和平街小学（v3 校准）", () => {
    // 429 题，最近 7 天 76% 正确率，但题库小 → 大量重复
    // 32 个 skill 都摸过，但每个 skill 只见过 ~3-4 道独立题（小池）
    const attempts: Attempt[] = [];
    const skills = [
      "decimal_meaning_place", "decimal_add_sub_vertical", "decimal_mul_vertical",
      "triangle_inequality", "triangle_angle_sum", "decimal_inverse_problem",
      "decimal_unit_conversion",
    ];
    // 7 天内 100 题，76% 正确
    for (let i = 0; i < 100; i++) {
      const sk = skills[i % skills.length]!;
      const qi = i % 4; // 每 skill 4 道独立题，循环
      attempts.push(mkAttempt({
        isCorrect: i < 76,
        skillId: sk,
        questionId: `${sk}_q${qi}`,
        daysAgo: i % 7,
      }));
    }
    // 之前 329 题，重复刷
    for (let i = 0; i < 329; i++) {
      const sk = skills[i % skills.length]!;
      const qi = i % 4;
      attempts.push(mkAttempt({
        isCorrect: true,
        skillId: sk,
        questionId: `${sk}_q${qi}`,
        daysAgo: 8 + (i % 20),
      }));
    }
    const mastery = skills.map((id) => mkMastery(id, 76));
    const r = computeRating(attempts, mastery, NOW);
    // v3 目标：和平街小学（不应虚高到锦江/成都）
    expect(r.tier.id).toBe("school");
  });

  it("练得广 + 真做了多种独立题 + 高准确率 → 段位上得去", () => {
    // 30 个 skill，每个 skill 12+ 道独立题，95% 正确率
    const REAL_30 = [
      "large_place_value", "large_read_write", "large_compare", "large_rewrite_wan_yi",
      "large_approx_rounding", "angle_types", "angle_measure", "int_mul_3_by_2",
      "int_mul_estimation", "mixed_ops_brackets", "distributive_law", "simplify_integer",
      "grid_coordinates", "div_3_by_2_trial", "div_adjust_quotient", "speed_time_distance",
      "decimal_meaning_place", "decimal_unit_conversion", "decimal_compare", "decimal_add_sub_vertical",
      "decimal_add_sub_simplify", "decimal_inverse_problem", "triangle_inequality", "triangle_angle_sum",
      "triangle_classification", "decimal_mul_meaning", "decimal_point_shift", "decimal_mul_vertical",
      "decimal_product_digits", "decimal_mul_mix",
    ];
    const mastery = REAL_30.map((id) => mkMastery(id, 90));
    const attempts: Attempt[] = [];
    for (let s = 0; s < REAL_30.length; s++) {
      const sk = REAL_30[s]!;
      // 每个 skill 12 道独立题，每道 3 次
      for (let q = 0; q < 12; q++) {
        for (let n = 0; n < 3; n++) {
          attempts.push(mkAttempt({
            isCorrect: q < 11,
            skillId: sk,
            questionId: `${sk}_q${q}`,
            daysAgo: (s + n) % 30,
          }));
        }
      }
    }
    const r = computeRating(attempts, mastery, NOW);
    expect(["district", "city", "province"]).toContain(r.tier.id);
  });

  it("4 个月 perfect 选手 → 应该解锁全国段（≥960）", () => {
    const REAL_SKILLS = [
      "large_place_value", "large_read_write", "large_compare", "large_rewrite_wan_yi",
      "large_approx_rounding", "angle_types", "angle_measure", "int_mul_3_by_2",
      "int_mul_estimation", "mixed_ops_brackets", "distributive_law", "simplify_integer",
      "grid_coordinates", "div_3_by_2_trial", "div_adjust_quotient", "speed_time_distance",
      "decimal_meaning_place", "decimal_unit_conversion", "decimal_compare", "decimal_add_sub_vertical",
      "decimal_add_sub_simplify", "decimal_inverse_problem", "triangle_inequality", "triangle_angle_sum",
      "triangle_classification", "decimal_mul_meaning", "decimal_point_shift", "decimal_mul_vertical",
      "decimal_product_digits", "decimal_mul_mix",
    ];
    const attempts: Attempt[] = [];
    // 每个 skill 15 道独立题 × 全对，120 天每天练
    for (let day = 0; day < 120; day++) {
      for (let s = 0; s < REAL_SKILLS.length; s++) {
        for (let q = 0; q < 15; q++) {
          attempts.push(mkAttempt({
            isCorrect: true,
            skillId: REAL_SKILLS[s]!,
            questionId: `${REAL_SKILLS[s]}_q${q}`,
            daysAgo: day,
          }));
        }
      }
    }
    const mastery = REAL_SKILLS.map((id) => mkMastery(id, 100));
    const r = computeRating(attempts, mastery, NOW);
    expect(r.score).toBeGreaterThanOrEqual(960);
    expect(r.tier.id).toBe("country");
  });

  it("分数在 0-1000 闭区间内", () => {
    for (let i = 0; i < 5; i++) {
      const attempts = Array.from({ length: 1000 }, () => mkAttempt({ isCorrect: true }));
      // 这个测试只关心 clamp，mastery 用真实 ID 即可
      const mastery = [
        "large_place_value", "decimal_add_sub_vertical", "triangle_inequality",
      ].map((id) => mkMastery(id, 100));
      const r = computeRating(attempts, mastery, NOW);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1000);
    }
  });

  it("准确率不到 50% → 准确率分量为 0", () => {
    const attempts = Array.from({ length: 100 }, (_, i) =>
      mkAttempt({ isCorrect: i < 30, daysAgo: i % 7 }),
    );
    const r = computeRating(attempts, [], NOW);
    expect(r.components.accuracy).toBe(0);
  });
});

describe("TIERS", () => {
  it("5 段位定义齐全且区间不重叠不留空", () => {
    expect(TIERS.length).toBe(5);
    for (let i = 0; i < TIERS.length - 1; i++) {
      expect(TIERS[i]!.range[1]).toBe(TIERS[i + 1]!.range[0]);
    }
    expect(TIERS[0]!.range[0]).toBe(0);
    expect(TIERS[TIERS.length - 1]!.range[1]).toBe(1000);
  });

  it("段位映射正确（v5 金字塔分布）", () => {
    expect(tierFromScore(0).id).toBe("school");
    expect(tierFromScore(599).id).toBe("school");
    expect(tierFromScore(600).id).toBe("district");
    expect(tierFromScore(779).id).toBe("district");
    expect(tierFromScore(780).id).toBe("city");
    expect(tierFromScore(879).id).toBe("city");
    expect(tierFromScore(880).id).toBe("province");
    expect(tierFromScore(959).id).toBe("province");
    expect(tierFromScore(960).id).toBe("country");
    expect(tierFromScore(1000).id).toBe("country");
  });

  it("段内进度从 0 到 1", () => {
    const school = TIERS[0]!; // 0-600
    expect(progressInTier(0, school)).toBe(0);
    expect(progressInTier(300, school)).toBe(0.5);
    expect(progressInTier(600, school)).toBe(1);
  });

  it("小段计算：4 档划分 25% / 50% / 75%", () => {
    const school = TIERS[0]!; // 0-600
    expect(subRank(0, school)).toBe(1);
    expect(subRank(149, school)).toBe(1);
    expect(subRank(150, school)).toBe(2);
    expect(subRank(299, school)).toBe(2);
    expect(subRank(300, school)).toBe(3);
    expect(subRank(449, school)).toBe(3);
    expect(subRank(450, school)).toBe(4);
    expect(subRank(599, school)).toBe(4);

    expect(subRankRoman(1)).toBe("I");
    expect(subRankRoman(4)).toBe("IV");
    expect(subRankStars(2)).toBe("★★☆☆");
    expect(subRankStars(4)).toBe("★★★★");
  });

  it("百分位段内单调递增，全国段顶 99%", () => {
    expect(percentSurpassed(0, TIERS[0]!)).toBe(50);
    expect(percentSurpassed(300, TIERS[0]!)).toBeGreaterThan(50);
    expect(percentSurpassed(599, TIERS[0]!)).toBeGreaterThanOrEqual(89);
    expect(percentSurpassed(960, TIERS[4]!)).toBe(50);
    expect(percentSurpassed(1000, TIERS[4]!)).toBe(99);
  });
});
