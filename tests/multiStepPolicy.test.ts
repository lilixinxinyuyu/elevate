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

  // v0.35.17 iter 47 P0-3.1: heuristic 命中率提升回归
  // 老 v1 只 2 个 regex (求 X / 一总共), G4B 真题命中 ~40%.
  // 新版加 15+ 模式 + 句子切分, 目标 80%+.
  describe("extractQuestionCandidates — v0.35.17 多模式覆盖", () => {
    function makeQ(stem: string): Question {
      return { ...base, stem, word_problem_steps: undefined };
    }

    it("'剩' 模式: 妈妈买苹果用了 30 元, 还剩多少钱?", () => {
      const c = extractQuestionCandidates(makeQ("妈妈带了 100 元, 用了 30 元, 还剩多少钱?"));
      expect(c.some((s) => s.includes("还剩"))).toBe(true);
    });
    it("'比 X 多 / 少' 模式", () => {
      const c = extractQuestionCandidates(makeQ("小明 12 岁, 比小红大 3 岁, 小红几岁?"));
      // "几岁?" 应当被 几X 模式捕获
      expect(c.some((s) => /[几]/.test(s))).toBe(true);
    });
    it("'够 / 不够' 模式", () => {
      const c = extractQuestionCandidates(makeQ("妈妈给小明 50 元买文具用 38 元, 够吗?"));
      expect(c.length).toBeGreaterThan(0);
    });
    it("'面积 / 周长' 模式", () => {
      const c = extractQuestionCandidates(makeQ("长方形长 8 米宽 5 米, 周长是多少米?"));
      expect(c.some((s) => s.includes("周长"))).toBe(true);
    });
    it("'平均' 模式", () => {
      const c = extractQuestionCandidates(makeQ("4 个班级共 120 人, 平均每个班多少人?"));
      expect(c.some((s) => s.includes("平均"))).toBe(true);
    });
    it("'速度 / 路程 / 时间' 模式", () => {
      const c = extractQuestionCandidates(makeQ("车 2 小时走 120 千米, 速度是多少?"));
      expect(c.some((s) => s.includes("速度"))).toBe(true);
    });
    it("'节约' 模式", () => {
      const c = extractQuestionCandidates(makeQ("原价 80 元打 7 折, 节约多少钱?"));
      expect(c.some((s) => s.includes("节约"))).toBe(true);
    });
    it("短问题整句作候选", () => {
      const c = extractQuestionCandidates(makeQ("一共有多少?"));
      expect(c[0]).toBe("一共有多少");
    });
    it("无问号 fallback 不崩", () => {
      const c = extractQuestionCandidates(makeQ("小明买了 3 个苹果."));
      // 不报错就行; 可能 0 候选 (实际无 question), 这种由 manual input 兜底
      expect(Array.isArray(c)).toBe(true);
    });
    it("多模式同时命中 → 去重 + 最多 4", () => {
      const c = extractQuestionCandidates(
        makeQ("一共多少元? 还剩多少元? 平均每个多少元?"),
      );
      expect(c.length).toBeLessThanOrEqual(4);
      expect(new Set(c).size).toBe(c.length); // 去重
    });
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
