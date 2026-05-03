/**
 * 语文 · 单元/技能挑选页（"选单元"）
 *
 * Phase 2 MVP：以单元为主，单元下面列每个技能 + 题数。点单元卡 = 进 train 出该
 * 单元题；点单个技能 chip = 进 train 单刷该技能。
 */

import { Link, useSearchParams } from "react-router-dom";
import { useSubject } from "../../subjects/context";

export function ChinesePickerPage() {
  const subject = useSubject();
  const [params] = useSearchParams();
  const focusUnit = params.get("unitId");

  const unitsToShow = focusUnit
    ? subject.units.filter((u) => u.id === focusUnit)
    : subject.units;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display font-bold text-xl">
            {focusUnit ? "单元详情" : "选单元 / 技能"}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            点单元 = 跨技能混合 10 题；点单技能 = 单刷这个技能
          </div>
        </div>
        {focusUnit && (
          <Link to="/chinese/free-practice" className="btn-ghost text-sm">
            查看所有单元
          </Link>
        )}
      </div>

      <div className="space-y-4">
        {unitsToShow.map((u) => {
          const unitSkills = subject.skills.filter((s) => s.unitId === u.id);
          const unitQuestionCount = subject.seedQuestions.filter(
            (q) => q.unit_id === u.id,
          ).length;
          return (
            <div key={u.id} className="card-glow space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-lg">{u.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{u.description}</div>
                  <div className="text-[11px] text-slate-500 mt-2">
                    {unitSkills.length} 个技能 · {unitQuestionCount} 道题
                  </div>
                </div>
                <Link
                  to={`/chinese/train?unitId=${encodeURIComponent(u.id)}&fresh=${Date.now()}`}
                  className="btn-primary text-sm shrink-0"
                >
                  整单元练
                </Link>
              </div>

              {/* 技能 chips */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-ink-700/40">
                {unitSkills.map((s) => {
                  const skillQ = subject.seedQuestions.filter(
                    (q) => q.skill_id === s.id,
                  ).length;
                  return (
                    <Link
                      key={s.id}
                      to={`/chinese/train?skillId=${encodeURIComponent(s.id)}&fresh=${Date.now()}`}
                      className="chip bg-ink-700/60 hover:bg-ink-600/60 text-slate-200 border border-ink-600/60 text-xs flex items-center gap-1.5"
                    >
                      <span>{s.name}</span>
                      <span className="text-slate-500">· {skillQ}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center pt-2">
        <Link to="/chinese" className="btn-ghost text-sm">
          回语文首页
        </Link>
      </div>
    </div>
  );
}
