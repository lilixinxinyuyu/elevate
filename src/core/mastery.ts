/**
 * v0.28 重写：Elo + 滚动窗口 + 难度加权 + Fragility 的混合掌握度算法。
 *
 * ─── 为什么换 ───────────────────────────────────────────
 * 老算法（v0.27 及之前）：起始 50 分，每对一题固定 +2.4~3.5，没时间衰减、
 * 不区分新旧、刷 25 题就能到 90。所以 Selena 模考 75% 但首页全"熟练"。
 *
 * 新算法借鉴：
 *   - Duolingo Birdbrain 的 Elo 自校准（不需要人工标难度）
 *   - Khan Academy 的"5-in-a-row + 时间门"（防刷）
 *   - FSRS 的遗忘曲线（detect fragility）
 *   - PFA 的 recency weighting（最近表现权重高）
 *
 * ─── 三个独立信号 ───────────────────────────────────────
 *   A. **学生 Elo**（一个数字）：每次答题双向更新；难题答对涨得多
 *   B. **滚动窗口加权命中率**：最近 30 条 attempt，时间×难度加权
 *   C. **多样性**：最近 10 条里有几个不同 questionId
 *
 * 综合分 = accuracy × 0.5 + eloComponent × 0.3 + diversityBonus × 0.2
 *
 * ─── Fragility 上限 ─────────────────────────────────────
 * 距离上次答对 > 21 天，或最近 5 题错 ≥ 3 题 → 上限 45 分
 * （即使 Elo 高、平均命中率高，也强制掉到"较稳"以下，提示去复习）
 *
 * ─── Anti-cram ──────────────────────────────────────────
 * uniqueQuestionsTried < 3 → score × 0.7（最近见到的题面太单一就打 7 折）
 * attempts < 5 → score × (attempts/5)（数据不足）
 */

import type {
  MasteryRecentEntry,
  MasteryScore,
} from "./types";

// ───────────────── 调参常量 ─────────────────

/** 学生 Elo 起始值 */
export const STUDENT_ELO_BASE = 1200;
/** 题目 Elo 起始值（按 difficulty 1-5 映射）：1=1100, 3=1500, 5=1900 */
export const QUESTION_ELO_BY_DIFFICULTY = [1100, 1100, 1300, 1500, 1700, 1900] as const;
/** Elo K 因子（决定单次答题的更新幅度） */
const K_FACTOR = 24;
/** "完全掌握"对应的学生 Elo 阈值（用于 eloComponent 归一化到 0-1） */
const MASTERY_TARGET_ELO = 1500;
/** 滚动窗口最大长度 */
const RECENT_WINDOW_MAX = 30;
/** 时间衰减半衰期（天）— 14 天前的 attempt 权重已经只有 50% */
const TIME_HALFLIFE_DAYS = 14;
/** Fragility：距离上次答对 N 天后强制 mastery 上限 45 */
const FRAGILE_DAYS_THRESHOLD = 21;
/** Fragility：最近 5 题错 ≥ K 题强制 mastery 上限 45 */
const FRAGILE_RECENT_WRONG_THRESHOLD = 3;
/** Fragility 触发后 mastery 上限 */
const FRAGILE_CAP = 45;
/** 题面不足惩罚：不同 questionId 数 < 3 时 mastery × 0.7 */
const MIN_DIVERSITY = 3;
/** 数据不足：attempts < 5 时 mastery 按比例打折 */
const MIN_ATTEMPTS_FOR_FULL_SCORE = 5;

/** 兼容旧 import：阈值（ASCII 友好） */
export const MASTERY_BOUNDS = {
  min: 0,
  max: 100,
  /** 进步中 阈值下限 */
  weak: 40,
  /** 较稳 阈值下限 */
  stable: 60,
  /** 熟练 阈值下限 */
  mastered: 75,
  /** 精通 阈值下限 */
  expert: 90,
};

