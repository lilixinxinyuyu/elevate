import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import { VerticalArithmetic } from "../VerticalArithmetic";
import type { OptionVisual } from "../../../core/types";

/**
 * v0.31.73：option text 渲染分级。
 *   1. 如果 option.visual = { type: "vertical_arithmetic", a, op, b, align } → 用结构化竖式组件
 *   2. 如果 option.text 含 \n 或包含 ──── 等横线字符 → 用 whitespace-pre + font-mono 让 ASCII 竖式对齐
 *   3. 否则普通文本
 *
 * 这样老题（option.text 已经是 ASCII art）立即看起来正常；新题用结构化字段更精确。
 */
function isAsciiVertical(text: string): boolean {
  if (typeof text !== "string") return false;
  return text.includes("\n") || /[─━━━]/.test(text);
}

function OptionContent({
  text,
  visual,
}: {
  text: string;
  visual?: OptionVisual;
}) {
  if (visual && visual.type === "vertical_arithmetic" && visual.a && visual.op && visual.b) {
    return (
      <VerticalArithmetic
        a={visual.a}
        op={visual.op}
        b={visual.b}
        align={visual.align ?? "decimal"}
      />
    );
  }
  if (isAsciiVertical(text)) {
    return (
      <span className="font-mono text-base leading-snug whitespace-pre block">
        {text}
      </span>
    );
  }
  return <>{text}</>;
}

export function PlainChoicePanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const [picked, setPicked] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const rawOptions = question.options ?? [];
  // v0.34.63 Q3 fix #1 防御层：理论上 resolve.ts 已经把 answer.type==="number" 的题
  // 重路由到 plain_numeric / speed_match，不会再到 PlainChoice。但万一漏网，警告 + 透明显示
  // —— 之前 correctId=null 会让所有点击都判错，灌 attempts.answer=["D"] 到 mistakes 库。
  if (question.answer.type !== "choice") {
    console.warn(
      `[PlainChoicePanel] q=${question.question_id} 不是 choice 答案 (type=${question.answer.type})，` +
        `理论上应被 resolve.ts 重路由。fallback 渲染会让所有选项都判错。`,
    );
  }
  const correctId = question.answer.type === "choice" ? question.answer.value : null;

  // 防 memorize 答案位置：每次进题都按本次会话的随机种子重排选项。
  // 同一题 Selena 看到的 A/B/C/D 内容顺序每次都不同 —— 没法死记"正确答案是 B"。
  // 不动 option.id（id 仍用作 correctId 比较），只洗渲染顺序。
  const sessionSalt = useMemo(() => Math.random().toString(36).slice(2), [question.question_id]);
  const options = useMemo(() => shuffleSeeded(rawOptions, `${question.question_id}::${sessionSalt}`), [rawOptions, sessionSalt]);
  // v0.31.76：检测 visual 重复退化 —— 当 ≥2 个选项的 visual 完全相同（AI 误把 visual
  // 当题面用而不是选项差异），直接禁用 visual 渲染，强制 fallback 到 text。
  // 否则 4 个选项视觉上一样，Selena 看不出区别。
  const visualDegenerate = useMemo(() => {
    const vstrings = options
      .filter((o) => (o as { visual?: unknown }).visual)
      .map((o) => JSON.stringify((o as { visual?: unknown }).visual));
    if (vstrings.length < 2) return false;
    return new Set(vstrings).size === 1; // 全相同 = 退化
  }, [options]);
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
        {options.map((o, i) => {
          // displayLabel 跟着洗后位置走（A/B/C/D），但 o.id 是真 id（用来对答案）。
          // 这样 Selena 看到的字母位置每次都变；脑子里记"正确选项内容"才行。
          const displayLabel = String.fromCharCode(65 + i);
          const isPicked = picked === o.id;
          const isCorrectOpt = o.id === correctId;
          const showAnswer = disabled || locked;
          let klass = "bubble";
          if (isCorrectOpt && (isPicked || showAnswer)) klass = "bubble bubble-correct";
          else if (isPicked && !isCorrectOpt) klass = "bubble bubble-wrong";
          else if (showAnswer) klass = "bubble bubble-dimmed";
          return (
            <button key={o.id} type="button" disabled={disabled || locked} onClick={(e) => pick(o.id, e)} className={klass}>
              <span className="mr-2 text-violet-200 font-bold">{displayLabel}.</span>
              <OptionContent
                text={o.text}
                visual={visualDegenerate ? undefined : o.visual}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function shuffleSeeded<T>(arr: T[], seed: string): T[] {
  const out = arr.slice();
  let s = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    s ^= seed.charCodeAt(i);
    s = Math.imul(s, 16777619) >>> 0;
  }
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
