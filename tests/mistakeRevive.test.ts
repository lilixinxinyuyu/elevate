/**
 * v0.31.68: 错题复活闭环 bug 修复测试。
 *
 * 修复前的 bug：buildReview 给到期错题随机抽同 skill 的 variant 题；service
 * advance 逻辑只认 question_id，做对 variant 不会推动原错题 → 焦点环死锁。
 *
 * 修复后行为（这两条覆盖）：
 *  1. submitAttempt 在 mode="review" + 答对 + first attempt + 无 tutor 时，
 *     即使当前 question 没有自己的 mistake row，也会推进同 skill 最早到期的
 *     那条原错题（"variant propagation"）。
 *  2. 推进事件（直接 / propagate 都算）会 +1 写到 per-day meta key，
 *     getMistakeRevivedToday 读出来。Home → TodayRings 拿这个值显示进度。
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { db } from "../src/db/dexie";
import { getMistakeRevivedToday, submitAttempt } from "../src/db/service";
import type {
  DailySession,
  MistakeReview,
  Question,
  StudentProfile,
} from "../src/core/types";

const STU = "test-student-revive";

const baseStudent: StudentProfile = {
  id: STU,
  name: "测试娃",
  currentTerm: "下册",
  currentSubject: "math",
} as unknown as StudentProfile;

function makeQuestion(over: Partial<Question>): Question {
  return {
    question_id: "Q_TEST_X",
    subjectId: "math",
    version: 1,
    status: "approved",
    grade: 4,
    term: "下册",
    unit_id: "G4B_U1_DECIMAL_ADD_SUB",
    skill_id: "decimal_add_sub_compute",
    ability_dimension: ["calculation"],
    exam_priority: "HIGH_BIG",
    game_type: "plain_choice",
    play_as: "plain_choice",
    cognitive_level: "procedural",
    difficulty: 2,
    estimated_time_seconds: 20,
    stem: "0.5 + 0.3 = ?",
    question_format: "single_choice",
    options: [
      { id: "A", text: "0.8" },
      { id: "B", text: "0.2" },
      { id: "C", text: "0.08" },
      { id: "D", text: "8" },
    ],
    answer: { type: "choice", value: "A" },
    solution_steps: ["对齐小数点直接加"],
    common_errors: [
      { tag: "decimal_align", error: "没对齐", remediation: "竖式时小数点对齐" },
      { tag: "missing_digit", error: "漏位", remediation: "补 0 占位" },
    ],
    feedback_correct: "对了！",
    feedback_wrong: "再算一下",
    hints: [{ text: "先想 5+3=8", penalty: 1 }],
    ...over,
  };
}

const reviewSession: DailySession = {
  id: "sess-r-1",
  studentId: STU,
  subjectId: "math",
  dateKey: new Date().toISOString().slice(0, 10),
  mode: "review",
  plannedMinutes: 10,
  questionIds: [],
  focusSkills: [],
  startedAt: Date.now() - 60_000,
  finishedAt: undefined,
} as unknown as DailySession;

beforeEach(async () => {
  await db.transaction(
    "rw",
    [db.attempts, db.mastery, db.mistakes, db.meta, db.sessions, db.students, db.questions],
    async () => {
      await db.attempts.clear();
      await db.mastery.clear();
      await db.mistakes.clear();
      await db.meta.clear();
      await db.sessions.clear();
      await db.students.clear();
      await db.questions.clear();
      await db.students.put(baseStudent);
    },
  );
});

afterEach(async () => {
  await db.meta.clear();
});

describe("v0.31.68 错题复活闭环修复", () => {
  it("variant 答对（first attempt + 无 tutor + mode=review）→ 推进同 skill 最早到期错题", async () => {
    // 错题：原题 Q_ORIG（同 skill），到期一天前
    const original: MistakeReview = {
      id: "m-orig",
      studentId: STU,
      subjectId: "math",
      questionId: "Q_ORIG",
      skillId: "decimal_add_sub_compute",
      stage: 0,
      nextReviewAt: Date.now() - 86_400_000,
      lastAttemptAt: Date.now() - 2 * 86_400_000,
      errorTags: [],
      resolved: false,
    };
    await db.mistakes.put(original);

    // variant 题：同 skill 但是不同 question_id
    const variant = makeQuestion({ question_id: "Q_VARIANT_1" });
    await db.questions.put(variant);

    await submitAttempt({
      studentId: STU,
      session: reviewSession,
      question: variant,
      userAnswer: "A",
      isCorrect: true,
      partialCorrect: false,
      matchedErrorTags: [],
      hintsOpened: 0,
      elapsedSeconds: 8,
      comboBeforeAttempt: 0,
      attemptOrdinal: 1,
    });

    const after = await db.mistakes.get("m-orig");
    expect(after).toBeDefined();
    // 原错题 stage 应该 +1（或 resolved）
    expect(after!.stage > 0 || after!.resolved).toBe(true);
    // nextReviewAt 应推到未来
    if (!after!.resolved) {
      expect(after!.nextReviewAt).toBeGreaterThan(Date.now());
    }
    // 计数 +1
    expect(await getMistakeRevivedToday(STU)).toBe(1);
  });

  it("variant 答对但 mode 不是 review → 不 propagate（防误伤普通练习）", async () => {
    const original: MistakeReview = {
      id: "m-orig-2",
      studentId: STU,
      subjectId: "math",
      questionId: "Q_ORIG",
      skillId: "decimal_add_sub_compute",
      stage: 0,
      nextReviewAt: Date.now() - 1000,
      lastAttemptAt: Date.now(),
      errorTags: [],
      resolved: false,
    };
    await db.mistakes.put(original);

    const variant = makeQuestion({ question_id: "Q_VAR_NORMAL" });
    await db.questions.put(variant);

    await submitAttempt({
      studentId: STU,
      session: { ...reviewSession, id: "sess-norm", mode: "normal" } as DailySession,
      question: variant,
      userAnswer: "A",
      isCorrect: true,
      partialCorrect: false,
      matchedErrorTags: [],
      hintsOpened: 0,
      elapsedSeconds: 8,
      comboBeforeAttempt: 0,
      attemptOrdinal: 1,
    });

    const after = await db.mistakes.get("m-orig-2");
    expect(after!.stage).toBe(0);
    expect(after!.resolved).toBe(false);
    expect(await getMistakeRevivedToday(STU)).toBe(0);
  });

  it("variant 答对但用了 tutor → 不 propagate（讲解过的不算复习成功）", async () => {
    const original: MistakeReview = {
      id: "m-orig-3",
      studentId: STU,
      subjectId: "math",
      questionId: "Q_ORIG",
      skillId: "decimal_add_sub_compute",
      stage: 0,
      nextReviewAt: Date.now() - 1000,
      lastAttemptAt: Date.now(),
      errorTags: [],
      resolved: false,
    };
    await db.mistakes.put(original);

    const variant = makeQuestion({ question_id: "Q_VAR_TUTOR" });
    await db.questions.put(variant);

    await submitAttempt({
      studentId: STU,
      session: reviewSession,
      question: variant,
      userAnswer: "A",
      isCorrect: true,
      partialCorrect: false,
      matchedErrorTags: [],
      hintsOpened: 0,
      elapsedSeconds: 8,
      comboBeforeAttempt: 0,
      attemptOrdinal: 1,
      usedTutor: true,
    });

    const after = await db.mistakes.get("m-orig-3");
    expect(after!.stage).toBe(0);
    expect(after!.resolved).toBe(false);
    expect(await getMistakeRevivedToday(STU)).toBe(0);
  });

  it("原题直接答对 → stage 推进 + 计数 +1（守原行为）", async () => {
    const q = makeQuestion({ question_id: "Q_DIRECT" });
    await db.questions.put(q);
    const m: MistakeReview = {
      id: "m-direct",
      studentId: STU,
      subjectId: "math",
      questionId: "Q_DIRECT",
      skillId: q.skill_id,
      stage: 0,
      nextReviewAt: Date.now() - 1000,
      lastAttemptAt: Date.now() - 86_400_000,
      errorTags: [],
      resolved: false,
    };
    await db.mistakes.put(m);

    await submitAttempt({
      studentId: STU,
      session: reviewSession,
      question: q,
      userAnswer: "A",
      isCorrect: true,
      partialCorrect: false,
      matchedErrorTags: [],
      hintsOpened: 0,
      elapsedSeconds: 8,
      comboBeforeAttempt: 0,
      attemptOrdinal: 1,
    });

    const after = await db.mistakes.get("m-direct");
    expect(after!.stage > 0 || after!.resolved).toBe(true);
    expect(await getMistakeRevivedToday(STU)).toBe(1);
  });

  it("原题已 advance 过（nextReviewAt 在未来）再做对 → 不重复计数", async () => {
    const q = makeQuestion({ question_id: "Q_NOT_DUE" });
    await db.questions.put(q);
    const m: MistakeReview = {
      id: "m-notdue",
      studentId: STU,
      subjectId: "math",
      questionId: "Q_NOT_DUE",
      skillId: q.skill_id,
      stage: 1,
      nextReviewAt: Date.now() + 86_400_000 * 3, // 3 天后才到期
      lastAttemptAt: Date.now(),
      errorTags: [],
      resolved: false,
    };
    await db.mistakes.put(m);

    await submitAttempt({
      studentId: STU,
      session: reviewSession,
      question: q,
      userAnswer: "A",
      isCorrect: true,
      partialCorrect: false,
      matchedErrorTags: [],
      hintsOpened: 0,
      elapsedSeconds: 8,
      comboBeforeAttempt: 0,
      attemptOrdinal: 1,
    });

    // 不到期就做对仍会推进 stage（v0.30.7 逻辑），但今日复活计数不该加（防把
    // 主动加练当复活算，让进度条夸张）
    expect(await getMistakeRevivedToday(STU)).toBe(0);
  });
});
