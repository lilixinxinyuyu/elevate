import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import type { ClueSubquestion, Question } from "../../../core/types";

/**
 * 线索侦探：单步线索多选，后继动作交给上一级（被 ShopCounter 也能包住）。
 * 这里作为独立模板展现——题目直接指向"挑出哪些是/不是线索"。
 */
export function ClueFinderPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const sub = useMemo(() => pickClueSub(question), [question.question_id]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const target = new Set(sub.correct);

  const toggle = (i: number) => {
    if (disabled) return;
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  };

  const submit = (ev: React.MouseEvent<HTMLButtonElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const sel = Array.from(selected).sort();
    const tgt = Array.from(target).sort();
    const ok = sel.length === tgt.length && sel.every((v, i) => v === tgt[i]);
    if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    onFinish({
      answer: sel,
      isCorrect: ok,
      partialCorrect: !ok && sel.some((x) => target.has(x)),
      matchedErrorTags: ok ? [] : ["careless_reading"],
    });
  };

  return (
    <div>
      <div className="text-slate-200 mb-3 whitespace-pre-wrap text-sm">{question.stem}</div>
      <div className="text-base text-violet-200 font-medium mb-3">
        {sub.prompt}
        <span className="ml-2 text-xs text-slate-400">
          （{sub.mode === "pick_correct" ? "挑出真正的线索" : "挑出跟题目无关的"}）
        </span>
      </div>
      <div className="space-y-2">
        {sub.clues.map((c, i) => {
          const on = selected.has(i);
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => toggle(i)}
              className={`w-full text-left rounded-xl border px-3 py-3 transition-all active:scale-[0.98] ${
                on
                  ? "border-violet-400 bg-violet-500/20 text-violet-50 shadow-glow"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              <span className={`inline-block mr-2 w-5 h-5 rounded border align-middle ${on ? "bg-violet-400 border-violet-300" : "border-white/20"}`}>
                {on && <span className="block text-center text-xs text-ink-900 font-bold leading-5">✓</span>}
              </span>
              {c}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn-primary" disabled={disabled || selected.size === 0} onClick={submit}>
          我选好了
        </button>
      </div>
    </div>
  );
}

function pickClueSub(q: Question): ClueSubquestion {
  const sub = q.subquestions?.find((s) => s.kind === "clue_pick") as ClueSubquestion | undefined;
  if (sub) return sub;
  // 从 word_problem_steps.known 生成：全选为正确
  const known = q.word_problem_steps?.known ?? [];
  return {
    kind: "clue_pick",
    prompt: "挑出这道题用到的已知信息：",
    clues: known.length > 0 ? known : [q.stem],
    correct: known.map((_, i) => i),
    mode: "pick_correct",
  };
}
