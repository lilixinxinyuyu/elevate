/**
 * DefeatScreen — boss 战失败 (hearts=0) 结算 (v0.31.49)
 */

import { Link } from "react-router-dom";
import type { BossPersona } from "../../core/bossPersonas";

export function DefeatScreen({
  boss,
  correct,
  totalAnswered,
  onRetry,
}: {
  boss: BossPersona;
  correct: number;
  totalAnswered: number;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-4 animate-slide-up text-center">
      <div className="card-glow bg-gradient-to-br from-rose-500/20 to-slate-700/15 border-2 border-rose-400/50">
        <div className="text-6xl">😵</div>
        <div className="font-display font-bold text-2xl mt-2 text-rose-100">心碎了…</div>
        <div className="text-sm text-slate-300 mt-1">
          {boss.emoji} {boss.name} 暂时获胜了
        </div>
        <div className="mt-3 text-xs text-slate-400">
          答对 {correct} / {totalAnswered}（中途没坚持到底）
        </div>
        <div className="mt-3 text-xs text-amber-200/80">
          💪 不慌，再战回来！可以先去练几道 skill 题再来挑战。
        </div>
      </div>
      <div className="flex gap-2 justify-center">
        <button type="button" onClick={onRetry} className="btn-primary">
          🔄 再战
        </button>
        <Link to="/math/skills" className="btn-secondary">
          先去练 skill →
        </Link>
        <Link to="/math/big-problems" className="btn-secondary">
          回闯关世界
        </Link>
      </div>
    </div>
  );
}
