/**
 * Fluency Home — 模块卡片列表 + 总进度速览。
 *
 * 入口：左上 logo / nav "口算" → /math/fluency
 * Phase 2 doc: docs/phase2-plan.md (Axis 3)
 */

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../db/dexie";
import { FLUENCY_MODULES, getModulesForGrade } from "../content/fluencyModules";
import {
  FLUENCY_TROPHY_DEFS,
  getAllFluencyStats,
  getFluencyUnlockedTrophyIds,
  moduleMasteryTrophy,
  type FluencyTrophyMeta,
} from "../lib/fluencyEngine";
import type { FluencyStatsRow } from "../core/fluencyTypes";

export function FluencyPage() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [grade, setGrade] = useState<number>(4);
  const [stats, setStats] = useState<Map<string, FluencyStatsRow>>(new Map());
  const [unlockedTrophyIds, setUnlockedTrophyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void (async () => {
      const students = await db.students.toArray();
      const s = students[0];
      if (!s) return;
      setStudentId(s.id);
      setGrade(s.grade ?? 4);
      const all = await getAllFluencyStats(s.id);
      setStats(new Map(all.map((r) => [r.moduleId, r])));
      setUnlockedTrophyIds(new Set(await getFluencyUnlockedTrophyIds()));
    })();
  }, []);

  const visibleModules = getModulesForGrade(grade);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-baseline justify-between">
          <h1 className="font-display font-bold text-2xl text-brand">闪电口算</h1>
          <span className="text-xs text-slate-400">不进 XP · 独立速度雷达</span>
        </div>
        <p className="text-sm text-slate-300 mt-1">
          60 秒冲刺，刷速度 + 刷准确。跨单元的"基本功"，跟主线不冲突。
        </p>
      </header>

      {/* 模块卡片列表 */}
      <section className="grid sm:grid-cols-2 gap-3">
        {visibleModules.map((m) => {
          const st = stats.get(m.id);
          const accuracy =
            st && st.totalAttempts > 0 ? Math.round((st.totalCorrect / st.totalAttempts) * 100) : null;
          const p50sec = st && st.p50LatencyMs > 0 ? (st.p50LatencyMs / 1000).toFixed(1) : null;
          return (
            <Link
              to={`./${m.id}`}
              key={m.id}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${m.themeColor} p-4 shadow-lg hover:scale-[1.01] transition-transform`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl">{m.icon}</div>
                  <div className="font-display font-bold text-white text-lg mt-2">{m.name}</div>
                  <div className="text-white/80 text-xs mt-1">{m.description}</div>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-white/15 text-white text-[11px] font-bold">
                  {m.shortLabel}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 text-xs text-white/90">
                {st ? (
                  <>
                    <span>共 {st.totalAttempts} 题</span>
                    {accuracy != null && <span>准 {accuracy}%</span>}
                    {p50sec && <span>中位 {p50sec}s</span>}
                    {st.mastered && <span className="text-amber-200">★ 已通关</span>}
                  </>
                ) : (
                  <span>还没开练</span>
                )}
              </div>
            </Link>
          );
        })}
      </section>

      {/* fluency 勋章柜（独立，不混进主奖杯柜） */}
      <FluencyTrophyShelf
        unlocked={unlockedTrophyIds}
        moduleStats={stats}
        visibleModuleIds={new Set(visibleModules.map((m) => m.id))}
      />

      <div className="text-[11px] text-slate-500 leading-relaxed pt-2 border-t border-ink-700/50">
        💡 Fluency 是底层口算训练，跟主练习题分开 — 答对不涨 XP，但会涨"速度雷达"和专属勋章。
        准 95% + 中位时间达标 = 模块通关。
      </div>
    </div>
  );
}

function FluencyTrophyShelf({
  unlocked,
  moduleStats,
  visibleModuleIds,
}: {
  unlocked: Set<string>;
  moduleStats: Map<string, FluencyStatsRow>;
  visibleModuleIds: Set<string>;
}) {
  // session-level（全部 grade 通用）+ 当前 grade 可见 module 的 mastery 勋章
  const visibleModules = FLUENCY_MODULES.filter((m) => visibleModuleIds.has(m.id));
  const filtered: FluencyTrophyMeta[] = [
    ...FLUENCY_TROPHY_DEFS,
    ...visibleModules.map((m) => moduleMasteryTrophy(m.id, m.name)),
  ];
  return (
    <section className="rounded-2xl border border-ink-700/50 bg-ink-900/40 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display font-bold text-base text-slate-200">⚡ 速度勋章</h2>
        <span className="text-xs text-slate-500">
          已解锁 {Array.from(unlocked).length} / {filtered.length}
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {filtered.map((t) => {
          const got = unlocked.has(t.id);
          return (
            <div
              key={t.id}
              className={`relative rounded-xl border p-2 text-center ${
                got
                  ? "border-amber-400/40 bg-amber-500/10 shadow-glow"
                  : "border-ink-700/40 bg-ink-900/40 opacity-60"
              }`}
              title={t.description}
            >
              <div className="text-2xl">{got ? t.icon : "🔒"}</div>
              <div
                className={`text-[10px] mt-1 font-bold ${
                  got ? "text-amber-200" : "text-slate-400"
                }`}
              >
                {t.name}
              </div>
            </div>
          );
        })}
      </div>
      {moduleStats.size === 0 && (
        <div className="text-xs text-slate-500 mt-3">还没数据 — 选个模块开练吧。</div>
      )}
    </section>
  );
}
