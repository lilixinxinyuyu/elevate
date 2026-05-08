/**
 * 闯关世界 (BossWorld) — v0.31.49 替代 BigProblems landing 页
 *
 * 6 单元 boss + 期末大魔王。每单元显示历史最佳星数 (0-4)、试过几次、当前是否解锁。
 *
 * 期末解锁条件：6 单元全部 ≥ 3 星。
 * 满星挑战勋章：6 单元全 4 星 + 期末 4 星 → "G4B 完美通关" 勋章。
 *
 * 路由：/math/big-problems （保留路径不变，避免老入口失效）
 */

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../db/dexie";
import { UNITS } from "../content/units";
import { SKILLS } from "../content/skills";
import {
  bossForUnit,
  COLOR_CLASSES,
  FINAL_BOSS,
  type BossPersona,
} from "../core/bossPersonas";
import {
  canChallengeFinal,
  loadAllBossStates,
  type BossState,
} from "../lib/bossBattleState";

const UNIT_GATE = 75; // 单元 skill 平均 ≥ 75 才解锁该 boss
const STUDENT_DEFAULT_TERM = "下册" as const;

interface UnitRow {
  unitId: string;
  unitName: string;
  boss: BossPersona | null;
  unlocked: boolean;
  avgMastery: number;
  weakSkills: { id: string; name: string; score: number }[];
  bossState: BossState;
}

export function BossWorldPage() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [finalUnlock, setFinalUnlock] = useState<{
    unlocked: boolean;
    metCount: number;
    totalUnits: number;
    perfectCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const ss = await db.students.toArray();
      const s = ss[0];
      if (!s) {
        setLoading(false);
        return;
      }
      setStudentId(s.id);

      const masteryRows = await db.mastery.where("studentId").equals(s.id).toArray();
      const masteryById = new Map(masteryRows.map((m) => [m.skillId, m.score]));

      const bossStates = await loadAllBossStates(s.id);

      const g4bUnits = UNITS.filter((u) => u.term === STUDENT_DEFAULT_TERM).sort(
        (a, b) => a.orderIndex - b.orderIndex,
      );

      const unitStats: UnitRow[] = g4bUnits.map((u) => {
        const unitSkills = SKILLS.filter((sk) => sk.unitId === u.id);
        const scores = unitSkills.map((sk) => masteryById.get(sk.id) ?? 0);
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const weak = unitSkills
          .map((sk) => ({ id: sk.id, name: sk.name, score: masteryById.get(sk.id) ?? 0 }))
          .filter((x) => x.score < UNIT_GATE)
          .sort((a, b) => a.score - b.score);
        return {
          unitId: u.id,
          unitName: u.name,
          boss: bossForUnit(u.id),
          unlocked: avg >= UNIT_GATE,
          avgMastery: avg,
          weakSkills: weak,
          bossState: bossStates.get(u.id) ?? {
            bestStars: 0,
            totalAttempts: 0,
            lastAttemptAt: 0,
            perfectCount: 0,
          },
        };
      });

      const finalState = await canChallengeFinal(s.id);

      setRows(unitStats);
      setFinalUnlock(finalState);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="text-slate-400 text-center py-20">加载中…</div>;
  }
  if (!studentId) {
    return <div className="text-slate-400 text-center py-20">请先登录学生账号。</div>;
  }

  const totalStars = rows.reduce((s, r) => s + r.bossState.bestStars, 0);
  const maxStars = rows.length * 4;
  const beatenCount = rows.filter((r) => r.bossState.bestStars >= 1).length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display font-bold text-2xl text-brand">🗡️ 闯关世界</h1>
        <p className="text-sm text-slate-300 mt-1">
          每单元一个 boss · 通关 ≥ 3 ★ 解锁期末大魔王 · 6 单元全 4 ★ 拿完美勋章
        </p>
      </header>

      {/* 进度概览 */}
      <section className="rounded-2xl border border-ink-700/50 bg-ink-900/40 p-4">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-center">
            <div className="text-xs text-slate-400">已通关</div>
            <div className="font-display font-bold text-2xl text-amber-200 tabular-nums">
              {beatenCount}
            </div>
            <div className="text-[11px] text-slate-400">/ {rows.length} 单元</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400">总星数</div>
            <div className="font-display font-bold text-2xl text-amber-300 tabular-nums">
              {totalStars}
            </div>
            <div className="text-[11px] text-slate-400">/ {maxStars} ⭐</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400">完美关</div>
            <div className="font-display font-bold text-2xl text-rose-300 tabular-nums">
              {rows.filter((r) => r.bossState.bestStars === 4).length}
            </div>
            <div className="text-[11px] text-slate-400">/ {rows.length} 满星</div>
          </div>
        </div>
      </section>

      {/* 6 单元卡 */}
      <section className="space-y-3">
        {rows.map((u) => (
          <UnitCard key={u.unitId} u={u} />
        ))}
      </section>

      {/* 期末大魔王 */}
      <FinalBossCard finalUnlock={finalUnlock} />

      {/* 说明 */}
      <section className="rounded-2xl border border-ink-700/50 bg-ink-900/40 p-4 text-xs text-slate-400 leading-relaxed">
        💡 闯关规则：
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>每场 7 题：2 道热身（D2）+ 3 道主战（D3 多步）+ 2 道 BOSS（D4 综合）</li>
          <li>3 颗心 ❤️ — 错答 -1，每过一阶段 +1（最多 3）</li>
          <li>📞 救场次数随数学段位涨：童生小学 1 次，全国 3 次</li>
          <li>4/7 → 1 ★，5/7 → 2 ★，6/7 → 3 ★，7/7 → 4 ★ 完美</li>
          <li>不限时 — 慢慢想，但 hearts=0 就结束</li>
        </ul>
      </section>
    </div>
  );
}

