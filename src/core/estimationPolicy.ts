/**
 * v0.34.99 (iter 33 P0-1): Estimation Gate 政策 + 辅助.
 *
 * 起源: Selena 43% 期中事件 master plan P0-1.
 * 强制 Selena 在做多位数 × / + 计算前, 先 round + estimate + magnitude.
 *
 * 双家 peer review (Gemini + GPT) 共识收窄 v1 MVP scope:
 *   - 仅多位数 × / + (跳过减法抵消 + 除法相容数 — 留 v2)
 *   - 应用题不触发 (除非显式 q.requiresEstimation=true)
 *   - 每日 cap 8 道 (防疲劳)
 *   - Round 验证用 friendly-number 白名单 (不用 ±25% — 太宽)
 *   - Phase 2+3 UI 合并 (减少跳转)
 *   - XP +12 总 (从 +20 降, GPT 推荐)
 *   - Magnitude 动态 + 加 "十万级"
 *
 * Feature flag: isEstimationGateV1() (default ON).
 */
import type { Question } from "./types";
import { isEstimationGateV1 } from "../lib/featureFlags";
import { classifyStem, isSpeedEligible } from "./speedMatchPolicy";

/* ──────────────────── Magnitude bucket ──────────────────── */

export type MagnitudeBucket =
  | "ones"
  | "tens"
  | "hundreds"
  | "thousands"
  | "tenThousands"
  | "hundredThousands"
  | "millions";

export function magnitudeBucket(n: number): MagnitudeBucket {
  const v = Math.abs(n);
  if (v < 10) return "ones";
  if (v < 100) return "tens";
  if (v < 1000) return "hundreds";
  if (v < 10000) return "thousands";
  if (v < 100000) return "tenThousands";
  if (v < 1000000) return "hundredThousands";
  return "millions";
}

/** GPT 反馈: 用 "万级"/"千级" 比 "几万"/"几千" 自然 */
export const MAGNITUDE_LABEL: Record<MagnitudeBucket, string> = {
  ones: "个位",
  tens: "几十",
  hundreds: "几百 (百级)",
  thousands: "几千 (千级)",
  tenThousands: "万级",
  hundredThousands: "十万级",
  millions: "百万级",
};

/**
 * 围绕给定估算值生成相邻 4-5 个 magnitude 选项卡片.
 * GPT 反馈: 不要固定"十/百/千/万" 4 档, 根据估算值动态.
 * post-review: 如果 actualMagnitude 给定且不在窗口内, 强制 inject (保证正解可选).
 */
