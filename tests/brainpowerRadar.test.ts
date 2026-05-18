import { describe, expect, it } from "vitest";
import {
  computeBrainpowerRadar,
  dimensionTrend,
  isMainTrainAttempt,
  type RadarDimension,
} from "../src/core/brainpowerRadar";
import type { Attempt } from "../src/core/types";

function mkAttempt(overrides: Partial<Attempt>): Attempt {
  return {
    id: "a",
    studentId: "s",
    questionId: "q",
    skillId: "skill_x",
    answer: 0,
    isCorrect: true,
    hintsOpened: 0,
    elapsedSeconds: 10,
    errorTags: [],
    scoreDelta: { total: 5, byAbility: {} },
    masteryDelta: 0,
    isReview: false,
    comboAtEnd: 0,
    createdAt: Date.now(),
    ...overrides,
  } as Attempt;
}

describe("computeBrainpowerRadar (空数据)", () => {
  it("0 attempts → 5 维度都 value=0, 提示 CTA", () => {
    const snap = computeBrainpowerRadar([], "week");
    expect(snap.dimensions.length).toBe(5);
    for (const d of snap.dimensions) {
      expect(d.value).toBe(0);
      // 空数据 detail 应该是 "🎯 去..." CTA (除了 baseSystem 可能是 "去进制...")
      expect(d.detail).toMatch(/🎯|🏆|进度|去/);
    }
  });
});

describe("computeBrainpowerRadar (估算维度)", () => {
  it("估算命中率算对", () => {
    const attempts: Attempt[] = [
      mkAttempt({ metadata: { estimationGate: { magnitudeMismatch: false } } }),
      mkAttempt({ metadata: { estimationGate: { magnitudeMismatch: false } } }),
      mkAttempt({ metadata: { estimationGate: { magnitudeMismatch: true } } }),
    ];
    const snap = computeBrainpowerRadar(attempts, "all");
    const est = snap.dimensions.find((d) => d.id === "estimation")!;
    expect(est.numerator).toBe(2);
    expect(est.denominator).toBe(3);
    expect(est.value).toBeCloseTo(2 / 3, 2);
  });
});

describe("computeBrainpowerRadar (草稿维度)", () => {
  it("insured=true 算 numerator", () => {
    const attempts: Attempt[] = [
      mkAttempt({ metadata: { scratch: { insured: true } } }),
      mkAttempt({ metadata: { scratch: { insured: true } } }),
      mkAttempt({ metadata: { scratch: { insured: false } } }),
      mkAttempt({ metadata: { scratch: { insured: false } } }),
    ];
    const snap = computeBrainpowerRadar(attempts, "all");
    const sc = snap.dimensions.find((d) => d.id === "scratch")!;
    expect(sc.numerator).toBe(2);
    expect(sc.denominator).toBe(4);
    expect(sc.value).toBe(0.5);
  });
});

describe("computeBrainpowerRadar (多步维度)", () => {
  it("phasePass 全 true 算 allCorrect", () => {
    const attempts: Attempt[] = [
      mkAttempt({ metadata: { multiStep: { phasePass: [true, true, true, true] } } }),
      mkAttempt({ metadata: { multiStep: { phasePass: [true, true, true, false] } } }),
    ];
    const snap = computeBrainpowerRadar(attempts, "all");
    const ms = snap.dimensions.find((d) => d.id === "multiStep")!;
    expect(ms.numerator).toBe(1);
    expect(ms.denominator).toBe(2);
  });
});

describe("computeBrainpowerRadar (强化维度)", () => {
  it("session-level 全对算", () => {
    const attempts: Attempt[] = [
      mkAttempt({ metadata: { strengthenSessionId: "s1", strengthenCorrectCount: 3, strengthenTotalQuestions: 3 } }),
      mkAttempt({ metadata: { strengthenSessionId: "s2", strengthenCorrectCount: 2, strengthenTotalQuestions: 3 } }),
    ];
    const snap = computeBrainpowerRadar(attempts, "all");
    const st = snap.dimensions.find((d) => d.id === "strengthen")!;
    expect(st.numerator).toBe(1);
    expect(st.denominator).toBe(2);
  });
});

describe("isMainTrainAttempt (source filter)", () => {
  it("source=mistake_hunt 排除", () => {
    expect(isMainTrainAttempt(mkAttempt({ metadata: { source: "mistake_hunt" } }))).toBe(false);
  });
  it("没 source 默认包含", () => {
    expect(isMainTrainAttempt(mkAttempt({}))).toBe(true);
  });
  it("source=undefined 包含", () => {
    expect(isMainTrainAttempt(mkAttempt({ metadata: {} }))).toBe(true);
  });
});

describe("dimensionTrend", () => {
  const cur: RadarDimension = {
    id: "estimation", name: "x", icon: "🧠", description: "", value: 0.6, numerator: 6, denominator: 10, detail: "",
  };
  it("无 previous → 空字符", () => {
    expect(dimensionTrend(cur, undefined)).toBe("");
  });
  it("previous denominator 0 → 空字符", () => {
    expect(dimensionTrend(cur, { ...cur, value: 0, denominator: 0 })).toBe("");
  });
  it("提高 → ↑", () => {
    expect(dimensionTrend(cur, { ...cur, value: 0.4 })).toContain("↑");
  });
  it("下降 → ↓", () => {
    expect(dimensionTrend(cur, { ...cur, value: 0.8 })).toContain("↓");
  });
  it("≈ 持平", () => {
    expect(dimensionTrend(cur, { ...cur, value: 0.61 })).toBe("≈ 持平");
  });
});

describe("分母 0 防御", () => {
  it("某一维度 0 sample → value=0, 不 NaN", () => {
    const snap = computeBrainpowerRadar([], "all");
    for (const d of snap.dimensions) {
      expect(Number.isFinite(d.value)).toBe(true);
      expect(d.value).toBeGreaterThanOrEqual(0);
      expect(d.value).toBeLessThanOrEqual(1);
    }
  });
});
