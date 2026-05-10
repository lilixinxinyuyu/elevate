/**
 * HeartsBar — 红心生命显示 (v0.31.49)
 *
 * v0.31.84：默认 max=2 同步 BossBattle.MAX_HEARTS。之前 max=3 默认 + BossBattle
 * 不传 max → Selena 一进闯关就看到 2 红 + 1 灰 = "开局就掉一血"的视觉错觉。
 * BossBattle 也显式传 max={MAX_HEARTS} 避免再走默认。
 */
export function HeartsBar({
  hearts,
  max = 2,
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
