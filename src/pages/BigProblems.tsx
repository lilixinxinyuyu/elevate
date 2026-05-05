/**
 * 大题闯关 (Big Problems Boss Run) — Phase 2 Axis 1 v2 (v0.31.1)
 *
 * 校园探险世界观：每个单元是一个"关卡"，把基础 skill 刷到熟练（avg ≥ 75）才解锁
 * 该单元的"闯关"。通过闯关 → 拿单元印章 + 段位星级 +1。集齐 6 个单元印章 + G4B
 * 全 skill 平均 ≥ 70 → 解锁期末大闯关。
 *
 * 关键设计（用户决策 2026-05-05）：
 *   - 单元 gate 阈值：avg ≥ 75
 *   - 期末 gate：6 印章 + avg ≥ 70
 *   - nav 用短词 "闯关"，page H1 用 "大题闯关"
 *   - 失败提示哪几个 skill 还差（用户：让 Selena 知道去刷哪里）
 */

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../db/dexie";
import { SKILLS } from "../content/skills";
import { UNITS } from "../content/units";
import type { Question } from "../core/types";

const UNIT_GATE = 75;
const FINAL_GATE = 70;
const STUDENT_DEFAULT_TERM = "下册" as const;

interface UnitStatus {
  unitId: string;
  unitName: string;
  skillCount: number;
  avgMastery: number;
  unlocked: boolean;
  beaten: boolean; // 已通关（拿过印章）
  weakSkills: { id: string; name: string; score: number }[]; // 距 75 还差的
  bigQuestionCount: number;
}

