/**
 * 语文 mini-service — chinese subject 独立的 attempts / mastery / trophy / XP 管线。
 *
 * 设计取舍：
 *  - 不复用 math 那套 service.ts（重耦合 math 内容）
 *  - 直接读写 db.attempts / db.mastery / db.trophies / db.meta，但所有写入都
 *    stamp subjectId="chinese"
 *  - meta key 一律 namespace 到 ::chinese:: 段（例如 totalXp::chinese::default-student）
 *  - 简化 mastery 算法：对 +6，错 -4，依赖 difficulty 微调；不做"做过 cooldown"
 *  - 简化 scoring：base=10, difficulty 加成，连击 +20% / +40% / +60%（最多 +60%）
 *  - trophy 检查：基于 chinese-only attempts，集合在 src/subjects/chinese/trophies.ts
 *
 * 不做的（期中后做）:
 *  - 错题间隔复习（spaced review）
 *  - 历史 errorTag 故事化
 *  - tier / rating 系统接入（math 那套段位，chinese 期中后再接）
 */

import { db } from "../../db/dexie";
import type {
  Attempt,
  MasteryScore,
  MistakeReview,
  Question,
  StudentProfile,
  UserTrophy,
} from "../../core/types";
import { CHINESE_TROPHIES, type ChineseTrophyDef } from "./trophies";

const SUBJECT = "chinese" as const;

/** meta key 拼接：name::chinese::studentId[::extra] */
function metaKey(name: string, studentId: string, extra?: string): string {
  return extra
    ? `${name}::${SUBJECT}::${studentId}::${extra}`
    : `${name}::${SUBJECT}::${studentId}`;
}

function masteryRowId(studentId: string, skillId: string): string {
  // chinese 用 ${studentId}::chinese::${skillId}，避开 math 的 ${studentId}::${skillId}
  return `${studentId}::${SUBJECT}::${skillId}`;
}

