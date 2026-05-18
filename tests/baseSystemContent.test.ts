import { describe, expect, it } from "vitest";
import {
  BASE_SYSTEM_LESSONS,
  BASE_SYSTEM_XP,
  areAllLessonsComplete,
  isLessonComplete,
  loadLessonProgress,
  saveLessonProgress,
} from "../src/core/baseSystemContent";

describe("BASE_SYSTEM_LESSONS 内容完整性", () => {
  it("4 节微课", () => {
    expect(BASE_SYSTEM_LESSONS.length).toBe(4);
  });
  it("每节有 id / title / icon / punchline / conceptCard / exercises", () => {
    for (const lesson of BASE_SYSTEM_LESSONS) {
      expect(lesson.id).toBeTruthy();
      expect(lesson.title).toBeTruthy();
      expect(lesson.icon).toBeTruthy();
      expect(lesson.punchline.length).toBeGreaterThan(5);
      expect(lesson.conceptCard.length).toBeGreaterThan(50);
      expect(lesson.exercises.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("每练习有正确答案 + explanation", () => {
    for (const lesson of BASE_SYSTEM_LESSONS) {
      for (const ex of lesson.exercises) {
        expect(ex.prompt).toBeTruthy();
        expect(typeof ex.answer).toBe("number");
        expect(Number.isFinite(ex.answer)).toBe(true);
        expect(ex.explanation.length).toBeGreaterThan(5);
      }
    }
  });
  it("节 2 (60 进制) 包含'1 小时 = 100' 判断题 (评审共识专门打这个错)", () => {
    const lesson2 = BASE_SYSTEM_LESSONS.find((l) => l.id === "sexagesimal_family");
    expect(lesson2).toBeDefined();
    const judgmentQ = lesson2!.exercises.find((e) => e.prompt.includes("100 分钟"));
    expect(judgmentQ).toBeDefined();
  });
  it("节 3 (特殊进率) 强调'月不固定'", () => {
    const lesson3 = BASE_SYSTEM_LESSONS.find((l) => l.id === "special_systems");
    expect(lesson3).toBeDefined();
    expect(lesson3!.conceptCard).toMatch(/大月.*小月|不固定|28-29/);
  });
});

describe("XP 常量", () => {
  it("单题 +3, 节 +10, 全部 +20", () => {
    expect(BASE_SYSTEM_XP.EXERCISE_CORRECT).toBe(3);
    expect(BASE_SYSTEM_XP.LESSON_COMPLETE).toBe(10);
    expect(BASE_SYSTEM_XP.ALL_LESSONS_COMPLETE).toBe(20);
  });
});

describe("loadLessonProgress / saveLessonProgress (node env)", () => {
  it("node env 不 throw", () => {
    expect(() => saveLessonProgress("x", 1, 3)).not.toThrow();
    expect(loadLessonProgress()).toEqual({});
    expect(isLessonComplete("x")).toBe(false);
    expect(areAllLessonsComplete()).toBe(false);
  });
});

describe("答案数值合理性", () => {
  it("60 进制题答案符合 60 倍换算", () => {
    const lesson2 = BASE_SYSTEM_LESSONS.find((l) => l.id === "sexagesimal_family");
    expect(lesson2).toBeDefined();
    const q = lesson2!.exercises.find((e) => e.prompt.includes("2 小时"));
    expect(q?.answer).toBe(120);
  });
  it("10 进制题答案符合 10 倍换算", () => {
    const lesson1 = BASE_SYSTEM_LESSONS.find((l) => l.id === "decimal_family");
    expect(lesson1).toBeDefined();
    const q = lesson1!.exercises.find((e) => e.prompt.includes("5 米"));
    expect(q?.answer).toBe(500);
  });
});
