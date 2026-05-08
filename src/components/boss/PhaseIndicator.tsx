/**
 * PhaseIndicator — 显示当前在哪一阶段 (v0.31.49)
 */

export type Phase = "warmup" | "main" | "boss";

const PHASES: { id: Phase; label: string; emoji: string }[] = [
  { id: "warmup", label: "热身", emoji: "🔥" },
  { id: "main", label: "主战", emoji: "⚔️" },
  { id: "boss", label: "BOSS", emoji: "👑" },
];

export function phaseFromIndex(i: number): Phase {
  if (i < 2) return "warmup";
  if (i < 5) return "main";
  return "boss";
}

export function PhaseIndicator({ current }: { current: Phase }) {
  return (
    <div className="flex items-center gap-1.5">
      {PHASES.map((p, i) => {
        const isCurrent = p.id === current;
        const isPast = PHASES.findIndex((x) => x.id === current) > i;
        return (
          <div
            key={p.id}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-all ${
              isCurrent
                ? "bg-violet-500/30 text-violet-100 border border-violet-400/60"
                : isPast
                  ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30"
                  : "bg-ink-700/40 text-slate-500 border border-ink-700/60"
            }`}
          >
            <span>{isPast ? "✓" : p.emoji}</span>
            <span>{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}