// ───────────────── 题目 Elo 推断 ─────────────────

/** 把 1-5 难度映射到题目 Elo 起始值。允许 difficulty 为 NaN/undefined → 1500 */
export function questionEloByDifficulty(difficulty: number | undefined | null): number {
  const d = Math.max(1, Math.min(5, Math.round(difficulty ?? 3)));
  return QUESTION_ELO_BY_DIFFICULTY[d] ?? 1500;
}

// ───────────────── Elo 更新 ─────────────────

/**
 * v0.30.12: Elo "hard cap" —— 学生 Elo 比题目 Elo 高 ELO_DOMINANT_DELTA 时，
 * 答对不再涨 Elo（已经溜熟了，重复练就不再奖励）；答错仍正常降。
 * 防"刷低难度题让 Elo 缓慢爬升"。
 *
 * 实测：当 studentElo - questionElo > 300，expectedP > 0.85，actual=1 时
 * 单次 Elo 增量 < 4。但 100 次累计仍然能涨 30+ Elo。强行截断更彻底。
 */
const ELO_DOMINANT_DELTA = 300;

/**
 * 用一次 attempt 更新学生 Elo。返回新 Elo（不修改原状态）。
 *
 *   expectedP = 1 / (1 + 10^((题目Elo - 学生Elo) / 400))
 *   Elo += K × (actual - expectedP)
 *
 * 答对一道难题（expectedP 低）涨得多；答对一道简单题（expectedP 高）几乎不涨。
 * 答错一道简单题（expectedP 高）跌得多；答错难题（expectedP 低）几乎不跌。
 *
 * v0.30.7: 第三参数支持数字（usedTutor）—— actual 0.5 表示 tutor-assisted 答对，
 * 半信半疑，让 Elo 涨幅减半。等价于 boolean true → 1 / boolean false → 0。
 *
 * v0.30.12: 学生 Elo > 题目 Elo + 300 且答对时强行不涨 Elo（防低难度刷分）。
 * 错答 + 中性 outcome (0.5) 仍正常计算（错题该罚的还要罚）。
 */
export function updateStudentElo(
  oldElo: number,
  questionElo: number,
  outcome: boolean | number,
): number {
  const expected = 1 / (1 + Math.pow(10, (questionElo - oldElo) / 400));
  const actual = typeof outcome === "number" ? outcome : (outcome ? 1 : 0);
  // v0.30.12: dominant cap —— 学生显著强过题目 + 答对，不涨 Elo
  if (actual >= 1 && (oldElo - questionElo) > ELO_DOMINANT_DELTA) {
    return oldElo;
  }
  return oldElo + K_FACTOR * (actual - expected);
}

// ───────────────── Mastery 综合分计算 ─────────────────

export interface MasteryComputeInput {
  recent: MasteryRecentEntry[];
  studentElo: number;
  attemptsCount: number;
  lastSuccessAt: number | undefined;
  /** 评估时间（ms）。tests 用固定值；运行时传 Date.now() */
  now: number;
}

export interface MasteryComputeResult {
  score: number;
  /** 加权命中率 0-1 */
  weightedAccuracy: number;
  /** Elo 分量 0-1 */
  eloComponent: number;
  /** 多样性分量 0-1 */
  diversityBonus: number;
  /** 是否 fragile（提示需要复习） */
  fragile: boolean;
  /** 数据是否足够（< 5 attempts 都打折） */
  thin: boolean;
}

/**
 * 把 mastery state 综合算成 0-100 分。
 *
 * 这是**纯函数**，每次需要时即时算（成本低 O(30)）。state 里只持久化原始数据
 * （recent / studentElo / lastSuccessAt），不存 score 缓存（避免不一致）。
 */
