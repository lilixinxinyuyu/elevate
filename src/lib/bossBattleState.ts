/**
 * 闯关 boss battle 持久化状态 (v0.31.49)
 *
 * 每 student × unit 保存：bestStars / totalAttempts / lastAttemptAt / perfectCount
 * 期末解锁条件：6 单元全部 ≥ 3 星
 * 满星挑战勋章：6 单元全 4 星 + 期末 4 星
 *
 * 救场次数随数学段位（school → country）动态。
 */

import { db } from "../db/dexie";
import { UNITS } from "../content/units";
import { computeCurrentRating } from "../db/service";
import { rescueAllowanceForTier, type RescueAllowance } from "../core/bossPersonas";

export interface BossState {
  bestStars: 0 | 1 | 2 | 3 | 4;
  totalAttempts: number;
  lastAttemptAt: number;
  perfectCount: number;
}

const FRESH_STATE: BossState = {
  bestStars: 0,
  totalAttempts: 0,
  lastAttemptAt: 0,
  perfectCount: 0,
};

function key(studentId: string, unitId: string): string {
  return `boss::${studentId}::${unitId}`;
}

export async function loadBossState(
  studentId: string,
  unitId: string,
): Promise<BossState> {
  const row = await db.meta.get(key(studentId, unitId));
  if (!row?.value) return { ...FRESH_STATE };
  const v = row.value as Partial<BossState>;
  return {
    bestStars: ((v.bestStars ?? 0) as BossState["bestStars"]),
    totalAttempts: v.totalAttempts ?? 0,
    lastAttemptAt: v.lastAttemptAt ?? 0,
    perfectCount: v.perfectCount ?? 0,
  };
}

export async function recordBossAttempt(
  studentId: string,
  unitId: string,
  starsThisAttempt: 0 | 1 | 2 | 3 | 4,
): Promise<BossState> {
  const cur = await loadBossState(studentId, unitId);
  const next: BossState = {
    bestStars: (Math.max(cur.bestStars, starsThisAttempt) as BossState["bestStars"]),
    totalAttempts: cur.totalAttempts + 1,
    lastAttemptAt: Date.now(),
    perfectCount: cur.perfectCount + (starsThisAttempt === 4 ? 1 : 0),
  };
  await db.meta.put({ key: key(studentId, unitId), value: next });
  return next;
}

/** correct / total → 星数 */
export function starsFromAccuracy(correct: number, total: number): 0 | 1 | 2 | 3 | 4 {
  if (correct < 4) return 0;
  if (correct === total) return 4;
  if (correct >= 6) return 3;
  if (correct >= 5) return 2;
  return 1;
}

const G4B_UNIT_IDS = [
  "G4B_U1_DECIMAL_ADD_SUB",
  "G4B_U2_TRI_QUAD",
  "G4B_U3_DECIMAL_MULTIPLY",
  "G4B_U4_OBSERVE_OBJECTS",
  "G4B_U5_EQUATIONS",
  "G4B_U6_DATA",
];

/** 获取所有单元的 boss 状态（用于 BossWorld 列表） */
export async function loadAllBossStates(
  studentId: string,
): Promise<Map<string, BossState>> {
  const map = new Map<string, BossState>();
  for (const u of UNITS.filter((x) => x.term === "下册")) {
    map.set(u.id, await loadBossState(studentId, u.id));
  }
  return map;
}

/**
 * 期末大魔王解锁条件：6 单元全 ≥ 3 星
 */
export async function canChallengeFinal(studentId: string): Promise<{
  unlocked: boolean;
  metCount: number;
  totalUnits: number;
  perfectCount: number;
}> {
  const states = await loadAllBossStates(studentId);
  let metCount = 0;
  let perfectCount = 0;
  for (const uid of G4B_UNIT_IDS) {
    const s = states.get(uid);
    if (s && s.bestStars >= 3) metCount++;
    if (s && s.bestStars === 4) perfectCount++;
  }
  return {
    unlocked: metCount === G4B_UNIT_IDS.length,
    metCount,
    totalUnits: G4B_UNIT_IDS.length,
    perfectCount,
  };
}

/**
 * 当前 student 的救场配额 — 根据数学段位动态算
 */
export async function getRescueAllowance(
  studentId: string,
): Promise<RescueAllowance> {
  try {
    const r = await computeCurrentRating(studentId, "下册");
    return rescueAllowanceForTier(r.tier);
  } catch {
    return rescueAllowanceForTier(null);
  }
}
