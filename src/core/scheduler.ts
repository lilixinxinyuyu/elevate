import { FINAL_SPRINT_G4B } from "../content/examPriorities";
import { SKILLS } from "../content/skills";
import type { Attempt, MasteryScore, MistakeReview, Question, SessionMode, Skill } from "./types";

export interface BuildSessionInput {
  studentId: string;
  mode: SessionMode;
  currentUnitId?: string;
  targetMinutes: number;
  dateKey: string;
  pool: Question[];
  mastery: MasteryScore[];
  mistakes: MistakeReview[];
  attempts: Attempt[];
  selectedSkillIds?: string[];
  /** v0.31.1：big_problems 模式专用 — 限定到某个单元的大题（点 G4B U1 闯关时） */
  unitId?: string;
  now?: number;
  rng?: () => number;
  rngSeed?: string;
}

export interface DailySessionPlan {
  mode: SessionMode;
  dateKey: string;
  plannedMinutes: number;
  questionIds: string[];
  breakdown: { bucket: string; count: number }[];
  focusSkills: string[];
  /** 题库枯竭：抽不出 targetCount 道有效题（即使放宽规则也凑不齐） */
  poolStarved?: boolean;
  /** 哪些 skill 严重缺新题（attempts ≥ 3 但题库见底） */
  starvedSkillIds?: string[];
}

/** 单题级 mastered：连续 3 次答对 → 暂时退出主调度池（30 天后回炉抽查） */
const MASTERED_CONSECUTIVE_THRESHOLD = 3;
const MASTERED_RECHECK_DAYS = 30;

const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

const EXAM_PRIORITY_WEIGHT: Record<string, number> = {
  MUST_BIG: 1.0,
  HIGH_BIG: 0.85,
  MUST_SMALL: 0.75,
  VERY_HIGH_SMALL: 0.7,
  HIGH_SMALL: 0.6,
  NORMAL: 0.4,
  LOW_SMALL: 0.25,
  LOW: 0.2,
  EXTENSION: 0.1,
};

const DAY = 24 * 60 * 60 * 1000;

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function buildDailySession(input: BuildSessionInput): DailySessionPlan {
  const now = input.now ?? Date.now();
  const rngSeed = input.rngSeed ?? `${input.studentId}:${input.dateKey}:${input.mode}`;
  const rng = input.rng ?? seededRng(hashSeed(rngSeed));
  // v0.35.9: 爸爸反馈"今日挑战要 10 题, 不是 15"
  // 之前公式: targetMinutes (15) * 1.0 = 15 题
  // 现在: 默认 10 题, final_sprint 13 题 (×1.3). dailyLimitMin 字段 sigfn 改变
  // 为"建议时长 hint", 题数主导
  // 这跟"挑战薄弱题/记忆曲线题" 的策略 (见 buildNormalSession) 配合 — 10 题精选
  // 比 15 题平摊更有针对性.
  const baseTarget = input.mode === "final_sprint" ? 13 : 10;
  const targetCount = Math.max(6, baseTarget);

  const masteryMap = new Map(input.mastery.map((m) => [m.skillId, m]));
  const dueMistakes = input.mistakes.filter((m) => !m.resolved && m.nextReviewAt <= now);
  const approvedPool = input.pool.filter((q) => q.status === "approved" || q.status === "active");

  // 已做对的题（30 天内不重复使用，除非实在没题）
  const thirtyDaysAgo = now - 30 * DAY;
  const recentCorrectIds = new Set(
    input.attempts
      .filter((a) => a.isCorrect && a.createdAt >= thirtyDaysAgo)
      .map((a) => a.questionId),
  );
  // 7 天内见到过的题目（重复疲劳）
  const sevenDaysAgo = now - 7 * DAY;
  const recentSeenCount = new Map<string, number>();
  for (const a of input.attempts) {
    if (a.createdAt >= sevenDaysAgo) {
      recentSeenCount.set(a.questionId, (recentSeenCount.get(a.questionId) ?? 0) + 1);
    }
  }
  const dueQuestionIds = new Set(dueMistakes.map((m) => m.questionId));
  const recentWrongCooldownIds = new Set(
    input.attempts
      .filter((a) => !a.isCorrect && a.createdAt >= now - DAY && !dueQuestionIds.has(a.questionId))
      .map((a) => a.questionId),
  );

  // 单题掌握度：最近 3 次都对 + 最新一次距今不足 30 天 → 暂退主池
  const masteredQuestionIds = computeMasteredQuestionIds(input.attempts, now);

  if (input.mode === "review") {
    return buildReview(input, approvedPool, dueMistakes, targetCount, rng);
  }

  if (input.mode === "skill" || input.mode === "free") {
    return buildBySkills({
      ...input,
      now,
      rng,
      targetCount,
      pool: approvedPool,
      recentCorrectIds,
      recentSeenCount,
      recentWrongCooldownIds,
      masteredQuestionIds,
      masteryMap,
      dueMistakes,
    });
  }

  if (input.mode === "final_sprint") {
    return buildFinalSprint({
      ...input,
      now,
      rng,
      targetCount,
      pool: approvedPool,
      recentCorrectIds,
      recentSeenCount,
      recentWrongCooldownIds,
      masteredQuestionIds,
      masteryMap,
      dueMistakes,
    });
  }

  if (input.mode === "midterm") {
    return buildMidterm({
      ...input,
      now,
      rng,
      targetCount,
      pool: approvedPool,
      recentCorrectIds,
      recentSeenCount,
      recentWrongCooldownIds,
      masteredQuestionIds,
      masteryMap,
      dueMistakes,
    });
  }

  if (input.mode === "mock_exam") {
    return buildMockExam({
      ...input,
      now,
      rng,
      targetCount,
      pool: approvedPool,
      recentCorrectIds,
      recentSeenCount,
      recentWrongCooldownIds,
      masteredQuestionIds,
      masteryMap,
      dueMistakes,
    });
  }

  if (input.mode === "big_problems") {
    // Phase 2 Axis 1：大题营 — 只挑 D3-D4 + 含 subquestions 的多步应用题。
    // 5 道一组，不限时；XP/Elo 走主算分（这是真实 skill 题，不是 fluency 那种基本功）。
    return buildBigProblems({
      ...input,
      now,
      rng,
      targetCount: 7, // v0.31.49: 7 题三阶段
      pool: approvedPool,
      recentCorrectIds,
      recentSeenCount,
      recentWrongCooldownIds,
      masteredQuestionIds,
      masteryMap,
      dueMistakes,
    });
  }

  return buildNormal({
    ...input,
    now,
    rng,
    targetCount,
    pool: approvedPool,
    recentCorrectIds,
    recentSeenCount,
    recentWrongCooldownIds,
    masteredQuestionIds,
    masteryMap,
    dueMistakes,
  });
}

