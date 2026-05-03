import { useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import type { Question } from "../../../core/types";

/**
 * 快节奏判断题：题面给一个等式或陈述，左红 ✗ 右绿 ✓ 选一个。
 * Elevate 风格：每题 < 5 秒，强烈的左右色彩对比。
 *
 * 题目期望：
 *   answer.type === "choice"，value 为 "T" 或 "F"
 *   options 可以省略，自动用 ✓/✗
 */
export function TrueFalseSwipePanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const correct: "T" | "F" = inferTruth(question);
  const [picked, setPicked] = useState<"T" | "F" | null>(null);
  const [locked, setLocked] = useState(false);

  const click = (v: "T" | "F", ev: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || locked) return;
    setPicked(v);
    setLocked(true);
    const rect = ev.currentTarget.getBoundingClientRect();
    const ok = v === correct;
    if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    window.setTimeout(() => {
      onFinish({
        answer: v,
        isCorrect: ok,
        partialCorrect: false,
        matchedErrorTags: ok ? [] : ["careless_reading"],
      });
    }, 280);
  };

  const showAnswer = disabled || locked;
  const tBtnClass = (v: "T" | "F", base: string) => {
    const isPicked = picked === v;
    const isCorrect = correct === v;
    if (isCorrect && (isPicked || showAnswer)) return base + " bubble-correct";
    if (isPicked && !isCorrect) return base + " bubble-wrong";
    if (showAnswer) return base + " bubble-dimmed";
    return base;
  };

  return (
    <div>
      <div className="font-display font-bold text-3xl leading-tight mt-1 mb-8 whitespace-pre-wrap text-slate-50 text-center">
        {question.stem}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          disabled={disabled || locked}
          onClick={(e) => click("F", e)}
          className={tBtnClass("F", "bubble py-8 text-5xl font-bold border-rose-400/30")}
          aria-label="错"
        >
          <span className="text-rose-300">✗ 错</span>
        </button>
        <button
          type="button"
          disabled={disabled || locked}
          onClick={(e) => click("T", e)}
          className={tBtnClass("T", "bubble py-8 text-5xl font-bold border-emerald-400/30")}
          aria-label="对"
        >
          <span className="text-emerald-300">✓ 对</span>
        </button>
      </div>
    </div>
  );
}

/**
 * 从题目里推断真假：
 * - 若 answer.type === "choice" 且 value 是 "T" / "F"，直接用
 * - 否则若 question_format == "single_choice" 且只有 2 个 option（"对"/"错"或"是"/"否"），按选中 id 推断
 * - 兜底：true
 */
function inferTruth(q: Question): "T" | "F" {
  if (q.answer.type === "choice") {
    const choiceValue = q.answer.value;
    const v = choiceValue.toUpperCase();
    if (v === "T" || v === "TRUE" || v === "对" || v === "是") return "T";
    if (v === "F" || v === "FALSE" || v === "错" || v === "否") return "F";
    // 若 options 列表存在，按 id 找出是否标 correct
    const opt = (q.options ?? []).find((o) => o.id === choiceValue);
    if (opt) {
      const text = opt.text;
      if (/对|是|true|正确/i.test(text)) return "T";
      if (/错|否|false|不对/i.test(text)) return "F";
    }
  }
  return "T";
}
