import { describe, expect, it } from "vitest";
import {
  REVIEW_INTERVAL_DAYS,
  advanceStageOnSuccess,
  nextReviewAt,
  regressStageOnFailure,
} from "../src/core/spacedReview";

describe("spacedReview", () => {
  it("间隔天数与 PRD 一致", () => {
    expect(REVIEW_INTERVAL_DAYS).toEqual([1, 3, 7, 14, 30]);
  });

  it("答对前进一阶，答错回退一阶", () => {
    expect(advanceStageOnSuccess(0)).toBe(1);
    expect(advanceStageOnSuccess(4)).toBe(5);
    expect(regressStageOnFailure(2)).toBe(1);
    expect(regressStageOnFailure(0)).toBe(0);
  });

  it("nextReviewAt 使用正确的间隔", () => {
    const from = new Date("2026-04-25T00:00:00Z").getTime();
    const day = 86400_000;
    expect(nextReviewAt(0, from)).toBe(from + 1 * day);
    expect(nextReviewAt(1, from)).toBe(from + 3 * day);
    expect(nextReviewAt(4, from)).toBe(from + 30 * day);
  });
});
