/**
 * v0.35.5 (iter 39 P1-4): 脑力雷达 — 数据聚合.
 *
 * 从 attempt.metadata + localStorage 聚合 5 个维度数据给 dashboard 显示.
 * 不修改 attempt schema — 复用 iter 33/34/35/37 已经写的 metadata.
 */
import type { Attempt } from "./types";
import { areAllLessonsComplete, BASE_SYSTEM_LESSONS, isLessonComplete } from "./baseSystemContent";

/* ──────────────────── Dimension Types ──────────────────── */

export type RadarDimensionId =
  | "estimation"    // 直觉力 - 估算命中率
  | "scratch"       // 严谨力 - 草稿使用率
  | "multiStep"     // 拆解力 - 4 步全对率
  | "strengthen"    // 专项力 - 强化全对率
  | "baseSystem";   // 框架力 - 进制小课堂完成率

export interface RadarDimension {
  id: RadarDimensionId;
  /** 中文名 */
  name: string;
  /** Emoji icon */
  icon: string;
  /** 描述 (鼠标 hover 或卡片下方) */
  description: string;
  /** 0-1 (后面 UI 转 %) */
  value: number;
  /** 分子 (做对/激活 的数) */
  numerator: number;
  /** 分母 (触发/总 的数) */
  denominator: number;
  /** 文字说明 (e.g., "10 次估算, 5 次数量级对") */
  detail: string;
}

export interface RadarSnapshot {
  /** 时间窗口标记 (week/month/all) */
  window: TimeWindow;
  /** 5 维度 */
  dimensions: RadarDimension[];
  /** 触发总题数 (各维度去重前的样本量) */
  totalSampledAttempts: number;
}

export type TimeWindow = "week" | "month" | "all";

/* ──────────────────── Time filtering ──────────────────── */

function filterByWindow(attempts: Attempt[], window: TimeWindow): Attempt[] {
  if (window === "all") return attempts;
  const cutoff = Date.now() - (window === "week" ? 7 : 30) * 24 * 60 * 60 * 1000;
  return attempts.filter((a) => a.createdAt >= cutoff);
}

/* ──────────────────── Aggregation ──────────────────── */

/** 评审 B 共识: 本周样本少时回退到"最近 N 次" (防 1/1 = 100% 误导) */
const MIN_SAMPLE_FOR_WEEK = 10;
const RECENT_N_FALLBACK = 20;

/**
 * 主入口: 从 attempts 数组算 5 维度 + 进度数据.
 *
 * 评审整合:
 *  - 评审 A: source filter 必须排除 mistake_hunt (避免污染主线统计)
 *  - 评审 B: 本周样本少 → fallback "最近 N 次"
 *  - 评审 B: 框架力不参与时间筛选 (localStorage 不带 timestamp)
 *
 * @param attempts 所有 attempt (caller 从 db.attempts 取)
 * @param window 时间窗口 (week/month/all)
 */
export function computeBrainpowerRadar(attempts: Attempt[], window: TimeWindow = "week"): RadarSnapshot {
  // source filter: 排除 mini-game attempts (mistake_hunt 等)
  const mainAttempts = attempts.filter(isMainTrainAttempt);
  let filtered = filterByWindow(mainAttempts, window);

  // 评审 B 共识: 本周样本太少 fallback "最近 N 次"
  if (window === "week" && filtered.length < MIN_SAMPLE_FOR_WEEK && mainAttempts.length >= MIN_SAMPLE_FOR_WEEK) {
    filtered = [...mainAttempts]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, RECENT_N_FALLBACK);
  }

  const dimensions: RadarDimension[] = [
    computeEstimationDimension(filtered),
    computeScratchDimension(filtered),
    computeMultiStepDimension(filtered),
    computeStrengthenDimension(filtered),
    computeBaseSystemDimension(), // 不受时间筛选影响
  ];

  return {
    window,
    dimensions,
    totalSampledAttempts: filtered.length,
  };
}

function computeEstimationDimension(attempts: Attempt[]): RadarDimension {
  const withEst = attempts.filter((a) => {
    const meta = (a.metadata as Record<string, unknown> | undefined)?.estimationGate;
    return meta && typeof meta === "object";
  });
  const hit = withEst.filter((a) => {
    const meta = (a.metadata as any).estimationGate;
    return !meta.magnitudeMismatch;
  });
  // 评审共识: 分母 0 不显示 0%, 给"去激活" CTA
  const value = withEst.length > 0 ? hit.length / withEst.length : 0;
  return {
    id: "estimation",
    name: "直觉力 | 先猜个大概",
    icon: "🧠",
    description: "估算数量级命中率",
    value,
    numerator: hit.length,
    denominator: withEst.length,
    detail: withEst.length === 0
      ? "🎯 去做几道多位数计算 → 触发估算"
      : `${withEst.length} 次估算, ${hit.length} 次数量级对`,
  };
}

