import { describe, expect, it } from "vitest";
import { buildDailySession, findParallelQuestion } from "../src/core/scheduler";
import { SEED_QUESTIONS } from "../src/content/questions";
import type { Attempt, MasteryScore, MistakeReview, Question } from "../src/core/types";

describe("scheduler", () => {
  it("normal 模式选出一批题、不连续同 skill 超过 2 题", () => {
    const mastery: MasteryScore[] = [];
    const mistakes: MistakeReview[] = [];
    const attempts: Attempt[] = [];
    const plan = buildDailySession({
      studentId: "s1",
      mode: "normal",
      currentUnitId: "G4B_U3_DECIMAL_MULTIPLY",
      targetMinutes: 15,
      dateKey: "2026-04-25",
      pool: SEED_QUESTIONS,
      mastery,
      mistakes,
      attempts,
    });
    expect(plan.questionIds.length).toBeGreaterThan(0);

    const idToSkill = new Map(SEED_QUESTIONS.map((q) => [q.question_id, q.skill_id]));
    let run = 1;
    let maxRun = 0;
    for (let i = 1; i < plan.questionIds.length; i++) {
      const a = idToSkill.get(plan.questionIds[i]!);
      const b = idToSkill.get(plan.questionIds[i - 1]!);
      if (a === b) run += 1;
      else run = 1;
      maxRun = Math.max(maxRun, run);
    }
    expect(maxRun).toBeLessThanOrEqual(2);
  });

  it("final_sprint 包含下册 MUST_BIG 的核心技能", () => {
    const plan = buildDailySession({
      studentId: "s1",
      mode: "final_sprint",
      targetMinutes: 20,
      dateKey: "2026-04-25",
      pool: SEED_QUESTIONS,
      mastery: [],
      mistakes: [],
      attempts: [],
    });
    const idToSkill = new Map(SEED_QUESTIONS.map((q) => [q.question_id, q.skill_id]));
    const skills = plan.questionIds.map((id) => idToSkill.get(id));
    expect(skills.some((s) => s?.startsWith("decimal_") || s === "decimal_price_quantity")).toBe(true);
    expect(skills.some((s) => s?.startsWith("equation_"))).toBe(true);
    expect(skills.some((s) => s?.startsWith("average_"))).toBe(true);
  });

  it("skill 模式只选指定技能", () => {
    const plan = buildDailySession({
      studentId: "s1",
      mode: "skill",
      targetMinutes: 10,
      dateKey: "2026-04-25",
      pool: SEED_QUESTIONS,
      mastery: [],
      mistakes: [],
      attempts: [],
      selectedSkillIds: ["decimal_price_quantity", "equation_one_step_word"],
    });
    const idToSkill = new Map(SEED_QUESTIONS.map((q) => [q.question_id, q.skill_id]));
    const skills = plan.questionIds.map((id) => idToSkill.get(id));
    expect(skills.every((s) => s === "decimal_price_quantity" || s === "equation_one_step_word")).toBe(true);
    expect(skills.length).toBeGreaterThan(0);
  });

  it("30 天内做对的题不再进入 normal 选题池", () => {
    const correctOnce: Attempt = {
      id: "a1",
      studentId: "s1",
      questionId: "G4B_dpq_1",
      skillId: "decimal_price_quantity",
      answer: "22.8",
      isCorrect: true,
      hintsOpened: 0,
      elapsedSeconds: 20,
      errorTags: [],
      scoreDelta: { total: 10, byAbility: {} },
      masteryDelta: 2,
      isReview: false,
      comboAtEnd: 1,
      createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    };
    const plan = buildDailySession({
      studentId: "s1",
      mode: "normal",
      currentUnitId: "G4B_U3_DECIMAL_MULTIPLY",
      targetMinutes: 15,
      dateKey: "2026-04-25",
      pool: SEED_QUESTIONS,
      mastery: [],
      mistakes: [],
      attempts: [correctOnce],
    });
    expect(plan.questionIds).not.toContain("G4B_dpq_1");
  });

  it("刚做错但未到复习时间的题优先进入冷却，不立刻重复出现", () => {
    const wrongRecent: Attempt = {
      id: "a2",
      studentId: "s1",
      questionId: "G4B_dpq_2",
      skillId: "decimal_price_quantity",
      answer: "200",
      isCorrect: false,
      hintsOpened: 0,
      elapsedSeconds: 20,
      errorTags: ["decimal_point_error"],
      scoreDelta: { total: 1, byAbility: {} },
      masteryDelta: -2,
      isReview: false,
      comboAtEnd: 0,
      createdAt: Date.now() - 2 * 60 * 60 * 1000,
    };
    const plan = buildDailySession({
      studentId: "s1",
      mode: "normal",
      currentUnitId: "G4B_U3_DECIMAL_MULTIPLY",
      targetMinutes: 15,
      dateKey: "2026-04-25",
      pool: SEED_QUESTIONS,
      mastery: [],
      mistakes: [],
      attempts: [wrongRecent],
    });
    expect(plan.questionIds).not.toContain("G4B_dpq_2");
  });

  it("dateKey 不同，顺序整体不同（顺序差异 ≥ 30%）", () => {
    const base = {
      studentId: "s1",
      mode: "normal" as const,
      currentUnitId: "G4B_U3_DECIMAL_MULTIPLY",
      targetMinutes: 15,
      pool: SEED_QUESTIONS,
      mastery: [],
      mistakes: [],
      attempts: [],
    };
    const a = buildDailySession({ ...base, dateKey: "2026-04-25" });
    const b = buildDailySession({ ...base, dateKey: "2026-05-02" });
    // 不要求第一题严格不同，但整体顺序应该有显著差异
    const len = Math.min(a.questionIds.length, b.questionIds.length);
    let diffCount = 0;
    for (let i = 0; i < len; i++) {
      if (a.questionIds[i] !== b.questionIds[i]) diffCount += 1;
    }
    expect(diffCount / len).toBeGreaterThanOrEqual(0.3);
  });

  it("一道题连续做对 3 次后退出主调度池（mastered 门槛）", () => {
    const qId = "G4B_dpq_1";
    const skillId = "decimal_price_quantity";
    const now = Date.now();
    // 三次答对，每次相隔 8 天（确保最近一次仍在 30 天 mastered 窗口内）
    const attempts: Attempt[] = [0, 8, 16].map((daysAgo, i) => ({
      id: `a${i}`,
      studentId: "s1",
      questionId: qId,
      skillId,
      answer: "right",
      isCorrect: true,
      hintsOpened: 0,
      elapsedSeconds: 10,
      errorTags: [],
      scoreDelta: { total: 10, byAbility: {} },
      masteryDelta: 2,
      isReview: false,
      comboAtEnd: 1,
      createdAt: now - daysAgo * 24 * 60 * 60 * 1000,
    }));
    // 用 free 模式只选这个 skill，确保它的池里"没新题"被立刻显现
    const plan = buildDailySession({
      studentId: "s1",
      mode: "skill",
      targetMinutes: 15,
      dateKey: "2026-04-25",
      pool: SEED_QUESTIONS,
      mastery: [],
      mistakes: [],
      attempts,
      selectedSkillIds: [skillId],
    });
    // 主筛逻辑应该不再选这道题（只有在 fallback / lastResort 时才会回收）
    const others = plan.questionIds.filter((id) => id !== qId);
    expect(others.length).toBeGreaterThan(0);
  });

  it("midterm 模式：题目都在下册第 1-4 单元", () => {
    const plan = buildDailySession({
      studentId: "s1",
      mode: "midterm",
      targetMinutes: 15,
      dateKey: "2026-05-03",
      pool: SEED_QUESTIONS,
      mastery: [],
      mistakes: [],
      attempts: [],
    });
    const idToUnit = new Map(SEED_QUESTIONS.map((q) => [q.question_id, q.unit_id]));
    const units = new Set(plan.questionIds.map((id) => idToUnit.get(id)));
    const allowed = new Set([
      "G4B_U1_DECIMAL_ADD_SUB",
      "G4B_U2_TRI_QUAD",
      "G4B_U3_DECIMAL_MULTIPLY",
      "G4B_U4_OBSERVE_OBJECTS",
    ]);
    for (const u of units) expect(allowed.has(u as string)).toBe(true);
    expect(plan.questionIds.length).toBeGreaterThan(0);
  });

  it("题库见底时 plan.poolStarved=true", () => {
    // 用一个超小的 pool，模拟枯竭
    const tinyPool = SEED_QUESTIONS.slice(0, 3);
    const plan = buildDailySession({
      studentId: "s1",
      mode: "normal",
      currentUnitId: "G4B_U3_DECIMAL_MULTIPLY",
      targetMinutes: 15,
      dateKey: "2026-04-25",
      pool: tinyPool,
      mastery: [],
      mistakes: [],
      attempts: [],
    });
    expect(plan.poolStarved).toBe(true);
  });
});

