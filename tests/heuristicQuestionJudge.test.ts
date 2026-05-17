import { describe, expect, it } from "vitest";
import { judgeAiQuestionHeuristic, judgeAiQuestionBatch } from "../aliyun-deploy/src/lib/heuristicQuestionJudge";

describe("heuristicQuestionJudge — iter 20 拒烂题守门", () => {
  it("正常 numeric 题 → keep severity 1 (含 hints + solution_steps + common_errors)", () => {
    const r = judgeAiQuestionHeuristic({
      question_id: "q1",
      stem: "3.8 × 6 = ?",
      question_format: "numeric",
      answer: { type: "number", value: 22.8 },
      hints: [{ text: "想想 4×6" }],
      solution_steps: ["3.8×6 = 22.8"],
      common_errors: [{ tag: "decimal_point_error" }],
    });
    expect(r.verdict).toBe("keep");
    expect(r.severity).toBe(1);
  });

  it("缺 stem → reject severity 5", () => {
    const r = judgeAiQuestionHeuristic({
      question_id: "q1",
      answer: { type: "number", value: 1 },
    });
    expect(r.verdict).toBe("reject");
    expect(r.severity).toBe(5);
    expect(r.reasons).toContain("missing_stem");
  });

  it("stem 太短 (<5 chars) → reject severity 5", () => {
    const r = judgeAiQuestionHeuristic({
      question_id: "q1",
      stem: "?",
      answer: { type: "number", value: 1 },
    });
    expect(r.verdict).toBe("reject");
    expect(r.severity).toBe(5);
  });

  it("answer value null → reject", () => {
    const r = judgeAiQuestionHeuristic({
      question_id: "q1",
      stem: "正常的题面长度",
      answer: { type: "number", value: null },
    });
    expect(r.verdict).toBe("reject");
    expect(r.reasons).toContain("answer_value_null");
  });

  it("numeric answer 非数字 → reject", () => {
    const r = judgeAiQuestionHeuristic({
      question_id: "q1",
      stem: "正常的题面",
      answer: { type: "number", value: "abc" },
    });
    expect(r.verdict).toBe("reject");
    expect(r.severity).toBe(5);
  });

  it("choice answer value 不在 options.id → reject", () => {
    const r = judgeAiQuestionHeuristic({
      question_id: "q1",
      stem: "下面哪个数最大?", // stem >=5 chars
      question_format: "single_choice",
      answer: { type: "choice", value: "z" },
      options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
    });
    expect(r.verdict).toBe("reject");
    expect(r.reasons.join(",")).toMatch(/answer_id_not_in_options/);
  });

  it("single_choice 没 options → reject", () => {
    const r = judgeAiQuestionHeuristic({
      question_id: "q1",
      stem: "下面哪个数最大?",
      question_format: "single_choice",
      answer: { type: "choice", value: "a" },
      options: [{ id: "a", text: "A" }],
    });
    expect(r.verdict).toBe("reject");
  });

  it("stem 含 (无关) 占位符 → reject", () => {
    const r = judgeAiQuestionHeuristic({
      question_id: "q1",
      stem: "X (无关) 的速度是多少",
      answer: { type: "number", value: 5 },
    });
    expect(r.verdict).toBe("reject");
    expect(r.reasons).toContain("stem_has_placeholder");
  });

  it("缺 hints/solution_steps/common_errors → borderline severity 2", () => {
    const r = judgeAiQuestionHeuristic({
      question_id: "q1",
      stem: "3.8 × 6 = ?",
      question_format: "numeric",
      answer: { type: "number", value: 22.8 },
      // 没 hints, 没 solution_steps, 没 common_errors
    });
    expect(r.verdict).toBe("borderline");
    expect(r.reasons).toContain("no_solution_steps");
    expect(r.reasons).toContain("no_hints");
    expect(r.reasons).toContain("no_common_errors");
  });

  it("正常 choice 题 → keep", () => {
    const r = judgeAiQuestionHeuristic({
      question_id: "q1",
      stem: "下面哪个是质数",
      question_format: "single_choice",
      answer: { type: "choice", value: "b" },
      options: [{ id: "a", text: "4" }, { id: "b", text: "7" }, { id: "c", text: "9" }],
      hints: [{ text: "质数定义" }],
      solution_steps: ["质数是只有 1 和自身两个因数的数"],
      common_errors: [{ tag: "not_prime" }],
    });
    expect(r.verdict).toBe("keep");
  });

  it("batch: 混合 keep/reject/borderline 分桶正确", () => {
    const r = judgeAiQuestionBatch([
      { question_id: "good", stem: "1+1=?", answer: { type: "number", value: 2 }, hints: [1], solution_steps: [1], common_errors: [1] },
      { question_id: "bad-empty", stem: "" },
      { question_id: "bad-placeholder", stem: "X (无关) 的", answer: { type: "number", value: 1 } },
      { question_id: "border", stem: "What is 2+2", answer: { type: "number", value: 4 } },
    ]);
    expect(r.kept.length).toBe(2); // good + border
    expect(r.rejected.length).toBe(2); // empty + placeholder
    expect(r.borderline.length).toBe(1); // border
    expect((r.kept[0]! as Record<string, unknown>)._judge).toBeDefined();
  });
});
