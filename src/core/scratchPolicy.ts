/**
 * v0.35.0 (iter 34 P0-2): ScratchInsurance — 软锁草稿险.
 *
 * 起源: Selena 43% 期中事件 master plan P0-2.
 * Peer review 共识: 不强制 N 字符 (易反抗), 改"软锁/草稿险":
 *   - 用了草稿且答错 → XP 不扣 (insurance)
 *   - 选"心算确认" → 每日 3 次配额, 用完只能写草稿
 *   - 默认不选工具 = 默认放任 (跟现状一样)
 *
 * Feature flag: isScratchInsuranceV1() (default ON).
 */
import type { Question } from "./types";
import { isScratchInsuranceV1 } from "../lib/featureFlags";
import { classifyStem, isSpeedEligible } from "./speedMatchPolicy";
import { requiresEstimation } from "./estimationPolicy";
import { requiresMultiStep } from "./multiStepPolicy";

/* ──────────────────── Trigger heuristic ──────────────────── */

/**
 * Heuristic — 题是否提供 ScratchPanel.
 *
 * Peer review 修改: 提高门槛, 跟 EstimationGate 互斥避免双弹窗.
 *
 * 触发: (任一)
 *   - 数字最大 ≥ 3 位 (从 2 位提到 3 位, 防 "12+15" 也触发)
 *   - 多 operator (≥ 2 个)
 *   - 应用题 (story / multistep)
 *   - difficulty ≥ 3
 *
 * 互斥: 已经触发 EstimationGate 的题不再触发 Scratch (estimation 本身就是 working memory 卸载)
 */
export function requiresScratchByHeuristic(q: Question): boolean {
  if (q.answer.type !== "number") return false;
  if (isSpeedEligible(q)) return false;
  // 跟 EstimationGate 互斥 — 防止双弹窗 (Gemini + GPT 共识)
  if (requiresEstimation(q, { skipDailyCapCheck: true })) return false;
  // v0.35.1 iter 35 P0-3: 跟 MultiStepApplication 互斥 — 多步框架本身就是结构化思考, 不再加 toolbar
  if (requiresMultiStep(q)) return false;
  if (q.difficulty >= 3) return true;
  const f = classifyStem(q.stem);
  if (f.digitsMax >= 3) return true;
  if (f.opCount >= 2) return true;
  if (f.hasStory || f.hasMultiStep) return true;
  return false;
}

/**
 * Public — 题是否触发 ScratchPanel.
 * 显式 q.requiresScratch 优先 (true/false 双向).
 * Flag off → 永远 false.
 */
export function requiresScratch(q: Question): boolean {
  if (!isScratchInsuranceV1()) return false;
  if (typeof q.requiresScratch === "boolean") return q.requiresScratch;
  return requiresScratchByHeuristic(q);
}

/* ──────────────────── 心算配额 (3/天) ──────────────────── */

const MENTAL_QUOTA_PER_DAY = 3;
const QUOTA_LS_PREFIX = "scratch_mental_quota_";

function todayKey(): string {
  return QUOTA_LS_PREFIX + new Date().toISOString().slice(0, 10);
}

export function getMentalCalcRemaining(): number {
  if (typeof window === "undefined") return MENTAL_QUOTA_PER_DAY;
  try {
    const used = Number(localStorage.getItem(todayKey()) ?? "0") || 0;
    return Math.max(0, MENTAL_QUOTA_PER_DAY - used);
  } catch {
    return MENTAL_QUOTA_PER_DAY;
  }
}

export function canUseMentalCalc(): boolean {
  return getMentalCalcRemaining() > 0;
}

/**
 * 消耗一次心算配额. 返回剩余次数 (消耗后).
 */
export function useMentalCalcQuota(): number {
  if (typeof window === "undefined") return MENTAL_QUOTA_PER_DAY - 1;
  try {
    const k = todayKey();
    const used = Number(localStorage.getItem(k) ?? "0") || 0;
    const next = used + 1;
    localStorage.setItem(k, String(next));
    return Math.max(0, MENTAL_QUOTA_PER_DAY - next);
  } catch {
    return 0;
  }
}

export { MENTAL_QUOTA_PER_DAY };

/* ──────────────────── Scratch payload validation ──────────────────── */

/**
 * 判断用户的 scratch 输入是否"算数"  — 决定 insurance 是否激活.
 *
 * Pre-review 整合 (Gemini + GPT):
 *   - charCount ≥ 3 非空白 (Gemini "不要太严" + GPT "非空就行" 折中)
 *   - 必须含至少 1 个数字 或 1 个运算符 (Gemini 防"按一下空格刷")
 *   - 防 Selena 学会"写一个字母刷保险" — 草稿必须有"数学意图"
 *
 * 注: 不验"草稿对错" (10 岁孩子草稿有自己逻辑, 强行 LLM judge 易冤枉)
 *
 * v0.36.8 (爸爸 P0 "所有草稿不能 textarea"): 已废弃, 改用 isMeaningfulScratchStrokes.
 * 保留 signature 作为 historical 兼容 (老代码万一还引用).
 */
export function isMeaningfulScratch(textContent: string): boolean {
  const cleaned = (textContent ?? "").replace(/\s/g, "");
  if (cleaned.length < 3) return false;
  const hasDigitOrOp = /[\d+\-*/×÷=()]/.test(cleaned);
  return hasDigitOrOp;
}

/**
 * v0.36.8 (爸爸 P0): 用 canvas 笔画数判 insurance — textarea 已被淘汰.
 *
 * 跟 CanvasScratch.tsx hasWork 判定一致 (≥2 笔 = 列了式).
 * 1 笔可能是误触, 2 笔起算"真在列算式". 设这个门槛防孩子按一下笔刷保险.
 */
export function isMeaningfulScratchStrokes(strokeCount: number): boolean {
  return strokeCount >= 2;
}

/* ──────────────────── Scratch tool 类型 ──────────────────── */

/**
 * Peer review 共识简化: 2 button v1 (写草稿 vs 心算挑战), 不要 3 个.
 * 草稿模式内 v2 可加竖式底纹切换 (现在 textarea + grid bg 就够).
 *
 * post-review GPT: 区分 "直接答" (用户主动选了"继续直接答"绕过拦截)
 *  vs "心算挑战" (主动消耗配额) 在 telemetry 里 — 别混淆.
 */
export type ScratchTool = "scratch" | "mental_calc" | "direct_bypass" | "none";

/**
 * v0.35.0 post-review: 拦截 dialog 每 session 最多弹 1 次 (双家共识).
 * 用 sessionStorage 防天天弹反感.
 */
const INTERCEPT_SHOWN_KEY = "scratch_intercept_shown_session";

export function hasShownInterceptThisSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(INTERCEPT_SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markInterceptShown(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(INTERCEPT_SHOWN_KEY, "1");
  } catch { /* noop */ }
}

export interface ScratchPayload {
  tool: ScratchTool;
  textContent: string;
  /** 是否激活了 insurance (用了 free_text/vertical 且 isMeaningfulScratch) */
  insured: boolean;
  /** 是否消耗了心算配额 */
  mentalOverrideUsed: boolean;
  /** 文本字符数 (telemetry) */
  charCount: number;
}