/**
 * 一道题在最近 N 次（>= 3）答题里全部答对 + 最新一次距今 < 30 天 → 视为 mastered。
 * 真的隔了 30 天再做错也会自动从这个集合移除（因为 last attempt 太早）。
 */
function computeMasteredQuestionIds(attempts: Attempt[], now: number): Set<string> {
  const byQ = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const arr = byQ.get(a.questionId) ?? [];
    arr.push(a);
    byQ.set(a.questionId, arr);
  }
  const out = new Set<string>();
  const recheckCutoff = now - MASTERED_RECHECK_DAYS * DAY;
  for (const [qId, list] of byQ) {
    list.sort((a, b) => a.createdAt - b.createdAt);
    if (list.length < MASTERED_CONSECUTIVE_THRESHOLD) continue;
    const tail = list.slice(-MASTERED_CONSECUTIVE_THRESHOLD);
    if (!tail.every((a) => a.isCorrect)) continue;
    const last = tail[tail.length - 1]!;
    if (last.createdAt < recheckCutoff) continue; // 太久没碰，重新回炉
    out.add(qId);
  }
  return out;
}

interface InternalInput extends BuildSessionInput {
  now: number;
  rng: () => number;
  targetCount: number;
  pool: Question[];
  recentCorrectIds: Set<string>;
  recentSeenCount: Map<string, number>;
  recentWrongCooldownIds: Set<string>;
  masteredQuestionIds: Set<string>;
  masteryMap: Map<string, MasteryScore>;
  dueMistakes: MistakeReview[];
}

/** 每个 skill 算一个"优先度分数"；越高越应在今天出现 */
function scoreSkill(
  skill: Skill,
  mastery: MasteryScore | undefined,
  dueMistakes: MistakeReview[],
  now: number,
): number {
  const m = mastery?.score ?? 50;
  const weakness = Math.max(0, (65 - m) / 65);
  const daysSince = mastery?.lastPracticedAt
    ? (now - mastery.lastPracticedAt) / DAY
    : 14;
  const forgetting = daysSince / (1 + m / 25);
  const overdue = dueMistakes.some((d) => d.skillId === skill.id) ? 1.5 : 0;
  const priority = EXAM_PRIORITY_WEIGHT[skill.examPriority] ?? 0.4;
  return weakness + forgetting * 0.4 + overdue + priority * 0.6;
}

function selectTopSkills(input: InternalInput, n: number): Skill[] {
  // **关键**：只考虑在 pool 里有题的 skill。否则会选到当前学期没出题的 G4A skill，
  // 然后 pickQuestionsForSkill 找不到题 → 整 session 空 → empty 状态死循环。
  const skillsInPool = new Set(input.pool.map((q) => q.skill_id));
  const eligible = SKILLS.filter((s) => skillsInPool.has(s.id));
  const arr = eligible.map((s) => ({
    s,
    score: scoreSkill(s, input.masteryMap.get(s.id), input.dueMistakes, input.now),
  }));
  arr.sort((a, b) => b.score - a.score);
  // 同分时按 rng 打乱保证每天不同
  return arr.slice(0, n * 2).sort(() => input.rng() - 0.5).slice(0, n).map((x) => x.s);
}

