import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import type { Question } from "../../../core/types";
import { tryEvaluateExpression } from "../../../core/validateQuestion";

/**
 * 方程拼装：给出"题干 + 数字卡片 + 运算符卡片"，拖/点填入等式空格。
 * 我们用点选代替拖拽（手机更友好）。
 */
export function EquationBuilderPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const spec = useMemo(() => deriveEquationSpec(question), [question.question_id]);
  const [slots, setSlots] = useState<(string | null)[]>(() => spec.slots.map(() => null));
  const [pool, setPool] = useState<string[]>(spec.tokens);

  const placeToken = (tok: string, tokIdx: number) => {
    if (disabled) return;
    const firstEmpty = slots.findIndex((s) => s == null);
    if (firstEmpty < 0) return;
    const nextSlots = slots.slice();
    nextSlots[firstEmpty] = tok;
    setSlots(nextSlots);
    const nextPool = pool.slice();
    nextPool.splice(tokIdx, 1);
    setPool(nextPool);
  };

  const removeSlot = (slotIdx: number) => {
    if (disabled) return;
    const tok = slots[slotIdx];
    if (!tok) return;
    const nextSlots = slots.slice();
    nextSlots[slotIdx] = null;
    setSlots(nextSlots);
    setPool([...pool, tok]);
  };

  const submit = (ev: React.MouseEvent<HTMLButtonElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const filled = slots.every((s) => s != null);
    const expr = spec.assemble(slots.map((s) => s ?? ""));
    const ok = spec.check(expr);
    if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    onFinish({
      answer: expr,
      isCorrect: !!ok && filled,
      partialCorrect: !ok && filled,
      matchedErrorTags: ok ? [] : ["equation_setup_error"],
    });
  };

  return (
    <div>
      <div className="text-slate-300 text-sm mb-3 whitespace-pre-wrap">{question.stem}</div>
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center justify-center gap-2 flex-wrap text-2xl font-display font-bold">
        {spec.pretty.map((part, i) => {
          if (part.type === "text") return <span key={i} className="text-slate-100">{part.value}</span>;
          const slotIdx = part.slotIndex;
          const tok = slots[slotIdx];
          return (
            <button
              key={i}
              type="button"
              onClick={() => removeSlot(slotIdx)}
              className={`min-w-[3.25rem] h-12 px-2 rounded-xl border-2 border-dashed ${
                tok
                  ? "border-violet-300 bg-violet-500/20 text-violet-50"
                  : "border-white/20 bg-white/5 text-slate-500"
              }`}
            >
              {tok ?? "_"}
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <div className="text-xs text-slate-400 mb-2">点击数字或运算符填入上方空格：</div>
        <div className="flex flex-wrap gap-2">
          {pool.map((t, i) => (
            <button
              key={`${t}-${i}`}
              type="button"
              disabled={disabled}
              onClick={() => placeToken(t, i)}
              className="bubble py-3 px-4 text-2xl min-w-[3.5rem]"
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-secondary" disabled={disabled} onClick={() => { setSlots(spec.slots.map(() => null)); setPool(spec.tokens); }}>
          重置
        </button>
        <button type="button" className="btn-primary" disabled={disabled || slots.some((s) => s == null)} onClick={submit}>
          确定
        </button>
      </div>
    </div>
  );
}

interface EquationSpec {
  tokens: string[]; // 可用的 token 池（已含干扰）
  slots: null[];    // 空格数
  pretty: (
    | { type: "text"; value: string }
    | { type: "slot"; slotIndex: number }
  )[];
  assemble: (fills: string[]) => string;
  check: (expr: string) => boolean;
}

function deriveEquationSpec(q: Question): EquationSpec {
  // 优先使用 multi_step 的 equation 步
  if (q.answer.type === "multi_step") {
    const eqStep = q.answer.steps.find((s) => s.step_id === "equation" || s.step_id === "expression");
    if (eqStep && typeof eqStep.expected === "string") {
      return buildFromExpression(eqStep.expected, q);
    }
  }
  // 用 word_problem_steps.equation_or_expression
  const eq = q.word_problem_steps?.equation_or_expression;
  if (eq) return buildFromExpression(eq, q);
  // 兜底：把 answer 数字变成 a*b 的填空
  if (q.answer.type === "number") {
    return buildFromExpression(`${q.answer.value}`, q);
  }
  return buildFromExpression("1+1", q);
}

function buildFromExpression(expr: string, q: Question): EquationSpec {
  const tokens = tokenize(expr);
  // slot 化：数字替换为空格，运算符保留
  const pretty: EquationSpec["pretty"] = [];
  const slotTokens: string[] = [];
  let slotIdx = 0;
  for (const t of tokens) {
    if (/^\d+(\.\d+)?$/.test(t)) {
      pretty.push({ type: "slot", slotIndex: slotIdx });
      slotTokens.push(t);
      slotIdx += 1;
    } else {
      pretty.push({ type: "text", value: t });
    }
  }
  // 干扰数字
  const distractors = distractorNumbers(slotTokens.map(Number), q);
  const pool = shuffleSeeded([...slotTokens, ...distractors.map(String)], q.question_id);
  return {
    tokens: pool,
    slots: slotTokens.map(() => null),
    pretty,
    assemble: (fills) => {
      let i = 0;
      return pretty
        .map((p) => {
          if (p.type === "text") return p.value;
          return fills[i++] || "?";
        })
        .join("");
    },
    check: (assembled) => {
      const targetVal = tryEvaluateExpression(expr);
      const gotVal = tryEvaluateExpression(assembled);
      if (targetVal != null && gotVal != null) return Math.abs(targetVal - gotVal) < 1e-6;
      // 数字完全一致也算
      return normalize(assembled) === normalize(expr);
    },
  };
}

function tokenize(expr: string): string[] {
  // 把中文括号/符号转一下，然后按数字/运算符/括号拆
  const s = expr
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/\s+/g, "");
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/[\d.]/.test(c)) {
      let j = i;
      while (j < s.length && /[\d.]/.test(s[j]!)) j++;
      out.push(s.slice(i, j));
      i = j;
    } else {
      out.push(c);
      i += 1;
    }
  }
  return out;
}

function distractorNumbers(correct: number[], q: Question): number[] {
  const set = new Set<number>();
  for (const n of correct) {
    set.add(Math.round((n + 1) * 100) / 100);
    set.add(Math.round((n * 10) * 100) / 100);
  }
  const arr = Array.from(set).filter((x) => !correct.includes(x));
  return arr.slice(0, Math.max(1, q.difficulty - 1));
}

function shuffleSeeded<T>(arr: T[], seed: string): T[] {
  let s = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) s = (Math.imul(s ^ seed.charCodeAt(i), 16777619)) >>> 0;
  const rng = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/（/g, "(").replace(/）/g, ")");
}
