import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import type { Question } from "../../../core/types";

/** 数字阶梯：把一组数字按从小到大排序（点选交换） */
export function SortLadderPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const items = useMemo(() => deriveItems(question), [question.question_id]);
  const [order, setOrder] = useState<number[]>(() => shuffleIdx(items.length, question.question_id));
  const [pickA, setPickA] = useState<number | null>(null);

  const swap = (i: number) => {
    if (disabled) return;
    if (pickA === null) {
      setPickA(i);
      return;
    }
    if (pickA === i) {
      setPickA(null);
      return;
    }
    const next = order.slice();
    [next[pickA], next[i]] = [next[i]!, next[pickA]!];
    setOrder(next);
    setPickA(null);
  };

  const submit = (ev: React.MouseEvent<HTMLButtonElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const sorted = items.slice().sort((a, b) => a - b);
    const ok = order.every((idx, i) => items[idx] === sorted[i]);
    if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    onFinish({
      answer: order.map((i) => items[i]),
      isCorrect: ok,
      partialCorrect: false,
      matchedErrorTags: ok ? [] : ["careless_reading"],
    });
  };

  return (
    <div>
      <div className="font-display text-xl mb-4 whitespace-pre-wrap">{question.stem}</div>
      <div className="text-xs text-slate-400 mb-2">点击两个卡片交换位置，让它们从小到大排列：</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {order.map((idx, i) => {
          const isA = pickA === i;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => swap(i)}
              className={`bubble py-4 text-xl ${isA ? "shadow-glow ring-2 ring-violet-300" : ""}`}
            >
              {items[idx]}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn-primary" disabled={disabled} onClick={submit}>
          完成
        </button>
      </div>
    </div>
  );
}

function deriveItems(q: Question): number[] {
  // 从 distractors + answer 取数；若不存在，按题干里的数字抽
  if (q.distractors && q.distractors.length >= 3) {
    return q.distractors.map((d) => Number(d)).filter((n) => Number.isFinite(n));
  }
  const nums = Array.from(q.stem.matchAll(/(\d+(?:\.\d+)?)/g)).map((m) => Number(m[1]));
  return nums.length >= 3 ? nums.slice(0, 4) : [1, 2, 3, 4];
}

function shuffleIdx(n: number, seed: string): number[] {
  let s = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) s = (Math.imul(s ^ seed.charCodeAt(i), 16777619)) >>> 0;
  const rng = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