export function computeMasteryScore(
  input: MasteryComputeInput,
): MasteryComputeResult {
  const { recent, studentElo, attemptsCount, lastSuccessAt, now } = input;

  if (recent.length === 0) {
    return {
      score: 0,
      weightedAccuracy: 0,
      eloComponent: 0,
      diversityBonus: 0,
      fragile: false,
      thin: true,
    };
  }

  // 1. 加权命中率（time × difficulty）
  // v0.30.7: tutor-assisted 答对在分子里只算 0.5 —— 跟"独立答对"区分开
  let wCorrect = 0;
  let wTotal = 0;
  for (const r of recent) {
    const ageDays = Math.max(0, (now - r.ts) / 86_400_000);
    const timeW = Math.pow(0.5, ageDays / TIME_HALFLIFE_DAYS); // halflife 衰减
    const diffW = 0.7 + 0.16 * Math.max(0, Math.min(5, r.difficulty)); // 1=0.86, 5=1.5
    const w = timeW * diffW;
    wTotal += w;
    if (r.correct) {
      wCorrect += r.usedTutor ? w * TUTOR_ASSISTED_ELO_ACTUAL : w;
    }
  }
  const weightedAccuracy = wTotal > 0 ? wCorrect / wTotal : 0;

  // 2. Elo 分量：学生 Elo 跟"完全掌握门槛 1500"比
  // eloComponent ≈ 0.5 时 Elo = 1500；Elo = 1700 时 ≈ 0.76；Elo = 1100 时 ≈ 0.09
  const eloComponent = 1 / (1 + Math.pow(10, (MASTERY_TARGET_ELO - studentElo) / 400));

  // 3. 多样性：最近 10 次有几种不同的 questionId
  const recent10 = recent.slice(-10);
  const uniqueIds = new Set(recent10.map((r) => r.questionId)).size;
  const diversityBonus = Math.min(1, uniqueIds / 4); // ≥4 种题面才给满 1.0

  // 4. 综合（v0.28 调参：accuracy 0.4 + elo 0.4 + diversity 0.2）
  // accuracy 不能权重过高，否则刷简单题就能假装"熟练"。
  // elo 是真实能力的硬指标——简单题刷不出 1500+ Elo，自然封顶在 70 分上下。
  let raw = weightedAccuracy * 0.4 + eloComponent * 0.4 + diversityBonus * 0.2;

  // 5. 数据不足惩罚
  let thin = false;
  if (attemptsCount < MIN_ATTEMPTS_FOR_FULL_SCORE) {
    raw *= attemptsCount / MIN_ATTEMPTS_FOR_FULL_SCORE;
    thin = true;
  }
  if (uniqueIds < MIN_DIVERSITY) {
    raw *= 0.7; // 题面不够多样 → 7 折
  }

  // 6. Fragility 上限
  const daysSinceSuccess =
    lastSuccessAt != null ? (now - lastSuccessAt) / 86_400_000 : Infinity;
  const last5Wrong = recent.slice(-5).filter((r) => !r.correct).length;
  const fragile =
    daysSinceSuccess > FRAGILE_DAYS_THRESHOLD ||
    last5Wrong >= FRAGILE_RECENT_WRONG_THRESHOLD;

  let final = raw * 100;
  if (fragile) final = Math.min(final, FRAGILE_CAP);

  return {
    score: Math.max(0, Math.min(100, Math.round(final))),
    weightedAccuracy,
    eloComponent,
    diversityBonus,
    fragile,
    thin,
  };
}

// ───────────────── 增量更新接口（service.ts 用）─────────────────

/** v0.30.7: tutor-assisted 答对在 Elo 更新里的 actual 值（0.5 = 半信半疑，比独立答对 1 弱、比错答 0 强）*/
export const TUTOR_ASSISTED_ELO_ACTUAL = 0.5;

