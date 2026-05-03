import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { UNITS } from "../content/units";
import { SKILLS } from "../content/skills";
import { masteryColor, masteryLabel } from "../lib/format";
import { useEffect, useState } from "react";
import { getSelectedTerm, setSelectedTerm } from "../db/service";
import type { Term } from "../core/types";

export function SkillsPage() {
  const student = useLiveQuery(async () => (await db.students.toArray())[0]);
  const mastery = useLiveQuery(
    async () => (student ? db.mastery.where({ studentId: student.id }).toArray() : []),
    [student?.id],
  );
  const questionCounts = useLiveQuery(async () => {
    const all = await db.questions.toArray();
    const counts = new Map<string, number>();
    for (const q of all) counts.set(q.skill_id, (counts.get(q.skill_id) ?? 0) + 1);
    return counts;
  });

  const [term, setTerm] = useState<Term>("下册");
  useEffect(() => {
    if (!student) return;
    getSelectedTerm(student.id).then(setTerm);
  }, [student?.id]);
  const handleSwitchTerm = async (t: Term) => {
    if (!student) return;
    setTerm(t);
    await setSelectedTerm(student.id, t);
  };

  if (!student) return <div className="card">正在加载…</div>;
  const masteryMap = new Map((mastery ?? []).map((m) => [m.skillId, m]));

  // 综合复习时显示全部，否则只显示当前 term
  const visibleTerms: Term[] = term === "综合复习" ? ["下册", "上册"] : [term];

  return (
    <div className="space-y-6">
      <TermSwitcher term={term} onSwitch={handleSwitchTerm} />
      {visibleTerms.map((term) => {
        const units = UNITS.filter((u) => u.term === term).sort((a, b) => a.orderIndex - b.orderIndex);
        return (
          <section key={term} className="space-y-3">
            <h2 className="text-lg font-display font-bold text-slate-200">{term}</h2>
            {units.map((u) => {
              const skills = SKILLS.filter((s) => s.unitId === u.id);
              if (skills.length === 0) return null;
              return (
                <div key={u.id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-display font-semibold text-slate-100">{u.name}</div>
                      <div className="text-xs text-slate-400">{u.description}</div>
                    </div>
                    <span className="chip bg-white/5 text-slate-400 border border-white/10">{u.id}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {skills.map((s) => {
                      const m = masteryMap.get(s.id);
                      const score = m?.score ?? 50;
                      const count = questionCounts?.get(s.id) ?? 0;
                      const disabled = count === 0;
                      return (
                        <div
                          key={s.id}
                          className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                            disabled
                              ? "border-white/5 bg-white/5 opacity-60"
                              : "border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-100 truncate">{s.name}</div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {s.ability.join("·")} · 题量 {count}
                              {s.examPriority === "MUST_BIG" && (
                                <span className="ml-2 chip bg-rose-500/20 text-rose-200 border border-rose-400/30">必考大题</span>
                              )}
                            </div>
                          </div>
                          <span className={`chip border ${masteryColor(score)}`}>
                            {masteryLabel(score)} · {Math.round(score)}
                          </span>
                          {!disabled && (
                            <Link
                              to={`/math/train?skillId=${encodeURIComponent(s.id)}`}
                              className="btn-primary px-3 py-1 text-xs"
                              title={`单独训练「${s.name}」`}
                            >
                              ▶ 练
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function TermSwitcher({ term, onSwitch }: { term: Term; onSwitch: (t: Term) => void }) {
  const TERMS: { id: Term; label: string }[] = [
    { id: "下册", label: "📚 下册" },
    { id: "上册", label: "📕 上册" },
    { id: "综合复习", label: "🎯 综合" },
  ];
  return (
    <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1">
      <span className="text-xs text-slate-400 shrink-0">学期：</span>
      {TERMS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSwitch(t.id)}
          className={`shrink-0 chip text-xs px-3 py-1.5 transition-all ${
            term === t.id
              ? "bg-violet-500/30 text-violet-100 border border-violet-400/60 shadow-glow-violet"
              : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
