import { describe, expect, it } from "vitest";
import { validateQuestion } from "../src/core/validateQuestion";
import type { Question } from "../src/core/types";
import { SEED_QUESTIONS } from "../src/content/questions";

const good: Question = {
  question_id: "TEST_ok_1",
  version: 1,
  status: "approved",
  grade: 4,
  term: "下册",
  unit_id: "G4B_U3_DECIMAL_MULTIPLY",
  skill_id: "decimal_price_quantity",
  ability_dimension: ["modeling", "calculation"],
  exam_priority: "MUST_BIG",
  game_type: "decimal_shop",
  cognitive_level: "application",
  difficulty: 3,
  estimated_time_seconds: 90,
  stem: "一支笔 2 元，买 3 支多少元？",
  question_format: "numeric",
  answer: { type: "number", value: 6, unit: "元" },
  solution_steps: ["2×3=6"],
  word_problem_steps: {
    known: ["2 元/支", "3 支"],
    question: "一共多少元",
    relationship: "总价=单价×数量",
    equation_or_expression: "2*3",
    check: "6÷3=2",
  },
  common_errors: [
    { tag: "careless_reading", error: "看错", remediation: "再读题" },
    { tag: "no_unit_answer", error: "忘单位", remediation: "带单位" },
  ],
  feedback_correct: "漂亮！",
  feedback_wrong: "再看看单价×数量，算一遍。",
};

describe("validateQuestion", () => {
  it("合格题通过校验", () => {
    expect(validateQuestion(good).ok).toBe(true);
  });

  it("缺字段会被拒绝", () => {
    const bad = { ...good } as Record<string, unknown>;
    delete bad.stem;
    const r = validateQuestion(bad);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.path === "stem")).toBe(true);
  });

  it("拒绝超纲词", () => {
    const r = validateQuestion({ ...good, stem: "这是一个比例问题：…" });
    expect(r.ok).toBe(false);
  });

  it("拒绝手机号/身份证", () => {
    const r = validateQuestion({ ...good, parent_tip: "联系 13812345678 即可。" });
    expect(r.ok).toBe(false);
  });

  it("拓展题必须 difficulty=5", () => {
    const r = validateQuestion({ ...good, exam_priority: "EXTENSION", difficulty: 3 });
    expect(r.ok).toBe(false);
  });

  it("skill 必须属于 unit", () => {
    const r = validateQuestion({ ...good, skill_id: "equation_solve_simple" });
    expect(r.ok).toBe(false);
  });

  it("选择题必须提供 options 和匹配的 choice 答案", () => {
    const r = validateQuestion({
      ...good,
      question_format: "single_choice",
      options: [{ id: "A", text: "1" }],
      answer: { type: "choice", value: "Z" },
    });
    expect(r.ok).toBe(false);
  });

  it("自验算能发现错答", () => {
    const r = validateQuestion({
      ...good,
      answer: { type: "number", value: 999, unit: "元" },
    });
    expect(r.issues.some((i) => i.path === "answer.value")).toBe(true);
  });

  it("所有 seed 题目通过校验", () => {
    const failures = SEED_QUESTIONS.map((q) => ({ id: q.question_id, r: validateQuestion(q) }))
      .filter((x) => !x.r.ok);
    if (failures.length > 0) {
      const msgs = failures
        .flatMap((f) => f.r.issues.map((i) => `${f.id} ${i.severity} ${i.path} ${i.message}`))
        .join("\n");
      throw new Error("种子题目有校验失败：\n" + msgs);
    }
    expect(failures.length).toBe(0);
  });
});