function uid(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================
//  Scoring
// ============================================================

export interface ChineseScoreInput {
  difficulty: 1 | 2 | 3 | 4 | 5;
  isCorrect: boolean;
  comboBefore: number; // 提交前已经连对几道
  isReview?: boolean;
}

export interface ChineseScoreOutput {
  points: number;
  comboAfter: number;
  baseDelta: number;
  comboMultiplier: number;
}

/**
 * 简化版 scoring：
 *   base = 10 + difficulty * 2     （10 / 12 / 14 / 16 / 18）
 *   combo 倍数：1（首次连对）→ 1.2 → 1.4 → 1.6（封顶 +60%）
 *   错答 = 0 分，combo 归零
 *   review 模式（错题复活）每分加倍鼓励
 */
export function chineseScore(input: ChineseScoreInput): ChineseScoreOutput {
  if (!input.isCorrect) {
    return { points: 0, comboAfter: 0, baseDelta: 0, comboMultiplier: 1 };
  }
  const baseDelta = 10 + input.difficulty * 2;
  const comboAfter = input.comboBefore + 1;
  // 连击 1 不加，2-4 每级 +20%，封顶 +60%
  const comboBoost = Math.min(0.6, Math.max(0, comboAfter - 1) * 0.2);
  const reviewBoost = input.isReview ? 1.5 : 1.0;
  const points = Math.round(baseDelta * (1 + comboBoost) * reviewBoost);
  return {
    points,
    comboAfter,
    baseDelta,
    comboMultiplier: 1 + comboBoost,
  };
}

// ============================================================
//  Mastery
// ============================================================

const MASTERY_MIN = 0;
const MASTERY_MAX = 100;
const MASTERY_INIT = 50;

interface MasteryUpdate {
  oldScore: number;
  newScore: number;
  delta: number;
}

/**
 * 简化 mastery：
 *   对 +6（D1）/ +5（D2）/ +4（D3）/ +3（D4）/ +2（D5）
 *   错 -3（D1）/ -3（D2）/ -3（D3）/ -2（D4）/ -2（D5）
 *   越简单的题做错惩罚越大；越难的题做对奖励大但增量平缓
 *
 * Round 6 加防护：
 *   - priorCorrectCount：第 N 次答对同题衰减（×1.0/0.5/0.2/0.1/0）
 *   - uniqueQuestionsTried：题面广度封顶 30+10×N
 *   防"刷一道题刷到 mastery=100" 假象。
 */
const CHINESE_REPEAT_DECAY = [1.0, 0.5, 0.2, 0.1] as const;
function chineseRepeatMul(priorCorrectCount: number): number {
  if (priorCorrectCount <= 0) return 1.0;
  if (priorCorrectCount >= CHINESE_REPEAT_DECAY.length) return 0;
  return CHINESE_REPEAT_DECAY[priorCorrectCount] ?? 0;
}

function computeMasteryUpdate(
  oldScore: number | undefined,
  difficulty: number,
  isCorrect: boolean,
  priorCorrectCount = 0,
  uniqueQuestionsTried?: number,
): MasteryUpdate {
  const old = oldScore ?? MASTERY_INIT;
  const correctTable: Record<number, number> = { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2 };
  const wrongTable: Record<number, number> = { 1: -3, 2: -3, 3: -3, 4: -2, 5: -2 };
  let delta = isCorrect
    ? correctTable[difficulty] ?? 4
    : wrongTable[difficulty] ?? -3;
  if (isCorrect) delta *= chineseRepeatMul(priorCorrectCount);
  let next = Math.max(MASTERY_MIN, Math.min(MASTERY_MAX, old + delta));
  // 题面广度封顶
  if (typeof uniqueQuestionsTried === "number") {
    const cap = Math.min(MASTERY_MAX, 30 + uniqueQuestionsTried * 10);
    if (next > cap && delta > 0) next = Math.max(old, cap);
  }
  return { oldScore: old, newScore: next, delta: next - old };
}

// ============================================================
//  公开 API
// ============================================================

export interface ChineseAttemptResult {
  attempt: Attempt;
  points: number;
  comboAfter: number;
  masteryFrom: number;
  masteryTo: number;
  totalXpAfter: number;
  newTrophyIds: string[];
  /** 富信息 award：用于 milestone 判定（缺省 = 全空数组兼容老调用方） */
  newAwards?: ChineseAwardEntry[];
}

/**
 * 提交一道题的作答。写入 attempts + 更新 mastery + 更新 totalXp + 检查新解锁 trophy。
 */
export async function submitChineseAttempt(args: {
  studentId: string;
  sessionId: string;
  question: Question;
  isCorrect: boolean;
  chosenOptionId: string;
  elapsedSeconds: number;
  comboBefore: number;
  isReview?: boolean;
}): Promise<ChineseAttemptResult> {
  const score = chineseScore({
    difficulty: args.question.difficulty,
    isCorrect: args.isCorrect,
    comboBefore: args.comboBefore,
    isReview: args.isReview,
  });

  const masteryRow = await db.mastery.get(masteryRowId(args.studentId, args.question.skill_id));

  // 同题刷分防护：算这道题之前答对过几次
  const priorCorrectCount = args.isCorrect
    ? (
        await db.attempts
          .where("studentId")
          .equals(args.studentId)
          .filter(
            (a) =>
              (a.subjectId ?? "math") === SUBJECT &&
              a.questionId === args.question.question_id &&
              a.isCorrect,
          )
          .count()
      )
    : 0;
  // 题面广度：这个 skill 学生做过多少道唯一题
  const skillAttempts = await db.attempts
    .where("studentId")
    .equals(args.studentId)
    .filter(
      (a) =>
        (a.subjectId ?? "math") === SUBJECT && a.skillId === args.question.skill_id,
    )
    .toArray();
  const uniqueQs = new Set(skillAttempts.map((a) => a.questionId));
  uniqueQs.add(args.question.question_id);

  const m = computeMasteryUpdate(
    masteryRow?.score,
    args.question.difficulty,
    args.isCorrect,
    priorCorrectCount,
    uniqueQs.size,
  );

  const attempt: Attempt = {
    id: uid("a-"),
    studentId: args.studentId,
    subjectId: SUBJECT,
    questionId: args.question.question_id,
    skillId: args.question.skill_id,
    sessionId: args.sessionId,
    answer: args.chosenOptionId,
    isCorrect: args.isCorrect,
    hintsOpened: 0,
    elapsedSeconds: args.elapsedSeconds,
    errorTags: args.isCorrect
      ? []
      : (args.question.options ?? [])
          .filter((o) => o.id === args.chosenOptionId && o.errorTag)
          .map((o) => o.errorTag!),
    scoreDelta: { total: score.points, byAbility: {} },
    masteryDelta: m.delta,
    isReview: !!args.isReview,
    comboAtEnd: score.comboAfter,
    createdAt: Date.now(),
  };

  // 错题处理：找到/创建该 question 在 chinese 域下的 mistake row
  const existingMistake = (
    await db.mistakes
      .where({ studentId: args.studentId, questionId: args.question.question_id })
      .toArray()
  ).find((mr) => mr.subjectId === SUBJECT);

  let totalXpAfter = 0;
  await db.transaction("rw", [db.attempts, db.mastery, db.mistakes, db.meta], async () => {
    await db.attempts.put(attempt);

    const next: MasteryScore = {
      id: masteryRowId(args.studentId, args.question.skill_id),
      studentId: args.studentId,
      subjectId: SUBJECT,
      skillId: args.question.skill_id,
      score: m.newScore,
      attemptsCount: (masteryRow?.attemptsCount ?? 0) + 1,
      correctCount: (masteryRow?.correctCount ?? 0) + (args.isCorrect ? 1 : 0),
      lastPracticedAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.mastery.put(next);

    // 错题表更新（chinese 错题复活用）
    if (!args.isCorrect) {
      // 错答：新建 / 重置 mistake，stage 0，1 天后再练
      const mistakeRow: MistakeReview = existingMistake
        ? {
            ...existingMistake,
            stage: 0,
            nextReviewAt: Date.now() + 24 * 60 * 60 * 1000,
            errorTags: attempt.errorTags,
            lastAttemptAt: Date.now(),
            resolved: false,
          }
        : {
            id: uid("m-"),
            studentId: args.studentId,
            subjectId: SUBJECT,
            questionId: args.question.question_id,
            skillId: args.question.skill_id,
            stage: 0,
            nextReviewAt: Date.now() + 24 * 60 * 60 * 1000,
            lastAttemptAt: Date.now(),
            errorTags: attempt.errorTags,
            resolved: false,
          };
      await db.mistakes.put(mistakeRow);
    } else if (existingMistake && !existingMistake.resolved) {
      // 错题再答对：推进 stage；超过 3 阶段标 resolved
      const newStage = existingMistake.stage + 1;
      const updated: MistakeReview = {
        ...existingMistake,
        stage: newStage,
        nextReviewAt: Date.now() + (newStage === 1 ? 3 : newStage === 2 ? 7 : 14) * 24 * 60 * 60 * 1000,
        lastAttemptAt: Date.now(),
        resolved: newStage >= 3,
      };
      await db.mistakes.put(updated);
    }

    // 累加 totalXp
    const xpKey = metaKey("totalXp", args.studentId);
    const xpRow = await db.meta.get(xpKey);
    const prevXp = typeof xpRow?.value === "number" ? xpRow.value : 0;
    totalXpAfter = prevXp + score.points;
    await db.meta.put({ key: xpKey, value: totalXpAfter });
  });

  // 检查 trophy（独立事务，避免拉长主事务）
  const newAwards = await checkAndAwardChineseTrophies(args.studentId);
  // 兼容老 caller：展开成 string[]
  const newTrophyIds: string[] = [];
  for (const aw of newAwards) {
    for (let i = 0; i < aw.count; i++) newTrophyIds.push(aw.trophyId);
  }

  return {
    attempt,
    points: score.points,
    comboAfter: score.comboAfter,
    masteryFrom: m.oldScore,
    masteryTo: m.newScore,
    totalXpAfter,
    newTrophyIds,
    /** Round 6: 富信息 award，用于 milestone 判定 */
    newAwards,
  };
}

/**
 * Round 6 加：chinese 也用 award entry 富信息（newTotalCount + isRare），
 * UI 可以判定 milestone 触发盲盒。
 */
export interface ChineseAwardEntry {
  trophyId: string;
  count: number;
  newTotalCount: number;
  isRare: boolean;
}

/**
 * 检查所有 chinese trophy 定义，发现新解锁的就写入 db.trophies 并返回富信息。
 *
 * 兼容回 `string[]` 调用：repeated 展开 entry.count 次。
 */
async function checkAndAwardChineseTrophies(studentId: string): Promise<ChineseAwardEntry[]> {
  const allAttempts = await db.attempts
    .where("studentId")
    .equals(studentId)
    .filter((a) => a.subjectId === SUBJECT)
    .toArray();
  const allMastery = await db.mastery
    .where("studentId")
    .equals(studentId)
    .filter((m) => m.subjectId === SUBJECT)
    .toArray();
  const allTrophies = await db.trophies
    .where("studentId")
    .equals(studentId)
    .filter((t) => t.subjectId === SUBJECT)
    .toArray();

  const ownedCounts = new Map<string, number>();
  for (const t of allTrophies) {
    ownedCounts.set(t.trophyId, (ownedCounts.get(t.trophyId) ?? 0) + 1);
  }

  const awards: ChineseAwardEntry[] = [];
  for (const def of CHINESE_TROPHIES) {
    const owned = ownedCounts.get(def.id) ?? 0;

    // 单次解锁
    if (def.check && owned === 0) {
      if (def.check({ studentId, attempts: allAttempts, mastery: allMastery })) {
        const t: UserTrophy = {
          id: uid("t-"),
          studentId,
          subjectId: SUBJECT,
          trophyId: def.id,
          unlockedAt: Date.now(),
        };
        await db.trophies.put(t);
        awards.push({ trophyId: def.id, count: 1, newTotalCount: 1, isRare: true });
      }
    }

    // 计数型解锁
    if (def.tier) {
      const target = def.tier({ studentId, attempts: allAttempts, mastery: allMastery });
      const need = target - owned;
      if (need > 0) {
        for (let i = 0; i < need; i++) {
          const t: UserTrophy = {
            id: uid("t-"),
            studentId,
            subjectId: SUBJECT,
            trophyId: def.id,
            unlockedAt: Date.now(),
          };
          await db.trophies.put(t);
        }
        awards.push({
          trophyId: def.id,
          count: need,
          newTotalCount: target,
          isRare: false,
        });
      }
    }
  }
  return awards;
}

// ============================================================
//  读取 API
// ============================================================

export async function getChineseTotalXp(studentId: string): Promise<number> {
  const row = await db.meta.get(metaKey("totalXp", studentId));
  return typeof row?.value === "number" ? row.value : 0;
}

export async function getChineseTrophies(studentId: string): Promise<{
  defsById: Map<string, ChineseTrophyDef>;
  ownedCounts: Map<string, number>;
  recentlyUnlocked: UserTrophy[];
}> {
  const owned = await db.trophies
    .where("studentId")
    .equals(studentId)
    .filter((t) => t.subjectId === SUBJECT)
    .toArray();
  const ownedCounts = new Map<string, number>();
  for (const t of owned) {
    ownedCounts.set(t.trophyId, (ownedCounts.get(t.trophyId) ?? 0) + 1);
  }
  const defsById = new Map(CHINESE_TROPHIES.map((d) => [d.id, d]));
  const recentlyUnlocked = owned
    .sort((a, b) => b.unlockedAt - a.unlockedAt)
    .slice(0, 8);
  return { defsById, ownedCounts, recentlyUnlocked };
}

export async function getChineseSkillMastery(studentId: string): Promise<MasteryScore[]> {
  return await db.mastery
    .where("studentId")
    .equals(studentId)
    .filter((m) => m.subjectId === SUBJECT)
    .toArray();
}

export async function getChineseRecentAttempts(
  studentId: string,
  limit = 50,
): Promise<Attempt[]> {
  const arr = await db.attempts
    .where("studentId")
    .equals(studentId)
    .filter((a) => a.subjectId === SUBJECT)
    .reverse()
    .limit(limit)
    .toArray();
  return arr;
}

/** chinese-side 段位思路：用 totalXp 简单算等级 + 称号。Phase 3 接 tier 系统。 */
export interface ChineseLevelInfo {
  level: number;
  totalXp: number;
  xpThisLevel: number;
  xpNextLevel: number;
  title: string;
}

const CHINESE_TITLES = [
  "童生", // 0
  "学子", // 1
  "秀才", // 2
  "贡生", // 3
  "举人", // 4
  "进士", // 5
  "探花", // 6
  "榜眼", // 7
  "状元", // 8
];

export function chineseLevelInfo(totalXp: number): ChineseLevelInfo {
  const PER_LEVEL = 250; // 250 XP 一级
  const level = Math.floor(totalXp / PER_LEVEL);
  const xpThisLevel = totalXp - level * PER_LEVEL;
  const xpNextLevel = PER_LEVEL;
  const title = CHINESE_TITLES[Math.min(level, CHINESE_TITLES.length - 1)] ?? "童生";
  return { level, totalXp, xpThisLevel, xpNextLevel, title };
}

/** 第一次接入 ChineseTrain 时建一个新 sessionId（不写 sessions 表，简化）。 */
export function createChineseSessionId(): string {
  return uid("cs-");
}

/** 用于 ChineseTrain 完成时上报 session 总分（写 meta，将来 home 显示用）。 */
export async function recordChineseSessionFinish(args: {
  studentId: string;
  sessionId: string;
  total: number;
  correct: number;
  xpGained: number;
}): Promise<void> {
  const key = metaKey("lastSessionSummary", args.studentId);
  await db.meta.put({
    key,
    value: {
      sessionId: args.sessionId,
      total: args.total,
      correct: args.correct,
      xpGained: args.xpGained,
      finishedAt: Date.now(),
    },
  });
}

// ============================================================
//  错题复活 & 模拟测试
// ============================================================

/**
 * 拉到期 / 未消化的错题题 id 集合（按 subjectId="chinese" 过滤）。
 * stage 0 = 答错过还没再答对；nextReviewAt <= 现在 = 到期可以再练。
 * 返回最多 limit 个。
 */
export async function getChineseMistakeQuestionIds(
  studentId: string,
  limit = 30,
  options: { onlyDue?: boolean } = {},
): Promise<string[]> {
  const all = await db.mistakes
    .where("studentId")
    .equals(studentId)
    .filter((m) => m.subjectId === SUBJECT && !m.resolved)
    .toArray();
  const filtered = options.onlyDue
    ? all.filter((m) => m.nextReviewAt <= Date.now())
    : all;
  filtered.sort((a, b) => a.nextReviewAt - b.nextReviewAt);
  return filtered.slice(0, limit).map((m) => m.questionId);
}

/** 错题数（未消化的）— ChineseHome 顶部小红点用 */
export async function countChineseUnresolvedMistakes(studentId: string): Promise<number> {
  return await db.mistakes
    .where("studentId")
    .equals(studentId)
    .filter((m) => m.subjectId === SUBJECT && !m.resolved)
    .count();
}

/** 模拟测试节流：6 天一次（与 math 一致） */
const MOCK_EXAM_LAST_KEY = "chineseMockExamLastAt";

export async function getChineseMockExamCooldown(studentId: string): Promise<{
  available: boolean;
  daysUntilNext: number;
  lastAt: number | null;
}> {
  const row = await db.meta.get(metaKey(MOCK_EXAM_LAST_KEY, studentId));
  const lastAt = typeof row?.value === "number" ? row.value : null;
  if (lastAt === null) return { available: true, daysUntilNext: 0, lastAt: null };
  const days = (Date.now() - lastAt) / (24 * 60 * 60 * 1000);
  if (days >= 6) return { available: true, daysUntilNext: 0, lastAt };
  return { available: false, daysUntilNext: Math.ceil(6 - days), lastAt };
}

export async function recordChineseMockExamCompleted(studentId: string): Promise<void> {
  await db.meta.put({
    key: metaKey(MOCK_EXAM_LAST_KEY, studentId),
    value: Date.now(),
  });
}

// ============================================================
//  Reset / 测试数据清理
// ============================================================

/**
 * 清空所有 chinese 维度的学生数据：attempts / mastery / mistakes / trophies +
 * 6 类 meta key（totalXp / lastSessionSummary / chineseMockExamLastAt etc）。
 *
 * math 数据 100% 不动（subjectId 隔离）。
 */
export async function resetChineseTestData(studentId: string): Promise<{
  attempts: number;
  mastery: number;
  mistakes: number;
  trophies: number;
  metaKeys: number;
}> {
  const [attemptKeys, masteryKeys, mistakeKeys, trophyKeys] = await Promise.all([
    db.attempts
      .where("studentId").equals(studentId)
      .filter((a) => a.subjectId === SUBJECT)
      .primaryKeys(),
    db.mastery
      .where("studentId").equals(studentId)
      .filter((m) => m.subjectId === SUBJECT)
      .primaryKeys(),
    db.mistakes
      .where("studentId").equals(studentId)
      .filter((m) => m.subjectId === SUBJECT)
      .primaryKeys(),
    db.trophies
      .where("studentId").equals(studentId)
      .filter((t) => t.subjectId === SUBJECT)
      .primaryKeys(),
  ]);

  // chinese 命名空间的 meta key（::chinese:: 段）
  const allMeta = await db.meta.toArray();
  const chineseMetaKeys = allMeta
    .filter((row) => row.key.includes(`::${SUBJECT}::`))
    .map((row) => row.key);

  await db.transaction(
    "rw",
    [db.attempts, db.mastery, db.mistakes, db.trophies, db.meta],
    async () => {
      if (attemptKeys.length) await db.attempts.bulkDelete(attemptKeys);
      if (masteryKeys.length) await db.mastery.bulkDelete(masteryKeys);
      if (mistakeKeys.length) await db.mistakes.bulkDelete(mistakeKeys);
      if (trophyKeys.length) await db.trophies.bulkDelete(trophyKeys);
      if (chineseMetaKeys.length) await db.meta.bulkDelete(chineseMetaKeys);
    },
  );

  return {
    attempts: attemptKeys.length,
    mastery: masteryKeys.length,
    mistakes: mistakeKeys.length,
    trophies: trophyKeys.length,
    metaKeys: chineseMetaKeys.length,
  };
}
