import { levelFromXp, xpToNextLevel } from "../../core/scoring";

export function XpBar({ xp }: { xp: number }) {
  const level = levelFromXp(xp);
  const { into, total } = xpToNextLevel(xp);
  const pct = Math.max(0, Math.min(100, (into / total) * 100));
  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <div className="chip bg-gradient-to-br from-violet-500 to-pink-500 text-white font-display font-bold px-2.5 py-1 shadow-glow">
        Lv {level}
      </div>
      <div className="flex-1">
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-2 bg-gradient-to-r from-amber-300 to-orange-400 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">
          XP {into} / {total}
        </div>
      </div>
    </div>
  );
}
