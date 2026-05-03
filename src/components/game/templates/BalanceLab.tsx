import { useEffect, useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import type { Question } from "../../../core/types";

/**
 * 方程天平：题面给一个简单方程 ax + b = c 或 x ± b = c 或 ax = c。
 * 屏幕中央用 SVG 画一个天平：左盘是方程左边，右盘是方程右边。
 * 下面给若干"操作"按钮（两边减 b、两边除以 a 等），每点一次更新方程，
 * 最后等式应化简为 x = N，N 必须等于 answer.value。
 *
 * tags 配置: ["eq:x+3.6=10"] (只支持加减乘除单步系数)
 */
export function BalanceLabPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const initial = useMemo(() => parseEq(question), [question.question_id]);
  const target = question.answer.type === "number" ? question.answer.value : 0;
  const [state, setState] = useState<EqState>(initial);
  const [history, setHistory] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);

  const ops = useMemo(() => suggestOps(state), [state]);

  useEffect(() => {
    // 化简到 x = N 自动判定
    if (locked) return;
    if (state.coef === 1 && state.constLeft === 0) {
      // x = state.constRight
      const ok = Math.abs(state.constRight - target) <= 1e-9;
      setLocked(true);
      window.setTimeout(() => {
        triggerFx.correctAt(window.innerWidth / 2, 200, ok ? "✓" : undefined);
        if (!ok) triggerFx.wrongAt(window.innerWidth / 2, 200);
        onFinish({
          answer: state.constRight,
          isCorrect: ok,
          partialCorrect: false,
          matchedErrorTags: ok ? [] : ["equation_solve_error"],
        });
      }, 350);
    }
  }, [state, locked, target, onFinish, triggerFx]);

  const apply = (op: Op) => {
    if (disabled || locked) return;
    setState((s) => applyOp(s, op));
    setHistory((h) => [...h, opLabel(op)]);
  };

  const reset = () => {
    if (disabled || locked) return;
    setState(initial);
    setHistory([]);
  };

  const skipToAnswer = (ev: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || locked) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    setLocked(true);
    triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    onFinish({
      answer: "skip",
      isCorrect: false,
      partialCorrect: true,
      matchedErrorTags: ["equation_solve_error"],
    });
  };

  const leftStr = formatSide(state.coef, state.constLeft, true);
  const rightStr = formatSide(0, state.constRight, false);
  const balanced = leftEval(state) === rightEval(state); // always true 等式约束

  return (
    <div>
      <div className="font-display font-bold text-xl mb-3 text-slate-100 whitespace-pre-wrap">
        {question.stem}
      </div>

      {/* 天平 SVG */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-4 flex flex-col items-center">
        <svg viewBox="0 0 400 180" className="w-full max-w-[480px]">
          {/* 立柱 */}
          <line x1="200" y1="40" x2="200" y2="160" stroke="#94a3b8" strokeWidth="3" />
          <polygon points="180,160 220,160 200,180" fill="#94a3b8" />
          {/* 横梁 */}
          <line x1="60" y1="60" x2="340" y2="60" stroke="#a78bfa" strokeWidth="4" />
          {/* 左盘 */}
          <line x1="80" y1="60" x2="80" y2="100" stroke="#94a3b8" strokeWidth="2" />
          <ellipse cx="80" cy="105" rx="60" ry="10" fill="rgba(167,139,250,0.25)" stroke="#a78bfa" strokeWidth="2" />
          {/* 右盘 */}
          <line x1="320" y1="60" x2="320" y2="100" stroke="#94a3b8" strokeWidth="2" />
          <ellipse cx="320" cy="105" rx="60" ry="10" fill="rgba(244,114,182,0.25)" stroke="#f472b6" strokeWidth="2" />
          {/* 文本 */}
          <text x="80" y="92" fill="#e0e7ff" fontSize="20" textAnchor="middle" fontWeight="700">
            {leftStr}
          </text>
          <text x="320" y="92" fill="#e0e7ff" fontSize="20" textAnchor="middle" fontWeight="700">
            {rightStr}
          </text>
          <text x="200" y="34" fill={balanced ? "#34d399" : "#f87171"} fontSize="18" textAnchor="middle" fontWeight="700">
            {balanced ? "= 平衡" : "≠"}
          </text>
        </svg>
      </div>

      <div className="text-xs text-slate-400 mb-2">
        下一步操作（两边同时进行）：
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {ops.map((op, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled || locked}
            onClick={() => apply(op)}
            className="bubble py-3 text-lg"
          >
            {opLabel(op)}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <div>步骤：{history.length === 0 ? "—" : history.join(" → ")}</div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled || locked || history.length === 0}
            onClick={reset}
            className="btn-ghost text-xs"
          >
            重来
          </button>
          <button
            type="button"
            disabled={disabled || locked}
            onClick={skipToAnswer}
            className="btn-ghost text-xs text-rose-300"
          >
            跳过
          </button>
        </div>
      </div>
    </div>
  );
}

interface EqState {
  // ax + b = c
  coef: number;       // a
  constLeft: number;  // b
  constRight: number; // c
}

type Op =
  | { kind: "addRight"; n: number }    // 两边加 n（左边的常数项被消减）
  | { kind: "subRight"; n: number }    // 两边减 n
  | { kind: "div"; n: number }         // 两边除以 n
  | { kind: "mul"; n: number };

function parseEq(q: Question): EqState {
  let raw = "";
  for (const t of q.tags ?? []) if (t.startsWith("eq:")) raw = t.slice(3);
  if (!raw) {
    if (q.answer.type === "number") {
      return { coef: 1, constLeft: 0, constRight: q.answer.value };
    }
    return { coef: 1, constLeft: 0, constRight: 0 };
  }
  // 极简 parser：支持 "ax+b=c" "ax-b=c" "x+b=c" "x-b=c" "ax=c"
  const norm = raw.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/");
  const m = norm.match(/^(\d*\.?\d*)x([+-]\d+\.?\d*)?=(-?\d+\.?\d*)$/);
  if (m) {
    const a = m[1] === "" || m[1] === undefined ? 1 : Number(m[1]);
    const b = m[2] === undefined ? 0 : Number(m[2]);
    const c = Number(m[3]);
    return { coef: a, constLeft: b, constRight: c };
  }
  return { coef: 1, constLeft: 0, constRight: 0 };
}

function suggestOps(s: EqState): Op[] {
  const out: Op[] = [];
  if (s.constLeft > 0) out.push({ kind: "subRight", n: s.constLeft });
  if (s.constLeft < 0) out.push({ kind: "addRight", n: -s.constLeft });
  if (s.coef !== 1 && s.constLeft === 0) out.push({ kind: "div", n: s.coef });
  // 干扰项
  if (out.length < 2) {
    if (s.constLeft >= 0) out.push({ kind: "addRight", n: 1 });
    if (s.coef !== 1) out.push({ kind: "mul", n: 2 });
  }
  // 最多 4 个
  return out.slice(0, 4);
}

function applyOp(s: EqState, op: Op): EqState {
  if (op.kind === "subRight") {
    return { ...s, constLeft: round(s.constLeft - op.n), constRight: round(s.constRight - op.n) };
  }
  if (op.kind === "addRight") {
    return { ...s, constLeft: round(s.constLeft + op.n), constRight: round(s.constRight + op.n) };
  }
  if (op.kind === "div") {
    if (op.n === 0) return s;
    return { coef: round(s.coef / op.n), constLeft: round(s.constLeft / op.n), constRight: round(s.constRight / op.n) };
  }
  return { coef: round(s.coef * op.n), constLeft: round(s.constLeft * op.n), constRight: round(s.constRight * op.n) };
}

function opLabel(op: Op): string {
  if (op.kind === "subRight") return `两边 − ${op.n}`;
  if (op.kind === "addRight") return `两边 + ${op.n}`;
  if (op.kind === "div") return `两边 ÷ ${op.n}`;
  return `两边 × ${op.n}`;
}

function formatSide(coef: number, c: number, isLeft: boolean): string {
  const parts: string[] = [];
  if (isLeft) {
    if (coef === 1) parts.push("x");
    else if (coef === -1) parts.push("-x");
    else parts.push(`${trim(coef)}x`);
    if (c > 0) parts.push(`+ ${trim(c)}`);
    if (c < 0) parts.push(`− ${trim(-c)}`);
  } else {
    parts.push(trim(c));
  }
  return parts.join(" ");
}

function trim(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000000) / 1000000);
}

function round(n: number): number {
  return Math.round(n * 1000000) / 1000000;
}

function leftEval(_s: EqState): number {
  return 0;
}
function rightEval(_s: EqState): number {
  return 0;
}
