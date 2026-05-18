/**
 * v0.35.10 (爸爸反馈): 期末备考 dashboard 数据聚合.
 *
 * 输入: 所有 attempts (db.attempts) + sessions (db.sessions) + mastery (db.mastery)
 * 输出:
 *   - 历史 mock_exam sessions (按时间序, 每次的分数 / 时长 / 用时 / 题型 distribution)
 *   - 错题类型 trend (近 4 周, 按 category 分组计数)
 *   - 弱点 skill (mastery 排序 bottom 3-5)
 *   - 小进姐姐 advice (基于 top error category canned text)
 *
 * 复用 computeMockExamReport 算每次模拟成绩, 然后聚合趋势.
 */
import type { Attempt, DailySession, MasteryScore, Question } from "./types";
import { computeMasteryScore } from "./mastery";
import { SKILLS } from "../content/skills";

export interface MockHistoryEntry {
  sessionId: string;
  dateKey: string;
  finishedAt: number;
  totalQuestions: number;
  totalCorrect: number;
  scorePercent: number;
  totalMinutes: number | null;
}

export interface ErrorCategoryTrend {
  category: string;
  icon: string;
  /** 最近 4 周, 每周错的题数 (按时间正序) */
  weeklyCounts: number[];
  totalRecent: number;
}

export interface WeaknessSkill {
  skillId: string;
  skillName: string;
  masteryScore: number; // 0-100
  fragile: boolean;
  recentAttempts: number;
}

export interface XiaojinAdvice {
  topProblem: string;
  message: string;
  recommendedActionLabel: string;
  recommendedRoute?: string;
}

export interface ExamPrepSnapshot {
  history: MockHistoryEntry[];
  trendDeltaPercent: number | null; // 最近一次 - 最早一次 (差 X%)
  errorTrends: ErrorCategoryTrend[];
  weaknesses: WeaknessSkill[];
  advice: XiaojinAdvice;
  totalMockExams: number;
  /** 推荐题数 (基于 mastery 平均) */
  recommendedSize: 30 | 60 | 80;
}

/* ──────────────────── 历史 mock_exam ──────────────────── */

export function buildMockHistory(
  sessions: DailySession[],
  attempts: Attempt[],
  questionsById: Map<string, Question>,
): MockHistoryEntry[] {
  const mockSessions = sessions.filter((s) => s.mode === "mock_exam");
  const entries: MockHistoryEntry[] = [];
  for (const s of mockSessions) {
    const sessionAttempts = attempts.filter((a) => a.sessionId === s.id);
    if (sessionAttempts.length === 0) continue;
    // 第一次 attempt per question
    const seen = new Set<string>();
    const first: Attempt[] = [];
    for (const a of [...sessionAttempts].sort((x, y) => x.createdAt - y.createdAt)) {
      if (seen.has(a.questionId)) continue;
      seen.add(a.questionId);
      first.push(a);
    }
    if (first.length === 0) continue;
    const totalCorrect = first.filter((a) => a.isCorrect).length;
    const totalQuestions = first.length;
    const scorePercent = Math.round((totalCorrect / totalQuestions) * 100);
    const finishedAt = Math.max(...first.map((a) => a.createdAt));
    const startedAt = Math.min(...first.map((a) => a.createdAt));
    const totalMinutes = totalQuestions > 1 ? Math.round((finishedAt - startedAt) / 60000) : null;
    entries.push({
      sessionId: s.id,
      dateKey: s.dateKey,
      finishedAt,
      totalQuestions,
      totalCorrect,
      scorePercent,
      totalMinutes,
    });
  }
  return entries.sort((a, b) => b.finishedAt - a.finishedAt); // 最新在前
}

/* ──────────────────── 错题类型 4 周趋势 ──────────────────── */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Category = "mental_calc" | "multi_digit_calc" | "word_problem" | "unit_conversion" | "geometry" | "other";

