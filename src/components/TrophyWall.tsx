/**
 * 奖杯墙 v0.29 — 按 5 大分类分区展示，铜银金钻 4 等级一目了然。
 *
 * 区块顺序：
 *   1. 🏵️ 纪念勋章（commemorative）— 独一无二
 *   2. ⛰️ 里程碑（milestone）— 答题大师 / 连击王 等，每个槽位 4 等级
 *   3. 🧠 能力勋章（ability）— 8 维能力
 *   4. 🗺️ 学科领域（skill）— 小数 / 方程 / 三角形 等
 *   5. 🌱 日常（daily）— 多次获得
 *
 * 显示逻辑：
 *   - tiered 勋章：显示当前最高 tier 的图 + tier 标签 + "再差 X 进 Y"
 *   - daily：显示 ×N 次数
 *   - 未达任何 tier：灰色 + 显示距离铜的差距
 */
import { Link } from "react-router-dom";
import { TROPHIES, currentTier, nextTierGap } from "../core/trophies";
import type { TrophyDef, TrophyTier, UserTrophy } from "../core/types";
import { TrophyIcon } from "./TrophyIcon";
import { useAllTrophyImages } from "../lib/trophyImages";
import { trophyImageKey } from "../lib/allTrophies";

const CATEGORY_LABELS = {
  commemorative: { label: "🏵️ 纪念勋章", subtitle: "永恒铭记的里程碑" },
  milestone: { label: "⛰️ 里程碑", subtitle: "持之以恒的成就" },
  ability: { label: "🧠 能力勋章", subtitle: "8 维能力的成长印记" },
  skill: { label: "🗺️ 学科领域", subtitle: "各单元的精通证明" },
  daily: { label: "🌱 日常成就", subtitle: "每天的小胜利" },
} as const;

const TIER_LABEL: Record<TrophyTier, string> = {
  bronze: "🥉 铜",
  silver: "🥈 银",
  gold: "🥇 金",
  platinum: "💎 钻",
};

const CATEGORY_ORDER: (keyof typeof CATEGORY_LABELS)[] = [
  "commemorative",
  "milestone",
  "ability",
  "skill",
  "daily",
];

interface TrophyCellProps {
  def: TrophyDef;
  trophies: UserTrophy[];
  // 用于动态算 tier(ctx)
  ctx: import("../core/types").TrophyCheckContext;
}

function TrophyCell({ def, trophies, ctx }: TrophyCellProps) {
  const ownedThisDef = trophies.filter((t) => t.trophyId === def.id);
  const isTiered = !!def.tieredThresholds && def.tieredThresholds.length > 0;

  // 计算当前进度
  let progress = 0;
  try {
    progress = def.tier ? def.tier(ctx) : 0;
  } catch {
    /* */
  }

  if (def.category === "commemorative") {
    const unlocked = ownedThisDef.length > 0;
    return (
      <div
        className="relative text-center group"
        title={unlocked ? `已获得：${def.description}` : `未解锁：${def.description}`}
      >
        <div className="flex justify-center">
          <TrophyIcon
            trophyId={def.id}
            subjectId="math"
            emoji={def.icon ?? "🌟"}
            size="lg"
            glow={unlocked}
            unlocked={unlocked}
            category="commemorative"
          />
        </div>
        <div
          className={`text-xs mt-2 leading-tight ${
            unlocked ? "text-amber-100 font-bold" : "text-slate-500"
          }`}
        >
          {def.name}
        </div>
      </div>
    );
  }

  if (isTiered) {
    const cur = currentTier(def, progress);
    const next = nextTierGap(def, progress);
    const unlocked = !!cur;
    return (
      <div
        className="relative text-center group"
        title={`${def.description} · 当前进度：${progress}`}
      >
        <div className="flex justify-center">
          <TrophyIcon
            trophyId={def.id}
            subjectId="math"
            emoji={def.icon ?? "🏆"}
            size="lg"
            tier={cur ?? undefined}
            category={def.category}
            glow={cur === "gold" || cur === "platinum"}
            unlocked={unlocked}
          />
        </div>
        <div
          className={`text-xs mt-2 leading-tight ${
            unlocked ? "text-amber-100 font-bold" : "text-slate-500"
          }`}
        >
          {def.name}
        </div>
        <div className="text-[10px] mt-0.5 leading-none">
          {cur ? (
            <span className="text-amber-300/90">{TIER_LABEL[cur]}</span>
          ) : (
            <span className="text-slate-600">未解锁</span>
          )}
          {next && (
            <span className="text-slate-500">
              {cur ? " · " : ""}
              再 {next.gap} 进 {TIER_LABEL[next.tier].slice(2)}
            </span>
          )}
        </div>
      </div>
    );
  }

  // daily：多次获得
  const count = ownedThisDef.length;
  const unlocked = count > 0;
  return (
    <div
      className="relative text-center group"
      title={`${def.description}${count > 0 ? `（已获得 ${count} 次）` : ""}`}
    >
      {count > 1 && (
        <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 chip bg-rose-500 text-white border border-rose-300 font-display font-bold text-[10px] sm:text-xs px-1.5 py-0.5 shadow-glow-rose whitespace-nowrap z-10">
          × {count}
        </span>
      )}
      <div className="flex justify-center">
        <TrophyIcon
          trophyId={def.id}
          subjectId="math"
          emoji={def.icon ?? "🏆"}
          size="lg"
          category="daily"
          unlocked={unlocked}
        />
      </div>
      <div
        className={`text-xs mt-2 leading-tight ${
          unlocked ? "text-amber-100" : "text-slate-500"
        }`}
      >
        {def.name}
      </div>
    </div>
  );
}

