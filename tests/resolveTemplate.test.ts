import { describe, expect, it } from "vitest";
import { resolveTemplate } from "../src/components/game/templates/resolve";
import type { Question } from "../src/core/types";

const baseQ: Omit<Question, "question_format" | "answer" | "options"> = {
  question_id: "X1",
  version: 1,
  status: "approved",
  grade: 4,
  term: "下册",
  unit_id: "U",
  skill_id: "s",
  ability_dimension: ["calculation"],
  exam_priority: "MUST_BIG",
  game_type: "speed_calc",
  cognitive_level: "procedural",
  difficulty: 2,
  estimated_time_seconds: 30,
  stem: "3.8*6 = ?",
  solution_steps: ["..."],
  common_errors: [],
  feedback_correct: "",
  feedback_wrong: "",
};

describe("resolveTemplate — Q3 fix #1 真 source 防护", () => {
  // Ep爸爸 2026-05-17 Q3 fix #1: AI 出 numeric 题误标 single_choice 时,
  // 老 resolve → plain_choice → correctId=null → 用户怎么选都判错。
  // 修：answer.type==="number" 不能落到纯 choice 模板。
  it("numeric answer + single_choice format + numeric options → speed_match (重路由)", () => {
    const q: Question = {
      ...baseQ,
      question_format: "single_choice",
      answer: { type: "number", value: 22.8 },
      options: [
        { id: "A", text: "22.8" },
        { id: "B", text: "20.8" },
        { id: "C", text: "228" },
        { id: "D", text: "2.28" },
      ],
    };
    expect(resolveTemplate(q)).toBe("speed_match");
  });

  it("numeric answer + single_choice format + 无 numeric options → plain_numeric", () => {
    const q: Question = {
      ...baseQ,
      question_format: "single_choice",
      answer: { type: "number", value: 22.8 },
      // 只有 2 个选项 + 1 个不是数字 → 不算"numeric options"
      options: [
        { id: "A", text: "正确" },
      ],
    };
    expect(resolveTemplate(q)).toBe("plain_numeric");
  });

  it("numeric answer + question_format: numeric → speed_match 正常", () => {
    const q: Question = {
      ...baseQ,
      question_format: "numeric",
      answer: { type: "number", value: 22.8 },
    };
    expect(resolveTemplate(q)).toBe("speed_match");
  });

  it("choice answer + single_choice → plain_choice 正常通过", () => {
    const q: Question = {
      ...baseQ,
      question_format: "single_choice",
      answer: { type: "choice", value: "b" },
      options: [
        { id: "a", text: "对" },
        { id: "b", text: "错" },
      ],
    };
    expect(resolveTemplate(q)).toBe("plain_choice");
  });

  it("numeric answer + play_as: plain_choice (强制指定) 仍然被重路由", () => {
    // play_as 是显式指定，但 numeric/choice 不匹配的本质 bug 不变 → 守卫一律重路由
    const q: Question = {
      ...baseQ,
      play_as: "plain_choice",
      question_format: "single_choice",
      answer: { type: "number", value: 5 },
      options: [
        { id: "A", text: "5" },
        { id: "B", text: "6" },
        { id: "C", text: "7" },
        { id: "D", text: "8" },
      ],
    };
    expect(resolveTemplate(q)).toBe("speed_match");
  });

  it("numeric answer + clue_finder 也会被重路由 (multi_choice 路径)", () => {
    const q: Question = {
      ...baseQ,
      question_format: "multi_choice",
      answer: { type: "number", value: 10 },
      options: [
        { id: "A", text: "10" },
        { id: "B", text: "12" },
        { id: "C", text: "8" },
      ],
    };
    expect(resolveTemplate(q)).toBe("speed_match");
  });
});
