import { useEffect, useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import type { Question } from "../../../core/types";

/**
 * 记忆配对：3-4 对卡片洗牌后扣下，点开两张是同一对的得 1 对，全部配对完成 → 答对。
 * 题目用 tags 配置每对：pair:左|右   例如 ["pair:0.5|1/2", "pair:25%|0.25"]
 * 默认 5 秒预览所有卡片再扣下（可省）。
 */
export function MemoryMatchPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const pairs = useMemo(() => parsePairs(question), [question.question_id]);
  const cards = useMemo(() => buildCards(pairs, question.question_id), [pairs, question.question_id]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [pickIdx, setPickIdx] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);

  // 进入时给一个短暂预览
  useEffect(() => {
    setRevealed(new Set(cards.map((_, i) => i)));
    const t = window.setTimeout(() => setRevealed(new Set()), 1500);
    return () => window.clearTimeout(t);
  }, [cards]);

  const flip = (i: number) => {
    if (disabled || done) return;
    if (matched.has(i) || revealed.has(i)) return;
    setRevealed((prev) => new Set(prev).add(i));

    if (pickIdx == null) {
      setPickIdx(i);
      return;
    }
    // 第二张
    setMoves((m) => m + 1);
    const a = cards[pickIdx]!;
    const b = cards[i]!;
    if (a.pairId === b.pairId) {
      // 配对成功
      window.setTimeout(() => {
        setMatched((prev) => new Set(prev).add(pickIdx).add(i));
        setRevealed((prev) => {
          const n = new Set(prev);
          n.delete(pickIdx);
          n.delete(i);
          return n;
        });
        const totalMatched = matched.size + 2;
        if (totalMatched >= cards.length) {
          setDone(true);
        }
      }, 350);
    } else {
      // 不对，0.6 秒后翻回
      window.setTimeout(() => {
        setRevealed((prev) => {
          const n = new Set(prev);
          n.delete(pickIdx);
          n.delete(i);
          return n;
        });
      }, 700);
    }
    setPickIdx(null);
  };

  useEffect(() => {
    if (!done) return;
    // 给一个短暂的庆祝动画然后 onFinish
    const t = window.setTimeout(() => {
      const ok = true;
      // 越少步数越好；超过 cards.length * 1.5 算 partial（仍算对）
      const ideal = pairs.length;
      const isClean = moves <= ideal + 1;
      if (ok) triggerFx.correctAt(window.innerWidth / 2, 200, isClean ? "+✓全对!" : "+✓");
      onFinish({
        answer: { moves, pairs: pairs.length },
        isCorrect: true,
        partialCorrect: false,
        matchedErrorTags: [],
      });
    }, 700);
    return () => window.clearTimeout(t);
  }, [done]);

  const cols = cards.length === 6 ? 3 : 4;
  return (
    <div>
      <div className="font-display font-bold text-xl mb-3 text-slate-100">{question.stem}</div>
      <div className="text-xs text-slate-400 mb-3">
        把相等的两张牌配对。已配 {matched.size / 2} / {pairs.length} 对 · 用了 {moves} 步
      </div>
      <div className={`grid grid-cols-${cols} gap-3`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {cards.map((c, i) => {
          const isRevealed = revealed.has(i);
          const isMatched = matched.has(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => flip(i)}
              disabled={disabled || isMatched}
              className={`relative aspect-[3/4] rounded-2xl border-2 transition-transform active:scale-95 ${
                isMatched
                  ? "border-emerald-400/60 bg-emerald-500/15 shadow-glow-emerald"
                  : isRevealed
                    ? "border-violet-400/60 bg-gradient-to-br from-violet-600/30 to-pink-500/20 shadow-glow"
                    : "border-ink-600 bg-gradient-to-br from-ink-700 to-ink-800 hover:brightness-110"
              }`}
            >
              <div className="w-full h-full flex items-center justify-center">
                {isRevealed || isMatched ? (
                  <span className="text-2xl font-display font-bold text-slate-100 px-2 text-center break-all">
                    {c.text}
                  </span>
                ) : (
                  <span className="text-3xl text-violet-300/40">✦</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface Card { pairId: number; text: string }

function parsePairs(q: Question): { left: string; right: string }[] {
  const list: { left: string; right: string }[] = [];
  for (const t of q.tags ?? []) {
    if (t.startsWith("pair:")) {
      const v = t.slice(5);
      const [l, r] = v.split("|");
      if (l && r) list.push({ left: l, right: r });
    }
  }
  if (list.length === 0) {
    // fallback：从答案构造一个最简单的配对
    list.push({ left: "1/2", right: "0.5" });
    list.push({ left: "1/4", right: "0.25" });
    list.push({ left: "3/10", right: "0.3" });
  }
  return list;
}

function buildCards(pairs: { left: string; right: string }[], seed: string): Card[] {
  const arr: Card[] = [];
  pairs.forEach((p, i) => {
    arr.push({ pairId: i, text: p.left });
    arr.push({ pairId: i, text: p.right });
  });
  return shuffleSeeded(arr, seed);
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
