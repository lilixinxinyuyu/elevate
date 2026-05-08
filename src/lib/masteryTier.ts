/**
 * 掌握等级（mastery tier）+ SM-2 间隔重现逻辑（v0.31.41）
 *
 * 比老 chinese/g4_cn.html / english/g4_english.html 系统好的地方：
 *
 * 1. 5-tier 分级（不是一锤子认定"已掌握"）：
 *    - 0 新     🌱  从没见过
 *    - 1 初识   📖  见过 1-2 次（同一会话内对的）
 *    - 2 在学   ✨  连对 ≥ 2 次跨会话稳定
 *    - 3 熟练   ⭐  连对 ≥ 3 + 跨天间隔通过
 *    - 4 掌握   🏆  连对 ≥ 4 + 跨周间隔通过
 *
 * 2. 间隔重现（SM-2 简化版）：
 *    - level 0/1: 同会话内再现（1 分钟后）
 *    - level 1→2: 1 天后
 *    - level 2→3: 3 天后
 *    - level 3→4: 7 天后
 *    - level 4 维持: 30 天后
 *    答对 → 间隔翻倍；答错 → 间隔重置 + 等级 -1
 *
 * 3. 答错强化：错完那个字进入 "强化队列" recentlyWrong，下 2 题内强出。
 *
 * 4. 每日目标：每日定 attemptTarget 字次（默认 20）。完成弹庆祝。
 *
 * 5. 连续打卡（streak）：连续做满每日目标的天数。
 *
 * 数据 schema (CharStat / WordStat 都用这个)：
 *   right / wrong            历史累计（不变）
 *   consecutiveRight         当前连对（错答归零）
 *   level: 0..4              当前等级
 *   lastSeenAt               上次答题 ms epoch
 *   nextDueAt                下次到期 ms（0 = 从没见过 / 立即到期）
 */

export interface MasteryStat {
  right: number;
  wrong: number;
  consecutiveRight: number;
  level: 0 | 1 | 2 | 3 | 4;
  lastSeenAt: number;
  nextDueAt: number;
}

export type Level = 0 | 1 | 2 | 3 | 4;

export const LEVEL_LABELS: Record<Level, string> = {
  0: "新",
  1: "初识",
  2: "在学",
  3: "熟练",
  4: "掌握",
};

export const LEVEL_EMOJIS: Record<Level, string> = {
  0: "🌱",
  1: "📖",
  2: "✨",
  3: "⭐",
  4: "🏆",
};

export const LEVEL_COLORS: Record<Level, string> = {
  0: "slate",
  1: "cyan",
  2: "amber",
  3: "emerald",
  4: "violet",
};

/** 升级到下一 tier 所需"当前连对" */
const LEVEL_UP_THRESHOLD: Record<Level, number> = {
  0: 1,
  1: 2,
  2: 3,
  3: 4,
  4: 99,
};

/** 升到 level X 后下次到期间隔（ms） */
const LEVEL_INTERVAL_MS: Record<Level, number> = {
  0: 60_000, // 1 min — same-session re-encounter
  1: 60 * 60 * 1000, // 1 hour
  2: 24 * 60 * 60 * 1000, // 1 day
  3: 3 * 24 * 60 * 60 * 1000, // 3 days
  4: 14 * 24 * 60 * 60 * 1000, // 14 days
};

/** 答错后立刻"强化"间隔（ms）—— 让错字快速回炉 */
const REINFORCE_INTERVAL_MS = 30_000; // 30 秒

/** 升级判定：当前 stat + 是否答对 → 新 stat（不变更 right/wrong/lastSeenAt，由调用方写） */
export function transitionStat(
  cur: MasteryStat,
  isCorrect: boolean,
  now: number = Date.now(),
): MasteryStat {
  if (isCorrect) {
    const newConsec = cur.consecutiveRight + 1;
    let newLevel: Level = cur.level;
    if (newConsec >= LEVEL_UP_THRESHOLD[cur.level] && cur.level < 4) {
      newLevel = (cur.level + 1) as Level;
    }
    return {
      right: cur.right + 1,
      wrong: cur.wrong,
      consecutiveRight: newConsec,
      level: newLevel,
      lastSeenAt: now,
      nextDueAt: now + LEVEL_INTERVAL_MS[newLevel],
    };
  }
  // 答错：等级 -1，强化重现
  const downLevel = (Math.max(0, cur.level - 1) as Level);
  return {
    right: cur.right,
    wrong: cur.wrong + 1,
    consecutiveRight: 0,
    level: downLevel,
    lastSeenAt: now,
    nextDueAt: now + REINFORCE_INTERVAL_MS,
  };
}

/** 全新初始化 stat（从未见过） */
export function freshStat(): MasteryStat {
  return {
    right: 0,
    wrong: 0,
    consecutiveRight: 0,
    level: 0,
    lastSeenAt: 0,
    nextDueAt: 0, // 0 = 从没见过 → fresh 池
  };
}

/**
 * 老历史数据迁移：right/wrong → 估算 level/nextDueAt。
 *
 * 思路：
 *   wrong > right (最近挣扎) → 强制 level 0，立即到期
 *   right >= 5 && wrong === 0 → level 4（在主体掌握过）
 *   right >= 3 && wrong === 0 → level 3
 *   right === 2 && wrong === 0 → level 2
 *   right === 1 && wrong === 0 → level 1
 *   right > 0 && wrong > 0 (有错有对) → level 1 + 1 天后到期
 *   全 0 → level 0 fresh
 */
