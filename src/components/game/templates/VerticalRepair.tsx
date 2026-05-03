import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import type { Question } from "../../../core/types";

/**
 * 竖式修理厂：题面是一个有错误的竖式（用 subquestions 配置或自动生成）；
 * 让用户从 4 选 1 选择"哪一步算错了"，或者补一个空格。
 *
 * 优先使用 subquestions[0] 是 "choose" 类型时；否则把题目当成普通选择题。
 */
export function VerticalRepairPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const config = useMemo(() => deriveConfig(question), [question.question_id]);
  const [picked, setPicked] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const click = (id: string, ev: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || locked) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const opt = config.options.find((o) => o.id === id)!;
    const ok = opt.correct;
    setPicked(id);
    setLocked(true);
    if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    window.setTimeout(() => {
      onFinish({
        answer: id,
        isCorrect: ok,
        partialCorrect: false,
        matchedErrorTags: ok ? [] : opt.errorTag ? [opt.errorTag] : ["careless_reading"],
      });
    }, 260);
  };

  const showAnswer = disabled || locked;

  return (
    <div>
      <div className="text-slate-200 text-base mb-3 whitespace-pre-wrap">{question.stem}</div>
      {/* 竖式块 */}
      {config.lines.length > 0 && (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-4 font-mono text-2xl text-slate-100 inline-block min-w-[10rem]">
          {config.lines.map((ln, i) => (
            <div
              key={i}
              className={`text-right ${ln.kind === "result" ? "border-t border-white/30 pt-1" : ""} ${ln.highlight ? "text-amber-300" : ""}`}
            >
              {ln.kind === "op" ? <span className="mr-2">{ln.op ?? "×"}</span> : null}
              <span>{ln.value}</span>
            </div>
          ))}
        </div>
      )}
      <div className="text-violet-200 mb-2 text-sm">{config.prompt}</div>
      <div className="grid grid-cols-2 gap-3">
        {config.options.map((o) => {
          const isPicked = picked === o.id;
          let klass = "bubble";
          if (o.correct && (isPicked || showAnswer)) klass = "bubble bubble-correct";
          else if (isPicked && !o.correct) klass = "bubble bubble-wrong";
          else if (showAnswer) klass = "bubble bubble-dimmed";
          return (
            <button
              key={o.id}
              type="button"
              disabled={disabled || locked}
              onClick={(e) => click(o.id, e)}
              className={klass}
            >
              <span className="font-mono text-2xl">{o.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface RepairConfig {
  lines: { value: string; kind?: "op" | "result"; op?: string; highlight?: boolean }[];
  prompt: string;
  options: { id: string; text: string; correct: boolean; errorTag?: string }[];
}

function deriveConfig(q: Question): RepairConfig {
  // 优先：subquestions[0] 为 choose 类型
  const sub = q.subquestions?.[0];
  const lines = parseVerticalFromTags(q);

  if (sub && sub.kind === "choose") {
    return {
      lines,
      prompt: sub.prompt,
      options: sub.options.map((o) => ({
        id: o.id,
        text: o.text,
        correct: o.correct,
        errorTag: o.errorTag,
      })),
    };
  }
  // 退路：把 single_choice 的 options 作为选项展示
  if (q.question_format === "single_choice" && q.options && q.answer.type === "choice") {
    return {
      lines,
      prompt: "选出正确的答案：",
      options: q.options.map((o) => ({
        id: o.id,
        text: o.text,
        correct: q.answer.type === "choice" ? q.answer.value === o.id : false,
        errorTag: o.errorTag,
      })),
    };
  }
  // 兜底：一个 OK 选项
  return {
    lines,
    prompt: "选出正确答案：",
    options: [
      { id: "A", text: "继续", correct: true },
    ],
  };
}

/** 从 tags 里识别竖式行（如果题目用 tags `vert:6.5`, `op:×`, `vert:8`, `result:52`） */
function parseVerticalFromTags(q: Question): RepairConfig["lines"] {
  const out: RepairConfig["lines"] = [];
  for (const t of q.tags ?? []) {
    if (t.startsWith("vert:")) out.push({ value: t.slice(5) });
    else if (t.startsWith("op:")) out.push({ value: "", kind: "op", op: t.slice(3) });
    else if (t.startsWith("result:")) out.push({ value: t.slice(7), kind: "result" });
    else if (t.startsWith("hl:")) out.push({ value: t.slice(3), highlight: true });
  }
  return out;
}
