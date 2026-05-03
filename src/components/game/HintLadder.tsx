import type { Hint } from "../../core/types";

export function HintLadder({
  hints,
  opened,
  onOpen,
  disabled,
}: {
  hints: Hint[];
  opened: number;
  onOpen: () => void;
  disabled?: boolean;
}) {
  const all = hints.length;
  const next = opened < all ? hints[opened] : null;
  const lastPenalty = next?.penalty ?? 1;
  return (
    <div className="space-y-2">
      {hints.slice(0, opened).map((h, i) => (
        <div
          key={i}
          className="animate-slide-up rounded-xl px-3 py-2 bg-amber-500/10 border border-amber-400/30 text-amber-100 text-sm"
        >
          <span className="mr-1 text-amber-300">💡</span>
          <span>{h.text}</span>
        </div>
      ))}
      {next && (
        <button
          type="button"
          disabled={disabled}
          onClick={onOpen}
          className="btn-ghost text-amber-200 border border-amber-400/30 hover:bg-amber-500/10 text-sm"
        >
          🔑 再给一条线索 <span className="ml-1 text-rose-300">-{lastPenalty}</span>
        </button>
      )}
      {opened >= all && all > 0 && (
        <div className="text-xs text-slate-400">已看完所有线索</div>
      )}
    </div>
  );
}
