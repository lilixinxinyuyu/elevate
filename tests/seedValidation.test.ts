import { describe, expect, it } from "vitest";
import { SEED_QUESTIONS } from "../src/content/questions";
import { validateQuestion } from "../src/core/validateQuestion";

describe("seed validation", () => {
  it("所有 SEED_QUESTIONS 通过 validateQuestion", () => {
    const bad: { id: string; problems: string[] }[] = [];
    for (const q of SEED_QUESTIONS) {
      const r = validateQuestion(q);
      if (!r.ok) bad.push({ id: q.question_id, problems: r.issues.map((i) => i.message).slice(0, 2) });
    }
    if (bad.length > 0) {
      console.log("validation failures:", JSON.stringify(bad.slice(0, 20), null, 2));
    }
    expect(bad.length).toBe(0);
  });

  it("examPaperPack 至少 80 题，且都带 from_test 标签", () => {
    const fromTest = SEED_QUESTIONS.filter((q) => q.tags?.includes("from_test"));
    expect(fromTest.length).toBeGreaterThanOrEqual(80);
    const wrongOrigin = fromTest.filter((q) => q.tags?.includes("wrong_origin"));
    expect(wrongOrigin.length).toBeGreaterThan(15);
  });
});
