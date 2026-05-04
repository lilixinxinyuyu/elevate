import type { Attempt, TrophyCheckContext, TrophyDef } from "./types";

function streakDays(dateKeys: string[]): number {
  if (dateKeys.length === 0) return 0;
  const sorted = Array.from(new Set(dateKeys)).sort().reverse();
  let streak = 0;
  const today = sorted[0]!;
  const cursor = new Date(today + "T00:00:00");
  for (const k of sorted) {
    const expected = cursor.toISOString().slice(0, 10);
    if (k === expected) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

function bestComboBySession(attempts: Attempt[]): Map<string, number> {
  const sorted = attempts.slice().sort((a, b) => a.createdAt - b.createdAt);
  const cur = new Map<string, number>();
  const best = new Map<string, number>();
  for (const a of sorted) {
    const k = a.sessionId ?? "none";
    if (a.isCorrect) {
      const next = (cur.get(k) ?? 0) + 1;
      cur.set(k, next);
      best.set(k, Math.max(best.get(k) ?? 0, next));
    } else {
      cur.set(k, 0);
    }
  }
  return best;
}

function sessionsThatHitCombo(attempts: Attempt[], n: number): number {
  const best = bestComboBySession(attempts);
  let count = 0;
  best.forEach((v) => {
    if (v >= n) count += 1;
  });
  return count;
}

function uniqueSessionFinishCount(attempts: Attempt[]): number {
  const set = new Set<string>();
  for (const a of attempts) if (a.sessionId) set.add(a.sessionId);
  return set.size;
}

function bestRunningCorrectStreak(attempts: Attempt[], filter: (a: Attempt) => boolean): number {
  const sorted = attempts.filter(filter).sort((a, b) => a.createdAt - b.createdAt);
  let run = 0, best = 0;
  for (const a of sorted) {
    run = a.isCorrect ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export const TROPHIES: TrophyDef[] = [
  // —— 单次里程碑 ——
  { id: "first_step", name: "第一步", description: "完成第一次挑战。", icon: "🌟",
    check: (ctx) => ctx.attempts.length >= 1 },
  { id: "streak_3", name: "三天小火苗", description: "连续 3 天挑战。", icon: "🔥",
    check: (ctx) => streakDays(ctx.attempts.map((a) => new Date(a.createdAt).toISOString().slice(0, 10))) >= 3 },
  { id: "streak_7", name: "一周连胜", description: "连续 7 天挑战。", icon: "🔥",
    check: (ctx) => streakDays(ctx.attempts.map((a) => new Date(a.createdAt).toISOString().slice(0, 10))) >= 7 },
  { id: "streak_30", name: "月度恒星", description: "连续 30 天挑战。", icon: "🌟",
    check: (ctx) => streakDays(ctx.attempts.map((a) => new Date(a.createdAt).toISOString().slice(0, 10))) >= 30 },
  { id: "total_50", name: "答题 50 题", description: "累计答完 50 道题。", icon: "🎯",
    check: (ctx) => ctx.attempts.length >= 50 },
  { id: "total_200", name: "答题 200 题", description: "累计答完 200 道题。", icon: "🎯",
    check: (ctx) => ctx.attempts.length >= 200 },
  { id: "total_500", name: "答题 500 题", description: "累计答完 500 道题。", icon: "🏆",
    check: (ctx) => ctx.attempts.length >= 500 },

  // —— 重复型 / 计数型 ——
  { id: "daily_complete", name: "今日完成", description: "完成一次今日挑战。", icon: "🗓️",
    tier: (ctx) => uniqueSessionFinishCount(ctx.attempts) },
  { id: "combo_5", name: "五连击", description: "一局里连对 5 题。", icon: "⚡",
    tier: (ctx) => sessionsThatHitCombo(ctx.attempts, 5) },
  { id: "combo_10", name: "十连神", description: "一局里连对 10 题。", icon: "🌈",
    tier: (ctx) => sessionsThatHitCombo(ctx.attempts, 10) },
  { id: "combo_15", name: "终极爆发", description: "一局里连对 15 题。", icon: "💫",
    tier: (ctx) => sessionsThatHitCombo(ctx.attempts, 15) },
  { id: "mistake_reborn", name: "错题复活王", description: "成功复活错题，每 5 次解锁。", icon: "🪄",
    tier: (ctx) => Math.floor(ctx.attempts.filter((a) => a.isReview && a.isCorrect).length / 5) },
  { id: "speed_demon", name: "疾风手", description: "一气连续 5 题用时都 ≤ 8 秒，每达成一次解锁。", icon: "💨",
    tier: (ctx) => {
      const sorted = ctx.attempts.slice().sort((a, b) => a.createdAt - b.createdAt);
      let count = 0, run = 0;
      for (const a of sorted) {
        if (a.isCorrect && a.elapsedSeconds <= 8) {
          run += 1;
          if (run === 5) {
            count += 1;
            run = 0;
          }
        } else run = 0;
      }
      return count;
    },
  },
  { id: "no_hint_run", name: "独立思考 10 连", description: "连续 10 题不用提示且全对，每达成一次解锁。", icon: "🧠",
    tier: (ctx) => {
      const sorted = ctx.attempts.slice().sort((a, b) => a.createdAt - b.createdAt);
      let count = 0, run = 0;
      for (const a of sorted) {
        if (a.isCorrect && a.hintsOpened === 0) {
          run += 1;
          if (run === 10) {
            count += 1;
            run = 0;
          }
        } else run = 0;
      }
      return count;
    },
  },

  // —— 技能领域类 ——
  { id: "decimal_hero_10", name: "小数小英雄", description: "小数类题答对 10 道，每 10 次解锁一次。", icon: "💎",
    tier: (ctx) => Math.floor(ctx.attempts.filter((a) => a.isCorrect && a.skillId.startsWith("decimal_")).length / 10) },
  { id: "equation_hero_10", name: "方程小专家", description: "方程类题答对 10 道，每 10 次解锁一次。", icon: "⚖️",
    tier: (ctx) => Math.floor(ctx.attempts.filter((a) => a.isCorrect && a.skillId.startsWith("equation_")).length / 10) },
  { id: "average_hero_5", name: "平均数侦探", description: "平均数类题答对 5 道，每 5 次解锁一次。", icon: "🔍",
    tier: (ctx) => Math.floor(ctx.attempts.filter((a) => a.isCorrect && a.skillId.startsWith("average_")).length / 5) },
  { id: "triangle_hero_5", name: "三角形法官", description: "三角形类题答对 5 道，每 5 次解锁一次。", icon: "🔺",
    tier: (ctx) => Math.floor(ctx.attempts.filter((a) => a.isCorrect && a.skillId.startsWith("triangle_")).length / 5) },
  { id: "shop_master", name: "购物高手", description: "购物应用题连对 8 道。", icon: "🛍️",
    check: (ctx) => bestRunningCorrectStreak(ctx.attempts, (a) => a.skillId === "decimal_price_quantity") >= 8 },

  // —— 掌握度类 ——
  { id: "mastery_starter", name: "初识掌握", description: "任意 3 个 skill 掌握度达到 70。", icon: "🌱",
    check: (ctx) => ctx.mastery.filter((m) => m.score >= 70).length >= 3 },
  { id: "mastery_pro", name: "稳扎稳打", description: "任意 8 个 skill 掌握度达到 80。", icon: "🌿",
    check: (ctx) => ctx.mastery.filter((m) => m.score >= 80).length >= 8 },
  { id: "mastery_expert", name: "数学大师", description: "任意 5 个 skill 掌握度达到 90。", icon: "🌳",
    check: (ctx) => ctx.mastery.filter((m) => m.score >= 90).length >= 5 },
];

export interface AwardEntry {
  trophyId: string;
  /** 这次新发了几枚 */
  count: number;
  /**
   * 这次解锁后该 trophy 的累计总数。
   * - 单次型 (check)：固定 = 1
   * - 计数型 (tier)：等于 def.tier(ctx) 的最新值
   *
   * 用于 UI 判定是否到达"里程碑"（1/5/10/25/50/100）触发盲盒。
   */
  newTotalCount: number;
  /** 是不是 check 型（单次解锁）—— 这种总是触发盲盒 */
  isRare: boolean;
}

/** 里程碑数：到达这些 count 触发盲盒（首次解锁 = 1 也算里程碑） */
const MILESTONE_COUNTS = new Set([1, 5, 10, 25, 50, 100, 200, 500]);

/** 给定一次解锁后的累计 count，是不是里程碑 */
export function isMilestoneCount(newCount: number): boolean {
  return MILESTONE_COUNTS.has(newCount);
}

/**
 * 计算这一次结算应该新发的奖杯（按 trophyId 聚合）。
 * 单次型：当前未持有且条件成立 → +1
 * 计数型：tier(ctx) 大于已持有数 → 补发差额
 */
export function checkAndAwardTrophies(ctx: TrophyCheckContext): AwardEntry[] {
  const counts = new Map<string, number>();
  for (const t of ctx.trophies) counts.set(t.trophyId, (counts.get(t.trophyId) ?? 0) + 1);

  const out: AwardEntry[] = [];
  for (const def of TROPHIES) {
    const have = counts.get(def.id) ?? 0;
    if (def.tier) {
      try {
        const target = def.tier(ctx);
        const delta = target - have;
        if (delta > 0)
          out.push({
            trophyId: def.id,
            count: delta,
            newTotalCount: target,
            isRare: false,
          });
      } catch {
        // ignore
      }
    } else if (def.check) {
      if (have > 0) continue;
      try {
        if (def.check(ctx))
          out.push({
            trophyId: def.id,
            count: 1,
            newTotalCount: 1,
            isRare: true,
          });
      } catch {
        // ignore
      }
    }
  }
  return out;
}

export function trophyDef(id: string) {
  return TROPHIES.find((t) => t.id === id);
}