function pickQuestionsForSkill(
  skill: Skill,
  input: InternalInput,
  count: number,
  forbidIds: Set<string>,
): Question[] {
  const mastery = input.masteryMap.get(skill.id);
  const ratio = targetDifficultyRatio(mastery?.score ?? 50);

  // 候选 = 同 skill + 没被 forbid + 不在"最近做对/错题冷却/已 mastered"三池
  const available = input.pool.filter(
    (q) =>
      q.skill_id === skill.id &&
      !forbidIds.has(q.question_id) &&
      !input.recentCorrectIds.has(q.question_id) &&
      !input.recentWrongCooldownIds.has(q.question_id) &&
      !input.masteredQuestionIds.has(q.question_id),
  );

  // 难度分桶（D5 归到 D4 桶，避免有 D5 题时漏掉）
  const buckets: Record<1 | 2 | 3 | 4, Question[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const q of available) {
    const d = (q.difficulty >= 4 ? 4 : q.difficulty) as 1 | 2 | 3 | 4;
    buckets[d].push(q);
  }

  // 每桶内按"卷面错题 / 真题 / MUST_BIG"优先排序。
  // 关键点：priority 本身加 ±0.2 抖动，否则同一桶所有 MUST_BIG 题 priority 都是
  // -0.3，"1.5 米"那道又恰好排在前面 → user 每次进训练第一题永远一样。加抖动后
  // 同 priority 段内顺序会洗牌，但跨段的偏好（MUST_BIG / wrong_origin / 真题）
  // 仍然成立——它们的 -0.3/-0.6 偏置 > ±0.2 抖动幅度。
  const sortBucket = (qs: Question[]) => {
    const tagged = qs.map((q) => ({
      q,
      priority:
        (input.recentSeenCount.get(q.question_id) ?? 0) * 0.6 +
        ((q.tags ?? []).includes("wrong_origin") ? -0.6 : 0) +
        ((q.tags ?? []).includes("from_test") ? -0.3 : 0) +
        (q.exam_priority === "MUST_BIG" ? -0.3 : q.exam_priority === "MUST_SMALL" ? -0.2 : 0)
        + (input.rng() - 0.5) * 0.4,
      jitter: input.rng(),
    }));
    tagged.sort((a, b) => a.priority - b.priority || a.jitter - b.jitter);
    return tagged.map((t) => t.q);
  };
  buckets[1] = sortBucket(buckets[1]);
  buckets[2] = sortBucket(buckets[2]);
  buckets[3] = sortBucket(buckets[3]);
  buckets[4] = sortBucket(buckets[4]);

  // 按 ratio 算每个难度该取多少道；剩下的归到 D2/D3 主区
  let t1 = Math.round(count * ratio.d1);
  let t2 = Math.round(count * ratio.d2);
  let t3 = Math.round(count * ratio.d3);
  let t4 = count - t1 - t2 - t3;
  if (t4 < 0) { t3 += t4; t4 = 0; }

  const picked: Question[] = [];
  const takeFrom = (bucket: Question[], n: number): number => {
    const got = bucket.splice(0, n);
    picked.push(...got);
    return n - got.length; // 返回欠几道
  };
  // 取每桶；不够时溢出到相邻难度桶
  let owe = takeFrom(buckets[1], t1);
  if (owe > 0) owe = takeFrom(buckets[2], owe);
  owe += takeFrom(buckets[2], t2);
  if (owe > 0) owe = takeFrom(buckets[3], owe);
  owe += takeFrom(buckets[3], t3);
  if (owe > 0) owe = takeFrom(buckets[4], owe);
  owe += takeFrom(buckets[4], t4);
  // 仍然欠就反向往简单桶捡
  if (owe > 0) owe = takeFrom(buckets[3], owe);
  if (owe > 0) owe = takeFrom(buckets[2], owe);
  if (owe > 0) owe = takeFrom(buckets[1], owe);

  // 若仍然欠（题库枯竭），放宽：允许 recentCorrect / mastered 已做过的题
  if (picked.length < count) {
    const fallback = input.pool.filter(
      (q) =>
        q.skill_id === skill.id &&
        !picked.includes(q) &&
        !forbidIds.has(q.question_id) &&
        !input.recentWrongCooldownIds.has(q.question_id),
    );
    fallback.sort(() => input.rng() - 0.5);
    for (const q of fallback) {
      if (picked.length >= count) break;
      picked.push(q);
    }
  }
  // 完全没替代题时再放回冷却题，避免空盘
  if (picked.length === 0) {
    const lastResort = input.pool.filter(
      (q) => q.skill_id === skill.id && !forbidIds.has(q.question_id),
    );
    lastResort.sort(() => input.rng() - 0.5);
    for (const q of lastResort) {
      if (picked.length >= count) break;
      picked.push(q);
    }
  }
  return picked;
}

/**
 * 按 skill 当前掌握度，返回每节挑题的难度配比 (D1/D2/D3/D4≥4)。
 *
 * 学习心理学的"理想难度"区间（Bjork 的 desirable difficulty）：正确率 75-85% 时学得最好。
 *   - 低于 70% → 挫败感、放弃
 *   - 高于 90% → 无聊、不在学新东西
 *
 * 因此弱 skill 偏简单（撑准确率），强 skill 偏难（顶下界）。整体目标：每个 skill 维持 ~80% 准确率。
 *
 * mastery 来自 MasteryScore（0-100）。新 skill 默认 50。
 */
function targetDifficultyRatio(mastery: number): { d1: number; d2: number; d3: number; d4: number } {
  if (mastery < 50) return { d1: 0.40, d2: 0.40, d3: 0.15, d4: 0.05 };  // struggling
  if (mastery < 75) return { d1: 0.20, d2: 0.35, d3: 0.30, d4: 0.15 };  // developing
  if (mastery < 90) return { d1: 0.10, d2: 0.25, d3: 0.40, d4: 0.25 };  // proficient
  return { d1: 0.05, d2: 0.15, d3: 0.40, d4: 0.40 };                     // mastered
}

