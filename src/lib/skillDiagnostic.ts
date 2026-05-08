/**
 * v0.31.52: Selena 学情 + 题库诊断的合并视图。
 *
 * 出题工作台需要：哪个 skill 题量少 / 哪个 Selena 薄弱 / 哪些是期末重点 / 题库审计有多少问题。
 * 旧版 Selena 学情和题库诊断分两个面板，决策时来回切看很别扭。
 *
 * 这个 helper 一次性聚合 → 一张表展示。
 */
import type { Attempt, ExamPriority, MasteryScore, Question, Term } from "../core/types";
import { SKILLS } from "../content/skills";
import { UNITS } from "../content/units";
import { auditQuestion } from "./questionAuditLite";

const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.id, s]));
const UNIT_BY_ID = new Map(UNITS.map((u) => [u.id, u]));

/** 期末重要度排序权重（高 = 越靠前） */
const EXAM_PRIORITY_RANK: Record<ExamPriority, number> = {
  MUST_BIG: 9,
  HIGH_BIG: 8,
  MUST_SMALL: 7,
  VERY_HIGH_SMALL: 6,
  HIGH_SMALL: 5,
  NORMAL: 4,
  LOW_SMALL: 2,
  LOW: 1,
  EXTENSION: 0,
};

export function examPriorityRank(p: ExamPriority): number {
  return EXAM_PRIORITY_RANK[p] ?? 0;
}

export interface SkillRow {
  skillId: string;
  skillName: string;
  unitId: string;
  unitName: string;
  term: Term;
  examPriority: ExamPriority;
  /** 期末重要度排名（高=重要） */
  priorityRank: number;
  // === 题库侧 ===
  totalCount: number;
  seedCount: number;
  aiCount: number;
  /** 审计 critical / likely-broken / minor 数 */
  auditCritical: number;
  auditLikelyBroken: number;
  auditMinor: number;
  // === Selena 学情侧 ===
  /** 0-100 mastery score，0 = 没练过 */
  mastery: number;
  attemptsCount: number;
  /** 0-1，没作答时为 NaN */
  accuracy: number;
  /** mastery < 60 且做了 ≥3 题 = 薄弱 */
  isWeak: boolean;
  /** 题量低 (< 8 道) 标缺货 */
  isLowStock: boolean;
}

/**
 * 主聚合函数 — 给 admin 表格用。
 *
 * @param questions 全量 db.questions
 * @param attempts 全量 db.attempts（Selena 全部学期）
 * @param mastery 全量 db.mastery（Selena 全部学期）
 * @param termFilter 上册/下册/null（null=全部）
 */
export function buildSkillRows(
  questions: Question[],
  attempts: Attempt[],
  mastery: MasteryScore[],
  termFilter: Term | null = null,
): SkillRow[] {
  // 索引化：按 skill 分桶
  const questionsBySkill = new Map<string, Question[]>();
  for (const q of questions) {
    if (!q.skill_id) continue;
    const arr = questionsBySkill.get(q.skill_id) ?? [];
    arr.push(q);
    questionsBySkill.set(q.skill_id, arr);
  }

  const attemptsBySkill = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (!a.skillId) continue;
    const arr = attemptsBySkill.get(a.skillId) ?? [];
    arr.push(a);
    attemptsBySkill.set(a.skillId, arr);
  }

  const masteryBySkill = new Map<string, MasteryScore>();
  for (const m of mastery) {
    masteryBySkill.set(m.skillId, m);
  }

  const rows: SkillRow[] = [];
  for (const skill of SKILLS) {
    const unit = UNIT_BY_ID.get(skill.unitId);
    if (!unit) continue;
    if (termFilter && unit.term !== termFilter) continue;

    const skillQs = questionsBySkill.get(skill.id) ?? [];
    let aiCount = 0;
    let seedCount = 0;
    let auditCritical = 0;
    let auditLikelyBroken = 0;
    let auditMinor = 0;
    for (const q of skillQs) {
      const isAi =
        (q.tags ?? []).includes("ai_generated") || (q.question_id ?? "").startsWith("AI_");
      if (isAi) aiCount++;
      else seedCount++;
      const a = auditQuestion(q);
      if (a.worstSeverity === "critical") auditCritical++;
      else if (a.worstSeverity === "likely-broken") auditLikelyBroken++;
      else if (a.worstSeverity === "minor") auditMinor++;
    }

    const skillAttempts = attemptsBySkill.get(skill.id) ?? [];
    const correct = skillAttempts.filter((a) => a.isCorrect).length;
    const accuracy =
      skillAttempts.length > 0 ? correct / skillAttempts.length : Number.NaN;
    const masteryScore = masteryBySkill.get(skill.id)?.score ?? 0;
    const isWeak = skillAttempts.length >= 3 && masteryScore < 60;
    const isLowStock = skillQs.length < 8;

    rows.push({
      skillId: skill.id,
      skillName: skill.name,
      unitId: skill.unitId,
      unitName: unit.name,
      term: unit.term,
      examPriority: skill.examPriority,
      priorityRank: examPriorityRank(skill.examPriority),
      totalCount: skillQs.length,
      seedCount,
      aiCount,
      auditCritical,
      auditLikelyBroken,
      auditMinor,
      mastery: masteryScore,
      attemptsCount: skillAttempts.length,
      accuracy,
      isWeak,
      isLowStock,
    });
  }
  return rows;
}

/** 默认排序：薄弱 + 缺货 + 期末重要度 综合得分。高 = 越该出题 */
export function rowGenPriority(r: SkillRow): number {
  const weakBonus = r.isWeak ? 30 : 0;
  const stockBonus = r.isLowStock ? 20 : 0;
  // 期末重要度 0-9 → 0-30
  const examBonus = r.priorityRank * 3.3;
  // mastery 越低分越高（鼓励为薄弱出题）
  const masteryGap = Math.max(0, 100 - r.mastery) * 0.3;
  // 题量越少分越高
  const stockGap = Math.max(0, 30 - r.totalCount) * 0.5;
  return weakBonus + stockBonus + examBonus + masteryGap + stockGap;
}

/** 期末重要度 → 显示 chip 颜色 + 文字 */
export function examPriorityChip(p: ExamPriority): { label: string; tone: string } {
  switch (p) {
    case "MUST_BIG":
      return { label: "必考·大题", tone: "bg-rose-500/20 text-rose-200 border-rose-400/40" };
    case "HIGH_BIG":
      return { label: "高频·大题", tone: "bg-orange-500/20 text-orange-200 border-orange-400/40" };
    case "MUST_SMALL":
      return { label: "必考·小题", tone: "bg-amber-500/20 text-amber-200 border-amber-400/40" };
    case "VERY_HIGH_SMALL":
      return { label: "极高·小题", tone: "bg-yellow-500/20 text-yellow-200 border-yellow-400/40" };
    case "HIGH_SMALL":
      return { label: "高频·小题", tone: "bg-cyan-500/20 text-cyan-200 border-cyan-400/40" };
    case "NORMAL":
      return { label: "常规", tone: "bg-slate-500/20 text-slate-300 border-slate-400/40" };
    case "LOW_SMALL":
      return { label: "低频·小题", tone: "bg-slate-500/10 text-slate-400 border-slate-500/30" };
    case "LOW":
      return { label: "低频", tone: "bg-slate-500/10 text-slate-400 border-slate-500/30" };
    case "EXTENSION":
      return { label: "拓展", tone: "bg-violet-500/15 text-violet-300 border-violet-400/30" };
    default:
      return { label: p, tone: "bg-slate-500/10 text-slate-400" };
  }
}