export function TrophyWall({
  trophies,
  ctx,
}: {
  trophies: UserTrophy[];
  /** TrophyCheckContext：让每个 cell 算自己的 progress */
  ctx: import("../core/types").TrophyCheckContext;
}) {
  // 已获得 / 未解锁分类计数（页眉显示）
  const totalEarnedKinds = TROPHIES.filter((def) => {
    if (def.category === "commemorative") {
      return trophies.some((t) => t.trophyId === def.id);
    }
    if (def.tieredThresholds) {
      let progress = 0;
      try {
        progress = def.tier?.(ctx) ?? 0;
      } catch {
        /* */
      }
      return !!currentTier(def, progress);
    }
    return trophies.some((t) => t.trophyId === def.id);
  }).length;
  const totalCount = trophies.length;

  // 缺 AI 图统计 — 只看已解锁的
  const cachedImages = useAllTrophyImages();
  let earnedMissingAi = 0;
  for (const def of TROPHIES) {
    if (def.category === "commemorative") {
      if (trophies.some((t) => t.trophyId === def.id)) {
        if (!cachedImages.has(trophyImageKey("math", def.id))) earnedMissingAi += 1;
      }
    } else if (def.tieredThresholds) {
      let progress = 0;
      try {
        progress = def.tier?.(ctx) ?? 0;
      } catch {
        /* */
      }
      const cur = currentTier(def, progress);
      if (cur && !cachedImages.has(trophyImageKey("math", def.id, cur))) {
        earnedMissingAi += 1;
      }
    } else if (trophies.some((t) => t.trophyId === def.id)) {
      if (!cachedImages.has(trophyImageKey("math", def.id))) earnedMissingAi += 1;
    }
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="font-display font-bold text-lg">🏆 奖杯柜</div>
        <div className="flex items-center gap-2 flex-wrap">
          {earnedMissingAi > 0 && (
            <Link
              to="/math/admin#trophy-images"
              className="chip text-xs px-2.5 py-1 bg-violet-500/15 border border-violet-400/40 text-violet-200 hover:bg-violet-500/25"
              title="跳到管理页一键生成所有缺失的勋章 AI 图"
            >
              ✨ {earnedMissingAi} 枚还没 AI 图
            </Link>
          )}
          <div className="text-xs text-slate-400">
            {totalEarnedKinds} / {TROPHIES.length} 种 · 共 {totalCount} 枚
          </div>
        </div>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const defsInCat = TROPHIES.filter((d) => d.category === cat);
        if (defsInCat.length === 0) return null;
        const meta = CATEGORY_LABELS[cat];
        return (
          <div key={cat} className="mb-6 last:mb-0">
            <div className="flex items-baseline justify-between mb-3 ml-1">
              <div className="text-sm font-display text-amber-300/90">{meta.label}</div>
              <div className="text-[10px] text-slate-500">{meta.subtitle}</div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-3 gap-y-5">
              {defsInCat.map((def) => (
                <TrophyCell key={def.id} def={def} trophies={trophies} ctx={ctx} />
              ))}
            </div>
          </div>
        );
      })}

      {totalEarnedKinds === 0 && (
        <div className="text-sm text-slate-400 text-center py-8">
          还没拿到任何奖杯——开始第一次挑战吧！
        </div>
      )}
    </section>
  );
}