/** 这个 skill 在所有约束下还能不能找到至少一道"新题"——用于检测题库枯竭 */
function skillHasFreshQuestion(skill: Skill, input: InternalInput): boolean {
  return input.pool.some(
    (q) =>
      q.skill_id === skill.id &&
      !input.recentCorrectIds.has(q.question_id) &&
      !input.recentWrongCooldownIds.has(q.question_id) &&
      !input.masteredQuestionIds.has(q.question_id),
  );
}

function difficultyCap(mastery: number): number {
  if (mastery < 40) return 2;
  if (mastery < 60) return 3;
  if (mastery < 80) return 4;
  return 5;
}

function buildNormal(input: InternalInput): DailySessionPlan {
  const focusSkills = selectTopSkills(input, 5);
  const forbid = new Set<string>();
  const questions: Question[] = [];
  // 每个重点 skill 各取 2-3 道
  const perSkill = Math.max(2, Math.ceil(input.targetCount / focusSkills.length));
  for (const skill of focusSkills) {
    const pick = pickQuestionsForSkill(skill, input, perSkill, forbid);
    for (const q of pick) {
      questions.push(q);
      forbid.add(q.question_id);
    }
  }
  // 到期错题的题目（若它的 skill 不在 focus 里，也追加）
  for (const mk of input.dueMistakes) {
    if (forbid.has(mk.questionId)) continue;
    const q = input.pool.find((p) => p.question_id === mk.questionId);
    if (q) {
      questions.push(q);
      forbid.add(q.question_id);
    }
  }

  const trimmed = questions.slice(0, input.targetCount + 2);
  const finalList = diversifyOrder(trimmed, input.rng);

  const starvedSkillIds = focusSkills.filter((s) => !skillHasFreshQuestion(s, input)).map((s) => s.id);
  const poolStarved = finalList.length < input.targetCount || starvedSkillIds.length >= 3;

  return {
    mode: input.mode,
    dateKey: input.dateKey,
    plannedMinutes: input.targetMinutes,
    questionIds: finalList.map((q) => q.question_id),
    focusSkills: focusSkills.map((s) => s.id),
    breakdown: focusSkills.map((s) => ({
      bucket: s.name,
      count: finalList.filter((q) => q.skill_id === s.id).length,
    })),
    poolStarved,
    starvedSkillIds,
  };
}

/**
 * 期中冲刺：锁定下册 1-4 单元，错题 × 2 加权 → priority high → 没做过 → 复习。
 * 比 final_sprint 范围窄，但更深，每个 skill 至少 1 道。
 */
function buildMidterm(input: InternalInput): DailySessionPlan {
  const MIDTERM_UNIT_IDS = [
    "G4B_U1_DECIMAL_ADD_SUB",
    "G4B_U2_TRI_QUAD",
    "G4B_U3_DECIMAL_MULTIPLY",
    "G4B_U4_OBSERVE_OBJECTS",
  ];
  const unitSkills = SKILLS.filter((s) => MIDTERM_UNIT_IDS.includes(s.unitId));
  const forbid = new Set<string>();
  const questions: Question[] = [];

  // 1. 优先错题
  const wantMistakes = Math.max(2, Math.round(input.targetCount * 0.25));
  let addedM = 0;
  for (const mk of input.dueMistakes) {
    if (addedM >= wantMistakes) break;
    if (forbid.has(mk.questionId)) continue;
    const q = input.pool.find((p) => p.question_id === mk.questionId);
    if (q && MIDTERM_UNIT_IDS.includes(q.unit_id)) {
      questions.push(q);
      forbid.add(q.question_id);
      addedM += 1;
    }
  }

  // 2. 每单元至少 3 道，按 skill 评分轮流抽
  const perUnit = Math.max(3, Math.floor((input.targetCount - addedM) / 4));
  for (const unitId of MIDTERM_UNIT_IDS) {
    const skillsHere = unitSkills.filter((s) => s.unitId === unitId);
    let addedHere = 0;
    skillsHere.sort((a, b) =>
      scoreSkill(b, input.masteryMap.get(b.id), input.dueMistakes, input.now) -
      scoreSkill(a, input.masteryMap.get(a.id), input.dueMistakes, input.now),
    );
    for (const s of skillsHere) {
      if (addedHere >= perUnit) break;
      const pick = pickQuestionsForSkill(s, input, Math.min(2, perUnit - addedHere), forbid);
      for (const q of pick) {
        if (addedHere >= perUnit) break;
        questions.push(q);
        forbid.add(q.question_id);
        addedHere += 1;
      }
    }
  }

  const finalList = diversifyOrder(questions.slice(0, input.targetCount + 3), input.rng);
  const starvedSkillIds = unitSkills.filter((s) => !skillHasFreshQuestion(s, input)).map((s) => s.id);
  const poolStarved = finalList.length < input.targetCount || starvedSkillIds.length >= unitSkills.length / 2;

  // 按单元统计 breakdown
  const breakdown: { bucket: string; count: number }[] = [];
  const unitNames: Record<string, string> = {
    G4B_U1_DECIMAL_ADD_SUB: "U1 小数加减",
    G4B_U2_TRI_QUAD: "U2 三角形",
    G4B_U3_DECIMAL_MULTIPLY: "U3 小数乘法",
    G4B_U4_OBSERVE_OBJECTS: "U4 观察物体",
  };
  for (const unitId of MIDTERM_UNIT_IDS) {
    breakdown.push({
      bucket: unitNames[unitId] ?? unitId,
      count: finalList.filter((q) => q.unit_id === unitId).length,
    });
  }
  breakdown.push({ bucket: "错题复活", count: addedM });

  return {
    mode: "midterm",
    dateKey: input.dateKey,
    plannedMinutes: input.targetMinutes,
    questionIds: finalList.map((q) => q.question_id),
    focusSkills: Array.from(new Set(finalList.map((q) => q.skill_id))),
    breakdown,
    poolStarved,
    starvedSkillIds,
  };
}

