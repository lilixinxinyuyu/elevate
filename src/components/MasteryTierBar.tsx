/**
 * 5-tier 分布进度条（v0.31.41）
 *
 * 用法：
 *   <MasteryTierBar dist={dist} />
 *
 * 展示：
 *   - 5 段彩色条，宽度按 pct 分布
 *   - 5 个数字标签（新/初识/在学/熟练/掌握）
 *
 * 颜色（slate/cyan/amber/emerald/violet）从 LEVEL_COLORS 来。
 */

import {
  LEVEL_EMOJIS,
  LEVEL_LABELS,
  type Level,
  type TierDistribution,
} from "../lib/masteryTier";

const LEVELS: Level[] = [0, 1, 2, 3, 4];

const FILL_CLS: Record<Level, string> = {
  0: "bg-slate-500/40",
  1: "bg-cyan-400",
  2: "bg-amber-400",
  3: "bg-emerald-400",
  4: "bg-violet-400",
};

const TEXT_CLS: Record<Level, string> = {
  0: "text-slate-300",
  1: "text-cyan-300",
  2: "text-amber-300",
  3: "text-emerald-300",
  4: "text-violet-300",
};

export function MasteryTierBar({ dist }: { dist: TierDistribution }) {
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-ink-700/60">
        {LEVELS.map((lv) => (
          <div
            key={lv}
            className={`${FILL_CLS[lv]} transition-[width] duration-300`}
            style={{ width: `${dist.pct[lv]}%` }}
            title={`${LEVEL_LABELS[lv]} ${dist.byLevel[lv]} / ${dist.total}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1 text-[10px] text-center">
        {LEVELS.map((lv) => (
          <div key={lv} className="flex flex-col items-center">
            <div className="text-base">{LEVEL_EMOJIS[lv]}</div>
            <div className="text-slate-400">{LEVEL_LABELS[lv]}</div>
            <div className={`font-display font-bold text-sm ${TEXT_CLS[lv]} tabular-nums`}>
              {dist.byLevel[lv]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 单个 tier chip — 在题面显示当前字/词的等级 */
export function TierChip({ level }: { level: Level }) {
  const colorMap: Record<Level, string> = {
    0: "bg-slate-500/15 text-slate-200 border-slate-400/40",
    1: "bg-cyan-500/15 text-cyan-200 border-cyan-400/40",
    2: "bg-amber-500/15 text-amber-200 border-amber-400/40",
    3: "bg-emerald-500/15 text-emerald-200 border-emerald-400/40",
    4: "bg-violet-500/15 text-violet-200 border-violet-400/40",
  };
  return (
    <span
      className={`chip text-[10px] px-2 py-0.5 border ${colorMap[level]}`}
    >
      {LEVEL_EMOJIS[level]} {LEVEL_LABELS[level]}
    </span>
  );
}
