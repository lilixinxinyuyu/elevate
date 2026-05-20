/**
 * v0.36.43 — 统一选题重构 Phase 2: cluster 流式选题 (streaming selection).
 *
 * 经 Gemini-3.1-pro + GPT-5.5 双 peer review: cluster 短游戏循环(一道接一道, 没有
 * "交卷")不该复用 buildDailySession(为"今日一套题"的批量规划器), 而要"流式选下一题":
 * 局内去重 + 难度爬升(连对加难/连错降难) + 间隔重现错题插入 + 缺题诊断(starved 信号
 * 给调用方触发 AI 生成).
 *
 * 本模块是纯函数 (无 IO), cluster 页把 CASES 的 sourceQuestion 元数据喂进来, 拿到
 * 下一题的下标。due 错题 id / baseDifficulty 由调用方一次性查好传入。
 *
 * 设计要点(双评一致):
 *  - 不传整表; 只传当前已加载的候选元数据 (cluster CASES 本就在内存).
 *  - 难度: 连对3→+1, 连错2→-1, clamp[1,5], 以 mastery 基线为锚.
 *  - 复习: 每 ~reviewEveryN 题插 1 道到期错题, 不连续插 (cluster 是游戏不是错题本).
 *  - 兜底链: 未出过近难度 → 都出过则近难度随机(避免刚出) → starved 触发生成.
 */

export interface ClusterCandidate {
  /** 在 cluster CASES 数组里的下标 */
  index: number;
  /** 真题 question_id (DEMO 用合成 id) */
  questionId: string;
  /** 1-5 (DEMO 缺省 2) */
  difficulty: number;
  skillId: string;
}

export interface ClusterSessionState {
  /** 本局已出过的 question_id */
  seenIds: Set<string>;
  /** 最近结果 (true=对), 末尾是最新; 用于连对/连错 */
  recent: boolean[];
  /** 距上次插入复习题已出几道 (初始大值, 让前几题正常出) */
  sinceReview: number;
  /** 上一题难度 (难度爬升的锚) */
  lastDifficulty: number;
  /** 上一题 id (避免立即重复) */
  lastId: string | null;
}

export function emptyClusterSession(baseDifficulty = 2): ClusterSessionState {
  return { seenIds: new Set(), recent: [], sinceReview: 99, lastDifficulty: baseDifficulty, lastId: null };
}

/** 连对 3 → +1; 连错 2 → -1; clamp [1,5]; 以 lastDifficulty(或 base) 为锚。 */
export function computeTargetDifficulty(state: ClusterSessionState, base: number): number {
  const anchor = state.lastDifficulty || base;
  const last3 = state.recent.slice(-3);
  const last2 = state.recent.slice(-2);
  let target = anchor;
  if (last3.length === 3 && last3.every(Boolean)) target = anchor + 1;
  else if (last2.length === 2 && last2.every((c) => !c)) target = anchor - 1;
  return Math.max(1, Math.min(5, target));
}

export type PickReason = "review" | "target" | "repeat" | "only";

export interface PickResult {
  index: number;
  reason: PickReason;
  /** 题库见底/难度档缺题 — 调用方可据此后台触发 AI 生成 */
  starved: boolean;
  targetDifficulty: number;
}

export interface PickOpts {
  baseDifficulty?: number;
  dueMistakeIds?: Set<string>;
  reviewEveryN?: number;
  rng?: () => number;
}

/**
 * 流式选下一题下标。candidates 为空时返回 {index:0, starved:true}。
 */
export function pickNextClusterIndex(
  candidates: ClusterCandidate[],
  state: ClusterSessionState,
  opts: PickOpts = {},
): PickResult {
  const rng = opts.rng ?? Math.random;
  const base = opts.baseDifficulty ?? 2;
  const reviewEveryN = opts.reviewEveryN ?? 4;
  const due = opts.dueMistakeIds ?? new Set<string>();
  const target = computeTargetDifficulty(state, base);
  const pickRandom = (arr: ClusterCandidate[]) => arr[Math.floor(rng() * arr.length)]!;
  const notJust = (c: ClusterCandidate) => c.questionId !== state.lastId;

  if (candidates.length === 0) return { index: 0, reason: "only", starved: true, targetDifficulty: target };
  if (candidates.length === 1) {
    return { index: candidates[0]!.index, reason: "only", starved: state.seenIds.has(candidates[0]!.questionId), targetDifficulty: target };
  }

  // 1) 间隔重现: 每 reviewEveryN 题插一道到期错题 (排除刚出的)
  if (state.sinceReview >= reviewEveryN && due.size > 0) {
    const dueCands = candidates.filter((c) => due.has(c.questionId) && notJust(c));
    if (dueCands.length > 0) {
      return { index: pickRandom(dueCands).index, reason: "review", starved: false, targetDifficulty: target };
    }
  }

  // 2) 未出过 + 难度最接近 target
  const unseen = candidates.filter((c) => !state.seenIds.has(c.questionId) && notJust(c));
  if (unseen.length > 0) {
    const minDist = Math.min(...unseen.map((c) => Math.abs(c.difficulty - target)));
    const near = unseen.filter((c) => Math.abs(c.difficulty - target) === minDist);
    return { index: pickRandom(near).index, reason: "target", starved: false, targetDifficulty: target };
  }

  // 3) 都出过 → 近 target 难度里随机 (排除刚出的); starved=true 提示可生成新题
  const repeatable = candidates.filter(notJust);
  const pool = repeatable.length > 0 ? repeatable : candidates;
  const minDist2 = Math.min(...pool.map((c) => Math.abs(c.difficulty - target)));
  const near2 = pool.filter((c) => Math.abs(c.difficulty - target) === minDist2);
  return { index: pickRandom(near2).index, reason: "repeat", starved: true, targetDifficulty: target };
}

/** 答完一题后推进 session 状态。 */
export function advanceClusterSession(
  state: ClusterSessionState,
  args: { questionId: string; isCorrect: boolean; difficulty: number; wasReview: boolean },
): ClusterSessionState {
  const seen = new Set(state.seenIds);
  seen.add(args.questionId);
  return {
    seenIds: seen,
    recent: [...state.recent, args.isCorrect].slice(-6),
    sinceReview: args.wasReview ? 0 : state.sinceReview + 1,
    lastDifficulty: args.difficulty,
    lastId: args.questionId,
  };
}

/** 从 cluster 的 case 数组(每个带可选 sourceQuestion) 构建候选元数据。 */
export function buildCandidates<T extends { sourceQuestion?: { question_id: string; difficulty?: number; skill_id: string } }>(
  cases: readonly T[],
): ClusterCandidate[] {
  return cases.map((c, index) => {
    const sq = c.sourceQuestion;
    return {
      index,
      questionId: sq?.question_id ?? `demo-${index}`,
      difficulty: typeof sq?.difficulty === "number" ? sq.difficulty : 2,
      skillId: sq?.skill_id ?? "",
    };
  });
}