function computeScratchDimension(attempts: Attempt[]): RadarDimension {
  const triggered = attempts.filter((a) => {
    const meta = (a.metadata as Record<string, unknown> | undefined)?.scratch;
    return meta && typeof meta === "object";
  });
  const usedScratch = triggered.filter((a) => {
    const meta = (a.metadata as any).scratch;
    return meta.insured === true;
  });
  const value = triggered.length > 0 ? usedScratch.length / triggered.length : 0;
  return {
    id: "scratch",
    name: "严谨力 | 细节不出错",
    icon: "✍️",
    description: "草稿险使用率",
    value,
    numerator: usedScratch.length,
    denominator: triggered.length,
    detail: triggered.length === 0
      ? "🎯 复杂题用草稿险, 答错也不扣分"
      : `用了草稿 ${usedScratch.length} / ${triggered.length} 次`,
  };
}

function computeMultiStepDimension(attempts: Attempt[]): RadarDimension {
  const multiStepAttempts = attempts.filter((a) => {
    const meta = (a.metadata as Record<string, unknown> | undefined)?.multiStep;
    return meta && typeof meta === "object";
  });
  const allCorrect = multiStepAttempts.filter((a) => {
    const meta = (a.metadata as any).multiStep;
    return Array.isArray(meta.phasePass) && meta.phasePass.every((p: boolean) => p);
  });
  const value = multiStepAttempts.length > 0 ? allCorrect.length / multiStepAttempts.length : 0;
  return {
    id: "multiStep",
    name: "拆解力 | 复杂变简单",
    icon: "📋",
    description: "应用题 4 步法全对率",
    value,
    numerator: allCorrect.length,
    denominator: multiStepAttempts.length,
    detail: multiStepAttempts.length === 0
      ? "🎯 多做几道应用题 → 触发 4 步法"
      : `多步题 ${multiStepAttempts.length} 道, ${allCorrect.length} 道 4 步全对`,
  };
}

function computeStrengthenDimension(attempts: Attempt[]): RadarDimension {
  // 统计独立的 strengthen sessions
  const sessionIds = new Set<string>();
  const sessionPerfect = new Map<string, boolean>();
  for (const a of attempts) {
    const meta = (a.metadata as any)?.strengthenSessionId;
    if (typeof meta === "string") {
      sessionIds.add(meta);
      // 同一 session 内最后一题有 strengthenCorrectCount + Total
      const cc = (a.metadata as any).strengthenCorrectCount;
      const tt = (a.metadata as any).strengthenTotalQuestions;
      if (typeof cc === "number" && typeof tt === "number") {
        sessionPerfect.set(meta, cc === tt);
      }
    }
  }
  const total = sessionIds.size;
  const perfect = [...sessionPerfect.values()].filter(Boolean).length;
  const value = total > 0 ? perfect / total : 0;
  return {
    id: "strengthen",
    name: "专项力 | 同类题不再错",
    icon: "🎯",
    description: "强化挑战全对率",
    value,
    numerator: perfect,
    denominator: total,
    detail: total === 0
      ? "🎯 错题后接受强化挑战 → 加练 3 题"
      : `强化 ${total} 次, ${perfect} 次全对`,
  };
}

function computeBaseSystemDimension(): RadarDimension {
  const totalLessons = BASE_SYSTEM_LESSONS.length;
  const completed = BASE_SYSTEM_LESSONS.filter((l) => isLessonComplete(l.id)).length;
  const value = totalLessons > 0 ? completed / totalLessons : 0;
  const allDone = areAllLessonsComplete();
  return {
    id: "baseSystem",
    name: "框架力 | 知识连成网",
    icon: "📐",
    description: "进制小课堂完成度 (不受时间筛选影响, 累计)",
    value,
    numerator: completed,
    denominator: totalLessons,
    detail: allDone
      ? "🏆 进制小专家! 4 节全部完成"
      : completed === 0
        ? "🎯 去进制小课堂学第 1 节"
        : `进度 ${completed} / ${totalLessons} 节`,
  };
}

/* ──────────────────── Source filter helper ──────────────────── */

/** 过滤 attempt by source (mistake_hunt 等 mini-game 应该排除主统计) */
export function isMainTrainAttempt(a: Attempt): boolean {
  const source = (a.metadata as Record<string, unknown> | undefined)?.source;
  return source !== "mistake_hunt" && source !== "base_system_lesson";
}

/* ──────────────────── Trend ──────────────────── */

/** 跟上一个时间窗口对比, 返回趋势文字 */
export function dimensionTrend(current: RadarDimension, previous: RadarDimension | undefined): string {
  if (!previous || previous.denominator === 0) return "";
  const delta = (current.value - previous.value) * 100;
  if (Math.abs(delta) < 2) return "≈ 持平";
  if (delta > 0) return `↑ +${delta.toFixed(0)}%`;
  return `↓ ${delta.toFixed(0)}%`;
}
