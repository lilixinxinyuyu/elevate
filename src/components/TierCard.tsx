import { useState } from "react";
import type { RatingResult, AbilityDiagnostic } from "../core/rating";
import type { Tier } from "../core/tiers";
import { TierBadgeImg } from "./TierBadgeImg";

/**
 * 首页 Hero 卡 v0.30.4 重设计：
 *
 *   ┌──────────────────────────────────────┐
 *   │  你好 Selena 👋                                                ┌──────────┐ │
 *   │                                                                                       │ BIG 校徽 │ │
 *   │                                                                                       │  190px   │ │
 *   │  6,335 XP                                                            └──────────┘ │
 *   │  ━━━━━━━━━━━━━ 75%                                  和平街小学 III │
 *   │  再得 1,165 XP 升 ★IV                                          ★★★☆ · 超过 75% │
 *   ├──────────────────────────────────────┤
 *   │  能力诊断 490 / 1000  ━━━━━━━━━━━━━ ▾                            │
 *   │  （点开后 4 维细节）                                                                          │
 *   └──────────────────────────────────────┘
 *
 * 改动：
 *   1. 段位文字（"和平街小学 III ★★★☆"）从左下移到 BIG 校徽下方 ── 标签跟图捆绑，
 *      消除冗余的 "和平校徽 当前段位"
 *   2. 左列垂直 between-justify：greeting 顶部，XP+进度+提示底部 ── 看起来居中
 *   3. 能力诊断默认折叠成单行（总分 + 单色细条 + ▾），点击展开 4 维细节，
 *      减少视觉 noise（之前 4 个渐变条太抢戏）
 *   4. 进度条 + 能力条都用统一的 tier 主题色 + 半透明白，跟背景融合
 */
