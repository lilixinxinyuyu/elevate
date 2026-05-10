/**
 * LifelineButton — 求小进救场 (v0.31.49)
 *
 * 救场配额跟数学段位绑定：
 *   school: 1 次       district: 1 次 + 答对回血
 *   city: 2 次免扣分   province: 2 次 + 听完整解题
 *   country: 3 次 + boss HP -10%
 *
 * 点击后展开 modal，二选一：
 *   1. 看提示（unlock 该题所有 hint，free if city+ tier）
 *   2. 跳过（不计 wrong/right，不扣心，0 XP）
 *   3. 取消
 */

import { useState } from "react";
import type { RescueAllowance } from "../../core/bossPersonas";

export type LifelineChoice = "hint" | "skip" | "explain";

export function LifelineButton({
  remaining,
  allowance,
  onUse,
  disabled = false,
}: {
  remaining: number;
  allowance: RescueAllowance;
  onUse: (choice: LifelineChoice) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const exhausted = remaining <= 0;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || exhausted}
        className={`chip text-xs px-3 py-1.5 transition-all ${
          exhausted
            ? "bg-slate-700/30 text-slate-500 border border-slate-600/40 cursor-not-allowed"
            : "bg-amber-500/20 text-amber-100 border border-amber-400/40 hover:bg-amber-500/30 hover:scale-105"
        }`}
        title={exhausted ? "本场救场已用完" : `求小进救场（${remaining} 次剩余）`}
      >
        📞 求小进 {exhausted ? "(已用完)" : `×${remaining}`}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setOpen(false)}>
          <div
            className="card-glow max-w-sm w-full bg-gradient-to-br from-amber-500/20 to-orange-500/15 border-amber-400/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-3">
              <div className="text-4xl">📞</div>
              <div className="font-display font-bold text-lg text-amber-100 mt-1">
                小进救场
              </div>
              <div className="text-xs text-slate-300 mt-1">
                选一种方式（用完后剩 {remaining - 1} 次）
              </div>
            </div>
            <div className="space-y-2">
              <ChoiceCard
                emoji="💡"
                title="看提示"
                desc={
                  allowance.freeXpPenalty
                    ? "展开本题所有提示 · 免 XP 扣分"
                    : "展开本题所有提示 · 答对仍 -3 XP"
                }
                onClick={() => {
                  onUse("hint");
                  setOpen(false);
                }}
              />
              {/* v0.31.74：所有段位都能让小进讲题（之前只有省级解锁，限制太苛）*/}
              <ChoiceCard
                emoji="🧙‍♀️"
                title="让小进讲题"
                desc="小进苏格拉底式一步步引导，比 hint 详细"
                onClick={() => {
                  onUse("explain");
                  setOpen(false);
                }}
              />
              <ChoiceCard
                emoji="⏩"
                title="跳过本题"
                desc="不扣心也不算对·获 0 XP"
                onClick={() => {
                  onUse("skip");
                  setOpen(false);
                }}
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full mt-2 text-xs text-slate-400 hover:text-slate-200 py-2"
              >
                取消（不消耗救场）
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ChoiceCard({
  emoji,
  title,
  desc,
  onClick,
}: {
  emoji: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full p-3 rounded-xl border border-amber-400/30 bg-amber-500/10 hover:bg-amber-500/20 hover:scale-[1.01] transition-all text-left"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{emoji}</span>
        <div className="flex-1">
          <div className="font-semibold text-amber-100 text-sm">{title}</div>
          <div className="text-[11px] text-slate-300 mt-0.5">{desc}</div>
        </div>
        <span className="text-amber-300">→</span>
      </div>
    </button>
  );
}
