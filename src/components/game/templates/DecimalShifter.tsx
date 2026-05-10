import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import type { Question } from "../../../core/types";

/**
 * 小数点滑梯：题面给一个数 a 和倍率 m。
 *   tags 例: ["start:3.6", "factor:×10"]
 *   answer.value = 36
 *
 * 模型：用 `shift` 表示小数点相对原始位置的位移（>0 向右、<0 向左）。
 *  - 当向右越过最后一位 → 自动在末尾补 "0"（让 36 → 360）
 *  - 当向左越过第一位 → 自动在首位补 "0"（让 0.45 → 0.045）
 */
export function DecimalShifterPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const cfg = useMemo(() => parseConfig(question), [question.question_id]);
  const [shift, setShift] = useState(0);
  const [locked, setLocked] = useState(false);

  const view = useMemo(() => render(cfg, shift), [cfg, shift]);
  const currentValue = view.value;

  const move = (dir: -1 | 1) => {
    if (disabled || locked) return;
    setShift((s) => Math.max(-6, Math.min(6, s + dir)));
  };

  const submit = (ev: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || locked) return;
    setLocked(true);
    const rect = ev.currentTarget.getBoundingClientRect();
    const ok = Math.abs(currentValue - cfg.target) <= 1e-9;
    if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    onFinish({
      answer: prettyNumber(currentValue),
      isCorrect: ok,
      partialCorrect: false,
      matchedErrorTags: ok ? [] : ["decimal_point_error"],
    });
  };

  return (
    <div>
      <div className="font-display font-bold text-2xl mb-2 text-slate-100 whitespace-pre-wrap">
        {question.stem}
      </div>
      <div className="text-xs text-slate-400 mb-3">{cfg.factorLabel}</div>

      {/* digit row */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6 mb-3">
        <div className="flex items-center justify-center gap-1 font-mono">
          {view.digits.map((d, i) => (
            <span key={`d${i}`} className="relative">
              <span className="text-4xl text-slate-100 font-bold">{d}</span>
              {view.dotIndex === i + 1 && (
                <span
                  className="absolute -bottom-3 left-full text-3xl text-amber-300 leading-none animate-pulse-bar"
                  style={{ textShadow: "0 0 12px rgba(251,191,36,0.9)" }}
                >
                  .
                </span>
              )}
              {view.dotIndex === 0 && i === 0 && (
                <span
                  className="absolute -bottom-3 right-full text-3xl text-amber-300 leading-none animate-pulse-bar"
                  style={{ textShadow: "0 0 12px rgba(251,191,36,0.9)" }}
                >
                  .
                </span>
              )}
            </span>
          ))}
        </div>
        <div className="text-center mt-3">
          <span className="text-xs text-slate-400">当前</span>
          <span className="ml-2 font-display font-bold text-3xl text-amber-300" style={{ textShadow: "0 0 14px rgba(251,191,36,0.5)" }}>
            {prettyNumber(currentValue)}
          </span>
        </div>
      </div>

      <div className="flex justify-center items-center gap-3">
        <button
          type="button"
          disabled={disabled || locked || shift <= -6}
          onClick={() => move(-1)}
          className="bubble py-3 px-6 text-2xl"
          aria-label="小数点左移"
        >
          ← 左移
        </button>
        <button
          type="button"
          disabled={disabled || locked || shift >= 6}
          onClick={() => move(1)}
          className="bubble py-3 px-6 text-2xl"
          aria-label="小数点右移"
        >
          右移 →
        </button>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" disabled={disabled || locked} onClick={submit} className="btn-primary">
          确定
        </button>
      </div>
    </div>
  );
}

interface Cfg {
  baseDigits: string[];
  baseDotIndex: number; // 原始小数点位置
  baseValue: number;
  target: number;
  factorLabel: string;
}

function parseConfig(q: Question): Cfg {
  let startStr = "0";
  let factor = "";
  let shiftFromTag: number | null = null;
  for (const t of q.tags ?? []) {
    if (t.startsWith("start:")) startStr = t.slice(6);
    else if (t.startsWith("factor:")) factor = t.slice(7);
    else if (t.startsWith("shift:right:")) shiftFromTag = Number(t.slice(12));
    else if (t.startsWith("shift:left:")) shiftFromTag = -Number(t.slice(11));
  }
  // v0.31.75：target 解析多源 fallback —
  //   1. answer.type === "number" → answer.value（首选）
  //   2. answer.type === "choice" → 从 options 找正确 text 解析成数字（兼容 AI 写错的题）
  //   3. tags shift:right:N + start → 计算 target = start * 10^N（终极 fallback）
  let target = 0;
  const ans = q.answer;
  if (ans.type === "number") {
    target = ans.value;
  } else if (ans.type === "choice" && q.options) {
    const correctOpt = q.options.find((o) => o.id === ans.value);
    if (correctOpt) {
      const n = Number(correctOpt.text.replace(/[^\d.\-]/g, ""));
      if (!Number.isNaN(n)) target = n;
    }
  }
  if (target === 0 && shiftFromTag !== null) {
    const startNum = Number(startStr);
    if (!Number.isNaN(startNum)) target = startNum * Math.pow(10, shiftFromTag);
  }
  const dotIdx = startStr.indexOf(".");
  const digits = startStr.replace(".", "").split("");
  const baseDotIndex = dotIdx === -1 ? digits.length : dotIdx;
  return {
    baseDigits: digits,
    baseDotIndex,
    baseValue: Number(startStr),
    target,
    factorLabel: factor,
  };
}

function render(cfg: Cfg, shift: number): { digits: string[]; dotIndex: number; value: number } {
  // shift 表示"小数点向右移动多少位"
  let digits = cfg.baseDigits.slice();
  let dotIndex = cfg.baseDotIndex + shift;
  // 向右越界：在末尾补 0 直到 dotIndex 在 [0, digits.length] 内
  while (dotIndex > digits.length) {
    digits.push("0");
  }
  // 向左越界：在首部补 0
  while (dotIndex < 0) {
    digits.unshift("0");
    dotIndex += 1;
  }
  // 计算当前数值
  const intPart = digits.slice(0, dotIndex).join("") || "0";
  const fracPart = digits.slice(dotIndex).join("");
  const valueStr = fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart;
  const value = Number(valueStr);
  return { digits, dotIndex, value };
}

function prettyNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000000) / 1000000);
}
