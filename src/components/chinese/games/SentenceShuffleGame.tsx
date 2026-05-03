/**
 * 句子重排 — 把打乱的词块按正确顺序点亮，组成一句话。
 *
 * 玩法：底部"散落"的词块乱序，用户按顺序点击；点错（不是正确顺序的下一个）= 抖动 + 计错。
 * 完成 = 全部点上 + 顺序对了。
 *
 * 适合：
 *   - 句子排序题（关联词补全：因为...所以...）
 *   - 古诗排序（黄河远上白云间）
 *   - 短作文片段重排
 *
 * 灵感：Elevate 的 Sentence Builder。
 */

import { useEffect, useMemo, useState } from "react";
import { sfx } from "../../../lib/sfx";
import type { ChineseSentenceShuffleData } from "../../../core/types";

interface SentenceShuffleGameProps {
  data: ChineseSentenceShuffleData;
  onResult: (result: { correct: boolean; meta?: Record<string, unknown> }) => void;
  frozen: boolean;
}

interface Token {
  id: string;
  text: string;
  /** 在原 tokens 数组里的正确序号（即应当被点击的顺序） */
  correctIdx: number;
}

function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i]!, out[j]!] = [out[j]!, out[i]!];
  }
  return out;
}

export function SentenceShuffleGame({
  data,
  onResult,
  frozen,
}: SentenceShuffleGameProps) {
  const tokens = useMemo<Token[]>(() => {
    return shuffle(
      data.tokens.map((t, i) => ({ id: `t-${i}`, text: t, correctIdx: i })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // 已点上去的 token id 序列（按用户顺序）
  const [picked, setPicked] = useState<Token[]>([]);
  // 错点闪烁
  const [errorTokenId, setErrorTokenId] = useState<string | null>(null);
  // 错点次数
  const [missCount, setMissCount] = useState(0);
  // 是否已上报
  const [reported, setReported] = useState(false);

  // 全部点上 → 上报
  useEffect(() => {
    if (picked.length === tokens.length && !reported) {
      setReported(true);
      const isCorrect = missCount === 0;
      setTimeout(() => onResult({ correct: isCorrect, meta: { missCount } }), 400);
    }
  }, [picked.length, tokens.length, missCount, reported, onResult]);

  const expectedNextIdx = picked.length; // 期待的"正确顺序里下一个"
  const handleClickToken = (tk: Token) => {
    if (frozen || reported) return;
    if (picked.some((p) => p.id === tk.id)) return; // 已点过
    if (tk.correctIdx === expectedNextIdx) {
      // 点对：加进 picked
      sfx.correct();
      setPicked((prev) => [...prev, tk]);
    } else {
      // 点错：抖动 flash + 计错
      sfx.wrong();
      setErrorTokenId(tk.id);
      setMissCount((n) => n + 1);
      setTimeout(() => setErrorTokenId(null), 500);
    }
  };

  const handleUndo = () => {
    if (frozen || reported || picked.length === 0) return;
    setPicked((prev) => prev.slice(0, -1));
  };

  const fullSentence = data.fullSentence ?? data.tokens.join("");

  return (
    <div className="space-y-3">
      {/* 已点的句子区 */}
      <div className="card bg-violet-500/5 border-violet-400/20 min-h-[64px] flex items-center justify-center flex-wrap gap-1.5 p-3">
        {picked.length === 0 ? (
          <span className="text-slate-500 text-sm">点下面的词块按顺序组句…</span>
        ) : (
          picked.map((t, i) => (
            <span
              key={t.id}
              className="px-2 py-1 rounded-md bg-violet-500/25 border border-violet-400/40 text-violet-50 text-base font-medium animate-slide-up"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {t.text}
            </span>
          ))
        )}
      </div>

      {/* 词块池 */}
      <div className="flex flex-wrap gap-2 justify-center">
        {tokens.map((tk) => {
          const isPicked = picked.some((p) => p.id === tk.id);
          const isFlashing = errorTokenId === tk.id;
          let cls =
            "px-3 py-2 rounded-xl border font-medium transition-all text-base";
          if (isPicked) {
            cls += " bg-ink-800/30 border-ink-700/40 text-slate-600 line-through opacity-50";
          } else if (isFlashing) {
            cls += " bg-rose-500/30 border-rose-400/60 text-rose-100 animate-pulse scale-95";
          } else {
            cls +=
              " bg-amber-500/15 border-amber-400/40 text-amber-50 hover:bg-amber-500/25 hover:scale-105";
          }
          return (
            <button
              key={tk.id}
              type="button"
              disabled={frozen || isPicked || reported}
              onClick={() => handleClickToken(tk)}
              className={cls}
            >
              {tk.text}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between items-center text-xs text-slate-400">
        <button
          type="button"
          onClick={handleUndo}
          disabled={frozen || reported || picked.length === 0}
          className="text-slate-500 hover:text-slate-300 disabled:opacity-40"
        >
          ↶ 撤销
        </button>
        <div>
          {missCount > 0 && (
            <span className="text-rose-300">已错 {missCount} 次 · </span>
          )}
          {picked.length} / {tokens.length}
        </div>
      </div>

      {/* 完成后展示完整句子 */}
      {reported && (
        <div className="card bg-emerald-500/10 border-emerald-400/30 text-center text-sm text-emerald-100 animate-slide-up">
          {fullSentence}
        </div>
      )}
    </div>
  );
}
