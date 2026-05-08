/**
 * HeartsBar — 红心生命显示 (v0.31.49)
 */

export function HeartsBar({
  hearts,
  max = 3,
}: {
  hearts: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`text-xl transition-all ${
            i < hearts ? "text-rose-400" : "text-slate-600 grayscale opacity-40"
          }`}
        >
          {i < hearts ? "❤️" : "🖤"}
        </span>
      ))}
    </div>
  );
}
