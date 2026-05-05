/**
 * v0.30.12: Elo 强制截断测试（防低难度刷分）。
 *
 * 学生 Elo > 题目 Elo + 300 时，答对不再涨 Elo（自然 expectedP 已经 > 0.85，
 * 单次 K×(1-0.85) ≈ 4 看似小，但累计 100 次 ≈ +400 Elo 仍是大 farm 风险）。
 * 答错仍然降 Elo（错题该惩罚还要惩罚）。
 */

import { describe, expect, it } from "vitest";
import { updateStudentElo } from "../src/core/mastery";

describe("Elo hard cap v0.30.12", () => {
  it("学生 Elo 比题目 Elo 高 < 300 时正常涨（base case）", () => {
    const next = updateStudentElo(1500, 1300, true);
    expect(next).toBeGreaterThan(1500);
  });

  it("学生 Elo 比题目 Elo 高 > 300 时答对不涨 Elo（强截断）", () => {
    const next = updateStudentElo(1700, 1300, true);
    expect(next).toBe(1700); // 完全不变
  });

  it("学生 Elo 比题目 Elo 高 > 300 时答错仍然降 Elo", () => {
    const next = updateStudentElo(1700, 1300, false);
    expect(next).toBeLessThan(1700);
  });

  it("学生 Elo 比题目 Elo 低很多时正常涨", () => {
    const next = updateStudentElo(1100, 1500, true);
    expect(next).toBeGreaterThan(1100);
    // 难题答对涨幅 K * (1 - low expectedP) 应该接近 K（24）
    expect(next - 1100).toBeGreaterThan(15);
  });

  it("tutor-assisted (actual=0.5) 时不触发硬截断（half credit 仍允许 small 涨）", () => {
    // outcome=0.5 < 1，不进 cap 分支；自然 Elo 计算
    const next = updateStudentElo(1700, 1300, 0.5);
    // expected ≈ 0.91, actual=0.5 → K×(0.5-0.91) = -9.84 → Elo 降
    expect(next).toBeLessThan(1700);
  });

  it("边界：差 300 整时不截断，答对仍涨", () => {
    const next = updateStudentElo(1600, 1300, true);
    expect(next).toBe(1600 + 24 * (1 - 1 / (1 + Math.pow(10, (1300 - 1600) / 400))));
    expect(next).toBeGreaterThan(1600);
  });

  it("差 301 时截断，答对不涨", () => {
    const next = updateStudentElo(1601, 1300, true);
    expect(next).toBe(1601);
  });
});
