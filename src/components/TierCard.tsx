import { useState } from "react";
import type { RatingResult, AbilityDiagnostic } from "../core/rating";
import type { Tier } from "../core/tiers";
import { TierBadgeImg } from "./TierBadgeImg";

/**
 * Hero 卡 v0.30.5 美术优化（按"专业游戏 UI 设计师"思路）：
 *
 *   ┌────────────────────────────────────────────────────────────┐
 *   │  你好 Selena 👋                                                                                                                        │
 *   │                                                                                                                                                            │
 *   │  6,801                                                                                       ┌─────────────┐  │
 *   │  ─────                  ★★★☆ 超过 77%                                            │             │  │
 *   │  ━━━━━━━━━━━━━━━━ 75%                                                            │   BIG       │  │
 *   │  再得 699 XP 升 ★IV                                                                            │   BADGE     │  │
 *   │                                                                                                                                  │   210px     │  │
 *   │                                                                                                                                  └─────────────┘  │
 *   │                                                                                                                                  和平街小学 III     │
 *   ├────────────────────────────────────────────────────────────┤
 *   │  能力诊断 504 / 1000  ━━━━━━━━━━━━━━━━━━━━━━━━ ▾                          │
 *   └────────────────────────────────────────────────────────────┘
 *
 * 设计原则（游戏 UI）：
 *   1. **单焦点** — 校徽是视觉锚（210px 圆形 + 主题色环 + 发光），其他元素围绕它
 *   2. **配对** — XP 数字 ↔ 进度条 ↔ 提示 (左侧成"成长块"); 校徽 ↔ 段位名 (右侧成"身份块")
 *   3. **比例** — XP 6xl/7xl > 段位名 lg > 提示 xs > 标签 11px，4 级清晰阶梯
 *   4. **金色高光锚** — 星级 ★ 用 amber-300, 进度条 amber→pink→violet 渐变, 关键 XP 数字加粗 ──
 *      让 amber 在 3 处出现，整张卡有"贵金属"统一感
 *   5. **breathing room** — 大块留白让校徽呼吸；左边 XP 紧凑下沉，避免 6:1 大空白
 *   6. **超过 77%** 跟着 ★ 走（关于成绩的"百分比"信息）—— 这俩是同性质的"成就刻度"
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
          再得 <span className={`font-bold tabular-nums ${t.theme.textColor}`}>{rating.deltaToNextSubRank.toLocaleString()}</span> XP 升 <span className="text-amber-300">★{["I","II","III","IV"][rating.subRank]}</span>
        </>
      );
    }
    if (rating.nextTier) {
      return (
        <>
          再得 <span className={`font-bold tabular-nums ${t.theme.textColor}`}>{rating.deltaToNext.toLocaleString()}</span> XP 跨入
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
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${t.theme.fromColor} ${t.theme.toColor} border ${t.theme.borderColor} px-5 sm:px-6 py-6`}
    >
      {/* ambient 光晕（更大更柔，给"宝物展示柜"感） */}
      <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-20 w-72 h-72 rounded-full bg-white/[0.06] blur-3xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row gap-5 sm:gap-8">
        {/* 左：成长块（greeting → XP → 进度 → 下个目标） */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 sm:gap-4">
          <div className={`text-sm ${t.theme.subTextColor}`}>你好 {studentName} 👋</div>

          <div>
            {/* XP 数字 — hero scale */}
            <div className="flex items-baseline gap-2 animate-score-slide-in">
              <div
                className={`font-display font-bold text-[56px] sm:text-7xl ${t.theme.textColor} drop-shadow-glow tabular-nums leading-[0.95]`}
              >
                {rating.score.toLocaleString()}
              </div>
              <div className={`text-sm sm:text-base ${t.theme.subTextColor}`}>XP</div>
            </div>

            {/* 星级 + 超过 X%（成就刻度配对） */}
            <div className={`mt-2 flex items-center gap-2 text-sm ${t.theme.subTextColor}`}>
              <span className="text-amber-300 text-base tracking-tighter leading-none">
                {rating.subRankStars}
              </span>
              <span className="opacity-50">·</span>
              <span>超过 <span className={`font-display font-bold ${t.theme.textColor}`}>{rating.percentSurpassed}%</span> 的同年级</span>
            </div>

            {/* 进度条 + 下个目标 */}
            <div className="mt-3.5">
              <div className="h-2.5 rounded-full bg-black/25 overflow-hidden ring-1 ring-white/5">
                <div
                  className="h-full bg-gradient-to-r from-amber-300 via-pink-300 to-violet-300 shadow-glow-amber transition-all duration-700"
                  style={{ width: `${Math.round(rating.progressInTier * 100)}%` }}
                />
              </div>
              <div className={`mt-2 text-xs ${t.theme.subTextColor}`}>{nextHint}</div>
            </div>
          </div>
        </div>

        {/* 右：身份块（BIG 校徽 + 段位名） */}
        <div
          className="self-center sm:self-center shrink-0 flex flex-col items-center gap-3"
          title={equippedBadge.badgeDesc}
        >
          {/* 校徽外加一层"宝物座"渐变光晕，提升博物馆展示感 */}
          <div className="relative">
            <div
              className="absolute inset-0 -m-3 rounded-full blur-2xl opacity-40 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.45), rgba(255,255,255,0) 70%)",
              }}
            />
            <TierBadgeImg
              tierId={equippedBadge.id}
              fallbackEmoji={equippedBadge.badgeIcon}
              size={210}
              interactive
              shape="circle"
              alt={equippedBadge.badgeName}
              className={`relative ring-2 ${t.theme.borderColor} shadow-glow`}
            />
          </div>
          <div className="text-center">
            <div className={`text-xl font-display font-bold ${t.theme.textColor} leading-tight`}>
              {t.name}
              <span className="ml-1.5 text-base">{rating.subRankRoman}</span>
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
            className="w-full flex items-center gap-3 text-left rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:bg-white/5"
            aria-expanded={abilityOpen}
          >
            <span className={`text-[11px] uppercase tracking-widest ${t.theme.subTextColor} shrink-0`}>
              能力诊断
            </span>
            <span className={`text-xs ${t.theme.subTextColor} tabular-nums shrink-0`}>
              <span className={`font-display font-bold ${t.theme.textColor}`}>{ability.score}</span>
              <span className="ml-0.5 opacity-70">/1000</span>
            </span>
            {/* 单色细条，跟背景融合，不抢主信息视线 */}
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
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-score-slide-in">
              <AbilityMini
                label="准确"
                title="最近 7 天答题准确率"
                value={ability.components.accuracy}
                max={250}
                rawDisplay={`${Math.round(ability.raw.accuracy7d * 100)}%`}
                tone={t.theme.textColor}
                subTone={t.theme.subTextColor}
              />
              <AbilityMini
                label="熟练"
                title="技能熟练度（按考试权重加权）"
                value={ability.components.mastery}
                max={400}
                rawDisplay={`${Math.round(ability.raw.weightedMastery)} 分`}
                tone={t.theme.textColor}
                subTone={t.theme.subTextColor}
              />
              <AbilityMini
                label="坚持"
                title="坚持度（连续天数 + 累计天数）"
                value={ability.components.continuity}
                max={200}
                rawDisplay={`连 ${ability.raw.streak} · 共 ${ability.raw.cumulativeDays} 天`}
                tone={t.theme.textColor}
                subTone={t.theme.subTextColor}
              />
              <AbilityMini
                label="题量"
                title="本学期总答题数"
                value={ability.components.volume}
                max={150}
                rawDisplay={`${ability.raw.totalAttempts} 题`}
                tone={t.theme.textColor}
                subTone={t.theme.subTextColor}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** 单维能力指示器：单色细条 + 标签 + 原始数据（v0.30.4 净化版） */
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
