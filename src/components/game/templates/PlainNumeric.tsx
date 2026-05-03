import { useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import { gradeAttempt } from "../../../core/grading";

export function PlainNumericPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const [value, setValue] = useState("");
  const [locked, setLocked] = useState(false);
  const submit = (ev: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled || locked || !value.trim()) return;
    const result = gradeAttempt(question, value);
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    if (result.isCorrect) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    setLocked(true);
    onFinish({
      answer: value,
      isCorrect: result.isCorrect,
      partialCorrect: result.partialCorrect,
      matchedErrorTags: result.matchedErrorTags,
    });
  };
  return (
    <div>
      <div className="font-display text-2xl leading-tight mb-4 whitespace-pre-wrap">{question.stem}</div>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          inputMode="decimal"
          className="field text-2xl font-display"
          value={value}
          disabled={disabled || locked}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit(e);
          }}
          placeholder="答案"
        />
        <button type="button" className="btn-primary" disabled={disabled || locked || !value.trim()} onClick={submit}>
          确定
        </button>
      </div>
    </div>
  );
}
