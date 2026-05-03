import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { UNITS } from "../content/units";
import { SKILLS } from "../content/skills";
import { masteryColor, masteryLabel } from "../lib/format";
import { getSelectedTerm, setSelectedTerm } from "../db/service";
import type { Term } from "../core/types";

export function SkillPickerPage() {
  const nav = useNavigate();
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const masteryMap = useMemo(() => new Map((mastery ?? []).map((m) => [m.skillId, m])), [mastery]);

  const [term, setTerm] = useState<Term>("下册");
  useEffect(() => {
    if (!student) return;
    getSelectedTerm(student.id).then(setTerm);
  }, [student?.id]);
  const handleSwitchTerm = async (t: Term) => {
    if (!student) return;
    setTerm(t);
    setSelected(new Set()); // 切学期时清空选择
    await setSelectedTerm(student.id, t);
  };
  const visibleTerms: Term[] = term === "综合复习" ? ["下册", "上册"] : [term];
  const visibleUnitIds = useMemo(
    () => new Set(UNITS.filter((u) => visibleTerms.includes(u.term)).map((u) => u.id)),
    [term],
  );

  // 默认勾选：4 个掌握度最低且有题目的 skill（限当前 term）
  useEffect(() => {
    if (!mastery || !questionCounts) return;
    if (selected.size > 0) return;
    const available = SKILLS.filter(
      (s) => (questionCounts.get(s.id) ?? 0) > 0 && visibleUnitIds.has(s.unitId),
    );
    const byWeakness = available
      .map((s) => ({ s, score: masteryMap.get(s.id)?.score ?? 50 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 4)
      .map((x) => x.s.id);
    setSelected(new Set(byWeakness));
  }, [mastery?.length, questionCounts?.size, term]);

  if (!student) return <div className="card">加载中…</div>;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const go = () => {
    if (selected.size === 0) return;
    nav(`/train?skillIds=${Array.from(selected).join(",")}`);
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="card-glow flex items-center justify-between">
        <div>
          <div className="font-display font-bold text-xl">自由练</div>
          <div className="text-sm text-slate-400">选几个技能一起挑战。默认帮你选了掌握度最低的几个。</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip bg-violet-500/20 text-violet-100 border border-violet-400/30">已选 {selected.size}</span>
          <button type="button" className="btn-primary" disabled={selected.size === 0} onClick={go}>
            开始 →
          </button>
        </div>
      </div>

      <TermSwitcher term={term} onSwitch={handleSwitchTerm} />
      {visibleTerms.map((term) => {
        const units = UNITS.filter((u) => u.term === term).sort((a, b) => a.orderIndex - b.orderIndex);
        return (
          <section key={term}>
            <h2 className="text-lg font-display font-bold text-slate-200 mb-2">{term}</h2>
            {units.map((u) => {
              const skills = SKILLS.filter((s) => s.unitId === u.id);
              return (
                <div key={u.id} className="card mb-3">
                  <div className="font-display font-semibold text-slate-100 mb-2">{u.name}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {skills.map((s) => {
                      const score = masteryMap.get(s.id)?.score ?? 50;
                      const count = questionCounts?.get(s.id) ?? 0;
                      const disabled = count === 0;
                      const on = selected.has(s.id);
                      return (
                        <button
                          type="button"
                          key={s.id}
                          disabled={disabled}
                          onClick={() => toggle(s.id)}
                          className={`text-left rounded-xl border p-3 transition-all ${
                            disabled
                              ? "border-white/5 bg-white/5 opacity-60 cursor-not-allowed"
                              : on
                                ? "border-violet-400 bg-violet-500/20 shadow-glow"
                                : "border-white/10 bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex w-5 h-5 rounded border items-center justify-center ${on ? "bg-violet-400 border-violet-300" : "border-white/20"}`}>
                              {on && <span className="text-[11px] text-ink-900 font-bold">✓</span>}
                            </span>
                            <span className="text-sm text-slate-100 flex-1 truncate">{s.name}</span>
                            <span className={`chip border ${masteryColor(score)}`}>
                              {masteryLabel(score)} · {Math.round(score)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">题量 {count}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      <div className="sticky bottom-4 flex justify-end">
        <Link to="/math" className="btn-ghost mr-2">取消</Link>
        <button type="button" disabled={selected.size === 0} className="btn-primary" onClick={go}>
          开始挑战 →
        </button>
      </div>
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