export function TierCard({
  studentName,
  rating,
  equippedBadge,
  ability,
}: {
  studentName: string;
  rating: RatingResult;
  /** 佩戴的段位（可能不是当前段位，比如已经升到成都但还想戴小学校徽） */
  equippedBadge: Tier;
  /** 能力诊断，传 null 时不显示底部能力区 */
  ability: AbilityDiagnostic | null;
}) {
  const t = rating.tier;
  const [abilityOpen, setAbilityOpen] = useState(false);

  const nextHint = (() => {
    if (rating.subRank < 4) {
      return (
        <>
          再得 <span className="font-bold tabular-nums">{rating.deltaToNextSubRank.toLocaleString()}</span> XP 升 ★{["I","II","III","IV"][rating.subRank]}
        </>
      );
    }
    if (rating.nextTier) {
      return (
        <>
          再得 <span className="font-bold tabular-nums">{rating.deltaToNext.toLocaleString()}</span> XP 跨入
          <span className={`ml-1 ${t.theme.textColor} font-display`}>
            {rating.nextTier.badgeIcon} {rating.nextTier.name}
          </span>
        </>
      );
    }
    return <>🏆 全国段位 · 永远在涨</>;
  })();

  return (
    <section
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${t.theme.fromColor} ${t.theme.toColor} border ${t.theme.borderColor} p-6 group`}
    >
      <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 w-56 h-56 rounded-full bg-white/5 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row gap-4 sm:gap-6">
        {/* 左：greeting 顶 + XP/进度/提示 底，垂直 between 让左右底部对齐 */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
          <div className={`text-sm ${t.theme.subTextColor}`}>你好 {studentName} 👋</div>

          <div>
            {/* XP 累计 */}
            <div className="flex items-baseline gap-2 animate-score-slide-in">
              <div
                className={`font-display font-bold text-5xl sm:text-6xl ${t.theme.textColor} drop-shadow-glow tabular-nums leading-none`}
              >
                {rating.score.toLocaleString()}
              </div>
              <div className={`text-sm ${t.theme.subTextColor}`}>XP</div>
            </div>

            {/* 进度条（段位内总进度） */}
            <div className="mt-3">
              <div className="h-2 rounded-full bg-black/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-300 via-pink-300 to-violet-300 shadow-glow-amber transition-all duration-700"
                  style={{ width: `${Math.round(rating.progressInTier * 100)}%` }}
                />
              </div>
              <div className={`mt-1.5 text-xs ${t.theme.subTextColor}`}>{nextHint}</div>
            </div>
          </div>
        </div>

        {/* 右：BIG 校徽（视觉主角）+ 段位文字（标签跟图捆绑） */}
        <div
          className="self-center sm:self-auto shrink-0 flex flex-col items-center gap-2.5"
          title={equippedBadge.badgeDesc}
        >
          <TierBadgeImg
            tierId={equippedBadge.id}
            fallbackEmoji={equippedBadge.badgeIcon}
            size={172}
            interactive
            shape="circle"
            alt={equippedBadge.badgeName}
            className={`ring-2 ${t.theme.borderColor} shadow-glow`}
          />
          <div className="text-center max-w-[180px]">
            {/* 段位名 + 罗马数字 + 星级（从左侧搬过来） */}
            <div className={`text-base font-display font-bold ${t.theme.textColor} leading-tight`}>
              {t.name}
              <span className="ml-1.5 text-sm">{rating.subRankRoman}</span>
            </div>
            <div className="mt-0.5 text-amber-300 text-xs tracking-tighter leading-none">
              {rating.subRankStars}
            </div>
            <div className={`mt-1 text-[11px] ${t.theme.subTextColor}`}>
              超过 {rating.percentSurpassed}%
            </div>
          </div>
        </div>
      </div>

      {/* 能力诊断（默认折叠，点击展开 4 维） */}
      {ability && ability.raw.totalAttempts > 0 && (
        <div className="relative mt-5 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => setAbilityOpen((v) => !v)}
            className={`group/ab w-full flex items-center gap-3 text-left rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:bg-white/5`}
            aria-expanded={abilityOpen}
          >
            <span
              className={`text-[11px] uppercase tracking-widest ${t.theme.subTextColor} shrink-0`}
            >
              能力诊断
            </span>
            <span className={`text-xs ${t.theme.subTextColor} tabular-nums shrink-0`}>
              <span className={`font-display font-bold ${t.theme.textColor}`}>
                {ability.score}
              </span>
              <span className="ml-0.5 opacity-70">/1000</span>
            </span>
            {/* 单色细条，跟背景融合（白半透明，无渐变） */}
            <span className="flex-1 h-1 rounded-full bg-black/20 overflow-hidden">
              <span
                className="block h-full bg-white/40 transition-all duration-700"
                style={{ width: `${Math.round((ability.score / 1000) * 100)}%` }}
              />
            </span>
            <span
              className={`text-xs ${t.theme.subTextColor} transition-transform shrink-0 ${abilityOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>

          {abilityOpen && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 animate-score-slide-in">
              <AbilityMini
                label="准确"
                title="最近 7 天答题准确率"
                value={ability.components.accuracy}
                max={250}
                rawDisplay={`${Math.round(ability.raw.accuracy7d * 100)}%`}
                subTone={t.theme.subTextColor}
                tone={t.theme.textColor}
              />
              <AbilityMini
                label="熟练"
                title="技能熟练度（按考试权重加权）"
                value={ability.components.mastery}
                max={400}
                rawDisplay={`${Math.round(ability.raw.weightedMastery)} 分`}
                subTone={t.theme.subTextColor}
                tone={t.theme.textColor}
              />
              <AbilityMini
                label="坚持"
                title="坚持度（连续天数 + 累计天数）"
                value={ability.components.continuity}
                max={200}
                rawDisplay={`连 ${ability.raw.streak} · 共 ${ability.raw.cumulativeDays} 天`}
                subTone={t.theme.subTextColor}
                tone={t.theme.textColor}
              />
              <AbilityMini
                label="题量"
                title="本学期总答题数"
                value={ability.components.volume}
                max={150}
                rawDisplay={`${ability.raw.totalAttempts} 题`}
                subTone={t.theme.subTextColor}
                tone={t.theme.textColor}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * 单维能力指示器（v0.30.4 净化版）：
 * - 单色（white/40）细条，不再 4 道渐变条抢视线
 * - 标签 + 原始数据右侧排，不挤进度条
 * - hover tooltip 看更多
 */
function AbilityMini({
  label,
  title,
  value,
  max,
  rawDisplay,
  tone,
  subTone,
}: {
  label: string;
  title: string;
  value: number;
  max: number;
  rawDisplay: string;
  tone: string;
  subTone: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div
      className="flex flex-col gap-1"
      title={`${title}\n实际 ${rawDisplay} · 得分 ${Math.round(value)}/${max}`}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className={`text-[11px] ${tone}`}>{label}</span>
        <span className={`text-[10px] tabular-nums ${subTone}`}>{rawDisplay}</span>
      </div>
      <div className="h-1 rounded-full bg-black/20 overflow-hidden">
        <div
          className="h-full bg-white/35 transition-all duration-700"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
    </div>
  );
}

/** 紧凑版：在结算页 / 其他位置显示分数 + 段位 */
export function TierCompact({ rating }: { rating: RatingResult }) {
  const t = rating.tier;
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border ${t.theme.borderColor}`}>
      <span className="text-base">{t.badgeIcon}</span>
      <span className={`text-sm font-display font-bold ${t.theme.textColor}`}>
        {rating.score}
      </span>
      <span className={`text-xs ${t.theme.subTextColor}`}>{t.name}</span>
    </div>
  );
}
