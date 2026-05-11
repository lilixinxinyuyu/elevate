import { useEffect, useMemo, useRef, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import type { Question } from "../../../core/types";

/**
 * 闪电匹配 — v0.31.90 跟 PlainChoice 视觉差异化：
 *   - 顶部右上角：实时计时 chip（毫秒级，强化"速度"感）
 *   - 闪电图标 ⚡ 在 stem 旁边
 *   - 选项 grid 用更大的字号 + 更窄间距，强调"反应"而非"阅读"
 *   - 这个 panel 是 fluency 类训练的入口，整体节奏更快
 *
 * 跟 PlainChoice 的 schema 完全兼容（都 single_choice），只是渲染风格不同。
 */
export function SpeedMatchPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  // 防 memorize：每次进题用一个新随机 salt，让选项位置每次都洗。
  // 避免 Selena 记住"正确答案永远是第 3 个"。
  const sessionSalt = useMemo(() => Math.random().toString(36).slice(2), [question.question_id]);
  const options = useMemo(() => buildOptions(question, sessionSalt), [question.question_id, sessionSalt]);
  const [picked, setPicked] = useState<string | null>(null);
  const [lockedCorrect, setLockedCorrect] = useState(false);
  const [locked, setLocked] = useState(false);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());

  // v0.31.90: 实时计时 — 跟 PlainChoice 区分的关键
  const startMs = useRef<number>(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    startMs.current = Date.now();
    setElapsedMs(0);
    if (locked || disabled) return;
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startMs.current);
    }, 100);
    return () => window.clearInterval(id);
  }, [question.question_id, locked, disabled]);
  const elapsedSec = (elapsedMs / 1000).toFixed(1);
  // 速度反馈色：< 5s 绿；5-10s 琥珀；> 10s 灰
  const speedCls =
    elapsedMs < 5000
      ? "text-emerald-300 border-emerald-400/40 bg-emerald-500/15"
      : elapsedMs < 10000
        ? "text-amber-200 border-amber-400/40 bg-amber-500/15"
        : "text-slate-400 border-slate-500/40 bg-slate-500/15";

  const handlePick = (optId: string, ev: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || lockedCorrect || locked) return;
    const picked = options.find((o) => o.id === optId);
    if (!picked) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    if (picked.correct) {
      setPicked(optId);
      setLocked(true);
      setLockedCorrect(true);
      triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
      window.setTimeout(() => {
        onFinish({ answer: picked.display, isCorrect: true, partialCorrect: false, matchedErrorTags: [] });
      }, 350);
    } else {
      setPicked(optId);
      setLocked(true);
      setWrongIds((prev) => new Set(prev).add(optId));
      triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
      // 不立刻 onFinish：让她继续尝试；只记一次错
      window.setTimeout(() => {
        onFinish({
          answer: picked.display,
          isCorrect: false,
          partialCorrect: false,
          matchedErrorTags: picked.errorTag ? [picked.errorTag] : ["careless_reading"],
        });
      }, 350);
    }
  };

  return (
    <div className="relative">
      {/* v0.31.90: 顶部速度 chip — SpeedMatch 跟 PlainChoice 区分的关键 */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-amber-300 font-display font-bold uppercase tracking-wider">
          ⚡ 闪电匹配
        </div>
        <div
          className={`chip text-xs border tabular-nums font-mono px-2.5 py-1 transition-colors ${speedCls}`}
          aria-label={`已用 ${elapsedSec} 秒`}
        >
          ⏱ {elapsedSec}s
        </div>
      </div>
      <div className="font-display font-bold text-3xl leading-tight mt-1 mb-6 whitespace-pre-wrap text-slate-50">
        {question.stem}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const isWrong = wrongIds.has(opt.id);
          const isPicked = picked === opt.id;
          const showAnswer = disabled || locked;
          // 题目被锁定（无论本人选对还是选错），始终把正确答案高亮出来
          const reveal = showAnswer && opt.correct;
          const lit = lockedCorrect && opt.correct;
          let klass = "bubble";
          if (lit) klass = "bubble bubble-correct animate-pop";
          else if (reveal) klass = "bubble bubble-correct";
          else if (isPicked && isWrong) klass = "bubble bubble-wrong";
          else if (showAnswer) klass = "bubble bubble-dimmed";
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled || locked}
              onClick={(e) => handlePick(opt.id, e)}
              className={klass}
            >
              {opt.display}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface BubbleOption {
  id: string;
  display: string;
  correct: boolean;
  errorTag?: string;
}

function buildOptions(q: Question, salt: string): BubbleOption[] {
  // single_choice 走 options
  if (q.question_format === "single_choice" && q.options) {
    const opts = q.options.map((o) => ({
      id: o.id,
      display: o.text,
      correct: q.answer.type === "choice" && q.answer.value === o.id,
      errorTag: o.errorTag,
    }));
    return shuffleWithSeed(opts, `${q.question_id}::${salt}`);
  }
  // numeric / numeric_choice：用 distractors 或生成
  if (q.answer.type === "number") {
    const correct = q.answer.value;
    const distractors = (q.distractors ?? [])
      .map((d) => Number(d))
      .filter((n) => Number.isFinite(n) && n !== correct);
    const generated = generateDistractors(correct, q).filter((n) => n !== correct);
    const merged = uniqueNumbers([correct, ...distractors, ...generated]).slice(0, 4);
    while (merged.length < 4) {
      const fallback = correct + (merged.length + 1) * (correct === 0 ? 1 : sampleSign());
      if (!merged.includes(fallback)) merged.push(fallback);
    }
    const shuffled = shuffleWithSeed(merged, `${q.question_id}::${salt}`);
    return shuffled.map((n, i) => ({
      id: "ABCD"[i]!,
      display: formatNumber(n),
      correct: Math.abs(n - correct) < 1e-9,
    }));
  }
  // 兜底
  return [{ id: "A", display: "OK", correct: true }];
}

function sampleSign(): number {
  return Math.random() < 0.5 ? -1 : 1;
}

function uniqueNumbers(arr: number[]): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  for (const n of arr) {
    const key = n.toFixed(6);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function generateDistractors(correct: number, q: Question): number[] {
  const candidates = new Set<number>();
  const round = (x: number) => Math.round(x * 100) / 100;
  if (correct !== 0) {
    candidates.add(round(correct * 10));
    candidates.add(round(correct / 10));
    candidates.add(round(correct + 1));
    candidates.add(round(correct - 1));
  } else {
    candidates.add(1);
    candidates.add(2);
    candidates.add(0.1);
  }
  // 基于难度调整干扰项差距
  const step = Math.max(0.1, Math.abs(correct) * 0.1) * (q.difficulty ?? 2);
  candidates.add(round(correct + step));
  candidates.add(round(correct - step));
  return Array.from(candidates);
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}

function shuffleWithSeed<T>(arr: T[], seed: string): T[] {
  // FNV + LCG
  let s = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    s = Math.imul(s ^ seed.charCodeAt(i), 16777619) >>> 0;
  }
  const rng = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