export function BigProblemsPage() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitStatus[]>([]);
  const [g4bAvg, setG4bAvg] = useState<number>(0);
  const [allBeaten, setAllBeaten] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const ss = await db.students.toArray();
      const s = ss[0];
      if (!s) return;
      setStudentId(s.id);

      const masteryRows = await db.mastery.where("studentId").equals(s.id).toArray();
      const masteryById = new Map(masteryRows.map((m) => [m.skillId, m.score]));

      const allQuestions = await db.questions.toArray();
      const eligibleQs = allQuestions.filter(
        (q: Question) =>
          q.difficulty >= 3 &&
          q.difficulty <= 4 &&
          Array.isArray(q.subquestions) &&
          q.subquestions.length > 0 &&
          (q.term ?? "下册") === STUDENT_DEFAULT_TERM,
      );

      // 拿"闯关印章"集合：trophies 表里 trophyId 形如 "boss_<unitId>_master"
      const earnedTrophies = await db.trophies.where("studentId").equals(s.id).toArray();
      const beatenUnits = new Set(
        earnedTrophies
          .map((t) => /^boss_(.+)_master$/.exec(t.trophyId)?.[1])
          .filter(Boolean) as string[],
      );

      const g4bUnits = UNITS.filter((u) => u.term === STUDENT_DEFAULT_TERM).sort(
        (a, b) => a.orderIndex - b.orderIndex,
      );

      const unitStats: UnitStatus[] = g4bUnits.map((u) => {
        const unitSkills = SKILLS.filter((sk) => sk.unitId === u.id);
        const scores = unitSkills.map((sk) => masteryById.get(sk.id) ?? 0);
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const weak = unitSkills
          .map((sk) => ({ id: sk.id, name: sk.name, score: masteryById.get(sk.id) ?? 0 }))
          .filter((x) => x.score < UNIT_GATE)
          .sort((a, b) => a.score - b.score);
        const bigCount = eligibleQs.filter((q) => q.unit_id === u.id).length;
        return {
          unitId: u.id,
          unitName: u.name,
          skillCount: unitSkills.length,
          avgMastery: avg,
          unlocked: avg >= UNIT_GATE,
          beaten: beatenUnits.has(u.id),
          weakSkills: weak,
          bigQuestionCount: bigCount,
        };
      });

      // G4B 全部 skill avg
      const g4bSkillIds = new Set(SKILLS.filter((sk) =>
        UNITS.find((u) => u.id === sk.unitId && u.term === STUDENT_DEFAULT_TERM)
      ).map((sk) => sk.id));
      const g4bScores = Array.from(g4bSkillIds).map((id) => masteryById.get(id) ?? 0);
      const g4bAverage = g4bScores.length ? Math.round(g4bScores.reduce((a, b) => a + b, 0) / g4bScores.length) : 0;
      const finalUnlocked = unitStats.every((u) => u.beaten) && g4bAverage >= FINAL_GATE;

      setUnits(unitStats);
      setG4bAvg(g4bAverage);
      setAllBeaten(finalUnlocked);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="text-slate-400 text-center py-20">加载中…</div>;
  }
  if (!studentId) {
    return <div className="text-slate-400 text-center py-20">请先登录学生账号。</div>;
  }

  const unlockedCount = units.filter((u) => u.unlocked).length;
  const beatenCount = units.filter((u) => u.beaten).length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display font-bold text-2xl text-brand">大题闯关</h1>
        <p className="text-sm text-slate-300 mt-1">
          每个单元是一道关卡。基础 skill 刷到{" "}
          <span className="text-amber-300 font-bold">熟练 ≥ {UNIT_GATE}</span> 解锁该单元闯关；
          打通 6 关后开启<span className="text-amber-300 font-bold">期末大闯关</span>。
        </p>
      </header>

      {/* 进度概览 */}
      <section className="rounded-2xl border border-ink-700/50 bg-ink-900/40 p-4">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-center">
            <div className="text-xs text-slate-400">已通关</div>
            <div className="font-display font-bold text-2xl text-amber-200 tabular-nums">{beatenCount}</div>
            <div className="text-[11px] text-slate-400">/ {units.length} 印章</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400">已解锁</div>
            <div className="font-display font-bold text-2xl text-violet-200 tabular-nums">{unlockedCount}</div>
            <div className="text-[11px] text-slate-400">/ {units.length} 单元</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400">G4B 综合</div>
            <div className={`font-display font-bold text-2xl tabular-nums ${g4bAvg >= FINAL_GATE ? "text-emerald-300" : "text-slate-200"}`}>
              {g4bAvg}
            </div>
            <div className="text-[11px] text-slate-400">期末门槛 {FINAL_GATE}</div>
          </div>
        </div>
      </section>

      {/* 各单元卡片 */}
      <section className="space-y-3">
        {units.map((u) => (
          <UnitCard key={u.unitId} u={u} />
        ))}
      </section>

      {/* 期末大闯关 */}
      <FinalBossCard allBeaten={allBeaten} g4bAvg={g4bAvg} beatenCount={beatenCount} totalUnits={units.length} />

      <section className="rounded-2xl border border-ink-700/50 bg-ink-900/40 p-4 text-xs text-slate-400 leading-relaxed">
        💡 闯关说明：
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>每场 5 道大题（D3-D4 多步应用题，含 subquestions 分步答）</li>
          <li>5 道至少答对 4 道 → 通过 + 获得本单元印章 + 段位星级 +1</li>
          <li>不限时（cognitive load 高，慢慢想）</li>
          <li>XP / Elo / mastery 全部跟主线累计</li>
        </ul>
      </section>
    </div>
  );
}