function buildFinalSprint(input: InternalInput): DailySessionPlan {
  const forbid = new Set<string>();
  const questions: Question[] = [];
  const breakdown: { bucket: string; count: number }[] = [];

  for (const item of FINAL_SPRINT_G4B) {
    const target = Math.max(
      item.minQuestionsPerSession,
      Math.round(item.weight * input.targetCount),
    );
    let added = 0;
    for (const skillId of item.skillIds) {
      if (added >= target) break;
      const skill = SKILL_BY_ID.get(skillId);
      if (!skill) continue;
      const pick = pickQuestionsForSkill(skill, input, target - added, forbid);
      for (const q of pick) {
        if (added >= target) break;
        questions.push(q);
        forbid.add(q.question_id);
        added += 1;
      }
    }
    breakdown.push({ bucket: item.name, count: added });
  }

  // 错题变式 10-15%
  const wantMistakes = Math.max(1, Math.round(input.targetCount * 0.12));
  let addedM = 0;
  for (const mk of input.dueMistakes) {
    if (addedM >= wantMistakes) break;
    if (forbid.has(mk.questionId)) continue;
    const q = input.pool.find((p) => p.question_id === mk.questionId);
    if (q) {
      questions.push(q);
      forbid.add(q.question_id);
      addedM += 1;
    }
  }
  breakdown.push({ bucket: "错题复活", count: addedM });

  const finalList = diversifyOrder(questions, input.rng);
  return {
    mode: "final_sprint",
    dateKey: input.dateKey,
    plannedMinutes: input.targetMinutes,
    questionIds: finalList.map((q) => q.question_id),
    focusSkills: Array.from(new Set(questions.map((q) => q.skill_id))),
    breakdown,
  };
}

function buildBySkills(input: InternalInput): DailySessionPlan {
  const wantIds = input.selectedSkillIds && input.selectedSkillIds.length > 0
    ? input.selectedSkillIds
    : SKILLS.filter((s) => s.unitId === input.currentUnitId).slice(0, 3).map((s) => s.id);
  const skills = wantIds.map((id) => SKILL_BY_ID.get(id)).filter(Boolean) as Skill[];
  const forbid = new Set<string>();
  const perSkill = Math.max(3, Math.ceil(input.targetCount / Math.max(1, skills.length)));
  const questions: Question[] = [];
  for (const s of skills) {
    const pick = pickQuestionsForSkill(s, input, perSkill, forbid);
    for (const q of pick) {
      questions.push(q);
      forbid.add(q.question_id);
    }
  }
  const trimmed = questions.slice(0, input.targetCount);
  const finalList = diversifyOrder(trimmed, input.rng);
  const starvedSkillIds = skills.filter((s) => !skillHasFreshQuestion(s, input)).map((s) => s.id);
  const poolStarved = finalList.length < input.targetCount;
  return {
    mode: input.mode,
    dateKey: input.dateKey,
    plannedMinutes: input.targetMinutes,
    questionIds: finalList.map((q) => q.question_id),
    focusSkills: skills.map((s) => s.id),
    breakdown: skills.map((s) => ({
      bucket: s.name,
      count: finalList.filter((q) => q.skill_id === s.id).length,
    })),
    poolStarved,
    starvedSkillIds,
  };
}

/**
 * 周考模拟（mock_exam）：模拟真实期中/期末考的题量和难度分布。
 *
 * 设计原则：
 * - 30 道题，覆盖所有 G4B 单元（按 examPriority 加权）
 * - 难度分布按真实考试经验：D1:10% / D2:30% / D3:40% / D4-5:20%
 * - 每题不允许提示（GameShell 那边按 mock_exam 模式隐藏 hint）
 * - 锁定时钟（前端 Train.tsx 有总倒计时）
 * - 完成后：按 skill 分组的得分分析
 *
 * 用途：考前最后冲刺，让 Selena 在"接近真实考试"的条件下检验真实能力。
 */