function UnitCard({ u }: { u: UnitRow }) {
  const stars = u.bossState.bestStars;
  const attempts = u.bossState.totalAttempts;

  if (!u.boss) {
    // 没 boss 数据（其他学期）
    return null;
  }

  if (!u.unlocked) {
    const gateGap = Math.max(0, UNIT_GATE - u.avgMastery);
    const progressPct = Math.min(100, (u.avgMastery / UNIT_GATE) * 100);
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
            </div>
          </div>
        )}
      </details>
    );
  }

  // 解锁 → 显示 boss + 星数
  const boss = u.boss;
  const cls = COLOR_CLASSES[boss.color];
  const beatenLabel = stars === 4 ? "完美通关 ✨" : stars > 0 ? `已通关 · 试 ${attempts} 次` : "尚未通关";

  return (
    <Link
      to={`/math/boss-battle/${u.unitId}`}
      className={`block rounded-2xl bg-gradient-to-br ${cls.from} ${cls.to} ${cls.border} border-2 p-4 hover:scale-[1.01] transition-transform`}
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl shrink-0">{boss.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <div className={`font-display font-bold text-base ${cls.text}`}>
              {boss.name}
            </div>
            <span className="text-[10px] text-slate-300/70">· {u.unitName}</span>
          </div>
          <div className="text-xs text-slate-300 mt-0.5">{beatenLabel}</div>
          <div className="mt-1.5 flex items-center gap-1">
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`text-base ${i <= stars ? "text-amber-300" : "text-slate-600 grayscale opacity-40"}`}
              >
                {i <= stars ? "⭐" : "☆"}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-slate-300">▶ 挑战</div>
          {stars >= 1 && stars < 4 && (
            <div className="text-[10px] text-amber-300 mt-0.5">满星挑战</div>
          )}
        </div>
      </div>
    </Link>
  );
}

function FinalBossCard({
  finalUnlock,
}: {
  finalUnlock: { unlocked: boolean; metCount: number; totalUnits: number; perfectCount: number } | null;
}) {
  if (!finalUnlock) return null;
  if (finalUnlock.unlocked) {
    const allPerfect = finalUnlock.perfectCount === finalUnlock.totalUnits;
    return (
      <Link
        to={`/math/boss-battle/${FINAL_BOSS.unitId}`}
        className="block rounded-3xl bg-gradient-to-br from-rose-500 via-fuchsia-500 to-violet-500 p-6 text-white shadow-glow"
      >
        <div className="flex items-center gap-4">
          <div className="text-5xl">{FINAL_BOSS.emoji}</div>
          <div className="flex-1">
            <div className="font-display font-bold text-xl">{FINAL_BOSS.name} · 已开启</div>
            <div className="text-sm opacity-90 mt-1">
              {allPerfect
                ? "6 单元全满星 — 拿下他就是 G4B 完美通关勋章！"
                : "通过即升整段段位"}
            </div>
          </div>
          <div className="font-display font-bold text-base">▶ 决战</div>
        </div>
      </Link>
    );
  }
  const need = finalUnlock.totalUnits - finalUnlock.metCount;
  return (
    <div className="rounded-3xl border-2 border-dashed border-rose-400/30 bg-ink-900/40 p-5 text-center">
      <div className="text-4xl opacity-40">{FINAL_BOSS.emoji}</div>
      <div className="font-display font-bold text-base text-slate-300 mt-2">
        {FINAL_BOSS.name} · 锁定中
      </div>
      <div className="text-xs text-slate-400 mt-1">
        还差 <span className="text-rose-300 font-bold">{need}</span> 个单元 boss 拿到 ≥ 3 ★
      </div>
      <div className="text-[10px] text-slate-500 mt-2">
        当前 {finalUnlock.metCount} / {finalUnlock.totalUnits} 单元达标
      </div>
    </div>
  );
}
