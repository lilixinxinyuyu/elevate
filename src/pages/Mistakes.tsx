import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { SKILLS } from "../content/skills";
import { UNITS } from "../content/units";
import type { Attempt, Question } from "../core/types";

const SKILL_MAP = new Map(SKILLS.map((s) => [s.id, s]));
const UNIT_MAP = new Map(UNITS.map((u) => [u.id, u]));

export function MistakesPage() {
  const student = useLiveQuery(async () => (await db.students.toArray())[0]);
  const mistakes = useLiveQuery(
    async () => (student ? db.mistakes.where({ studentId: student.id }).toArray() : []),
    [student?.id],
  );
  const questions = useLiveQuery(async () => db.questions.toArray(), []);
  const attempts = useLiveQuery(
    async () => (student ? db.attempts.where({ studentId: student.id }).toArray() : []),
    [student?.id],
  );

  const [filter, setFilter] = useState<"due" | "unresolved" | "all">("due");

  if (!student) return <div className="card">加载中…</div>;
  const qmap = new Map((questions ?? []).map((q) => [q.question_id, q]));
  const lastAttemptByQ = new Map<string, Attempt>();
  for (const a of (attempts ?? []) as Attempt[]) {
    const prev = lastAttemptByQ.get(a.questionId);
    if (!prev || a.createdAt > prev.createdAt) lastAttemptByQ.set(a.questionId, a);
  }

  const filtered = (mistakes ?? []).filter((m) => {
    if (filter === "due" && (m.resolved || m.nextReviewAt > Date.now())) return false;
    if (filter === "unresolved" && m.resolved) return false;
    return true;
  });

  const allCount = mistakes?.length ?? 0;
  const unresolvedCount = (mistakes ?? []).filter((m) => !m.resolved).length;
  const dueCount = (mistakes ?? []).filter((m) => !m.resolved && m.nextReviewAt <= Date.now()).length;

  return (
    <div className="space-y-4">
      <div className="card-glow flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <div className="font-display font-bold text-xl">错题复活</div>
          <div className="text-sm text-slate-400">
            未解决 <span className="text-slate-100 font-semibold">{unresolvedCount}</span> 道
            <span className="mx-1.5 text-slate-600">·</span>
            今日到期 <span className="text-amber-300 font-semibold">{dueCount}</span> 道
            <span className="mx-1.5 text-slate-600">·</span>
            <span className="text-slate-500">历史 {allCount}</span>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="field py-1.5 text-sm w-auto"
          >
            <option value="due">到期复习</option>
            <option value="unresolved">未解决</option>
            <option value="all">全部</option>
          </select>
          <Link to={`/math/train?mode=review&fresh=${Date.now()}`} className="btn-primary">
            🪄 开始复活
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-sm text-slate-300">还没有到期错题，继续加油！</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => {
            const q = qmap.get(m.questionId);
            const skill = SKILL_MAP.get(m.skillId);
            const unit = skill ? UNIT_MAP.get(skill.unitId) : undefined;
            const last = lastAttemptByQ.get(m.questionId);
            return (
              <div key={m.id} className="card">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>
                    {unit?.term} · {unit?.name} · {skill?.name}
                  </span>
                  <span>
                    阶段 {m.stage} · 下次 {new Date(m.nextReviewAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
                <div className="text-sm leading-relaxed text-slate-100">
                  {q?.stem ?? "[题目已移除]"}
                </div>
                {last && q && (
                  <div className="mt-2 text-xs">
                    <span className="text-rose-300">我的答案：{displayUserAnswer(last.answer)}</span>
                    <span className="mx-2 text-slate-500">·</span>
                    <span className="text-emerald-300">正确答案：{displayAnswer(q)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function displayUserAnswer(a: unknown): string {
  if (a == null) return "-";
  if (typeof a === "string" || typeof a === "number") return String(a);
  if (Array.isArray(a)) return a.map((x) => String(x)).join(", ");
  if (typeof a === "object") {
    return Object.entries(a as Record<string, unknown>)
      .map(([k, v]) => `${k}=${v ?? ""}`)
      .join("；");
  }
  return String(a);
}

function displayAnswer(q: Question): string {
  const a = q.answer;
  if (a.type === "number") return `${a.value}${a.unit ?? ""}`;
  if (a.type === "choice") return a.value;
  return a.steps.map((s) => `${s.step_id}=${s.expected}`).join("；");
}
