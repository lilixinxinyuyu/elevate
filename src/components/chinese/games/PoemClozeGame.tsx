/**
 * 古诗 / 段落填空 — 字池选字塞进 ___ 占位。
 *
 * 玩法：上面是题面（"___ 时节雨纷纷"），___ 是空格槽位；下面是字池（含答案 + 干扰）。
 * 点字池里的字 → 自动填入第一个空槽位；点空槽 = 撤掉那个字回字池；点提交按钮判分。
 *
 * 适合：
 *   - 古诗背诵填空（清明 / 江南春 等）
 *   - 课内段落填空（生词、四字成语补全）
 *
 * 灵感：Elevate Reading 的 inline cloze。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { sfx } from "../../../lib/sfx";
import type { ChinesePoemClozeData } from "../../../core/types";

interface PoemClozeGameProps {
  data: ChinesePoemClozeData;
  onResult: (result: { correct: boolean; meta?: Record<string, unknown> }) => void;
  frozen: boolean;
}

const PLACEHOLDER = "___";

interface PoolChip {
  id: string;
  text: string;
}

function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i]!, out[j]!] = [out[j]!, out[i]!];
  }
  return out;
}

export function PoemClozeGame({ data, onResult, frozen }: PoemClozeGameProps) {
  // 把模板拆成 segments：text 段 + ___ 占位段
  const segments = useMemo(() => {
    const parts = data.template.split(PLACEHOLDER);
    // ["清明", "时节雨纷纷，路上行人欲", "魂"] for "清明___时节雨纷纷，路上行人欲___魂"
    // 假设 parts.length = blanks.length + 1
    return parts;
  }, [data.template]);

  const initialPool = useMemo<PoolChip[]>(() => {
    return shuffle(data.pool.map((t, i) => ({ id: `p-${i}`, text: t })));
  }, [data.pool]);

  const [pool, setPool] = useState<PoolChip[]>(initialPool);
  // 每个空槽对应一个 chip（null = 空）
  const [filled, setFilled] = useState<(PoolChip | null)[]>(
    () => Array.from({ length: data.blanks.length }, () => null),
  );
  const [submitted, setSubmitted] = useState(false);
  const reportedRef = useRef(false);

  // pool / filled 变化时不会自动提交。等用户点 "提交" 按钮。
  useEffect(() => {
    setPool(initialPool);
    setFilled(Array.from({ length: data.blanks.length }, () => null));
    setSubmitted(false);
    reportedRef.current = false;
  }, [data, initialPool]);

  const allBlanksFilled = filled.every((f) => f !== null);

  const handlePickChip = (chip: PoolChip) => {
    if (frozen || submitted) return;
    // 找到第一个空槽
    const firstEmpty = filled.findIndex((f) => f === null);
    if (firstEmpty === -1) return;
    setPool((prev) => prev.filter((c) => c.id !== chip.id));
    setFilled((prev) => {
      const next = [...prev];
      next[firstEmpty] = chip;
      return next;
    });
    sfx.tick?.();
  };

  const handleRemoveFromBlank = (idx: number) => {
    if (frozen || submitted) return;
    const chip = filled[idx];
    if (!chip) return;
    setFilled((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
    setPool((prev) => [...prev, chip]);
  };

  const handleSubmit = () => {
    if (frozen || submitted || !allBlanksFilled || reportedRef.current) return;
    reportedRef.current = true;
    setSubmitted(true);
    const isCorrect = filled.every(
      (chip, i) => chip !== null && chip.text === data.blanks[i],
    );
    if (isCorrect) sfx.correct();
    else sfx.wrong();
    setTimeout(
      () =>
        onResult({
          correct: isCorrect,
          meta: { filledTexts: filled.map((c) => c?.text ?? "") },
        }),
      400,
    );
  };

  // 渲染题面：text 段 + 槽位
  const renderTemplate = () => {
    const out: React.ReactNode[] = [];
    for (let i = 0; i < segments.length; i++) {
      out.push(
        <span key={`s-${i}`} className="text-slate-100">
          {segments[i]}
        </span>,
      );
      if (i < data.blanks.length) {
        const chip = filled[i];
        const correctText = data.blanks[i];
        const isCorrect = submitted && chip?.text === correctText;
        const isWrong = submitted && chip?.text !== correctText;
        let cls = "inline-block min-w-[2.4em] px-2 mx-0.5 rounded border-b-2 text-center align-baseline transition-colors";
        if (isCorrect) cls += " border-emerald-400 text-emerald-200 bg-emerald-500/15";
        else if (isWrong) cls += " border-rose-400 text-rose-200 bg-rose-500/15";
        else if (chip) cls += " border-violet-400 text-violet-100 bg-violet-500/20";
        else cls += " border-slate-500 text-slate-500 bg-ink-800/40";
        out.push(
          <button
            key={`b-${i}`}
            type="button"
            disabled={frozen || submitted || !chip}
            onClick={() => handleRemoveFromBlank(i)}
            className={cls}
          >
            {chip ? chip.text : "​　　"}
            {submitted && isWrong && (
              <span className="text-[10px] block text-emerald-300 mt-0.5">
                正确：{correctText}
              </span>
            )}
          </button>,
        );
      }
    }
    return out;
  };

  return (
    <div className="space-y-3">
      {/* 题面（带空槽） */}
      <div className="card bg-amber-500/5 border-amber-400/20 text-lg leading-loose font-display">
        {renderTemplate()}
      </div>

      {/* 字池 */}
      <div>
        <div className="text-[11px] text-slate-500 mb-1.5 text-center">
          字池（点字进空格，再点空格里的字可撤回）
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {pool.length === 0 ? (
            <span className="text-slate-500 text-xs italic">字都用完了，检查后提交吧</span>
          ) : (
            pool.map((chip) => (
              <button
                key={chip.id}
                type="button"
                disabled={frozen || submitted}
                onClick={() => handlePickChip(chip)}
                className="px-3 py-2 rounded-xl border font-display text-base bg-amber-500/15 border-amber-400/40 text-amber-50 hover:bg-amber-500/25 hover:scale-105 transition-all"
              >
                {chip.text}
              </button>
            ))
          )}
        </div>
      </div>

      {/* 提交 */}
      {!submitted && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={frozen || !allBlanksFilled}
            onClick={handleSubmit}
            className="btn-primary disabled:opacity-50"
          >
            提交答案
          </button>
        </div>
      )}
    </div>
  );
}