export function magnitudeChoicesAround(estimate: number, actual?: MagnitudeBucket): MagnitudeBucket[] {
  const center = magnitudeBucket(estimate);
  const order: MagnitudeBucket[] = [
    "ones", "tens", "hundreds", "thousands",
    "tenThousands", "hundredThousands", "millions",
  ];
  const idx = order.indexOf(center);
  const start = Math.max(0, idx - 1);
  const end = Math.min(order.length, idx + 3);
  const window = order.slice(start, end);
  if (actual && !window.includes(actual)) {
    // 强制 inject 正确档 — 保证 scoring 永远能选到对的
    const merged = [...window, actual];
    return merged.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  return window;
}

/* ──────────────────── Round 白名单生成 ──────────────────── */

/**
 * GPT + Gemini 共识: 不用 ±25% 容差. 用 friendly-number 白名单.
 * 给定原值 n, 返回所有"算得好的 round 值"
 *   - 整十 / 整百 / 整千 / 整万
 *   - 与原值相对误差 ≤ 15%
 *
 * 例:
 *   312 → [300, 310, 320] (300/310/320 都在 ±15%)
 *   47  → [40, 50] (40/50 都在 ±15%, 60 超出)
 *   4567 → [4500, 4600, 5000, 4000] (前 3 个在 ±15%, 4000 不在但好算 — 取舍: 严格 ±15% 排除 4000)
 *   1002 → [1000] (只接受 1000)
 */
export function generateAcceptableRounds(n: number): number[] {
  const v = Math.abs(n);
  if (v < 10) return [Math.round(n)]; // 个位不 round
  const tolerance = Math.max(1, v * 0.15);
  const candidates = new Set<number>();
  // 整十 / 整百 / 整千 / 整万
  for (const unit of [10, 100, 1000, 10000]) {
    if (unit > v * 2) break;
    const down = Math.floor(v / unit) * unit;
    const up = Math.ceil(v / unit) * unit;
    candidates.add(down);
    candidates.add(up);
  }
  return [...candidates]
    .filter((c) => Math.abs(c - v) <= tolerance && c > 0)
    .sort((a, b) => a - b);
}

/** 接受任何在白名单内的 round 值 */
export function isAcceptableRound(original: number, userValue: number): boolean {
  if (!Number.isFinite(userValue)) return false;
  const set = new Set(generateAcceptableRounds(original));
  return set.has(Math.round(userValue));
}

/**
 * Compute phase 验证: 用户算的 round_a × round_b 是否一致.
 * 容差 ±5% (这步不应该错很多 — 算 round 数本来就好算).
 */
export function isComputeConsistent(
  roundA: number,
  roundB: number,
  userProduct: number,
  op: "×" | "+",
): boolean {
  if (!Number.isFinite(userProduct)) return false;
  const ideal = op === "×" ? roundA * roundB : roundA + roundB;
  const tolerance = Math.max(1, Math.abs(ideal) * 0.05);
  return Math.abs(userProduct - ideal) <= tolerance;
}

/* ──────────────────── 题面分析 ──────────────────── */

/**
 * 从题面 stem 里提取所有数字 (用于 Phase 1 显示).
 * GPT 警告: 容易误抓题号 / 日期 / 单位. v1 只对结构化算式启用,
 * 应用题需要显式 q.keyNumbers (TODO: 加 schema 字段).
 *
 * 返回的数字按出现顺序保留. 取前 4 个 (防长应用题塞太多).
 */
export function extractNumbers(stem: string): number[] {
  const matches = stem.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return matches
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n !== 0)
    .slice(0, 4);
}

/** 判断题的主运算符. v1 仅支持 × / + */
export function detectMainOperator(stem: string): "×" | "+" | "-" | "÷" | "mixed" | "none" {
  const hasMul = /[×*乘]/.test(stem);
  const hasAdd = /[加+]/.test(stem) && !/加上|加起来/.test(stem); // 排除 "加上" 干扰
  const hasSub = /[-减]/.test(stem) && !/减少/.test(stem);
  const hasDiv = /[÷/]|除以/.test(stem);
  const count = [hasMul, hasAdd, hasSub, hasDiv].filter(Boolean).length;
  if (count > 1) return "mixed";
  if (hasMul) return "×";
  if (hasAdd) return "+";
  if (hasSub) return "-";
  if (hasDiv) return "÷";
  return "none";
}

/* ──────────────────── Trigger heuristic ──────────────────── */

/**
 * Heuristic — 题是否需要 Estimation Gate.
 *
 * v1 收窄版 (Gemini + GPT 双家共识):
 *   - q.answer.type === "number"
 *   - !isSpeedEligible(q) (非简单速算)
 *   - 主运算符 = × 或 + (排除 - 和 ÷ — 留 v2)
 *   - 数字最大 ≥ 3 位 (确保是"算起来费劲"的多位数)
 *
 * 应用题: 暂不触发, 除非显式 q.requiresEstimation=true (或 keyNumbers 提供 — TODO 后续).
 *
 * 显式覆盖: q.requiresEstimation true/false 双向.
 */
