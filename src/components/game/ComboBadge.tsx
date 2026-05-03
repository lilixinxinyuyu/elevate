import { useEffect, useState } from "react";

export function ComboBadge({ combo }: { combo: number }) {
  const [bump, setBump] = useState(0);
  useEffect(() => {
    setBump((b) => b + 1);
  }, [combo]);
  if (combo < 2) return null;
  const tier = combo >= 10 ? 3 : combo >= 5 ? 2 : combo >= 3 ? 1 : 0;
  const emoji = tier === 3 ? "🔥🔥🔥" : tier === 2 ? "🔥🔥" : "🔥";
  const color =
    tier === 3 ? "text-rose-300 shadow-glow-rose" : tier === 2 ? "text-amber-300 shadow-glow-amber" : "text-amber-200";
  return (
    <div
      key={bump}
      className={`animate-combo-pop chip bg-ink-800/80 border border-amber-400/40 px-3 py-1.5 text-sm font-display ${color}`}
    >
      <span className="mr-1">{emoji}</span>
      <span className="font-bold">combo × {combo}</span>
    </div>
  );
}