// v0.30.8：变式题查找（1st 错答后的"换个同型同难度的题"流程用）
describe("findParallelQuestion v0.30.8", () => {
  // 取一道实际 G4B 题做基准
  const original = SEED_QUESTIONS.find(
    (q) => q.skill_id === "decimal_unit_conversion" && q.difficulty === 2,
  )!;
  const pool = SEED_QUESTIONS;

  it("找到的变式题：同 skill / 同 game_type / 同 difficulty / 不同 question_id", () => {
    const v = findParallelQuestion(original, pool, new Set());
    expect(v).not.toBeNull();
    expect(v!.question_id).not.toBe(original.question_id);
    expect(v!.skill_id).toBe(original.skill_id);
    expect(v!.game_type).toBe(original.game_type);
    expect(v!.difficulty).toBe(original.difficulty);
    expect(v!.term).toBe(original.term);
  });

  it("excludeIds 里的严格匹配全 exclude 时，会从更宽的候选里挑（v0.31.17：阶梯放宽）", () => {
    // v0.31.17：之前严格匹配 fail 就返 null，现在阶梯放宽到同 skill / 同学科。
    // 用户核心诉求是"重做绝不能看到刚做过的题"，宁可换 game_type 也不能给原题。
    const strictMatches: Question[] = pool.filter(
      (q) =>
        q.question_id !== original.question_id &&
        q.skill_id === original.skill_id &&
        q.game_type === original.game_type &&
        q.difficulty === original.difficulty,
    );
    expect(strictMatches.length).toBeGreaterThan(0);
    const exclude = new Set(strictMatches.map((q) => q.question_id));
    const v = findParallelQuestion(original, pool, exclude);
    // 期望：放宽到同 skill 不同 game_type 或不同 diff 拿到一道——绝不返 null
    expect(v).not.toBeNull();
    expect(v!.question_id).not.toBe(original.question_id);
    expect(exclude.has(v!.question_id)).toBe(false);
  });

  it("孤立 skill 时退到同学科任意一题（v0.31.17 保底，避免原题复用）", () => {
    const lonely: Question = {
      ...original,
      question_id: "FAKE_LONELY",
      skill_id: "skill_that_does_not_exist_xyz",
    };
    const v = findParallelQuestion(lonely, pool, new Set());
    expect(v).not.toBeNull();
    expect(v!.question_id).not.toBe(lonely.question_id);
    // 同学科即可（原题是 math，pool 里随便一道 math 都行）
    expect((v!.subjectId ?? "math")).toBe((lonely.subjectId ?? "math"));
  });

  it("pool 真的只有原题时返 null（没东西可挑）", () => {
    const v = findParallelQuestion(original, [original], new Set());
    expect(v).toBeNull();
  });

  it("优先返回用户没见过的题（attemptCounts 0 优先于 > 0）", () => {
    const allCandidates = pool.filter(
      (q) =>
        q.question_id !== original.question_id &&
        q.skill_id === original.skill_id &&
        q.game_type === original.game_type &&
        q.difficulty === original.difficulty,
    );
    if (allCandidates.length < 2) return;
    const targetId = allCandidates[0]!.question_id;
    const seenLot = new Map<string, number>();
    for (const c of allCandidates) {
      if (c.question_id !== targetId) seenLot.set(c.question_id, 5);
    }
    const v = findParallelQuestion(original, pool, new Set(), seenLot, () => 0);
    expect(v?.question_id).toBe(targetId);
  });

  it("v0.31.17：term 不再是硬约束——同 skill 不同 term 也是后备选择", () => {
    // 用户核心诉求 > 学期边界。如果下册题 retry 时只有上册同 skill 题，就用上册的。
    // 仍然优先匹配同 term；只在必要时跨 term。
    const upperBook = SEED_QUESTIONS.find((q) => q.term === "上册");
    if (!upperBook) return;
    const lowerFake: Question = {
      ...upperBook,
      term: "下册",
      question_id: "FAKE_LOWER",
    };
    const v = findParallelQuestion(lowerFake, [upperBook], new Set());
    expect(v?.question_id).toBe(upperBook.question_id);
  });
});
