/**
 * Selena 勋章系统 v0.29 — Apple Fitness 风格
 *
 * 五大分类（见 types.ts TrophyCategory）：
 *   - daily: 重复型（今日完成 / 五连击 / 疾风手）— 多次获得，显示 ×N，不打等级
 *   - milestone: 单槽 4 等级进阶（答题大师 / 连击王 / 坚持之王 / 技能精通）
 *   - ability: 8 维能力（计算 / 概念 / 推理 / 建模 / 空间 / 数据 / 策略 / 习惯）单槽 4 等级
 *   - skill: 单元领域（小数 / 方程 / 平均数 / 三角形 / 购物）单槽 4 等级
 *   - commemorative: 纪念（第一步 / 期中考完结 / 新学年）— 永久独一无二
 *
 * 4 等级阈值（铜银金钻）配合 4 个月一学期重置的 mastery 体系：
 *   - 铜：1-3 周可达，给即时鼓励
 *   - 银：1-2 个月，巩固期
 *   - 金：学期末努力学生能拿到
 *   - 钻：学期末顶尖 ~10% 能拿，本学期最高荣誉
 *
 * 旧版 (v0.28) 用 total_50 / total_200 / combo_5 / mastery_starter 等独立 trophy。
 * 新版自然迁移：v0.29 启动后 checkAndAwardTrophies 会按 Selena 的当前进度补发
 * 所有应得的 tier。旧 UserTrophy 行留在 db 但 UI 不再渲染（new TROPHIES.id 不重叠）。
 */

import { SKILLS } from "../content/skills";
import { MIDTERM_DATE, FINAL_DATE } from "./examDates";
import { termOfSkill } from "./rating";
import { tierFromScore, tierIndex, subRank } from "./tiers";
import type {
  AbilityId,
  Attempt,
  TrophyCheckContext,
  TrophyDef,
  TrophyTier,
  TrophyTierThreshold,
} from "./types";

// ============================================================
//  辅助函数
// ============================================================

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

