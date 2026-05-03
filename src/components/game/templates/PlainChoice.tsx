import { useState } from "react";
import type { TemplateRenderProps } from "../GameShell";

export function PlainChoicePanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const [picked, setPicked] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const options = question.options ?? [];
  const correctId = question.answer.type === "choice" ? question.answer.value : null;
  const pick = (id: string, ev: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || locked) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const ok = id === correctId;
    setPicked(id);
    setLocked(true);
    if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    const opt = options.find((o) => o.id === id);
    window.setTimeout(() => {
      onFinish({
        answer: id,
        isCorrect: ok,
        partialCorrect: false,
        matchedErrorTags: ok ? [] : opt?.errorTag ? [opt.errorTag] : [],
      });
    }, 280);
  };
  return (
    <div>
      <div className="font-display text-2xl leading-snug mb-4 whitespace-pre-wrap">{question.stem}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((o) => {
          const isPicked = picked === o.id;
          const isCorrectOpt = o.id === correctId;
          const showAnswer = disabled || locked;
          let klass = "bubble";
          if (isCorrectOpt && (isPicked || showAnswer)) klass = "bubble bubble-correct";
          else if (isPicked && !isCorrectOpt) klass = "bubble bubble-wrong";
          else if (showAnswer) klass = "bubble bubble-dimmed";
          return (
            <button key={o.id} type="button" disabled={disabled || locked} onClick={(e) => pick(o.id, e)} className={klass}>
              <span className="mr-2 text-violet-200 font-bold">{o.id}.</span>
              {o.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
