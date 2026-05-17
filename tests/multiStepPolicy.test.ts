import { describe, expect, it } from "vitest";
import {
  MULTI_STEP_XP,
  evalEquation,
  extractAnswerUnit,
  extractKnownCandidates,
  extractQuestionCandidates,
  requiresMultiStep,
  requiresMultiStepByHeuristic,
  validateEquation,
} from "../src/core/multiStepPolicy";
import type { Question } from "../src/core/types";

const base: Question = {
  question_id: "Q",
  version: 1,
  status: "approved",
  grade: 4,
  term: "下册",
  unit_id: "U",
  skill_id: "s",
  ability_dimension: ["modeling", "calculation"],
  exam_priority: "MUST_BIG",
  game_type: "word_problem_lab",
  cognitive_level: "application",
  difficulty: 3,
  estimated_time_seconds: 60,
  stem: "小明买了 5 千克苹果, 每千克 12 元. 一共多少元?",
  question_format: "numeric",
  answer: { type: "number", value: 60 },
  solution_steps: ["..."],
  word_problem_steps: {
    known: ["5 千克苹果", "12 元/千克"],
    question: "一共多少元?",
    relationship: "总价 = 单价 × 数量",
    equation_or_expression: "5 × 12 = 60",
    check: "60 元",
  },
  common_errors: [
    { tag: "a", error: "e", remediation: "r" },
    { tag: "b", error: "e", remediation: "r" },
  ],
  feedback_correct: "good",
  feedback_wrong: "再试",
};

describe("evalEquation (shunting-yard)", () => {
  it("基本加减乘除", () => {
    expect(evalEquation("5 + 3").value).toBe(8);
    expect(evalEquation("10 - 4").value).toBe(6);
    expect(evalEquation("5 × 12").value).toBe(60);
    expect(evalEquation("20 ÷ 4").value).toBe(5);
  });
  it("括号 + 多 op", () => {
    expect(evalEquation("(5 + 3) × 2").value).toBe(16);
    expect(evalEquation("5 × 12 - 8").value).toBe(52);
    expect(evalEquation("100 ÷ (4 + 6)").value).toBe(10);
  });
  it("小数", () => {
    expect(evalEquation("3.14 × 2").value).toBeCloseTo(6.28);
  });
  it("等号: 左右一致", () => {
    const r = evalEquation("5 × 12 = 60");
    expect(r.ok).toBe(true);
    expect(r.value).toBe(60);
    expect(r.declaredResult).toBe(60);
  });
  it("等号: 左右不一致仍 parse 成功 (validation 层捕)", () => {
    const r = evalEquation("5 × 12 = 50");
    expect(r.ok).toBe(true);
    expect(r.value).toBe(60);
    expect(r.declaredResult).toBe(50);
  });
  it("空 → fail", () => {
    expect(evalEquation("").ok).toBe(false);
    expect(evalEquation("   ").ok).toBe(false);
  });
  it("除以 0 → fail", () => {
    expect(evalEquation("5 / 0").ok).toBe(false);
  });
  it("不平衡括号 → fail", () => {
    expect(evalEquation("(5 + 3").ok).toBe(false);
    expect(evalEquation("5 + 3)").ok).toBe(false);
  });
  it("非法字符 → fail", () => {
    expect(evalEquation("5 + a").ok).toBe(false);
  });
  it("负数", () => {
    expect(evalEquation("-5 + 10").value).toBe(5);
  });
});

describe("validateEquation", () => {
  it("算式 = expected (±5%) OK", () => {
    expect(validateEquation("5 × 12", 60).ok).toBe(true);
    expect(validateEquation("5 × 12 = 60", 60).ok).toBe(true);
  });
  it("declared mismatch → fail", () => {
    const r = validateEquation("5 × 12 = 50", 60);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("result_mismatch");
  });
  it("算式正确但 expected 不一致 → fail (wrong_value)", () => {
    const r = validateEquation("5 × 12", 100);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("wrong_value");
    expect(r.computed).toBe(60);
  });
});

describe("requiresMultiStep", () => {
  it("subquestions 已存在 → 不接管", () => {
    const q: Question = { ...base, subquestions: [{ kind: "numeric", prompt: "x", value: 1 }] };
    expect(requiresMultiStepByHeuristic(q)).toBe(false);
  });
  it("word_problem_steps + difficulty ≥ 3 → 触发", () => {
    expect(requiresMultiStepByHeuristic(base)).toBe(true);
  });
  it("word_problem_steps + difficulty=2 + known≥2 → 触发", () => {
    const q = { ...base, difficulty: 2 as const };
    expect(requiresMultiStepByHeuristic(q)).toBe(true);
  });
  it("word_problem_steps + difficulty=2 + known=0 → 不触发", () => {
    const q: Question = {
      ...base,
      difficulty: 2,
      word_problem_steps: { known: [], question: "?", relationship: "", equation_or_expression: "", check: "" },
    };
    expect(requiresMultiStepByHeuristic(q)).toBe(false);
  });
  it("无 word_problem_steps + difficulty < 3 → 不触发", () => {
    const q: Question = { ...base, difficulty: 2, word_problem_steps: undefined };
    expect(requiresMultiStepByHeuristic(q)).toBe(false);
  });
  it("无 word_problem_steps + difficulty=3 + hasStory + multistep → 触发 heuristic", () => {
    const q: Question = {
      ...base,
      difficulty: 3,
      word_problem_steps: undefined,
      stem: "小明买了一些苹果, 又买了几个, 一共多少?",
    };
    expect(requiresMultiStepByHeuristic(q)).toBe(true);
  });
  it("explicit true 强制开", () => {
    expect(requiresMultiStep({ ...base, requiresMultiStep: true, difficulty: 1, word_problem_steps: undefined, stem: "1+1=?" })).toBe(true);
  });
  it("explicit false 强制关", () => {
    expect(requiresMultiStep({ ...base, requiresMultiStep: false })).toBe(false);
  });
});

describe("extract helpers", () => {
  it("extractKnownCandidates from word_problem_steps", () => {
    expect(extractKnownCandidates(base)).toEqual(["5 千克苹果", "12 元/千克"]);
  });
  it("extractKnownCandidates from stem 兜底", () => {
    const q: Question = { ...base, word_problem_steps: undefined, keyNumbers: undefined };
    const c = extractKnownCandidates(q);
    expect(c.length).toBeGreaterThan(0);
  });
  it("extractQuestionCandidates", () => {
    const cands = extractQuestionCandidates(base);
    expect(cands[0]).toBe("一共多少元?");
  });
  it("extractAnswerUnit 元", () => {
    expect(extractAnswerUnit(base)).toBe("元");
  });
});

describe("MULTI_STEP_XP", () => {
  it("总 = 4 + 2 + 6 + 8 = 20", () => {
    const total = MULTI_STEP_XP.KNOWN + MULTI_STEP_XP.QUESTION + MULTI_STEP_XP.EQUATION + MULTI_STEP_XP.ANSWER;
    expect(total).toBe(20);
  });
});
