import { describe, expect, it } from "vitest";
import { clampMastery, updateMastery } from "../src/core/mastery";

describe("mastery", () => {
  it("始终在 0-100 之间", () => {
    expect(clampMastery(-10)).toBe(0);
    expect(clampMastery(150)).toBe(100);
    expect(clampMastery(42)).toBe(42);
  });

  it("答对会提高分数", () => {
    const next = updateMastery({
      oldScore: 50,
      difficulty: 3,
      isCorrect: true,
      usedHint: false,
      elapsedSeconds: 30,
      estimatedTimeSeconds: 60,
      errorTags: [],
      cognitiveLevel: "procedural",
    });
    expect(next).toBeGreaterThan(50);
  });

  it("答错会降低分数，概念错误惩罚更重", () => {
    const careless = updateMastery({
      oldScore: 60,
      difficulty: 3,
      isCorrect: false,
      usedHint: false,
      elapsedSeconds: 60,
      estimatedTimeSeconds: 60,
      errorTags: ["careless_reading"],
      cognitiveLevel: "procedural",
    });
    const conceptual = updateMastery({
      oldScore: 60,
      difficulty: 3,
      isCorrect: false,
      usedHint: false,
      elapsedSeconds: 60,
      estimatedTimeSeconds: 60,
      errorTags: ["relation_model_error"],
      cognitiveLevel: "application",
    });
    expect(careless).toBeLessThan(60);
    expect(conceptual).toBeLessThan(careless);
  });

  it("连续同错因会叠加惩罚", () => {
    const single = updateMastery({
      oldScore: 60,
      difficulty: 3,
      isCorrect: false,
      usedHint: false,
      elapsedSeconds: 60,
      estimatedTimeSeconds: 60,
      errorTags: ["equation_setup_error"],
      priorErrorTags: [],
      cognitiveLevel: "application",
    });
    const repeated = updateMastery({
      oldScore: 60,
      difficulty: 3,
      isCorrect: false,
      usedHint: false,
      elapsedSeconds: 60,
      estimatedTimeSeconds: 60,
      errorTags: ["equation_setup_error"],
      priorErrorTags: ["equation_setup_error"],
      cognitiveLevel: "application",
    });
    expect(repeated).toBeLessThan(single);
  });

  it("单题上下限保护", () => {
    const ceiling = updateMastery({
      oldScore: 95,
      difficulty: 5,
      isCorrect: true,
      usedHint: false,
      elapsedSeconds: 10,
      estimatedTimeSeconds: 120,
      errorTags: [],
      cognitiveLevel: "procedural",
      multiStepAllStepsCorrect: true,
    });
    expect(ceiling).toBeLessThanOrEqual(100);
    const floor = updateMastery({
      oldScore: 5,
      difficulty: 5,
      isCorrect: false,
      usedHint: true,
      elapsedSeconds: 300,
      estimatedTimeSeconds: 60,
      errorTags: ["relation_model_error", "equation_setup_error"],
      priorErrorTags: ["relation_model_error"],
      cognitiveLevel: "application",
    });
    expect(floor).toBeGreaterThanOrEqual(0);
  });
});
