import type { RatingResult } from "../core/rating";
import type { Tier } from "../core/tiers";

/**
 * 首页 Hero 卡：综合分 + 段位 + 佩戴的勋章。
 *
 * 整体效果：
 *   ┌─────────────────────────────────┐
 *   │  你好 Selena 👋    🏛️ 锦江徽章  │
 *   │                                 │
 *   │       574 分                    │
 *   │   锦江区 · 超过 87% 的同年级    │
 *   │   ━━━━━━━━━━━━━━━░░ 87%         │
 *   │   再涨 26 分进入成都市          │
 *   │                                 │
 *   │   [▶ 开始今日挑战]              │
 *   └─────────────────────────────────┘
 */
export function TierCard({
  studentName,
  rating,
  equippedBadge,
}: {
  studentName: string;
  rating: RatingResult;
  /** 佩戴的段位（可能不是当前段位，比如已经升到成都但还想戴小学校徽） */
  equippedBadge: Tier;
}) {
  const t = rating.tier;
  return (
    <section
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${t.theme.fromColor} ${t.theme.toColor} border ${t.theme.borderColor} p-6`}
    >
      <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -left-12 -bottom-12 w-56 h-56 rounded-full bg-white/5 blur-3xl" />
      <div className="relative">
        {/* 头部：问候 + 佩戴的勋章 */}
        <div className="flex items-start justify-between gap-3">
          <div className={`text-sm ${t.theme.subTextColor}`}>你好 {studentName} 👋</div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15"
            title={equippedBadge.badgeDesc}
          >
            <span className="text-base leading-none">{equippedBadge.badgeIcon}</span>
            <span className={`text-xs font-display ${t.theme.textColor}`}>
              {equippedBadge.badgeName}
            </span>
          </div>
        </div>

        {/* 分数 */}
        <div className="mt-3 flex items-baseline gap-2">
          <div
            className={`font-display font-bold text-5xl sm:text-6xl ${t.theme.textColor} drop-shadow-glow`}
          >
            {rating.score}
          </div>
          <div className={`text-sm ${t.theme.subTextColor}`}>分</div>
        </div>

        {/* 段位 + 小段星级 */}
        <div className={`mt-1 flex items-center gap-2 flex-wrap text-base font-display ${t.theme.textColor}`}>
          <span className="text-lg">{t.badgeIcon}</span>
          <span>{t.name}</span>
          <span className="font-bold">{rating.subRankRoman}</span>
          <span className="text-amber-300 text-sm tracking-tighter">{rating.subRankStars}</span>
        </div>
        <div className={`text-xs ${t.theme.subTextColor} mt-0.5`}>
          {t.name}四年级 · 超过 {rating.percentSurpassed}%
        </div>

        {/* 进度条（段位内总进度） */}
        <div className="mt-3">
          <div className="h-2.5 rounded-full bg-black/25 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-300 via-pink-300 to-violet-300 shadow-glow-amber transition-all duration-700"
              style={{ width: `${Math.round(rating.progressInTier * 100)}%` }}
            />
          </div>
          <div className={`mt-1.5 text-xs ${t.theme.subTextColor}`}>
            {rating.subRank < 4 ? (
              <>
                再涨 <span className="font-bold">{rating.deltaToNextSubRank}</span> 分升 ★{["I","II","III","IV"][rating.subRank]}
              </>
            ) : rating.nextTier ? (
              <>
                再涨 <span className="font-bold">{rating.deltaToNext}</span> 分跨入
                <span className={`ml-1 ${t.theme.textColor} font-display`}>
                  {rating.nextTier.badgeIcon} {rating.nextTier.name}
                </span>
              </>
            ) : (
              <>已抵达全国最高段位 · 传说级 🏆</>
            )}
          </div>
        </div>
      </div>
    </section>
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