function buildMockExam(input: InternalInput): DailySessionPlan {
  const G4B_UNIT_IDS = [
    "G4B_U1_DECIMAL_ADD_SUB", "G4B_U2_TRI_QUAD",
    "G4B_U3_DECIMAL_MULTIPLY", "G4B_U4_OBSERVE_OBJECTS",
    "G4B_U5_EQUATIONS", "G4B_U6_DATA",
  ];
  const candidatePool = input.pool.filter((q) => G4B_UNIT_IDS.includes(q.unit_id));

  // 按难度分桶
  const buckets: Record<1 | 2 | 3 | 4, Question[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const q of candidatePool) {
    const d = (q.difficulty >= 4 ? 4 : q.difficulty) as 1 | 2 | 3 | 4;
    buckets[d].push(q);
  }

  // 每桶按 exam_priority 加权排序（MUST_BIG 优先）
  const weight = (q: Question) =>
    q.exam_priority === "MUST_BIG" ? 0 :
    q.exam_priority === "MUST_SMALL" ? 1 :
    q.exam_priority === "HIGH_BIG" ? 1 :
    q.exam_priority === "HIGH_SMALL" ? 2 : 3;
  const sortBucket = (qs: Question[]) => {
    return qs.map((q) => ({
      q, w: weight(q), j: hashSeed(input.dateKey + ":mock:" + q.question_id) / 2 ** 32,
    })).sort((a, b) => a.w - b.w || a.j - b.j).map((x) => x.q);
  };
  buckets[1] = sortBucket(buckets[1]);
  buckets[2] = sortBucket(buckets[2]);
  buckets[3] = sortBucket(buckets[3]);
  buckets[4] = sortBucket(buckets[4]);

  // 难度配比 10/30/40/20
  const total = Math.max(20, Math.min(30, input.targetCount));
  const t1 = Math.round(total * 0.1);
  const t2 = Math.round(total * 0.3);
  const t3 = Math.round(total * 0.4);
  const t4 = total - t1 - t2 - t3;

  const picked: Question[] = [
    ...buckets[1].slice(0, t1),
    ...buckets[2].slice(0, t2),
    ...buckets[3].slice(0, t3),
    ...buckets[4].slice(0, t4),
  ];

  // 同一 skill 不超过 3 道（强制 skill 多样性）
  const perSkillCap = 3;
  const perSkillCount = new Map<string, number>();
  const filtered: Question[] = [];
  for (const q of picked) {
    const c = perSkillCount.get(q.skill_id) ?? 0;
    if (c >= perSkillCap) continue;
    filtered.push(q);
    perSkillCount.set(q.skill_id, c + 1);
  }

  // 不够补回去
  if (filtered.length < total) {
    for (const q of [...buckets[2], ...buckets[3]]) {
      if (filtered.length >= total) break;
      if (filtered.includes(q)) continue;
      filtered.push(q);
    }
  }

  const finalList = diversifyOrder(filtered.slice(0, total), input.rng);
  return {
    mode: input.mode,
    dateKey: input.dateKey,
    plannedMinutes: input.targetMinutes,
    questionIds: finalList.map((q) => q.question_id),
    focusSkills: Array.from(new Set(finalList.map((q) => q.skill_id))),
    breakdown: G4B_UNIT_IDS.map((u) => ({
      bucket: u, count: finalList.filter((q) => q.unit_id === u).length,
    })),
  };
}

/**
 * Phase 2 Axis 1：大题营。
 *
 * 只挑 D3-D4 + 含 subquestions 的多步应用题。每场 5 道，不限时。
 * XP / Elo 走主算分（这是真实 skill 题，跟 Train 同一池），跟 fluency 不同 ——
 * 区别只在 UI（5 道一组、不计时）。
 *
 * 选题策略：
 *   1. 先过滤 D3-D4 + subquestions.length > 0
 *   2. 排除 30 天内做对的 + 1 天内错的（沿用 Train 的 cooldown）
 *   3. 按 skill 多样性（同 skill 最多 1 道，5 道至少 5 个 skill）
 *   4. 不够 5 道时降级到 D3-D4 不含 subquestions 的题（"题量警告"）
 */
/**
 * v0.31.49: 闯关 v3 — Boss 战 7 题三阶段
 *
 * 老版本（v0.31.38 5 题平铺）→ 跟今日挑战体验一样，没有过关感。
 *
 * 新版：7 题，3 阶段
 *   Phase 1 (热身): 2 × D2 单步应用题
 *   Phase 2 (主战): 3 × D3 多步应用题（含 subquestions）
 *   Phase 3 (Boss): 2 × D4 综合压轴（subquestions 必需）
 *
 * 顺序固定：warmup → main → boss，让前端 BossBattle 页能按 index 划分阶段：
 *   index 0-1 = 热身，2-4 = 主战，5-6 = Boss。
 *
 * 失败时只要有 4+ 道答对就拿星（详见 starsFromAccuracy in bossBattleState.ts）。
 */
