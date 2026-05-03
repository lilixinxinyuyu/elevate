import { describe, it, expect } from "vitest";
import { computeRating } from "../src/core/rating";
import {
  TIERS,
  tierFromScore,
  percentSurpassed,
  progressInTier,
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

  it("Selena 当前数据落在锦江/成都区间（已经练了一阵的孩子）", () => {
    // 模拟：429 道题，最近 7 天 76% 正确率，8 天连胜，平均 mastery 65
    const attempts: Attempt[] = [];
    for (let i = 0; i < 100; i++) {
      attempts.push(mkAttempt({ isCorrect: i < 76, daysAgo: i % 7 }));
    }
    for (let i = 0; i < 329; i++) {
      attempts.push(mkAttempt({ isCorrect: true, daysAgo: 8 + (i % 20) }));
    }
    const mastery = [
      "decimal_meaning_place",
      "decimal_add_sub_vertical",
      "decimal_mul_vertical",
      "triangle_inequality",
      "triangle_angle_sum",
      "decimal_inverse_problem",
      "decimal_unit_conversion",
    ].map((id) => mkMastery(id, 65));

    const r = computeRating(attempts, mastery, NOW);
    // 校准：Selena 现在每天练，准确率 76%，应该在 district~city 区间。
    // 不在 school（说明她已经走出新手村）也不在 province+（避免门槛过低虚高）。
    expect(["district", "city"]).toContain(r.tier.id);
    expect(r.score).toBeGreaterThanOrEqual(400);
    expect(r.score).toBeLessThan(800);
  });

  it("超高分数据应该解锁全国段", () => {
    const attempts: Attempt[] = [];
    // 大量题目，95% 正确率，长连胜
    for (let day = 0; day < 60; day++) {
      for (let i = 0; i < 30; i++) {
        attempts.push(mkAttempt({ isCorrect: i < 28, daysAgo: day }));
      }
    }
    // 用真实 skill ID（test 上面已经 import，但简单起见用前 30 个真实 ID）
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
    const mastery = REAL_SKILLS.map((id) => mkMastery(id, 95));
    const r = computeRating(attempts, mastery, NOW);
    expect(r.score).toBeGreaterThanOrEqual(900);
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

  it("段位映射正确", () => {
    expect(tierFromScore(0).id).toBe("school");
    expect(tierFromScore(399).id).toBe("school");
    expect(tierFromScore(400).id).toBe("district");
    expect(tierFromScore(599).id).toBe("district");
    expect(tierFromScore(600).id).toBe("city");
    expect(tierFromScore(799).id).toBe("city");
    expect(tierFromScore(800).id).toBe("province");
    expect(tierFromScore(899).id).toBe("province");
    expect(tierFromScore(900).id).toBe("country");
    expect(tierFromScore(1000).id).toBe("country");
  });

  it("段内进度从 0 到 1", () => {
    expect(progressInTier(0, TIERS[0]!)).toBe(0);
    expect(progressInTier(200, TIERS[0]!)).toBe(0.5);
    expect(progressInTier(400, TIERS[0]!)).toBe(1);
  });

  it("百分位段内单调递增，全国段顶 99%", () => {
    expect(percentSurpassed(0, TIERS[0]!)).toBe(50);
    expect(percentSurpassed(200, TIERS[0]!)).toBeGreaterThan(50);
    expect(percentSurpassed(399, TIERS[0]!)).toBeGreaterThanOrEqual(89);
    expect(percentSurpassed(900, TIERS[4]!)).toBe(50);
    expect(percentSurpassed(1000, TIERS[4]!)).toBe(99);
  });
});
