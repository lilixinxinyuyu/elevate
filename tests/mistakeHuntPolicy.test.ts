import { describe, expect, it } from "vitest";
import {
  calcXp,
  genUnitConversionBug,
  genVerticalBug,
  generateSession,
  type BugCard,
} from "../src/core/mistakeHuntPolicy";

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe("genVerticalBug", () => {
  it("生成竖式 bug card, 有 buggyLineIdx + correctText", () => {
    for (let seed = 1; seed < 30; seed++) {
      const c = genVerticalBug(seededRng(seed));
      expect(c.kind).toBe("vertical");
      expect(c.lines.length).toBeGreaterThan(2);
      expect(c.buggyLineIdx).toBeGreaterThanOrEqual(0);
      expect(c.buggyLineIdx).toBeLessThan(c.lines.length);
      expect(c.correctText).toBeTruthy();
      expect(c.wrongText).toBeTruthy();
      // correctText 跟 wrongText 不一样
      expect(c.correctText).not.toBe(c.wrongText);
      // explanation 非空
      expect(c.explanation.length).toBeGreaterThan(5);
    }
  });
});

describe("genUnitConversionBug", () => {
  it("4 条换算, 一条错", () => {
    for (let seed = 1; seed < 20; seed++) {
      const c = genUnitConversionBug(seededRng(seed));
      expect(c.kind).toBe("unit_conversion");
      expect(c.lines.length).toBe(4);
      expect(c.buggyLineIdx).toBeGreaterThanOrEqual(0);
      expect(c.buggyLineIdx).toBeLessThan(4);
      // wrong line 跟 explanation 对应
      expect(c.lines[c.buggyLineIdx]).toBe(c.wrongText);
    }
  });
});

describe("generateSession", () => {
  it("5 题 (3 vertical + 2 unit), 顺序随机", () => {
    const s = generateSession(seededRng(42));
    expect(s.length).toBe(5);
    const verticalCount = s.filter((c) => c.kind === "vertical").length;
    const unitCount = s.filter((c) => c.kind === "unit_conversion").length;
    expect(verticalCount).toBe(3);
    expect(unitCount).toBe(2);
  });
});

describe("calcXp (递减奖励, 不倒扣)", () => {
  it("第 1 次对 → +15", () => {
    expect(calcXp(1, false)).toBe(15);
  });
  it("第 2 次对 → +10", () => {
    expect(calcXp(2, false)).toBe(10);
  });
  it("第 3 次对 → +5", () => {
    expect(calcXp(3, false)).toBe(5);
  });
  it("第 4 次以后 → 0 (不倒扣)", () => {
    expect(calcXp(4, false)).toBe(0);
    expect(calcXp(10, false)).toBe(0);
  });
  it("提示用了 → 最多 -2", () => {
    expect(calcXp(1, true)).toBe(13);
    expect(calcXp(2, true)).toBe(8);
    expect(calcXp(3, true)).toBe(3);
  });
  it("已经 0 分了, 用提示也不变负", () => {
    expect(calcXp(5, true)).toBe(0);
  });
});

describe("bugCard 不变量", () => {
  it("每个 vertical card 至少 4 行 (题面+乘号+横线+答)", () => {
    const c = genVerticalBug(seededRng(7));
    expect(c.lines.length).toBeGreaterThanOrEqual(4);
  });
  it("vertical buggyLineIdx 一定指向某一行包含 wrongText (或对应数字)", () => {
    const c = genVerticalBug(seededRng(3));
    // wrongText 应该出现在 lines[buggyLineIdx]
    const line = c.lines[c.buggyLineIdx]!;
    // wrongText 可能是 "1234" 或 "1234 (没空一格)" 这种, 取数字部分匹配
    const wrongNum = c.wrongText.match(/\d+/)?.[0];
    if (wrongNum) {
      expect(line).toContain(wrongNum);
    }
  });
});
