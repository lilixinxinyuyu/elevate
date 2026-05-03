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
 */
function computeMasteryUpdate(
  oldScore: number | undefined,
  difficulty: number,
  isCorrect: boolean,
): MasteryUpdate {
  const old = oldScore ?? MASTERY_INIT;
  const correctTable: Record<number, number> = { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2 };
  const wrongTable: Record<number, number> = { 1: -3, 2: -3, 3: -3, 4: -2, 5: -2 };
  const delta = isCorrect
    ? correctTable[difficulty] ?? 4
    : wrongTable[difficulty] ?? -3;
  const next = Math.max(MASTERY_MIN, Math.min(MASTERY_MAX, old + delta));
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
  const m = computeMasteryUpdate(masteryRow?.score, args.question.difficulty, args.isCorrect);

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

  let totalXpAfter = 0;
  await db.transaction("rw", [db.attempts, db.mastery, db.meta], async () => {
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

    // 累加 totalXp
    const xpKey = metaKey("totalXp", args.studentId);
    const xpRow = await db.meta.get(xpKey);
    const prevXp = typeof xpRow?.value === "number" ? xpRow.value : 0;
    totalXpAfter = prevXp + score.points;
    await db.meta.put({ key: xpKey, value: totalXpAfter });
  });

  // 检查 trophy（独立事务，避免拉长主事务）
  const newTrophyIds = await checkAndAwardChineseTrophies(args.studentId);

  return {
    attempt,
    points: score.points,
    comboAfter: score.comboAfter,
    masteryFrom: m.oldScore,
    masteryTo: m.newScore,
    totalXpAfter,
    newTrophyIds,
  };
}

/**
 * 检查所有 chinese trophy 定义，发现新解锁的就写入 db.trophies 并返回 trophyId 列表。
 */
async function checkAndAwardChineseTrophies(studentId: string): Promise<string[]> {
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

  const newlyAwarded: string[] = [];
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
        newlyAwarded.push(def.id);
      }
    }

    // 计数型解锁
    if (def.tier) {
      const target = def.tier({ studentId, attempts: allAttempts, mastery: allMastery });
      const need = target - owned;
      for (let i = 0; i < need; i++) {
        const t: UserTrophy = {
          id: uid("t-"),
          studentId,
          subjectId: SUBJECT,
          trophyId: def.id,
          unlockedAt: Date.now(),
        };
        await db.trophies.put(t);
        newlyAwarded.push(def.id);
      }
    }
  }
  return newlyAwarded;
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
