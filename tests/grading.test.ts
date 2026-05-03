import { describe, expect, it } from "vitest";
import { coerceNumber, gradeAttempt } from "../src/core/grading";
import type { Question } from "../src/core/types";

const numericQ: Question = {
  question_id: "N1",
  version: 1,
  status: "approved",
  grade: 4,
  term: "下册",
  unit_id: "G4B_U3_DECIMAL_MULTIPLY",
  skill_id: "decimal_price_quantity",
  ability_dimension: ["calculation"],
  exam_priority: "MUST_BIG",
  game_type: "speed_calc",
  cognitive_level: "procedural",
  difficulty: 2,
  estimated_time_seconds: 30,
  stem: "3.8*6",
  question_format: "numeric",
  answer: { type: "number", value: 22.8, unit: "元" },
  solution_steps: ["..."],
  common_errors: [
    { tag: "decimal_point_error", error: "", remediation: "" },
    { tag: "careless_reading", error: "", remediation: "" },
  ],
  feedback_correct: "",
  feedback_wrong: "再看看",
};

describe("grading", () => {
  it("数字字符串、带单位、归一化小数都接受", () => {
    expect(gradeAttempt(numericQ, "22.8").isCorrect).toBe(true);
    expect(gradeAttempt(numericQ, "22.80").isCorrect).toBe(true);
    expect(gradeAttempt(numericQ, 22.8).isCorrect).toBe(true);
    expect(gradeAttempt(numericQ, "22.8 元").isCorrect).toBe(true);
    expect(gradeAttempt(numericQ, "22.8元").isCorrect).toBe(true);
    expect(gradeAttempt(numericQ, "22元8角").isCorrect).toBe(true);
    expect(gradeAttempt(numericQ, "3.8*6").isCorrect).toBe(true);
  });

  it("coerceNumber 对常见中文单位宽松", () => {
    expect(coerceNumber("150 厘米")).toBe(150);
    expect(coerceNumber("3.6 千米")).toBe(3.6);
    expect(coerceNumber("12 本")).toBe(12);
  });

  it("小数点错识别", () => {
    const r = gradeAttempt(numericQ, "228");
    expect(r.isCorrect).toBe(false);
    expect(r.matchedErrorTags).toContain("decimal_point_error");
  });

  it("multi_step：关系错但答案对仍算通过", () => {
    const q: Question = {
      ...numericQ,
      question_id: "M1",
      question_format: "multi_step",
      answer: {
        type: "multi_step",
        steps: [
          { step_id: "relationship", expected: "总价=单价×数量" },
          { step_id: "expression", expected: "3.8*6" },
          { step_id: "answer", expected: 22.8 },
        ],
      },
    };
    const r1 = gradeAttempt(q, { relationship: "总价=单价×数量", expression: "3.8*6", answer: "22.8" });
    expect(r1.isCorrect).toBe(true);
    expect(r1.allStepsCorrect).toBe(true);

    const r2 = gradeAttempt(q, { relationship: "错", expression: "3.8*6", answer: "22.8" });
    expect(r2.isCorrect).toBe(true);
    expect(r2.allStepsCorrect).toBe(false);
    expect(r2.matchedErrorTags).toContain("relation_model_error");
  });
});
