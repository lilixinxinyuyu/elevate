/**
 * Fluency 引擎：60 秒 session 跑题、记录、聚合 stats、判 mastery、解锁 trophy。
 *
 * 跟现有 Train pipeline 完全平行 —— 不调 service.submitAttempt，不写 attempts /
 * mastery / mistakes / trophies 主表。Fluency 的 trophy 不进现有 BadgeInventory，
 * 单独一处显示。
 *
 * Phase 2 doc: docs/phase2-plan.md (Axis 3)
 */

import { db } from "../db/dexie";
import { schedulePushToCloud } from "../db/cloudSync";
import type {
  FluencyAttemptRow,
  FluencyModule,
  FluencyProblem,
  FluencySessionResult,
  FluencyStatsRow,
} from "../core/fluencyTypes";

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function statsKey(studentId: string, moduleId: string): string {
  return `${studentId}::${moduleId}`;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.floor(p * (sortedAsc.length - 1))),
  );
  return sortedAsc[idx] ?? 0;
}

// ---------------------------------------------------------------------------
// Session 控制：开 / 提交 / 结算
// ---------------------------------------------------------------------------

export function startFluencySession(): string {
  return newId("fs");
}

/** 写一条 attempt（一道题的答题记录） */
export async function recordFluencyAttempt(input: {
  studentId: string;
  moduleId: string;
  sessionId: string;
  problem: FluencyProblem;
  selectedAnswer: number;
  latencyMs: number;
}): Promise<FluencyAttemptRow> {
  const row: FluencyAttemptRow = {
    id: newId("fa"),
    studentId: input.studentId,
    moduleId: input.moduleId,
    sessionId: input.sessionId,
    problemKey: input.problem.key,
    selectedAnswer: input.selectedAnswer,
    correctAnswer: input.problem.correctAnswer,
    isCorrect: input.selectedAnswer === input.problem.correctAnswer,
    latencyMs: input.latencyMs,
    createdAt: Date.now(),
  };
  await db.fluencyAttempts.put(row);
  // v0.31.71: 防抖 push，确保 fluency 答题进度也实时同步
  schedulePushToCloud();
  return row;
}

/** 60 秒倒计时跑完后结算：拉本 session 的 attempts → 算指标 → 更新 stats →
 *  检查 mastery / trophy → 返回 result */
export async function finalizeFluencySession(input: {
  studentId: string;
  moduleId: string;
  sessionId: string;
  module: FluencyModule;
  durationMs: number;
}): Promise<FluencySessionResult> {
  const sessionAttempts = await db.fluencyAttempts
    .where("sessionId")
    .equals(input.sessionId)
    .toArray();

  const attemptsCount = sessionAttempts.length;
  const correct = sessionAttempts.filter((a) => a.isCorrect).length;
  const sortedLat = sessionAttempts.map((a) => a.latencyMs).sort((x, y) => x - y);
  const p50 = percentile(sortedLat, 0.5);
  const p95 = percentile(sortedLat, 0.95);

  // 当 session 内最长连击
  let cur = 0;
  let longestStreak = 0;
  for (const a of sessionAttempts.sort((x, y) => x.createdAt - y.createdAt)) {
    if (a.isCorrect) cur++;
    else cur = 0;
    if (cur > longestStreak) longestStreak = cur;
  }

  // 拉历史 stats
  const sk = statsKey(input.studentId, input.moduleId);
  const existing = (await db.fluencyStats.get(sk)) ?? null;

  const speedDeltaMs =
    existing?.lastSession?.p50LatencyMs && p50 > 0
      ? existing.lastSession.p50LatencyMs - p50
      : null;

  // 累计统计：跨 session 把所有 attempts 重新拉一遍算 p50/p95
  // （session 数不会很多，全 module 全部 attempts 也就几千行，能跑）
  const allAttempts = await db.fluencyAttempts
    .where("moduleId")
    .equals(input.moduleId)
    .filter((a: FluencyAttemptRow) => a.studentId === input.studentId)
    .toArray();
  const allLatSorted = allAttempts.map((a) => a.latencyMs).sort((x, y) => x - y);
  const totalAttempts = allAttempts.length;
  const totalCorrect = allAttempts.filter((a) => a.isCorrect).length;
  const allP50 = percentile(allLatSorted, 0.5);
  const allP95 = percentile(allLatSorted, 0.95);
  const accuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

  // mastery 判定
  const t = input.module.masteryThreshold;
  const meetsMastery =
    totalAttempts >= t.minAttempts &&
    accuracy >= t.accuracy &&
    allP50 > 0 &&
    allP50 <= t.p50LatencyMs;
  const newlyMastered = meetsMastery && !existing?.mastered;

  const newStats: FluencyStatsRow = {
    id: sk,
    studentId: input.studentId,
    moduleId: input.moduleId,
    totalAttempts,
    totalCorrect,
    p50LatencyMs: allP50,
    p95LatencyMs: allP95,
    bestStreak: Math.max(existing?.bestStreak ?? 0, longestStreak),
    lastSession: {
      at: Date.now(),
      attempts: attemptsCount,
      correct,
      p50LatencyMs: p50,
      streak: longestStreak,
    },
    mastered: meetsMastery,
    masteredAt: newlyMastered ? Date.now() : existing?.masteredAt ?? null,
  };
  await db.fluencyStats.put(newStats);

  // trophy 解锁（不写主 trophies 表，单独 meta 里存 fluencyTrophies set）
  const unlockedTrophies = await checkAndUnlockFluencyTrophies({
    studentId: input.studentId,
    moduleId: input.moduleId,
    stats: newStats,
    sessionAttempts: attemptsCount,
    sessionStreak: longestStreak,
    sessionP50: p50,
  });

  // v0.31.90 → v0.31.91 回滚 session_complete XP（真 bug 是 TutorPanel
  // fallback 没给 XP，已修在 TutorPanel.tsx）。

  return {
    moduleId: input.moduleId,
    sessionId: input.sessionId,
    durationMs: input.durationMs,
    totalAttempts: attemptsCount,
    totalCorrect: correct,
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    longestStreak,
    speedDeltaMs,
    newlyMastered,
    unlockedTrophies,
  };
}

