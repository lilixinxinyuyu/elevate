import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { SKILLS } from "../content/skills";
import { weekStartKey } from "../lib/date";
import type { Attempt, MasteryScore } from "../core/types";

const SKILL_MAP = new Map(SKILLS.map((s) => [s.id, s]));

export function ReportPage() {
  const student = useLiveQuery(async () => (await db.students.toArray())[0]);
  const attempts = useLiveQuery(
    async () => (student ? db.attempts.where({ studentId: student.id }).toArray() : []),
    [student?.id],
  );
  const mastery = useLiveQuery(
    async () => (student ? db.mastery.where({ studentId: student.id }).toArray() : []),
    [student?.id],
  );
  const [copied, setCopied] = useState(false);

  const report = useMemo(() => {
    if (!student || !attempts) return null;
    return buildWeeklyReport(attempts, mastery ?? []);
  }, [student, attempts, mastery]);

  if (!student || !report) return <div className="card">正在加载…</div>;

  const markdown = reportToMarkdown(report, student.name);

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between">
        <div>
          <div className="font-semibold">本周家长报告</div>
          <div className="text-xs text-slate-500">起始：{report.weekStart}</div>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(markdown);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "已复制" : "复制 Markdown"}
        </button>
      </div>

      <div className="card space-y-2">
        <div className="font-medium">本周练习概况</div>
        <div className="text-sm text-slate-600">
          练习 {report.practiceDays} 天 · 共 {Math.round(report.totalSeconds / 60)} 分钟 · 完成 {report.totalQuestions} 题 · 正确率 {Math.round(report.accuracy * 100)}%
        </div>
      </div>

      {report.improvements.length > 0 && (
        <div className="card">
          <div className="font-medium mb-2">进步最大</div>
          <ul className="text-sm space-y-1">
            {report.improvements.map((i) => (
              <li key={i.skillId}>
                {i.skillName}：+{i.delta.toFixed(1)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.weakSkills.length > 0 && (
        <div className="card">
          <div className="font-medium mb-2">需要关注</div>
          <ul className="text-sm space-y-1">
            {report.weakSkills.map((w) => (
              <li key={w.skillId}>
                {w.skillName}（掌握度 {Math.round(w.score)}）：{w.suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.commonErrors.length > 0 && (
        <div className="card">
          <div className="font-medium mb-2">高频错因</div>
          <ul className="text-sm space-y-1">
            {report.commonErrors.map((e) => (
              <li key={e.tag}>
                {e.tag}（{e.count} 次）
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.nextWeekPlan.length > 0 && (
        <div className="card">
          <div className="font-medium mb-2">下周建议</div>
          <ul className="text-sm list-disc list-inside space-y-1">
            {report.nextWeekPlan.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface WeeklyReport {
  weekStart: string;
  practiceDays: number;
  totalQuestions: number;
  totalSeconds: number;
  accuracy: number;
  improvements: { skillId: string; skillName: string; delta: number }[];
  weakSkills: { skillId: string; skillName: string; score: number; suggestion: string }[];
  commonErrors: { tag: string; count: number }[];
  nextWeekPlan: string[];
}

function buildWeeklyReport(attempts: Attempt[], mastery: MasteryScore[]): WeeklyReport {
  const weekStart = weekStartKey();
  const weekStartMs = new Date(weekStart + "T00:00:00").getTime();
  const weekAttempts = attempts.filter((a) => a.createdAt >= weekStartMs);
  const days = new Set(weekAttempts.map((a) => new Date(a.createdAt).toISOString().slice(0, 10)));
  const totalSeconds = weekAttempts.reduce((s, a) => s + a.elapsedSeconds, 0);
  const correct = weekAttempts.filter((a) => a.isCorrect).length;
  const accuracy = weekAttempts.length === 0 ? 0 : correct / weekAttempts.length;

  const deltaBySkill = new Map<string, number>();
  for (const a of weekAttempts) {
    deltaBySkill.set(a.skillId, (deltaBySkill.get(a.skillId) ?? 0) + a.masteryDelta);
  }
  const improvements = Array.from(deltaBySkill.entries())
    .filter(([, d]) => d > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([skillId, delta]) => ({
      skillId,
      skillName: SKILL_MAP.get(skillId)?.name ?? skillId,
      delta,
    }));

  const weakSkills = mastery
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((m) => ({
      skillId: m.skillId,
      skillName: SKILL_MAP.get(m.skillId)?.name ?? m.skillId,
      score: m.score,
      suggestion: suggestionFor(m.skillId),
    }));

  const errorMap = new Map<string, number>();
  for (const a of weekAttempts) {
    for (const tag of a.errorTags) errorMap.set(tag, (errorMap.get(tag) ?? 0) + 1);
  }
  const commonErrors = Array.from(errorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  const nextWeekPlan = buildNextWeekPlan(weakSkills, commonErrors);

  return {
    weekStart,
    practiceDays: days.size,
    totalQuestions: weekAttempts.length,
    totalSeconds,
    accuracy,
    improvements,
    weakSkills,
    commonErrors,
    nextWeekPlan,
  };
}

function suggestionFor(skillId: string): string {
  if (skillId.startsWith("equation_")) return "先练找等量关系，再练列方程。";
  if (skillId.startsWith("decimal_mul")) return "先口算 10 道基础乘法，再挑战应用题。";
  if (skillId.startsWith("average_")) return "背熟平均数公式，做 2 道逆向题。";
  if (skillId.startsWith("triangle_")) return "三边关系和内角和每天 2 道。";
  return "每天 5 分钟同技能小题即可。";
}

function buildNextWeekPlan(
  weak: { skillName: string }[],
  errors: { tag: string; count: number }[],
): string[] {
  const plan: string[] = [];
  if (weak[0]) plan.push(`每天 5 分钟针对 ${weak[0].skillName}`);
  if (weak[1]) plan.push(`隔天练 2 道 ${weak[1].skillName}`);
  if (errors[0]) plan.push(`重点纠正错因：${errors[0].tag}`);
  plan.push("完成 1 次到期错题复习");
  return plan;
}

function reportToMarkdown(r: WeeklyReport, name: string): string {
  const lines: string[] = [];
  lines.push(`# ${name} 本周训练报告（${r.weekStart} 起）`);
  lines.push("");
  lines.push(
    `- 练习 ${r.practiceDays} 天，共 ${Math.round(r.totalSeconds / 60)} 分钟`,
  );
  lines.push(`- 完成 ${r.totalQuestions} 题，正确率 ${Math.round(r.accuracy * 100)}%`);
  if (r.improvements.length > 0) {
    lines.push("\n## 进步最大");
    for (const i of r.improvements) {
      lines.push(`- ${i.skillName}：+${i.delta.toFixed(1)}`);
    }
  }
  if (r.weakSkills.length > 0) {
    lines.push("\n## 需要关注");
    for (const w of r.weakSkills) {
      lines.push(`- ${w.skillName}（掌握度 ${Math.round(w.score)}）：${w.suggestion}`);
    }
  }
  if (r.commonErrors.length > 0) {
    lines.push("\n## 高频错因");
    for (const e of r.commonErrors) {
      lines.push(`- ${e.tag}：${e.count} 次`);
    }
  }
  if (r.nextWeekPlan.length > 0) {
    lines.push("\n## 下周建议");
    for (const p of r.nextWeekPlan) {
      lines.push(`- ${p}`);
    }
  }
  return lines.join("\n");
}