export interface MasteryAttemptInput {
  questionId: string;
  difficulty: number;
  isCorrect: boolean;
  /**
   * v0.30.7: 这次答对是不是 tutor-assisted（讲题之后才对）？
   * 仅 isCorrect=true 时生效：
   *   - Elo 用 0.5 当 actual（涨幅减半）
   *   - recent 窗口里也标 usedTutor，weighted accuracy 算 0.5 而不是 1
   *   - 不让"刷讲题"刷到 Elo / 熟练度
   */
  usedTutor?: boolean;
  /** 答题时间戳（默认 now） */
  ts?: number;
}

/**
 * 拿到 prior MasteryScore + 这次 attempt → 算出 next MasteryScore（含 score + 全部
 * 内部 state 字段）。这是 service.ts 唯一调用入口。
 *
 * - prior 可以是 null/undefined（第一次见这个 skill）
 * - 不依赖 db，纯函数，方便测试
 */
export function applyAttempt(
  prior: MasteryScore | null | undefined,
  attempt: MasteryAttemptInput,
  now: number = Date.now(),
): {
  /** 下一个 MasteryScore 对象（不含 id/studentId/skillId 等元字段，由调用方填）*/
  next: Pick<
    MasteryScore,
    | "score"
    | "attemptsCount"
    | "correctCount"
    | "lastPracticedAt"
    | "updatedAt"
    | "studentElo"
    | "recent"
    | "lastSuccessAt"
    | "lastErrorAt"
  >;
  /** mastery 变化量（用于显示"+2 / -3"） */
  delta: number;
  /** 题目 Elo 推断（如果 question 表里要存的话） */
  questionEloUsed: number;
  detail: MasteryComputeResult;
} {
  const ts = attempt.ts ?? now;
  const questionElo = questionEloByDifficulty(attempt.difficulty);
  const oldElo = prior?.studentElo ?? STUDENT_ELO_BASE;
  // v0.30.7: tutor-assisted 答对走 actual=0.5 半信半疑 Elo 更新
  const eloOutcome: boolean | number =
    attempt.isCorrect && attempt.usedTutor
      ? TUTOR_ASSISTED_ELO_ACTUAL
      : attempt.isCorrect;
  const newElo = updateStudentElo(oldElo, questionElo, eloOutcome);

  const oldRecent = prior?.recent ?? [];
  const newRecent = [
    ...oldRecent,
    {
      ts,
      correct: attempt.isCorrect,
      difficulty: attempt.difficulty,
      questionId: attempt.questionId,
      ...(attempt.isCorrect && attempt.usedTutor ? { usedTutor: true } : {}),
    },
  ].slice(-RECENT_WINDOW_MAX);

  const newAttempts = (prior?.attemptsCount ?? 0) + 1;
  const newCorrect = (prior?.correctCount ?? 0) + (attempt.isCorrect ? 1 : 0);

  const detail = computeMasteryScore({
    recent: newRecent,
    studentElo: newElo,
    attemptsCount: newAttempts,
    lastSuccessAt: attempt.isCorrect ? ts : prior?.lastSuccessAt,
    now,
  });

  return {
    next: {
      score: detail.score,
      attemptsCount: newAttempts,
      correctCount: newCorrect,
      lastPracticedAt: ts,
      updatedAt: ts,
      studentElo: newElo,
      recent: newRecent,
      lastSuccessAt: attempt.isCorrect ? ts : prior?.lastSuccessAt,
      lastErrorAt: attempt.isCorrect ? prior?.lastErrorAt : ts,
    },
    delta: detail.score - (prior?.score ?? 0),
    questionEloUsed: questionElo,
    detail,
  };
}

// ───────────────── 老 API 兼容垫层 ─────────────────
//
// 老的 updateMastery({oldScore, ...}) 还有几处调用（service.ts、tests）。
// 这里保留一个 thin wrapper：内部用新算法，但接口签名兼容。
// 调用方主动迁移到 applyAttempt() 后这个垫层就可以删。

