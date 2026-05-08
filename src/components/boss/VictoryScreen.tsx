/**
 * VictoryScreen — boss 通关结算 (v0.31.49)
 */

import { Link } from "react-router-dom";
import type { BossPersona } from "../../core/bossPersonas";
import { COLOR_CLASSES } from "../../core/bossPersonas";

export function VictoryScreen({
  boss,
  stars,
  bestStarsBefore,
  correct,
  total,
  xpEarned,
  unlockedTrophy,
  onRetry,
}: {
  boss: BossPersona;
  stars: 1 | 2 | 3 | 4;
  bestStarsBefore: number;
  correct: number;
  total: number;
  xpEarned: number;
  unlockedTrophy?: string | null;
  onRetry: () => void;
}) {
  const cls = COLOR_CLASSES[boss.color];
  const newRecord = stars > bestStarsBefore;
  return (
    <div className="space-y-4 animate-slide-up text-center">
      <div className={`card-glow bg-gradient-to-br ${cls.from} ${cls.to} ${cls.border} border-2`}>
        <div className="text-6xl">🏆</div>
        <div className={`font-display font-bold text-3xl mt-2 ${cls.text}`}>通关！</div>
        <div className="text-sm text-slate-300 mt-1">
          击败了 <span className="font-semibold">{boss.emoji} {boss.name}</span>
        </div>
        <div className="mt-4 flex justify-center gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`text-4xl ${i <= stars ? "text-amber-300 animate-pop" : "text-slate-600 grayscale opacity-30"}`}
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              {i <= stars ? "⭐" : "☆"}
            </span>
          ))}
        </div>
        {newRecord && (
          <div className="mt-3 text-emerald-300 font-semibold text-sm">
            🎉 新纪录！历史最佳 {bestStarsBefore} ★ → {stars} ★
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center">
          <div className="text-[11px] text-slate-400">答对</div>
          <div className="font-display font-bold text-2xl text-emerald-300">{correct}/{total}</div>
        </div>
        <div className="card text-center">
          <div className="text-[11px] text-slate-400">正确率</div>
          <div className="font-display font-bold text-2xl text-amber-300">
            {Math.round((correct / total) * 100)}%
          </div>
        </div>
        <div className="card text-center">
          <div className="text-[11px] text-slate-400">XP</div>
          <div className="font-display font-bold text-2xl text-cyan-300">+{xpEarned}</div>
        </div>
      </div>

      {unlockedTrophy && (
        <div className="card-glow bg-amber-500/15 border-amber-400/50">
          <div className="text-2xl">🏅</div>
          <div className="text-sm text-amber-100 mt-1">解锁勋章：{unlockedTrophy}</div>
        </div>
      )}

      <div className="flex gap-2 justify-center">
        {stars < 4 ? (
          <button type="button" onClick={onRetry} className="btn-primary">
            🔥 再战满星
          </button>
        ) : (
          <button type="button" onClick={onRetry} className="btn-secondary">
            🔄 再战巩固
          </button>
        )}
        <Link to="/math/big-problems" className="btn-secondary">
          回闯关世界
        </Link>
      </div>
    </div>
  );
}
