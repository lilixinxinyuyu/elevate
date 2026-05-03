/**
 * 配对游戏 — 类似 Elevate 的 Word Pair。
 *
 * 玩法：左右两列 tile（左 = 字/词，右 = 拼音/释义/配对答案）。
 * 用户依次点 左·右 把它们配上。配对错的会闪红 + 一起复位。
 * 全部配对完成 = 答对；任何一对配错记一次错（不能"撤销"重来）。
 *
 * 适合：近反义词 / 量词搭配 / 多音字辨义 / 汉字-拼音
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { sfx } from "../../../lib/sfx";
import type { ChinesePairMatchData } from "../../../core/types";

interface PairMatchGameProps {
  data: ChinesePairMatchData;
  onResult: (result: { correct: boolean; meta?: Record<string, unknown> }) => void;
  /** 答完一次后冻结交互（外层 ChineseTrain 显示反馈时用） */
  frozen: boolean;
}

interface Tile {
  /** 唯一 id */
  id: string;
  /** 显示文本 */
  text: string;
  /** "left" | "right" */
  side: "L" | "R";
  /** 在 pairs 数组里的原始索引（用于判定配对） */
  groupIdx: number;
}

function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i]!, out[j]!] = [out[j]!, out[i]!];
  }
  return out;
}

export function PairMatchGame({ data, onResult, frozen }: PairMatchGameProps) {
  const tiles = useMemo<{ left: Tile[]; right: Tile[] }>(() => {
    const left: Tile[] = data.pairs.map((p, i) => ({
      id: `L-${i}`,
      text: p.left,
      side: "L",
      groupIdx: i,
    }));
    const right: Tile[] = data.pairs.map((p, i) => ({
      id: `R-${i}`,
      text: p.right,
      side: "R",
      groupIdx: i,
    }));
    return { left: shuffle(left), right: shuffle(right) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // 已配对成功的 groupIdx
  const [matched, setMatched] = useState<Set<number>>(new Set());
  // 当前选中的 left tile id
  const [pickedLeft, setPickedLeft] = useState<string | null>(null);
  // 红色 flash 动画的 tile pair
  const [errorFlash, setErrorFlash] = useState<{ leftId: string; rightId: string } | null>(null);
  // 错配次数（用于判分：1+ 次配错 = 整道题判错）
  const [missCount, setMissCount] = useState(0);
  const reportedRef = useRef(false);

  // 全部配对完成 → 上报结果
  useEffect(() => {
    if (matched.size === data.pairs.length && !reportedRef.current) {
      reportedRef.current = true;
      // 任何错配都判错（一次也不能错）
      const isCorrect = missCount === 0;
      // 短暂等动画播完
      setTimeout(() => {
        onResult({ correct: isCorrect, meta: { missCount } });
      }, 350);
    }
  }, [matched.size, data.pairs.length, missCount, onResult]);

  const handlePick = (tile: Tile) => {
    if (frozen || matched.has(tile.groupIdx) || errorFlash) return;
    if (tile.side === "L") {
      setPickedLeft(tile.id === pickedLeft ? null : tile.id);
      return;
    }
    // 点 right tile
    if (!pickedLeft) return;
    const leftIdx = parseInt(pickedLeft.split("-")[1] ?? "-1", 10);
    if (leftIdx === tile.groupIdx) {
      // 配对成功
      sfx.correct();
      setMatched((prev) => new Set(prev).add(tile.groupIdx));
      setPickedLeft(null);
    } else {
      // 配对失败：红色 flash + 振动 + 复位
      sfx.wrong();
      setErrorFlash({ leftId: pickedLeft, rightId: tile.id });
      setMissCount((n) => n + 1);
      setTimeout(() => {
        setErrorFlash(null);
        setPickedLeft(null);
      }, 600);
    }
  };

  const renderTile = (tile: Tile) => {
    const isMatched = matched.has(tile.groupIdx);
    const isPicked = tile.id === pickedLeft;
    const isFlashing =
      errorFlash &&
      (errorFlash.leftId === tile.id || errorFlash.rightId === tile.id);
    let cls = "rounded-xl border px-3 py-3 text-center font-semibold transition-all";
    if (isMatched) {
      cls += " bg-emerald-500/15 border-emerald-400/40 text-emerald-100 opacity-70";
    } else if (isFlashing) {
      cls += " bg-rose-500/30 border-rose-400/60 text-rose-100 animate-pulse scale-95";
    } else if (isPicked) {
      cls += " bg-violet-500/25 border-violet-400/60 text-violet-50 shadow-glow scale-105";
    } else {
      cls += " bg-ink-800/50 border-ink-600/60 text-slate-100 hover:bg-ink-700/60 hover:scale-[1.02]";
    }
    return (
      <button
        key={tile.id}
        type="button"
        disabled={frozen || isMatched}
        onClick={() => handlePick(tile)}
        className={cls}
      >
        {isMatched ? <span>✓ {tile.text}</span> : tile.text}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-400 text-center">
        点左边一个，再点右边对应的：错配会闪红（每错 1 次扣分，全对才算这题对）
        {missCount > 0 && (
          <span className="ml-2 text-rose-300">已错 {missCount} 次</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] text-slate-500 mb-1.5 text-center">
            {data.leftLabel ?? "字 / 词"}
          </div>
          <div className="grid gap-2">{tiles.left.map(renderTile)}</div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500 mb-1.5 text-center">
            {data.rightLabel ?? "拼音 / 释义"}
          </div>
          <div className="grid gap-2">{tiles.right.map(renderTile)}</div>
        </div>
      </div>
    </div>
  );
}