function UnitCard({ u }: { u: UnitStatus }) {
  const gateGap = Math.max(0, UNIT_GATE - u.avgMastery);
  const progressPct = Math.min(100, (u.avgMastery / UNIT_GATE) * 100);

  if (u.beaten) {
    // 已通关 — 金色激活态
    return (
      <Link
        to={`../train?mode=big_problems&unitId=${u.unitId}&fresh=1`}
        className="block rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-2 border-amber-400/50 p-4 hover:border-amber-400 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">🏆</div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <div className="font-display font-bold text-base text-amber-100">{u.unitName}</div>
              <div className="text-[11px] text-amber-200/80">已通关 · 印章已得</div>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{u.bigQuestionCount} 道大题 · 再战可继续涨 XP</div>
          </div>
          <div className="text-amber-200 text-sm">再战 →</div>
        </div>
      </Link>
    );
  }

  if (u.unlocked) {
    // 已解锁未通关 — 紫色 active
    return (
      <Link
        to={`../train?mode=big_problems&unitId=${u.unitId}&fresh=1`}
        className="block rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border-2 border-violet-400/50 p-4 hover:border-violet-400 transition-colors animate-pulse-slow"
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">⚔️</div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <div className="font-display font-bold text-base text-violet-100">{u.unitName}</div>
              <div className="text-[11px] text-violet-200/80">已解锁 · 待挑战</div>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              熟练 {u.avgMastery} · {u.bigQuestionCount} 道大题
            </div>
          </div>
          <div className="text-violet-200 text-sm font-bold">▶ 闯关</div>
        </div>
      </Link>
    );
  }

  // 锁着 — 进度条 + 弱项提示
  return (
    <details className="rounded-2xl border border-ink-700/50 bg-ink-900/40 p-4 group">
      <summary className="flex items-center gap-3 cursor-pointer list-none">
        <div className="text-3xl opacity-50">🔒</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <div className="font-display font-bold text-base text-slate-300">{u.unitName}</div>
            <div className="text-[11px] text-slate-500">距解锁差 {gateGap}</div>
          </div>
          <div className="h-1.5 rounded-full bg-black/30 overflow-hidden mt-1.5">
            <div
              className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 mt-1 tabular-nums">
            当前熟练 {u.avgMastery} / 解锁需 {UNIT_GATE}
          </div>
        </div>
        <div className="text-slate-500 text-xs group-open:rotate-180 transition-transform">▾</div>
      </summary>
      {u.weakSkills.length > 0 && (
        <div className="mt-3 pt-3 border-t border-ink-700/50">
          <div className="text-xs text-slate-400 mb-2">回这些 skill 刷一刷就能解锁：</div>
          <div className="space-y-1.5">
            {u.weakSkills.slice(0, 5).map((sk) => (
              <Link
                key={sk.id}
                to={`../train?mode=skill&skillId=${sk.id}&fresh=1`}
                className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
              >
                <span className="text-slate-200">{sk.name}</span>
                <span className="text-slate-400 tabular-nums">熟练 {sk.score} →</span>
              </Link>
            ))}
            {u.weakSkills.length > 5 && (
              <div className="text-[11px] text-slate-500 px-3">还有 {u.weakSkills.length - 5} 个…</div>
            )}
          </div>
        </div>
      )}
    </details>
  );
}

function FinalBossCard({
  allBeaten,
  g4bAvg,
  beatenCount,
  totalUnits,
}: {
  allBeaten: boolean;
  g4bAvg: number;
  beatenCount: number;
  totalUnits: number;
}) {
  if (allBeaten) {
    return (
      <Link
        to="../train?mode=big_problems&final=1&fresh=1"
        className="block rounded-3xl bg-gradient-to-br from-rose-500 via-fuchsia-500 to-violet-500 p-6 text-white shadow-glow"
      >
        <div className="flex items-center gap-4">
          <div className="text-5xl">👑</div>
          <div className="flex-1">
            <div className="font-display font-bold text-xl">期末大闯关 · 已开启</div>
            <div className="text-sm opacity-90 mt-1">10 道全单元混合大题，通过升整段段位</div>
          </div>
          <div className="font-display font-bold text-base">▶ 挑战</div>
        </div>
      </Link>
    );
  }
  const indicator = beatenCount === totalUnits
    ? `还差 G4B 综合到 ${FINAL_GATE}（当前 ${g4bAvg}）`
    : `还差 ${totalUnits - beatenCount} 个单元印章`;
  return (
    <div className="rounded-3xl border-2 border-dashed border-rose-400/30 bg-ink-900/40 p-5 text-center">
      <div className="text-4xl opacity-40">👑</div>
      <div className="font-display font-bold text-base text-slate-300 mt-2">期末大闯关 · 锁定中</div>
      <div className="text-xs text-slate-400 mt-1">{indicator}</div>
    </div>
  );
}
