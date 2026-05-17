import { describe, expect, it } from "vitest";
import { resolveTemplate } from "../src/components/game/templates/resolve";
import {
  classifyStem,
  isSpeedEligible,
  shouldForceNumericFill,
  speedEligibleByHeuristic,
} from "../src/core/speedMatchPolicy";
import type { Question } from "../src/core/types";

const base: Question = {
  question_id: "Q",
  version: 1,
  status: "approved",
  grade: 4,
  term: "下册",
  unit_id: "U",
  skill_id: "s",
  ability_dimension: ["calculation"],
  exam_priority: "NORMAL",
  game_type: "speed_calc",
  cognitive_level: "recall",
  difficulty: 1,
  estimated_time_seconds: 10,
  stem: "3+5=?",
  question_format: "numeric",
  answer: { type: "number", value: 8 },
  solution_steps: ["3+5=8"],
  common_errors: [
    { tag: "a", error: "e", remediation: "r" },
    { tag: "b", error: "e", remediation: "r" },
  ],
  feedback_correct: "good",
  feedback_wrong: "再试",
};

describe("speedMatchPolicy.classifyStem", () => {
  it("简单单步无单位", () => {
    const f = classifyStem("3+5=?");
    expect(f.opCount).toBe(1);
    expect(f.digitsMax).toBe(1);
    expect(f.hasUnit).toBe(false);
    expect(f.hasStory).toBe(false);
    expect(f.hasMultiStep).toBe(false);
  });
  it("多位数 + 单位 + 故事", () => {
    const f = classifyStem("小明买了3千克苹果, 每千克12元, 一共多少元?");
    expect(f.hasUnit).toBe(true);
    expect(f.hasStory).toBe(true);
    expect(f.digitsMax).toBeGreaterThanOrEqual(2);
  });
  it("多步线索", () => {
    const f = classifyStem("先走了 100 米, 又跑了 200 米, 一共多少米?");
    expect(f.hasMultiStep).toBe(true);
  });
});

describe("speedMatchPolicy.speedEligibleByHeuristic", () => {
  it("简单 1 位 + - = OK", () => {
    expect(speedEligibleByHeuristic(base)).toBe(true);
  });
  it("难度 ≥ 3 → 禁", () => {
    expect(speedEligibleByHeuristic({ ...base, difficulty: 3 })).toBe(false);
  });
  it("3 位数 → 禁", () => {
    expect(speedEligibleByHeuristic({ ...base, stem: "312+47=?" })).toBe(false);
  });
  it("带单位 → 禁", () => {
    expect(speedEligibleByHeuristic({ ...base, stem: "3+5= ? 元" })).toBe(false);
  });
  it("带故事 → 禁", () => {
    expect(speedEligibleByHeuristic({ ...base, stem: "小明有3个苹果再吃5个 = ?" })).toBe(false);
  });
  it("multi_step format → 禁", () => {
    expect(speedEligibleByHeuristic({ ...base, question_format: "multi_step" })).toBe(false);
  });
});

describe("speedMatchPolicy.isSpeedEligible (explicit override)", () => {
  it("explicit true 即使复杂题也允许", () => {
    const q: Question = { ...base, difficulty: 5, speedEligible: true, stem: "312×47=?" };
    expect(isSpeedEligible(q)).toBe(true);
  });
  it("explicit false 即使简单也禁", () => {
    expect(isSpeedEligible({ ...base, speedEligible: false })).toBe(false);
  });
  it("undefined 走 heuristic", () => {
    expect(isSpeedEligible(base)).toBe(true);
    expect(isSpeedEligible({ ...base, difficulty: 4 })).toBe(false);
  });
});

describe("speedMatchPolicy.shouldForceNumericFill", () => {
  it("简单单选数字答案 → 强制 fill", () => {
    const q: Question = {
      ...base,
      question_format: "single_choice",
      options: [
        { id: "A", text: "7" },
        { id: "B", text: "8" },
        { id: "C", text: "9" },
        { id: "D", text: "10" },
      ],
    };
    expect(shouldForceNumericFill(q)).toBe(true);
  });
  it("非数字答案 → 不强制", () => {
    const q: Question = {
      ...base,
      question_format: "single_choice",
      answer: { type: "choice", value: ["A"] } as any,
    };
    expect(shouldForceNumericFill(q)).toBe(false);
  });
  it("复杂多位 single_choice → 不强制 (留给原选择题)", () => {
    expect(shouldForceNumericFill({ ...base, question_format: "single_choice", difficulty: 4 })).toBe(false);
  });
});

describe("resolveTemplate 集成 P0 政策", () => {
  it("简单 numeric 题 → speed_match (heuristic 允许)", () => {
    expect(resolveTemplate(base)).toBe("speed_match");
  });
  it("复杂应用题 numeric → speed_match 被白名单拦, fallback plain_numeric", () => {
    const q: Question = {
      ...base,
      stem: "小明买了 312 千克苹果, 每千克 47 元, 一共多少元?",
      difficulty: 4,
    };
    expect(resolveTemplate(q)).toBe("plain_numeric");
  });
  it("explicit speedEligible=false 直接 fallback", () => {
    expect(resolveTemplate({ ...base, speedEligible: false })).toBe("plain_numeric");
  });
  it("post-review: 复杂 single_choice 数字答 (3+ 位) → 不触发 Force-Fill, 但被白名单 fallback 到 plain_numeric", () => {
    const q: Question = {
      ...base,
      stem: "312 + 47 = ?",
      question_format: "single_choice",
      difficulty: 2,
      options: [
        { id: "A", text: "359" },
        { id: "B", text: "369" },
        { id: "C", text: "349" },
        { id: "D", text: "412" },
      ],
    };
    // heuristic: digitsMax=3 → !speedEligible. Force-Fill 需要 simple → 不触发.
    // Q3 reroute 把 plain_choice → speed_match (numeric options). 然后 white-list 把 speed_match → plain_numeric.
    expect(shouldForceNumericFill(q)).toBe(false);
    expect(resolveTemplate(q)).toBe("plain_numeric");
  });

  it("简单 single_choice 数字答 → Force-Fill 改 plain_numeric", () => {
    const q: Question = {
      ...base,
      question_format: "single_choice",
      options: [
        { id: "A", text: "7" },
        { id: "B", text: "8" },
        { id: "C", text: "9" },
        { id: "D", text: "10" },
      ],
    };
    // 注: numeric_choice 已经被 FORMAT_MAP 映射 speed_match (然后白名单允许)
    // 简单 single_choice + 数字 answer → FORMAT_MAP 拿到 plain_choice, 然后 Force-Fill 改 plain_numeric
    expect(resolveTemplate(q)).toBe("plain_numeric");
  });
});
