import { describe, expect, it } from "vitest";
import { computeMockExamReport } from "../src/core/mockExamReport";
import type { Attempt, Question } from "../src/core/types";

function mkAttempt(overrides: Partial<Attempt>): Attempt {
  return {
    id: "a-" + Math.random(),
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

function mkQuestion(overrides: Partial<Question>): Question {
  return {
    question_id: "q",
    version: 1,
    status: "approved",
    grade: 4,
    term: "下册",
    unit_id: "U",
    skill_id: "addition",
    ability_dimension: ["calculation"],
    exam_priority: "NORMAL",
    game_type: "speed_calc",
    cognitive_level: "procedural",
    difficulty: 2,
    estimated_time_seconds: 30,
    stem: "3+5=?",
    question_format: "numeric",
    answer: { type: "number", value: 8 },
    solution_steps: ["..."],
    common_errors: [],
    feedback_correct: "",
    feedback_wrong: "",
    ...overrides,
  } as Question;
}

describe("computeMockExamReport (基础)", () => {
  it("空 attempts → 0/0", () => {
    const report = computeMockExamReport([], new Map());
    expect(report.totalCorrect).toBe(0);
    expect(report.totalQuestions).toBe(0);
    expect(report.scorePercent).toBe(0);
  });

  it("总分计算", () => {
    const attempts = [
      mkAttempt({ questionId: "q1", isCorrect: true }),
      mkAttempt({ questionId: "q2", isCorrect: true }),
      mkAttempt({ questionId: "q3", isCorrect: false }),
    ];
    const qmap = new Map<string, Question>([
      ["q1", mkQuestion({ question_id: "q1" })],
      ["q2", mkQuestion({ question_id: "q2" })],
      ["q3", mkQuestion({ question_id: "q3" })],
    ]);
    const report = computeMockExamReport(attempts, qmap);
    expect(report.totalCorrect).toBe(2);
    expect(report.totalQuestions).toBe(3);
    expect(report.scorePercent).toBe(67);
  });

  it("同一题多次 attempt 只算第 1 次", () => {
    const attempts = [
      mkAttempt({ questionId: "q1", isCorrect: false, createdAt: 1000 }), // 1st 错
      mkAttempt({ questionId: "q1", isCorrect: true, createdAt: 2000 }),  // 2nd 对
    ];
    const qmap = new Map<string, Question>([["q1", mkQuestion({ question_id: "q1" })]]);
    const report = computeMockExamReport(attempts, qmap);
    expect(report.totalCorrect).toBe(0); // 第 1 次错
    expect(report.totalQuestions).toBe(1);
  });
});

describe("题型分类", () => {
  it("应用题 (word_problem_steps) → word_problem", () => {
    const q = mkQuestion({
      question_id: "wp",
      stem: "小明买苹果...",
      word_problem_steps: { known: ["a"], question: "?", relationship: "", equation_or_expression: "", check: "" },
    });
    const report = computeMockExamReport(
      [mkAttempt({ questionId: "wp", isCorrect: true })],
      new Map([["wp", q]]),
    );
    expect(report.byCategory.find((c) => c.label === "应用题")?.total).toBe(1);
  });

  it("3 位数计算 → multi_digit_calc", () => {
    const q = mkQuestion({ question_id: "mdc", stem: "312 + 47", difficulty: 3 });
    const report = computeMockExamReport(
      [mkAttempt({ questionId: "mdc", isCorrect: false })],
      new Map([["mdc", q]]),
    );
    expect(report.byCategory.find((c) => c.label === "多位计算")?.total).toBe(1);
  });

  it("单位换算 skill_id → unit_conversion", () => {
    const q = mkQuestion({ question_id: "uc", skill_id: "unit_conversion", stem: "1 米 = ? 厘米" });
    const report = computeMockExamReport(
      [mkAttempt({ questionId: "uc", isCorrect: true })],
      new Map([["uc", q]]),
    );
    expect(report.byCategory.find((c) => c.label === "单位换算")?.total).toBe(1);
  });

  it("观察物体 (skill=observe_front_top_left) → geometry, 不再散进口算/其它", () => {
    const q = mkQuestion({ question_id: "ob", skill_id: "observe_front_top_left", stem: "从正面看这个几何体是什么形状?", difficulty: 2 });
    const report = computeMockExamReport(
      [mkAttempt({ questionId: "ob", isCorrect: false })],
      new Map([["ob", q]]),
    );
    expect(report.byCategory.find((c) => c.label === "几何")?.total).toBe(1);
    expect(report.byCategory.find((c) => c.label === "口算")).toBeUndefined();
    expect(report.byCategory.find((c) => c.label === "其它")).toBeUndefined();
  });
});

describe("错题诊断 (评审 B 阈值规则)", () => {
  it("count < 2 + 非高风险 → 不显示", () => {
    // 估算 magnitudeMismatch 不在高风险列表里, count=1 应该不显示
    const attempts = [
      mkAttempt({
        questionId: "q1",
        isCorrect: false,
        metadata: { estimationGate: { magnitudeMismatch: true } },
      }),
    ];
    const qmap = new Map<string, Question>([["q1", mkQuestion({ question_id: "q1" })]]);
    const report = computeMockExamReport(attempts, qmap);
    expect(report.diagnoses.length).toBe(0);
  });

  it("count ≥ 2 → 显示", () => {
    const attempts = [
      mkAttempt({ questionId: "q1", isCorrect: false, metadata: { estimationGate: { magnitudeMismatch: true } } }),
      mkAttempt({ questionId: "q2", isCorrect: false, metadata: { estimationGate: { magnitudeMismatch: true } } }),
    ];
    const qmap = new Map<string, Question>([
      ["q1", mkQuestion({ question_id: "q1" })],
      ["q2", mkQuestion({ question_id: "q2" })],
    ]);
    const report = computeMockExamReport(attempts, qmap);
    expect(report.diagnoses.length).toBe(1);
    expect(report.diagnoses[0]?.count).toBe(2);
  });

  it("高风险类型 (单位错) count=1 也显示", () => {
    const q = mkQuestion({ question_id: "uc", skill_id: "unit_conversion" });
    const report = computeMockExamReport(
      [mkAttempt({ questionId: "uc", isCorrect: false })],
      new Map([["uc", q]]),
    );
    const hasUnit = report.diagnoses.some((d) => d.category.includes("单位"));
    expect(hasUnit).toBe(true);
  });

  it("最多 Top 3", () => {
    // 制造 5 种不同诊断 (没用草稿 + 估算 + 算式 + 单位 + ...) 都 count ≥ 2
    const attempts: Attempt[] = [];
    for (let i = 0; i < 6; i++) {
      attempts.push(mkAttempt({
        questionId: `q-${i}-a`,
        isCorrect: false,
        metadata: { estimationGate: { magnitudeMismatch: true }, scratch: { tool: "direct_bypass" } },
      }));
      attempts.push(mkAttempt({
        questionId: `q-${i}-b`,
        isCorrect: false,
        metadata: { multiStep: { phasePass: [true, true, false, false] } },
      }));
    }
    const qmap = new Map<string, Question>();
    for (const a of attempts) qmap.set(a.questionId, mkQuestion({ question_id: a.questionId }));
    const report = computeMockExamReport(attempts, qmap);
    expect(report.diagnoses.length).toBeLessThanOrEqual(3);
  });
});
