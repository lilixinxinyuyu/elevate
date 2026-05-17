import { describe, expect, it } from "vitest";
import { normalizeAiQuestion } from "../aliyun-deploy/src/lib/normalizeAiQuestion";

describe("normalizeAiQuestion — Q3 fix #1 generator side", () => {
  // R1: 这就是真 source bug — LLM 把数字题误标 single_choice 灌进去
  it("R1.numeric_choice: numeric answer + single_choice + numeric options → numeric_choice", () => {
    const { q, report } = normalizeAiQuestion({
      stem: "3.8*6",
      question_format: "single_choice",
      answer: { type: "number", value: 22.8 },
      options: [
        { id: "a", text: "22.8" },
        { id: "b", text: "20.8" },
        { id: "c", text: "228" },
        { id: "d", text: "2.28" },
      ],
    });
    expect(q.question_format).toBe("numeric_choice");
    expect(Array.isArray(q.options)).toBe(true);
    expect(report.rules).toContain("R1.numeric_choice");
    expect(report.changed).toBe(true);
    const tags = q.tags as string[];
    expect(tags).toContain("normalized_ai");
    expect(tags).toContain("norm:R1.numeric_choice");
  });

  it("R1.numeric: numeric answer + single_choice + 非 numeric options → numeric, 丢 options", () => {
    const { q, report } = normalizeAiQuestion({
      stem: "下面哪个图形正确",
      question_format: "single_choice",
      answer: { type: "number", value: 5 },
      options: [
        { id: "a", text: "正方形" },
        { id: "b", text: "长方形" },
      ],
    });
    expect(q.question_format).toBe("numeric");
    expect(q.options).toBeUndefined();
    expect(report.rules).toContain("R1.numeric");
  });

  it("R1.numeric_choice: 单位带 element 也算 numeric ('22.8 元')", () => {
    const { q } = normalizeAiQuestion({
      stem: "买 6 支笔, 3.8 元/支, 共多少",
      question_format: "single_choice",
      answer: { type: "number", value: 22.8 },
      options: [
        { id: "a", text: "22.8 元" },
        { id: "b", text: "20.8 元" },
        { id: "c", text: "228 元" },
        { id: "d", text: "2.28 元" },
      ],
    });
    expect(q.question_format).toBe("numeric_choice");
  });

  it("R2: subquestions 数组 0 或 1 元素 → 丢掉", () => {
    const { q: q1, report: r1 } = normalizeAiQuestion({
      stem: "x",
      subquestions: [],
      answer: { type: "number", value: 1 },
    });
    expect(q1.subquestions).toBeUndefined();
    expect(r1.rules).toContain("R2");

    const { q: q2, report: r2 } = normalizeAiQuestion({
      stem: "y",
      subquestions: [{ kind: "numeric", prompt: "?", value: 5 }],
      answer: { type: "number", value: 5 },
    });
    expect(q2.subquestions).toBeUndefined();
    expect(r2.rules).toContain("R2");
  });

  it("R2: 真 multi_step (≥2 subquestions) 保留", () => {
    const { q, report } = normalizeAiQuestion({
      stem: "z",
      subquestions: [
        { kind: "numeric", prompt: "p1", value: 5 },
        { kind: "numeric", prompt: "p2", value: 10 },
      ],
      answer: { type: "multi_step", steps: [] },
    });
    expect(q.subquestions).toEqual([
      { kind: "numeric", prompt: "p1", value: 5 },
      { kind: "numeric", prompt: "p2", value: 10 },
    ]);
    expect(report.rules).not.toContain("R2");
  });

  it("R3 warning: choice answer 但没 options", () => {
    const { report } = normalizeAiQuestion({
      stem: "x",
      question_format: "single_choice",
      answer: { type: "choice", value: "a" },
      // options 缺失
    });
    expect(report.warnings.length).toBeGreaterThanOrEqual(1);
    expect(report.warnings[0]).toMatch(/R3/);
  });

  it("R3 warning: choice value 不在 options 里", () => {
    const { report } = normalizeAiQuestion({
      stem: "x",
      question_format: "single_choice",
      answer: { type: "choice", value: "z" },
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
    });
    expect(report.warnings.some((w) => /R3/.test(w) && /z/.test(w))).toBe(true);
  });

  it("R4: numeric answer 字符串 value → 转数字", () => {
    const { q, report } = normalizeAiQuestion({
      stem: "x",
      question_format: "numeric",
      answer: { type: "number", value: "22.8" },
    });
    expect((q.answer as { value: number }).value).toBe(22.8);
    expect(report.rules).toContain("R4");
  });

  it("R4 warning: numeric value 是非数字字符串", () => {
    const { q, report } = normalizeAiQuestion({
      stem: "x",
      question_format: "numeric",
      answer: { type: "number", value: "abc" },
    });
    expect((q.answer as { value: unknown }).value).toBe("abc"); // 不动
    expect(report.warnings.some((w) => /R4/.test(w))).toBe(true);
  });

  it("正常 single_choice + choice answer 不动", () => {
    const { q, report } = normalizeAiQuestion({
      stem: "x",
      question_format: "single_choice",
      answer: { type: "choice", value: "b" },
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
    });
    expect(q.question_format).toBe("single_choice");
    expect(report.changed).toBe(false);
    expect(report.warnings).toEqual([]);
  });

  it("正常 numeric + numeric format 不动", () => {
    const { q, report } = normalizeAiQuestion({
      stem: "x",
      question_format: "numeric",
      answer: { type: "number", value: 5 },
    });
    expect(q.question_format).toBe("numeric");
    expect(report.changed).toBe(false);
  });
});