export function requiresEstimationByHeuristic(q: Question): boolean {
  if (q.answer.type !== "number") return false;
  if (isSpeedEligible(q)) return false;
  const op = detectMainOperator(q.stem);
  if (op !== "×" && op !== "+") return false;
  const f = classifyStem(q.stem);
  // v0.35.9 (爸爸反馈 + audit 发现): 原阈值 digitsMax<3 卡死 95% 题, EstimationGate 实际只触发 1.1%.
  // 放宽到 digitsMax<2 (即 ≥2 位数也触发). 配合 difficulty/operator 仍能挡掉小学一年级口算 1+2.
  if (f.digitsMax < 2) return false;
  // 2 位数 + 单步 + difficulty<3 仍偏简单, 不强制估算 (留给 speedMatch)
  if (f.digitsMax === 2 && f.opCount <= 1 && q.difficulty < 3) return false;
  // 应用题 (有故事 / 多步) 暂不触发 — 留 P0-3 MultiStepApplication 处理
  if (f.hasStory || f.hasMultiStep) return false;
  return true;
}

/**
 * Public — 题是否要走 Estimation Gate.
 * Flag off → 永远 false.
 * 显式 q.requiresEstimation 优先 (true/false 双向).
 * 检查每日 cap (8 道 / 天).
 */
export function requiresEstimation(q: Question, opts?: { skipDailyCapCheck?: boolean }): boolean {
  if (!isEstimationGateV1()) return false;
  // unsupported operator 即使 explicit true 也跳过 (GPT post-review: ÷/-/mixed v1 不支持)
  const op = detectMainOperator(q.stem);
  const opOk = op === "×" || op === "+";
  if (typeof q.requiresEstimation === "boolean") {
    if (!q.requiresEstimation) return false;
    if (!opOk) return false; // explicit true 但 operator 不支持 → 拒
    if (opts?.skipDailyCapCheck) return true;
    return !absoluteCapReached(); // explicit 受 absolute cap, 不受 heuristic cap
  }
  if (!requiresEstimationByHeuristic(q)) return false;
  if (opts?.skipDailyCapCheck) return true;
  return !dailyCapReached();
}

export { ABSOLUTE_DAILY_CAP };

/* ──────────────────── Daily cap ──────────────────── */

const DAILY_CAP = 8;
/**
 * 绝对上限 — 显式 q.requiresEstimation=true 的题也只能多触发到 12 次/天.
 * GPT + Gemini 共识 post-review: explicit true 也要受疲劳保护, 防止 AI / 出题人
 * 误标导致狂触发. heuristicCap=8 给 unknown 题, absoluteCap=12 是 hard ceiling.
 */
const ABSOLUTE_DAILY_CAP = 12;
const DAILY_CAP_LS_PREFIX = "est_gate_daily_";

function todayKey(): string {
  return DAILY_CAP_LS_PREFIX + new Date().toISOString().slice(0, 10);
}

export function dailyCapReached(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(todayKey());
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n >= DAILY_CAP;
  } catch {
    return false;
  }
}

/**
 * v0.34.99 post-review: hard ceiling 即使显式 true 也不能触发. 防 AI 狂标 abuse.
 */
export function absoluteCapReached(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(todayKey());
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n >= ABSOLUTE_DAILY_CAP;
  } catch {
    return false;
  }
}

export function incrementDailyCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const k = todayKey();
    const prev = Number(localStorage.getItem(k) ?? "0") || 0;
    const next = prev + 1;
    localStorage.setItem(k, String(next));
    return next;
  } catch {
    return 0;
  }
}

export function getDailyCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(todayKey()) ?? "0") || 0;
  } catch {
    return 0;
  }
}

export { DAILY_CAP };

/* ──────────────────── XP ──────────────────── */

/** 估算 XP (GPT 反馈降到 +12 总). 不参与 timeBonus / rank / accuracy. */
export const ESTIMATION_XP = {
  ROUND: 4,
  COMPUTE: 4,
  MAGNITUDE: 2,
  ALL_PERFECT_BONUS: 2,
} as const;