export function migrateLegacyStat(
  right: number,
  wrong: number,
  now: number = Date.now(),
): MasteryStat {
  if (right === 0 && wrong === 0) {
    return { ...freshStat() };
  }
  if (wrong > right) {
    // 挣扎中：等级回 0，立即出现
    return {
      right,
      wrong,
      consecutiveRight: 0,
      level: 0,
      lastSeenAt: now,
      nextDueAt: now, // 立即到期
    };
  }
  let level: Level;
  if (wrong === 0) {
    if (right >= 5) level = 4;
    else if (right >= 3) level = 3;
    else if (right === 2) level = 2;
    else level = 1; // right === 1
  } else {
    // right > 0 && wrong > 0 但 right >= wrong: 有错过但可能现在好了
    level = right >= 3 ? 2 : 1;
  }
  return {
    right,
    wrong,
    consecutiveRight: right, // 估计的连对（保守视为全连对）
    level,
    lastSeenAt: now - LEVEL_INTERVAL_MS[level], // 假装"刚刚到期"，下面 nextDueAt 立刻可练
    nextDueAt: now, // 立即可练（让用户尽快接触老数据）
  };
}

/**
 * 5 tier 分布（用 5 色进度条 + 数字展示）
 */
export interface TierDistribution {
  total: number;
  byLevel: Record<Level, number>;
  newCount: number; // 等价于 byLevel[0] 但更易读
  pct: Record<Level, number>; // 0-100
}

export function distribution<T>(
  pool: T[],
  getStat: (item: T) => MasteryStat | undefined,
): TierDistribution {
  const byLevel: Record<Level, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const item of pool) {
    const s = getStat(item);
    if (!s || (s.right === 0 && s.wrong === 0)) {
      byLevel[0] += 1;
    } else {
      byLevel[s.level as Level] += 1;
    }
  }
  const total = pool.length;
  const pct: Record<Level, number> = {
    0: total === 0 ? 0 : (byLevel[0] / total) * 100,
    1: total === 0 ? 0 : (byLevel[1] / total) * 100,
    2: total === 0 ? 0 : (byLevel[2] / total) * 100,
    3: total === 0 ? 0 : (byLevel[3] / total) * 100,
    4: total === 0 ? 0 : (byLevel[4] / total) * 100,
  };
  return { total, byLevel, newCount: byLevel[0], pct };
}

/**
 * 选下一个待练对象。
 *
 * 优先级（v0.31.41 智能调度）：
 *   1. 强化队列（recentlyWrong）：最近答错的字，前 2 题内必出
 *   2. 过期未练（nextDueAt > 0 && < now）：按"逾期程度"加权，逾期越久权重越高
 *   3. 新字（nextDueAt === 0）：随机
 *   4. 未到期但已学（nextDueAt > now）：填补空间，按权重选最快到期的
 *
 * 60% 过期 + 30% 新 + 10% 提前练（如果都不空），用 rng 决定走哪个分支。
 */
export function pickByMastery<T extends { word?: string; w?: string }>(
  pool: T[],
  getStat: (item: T) => MasteryStat | undefined,
  getKey: (item: T) => string,
  recentlyShown: string[],
  reinforceQueue: string[], // 答错的强化队列
  rng: () => number = Math.random,
  now: number = Date.now(),
): T | null {
  const recentSet = new Set(recentlyShown);
  const reinforceSet = new Set(reinforceQueue);
  const reinforceItems: T[] = [];
  const overdueItems: { item: T; overdueMs: number }[] = [];
  const freshItems: T[] = [];
  const futureItems: { item: T; toGoMs: number }[] = [];

  for (const it of pool) {
    if (recentSet.has(getKey(it))) continue;
    const s = getStat(it);
    if (!s || (s.right === 0 && s.wrong === 0 && s.nextDueAt === 0)) {
      freshItems.push(it);
      continue;
    }
    if (reinforceSet.has(getKey(it))) {
      reinforceItems.push(it);
      continue;
    }
    if (s.nextDueAt > 0 && s.nextDueAt <= now) {
      overdueItems.push({ item: it, overdueMs: now - s.nextDueAt });
      continue;
    }
    if (s.nextDueAt > now) {
      futureItems.push({ item: it, toGoMs: s.nextDueAt - now });
    }
  }

  // 1. 强化队列优先（答错后立刻回炉）
  if (reinforceItems.length > 0 && rng() < 0.7) {
    return reinforceItems[Math.floor(rng() * reinforceItems.length)] ?? null;
  }

  // 2. 选分支
  const r = rng();
  if (overdueItems.length > 0 && r < 0.6) {
    // 加权随机：逾期越久 weight 越高
    const totalW = overdueItems.reduce((s, x) => s + Math.max(1, x.overdueMs / 60_000), 0);
    let roll = rng() * totalW;
    for (const x of overdueItems) {
      roll -= Math.max(1, x.overdueMs / 60_000);
      if (roll <= 0) return x.item;
    }
    return overdueItems[0]?.item ?? null;
  }

  if (freshItems.length > 0 && r < 0.9) {
    return freshItems[Math.floor(rng() * freshItems.length)] ?? null;
  }

  if (futureItems.length > 0) {
    // 优先快到期的
    futureItems.sort((a, b) => a.toGoMs - b.toGoMs);
    return futureItems[0]?.item ?? null;
  }

  // 兜底
  if (overdueItems.length > 0) return overdueItems[0]?.item ?? null;
  if (freshItems.length > 0) return freshItems[0] ?? null;
  if (reinforceItems.length > 0) return reinforceItems[0] ?? null;
  return null;
}