function buildBigProblems(input: InternalInput): DailySessionPlan {
  const hasSubq = (q: Question) =>
    Array.isArray(q.subquestions) && q.subquestions.length > 0;

  // v0.31.1：如果指定了 unitId（比如点 G4B U1 闯关），过滤到该单元
  const unitFilter = input.unitId
    ? (q: Question) => q.unit_id === input.unitId
    : () => true;

  // 排除最近做过的题（按学过的标准筛掉做对/做错冷却）
  const isFresh = (q: Question) =>
    !input.recentCorrectIds.has(q.question_id) &&
    !input.recentWrongCooldownIds.has(q.question_id);

  // 同样的 unit + 还没做过的总池，按难度切分桶
  const unitPool = input.pool.filter((q) => unitFilter(q) && isFresh(q));
  const byDifficulty = (d: number, requireSubq = false) =>
    unitPool.filter((q) => q.difficulty === d && (!requireSubq || hasSubq(q)));

  /**
   * 从一桶里随机挑 N 道题，跳过已选过的 (perSkill 用于多样性)
   * 拿不够时降级 fallback 桶里挑剩。
   */
  function pickFromBucket(
    primary: Question[],
    fallback: Question[],
    n: number,
    perSkill: Set<string>,
    alreadyPicked: Set<string>,
  ): Question[] {
    const out: Question[] = [];
    const both = [primary, fallback];
    for (const bucket of both) {
      const shuffled = [...bucket].sort(() => input.rng() - 0.5);
      // 第一遍：尝试 skill 多样性
      for (const q of shuffled) {
        if (out.length >= n) break;
        if (alreadyPicked.has(q.question_id)) continue;
        if (perSkill.has(q.skill_id)) continue;
        out.push(q);
        alreadyPicked.add(q.question_id);
        perSkill.add(q.skill_id);
      }
      // 第二遍：放宽 skill 多样性
      for (const q of shuffled) {
        if (out.length >= n) break;
        if (alreadyPicked.has(q.question_id)) continue;
        out.push(q);
        alreadyPicked.add(q.question_id);
      }
      if (out.length >= n) break;
    }
    return out;
  }

  // v0.31.49: 7 题三阶段（2 + 3 + 2）
  const target = 7;
  const perSkill = new Set<string>();
  const alreadyPicked = new Set<string>();

  // Phase 1: 2 × D2 (热身)
  const warmup = pickFromBucket(
    byDifficulty(2, false), // 单步即可，热身要快
    byDifficulty(2, true),
    2,
    perSkill,
    alreadyPicked,
  );

  // Phase 2: 3 × D3 (主战，多步优先)
  const main = pickFromBucket(
    byDifficulty(3, true),
    byDifficulty(3, false),
    3,
    perSkill,
    alreadyPicked,
  );

  // Phase 3: 2 × D4 (Boss，必须有 subquestions)
  const boss = pickFromBucket(
    byDifficulty(4, true),
    byDifficulty(4, false),
    2,
    perSkill,
    alreadyPicked,
  );

  let picked = [...warmup, ...main, ...boss];

  // 总数不够 → 用 unit 池里其他题填补（不限难度，但 fresh）
  if (picked.length < target) {
    const fillers = unitPool
      .filter((q) => !alreadyPicked.has(q.question_id))
      .sort(() => input.rng() - 0.5);
    for (const q of fillers) {
      if (picked.length >= target) break;
      picked.push(q);
      alreadyPicked.add(q.question_id);
    }
  }

  // 顺序锁定：warmup → main → boss
  const poolStarved = picked.length < target;
  const finalList = picked.slice(0, target);

  return {
    mode: input.mode,
    dateKey: input.dateKey,
    plannedMinutes: input.targetMinutes,
    questionIds: finalList.map((q) => q.question_id),
    focusSkills: Array.from(new Set(finalList.map((q) => q.skill_id))),
    breakdown: [
      { bucket: "warmup_D2", count: warmup.length },
      { bucket: "main_D3", count: main.length },
      { bucket: "boss_D4", count: boss.length },
    ].filter((b) => b.count > 0),
    poolStarved,
  };
}

function buildReview(
  input: BuildSessionInput,
  pool: Question[],
  dueMistakes: MistakeReview[],
  targetCount: number,
  rng: () => number,
): DailySessionPlan {
  const used = new Set<string>();
  const picked: Question[] = [];
  const bySkill = new Map<string, Question[]>();
  for (const q of pool) {
    const arr = bySkill.get(q.skill_id) ?? [];
    arr.push(q);
    bySkill.set(q.skill_id, arr);
  }
  for (const mistake of dueMistakes) {
    if (picked.length >= targetCount) break;
    const candidates = bySkill.get(mistake.skillId) ?? [];
    // v0.31.68: 复活流程优先用 **原错题** —— 旧实现随机抽同 skill 的 variant，
    // 而 advance 只认 question_id，等于"做对 variant 推不动原错题"，焦点环死锁。
    // 现在：原题在 pool 且没被本次用过 → 直接挑；否则 fallback 同 skill variant
    // （variant 答对会被 service.ts 通过 propagate 路径推进同 skill 最早到期错题）。
    const original = candidates.find(
      (q) => q.question_id === mistake.questionId && !used.has(q.question_id),
    );
    if (original) {
      picked.push(original);
      used.add(original.question_id);
      continue;
    }
    const variants = candidates
      .filter((q) => !used.has(q.question_id))
      .sort(() => rng() - 0.5);
    const first = variants[0];
    if (first) {
      picked.push(first);
      used.add(first.question_id);
    }
  }
  return {
    mode: "review",
    dateKey: input.dateKey,
    plannedMinutes: input.targetMinutes,
    questionIds: picked.map((q) => q.question_id),
    focusSkills: Array.from(new Set(picked.map((q) => q.skill_id))),
    breakdown: [{ bucket: "到期错题", count: picked.length }],
  };
}

