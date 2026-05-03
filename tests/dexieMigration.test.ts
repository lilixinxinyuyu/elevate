/**
 * Dexie v1 → v2 升级测试。
 *
 * 多学科架构 Phase 1：v2 在所有学生数据表加 subjectId 索引，meta 的 6 类
 * per-subject key 加 ::math:: 段。这个测试模拟 Selena 的现有数据：
 *
 * 1. 用 v1 schema 写一些样例 attempt / mastery / mistake / trophy / session +
 *    多种形态的 meta key
 * 2. 关掉 db，让 Dexie 在下次 open 时跑 v2 upgrade
 * 3. 断言所有行 stamp 了 subjectId="math"
 * 4. 断言所有 meta key 加上了 ::math:: 段
 * 5. 断言 student 有 currentSubject="math"
 *
 * 不依赖 service.ts —— 直接拿 raw IndexedDB 验证。
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import Dexie from "dexie";

const DB_NAME = "heping-math-trainer";

async function deleteDb() {
  await Dexie.delete(DB_NAME);
}

async function openV1AndSeed(): Promise<void> {
  const v1 = new Dexie(DB_NAME);
  v1.version(1).stores({
    students: "id, name, currentTerm",
    units: "id, term, orderIndex",
    skills: "id, unitId",
    questions: "question_id, skill_id, unit_id, status, game_type, difficulty",
    sessions: "id, studentId, dateKey, mode",
    attempts: "id, studentId, questionId, skillId, createdAt, sessionId",
    mastery: "id, studentId, skillId, score",
    mistakes: "id, studentId, skillId, questionId, nextReviewAt, resolved",
    trophies: "id, studentId, trophyId, unlockedAt",
    meta: "key",
  });
  await v1.open();

  await v1.table("students").put({
    id: "default-student",
    name: "Selena",
    grade: 4,
    textbook: "BNU 2025",
    currentTerm: "下册",
    dailyLimitMin: 12,
    createdAt: 1000,
    updatedAt: 2000,
  });
  await v1.table("attempts").put({
    id: "a-1",
    studentId: "default-student",
    questionId: "q-1",
    skillId: "decimal_add_sub",
    isCorrect: true,
    hintsOpened: 0,
    elapsedSeconds: 10,
    errorTags: [],
    scoreDelta: { total: 12, byAbility: {} },
    masteryDelta: 1,
    isReview: false,
    comboAtEnd: 1,
    createdAt: 1700000000000,
  });
  await v1.table("mastery").put({
    id: "default-student::decimal_add_sub",
    studentId: "default-student",
    skillId: "decimal_add_sub",
    score: 70,
    attemptsCount: 5,
    correctCount: 4,
    updatedAt: 1700000000000,
  });
  await v1.table("mistakes").put({
    id: "m-1",
    studentId: "default-student",
    questionId: "q-2",
    skillId: "equation_two_step_word",
    stage: 0,
    nextReviewAt: 1700000000000,
    lastAttemptAt: 1700000000000,
    errorTags: ["equation_setup_error"],
    resolved: false,
  });
  await v1.table("trophies").put({
    id: "t-1",
    studentId: "default-student",
    trophyId: "first_perfect",
    unlockedAt: 1700000000000,
  });
  await v1.table("sessions").put({
    id: "s-1",
    studentId: "default-student",
    dateKey: "2026-05-01",
    mode: "normal",
    plannedMinutes: 12,
    questionIds: ["q-1"],
    startedAt: 1700000000000,
  });

  // 多种形态的 meta key —— 全部 v1 形态（没有 ::math::）
  await v1.table("meta").bulkPut([
    { key: "totalXp::default-student", value: 1234 },
    { key: "rating::default-student", value: { score: 800, tierId: "city", computedAt: 1 } },
    { key: "rating::default-student::G4B", value: { score: 800, tierId: "city", computedAt: 1 } },
    { key: "tiersUnlocked::default-student::G4B", value: ["school"] },
    { key: "equippedBadge::default-student", value: "school" },
    { key: "selectedTerm::default-student", value: "下册" },
    { key: "mockExamLastAt::default-student", value: 1700000000000 },
    // 学科无关的 key 保持原样
    { key: "seedVersion", value: 18 },
    { key: "scoreVersion", value: 5 },
  ]);

  v1.close();
}

async function openV2(): Promise<Dexie> {
  // 必须用项目里那份 dexie.ts 的同名 DB + version(2) 升级链；最稳妥是 import 项目本体
  const { db } = await import("../src/db/dexie");
  await db.open();
  return db as unknown as Dexie;
}

describe("Dexie v2 多学科 upgrade", () => {
  beforeEach(async () => {
    await deleteDb();
  });
  afterEach(async () => {
    await deleteDb();
  });

  test("所有学生数据表的旧行被 stamp 上 subjectId='math'", async () => {
    await openV1AndSeed();
    const db = await openV2();

    const attempt = await db.table("attempts").get("a-1");
    expect(attempt?.subjectId).toBe("math");

    const mastery = await db.table("mastery").get("default-student::decimal_add_sub");
    expect(mastery?.subjectId).toBe("math");

    const mistake = await db.table("mistakes").get("m-1");
    expect(mistake?.subjectId).toBe("math");

    const trophy = await db.table("trophies").get("t-1");
    expect(trophy?.subjectId).toBe("math");

    const session = await db.table("sessions").get("s-1");
    expect(session?.subjectId).toBe("math");

    db.close();
  });

  test("students 表加上 currentSubject='math'", async () => {
    await openV1AndSeed();
    const db = await openV2();
    const stu = await db.table("students").get("default-student");
    expect(stu?.currentSubject).toBe("math");
    db.close();
  });

  test("per-subject meta key 加上 ::math:: 段", async () => {
    await openV1AndSeed();
    const db = await openV2();

    // 所有六类 per-subject key 应该被改成新形态
    const xp = await db.table("meta").get("totalXp::math::default-student");
    expect(xp?.value).toBe(1234);

    const ratingNoTerm = await db.table("meta").get("rating::math::default-student");
    expect(ratingNoTerm).toBeDefined();

    const ratingTerm = await db.table("meta").get("rating::math::default-student::G4B");
    expect(ratingTerm).toBeDefined();

    const tiers = await db.table("meta").get("tiersUnlocked::math::default-student::G4B");
    expect(tiers).toBeDefined();

    const badge = await db.table("meta").get("equippedBadge::math::default-student");
    expect(badge?.value).toBe("school");

    const term = await db.table("meta").get("selectedTerm::math::default-student");
    expect(term?.value).toBe("下册");

    const mockExam = await db.table("meta").get("mockExamLastAt::math::default-student");
    expect(mockExam?.value).toBe(1700000000000);

    // 旧 key 应该被删
    const oldXp = await db.table("meta").get("totalXp::default-student");
    expect(oldXp).toBeUndefined();
    const oldTerm = await db.table("meta").get("selectedTerm::default-student");
    expect(oldTerm).toBeUndefined();

    db.close();
  });

  test("学科无关的 meta key 保持原样不动", async () => {
    await openV1AndSeed();
    const db = await openV2();

    const seedV = await db.table("meta").get("seedVersion");
    expect(seedV?.value).toBe(18);

    const scoreV = await db.table("meta").get("scoreVersion");
    expect(scoreV?.value).toBe(5);

    db.close();
  });

  test("每个学生记一条 selectedSubject::<id> = 'math'", async () => {
    await openV1AndSeed();
    const db = await openV2();
    const sub = await db.table("meta").get("selectedSubject::default-student");
    expect(sub?.value).toBe("math");
    db.close();
  });
});
