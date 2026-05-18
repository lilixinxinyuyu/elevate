/**
 * v0.35.7 (iter 41 P2-2): 模拟整卷成绩分析 — 数据聚合.
 *
 * 输入: session.id + attempts (caller 查 db)
 * 输出: ReportSummary (总分 / skill breakdown / 错题诊断 / 推荐)
 */
import type { Attempt, Question } from "./types";

export interface SkillBreakdownRow {
  label: string;
  icon: string;
  correct: number;
  total: number;
  /** 0-1 */
  rate: number;
}

export interface ErrorDiagnosis {
  category: string;
  count: number;
  /** 推荐去哪 (e.g. 进制小课堂) */
  recommendation: string;
  /** route to navigate */
  link?: string;
}

export interface MockReportSummary {
  totalCorrect: number;
  totalQuestions: number;
  scorePercent: number;
  /** 题型分组结果 */
  byCategory: SkillBreakdownRow[];
  /** 错题诊断 */
  diagnoses: ErrorDiagnosis[];
  /** session 完成时间 */
  finishedAt: number | null;
  /** 用时 (分钟, 可能 null 如果没数据) */
  totalMinutes: number | null;
}

/* ──────────────────── 题型分类 ──────────────────── */

type Category = "mental_calc" | "multi_digit_calc" | "word_problem" | "unit_conversion" | "geometry" | "other";

