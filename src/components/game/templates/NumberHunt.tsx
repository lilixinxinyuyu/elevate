import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";

/**
 * 数字寻宝（Number Hunt） — v0.31.87
 *
 * 训练：找规律 / 数感 / 比较 / 快速心算
 *
 * 玩法：5×5 网格里 25 个数，按 stem 提示挑出 3-5 个符合条件的格子。
 * 例如："挑出所有大于 1.5 的小数" / "挑出 3 个相加和为 1 的"。
 *
 * 数据：question.number_hunt = { grid: number[25], rule: string, targetIndices: number[] }
 *
 * 设计：选中 = 紫色边 + 微微放大；锁定后正确变绿、错的标红、漏选的描金边。
 */
export function NumberHuntPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const spec = question.number_hunt;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [locked, setLocked] = useState(false);
  const [verdict, setVerdict] = useState<"none" | "ok" | "wrong">("none");

  const targetSet = useMemo(
    () => new Set(spec?.targetIndices ?? []),
    [spec?.targetIndices],
  );

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
      selected.size === targetSet.size &&
      [...selected].every((i) => targetSet.has(i));
    const rect = ev.currentTarget.getBoundingClientRect();
    if (isCorrect) {
      setVerdict("ok");
      triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "💎");
    } else {
      setVerdict("wrong");
      triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    }
    window.setTimeout(() => {
      onFinish({
        answer: [...selected].sort(),
        isCorrect,
        partialCorrect: false,
        matchedErrorTags: isCorrect ? [] : ["careless_reading"],
      });
    }, 450);
  }

  if (!spec) {
    return (
      <div>
        <div className="font-display font-bold text-2xl mb-4 whitespace-pre-wrap">
          {question.stem}
        </div>
        <div className="text-sm text-rose-300">⚠️ 数字寻宝数据缺失</div>
      </div>
    );
  }

  return (
    <div>
      <div className="font-display font-bold text-xl mb-1">{question.stem}</div>
      {spec.rule !== question.stem && (
        <div className="text-sm text-amber-200 mb-3">📌 {spec.rule}</div>
      )}

      {/* 进度提示 */}
      <div className="text-xs text-slate-400 mb-2">
        已选 <span className="font-bold text-violet-200">{selected.size}</span> 个
        {locked && (
          <span className="ml-2 text-slate-500">
            （目标 {targetSet.size} 个）
          </span>
        )}
      </div>

      {/* 5×5 网格 */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {spec.grid.map((n, i) => {
          const isSelected = selected.has(i);
          const isTarget = targetSet.has(i);
          let cls =
            "rounded-lg border-2 p-3 text-center font-display font-bold text-lg tabular-nums transition-all";
          if (!locked) {
            if (isSelected)
              cls += " bg-violet-500/30 border-violet-400/70 text-violet-100 scale-105";
            else cls += " bg-white/5 border-ink-700/60 text-slate-200 hover:bg-white/10";
          } else {
            // locked
            if (isSelected && isTarget)
              cls += " bg-emerald-500/25 border-emerald-400/70 text-emerald-100";
            else if (isSelected && !isTarget)
              cls += " bg-rose-500/20 border-rose-400/60 text-rose-100";
            else if (!isSelected && isTarget)
              cls += " bg-amber-500/15 border-amber-400/40 text-amber-200/80 ring-1 ring-amber-400/40";
            else cls += " bg-white/5 border-ink-700/40 text-slate-500 opacity-60";
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              disabled={disabled || locked}
              className={cls}
              aria-pressed={isSelected}
            >
              {formatNum(n)}
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
          {locked ? (verdict === "ok" ? "✓ 全找对了！" : "✗ 看正确答案") : "确认 →"}
        </button>
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}