/**
 * 确保相同 skill 不连续出现超过 2 题，并保持一定打乱。
 */
function diversifyOrder(questions: Question[], rng: () => number): Question[] {
  const pool = questions.slice();
  // 先按 rng 初步打乱
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const out: Question[] = [];
  const MAX_RUN = 2;
  while (pool.length > 0) {
    let pickedIdx = -1;
    for (let i = 0; i < pool.length; i++) {
      const q = pool[i]!;
      const tail = out.slice(-MAX_RUN);
      if (tail.length === MAX_RUN && tail.every((t) => t.skill_id === q.skill_id)) continue;
      pickedIdx = i;
      break;
    }
    if (pickedIdx < 0) pickedIdx = 0;
    out.push(pool.splice(pickedIdx, 1)[0]!);
  }
  return out;
}

export function skillOf(skillId: string) {
  return SKILL_BY_ID.get(skillId);
}

/**
 * v0.30.8: 找一道"同型同难度的平行题"，给 1st 错答后的"换个题再做"流程用。
 *
 * 为什么需要：直接重做同一题相当于"我刚看了答案再做"——对学生不公平地容易（数字背了），
 * 也无法检验真理解。换成"同 skill + 同 game_type + 同 difficulty"的另一道题，
 * 强迫学生迁移概念到新情境，才是对"是不是真学会"的真实测试。
 *
 * v0.31.17 重做：用户最强诉求是"重做永远不能看到刚做过的题"。原版严格匹配
 * skill+game_type+difficulty+term+subject，候选稀少时返回 null → 重做退化成
 * "原题再做一遍"——尤其在用了小进讲题后，答案在脑子里 → 原样填上 = 假装会了。
 * 现在改成阶梯放宽：
 *   1) 严格 (skill+gt+diff+term+subject)
 *   2) 放宽 game_type
 *   3) 放宽 difficulty
 *   4) 放宽 term
 *   5) 同学科任意一道未排除的（保底，绝不返 null 让原题复用）
 * 即使第 5 层兜底，宁可换个 skill 不同难度的题，也比让 Selena 把刚记的答案抄一遍强。
 *
 * 选题策略（每一层）：
 *  - 排除：原题 + excludeIds（调用方控制：本 session 已答过的 + 可选的 plan 里后续）
 *  - 排序：见的次数升序（attemptCounts），tie-break 随机
 */
export function findParallelQuestion(
  original: Question,
  pool: Question[],
  excludeIds: Set<string>,
  attemptCounts?: Map<string, number>,
  rng: () => number = Math.random,
): Question | null {
  const subj = (original.subjectId ?? "math");
  const baseFilter = (q: Question) =>
    q.question_id !== original.question_id &&
    !excludeIds.has(q.question_id) &&
    (q.subjectId ?? "math") === subj;

  // v0.31.51: tier 重排 —— `game_type` 是"概念身份"，最该保住。
  //
  // 老版顺序问题：tier 2 先放宽 game_type（保留 difficulty+term），
  // 导致用户做"20-3.68 (decimal_shifter / 小数减法)"想要"再做一道相似的"，
  // 系统返回了"位移题（shift）"——同 skill 但 game_type 完全不同的概念。
  //
  // 新顺序：先保 game_type（最多放宽 term/difficulty），实在没辙才换 game_type。
  // 也就是说"30-5.65"型 (即使难度不同) 永远比"位移题"先返回。
  const tiers: ((q: Question) => boolean)[] = [
    // tier 1: 严格 — same skill + game_type + difficulty + term
    (q) =>
      baseFilter(q) &&
      q.skill_id === original.skill_id &&
      q.game_type === original.game_type &&
      q.difficulty === original.difficulty &&
      q.term === original.term,
    // tier 2: 放宽 term（保 game_type + difficulty）
    (q) =>
      baseFilter(q) &&
      q.skill_id === original.skill_id &&
      q.game_type === original.game_type &&
      q.difficulty === original.difficulty,
    // tier 3: 放宽 difficulty（保 game_type — 概念身份最该保住）
    (q) =>
      baseFilter(q) &&
      q.skill_id === original.skill_id &&
      q.game_type === original.game_type,
    // tier 4: 没有同 game_type 的题了，才 fallback 跨概念。
    //          仍保 difficulty + term（让难度感受相近）
    (q) =>
      baseFilter(q) &&
      q.skill_id === original.skill_id &&
      q.difficulty === original.difficulty &&
      q.term === original.term,
    // tier 5: 放宽 difficulty
    (q) =>
      baseFilter(q) &&
      q.skill_id === original.skill_id &&
      q.term === original.term,
    // tier 6: 放宽 term（同 skill）
    (q) => baseFilter(q) && q.skill_id === original.skill_id,
    // tier 7: 同学科任意题（保底，几乎不会到这里）
    (q) => baseFilter(q),
  ];

  for (const filter of tiers) {
    const candidates = pool.filter(filter);
    if (candidates.length === 0) continue;
    const counted = candidates.map((q) => ({
      q,
      seen: attemptCounts?.get(q.question_id) ?? 0,
      rand: rng(),
    }));
    counted.sort((a, b) => (a.seen - b.seen) || (a.rand - b.rand));
    return counted[0]?.q ?? null;
  }
  return null;
}
