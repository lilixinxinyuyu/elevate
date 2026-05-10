import { describe, it, expect } from "vitest";
import { starsFromAccuracy } from "../src/lib/bossBattleState";

/**
 * v0.31.83：starsFromAccuracy 重构后的星数判定。
 *
 * 4 星 = 全对 + 满血（heartsLeft >= 2）
 * 3 星 = 全对但掉过血 OR correct >= 6
 * 2 星 = correct >= 5
 * 1 星 = correct >= 4
 * 0 星 = correct < 4 (defeat)
 */
describe("starsFromAccuracy v0.31.83", () => {
  it("0 stars: < 4 correct", () => {
    expect(starsFromAccuracy(3, 7, 2)).toBe(0);
    expect(starsFromAccuracy(0, 7, 2)).toBe(0);
  });

  it("4 stars: all correct + full hearts", () => {
    expect(starsFromAccuracy(7, 7, 2)).toBe(4);
    expect(starsFromAccuracy(9, 9, 2)).toBe(4);
  });

  it("3 stars: all correct but lost hearts", () => {
    expect(starsFromAccuracy(7, 7, 1)).toBe(3);
    expect(starsFromAccuracy(7, 7, 0)).toBe(3);  // 满分但血光 — 这不可能（血 0 = defeat），但函数仍 3 星
  });

  it("3 stars: 6+ correct", () => {
    expect(starsFromAccuracy(6, 9, 2)).toBe(3);
    expect(starsFromAccuracy(8, 9, 1)).toBe(3);
  });

  it("2 stars: 5 correct", () => {
    expect(starsFromAccuracy(5, 9, 2)).toBe(2);
    expect(starsFromAccuracy(5, 7, 1)).toBe(2);
  });

  it("1 star: 4 correct", () => {
    expect(starsFromAccuracy(4, 9, 2)).toBe(1);
  });

  it("backward-compat: heartsLeft undefined → 4 stars on all-correct", () => {
    // 旧 callsite 不传 heartsLeft 时不应该破
    expect(starsFromAccuracy(7, 7)).toBe(4);
    expect(starsFromAccuracy(9, 9)).toBe(4);
    expect(starsFromAccuracy(5, 9)).toBe(2);
  });
});
