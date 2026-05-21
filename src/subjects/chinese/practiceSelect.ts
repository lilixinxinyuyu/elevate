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

/**
 * 语文模拟测试选题：先**保证每个能力维度覆盖** (字音/字形/词汇/句子/阅读/表达/积累)，
 * 再按难度分桶 5/5/6/4 凑齐 size 题 (默认 20)。
 *
 * v0.36.75 (跟数学 mock per-unit 修复同源, 8787+8788 已 peer review 该 pattern):
 * 之前 ChineseTrain 里纯按难度桶 shuffle, 没能力配额 → 题量最少的能力 (积累 33 题) 在
 * ~30% 模拟卷里被完全漏掉, 阅读 ~10%。语文期末按题型(≈能力)出卷, 漏"积累"(古诗文默写,
 * 送分题) = 假覆盖。修法: 每个出现的能力先留 1 道底量, 余下走难度配比。
 *
 * 纯函数。rng 默认 Math.random (仅影响选哪道, 不影响"是否覆盖")。
 */
export function buildChineseMockExam(
  pool: Question[],
  skills: { id: string; ability: readonly string[] }[],
  opts: { size?: number; rng?: () => number } = {},
): Question[] {
  const size = opts.size ?? 20;
  const rng = opts.rng ?? Math.random;
  const sh = <T,>(a: readonly T[]): T[] => {
    const o = a.slice();
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [o[i]!, o[j]!] = [o[j]!, o[i]!]; }
    return o;
  };
  const abilityOf = new Map(skills.map((s) => [s.id, s.ability]));
  const selectedIds = new Set<string>();
  const out: Question[] = [];

  // 1. 能力底量: 池里出现的每个能力至少 1 道
  const abilitiesInPool = new Set<string>();
  for (const q of pool) for (const a of abilityOf.get(q.skill_id) ?? []) abilitiesInPool.add(a);
  for (const ab of abilitiesInPool) {
    if (out.length >= size) break;
    const cand = sh(pool.filter((q) => !selectedIds.has(q.question_id) && (abilityOf.get(q.skill_id) ?? []).includes(ab)));
    if (cand[0]) { out.push(cand[0]); selectedIds.add(cand[0].question_id); }
  }

  // 2. 余下按难度桶 5/5/6/4 (排除已留底), 按剩余名额缩放
  const buckets: Record<1 | 2 | 3 | 4 | 5, Question[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const q of pool) {
    if (selectedIds.has(q.question_id)) continue;
    const d = (q.difficulty >= 5 ? 5 : (q.difficulty || 3)) as 1 | 2 | 3 | 4 | 5;
    buckets[d].push(q);
  }
  const remaining = Math.max(0, size - out.length);
  const ratio: Record<1 | 2 | 3 | 4, number> = { 1: 5, 2: 5, 3: 6, 4: 4 };
  for (const d of [1, 2, 3, 4] as const) {
    const quota = Math.round((ratio[d] / 20) * remaining);
    for (const q of sh(buckets[d]).slice(0, quota)) {
      if (out.length >= size) break;
      if (selectedIds.has(q.question_id)) continue;
      out.push(q); selectedIds.add(q.question_id);
    }
  }

  // 3. 不够补回去
  if (out.length < size) {
    for (const q of sh(pool.filter((p) => !selectedIds.has(p.question_id)))) {
      if (out.length >= size) break;
      out.push(q); selectedIds.add(q.question_id);
    }
  }
  return sh(out).slice(0, size);
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
