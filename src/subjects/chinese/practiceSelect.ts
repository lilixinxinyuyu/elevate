/**
 * v0.36.50 — 统一选题重构 Phase 3 (Option A): 语文 practice 模式智能选题。
 *
 * 经 Gemini-3.1-pro(8787) + GPT-5.5(8788) 双 peer review 一致选 Option A:
 * 不动数学 scheduler.ts (它硬依赖 math SKILLS/FINAL_SPRINT, 抽取风险大), 而是在语文本地
 * 写一个纯函数 improver, 只替换 ChineseTrain practice 分支的 `shuffle(pool).slice()` 一行。
 * review / mock_exam / URL 过滤 全部不动。
 *
 * 比纯 shuffle 多给 practice:
 *  - 到期错题注入 (≤3/10, ≤30%, 按 exam_priority 加权抽)
 *  - 难度配比 (按平均 mastery 分档, 弱→偏易, 强→偏难)
 *  - 近期做对去重 (3 天 SOFT 窗口: 题不够时回退全部, 绝不饿到空 → 不误触 AutoGenerateOnEmpty)
 *  - exam_priority bucket 内加权
 *  - diversifyOrder (同 skill 不连超过 2 题)
 *
 * 纯函数 (无 IO), 调用方先查好 mastery / dueIds / recentCorrectIds 传进来。
 */

import type { Question, MasteryScore } from "../../core/types";
// v0.36.59 Phase 4 (Option B): shuffle 用跨学科共享 ./core/rng (逐字同实现, 行为不变)。
import { shuffle } from "../../core/rng";

const EXAM_WEIGHT: Record<string, number> = {
  MUST_BIG: 3,
  HIGH_BIG: 3,
  MUST_SMALL: 2,
  VERY_HIGH_SMALL: 2,
  HIGH_SMALL: 2,
};
function examWeight(q: Question): number {
  return EXAM_WEIGHT[q.exam_priority] ?? 1;
}

/** 难度配比 (按平均 mastery 0-100), 语文 difficulty 1-5。 */
function difficultyBands(avgMastery: number): Record<number, number> {
  if (avgMastery < 40) return { 1: 0.4, 2: 0.35, 3: 0.2, 4: 0.05, 5: 0 };
  if (avgMastery < 70) return { 1: 0.15, 2: 0.35, 3: 0.35, 4: 0.15, 5: 0 };
  if (avgMastery < 85) return { 1: 0.05, 2: 0.2, 3: 0.35, 4: 0.3, 5: 0.1 };
  return { 1: 0.05, 2: 0.1, 3: 0.25, 4: 0.35, 5: 0.25 };
}

/** 按 exam_priority 权重无放回抽 n 个。 */
function weightedSample(items: Question[], n: number, rng: () => number): Question[] {
  const pool = items.slice();
  const out: Question[] = [];
  while (out.length < n && pool.length > 0) {
    const total = pool.reduce((s, q) => s + examWeight(q), 0);
    let r = rng() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i++) {
      r -= examWeight(pool[i]!);
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    out.push(pool.splice(idx, 1)[0]!);
  }
  return out;
}

function avgMasteryOf(qs: Question[], mastery: MasteryScore[]): number {
  if (qs.length === 0) return 50;
  const bySkill = new Map(mastery.map((m) => [m.skillId, m.score]));
  let sum = 0;
  let n = 0;
  for (const q of qs) {
    const s = bySkill.get(q.skill_id);
    if (typeof s === "number") {
      sum += s;
      n++;
    }
  }
  return n > 0 ? sum / n : 50;
}

/** 同 skill 不连续超过 maxRun 题 (贪心)。 */
function diversifyOrder(qs: Question[], maxRun: number, rng: () => number): Question[] {
  const remaining = shuffle(qs, rng);
  const out: Question[] = [];
  while (remaining.length > 0) {
    let pickIdx = remaining.findIndex((q) => {
      const run = out.slice(-maxRun);
      return !(run.length === maxRun && run.every((r) => r.skill_id === q.skill_id));
    });
    if (pickIdx < 0) pickIdx = 0;
    out.push(remaining.splice(pickIdx, 1)[0]!);
  }
  return out;
}

export interface PracticeSelectInput {
  /** 已经过 URL filter (skillId/unitId/ability) 的候选池。 */
  pool: Question[];
  mastery: MasteryScore[];
  /** 到期错题 question_id。 */
  dueIds: Set<string>;
  /** 近 3 天做对的 question_id (SOFT 去重)。 */
  recentCorrectIds: Set<string>;
  size: number;
  rng?: () => number;
}

/**
 * 语文 practice 智能选题。空池返回 [] (保留 AutoGenerateOnEmpty 路径)。
 * 永远尽量返回 size 道 (题够的话), 饥饿时回退而非返空。
 */
export function buildChinesePracticeQuestions(input: PracticeSelectInput): Question[] {
  const { pool, mastery, dueIds, recentCorrectIds, size } = input;
  const rng = input.rng ?? Math.random;
  if (pool.length === 0) return [];

  // 1. 到期错题注入 (≤3, ≤30%), 按 exam_priority 加权
  const dueCap = Math.min(3, Math.max(1, Math.floor(size * 0.3)));
  const dueInPool = pool.filter((q) => dueIds.has(q.question_id));
  const due = weightedSample(dueInPool, Math.min(dueCap, dueInPool.length), rng);
  const dueSet = new Set(due.map((q) => q.question_id));

  // 2. remaining − 近期做对 (SOFT: 不够就回退全部 remaining)
  const remaining = pool.filter((q) => !dueSet.has(q.question_id));
  const need = Math.max(0, size - due.length);
  let preferred = remaining.filter((q) => !recentCorrectIds.has(q.question_id));
  if (preferred.length < need) preferred = remaining;

  // 3. 难度配比 (按 preferred 平均 mastery 分档)
  const avgM = avgMasteryOf(preferred, mastery);
  const bands = difficultyBands(avgM);
  const buckets: Record<number, Question[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const q of preferred) {
    const d = Math.min(5, Math.max(1, q.difficulty || 3));
    buckets[d]!.push(q);
  }
  const picked: Question[] = [];
  for (const d of [1, 2, 3, 4, 5]) {
    const quota = Math.round((bands[d] ?? 0) * need);
    picked.push(...weightedSample(buckets[d]!, Math.min(quota, buckets[d]!.length), rng));
  }

  // 4. 补齐到 size (dup-safe, 从 preferred→remaining→pool 顺序兜底)
  const chosen = new Set([...due, ...picked].map((q) => q.question_id));
  for (const q of shuffle([...preferred, ...remaining, ...pool], rng)) {
    if (due.length + picked.length >= size) break;
    if (chosen.has(q.question_id)) continue;
    chosen.add(q.question_id);
    picked.push(q);
  }

  // 5. diversify (同 skill 不连超 2)
  const filled = [...due, ...picked].slice(0, size);
  return diversifyOrder(filled, 2, rng);
}