// ---------------------------------------------------------------------------
// Stats 读取（页面卡片展示用）
// ---------------------------------------------------------------------------

export async function getFluencyStats(
  studentId: string,
  moduleId: string,
): Promise<FluencyStatsRow | null> {
  return (await db.fluencyStats.get(statsKey(studentId, moduleId))) ?? null;
}

export async function getAllFluencyStats(studentId: string): Promise<FluencyStatsRow[]> {
  return await db.fluencyStats.where("studentId").equals(studentId).toArray();
}

// ---------------------------------------------------------------------------
// Fluency 专属 trophy（独立体系，不进现有 trophies 表）
// ---------------------------------------------------------------------------

/** Fluency 勋章 ID 命名空间：fluency_<moduleId>_<level> | fluency_global_<level> */
const FLUENCY_UNLOCKS_META_KEY = "fluencyTrophiesUnlocked";

async function getUnlockedTrophies(): Promise<Set<string>> {
  const row = await db.meta.get(FLUENCY_UNLOCKS_META_KEY);
  const arr = Array.isArray(row?.value) ? (row.value as string[]) : [];
  return new Set(arr);
}

async function persistUnlockedTrophies(set: Set<string>): Promise<void> {
  await db.meta.put({ key: FLUENCY_UNLOCKS_META_KEY, value: Array.from(set) });
}

async function checkAndUnlockFluencyTrophies(input: {
  studentId: string;
  moduleId: string;
  stats: FluencyStatsRow;
  sessionAttempts: number;
  sessionStreak: number;
  sessionP50: number;
}): Promise<string[]> {
  const unlocked = await getUnlockedTrophies();
  const newOnes: string[] = [];
  const tryUnlock = (id: string) => {
    if (!unlocked.has(id)) {
      unlocked.add(id);
      newOnes.push(id);
    }
  };

  // module-level mastery
  if (input.stats.mastered) {
    tryUnlock(`fluency_${input.moduleId}_master`);
  }

  // session-level：单 session 30+ 题
  if (input.sessionAttempts >= 30) tryUnlock("fluency_speed_demon_30");
  // session-level：单 session 50+ 题
  if (input.sessionAttempts >= 50) tryUnlock("fluency_speed_demon_50");
  // session-level：连击 20+
  if (input.sessionStreak >= 20) tryUnlock("fluency_combo_20");
  // session-level：连击 30+
  if (input.sessionStreak >= 30) tryUnlock("fluency_combo_30");
  // session-level：p50 ≤ 1500ms 且 ≥ 20 题
  if (input.sessionAttempts >= 20 && input.sessionP50 > 0 && input.sessionP50 <= 1500) {
    tryUnlock("fluency_lightning");
  }

  if (newOnes.length > 0) await persistUnlockedTrophies(unlocked);
  return newOnes;
}

export async function getFluencyUnlockedTrophyIds(): Promise<string[]> {
  return Array.from(await getUnlockedTrophies());
}

// ---------------------------------------------------------------------------
// Trophy meta（命名 + 描述）— 用于 fluency 勋章柜展示
// ---------------------------------------------------------------------------

export interface FluencyTrophyMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const FLUENCY_TROPHY_DEFS: FluencyTrophyMeta[] = [
  {
    id: "fluency_speed_demon_30",
    name: "飞毛腿 30",
    description: "单次 60s 答完 30 题。",
    icon: "🚀",
  },
  {
    id: "fluency_speed_demon_50",
    name: "飞毛腿 50",
    description: "单次 60s 答完 50 题。",
    icon: "⚡",
  },
  {
    id: "fluency_combo_20",
    name: "连击 20",
    description: "单次 session 连续答对 20 题。",
    icon: "🔥",
  },
  {
    id: "fluency_combo_30",
    name: "连击 30",
    description: "单次 session 连续答对 30 题。",
    icon: "💥",
  },
  {
    id: "fluency_lightning",
    name: "闪电反应",
    description: "单次 session 中位反应 ≤ 1.5 秒（≥ 20 题）。",
    icon: "⚡",
  },
];

/** 单 module mastery 勋章动态生成 */
export function moduleMasteryTrophy(moduleId: string, moduleName: string): FluencyTrophyMeta {
  return {
    id: `fluency_${moduleId}_master`,
    name: `${moduleName} 大师`,
    description: `${moduleName} 模块达成准确度 + 速度双指标。`,
    icon: "🏆",
  };
}