function classifyQuestion(q: Question): Category {
  // 应用题 (story + multi-step)
  if (q.word_problem_steps || (q.subquestions && q.subquestions.length > 0)) return "word_problem";
  // 几何 (有 dot_grid / shape skill 等)
  if (q.dot_grid || /shape|triangle|geometry|图形|三角|四边|面积/.test(q.skill_id ?? "")) return "geometry";
  // 单位换算
  if (/unit|conversion|换算|单位/.test(q.skill_id ?? "")) return "unit_conversion";
  // 简单速算 (1 step, ≤ 2 digit)
  const digits = (q.stem.match(/\d+/g) ?? []).reduce((m, n) => Math.max(m, n.length), 0);
  if (digits <= 2 && q.difficulty <= 2) return "mental_calc";
  // 多位计算
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

/* ──────────────────── 错题诊断 ──────────────────── */

interface MetadataView {
  estimationGate?: { magnitudeMismatch?: boolean };
  scratch?: { tool?: string; insured?: boolean };
  multiStep?: { phasePass?: boolean[] };
  source?: string;
}

function getMeta(a: Attempt): MetadataView {
  return (a.metadata as MetadataView | undefined) ?? {};
}

function diagnoseAttempt(a: Attempt, q?: Question): ErrorDiagnosis[] {
  if (a.isCorrect) return [];
  const diags: ErrorDiagnosis[] = [];
  const m = getMeta(a);

  // 估算 magnitude mismatch (评审 B P1-4 共识: ratio > 0)
  if (m.estimationGate?.magnitudeMismatch) {
    diags.push({
      category: "估算没用到",
      count: 1,
      recommendation: "🧠 进制小课堂 第 1 节 (10 进制) 复习数量级",
      link: "/math/base-systems",
    });
  }

  // 没用草稿 (直接 bypass 答错)
  if (m.scratch?.tool === "direct_bypass" || (m.scratch && !m.scratch.insured)) {
    diags.push({
      category: "没用草稿心算错",
      count: 1,
      recommendation: "✍️ 写草稿可以保 XP, 用 ScratchInsurance",
    });
  }

  // 4 步法没拆 (multi-step phase 错)
  if (m.multiStep?.phasePass) {
    const phases = m.multiStep.phasePass;
    if (!phases[2]) {
      diags.push({
        category: "算式列错",
        count: 1,
        recommendation: "📝 应用题 4 步法 — 列算式步骤",
      });
    } else if (!phases[3]) {
      diags.push({
        category: "答错单位",
        count: 1,
        recommendation: "📐 进制小课堂 — 单位换算",
        link: "/math/base-systems",
      });
    }
  }

  // 通用单位错 (skill 含 unit)
  if (q && /unit|conversion|换算|单位/.test(q.skill_id ?? "")) {
    diags.push({
      category: "单位换算错",
      count: 1,
      recommendation: "📐 进制小课堂",
      link: "/math/base-systems",
    });
  }

  return diags;
}

/* ──────────────────── 主聚合 ──────────────────── */

export function computeMockExamReport(
  attempts: Attempt[],
  questionsById: Map<string, Question>,
): MockReportSummary {
  // 仅取每题的 1st attempt (1 vs 2 in attemptOrdinal)
  const seenQ = new Set<string>();
  const firstAttempts: Attempt[] = [];
  for (const a of [...attempts].sort((x, y) => x.createdAt - y.createdAt)) {
    if (seenQ.has(a.questionId)) continue;
    seenQ.add(a.questionId);
    firstAttempts.push(a);
  }

  // 总分
  const totalCorrect = firstAttempts.filter((a) => a.isCorrect).length;
  const totalQuestions = firstAttempts.length;
  const scorePercent = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  // 题型 breakdown
  const categoryCounts: Record<Category, { correct: number; total: number }> = {
    mental_calc: { correct: 0, total: 0 },
    multi_digit_calc: { correct: 0, total: 0 },
    word_problem: { correct: 0, total: 0 },
    unit_conversion: { correct: 0, total: 0 },
    geometry: { correct: 0, total: 0 },
    other: { correct: 0, total: 0 },
  };
  for (const a of firstAttempts) {
    const q = questionsById.get(a.questionId);
    if (!q) continue;
    const cat = classifyQuestion(q);
    categoryCounts[cat].total += 1;
    if (a.isCorrect) categoryCounts[cat].correct += 1;
  }
  const byCategory: SkillBreakdownRow[] = (Object.keys(categoryCounts) as Category[])
    .filter((c) => categoryCounts[c].total > 0)
    .map((c) => ({
      label: CATEGORY_META[c].label,
      icon: CATEGORY_META[c].icon,
      correct: categoryCounts[c].correct,
      total: categoryCounts[c].total,
      rate: categoryCounts[c].total > 0 ? categoryCounts[c].correct / categoryCounts[c].total : 0,
    }));

  // 错题诊断 (按 category 合并 count)
  const diagMap = new Map<string, ErrorDiagnosis>();
  for (const a of firstAttempts) {
    if (a.isCorrect) continue;
    const q = questionsById.get(a.questionId);
    const diags = diagnoseAttempt(a, q);
    for (const d of diags) {
      const existing = diagMap.get(d.category);
      if (existing) {
        existing.count += 1;
      } else {
        diagMap.set(d.category, { ...d });
      }
    }
  }
  // 评审 B 共识阈值: count ≥ 2 才显示, 高风险类型 (没用草稿 / 单位混) count=1 也显示
  const HIGH_RISK_KEYWORDS = ["草稿", "单位", "跳步"];
  const isHighRisk = (cat: string) => HIGH_RISK_KEYWORDS.some((k) => cat.includes(k));
  const diagnoses = [...diagMap.values()]
    .filter((d) => d.count >= 2 || isHighRisk(d.category))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3); // 评审 B 共识: Top 3 only, 防满屏警告

  // 用时
  const minTs = Math.min(...firstAttempts.map((a) => a.createdAt));
  const maxTs = Math.max(...firstAttempts.map((a) => a.createdAt));
  const totalMinutes = firstAttempts.length > 0 ? Math.round((maxTs - minTs) / 60000) : null;

  return {
    totalCorrect,
    totalQuestions,
    scorePercent,
    byCategory,
    diagnoses,
    finishedAt: firstAttempts.length > 0 ? maxTs : null,
    totalMinutes,
  };
}