function classifyForCategory(q: Question | undefined): Category {
  if (!q) return "other";
  if (q.word_problem_steps || (q.subquestions && q.subquestions.length > 0)) return "word_problem";
  if (q.dot_grid || /shape|triangle|geometry|图形|三角|四边|面积/.test(q.skill_id ?? "")) return "geometry";
  if (/unit|conversion|换算|单位/.test(q.skill_id ?? "")) return "unit_conversion";
  const digits = (q.stem.match(/\d+/g) ?? []).reduce((m, n) => Math.max(m, n.length), 0);
  if (digits <= 2 && q.difficulty <= 2) return "mental_calc";
  if (digits >= 3) return "multi_digit_calc";
  return "other";
}

const CATEGORY_META: Record<Category, { label: string; icon: string }> = {
  mental_calc: { label: "口算", icon: "🧮" },
  multi_digit_calc: { label: "多位计算", icon: "✏️" },
  word_problem: { label: "应用题", icon: "📝" },
  unit_conversion: { label: "单位换算", icon: "📐" },
  geometry: { label: "几何", icon: "📊" },
  other: { label: "其它", icon: "❓" },
};

export function buildErrorTrends(
  attempts: Attempt[],
  questionsById: Map<string, Question>,
  now: number = Date.now(),
): ErrorCategoryTrend[] {
  // 近 4 周, 每周一桶
  const buckets: Record<Category, number[]> = {
    mental_calc: [0, 0, 0, 0],
    multi_digit_calc: [0, 0, 0, 0],
    word_problem: [0, 0, 0, 0],
    unit_conversion: [0, 0, 0, 0],
    geometry: [0, 0, 0, 0],
    other: [0, 0, 0, 0],
  };
  const fourWeeksAgo = now - 4 * WEEK_MS;
  for (const a of attempts) {
    if (a.isCorrect) continue;
    if (a.createdAt < fourWeeksAgo) continue;
    // 排除 mistake_hunt etc 来源
    const source = (a.metadata as Record<string, unknown> | undefined)?.source;
    if (source && source !== "main_train") continue;
    const weekIdx = Math.min(3, Math.floor((now - a.createdAt) / WEEK_MS));
    const reverseIdx = 3 - weekIdx; // 0 = 最早周, 3 = 本周
    const q = questionsById.get(a.questionId);
    const cat = classifyForCategory(q);
    buckets[cat][reverseIdx]! += 1;
  }
  return (Object.keys(buckets) as Category[])
    .map((c) => ({
      category: CATEGORY_META[c].label,
      icon: CATEGORY_META[c].icon,
      weeklyCounts: buckets[c],
      totalRecent: buckets[c].reduce((s, n) => s + n, 0),
    }))
    .filter((t) => t.totalRecent > 0)
    .sort((a, b) => b.totalRecent - a.totalRecent);
}

/* ──────────────────── 弱点 skill ──────────────────── */

export function buildWeaknesses(
  mastery: MasteryScore[],
  topN: number = 3,
  now: number = Date.now(),
): WeaknessSkill[] {
  const skillNameById = new Map(SKILLS.map((s) => [s.id, s.name]));
  // 用 computeMasteryScore 算 fragile + 综合 score (mastery 行本身不持久化 fragile)
  const enriched = mastery
    .filter((m) => (m.recent?.length ?? 0) >= 3)
    .map((m) => {
      const r = computeMasteryScore({
        recent: m.recent ?? [],
        studentElo: m.studentElo ?? 1200,
        attemptsCount: m.attemptsCount,
        lastSuccessAt: m.lastSuccessAt,
        now,
      });
      return {
        skillId: m.skillId,
        skillName: skillNameById.get(m.skillId) ?? m.skillId,
        masteryScore: r.score,
        fragile: r.fragile,
        recentAttempts: m.recent?.length ?? 0,
      };
    });
  return enriched
    .sort((a, b) => {
      if (a.fragile !== b.fragile) return a.fragile ? -1 : 1;
      return a.masteryScore - b.masteryScore;
    })
    .slice(0, topN);
}

/* ──────────────────── 小进姐姐指导 (canned by top error) ──────────────────── */