/** 历史最高连击数（跨所有 session） */
function bestCombo(attempts: Attempt[]): number {
  const best = bestComboBySession(attempts);
  let max = 0;
  best.forEach((v) => {
    if (v > max) max = v;
  });
  return max;
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

/**
 * v0.30.11: 累计已达成的"小段位级别"数（subrank stages above start）。
 *
 * 段位 5 档 × 每档 4 小段 = 20 stages。从 school★I 起步算 0；school★II=1，
 * school★III=2，... district★I=4，... country★IV=19。
 *
 * 每升一小段（包括跨大段，比如 school★IV → district★I）算 +1。
 * 跨大段的 tier badge 单独走另一条庆祝路径，subrank_up 计数是"星升次数"汇总。
 *
 * 用 attempts 总 XP 反推（跟 service.computeRating 用同样的 tierFromScore +
 * subRank 函数，保证一致）。注：这里是 all-time XP，但实际 mastery system 按学期
 * 独立赛季——选择 all-time 是因为 ctx 不带 term；轻微误差但不影响"星升计数"语义。
 */
function totalSubrankStagesAchieved(attempts: Attempt[]): number {
  const totalXp = attempts.reduce(
    (s, a) => s + (a.scoreDelta?.total ?? 0),
    0,
  );
  const tier = tierFromScore(totalXp);
  const tierIdx = tierIndex(tier.id); // 0-4
  const sub = subRank(totalXp, tier); // 1-4
  return tierIdx * 4 + (sub - 1);
}

/** 一气连续 N 题用时 ≤ 8 秒且全对 — 每达成一次 +1 */
function speedBurstCount(attempts: Attempt[], n = 5, maxSec = 8): number {
  const sorted = attempts.slice().sort((a, b) => a.createdAt - b.createdAt);
  let count = 0,
    run = 0;
  for (const a of sorted) {
    if (a.isCorrect && a.elapsedSeconds <= maxSec) {
      run += 1;
      if (run === n) {
        count += 1;
        run = 0;
      }
    } else run = 0;
  }
  return count;
}

/** 连续 N 题不用提示且全对 — 每达成一次 +1 */
function noHintRunCount(attempts: Attempt[], n = 10): number {
  const sorted = attempts.slice().sort((a, b) => a.createdAt - b.createdAt);
  let count = 0,
    run = 0;
  for (const a of sorted) {
    if (a.isCorrect && a.hintsOpened === 0) {
      run += 1;
      if (run === n) {
        count += 1;
        run = 0;
      }
    } else run = 0;
  }
  return count;
}

// SKILL → ability 维度的 lookup map（cold-init 一次）
const SKILL_TO_ABILITIES = new Map<string, readonly AbilityId[]>();
for (const s of SKILLS) {
  SKILL_TO_ABILITIES.set(s.id, s.ability);
}

/** 答对的题数（attempts 里 isCorrect && skill.ability 含 targetAbility） */
function correctCountByAbility(attempts: Attempt[], target: AbilityId): number {
  let n = 0;
  for (const a of attempts) {
    if (!a.isCorrect) continue;
    const abilities = SKILL_TO_ABILITIES.get(a.skillId);
    if (abilities && abilities.includes(target)) n += 1;
  }
  return n;
}

/** 该 skill_id 前缀范围内答对的题数（小数 / 方程 / 三角形 等） */
function correctCountByPrefix(attempts: Attempt[], prefix: string): number {
  return attempts.filter((a) => a.isCorrect && a.skillId.startsWith(prefix)).length;
}

/** 累计练习的不重复天数（用于"坚持之心"勋章 — 习惯靠天数衡量，不靠题数） */
function cumulativePracticeDays(attempts: Attempt[]): number {
  const days = new Set<string>();
  for (const a of attempts) {
    days.add(new Date(a.createdAt).toISOString().slice(0, 10));
  }
  return days.size;
}

/**
 * v0.31.8 "小进知音"勋章核心算法：
 * 数 Selena 在多少个 skill 上 "问小进 + 之后真的进步了" 形成完整闭环。
 *
 * 一个 skill 算"进步"需要：
 *   1. 至少有 1 次 tutor session（问过小进）
 *   2. 第一次 tutor session 之后做的该 skill 题 ≥ 5 道（要有信号）
 *   3. 之后准确率 - 之前准确率 ≥ 10 个百分点
 *
 * 没问过 / 问后题量太少 / 没真进步 → 不计。
 *
 * 用 ctx.tutorSessions（如果没传则该 skill 视为 0）。
 */
function countSkillsImprovedAfterTutor(ctx: TrophyCheckContext): number {
  const tutorSessions = ctx.tutorSessions ?? [];
  if (tutorSessions.length === 0) return 0;

  // skill -> 最早 tutor session timestamp
  const firstTutorAt = new Map<string, number>();
  for (const ts of tutorSessions) {
    if (!ts.skillId) continue;
    const cur = firstTutorAt.get(ts.skillId);
    if (cur == null || ts.startedAt < cur) {
      firstTutorAt.set(ts.skillId, ts.startedAt);
    }
  }

  let improved = 0;
  for (const [skillId, tutorTs] of firstTutorAt) {
    const skillAttempts = ctx.attempts.filter((a) => a.skillId === skillId);
    const before = skillAttempts.filter((a) => a.createdAt < tutorTs);
    const after = skillAttempts.filter((a) => a.createdAt >= tutorTs);
    if (after.length < 5) continue; // 信号不足

    const beforeAcc =
      before.length > 0
        ? before.filter((a) => a.isCorrect).length / before.length
        : 0;
    const afterAcc = after.filter((a) => a.isCorrect).length / after.length;

    if (afterAcc - beforeAcc >= 0.10) improved++;
  }
  return improved;
}

/**
 * 历史最高段位（按学期分桶后取最大）。
 * - 段位是"每学期一局，纯 XP 累计"，所以同一学期内的 XP 决定该学期峰值段位
 * - 取所有学期的峰值段位最大值 → 一旦达到就算"曾抵达"
 * - commemorative 勋章发一次就 done，不会因为下学期重置 XP 又重发
 */
function peakTierIndexEverReached(ctx: TrophyCheckContext): number {
  const totalsByTerm = new Map<string, number>();
  for (const a of ctx.attempts) {
    const term = termOfSkill(a.skillId) ?? "_unknown";
    totalsByTerm.set(term, (totalsByTerm.get(term) ?? 0) + (a.scoreDelta?.total ?? 0));
  }
  let peak = -1;
  for (const score of totalsByTerm.values()) {
    const idx = tierIndex(tierFromScore(score).id);
    if (idx > peak) peak = idx;
  }
  return peak;
}

function reachedTier(ctx: TrophyCheckContext, targetTierId: string): boolean {
  const target = tierIndex(targetTierId);
  if (target < 0) return false;
  return peakTierIndexEverReached(ctx) >= target;
}

// ============================================================
//  Tier 阈值常量
// ============================================================

/** 通用：4 等级阈值生成器 */
function tiers(
  bronze: number,
  silver: number,
  gold: number,
  platinum: number,
  unit = "",
): TrophyTierThreshold[] {
  return [
    { tier: "bronze", threshold: bronze, tierLabel: `${bronze}${unit}` },
    { tier: "silver", threshold: silver, tierLabel: `${silver}${unit}` },
    { tier: "gold", threshold: gold, tierLabel: `${gold}${unit}` },
    { tier: "platinum", threshold: platinum, tierLabel: `${platinum}${unit}` },
  ];
}

// ============================================================
//  TROPHIES 定义
// ============================================================

export const TROPHIES: TrophyDef[] = [
  // ============================================
  //  🏵️ commemorative — 纪念勋章（独一无二）
  // ============================================
  {
    id: "first_step",
    name: "第一步",
    description: "完成第一次挑战。每个学习者的起点。",
    icon: "🌟",
    category: "commemorative",
    check: (ctx) => ctx.attempts.length >= 1,
  },
  // === Phase 2 占位：触发条件待实施（见 docs/phase2-special-trophies.md）===
  // 这些 def 现在永远 check=false → 在勋章柜里显示为灰色未解锁，
  // 让纪念区不那么孤单 + 提示 Selena 还有更多专属勋章在等她。
  // Phase 2 实施时只改 check 函数即可，trophy id 不变。
  {
    id: "midterm_done",
    name: "期中加冕",
    description: "期中考试结束后第一次进 app 解锁。专属盲盒勋章。",
    icon: "📜",
    category: "commemorative",
    // v0.30.10: 期中考试当天或之后第一次进 app 即解锁。
    // todayDateKey 是字符串 "YYYY-MM-DD"，跟 MIDTERM_DATE 比较 lexicographically。
    check: (ctx) => ctx.todayDateKey >= MIDTERM_DATE,
  },
  {
    id: "final_done",
    name: "期末凯旋",
    description: "期末考试结束后第一次进 app 解锁。专属盲盒勋章。",
    icon: "👑",
    category: "commemorative",
    // v0.30.10: 期末考试当天或之后第一次进 app 即解锁
    check: (ctx) => ctx.todayDateKey >= FINAL_DATE,
  },
  {
    id: "new_semester",
    name: "新学期起航",
    description: "进入下册新学期、第一次答题就解锁。",
    icon: "⛵",
    category: "commemorative",
    // v0.31.12: 任意一道下册（G4B）skill 的 attempt 即触发。Selena 期中前后必然有。
    check: (ctx) => ctx.attempts.some((a) => termOfSkill(a.skillId) === "下册"),
  },
  // === 段位跨段纪念勋章（v0.31.11）===
  // 跨段进阶时颁发：和段位徽章是两枚不同的勋章。
  // 段位徽章 (tier_district 等) = 圆形地标 emblem，永久属于这个段位的"身份"
  // 跨段纪念 (enter_district 等) = 六角星 commemorative，永远纪念你"第一次抵达"
  // 检查走 peakTierIndexEverReached → 一旦曾抵达，永久不丢
  {
    id: "enter_district",
    name: "破晓登阶 · 锦江",
    description: "第一次跨入锦江区段位。属于这次努力的专属纪念勋章。",
    icon: "🏞️",
    category: "commemorative",
    check: (ctx) => reachedTier(ctx, "district"),
  },
  {
    id: "enter_city",
    name: "蓉城启航 · 成都",
    description: "第一次跨入成都市段位。属于这次努力的专属纪念勋章。",
    icon: "🌆",
    category: "commemorative",
    check: (ctx) => reachedTier(ctx, "city"),
    hiddenUntilUnlocked: true,
  },
  {
    id: "enter_province",
    name: "天府跃升 · 四川",
    description: "第一次跨入四川省段位。属于这次努力的专属纪念勋章。",
    icon: "⛰️",
    category: "commemorative",
    check: (ctx) => reachedTier(ctx, "province"),
    hiddenUntilUnlocked: true,
  },
  {
    id: "enter_country",
    name: "凤翔九天 · 全国",
    description: "第一次跨入全国段位。传说级专属纪念勋章。",
    icon: "🦅",
    category: "commemorative",
    check: (ctx) => reachedTier(ctx, "country"),
    hiddenUntilUnlocked: true,
  },

  // ============================================
  //  🌱 daily — 重复型（多次获得，UI 显示 ×N）
  // ============================================
  {
    id: "daily_complete",
    name: "今日完成",
    description: "完成一次今日挑战。",
    icon: "🗓️",
    category: "daily",
    tier: (ctx) => uniqueSessionFinishCount(ctx.attempts),
  },
  {
    id: "speed_demon",
    name: "疾风手",
    description: "一气连续 5 题用时都 ≤ 8 秒，每达成一次解锁。",
    icon: "💨",
    category: "daily",
    tier: (ctx) => speedBurstCount(ctx.attempts, 5, 8),
  },
  {
    id: "no_hint_run",
    name: "独立思考 10 连",
    description: "连续 10 题不用提示且全对，每达成一次解锁。",
    icon: "🧠",
    category: "daily",
    tier: (ctx) => noHintRunCount(ctx.attempts, 10),
  },
  {
    id: "mistake_reborn",
    name: "错题复活",
    description: "成功复活错题，每 5 次解锁一次。",
    icon: "🪄",
    category: "daily",
    tier: (ctx) => Math.floor(ctx.attempts.filter((a) => a.isReview && a.isCorrect).length / 5),
  },
  // v0.30.11: subrank_up — 段位升小段勋章（每升一小段 +1 解锁，跨大段也算）
  {
    id: "subrank_up",
    name: "星升时刻",
    description: "段位升小段（★I→II→III→IV / 跨大段）就来一枚。每次升星都珍贵。",
    icon: "✨",
    category: "daily",
    tier: (ctx) => totalSubrankStagesAchieved(ctx.attempts),
  },
  // v0.31.53: 难题猎人 — 每周一自动结算上周 D4 题数 ≥ 阈值就颁发。
  // 跟标准 tier() 流程不同 — 颁发逻辑走 service.ts::awardWeeklyD4HunterIfDue
  // （需要 join db.questions 拿 difficulty，不在 TrophyCheckContext 里），
  // 所以 check 返回 false 让标准流程跳过，由 passiveTrophyCheck 单独触发。
  {
    id: "weekly_d4_hunter",
    name: "难题猎人",
    description: "一周内挑战 ≥ 8 道难题（D4），战士本色。每周一自动结算上周成绩。",
    icon: "🏹",
    category: "daily",
    check: () => false,
  },

  // ============================================
  //  ⛰️ milestone — 单槽 4 等级进阶
  // ============================================
  {
    id: "answer_master",
    name: "答题大师",
    description: "累计答题数。铜 50 / 银 200 / 金 500 / 钻 1500。",
    icon: "🎯",
    category: "milestone",
    tier: (ctx) => ctx.attempts.length,
    tieredThresholds: tiers(50, 200, 500, 1500, " 题"),
  },
  {
    id: "combo_king",
    name: "连击王",
    description: "单次最高连击。铜 5 / 银 10 / 金 15 / 钻 20 连。",
    icon: "⚡",
    category: "milestone",
    tier: (ctx) => bestCombo(ctx.attempts),
    tieredThresholds: tiers(5, 10, 15, 20, " 连"),
  },
  {
    id: "streak_keeper",
    name: "坚持之王",
    description: "连续打卡天数。铜 3 / 银 7 / 金 30 / 钻 100 天。",
    icon: "🔥",
    category: "milestone",
    tier: (ctx) =>
      streakDays(ctx.attempts.map((a) => new Date(a.createdAt).toISOString().slice(0, 10))),
    tieredThresholds: tiers(3, 7, 30, 100, " 天"),
  },
  {
    id: "mastery_climber",
    name: "技能精通",
    description: "掌握度 ≥ 80 的 skill 数。铜 3 / 银 8 / 金 15 / 钻 25。",
    icon: "🌳",
    category: "milestone",
    tier: (ctx) => ctx.mastery.filter((m) => m.score >= 80).length,
    tieredThresholds: tiers(3, 8, 15, 25, " 个 skill"),
  },

  // ============================================
  //  🧠 ability — 8 维能力勋章（4 等级）
  //  阈值：每能力下答对的题数。一学期 ~600 题分散到多能力 ≈ 75/能力。
  //  铜 30 / 银 100 / 金 300 / 钻 800（钻几乎是"全学期专攻一个能力"才能拿到）
  // ============================================
  {
    id: "ability_calculation",
    name: "计算之星",
    description: "在「计算力」上答对的题数。铜 30 / 银 100 / 金 300 / 钻 800。",
    icon: "🧮",
    category: "ability",
    tier: (ctx) => correctCountByAbility(ctx.attempts, "calculation"),
    tieredThresholds: tiers(30, 100, 300, 800, " 题"),
  },
  {
    id: "ability_concept",
    name: "概念学者",
    description: "在「概念力」上答对的题数。铜 30 / 银 100 / 金 300 / 钻 800。",
    icon: "💡",
    category: "ability",
    tier: (ctx) => correctCountByAbility(ctx.attempts, "concept"),
    tieredThresholds: tiers(30, 100, 300, 800, " 题"),
  },
  {
    id: "ability_reasoning",
    name: "推理大师",
    description: "在「推理力」上答对的题数。铜 30 / 银 100 / 金 300 / 钻 800。",
    icon: "🧩",
    category: "ability",
    tier: (ctx) => correctCountByAbility(ctx.attempts, "reasoning"),
    tieredThresholds: tiers(30, 100, 300, 800, " 题"),
  },
  {
    id: "ability_modeling",
    name: "建模高手",
    description: "在「建模力」上答对的题数。铜 30 / 银 100 / 金 300 / 钻 800。",
    icon: "📐",
    category: "ability",
    tier: (ctx) => correctCountByAbility(ctx.attempts, "modeling"),
    tieredThresholds: tiers(30, 100, 300, 800, " 题"),
  },
  {
    id: "ability_spatial",
    name: "空间想象家",
    description: "在「空间力」上答对的题数。铜 30 / 银 100 / 金 300 / 钻 800。",
    icon: "🎲",
    category: "ability",
    tier: (ctx) => correctCountByAbility(ctx.attempts, "spatial"),
    tieredThresholds: tiers(30, 100, 300, 800, " 题"),
  },
  {
    id: "ability_data",
    name: "数据分析师",
    description: "在「数据力」上答对的题数。铜 30 / 银 100 / 金 300 / 钻 800。",
    icon: "📊",
    category: "ability",
    tier: (ctx) => correctCountByAbility(ctx.attempts, "data"),
    tieredThresholds: tiers(30, 100, 300, 800, " 题"),
  },
  {
    id: "ability_strategy",
    name: "策略大师",
    description: "在「策略力」上答对的题数。铜 30 / 银 100 / 金 300 / 钻 800。",
    icon: "♟️",
    category: "ability",
    tier: (ctx) => correctCountByAbility(ctx.attempts, "strategy"),
    tieredThresholds: tiers(30, 100, 300, 800, " 题"),
  },
  {
    // ⚠️ "坚持力"语义上是"持续练习的习惯"，不是"做对了多少题"。所以这枚勋章
    // 的判定改用累计练习天数（unique day count），而不是 correctCountByAbility。
    // 否则它依赖 SKILLS 里有 ability=["habit"] 的 skill — 实际上几乎没有 → 死勋章。
    id: "ability_habit",
    name: "坚持之心",
    description: "学习的坚持，体现在累计练习的天数。铜 7 / 银 30 / 金 90 / 钻 180 天。",
    icon: "💪",
    category: "ability",
    tier: (ctx) => cumulativePracticeDays(ctx.attempts),
    tieredThresholds: tiers(7, 30, 90, 180, " 天"),
  },

  // ============================================
  //  🗺️ skill — 学科领域勋章（4 等级）
  // ============================================
  {
    id: "decimal_hero",
    name: "小数小英雄",
    description: "答对小数题数。铜 10 / 银 30 / 金 80 / 钻 200。",
    icon: "💎",
    category: "skill",
    tier: (ctx) => correctCountByPrefix(ctx.attempts, "decimal_"),
    tieredThresholds: tiers(10, 30, 80, 200, " 道"),
  },
  {
    id: "equation_hero",
    name: "方程小专家",
    description: "答对方程题数。铜 10 / 银 30 / 金 80 / 钻 200。",
    icon: "⚖️",
    category: "skill",
    tier: (ctx) => correctCountByPrefix(ctx.attempts, "equation_"),
    tieredThresholds: tiers(10, 30, 80, 200, " 道"),
  },
  {
    id: "average_hero",
    name: "平均数侦探",
    description: "答对平均数题数。铜 5 / 银 15 / 金 50 / 钻 150。",
    icon: "🔍",
    category: "skill",
    tier: (ctx) => correctCountByPrefix(ctx.attempts, "average_"),
    tieredThresholds: tiers(5, 15, 50, 150, " 道"),
  },
  {
    id: "triangle_hero",
    name: "三角形法官",
    description: "答对三角形题数。铜 5 / 银 15 / 金 50 / 钻 150。",
    icon: "🔺",
    category: "skill",
    tier: (ctx) => correctCountByPrefix(ctx.attempts, "triangle_"),
    tieredThresholds: tiers(5, 15, 50, 150, " 道"),
  },
  {
    id: "shop_hero",
    name: "购物高手",
    description: "答对购物应用题数。铜 5 / 银 15 / 金 50 / 钻 150。",
    icon: "🛍️",
    category: "skill",
    tier: (ctx) => ctx.attempts.filter((a) => a.isCorrect && a.skillId === "decimal_price_quantity").length,
    tieredThresholds: tiers(5, 15, 50, 150, " 道"),
  },

  // ============================================
  //  ⚔️ boss — 闯关勋章（Phase 2 Axis 1）
  //  这些勋章不在 checkAndAwardTrophies 主循环里发——发放逻辑在 service.ts
  //  finalizeSession 里专门处理 big_problems mode。这里只是注册 def 供 UI 渲染。
  //  check 全 false（永远不在主 awarder 里返 true，避免重复发）。
  // ============================================
  {
    id: "boss_first_pass",
    name: "首次闯关",
    description: "第一次通过任意单元闯关。",
    icon: "🎖️",
    category: "boss",
    check: () => false,
  },
  {
    id: "boss_no_hint",
    name: "零提示通关",
    description: "整场闯关不开任何 hint 通过。",
    icon: "🧠",
    category: "boss",
    check: () => false,
  },
  {
    id: "boss_win_streak_5",
    name: "闯关连胜 5",
    description: "连续 5 次通过闯关不失败。",
    icon: "🔥",
    category: "boss",
    check: () => false,
  },
  {
    id: "boss_win_streak_10",
    name: "闯关连胜 10",
    description: "连续 10 次通过闯关不失败。",
    icon: "💥",
    category: "boss",
    check: () => false,
  },
  {
    id: "boss_G4B_U1_DECIMAL_ADD_SUB_master",
    name: "U1 印章 · 小数加减",
    description: "通过 G4B U1 单元闯关获得。",
    icon: "🥇",
    category: "boss",
    check: () => false,
  },
  {
    id: "boss_G4B_U2_TRI_QUAD_master",
    name: "U2 印章 · 三角形",
    description: "通过 G4B U2 单元闯关获得。",
    icon: "🥇",
    category: "boss",
    check: () => false,
  },
  {
    id: "boss_G4B_U3_DECIMAL_MULTIPLY_master",
    name: "U3 印章 · 小数乘法",
    description: "通过 G4B U3 单元闯关获得。",
    icon: "🥇",
    category: "boss",
    check: () => false,
  },
  {
    id: "boss_G4B_U4_OBSERVE_OBJECTS_master",
    name: "U4 印章 · 观察物体",
    description: "通过 G4B U4 单元闯关获得。",
    icon: "🥇",
    category: "boss",
    check: () => false,
  },
  {
    id: "boss_G4B_U5_EQUATIONS_master",
    name: "U5 印章 · 方程",
    description: "通过 G4B U5 单元闯关获得。",
    icon: "🥇",
    category: "boss",
    check: () => false,
  },
  {
    id: "boss_G4B_U6_DATA_master",
    name: "U6 印章 · 平均数",
    description: "通过 G4B U6 单元闯关获得。",
    icon: "🥇",
    category: "boss",
    check: () => false,
  },
  {
    id: "boss_final_master",
    name: "期末大闯关",
    description: "通过 G4B 期末大闯关 — 6 印章齐 + 全 skill 平均 ≥ 70。",
    icon: "👑",
    category: "boss",
    check: () => false,
  },

  // ============================================
  //  🌟 streak — 跨 ring 打卡（完美一日 / 完美一周）
  //  用 daily 类别，让它在"日常成就"区出现。
  //  发放逻辑：每天结算时 / 每周日结算时（service.ts 里检查），不走 awarder 主循环。
  // ============================================
  {
    id: "perfect_day",
    name: "完美一日",
    description: "单日 3 环全闭：完成闪电口算 + 今日挑战 + 今日重点。",
    icon: "🌟",
    category: "milestone",
    tier: (ctx) => Math.max(0, (ctx as { perfectDays?: number }).perfectDays ?? 0),
    tieredThresholds: tiers(1, 7, 30, 100, " 日"),
  },
  {
    id: "perfect_week",
    name: "完美一周",
    description: "连续 7 天 3 环全闭。",
    icon: "🔥",
    category: "milestone",
    tier: (ctx) => Math.max(0, (ctx as { perfectWeeks?: number }).perfectWeeks ?? 0),
    tieredThresholds: tiers(1, 4, 12, 52, " 周"),
  },

  // ============================================
  //  🎂 special — 节日 / 生日勋章
  // ============================================
  {
    id: "birthday_2026",
    name: "生日快乐 2026",
    description: "Selena 生日当天解锁。",
    icon: "🎂",
    category: "commemorative",
    // Selena 生日 2016-03-13 → 2026 年生日 = 2026-03-13。当天或之后第一次进 app 解锁。
    check: (ctx) => ctx.todayDateKey >= "2026-03-13",
  },

  // ============================================
  //  🎨 canvas — 画图大师（Phase 2 Axis 2）
  // ============================================
  {
    id: "canvas_master",
    name: "画图大师",
    description: "答对点子图画图题数。铜 3 / 银 10 / 金 30 / 钻 100。",
    icon: "🎨",
    category: "skill",
    tier: (ctx) =>
      ctx.attempts.filter((a) => a.isCorrect && a.questionId.startsWith("DOT_")).length,
    tieredThresholds: tiers(3, 10, 30, 100, " 道"),
  },

  // ============================================
  //  🎓 tutor — "学习深度" 勋章 (Phase 2 v0.31.8)
  //
  //  设计：奖励"问小进 + 真的学会了"，不是"问得多"。
  //  指标 = 问过小进的 skill 中，问后准确率比问前提升 ≥ 10pp 的 skill 数。
  //  跟反刷分理念一致（既不奖励"避问"也不奖励"瞎问"，奖励"问完真懂"）。
  // ============================================
  {
    id: "tutor_companion",
    name: "小进知音",
    description:
      "跟小进求助过、之后真的进步的 skill 数（准确率 +10pp 以上）。铜 1 / 银 5 / 金 15 / 钻 30。",
    icon: "🎓",
    category: "milestone",
    tier: (ctx) => countSkillsImprovedAfterTutor(ctx),
    tieredThresholds: tiers(1, 5, 15, 30, " 个 skill"),
  },
];

// ============================================================
//  AwardEntry + 颁奖逻辑
// ============================================================

export interface AwardEntry {
  trophyId: string;
  /** 这次新发了几枚 */
  count: number;
  /**
   * 这次解锁后该 trophy 的累计总数。
   * - daily / commemorative：count
   * - tiered (milestone/ability/skill)：固定 1（一个 tier 只发一次）
   */
  newTotalCount: number;
  /** 是不是 rare 解锁（commemorative + gold/platinum tier 都算 rare，触发盲盒） */
  isRare: boolean;
  /** v0.29: tiered 勋章在哪个 tier 解锁。daily/commemorative 留空。 */
  tier?: TrophyTier;
}

/** 里程碑数：到达这些 count 触发盲盒（首次解锁 = 1 也算里程碑） */
const MILESTONE_COUNTS = new Set([1, 5, 10, 25, 50, 100, 200, 500]);

export function isMilestoneCount(newCount: number): boolean {
  return MILESTONE_COUNTS.has(newCount);
}

/**
 * 计算这一次结算应该新发的奖杯。
 *
 * 三种处理路径：
 *   1. commemorative（check）：未持有且条件成立 → 发 1 枚
 *   2. daily（tier 无 tieredThresholds）：当前进度 - 已持有 = 补发差额
 *   3. milestone/ability/skill（tieredThresholds）：每个 tier 独立判定，
 *      progress >= threshold 且未发过该 tier → 发 1 枚（meta.tier 标记）
 */
export function checkAndAwardTrophies(ctx: TrophyCheckContext): AwardEntry[] {
  const out: AwardEntry[] = [];

  for (const def of TROPHIES) {
    if (def.category === "commemorative") {
      // 单次型：未持有且条件成立 → +1
      const have = ctx.trophies.some((t) => t.trophyId === def.id);
      if (have || !def.check) continue;
      try {
        if (def.check(ctx))
          out.push({
            trophyId: def.id,
            count: 1,
            newTotalCount: 1,
            isRare: true,
          });
      } catch {
        /* */
      }
      continue;
    }

    if (!def.tier) continue;

    let target = 0;
    try {
      target = def.tier(ctx);
    } catch {
      continue;
    }

    if (def.tieredThresholds && def.tieredThresholds.length > 0) {
      // tiered：每个 tier 独立判定
      for (const t of def.tieredThresholds) {
        if (target < t.threshold) continue;
        const alreadyAwarded = ctx.trophies.some(
          (ut) => ut.trophyId === def.id && (ut.meta as { tier?: string } | undefined)?.tier === t.tier,
        );
        if (alreadyAwarded) continue;
        out.push({
          trophyId: def.id,
          count: 1,
          newTotalCount: 1,
          isRare: t.tier === "gold" || t.tier === "platinum", // 金/钻触发盲盒
          tier: t.tier,
        });
      }
    } else {
      // daily：补发差额
      const have = ctx.trophies.filter((t) => t.trophyId === def.id).length;
      const delta = target - have;
      if (delta > 0)
        out.push({
          trophyId: def.id,
          count: delta,
          newTotalCount: target,
          isRare: false,
        });
    }
  }
  return out;
}

export function trophyDef(id: string) {
  return TROPHIES.find((t) => t.id === id);
}

/**
 * 给定 def + 当前进度值，判断当前已达的最高 tier。
 * UI 用这个决定显示哪个等级的图。
 */
export function currentTier(def: TrophyDef, progress: number): TrophyTier | null {
  if (!def.tieredThresholds) return null;
  let cur: TrophyTier | null = null;
  for (const t of def.tieredThresholds) {
    if (progress >= t.threshold) cur = t.tier;
  }
  return cur;
}

/**
 * 给定 def + 当前进度值，返回下个还没达到的 tier（用于"再差 X 进银"提示）。
 */
export function nextTierGap(
  def: TrophyDef,
  progress: number,
): { tier: TrophyTier; gap: number; threshold: number } | null {
  if (!def.tieredThresholds) return null;
  for (const t of def.tieredThresholds) {
    if (progress < t.threshold) {
      return { tier: t.tier, gap: t.threshold - progress, threshold: t.threshold };
    }
  }
  return null;
}
