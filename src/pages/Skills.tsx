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
      <MasteryLegend />
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
                      // v0.28：未训练过的 skill 显示 0（"未涉足"），不再默认 50
                      const score = m?.score ?? 0;
                      const count = questionCounts?.get(s.id) ?? 0;
                      const disabled = count === 0;
                      const elo = m?.studentElo;
                      const recent5 = (m?.recent ?? []).slice(-5);
                      const last5Wrong = recent5.filter((r) => !r.correct).length;
                      const daysSinceSuccess =
                        m?.lastSuccessAt
                          ? (Date.now() - m.lastSuccessAt) / 86_400_000
                          : Infinity;
                      const fragile =
                        score > 0 &&
                        (daysSinceSuccess > 21 || last5Wrong >= 3);
                      const tooltip = m
                        ? [
                            `Elo ${elo ? Math.round(elo) : "—"}`,
                            `已答 ${m.attemptsCount}（对 ${m.correctCount}）`,
                            fragile ? "⚠️ 该复习了" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "还没练过";
                      return (
                        <div
                          key={s.id}
                          className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                            disabled
                              ? "border-white/5 bg-white/5 opacity-60"
                              : "border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                          }`}
                          title={tooltip}
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
                          <span
                            className={`chip border ${masteryColor(score)} flex items-center gap-1`}
                          >
                            {fragile && <span title="该复习了">⚠</span>}
                            {masteryLabel(score)} · {Math.round(score)}
                          </span>
                          {!disabled && (
                            <Link
                              to={`/math/train?skillId=${encodeURIComponent(s.id)}&fresh=${Date.now()}`}
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

/**
 * v0.28：5 档掌握度图例 + 算法说明，让爸妈/Selena 知道分数怎么算的、
 * 为什么"刷一百道题"不会全部秒变"精通"。
 */
function MasteryLegend() {
  const tiers: { range: string; label: string; cls: string }[] = [
    { range: "0-19", label: "未涉足", cls: masteryColor(10) },
    { range: "20-39", label: "见过几次", cls: masteryColor(30) },
    { range: "40-59", label: "进步中", cls: masteryColor(50) },
    { range: "60-74", label: "较稳", cls: masteryColor(67) },
    { range: "75-89", label: "熟练", cls: masteryColor(80) },
    { range: "90-100", label: "精通", cls: masteryColor(95) },
  ];
  return (
    <details className="card text-sm">
      <summary className="cursor-pointer font-display font-semibold text-slate-100 select-none">
        📊 掌握度怎么算？（点开看）
      </summary>
      <div className="mt-3 space-y-3 text-xs text-slate-300 leading-relaxed">
        <div className="flex flex-wrap gap-1.5">
          {tiers.map((t) => (
            <span key={t.label} className={`chip border ${t.cls}`}>
              {t.range} {t.label}
            </span>
          ))}
        </div>
        <div className="space-y-1">
          <div>
            <span className="text-violet-200 font-semibold">分数 = </span>
            最近 30 题加权命中率 × 50% + Elo 等级分 × 30% + 题面多样性 × 20%
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-slate-400 pl-1">
            <li>难题答对涨得多，简单题答对几乎不涨（自校准 Elo）</li>
            <li>14 天前的成绩权重减半，21 天没碰会被标 ⚠️ 该复习了</li>
            <li>最近 5 题错 ≥ 3 题 → 上限 45 分（Fragility 保护）</li>
            <li>同样 3 道题反复刷不算"精通"——需要 ≥ 4 种不同题面</li>
            <li>"精通 90+" 需要 Elo ≥ 1700 + 难题命中率 70%+ + ≥ 20 题</li>
          </ul>
        </div>
      </div>
    </details>
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