export function buildXiaojinAdvice(errorTrends: ErrorCategoryTrend[]): XiaojinAdvice {
  if (errorTrends.length === 0) {
    return {
      topProblem: "暂无近期错题",
      message: "最近几周错题很少, 继续保持! 可以做 1 份模拟卷自我检验.",
      recommendedActionLabel: "做模拟卷",
    };
  }
  const top = errorTrends[0]!;
  switch (top.icon) {
    case "🧮":
      return {
        topProblem: "口算错较多",
        message: "口算题虽简单但易粗心. 建议: 慢一点, 看清运算符. 巧算工具箱里的 8 个秘技能帮.",
        recommendedActionLabel: "去巧算工具箱",
        recommendedRoute: "/math/tricks",
      };
    case "✏️":
      return {
        topProblem: "多位数计算错较多",
        message: "进位 / 退位 / 抄错号是大头. 复杂题先用估算 (估算门会触发) + 写草稿验算. 进位漏可以去错题侦探训练眼力.",
        recommendedActionLabel: "去错题侦探练眼力",
        recommendedRoute: "/math/find-mistakes",
      };
    case "📝":
      return {
        topProblem: "应用题错较多",
        message: "应用题要先列算式, 不要跳到答案. 多步法 4 步框架 (已知 / 求 / 算式 / 答) 强制你拆步.",
        recommendedActionLabel: "做几道应用题",
        recommendedRoute: "/math/train",
      };
    case "📐":
      return {
        topProblem: "单位换算错较多",
        message: "单位换算是 10 进制 vs 60 进制混淆. 进制小课堂 4 节专门讲清.",
        recommendedActionLabel: "去进制小课堂",
        recommendedRoute: "/math/base-systems",
      };
    case "📊":
      return {
        topProblem: "几何 / 图形错较多",
        message: "几何题需要先画 / 数 / 量. 慢一点, 看仔细图. 单位也别忘 (cm vs cm²).",
        recommendedActionLabel: "做几道几何题",
        recommendedRoute: "/math/train",
      };
    default:
      return {
        topProblem: top.category + "错较多",
        message: `近期 ${top.category} 错了 ${top.totalRecent} 题, 多练几道同类题强化.`,
        recommendedActionLabel: "去强化挑战",
      };
  }
}

/* ──────────────────── 推荐题数 (基于 mastery 平均) ──────────────────── */

export function recommendMockSize(mastery: MasteryScore[], now: number = Date.now()): 30 | 60 | 80 {
  if (mastery.length === 0) return 30;
  // 用 computeMasteryScore 算的综合 score, 不要直接读 m.score (老字段, 可能未刷新)
  const scores = mastery
    .filter((m) => (m.recent?.length ?? 0) > 0)
    .map((m) => computeMasteryScore({
      recent: m.recent ?? [],
      studentElo: m.studentElo ?? 1200,
      attemptsCount: m.attemptsCount,
      lastSuccessAt: m.lastSuccessAt,
      now,
    }).score);
  if (scores.length === 0) return 30;
  const avg = scores.reduce((s, n) => s + n, 0) / scores.length;
  if (avg < 50) return 30; // 弱, 短卷
  if (avg < 75) return 60; // 中, 期中规格
  return 80;               // 强, 完整期末
}

/* ──────────────────── 趋势 delta ──────────────────── */

export function computeTrendDelta(history: MockHistoryEntry[]): number | null {
  if (history.length < 2) return null;
  const latest = history[0]!;
  const earliest = history[history.length - 1]!;
  return latest.scorePercent - earliest.scorePercent;
}

/* ──────────────────── 主聚合入口 ──────────────────── */

export function computeExamPrep(
  sessions: DailySession[],
  attempts: Attempt[],
  questionsById: Map<string, Question>,
  mastery: MasteryScore[],
  now: number = Date.now(),
): ExamPrepSnapshot {
  const history = buildMockHistory(sessions, attempts, questionsById);
  const errorTrends = buildErrorTrends(attempts, questionsById, now);
  const weaknesses = buildWeaknesses(mastery, 3, now);
  const advice = buildXiaojinAdvice(errorTrends);
  return {
    history,
    trendDeltaPercent: computeTrendDelta(history),
    errorTrends,
    weaknesses,
    advice,
    totalMockExams: history.length,
    recommendedSize: recommendMockSize(mastery, now),
  };
}
