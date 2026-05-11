/**
 * v0.31.53: Phase 2 — 闯关星章独立卡（24 颗星目标）
 *
 * 6 个 G4B 单元 × 4 星 = 24 颗星，每颗都是 Selena 真打出来的成绩。
 * 卡片显示：
 *   - 总进度条 12 / 24
 *   - 6 个单元的 boss persona + 当前星数
 *   - 期末门槛进度（4/6 ≥ 3 星 = 解锁）
 *   - 一键跳到闯关世界
 *
 * 跟"段位条"的关系：段位是连续 XP 累积，星章是离散里程碑。
 * 二者并列让 Selena 在 Hero 之外多一条进步线 — 即使段位没动，星章可能一周新增一颗。
 */
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { UNITS } from "../content/units";
import { UNIT_BOSSES, FINAL_BOSS } from "../core/bossPersonas";
import { BossAvatar } from "./boss/BossAvatar";
import {
  canChallengeFinal,
  loadAllBossStates,
  loadBossState,
  type BossState,
} from "../lib/bossBattleState";

const G4B_UNITS = UNITS.filter((u) => u.term === "下册").sort(
  (a, b) => a.orderIndex - b.orderIndex,
);

const TOTAL_STARS = 6 * 4; // 24 颗（不含期末）
const FINAL_STARS = 4;     // 期末额外 4 颗

interface CardData {
  states: Map<string, BossState>;
  finalState: BossState;
  unlock: { unlocked: boolean; metCount: number; totalUnits: number; perfectCount: number };
  totalStars: number;
}

export function BossStarCard({ studentId }: { studentId: string }) {
  const [data, setData] = useState<CardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [states, finalState, unlock] = await Promise.all([
          loadAllBossStates(studentId),
          loadBossState(studentId, FINAL_BOSS.unitId),
          canChallengeFinal(studentId),
        ]);
        if (cancelled) return;
        let total = 0;
        for (const s of states.values()) total += s.bestStars;
        setData({ states, finalState, unlock, totalStars: total });
      } catch (e) {
        console.warn("[BossStarCard] load failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!data) {
    return (
      <section className="rounded-2xl border border-white/10 bg-ink-800/40 px-4 py-3">
        <div className="text-xs text-slate-500">闯关星章 · 加载中…</div>
      </section>
    );
  }

  const finalStars = data.finalState.bestStars;
  const grandTotal = data.totalStars + finalStars;
  const grandMax = TOTAL_STARS + FINAL_STARS; // 28
  const progressPct = Math.round((grandTotal / grandMax) * 100);
  const nothingYet = grandTotal === 0;

  // v0.31.94：紧凑模式 — 收起 6 单元 boss 详情到 <details>，默认只显示
  //   一行 hero summary（星章 + 进度条 + 数字 + 跳闯关按钮）。
  //   details 展开后看完整 boss 列表 + 期末解锁状态 + 底部统计。
  //   Bruce 反馈："hero 区头重，BossStarCard 合并 / 缩小 OK"。
  return (
    <details className="group rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-rose-500/5 px-4 py-2.5">
      <summary className="cursor-pointer list-none flex items-center gap-3 select-none">
        <span className="text-lg">🏆</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-display font-bold text-amber-200">闯关星章</span>
            <span className="text-xs text-amber-300/70 tabular-nums">
              {nothingYet ? "还没拿过星" : `${grandTotal} / ${grandMax} ⭐`}
            </span>
            {data.unlock.perfectCount > 0 && (
              <span className="text-[10px] text-amber-200/70">
                · 完美 {data.unlock.perfectCount}/6
              </span>
            )}
          </div>
          {/* 紧凑进度条 */}
          <div className="h-1 rounded-full bg-black/25 overflow-hidden mt-1.5 ring-1 ring-white/5">
            <div
              className="h-full bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300 shadow-glow-amber transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <Link
          to="/math/big-problems"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 text-xs px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-400/40 transition-colors"
        >
          闯 →
        </Link>
        <span className="text-amber-300/40 text-xs shrink-0 group-open:rotate-180 transition-transform">▾</span>
      </summary>

      {/* 展开内容：6 单元 boss + 期末 boss + 统计 */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {G4B_UNITS.map((u) => {
          const persona = UNIT_BOSSES.find((b) => b.unitId === u.id);
          const s = data.states.get(u.id);
          const stars = s?.bestStars ?? 0;
          const perfect = stars === 4;
          const untouched = !s || s.totalAttempts === 0;
          return (
            <div
              key={u.id}
              className={`flex items-center gap-2 ${
                untouched ? "text-slate-500 grayscale opacity-70" : "text-slate-200"
              }`}
            >
              <BossAvatar
                unitId={u.id}
                emoji={persona?.emoji ?? "👹"}
                size={28}
                className="shrink-0 rounded-md"
                alt={persona?.name ?? u.name}
              />
              <span className="flex-1 truncate">{persona?.name ?? u.name}</span>
              <StarsDisplay stars={stars} max={4} perfect={perfect} untouched={untouched} />
            </div>
          );
        })}
        <div
          className={`flex items-center gap-2 sm:col-span-2 mt-1 pt-1.5 border-t border-amber-400/20 ${
            data.unlock.unlocked ? "text-amber-200" : "text-slate-500 grayscale opacity-70"
          }`}
        >
          <BossAvatar
            unitId={FINAL_BOSS.unitId}
            emoji={FINAL_BOSS.emoji}
            size={32}
            className="shrink-0 rounded-md"
            alt={FINAL_BOSS.name}
          />
          <span className="flex-1 truncate font-bold">{FINAL_BOSS.name}</span>
          {data.unlock.unlocked ? (
            <StarsDisplay
              stars={finalStars}
              max={4}
              perfect={finalStars === 4}
              untouched={data.finalState.totalAttempts === 0}
            />
          ) : (
            <span className="text-[10px] text-slate-500">
              🔒 {data.unlock.metCount}/{data.unlock.totalUnits} 单元 ≥3★ 解锁
            </span>
          )}
        </div>
        {!nothingYet && (
          <div className="sm:col-span-2 mt-2 pt-2 border-t border-amber-400/15 text-[10px] text-amber-200/70 flex items-center gap-3 flex-wrap">
            <span>
              完美单元 <b className="font-display text-amber-100">{data.unlock.perfectCount}</b>/6
            </span>
            <span>·</span>
            <span>
              期末门槛 <b className="font-display text-amber-100">{data.unlock.metCount}</b>/6
            </span>
            {data.unlock.unlocked && finalStars < 4 && (
              <span className="ml-auto text-rose-200/80">👑 期末已解锁，全 4★ 才能拿满</span>
            )}
            {finalStars === 4 && data.unlock.perfectCount === 6 && (
              <span className="ml-auto text-amber-100">🎉 全 28 星！传说级！</span>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

function StarsDisplay({
  stars,
  max,
  perfect,
  untouched,
}: {
  stars: number;
  max: number;
  perfect: boolean;
  untouched: boolean;
}) {
  if (untouched) {
    return <span className="text-[10px] text-slate-600 tabular-nums">未挑战</span>;
  }
  return (
    <span
      className={`text-sm tracking-tighter tabular-nums leading-none ${
        perfect ? "text-amber-200" : "text-amber-300/80"
      }`}
      title={`${stars} / ${max} 星`}
    >
      {"★".repeat(stars)}
      <span className="opacity-30">{"☆".repeat(max - stars)}</span>
      {perfect && <span className="ml-1 text-[10px] text-amber-100">完美!</span>}
    </span>
  );
}