/**
 * @deprecated 用 applyAttempt 代替。这个函数只看 oldScore + isCorrect + difficulty，
 * 没法算多样性 / 时间衰减 / Elo（信息不足），所以只做粗糙的"按命中率反推"作为兼容。
 *
 * 内部行为：把 oldScore 推断成"prior elo"，跑一次 Elo 更新，再换回 0-100 score。
 * 没有 fragility / 多样性。仅用于尚未迁移的老调用点。
 */
export function updateMastery(input: {
  oldScore: number;
  difficulty: number;
  isCorrect: boolean;
  /** 这些参数现在被忽略；保留是为了签名兼容 */
  usedHint?: boolean;
  elapsedSeconds?: number;
  estimatedTimeSeconds?: number;
  errorTags?: string[];
  priorErrorTags?: string[];
  cognitiveLevel?: string;
  multiStepAllStepsCorrect?: boolean;
  priorCorrectCount?: number;
  uniqueQuestionsTried?: number;
}): number {
  // oldScore 0-100 → 估算 elo（粗略：score 50 ≈ 1200 elo，每 +1 score ≈ +10 elo）
  const inferredElo = STUDENT_ELO_BASE + (input.oldScore - 50) * 10;
  const qElo = questionEloByDifficulty(input.difficulty);
  const newElo = updateStudentElo(inferredElo, qElo, input.isCorrect);
  // elo 变化反推 score 变化
  const eloDelta = newElo - inferredElo;
  const scoreDelta = eloDelta / 10;
  return Math.max(0, Math.min(100, Math.round(input.oldScore + scoreDelta)));
}

export function clampMastery(v: number): number {
  return Math.max(MASTERY_BOUNDS.min, Math.min(MASTERY_BOUNDS.max, v));
}

/** 兼容旧 import 但新算法不依赖这个，留作参考 */
export function masteryCapByUnique(uniqueCount: number): number {
  return Math.min(100, 30 + uniqueCount * 10);
}

// ───────────────── 一次性回填（v5 migration 用）─────────────────

export interface BackfillAttempt {
  questionId: string;
  difficulty: number;
  isCorrect: boolean;
  ts: number;
}

/**
 * 给定某个 student × skill 的所有历史 attempt（按时间升序），重放 Elo + recent 窗口
 * 得到当前 MasteryScore。Dexie v5 migration 调用：让 Selena 现有的 attempts 直接
 * 喂进新算法，重新算出更准确的 score。
 */
export function backfillFromAttempts(
  attempts: BackfillAttempt[],
  now: number = Date.now(),
): {
  score: number;
  studentElo: number;
  recent: MasteryRecentEntry[];
  attemptsCount: number;
  correctCount: number;
  lastPracticedAt: number | undefined;
  lastSuccessAt: number | undefined;
  lastErrorAt: number | undefined;
} {
  let elo = STUDENT_ELO_BASE;
  const recent: MasteryRecentEntry[] = [];
  let lastSuccessAt: number | undefined;
  let lastErrorAt: number | undefined;
  let lastPracticedAt: number | undefined;
  let correctCount = 0;
  for (const a of attempts) {
    elo = updateStudentElo(elo, questionEloByDifficulty(a.difficulty), a.isCorrect);
    recent.push({
      ts: a.ts,
      correct: a.isCorrect,
      difficulty: a.difficulty,
      questionId: a.questionId,
    });
    if (recent.length > RECENT_WINDOW_MAX) recent.shift();
    if (a.isCorrect) {
      correctCount++;
      lastSuccessAt = a.ts;
    } else {
      lastErrorAt = a.ts;
    }
    lastPracticedAt = a.ts;
  }
  const detail = computeMasteryScore({
    recent,
    studentElo: elo,
    attemptsCount: attempts.length,
    lastSuccessAt,
    now,
  });
  return {
    score: detail.score,
    studentElo: elo,
    recent,
    attemptsCount: attempts.length,
    correctCount,
    lastPracticedAt,
    lastSuccessAt,
    lastErrorAt,
  };
}
