import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";

/**
 * 凑钱（Coin Combo） — v0.31.87
 *
 * 训练：小数加法 / 元角分换算 / 找零思维
 *
 * 玩法：给 N 张面值 chip + 一个目标金额，玩家点击勾选凑出目标。
 * - 选中的 chip 飞到右侧"钱袋"区域累加
 * - 当前累加值 vs 目标 实时显示
 * - 点击"结算" → 判对错
 *
 * 数据：question.coin_combo = { coins: number[], target: number, correctIndices: number[] }
 *
 * 设计取舍：之所以是"勾选"而不是"拖拽"——拖拽在 mobile 上手感差，
 * 勾选 + 视觉反馈（选中飞到钱袋）一样有"凑"的体感，且无障碍更好。
 */
export function CoinComboPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const spec = question.coin_combo;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [locked, setLocked] = useState(false);
  const [verdict, setVerdict] = useState<"none" | "ok" | "wrong">("none");

  const coins = spec?.coins ?? [];
  const target = spec?.target ?? 0;
  const correctSet = useMemo(
    () => new Set(spec?.correctIndices ?? []),
    [spec?.correctIndices],
  );

  const sum = useMemo(() => {
    let s = 0;
    for (const i of selected) s += coins[i] ?? 0;
    // 浮点误差防护 — 元角分两位小数足够
    return Math.round(s * 100) / 100;
  }, [selected, coins]);

  const diff = Math.round((sum - target) * 100) / 100;

  function toggle(idx: number) {
    if (disabled || locked) return;
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function settle(ev: React.MouseEvent<HTMLButtonElement>) {
    if (disabled || locked) return;
    setLocked(true);
    const isCorrect =
      selected.size === correctSet.size &&
      [...selected].every((i) => correctSet.has(i));
    const rect = ev.currentTarget.getBoundingClientRect();
    if (isCorrect) {
      setVerdict("ok");
      triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "🪙");
      // v0.31.93: 钱币 burst
      triggerFx.burstAt(rect.left + rect.width / 2, rect.top, ["🪙", "💰", "💎", "✨"], 8);
    } else {
      setVerdict("wrong");
      triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    }
    window.setTimeout(() => {
      onFinish({
        answer: [...selected].sort(),
        isCorrect,
        partialCorrect: false,
        matchedErrorTags: isCorrect ? [] : ["coin_mismatch"],
      });
    }, 450);
  }

  if (!spec) {
    return (
      <div>
        <div className="font-display font-bold text-2xl mb-4 whitespace-pre-wrap">
          {question.stem}
        </div>
        <div className="text-sm text-rose-300">⚠️ 凑钱题数据缺失</div>
      </div>
    );
  }

  return (
    <div>
      <div className="font-display font-bold text-xl mb-1">{question.stem}</div>
      <div className="text-sm text-slate-300 mb-4">
        点选下面的钱凑出目标金额
      </div>

      {/* 累加显示条 */}
      <div className="rounded-2xl bg-ink-900/60 border border-ink-700/60 p-4 mb-4 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-slate-400">已凑</div>
          <div
            className={`font-display font-bold text-3xl tabular-nums ${
              locked
                ? verdict === "ok"
                  ? "text-emerald-300"
                  : "text-rose-300"
                : sum === target
                  ? "text-amber-300"
                  : "text-violet-200"
            }`}
          >
            ¥{formatPrice(sum)}
          </div>
        </div>
        <div className="text-amber-300 text-2xl">→</div>
        <div className="text-right">
          <div className="text-[11px] text-slate-400">目标</div>
          <div className="font-display font-bold text-3xl text-amber-200 tabular-nums">
            ¥{formatPrice(target)}
          </div>
        </div>
        {!locked && diff !== 0 && (
          <div className={`text-xs ${diff > 0 ? "text-rose-300" : "text-amber-300"}`}>
            {diff > 0 ? `+¥${formatPrice(diff)}` : `差 ¥${formatPrice(-diff)}`}
          </div>
        )}
      </div>

      {/* 钱币 chip */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
        {coins.map((c, i) => {
          const isSelected = selected.has(i);
          const isCorrectAfter = locked && correctSet.has(i);
          const isWrongPicked = locked && isSelected && !correctSet.has(i);
          const isMissedAfter = locked && !isSelected && correctSet.has(i);
          let cls =
            "rounded-2xl border-2 p-3 text-center font-display font-bold text-lg transition-all tabular-nums";
          if (isSelected && !locked)
            cls += " bg-amber-500/25 border-amber-400/70 text-amber-100 scale-105";
          else if (isCorrectAfter && isSelected)
            cls += " bg-emerald-500/25 border-emerald-400/70 text-emerald-100";
          else if (isWrongPicked) cls += " bg-rose-500/25 border-rose-400/70 text-rose-100";
          else if (isMissedAfter)
            cls += " bg-amber-500/15 border-amber-400/40 text-amber-200/80 ring-1 ring-amber-400/40";
          else cls += " bg-white/5 border-ink-700/60 text-slate-200 hover:bg-white/10";
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              disabled={disabled || locked}
              className={cls}
              aria-pressed={isSelected}
            >
              <div className="text-xs opacity-60">¥</div>
              <div>{formatPrice(c)}</div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={settle}
          disabled={disabled || locked || selected.size === 0}
          className="btn-primary text-sm px-5 py-2 disabled:opacity-40"
        >
          {locked ? (verdict === "ok" ? "✓ 凑对了！" : "✗ 不对，看正确组合") : "结算 →"}
        </button>
      </div>
    </div>
  );
}

function formatPrice(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}
