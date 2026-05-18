import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_PROMPTS_PER_SESSION,
  STRENGTHEN_SESSION_SIZE,
  STRENGTHEN_XP,
  calcStrengthenBonus,
  isSkillOnCooldown,
  isStrengthenBonusAlreadyAwarded,
  isStrengthenOpportunity,
  markSkillSkipped,
  markStrengthenBonusAwarded,
  pickStrengthSkillContext,
  strengthenSummaryMessage,
} from "../src/core/strengthenPolicy";
import type { Question } from "../src/core/types";

const base: Question = {
  question_id: "Q1",
  version: 1,
  status: "approved",
  grade: 4,
  term: "下册",
  unit_id: "U1",
  skill_id: "mult_3x1",
  ability_dimension: ["calculation"],
  exam_priority: "NORMAL",
  game_type: "speed_calc",
  cognitive_level: "procedural",
  difficulty: 3,
  estimated_time_seconds: 30,
  stem: "312 × 4 = ?",
  question_format: "numeric",
  answer: { type: "number", value: 1248 },
  solution_steps: ["..."],
  common_errors: [
    { tag: "a", error: "e", remediation: "r" },
    { tag: "b", error: "e", remediation: "r" },
  ],
  feedback_correct: "good",
  feedback_wrong: "再试",
};

describe("isStrengthenOpportunity", () => {
  it("答对 → 不触发", () => {
    expect(isStrengthenOpportunity(true, true, base, {})).toBe(false);
  });
  it("答错 + 1st attempt → 触发", () => {
    expect(isStrengthenOpportunity(false, true, base, {})).toBe(true);
  });
  it("2nd attempt 不触发 (已经在 retry 流)", () => {
    expect(isStrengthenOpportunity(false, false, base, {})).toBe(false);
  });
  it("examMode → 不触发", () => {
    expect(isStrengthenOpportunity(false, true, base, { examMode: true })).toBe(false);
  });
  it("noRetry (boss) → 不触发", () => {
    expect(isStrengthenOpportunity(false, true, base, { noRetry: true })).toBe(false);
  });
  it("已在 strengthen 内 → 不触发 (防嵌套)", () => {
    expect(isStrengthenOpportunity(false, true, base, { insideStrengthen: true })).toBe(false);
  });
  it("已在 mini-game (错题侦探) 内 → 不触发", () => {
    expect(isStrengthenOpportunity(false, true, base, { insideMiniGame: true })).toBe(false);
  });
  it("session cap (≥ 2) → 不触发", () => {
    expect(isStrengthenOpportunity(false, true, base, { sessionCount: 2 })).toBe(false);
  });
  it("subquestions 已分步 → 不触发", () => {
    const q = { ...base, subquestions: [{ kind: "numeric" as const, prompt: "x", value: 1 }] };
    expect(isStrengthenOpportunity(false, true, q, {})).toBe(false);
  });
});

describe("calcStrengthenBonus (评审共识降 XP)", () => {
  it("3 题全对 → +15", () => {
    expect(calcStrengthenBonus(3)).toBe(15);
  });
  it("2 题对 → +8", () => {
    expect(calcStrengthenBonus(2)).toBe(8);
  });
  it("1 题对 → +3", () => {
    expect(calcStrengthenBonus(1)).toBe(3);
  });
  it("0 → 0", () => {
    expect(calcStrengthenBonus(0)).toBe(0);
  });
  it("4+ 题对 (理论上不可能) 也 cap 15", () => {
    expect(calcStrengthenBonus(5)).toBe(15);
  });
});

describe("pickStrengthSkillContext", () => {
  it("取 skill_id + difficulty + grade + unit_id", () => {
    const ctx = pickStrengthSkillContext(base);
    expect(ctx.skill_id).toBe("mult_3x1");
    expect(ctx.difficulty).toBe(3);
    expect(ctx.excludeQuestionId).toBe("Q1");
    expect(ctx.grade).toBe(4);
    expect(ctx.unit_id).toBe("U1");
  });
});

describe("Bonus idempotency", () => {
  it("node env 调用不 throw", () => {
    expect(() => markStrengthenBonusAwarded("s1")).not.toThrow();
    expect(isStrengthenBonusAlreadyAwarded("s1")).toBe(false); // node 无 sessionStorage
  });
});

describe("Skill cooldown", () => {
  it("node env 调用不 throw", () => {
    expect(() => markSkillSkipped("mult_3x1")).not.toThrow();
    expect(isSkillOnCooldown("mult_3x1")).toBe(false); // node 无 sessionStorage
  });
});

describe("strengthenSummaryMessage", () => {
  it("3/3 正向", () => {
    expect(strengthenSummaryMessage(3)).toContain("掌握");
  });
  it("0 鼓励, 不指责", () => {
    const m = strengthenSummaryMessage(0);
    expect(m).toContain("一定会");
    expect(m).not.toContain("失败");
    expect(m).not.toContain("不及格");
  });
});

describe("常量", () => {
  it("MAX_PROMPTS_PER_SESSION = 2", () => {
    expect(MAX_PROMPTS_PER_SESSION).toBe(2);
  });
  it("STRENGTHEN_SESSION_SIZE = 3", () => {
    expect(STRENGTHEN_SESSION_SIZE).toBe(3);
  });
  it("XP cap 不超 estimation/multistep", () => {
    expect(STRENGTHEN_XP.ALL_CORRECT).toBeLessThanOrEqual(20);
  });
});
