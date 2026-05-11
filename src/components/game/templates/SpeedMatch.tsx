import { useEffect, useMemo, useRef, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import type { Question } from "../../../core/types";
import { adjustedEstimatedTime } from "../../../core/timing";

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

  // v0.31.90-91: 实时计时 — 跟 PlainChoice 区分的关键
  // v0.31.91 大改：闪电图标阶梯衰减视觉化 + 字号放大 + 蜗牛兜底
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
  // v0.31.98：阶梯改用 ratio (elapsed / estimated)，跟 scoring.ts::speedBonus 完全对齐
  //   →  ratio < 50%  → 3⚡ "闪电"  (lightning, +5)
  //   →  ratio < 80%  → 2⚡ "迅速"  (quick, +3)
  //   →  ratio ≤ 100% → 1⚡ "及时"  (on_time, +2)
  //   →  ratio > 100% → 🐌 "超时"  (overdue/slow)
  // 跟 GameShell 完成时显示的"⚡⚡⚡ 闪电 +5"等标签数量保持完全一致——
  // gameplay 时实时看到的 ⚡ 数量 = 完成后拿到的 ⚡ 数量。
  const estimatedSec = adjustedEstimatedTime(question);
  const ratio = elapsedMs / Math.max(1000, estimatedSec * 1000);
  const speedTier = ratio < 0.5 ? 3 : ratio < 0.8 ? 2 : ratio <= 1.0 ? 1 : 0;
  const speedIcon = speedTier === 0 ? "🐌" : "⚡".repeat(speedTier);
  const speedTierCls =
    speedTier === 3
      ? "text-emerald-300 border-emerald-400/60 bg-emerald-500/20"
      : speedTier === 2
        ? "text-amber-200 border-amber-400/60 bg-amber-500/20"
        : speedTier === 1
          ? "text-orange-200 border-orange-400/60 bg-orange-500/20"
          : "text-slate-400 border-slate-500/40 bg-slate-700/40";
  const speedTextHint =
    speedTier === 3
      ? "闪电速度"
      : speedTier === 2
        ? "保持节奏"
        : speedTier === 1
          ? "刚好赶上"
          : "超时啦";

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
      {/* v0.31.91：醒目速度面板 — 闪电图标随时间衰减（3⚡→2⚡→1⚡→🐌）+
          大字号 timer。视觉上跟 PlainChoice 完全区分。*/}
      <div
        className={`relative overflow-hidden rounded-2xl border-2 p-3 mb-4 transition-all ${speedTierCls}`}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`font-display font-bold text-3xl tabular-nums transition-all ${
                speedTier === 0 ? "scale-110" : ""
              }`}
              aria-hidden
            >
              {speedIcon}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider opacity-70 font-display font-bold">
                闪电匹配
              </div>
              <div className="text-[11px] mt-0.5 opacity-80">
                {speedTextHint}
              </div>
            </div>
          </div>
          <div
            className="font-display font-bold text-3xl tabular-nums shrink-0"
            aria-label={`已用 ${elapsedSec} 秒`}
          >
            <span className="opacity-50 text-xl mr-1">⏱</span>
            {elapsedSec}
            <span className="text-base opacity-70 ml-0.5">s</span>
          </div>
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
