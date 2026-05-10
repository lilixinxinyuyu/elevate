/**
 * Fluency Home — 模块卡片列表 + 总进度速览。
 *
 * 入口：左上 logo / nav "口算" → /math/fluency
 * Phase 2 doc: docs/phase2-plan.md (Axis 3)
 */

import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
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
import { MATH_TRICKS } from "../content/mathTricks";
import {
  getCompletedTricks,
  getTricksTodayCount,
} from "../lib/mathTricksProgress";

export function FluencyPage() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [grade, setGrade] = useState<number>(4);
  const [stats, setStats] = useState<Map<string, FluencyStatsRow>>(new Map());
  const [unlockedTrophyIds, setUnlockedTrophyIds] = useState<Set<string>>(new Set());
  // v0.31.87：巧算秘籍 — 进度上云后融入 fluency 页
  const [tricksCompleted, setTricksCompleted] = useState<Set<string>>(new Set());
  const [tricksTodayCount, setTricksTodayCount] = useState<number>(0);

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
      setTricksCompleted(await getCompletedTricks(s.id));
      setTricksTodayCount(await getTricksTodayCount(s.id));
    })();
  }, []);

  const visibleModules = getModulesForGrade(grade);

  // 今日推荐 trick：优先没掌握的，按 stable 顺序选第一个；全掌握就轮播
  const todayRecommendedTrick = useMemo(() => {
    const undone = MATH_TRICKS.filter((t) => !tricksCompleted.has(t.id));
    if (undone.length > 0) return undone[0]!;
    // 全掌握后：按今天日期 hash 选一个复习
    const todayIdx =
      Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % MATH_TRICKS.length;
    return MATH_TRICKS[todayIdx]!;
  }, [tricksCompleted]);

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

      {/* v0.31.87：巧算秘籍区——纳入"基本功"叙事，与速算 module 平级。
          完成一个 trick 也算每日打卡内环的一部分（双闭：速算 ✓ × 巧算 ✓）。 */}
      <section className="card-glow border-violet-400/30 bg-gradient-to-br from-violet-500/15 via-pink-500/10 to-amber-500/5">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="text-3xl shrink-0">🪄</div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h2 className="font-display font-bold text-violet-100 text-base">
                巧算秘籍
              </h2>
              <div className="text-[11px] text-slate-400">
                已掌握{" "}
                <span className="font-bold text-violet-200">
                  {tricksCompleted.size}
                </span>
                <span className="text-slate-500"> / {MATH_TRICKS.length}</span>
                {tricksTodayCount > 0 && (
                  <span className="ml-2 text-emerald-300">
                    · 今日 ✓ {tricksTodayCount}
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-300 mt-1">
              凑整、借十、折半乘倍 — 让心算更快的秘密武器，每天选一个练几道
              就计入今日基本功打卡。
            </div>
          </div>
        </div>

        {/* 今日推荐 + 浏览全部 */}
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          <Link
            to="../tricks"
            state={{ scrollTo: todayRecommendedTrick.id }}
            className={`relative overflow-hidden rounded-xl border p-3 transition-colors ${
              tricksCompleted.has(todayRecommendedTrick.id)
                ? "bg-emerald-500/15 border-emerald-400/40 hover:bg-emerald-500/20"
                : "bg-amber-500/15 border-amber-400/40 hover:bg-amber-500/25"
            }`}
          >
            <div className="text-[10px] uppercase tracking-widest text-amber-200/70">
              {tricksCompleted.has(todayRecommendedTrick.id)
                ? "今日复习"
                : "今日推荐"}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl">{todayRecommendedTrick.emoji}</span>
              <span className="font-display font-bold text-base text-amber-100">
                {todayRecommendedTrick.name}
              </span>
            </div>
            <div className="text-[11px] text-slate-300 mt-1 line-clamp-2">
              {todayRecommendedTrick.tagline}
            </div>
          </Link>
          <Link
            to="../tricks"
            className="rounded-xl border border-violet-400/30 bg-violet-500/10 hover:bg-violet-500/20 p-3 flex items-center gap-3 transition-colors"
          >
            <span className="text-2xl">📚</span>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-violet-100 text-sm">
                浏览全部 {MATH_TRICKS.length} 个
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                凑整 / 借十 / 折半 / 拆数 / 估算 …
              </div>
            </div>
            <div className="text-violet-300">→</div>
          </Link>
        </div>
      </section>

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
