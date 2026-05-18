/**
 * v0.35.6 (iter 40 P2-1): 稳准挑战 policy.
 *
 * Selena 43% master plan P2-1. 原名 SniperMode (AUP 改名).
 * 自愿模式 - Selena 主动开启. 进入后:
 *   - 答对 + ratio < 0.5 → -5 XP "太冲了"
 *   - 答对 + ratio ∈ [0.5, 1.5) → 0 XP (中性)
 *   - 答对 + ratio ≥ 1.5 → +20 XP "稳准 bonus"
 *   - 答错 → 跟主流一样 (依赖 scoreAttempt 已有逻辑)
 *
 * 关键: sessionStorage flag, 关 tab 即关. 不存 localStorage (防误开).
 */

const SESSION_KEY = "steady_aim_active";

export function isSteadyAimActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function activateSteadyAim(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch { /* noop */ }
}

export function deactivateSteadyAim(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch { /* noop */ }
}

/* ──────────────────── XP 公式 ──────────────────── */

/**
 * 评审 B 共识降到 +15 (从 +20), 等数据证明不被 farm 再升.
 * 评审 B 共识: 首次太快只警告不扣 (sessionStorage 计数), 第二次起 -5.
 * 评审 B 共识: 每日 bonus cap 5 次 (防发呆刷 +15).
 */
export const STEADY_AIM_XP = {
  TOO_FAST_PENALTY: -5,
  DEEP_THINK_BONUS: 15,
  DAILY_BONUS_CAP: 5,
} as const;

export type SteadyAimTier = "too_fast" | "normal" | "deliberate" | "deep_think" | "afk";

/**
 * 稳准挑战模式下的速度评分.
 *
 *   ratio < 0.5  → 首次 0 (警告), 第 2+ 次 -5  "太冲了" — 评审 B 防止首次就 rage quit
 *   ratio < 1.0  →  0  (中性)
 *   ratio < 1.5  →  0  "在思考"
 *   ratio ∈ [1.5, 4.0] + 今日 bonus cap 内 → +15  "🎯 稳准" — daily cap 5 防发呆刷
 *   ratio > 4.0  →  0  (anti-AFK)
 *
 * 注: 只在 isCorrect=true 时算. 错答走主流 scoring 不变.
 */
export function getSteadyAimXp(
  elapsedSeconds: number,
  estimatedSeconds: number,
  isCorrect: boolean,
): { bonus: number; tier: SteadyAimTier; warning?: string } {
  if (!isCorrect) return { bonus: 0, tier: "normal" };
  const ratio = elapsedSeconds / Math.max(1, estimatedSeconds);
  if (ratio < 0.5) {
    // 评审 B 共识: 首次免扣
    const fastCount = getFastCountToday();
    if (fastCount === 0) {
      incrementFastCount();
      return { bonus: 0, tier: "too_fast", warning: "🚓 这是免费警告, 下次太快真扣 -5 哦" };
    }
    incrementFastCount();
    return { bonus: STEADY_AIM_XP.TOO_FAST_PENALTY, tier: "too_fast" };
  }
  if (ratio < 1.0) return { bonus: 0, tier: "normal" };
  if (ratio < 1.5) return { bonus: 0, tier: "deliberate" };
  if (ratio <= 4.0) {
    // 评审 B 共识: 每日 bonus cap, 防发呆刷分
    const bonusCount = getBonusCountToday();
    if (bonusCount >= STEADY_AIM_XP.DAILY_BONUS_CAP) {
      return { bonus: 0, tier: "deep_think", warning: `今日 +${STEADY_AIM_XP.DEEP_THINK_BONUS} bonus 已达 ${STEADY_AIM_XP.DAILY_BONUS_CAP} 次上限, 明天再来` };
    }
    incrementBonusCount();
    return { bonus: STEADY_AIM_XP.DEEP_THINK_BONUS, tier: "deep_think" };
  }
  return { bonus: 0, tier: "afk" };
}

/* ──────────────────── Daily counters ──────────────────── */

const FAST_COUNT_PREFIX = "steady_fast_count_";
const BONUS_COUNT_PREFIX = "steady_bonus_count_";

function todayKey(prefix: string): string {
  return prefix + new Date().toISOString().slice(0, 10);
}

function getFastCountToday(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(todayKey(FAST_COUNT_PREFIX)) ?? "0") || 0;
  } catch { return 0; }
}

function incrementFastCount(): void {
  if (typeof window === "undefined") return;
  try {
    const k = todayKey(FAST_COUNT_PREFIX);
    localStorage.setItem(k, String(getFastCountToday() + 1));
  } catch { /* noop */ }
}

function getBonusCountToday(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(todayKey(BONUS_COUNT_PREFIX)) ?? "0") || 0;
  } catch { return 0; }
}

function incrementBonusCount(): void {
  if (typeof window === "undefined") return;
  try {
    const k = todayKey(BONUS_COUNT_PREFIX);
    localStorage.setItem(k, String(getBonusCountToday() + 1));
  } catch { /* noop */ }
}

export function getSteadyAimDailyCounters(): { fast: number; bonus: number; bonusCap: number } {
  return { fast: getFastCountToday(), bonus: getBonusCountToday(), bonusCap: STEADY_AIM_XP.DAILY_BONUS_CAP };
}

/* ──────────────────── 首次开启 (上线 onboard) ──────────────────── */

const FIRST_TIME_KEY = "steady_aim_seen_intro_v1";

export function hasSeenSteadyAimIntro(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(FIRST_TIME_KEY) === "1";
  } catch {
    return true;
  }
}

export function markSteadyAimIntroSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FIRST_TIME_KEY, "1");
  } catch { /* noop */ }
}

/* ──────────────────── Session 内统计 (banner 显示用) ──────────────────── */

const STATS_KEY = "steady_aim_stats";

export interface SteadyAimStats {
  fastWrongs: number;       // -5 触发次数 (答太快)
  steadyHits: number;       // +20 触发次数 (稳准)
  totalSessionBonus: number; // 累计 net (could be negative)
}

export function loadSteadyAimStats(): SteadyAimStats {
  if (typeof window === "undefined") return { fastWrongs: 0, steadyHits: 0, totalSessionBonus: 0 };
  try {
    const raw = sessionStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : { fastWrongs: 0, steadyHits: 0, totalSessionBonus: 0 };
  } catch {
    return { fastWrongs: 0, steadyHits: 0, totalSessionBonus: 0 };
  }
}

export function recordSteadyAimEvent(tier: SteadyAimTier, xpDelta: number): SteadyAimStats {
  if (typeof window === "undefined") return loadSteadyAimStats();
  const cur = loadSteadyAimStats();
  const next: SteadyAimStats = {
    fastWrongs: cur.fastWrongs + (tier === "too_fast" ? 1 : 0),
    steadyHits: cur.steadyHits + (tier === "deep_think" ? 1 : 0),
    totalSessionBonus: cur.totalSessionBonus + xpDelta,
  };
  try {
    sessionStorage.setItem(STATS_KEY, JSON.stringify(next));
  } catch { /* noop */ }
  return next;
}

export function resetSteadyAimStats(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STATS_KEY);
  } catch { /* noop */ }
}
