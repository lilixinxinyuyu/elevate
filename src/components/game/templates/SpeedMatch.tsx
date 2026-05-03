import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import type { Question } from "../../../core/types";

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
    <div>
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
