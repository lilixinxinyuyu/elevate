/**
 * BossPanel — boss 头像 + HP 条 + 名字 + 台词 (v0.31.49)
 */

import type { BossPersona } from "../../core/bossPersonas";
import { COLOR_CLASSES } from "../../core/bossPersonas";
import { BossAvatar } from "./BossAvatar";

export function BossPanel({
  boss,
  hpPct,
  enraged = false,
}: {
  boss: BossPersona;
  hpPct: number; // 0..1
  enraged?: boolean;
}) {
  const cls = COLOR_CLASSES[boss.color];
  const hpW = Math.max(0, Math.min(100, Math.round(hpPct * 100)));
  return (
    <div
      className={`rounded-2xl border-2 bg-gradient-to-br ${cls.from} ${cls.to} ${cls.border} p-3 ${enraged ? "animate-pulse-soft" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className={`shrink-0 ${enraged ? "animate-shake" : ""}`}>
          <BossAvatar
            unitId={boss.unitId}
            emoji={boss.emoji}
            size={64}
            className="rounded-xl"
            alt={boss.name}
            state={enraged ? "enraged" : "normal"}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-display font-bold text-lg ${cls.text} truncate`}>
            {boss.name}
            {enraged && (
              <span className="ml-1.5 text-rose-300 text-xs animate-pulse">
                · 🔥 狂怒态
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-300 italic truncate">
            "{boss.tagline}"
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-black/40 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${cls.hpFrom} ${cls.hpTo} transition-all duration-500`}
              style={{ width: `${hpW}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
            HP {hpW}%
          </div>
        </div>
      </div>
    </div>
  );
}
