import type { RatingResult, AbilityDiagnostic } from "../core/rating";
import type { Tier } from "../core/tiers";
import { TierBadgeImg } from "./TierBadgeImg";

/**
 * 首页 Hero 卡：本学期累计 XP + 段位 + 佩戴的勋章 + 能力诊断（v0.30.2 加）。
 *
 * 整体效果（v0.30.2 重设计）：
 *   ┌─────────────────────────────────┐
 *   │  你好 Selena 👋     [真校徽] 和平校徽  │
 *   │                                 │
 *   │       6,335 XP                  │
 *   │   🏫 和平街小学 III ★★★☆           │
 *   │   超过 75% 的同年级               │
 *   │   ━━━━━━━━━━━━━━━░░ 75%         │
 *   │   再涨 1,165 XP 升 ★IV          │
 *   │  ─────────────────────────────  │
 *   │  能力 642·准80%·熟70%·持60%·量50% │
 *   └─────────────────────────────────┘
 *
 * 改动要点：
 *   1. 校徽 chip 用真的 AI 生成图（TierBadgeImg），hover 时绕轴小摆 + 描边发光
 *   2. XP 数字用 animate-score-slide-in 入场
 *   3. 底部加一行能力诊断 4 维（accuracy/mastery/continuity/volume）
 *      每维显示百分比 + 极小条形图。整体不打扰主信息（XP）但给爸妈一目了然
 *   4. 数字 + 段位行用 tabular-nums 对齐
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
  return (
    <section
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${t.theme.fromColor} ${t.theme.toColor} border ${t.theme.borderColor} p-6 group`}
    >
      <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 w-56 h-56 rounded-full bg-white/5 blur-3xl pointer-events-none" />
      <div className="relative flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
        {/* 左：问候 + XP + 段位 + 进度 */}
        <div className="flex-1 min-w-0 w-full">
          <div className={`text-sm ${t.theme.subTextColor}`}>你好 {studentName} 👋</div>

          {/* XP 累计 */}
          <div className="mt-3 flex items-baseline gap-2 animate-score-slide-in">
            <div
              className={`font-display font-bold text-5xl sm:text-6xl ${t.theme.textColor} drop-shadow-glow tabular-nums`}
            >
              {rating.score.toLocaleString()}
            </div>
            <div className={`text-sm ${t.theme.subTextColor}`}>XP</div>
          </div>

          {/* 段位 + 小段星级（小 badge img 替换原 emoji icon） */}
          <div className={`mt-1.5 flex items-center gap-2 flex-wrap text-base font-display ${t.theme.textColor}`}>
            <TierBadgeImg
              tierId={t.id}
              fallbackEmoji={t.badgeIcon}
              size={26}
              alt={t.name}
              shape="circle"
            />
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
                  再得 <span className="font-bold tabular-nums">{rating.deltaToNextSubRank.toLocaleString()}</span> XP 升 ★{["I","II","III","IV"][rating.subRank]}
                </>
              ) : rating.nextTier ? (
                <>
                  再得 <span className="font-bold tabular-nums">{rating.deltaToNext.toLocaleString()}</span> XP 跨入
                  <span className={`ml-1 ${t.theme.textColor} font-display`}>
                    {rating.nextTier.badgeIcon} {rating.nextTier.name}
                  </span>
                </>
              ) : (
                <>🏆 全国段位 · 永远在涨</>
              )}
            </div>
          </div>
        </div>

        {/* 右：BIG 校徽（视觉主角） — 桌面 ~190px，移动端整行靠右 */}
        <div
          className="self-center sm:self-start shrink-0 flex flex-col items-center gap-2"
          title={equippedBadge.badgeDesc}
        >
          <TierBadgeImg
            tierId={equippedBadge.id}
            fallbackEmoji={equippedBadge.badgeIcon}
            size={190}
            interactive
            shape="circle"
            alt={equippedBadge.badgeName}
            className={`ring-2 ${t.theme.borderColor} shadow-glow`}
          />
          <div className="text-center">
            <div className={`text-sm font-display font-bold ${t.theme.textColor} leading-tight`}>
              {equippedBadge.badgeName}
            </div>
            <div className={`text-[10px] ${t.theme.subTextColor} mt-0.5`}>
              {equippedBadge.name === t.name ? "当前段位" : "佩戴中"}
            </div>
          </div>
        </div>
      </div>

      {/* 能力诊断小行（v0.30.2）：4 维微条形图 + 总分。跨整张卡，置于上面 grid 之后 */}
      {ability && ability.raw.totalAttempts > 0 && (
        <div className={`relative mt-4 pt-3 border-t border-white/10`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className={`text-[11px] uppercase tracking-widest ${t.theme.subTextColor}`}>
              能力诊断
            </div>
            <div
              className={`text-xs font-display font-bold ${t.theme.textColor} tabular-nums`}
              title={'0-1000 综合能力分（与 XP 不同；反映学习"质量"）'}
            >
              {ability.score}<span className={`text-[10px] font-normal ${t.theme.subTextColor} ml-0.5`}>/1000</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <AbilityMini
              label="准"
              title="准确率（最近 7 天）"
              value={ability.components.accuracy}
              max={250}
              rawDisplay={`${Math.round(ability.raw.accuracy7d * 100)}%`}
              tone={t.theme.textColor}
              subTone={t.theme.subTextColor}
            />
            <AbilityMini
              label="熟"
              title="技能熟练度（按考试权重加权）"
              value={ability.components.mastery}
              max={400}
              rawDisplay={`${Math.round(ability.raw.weightedMastery)}`}
              tone={t.theme.textColor}
              subTone={t.theme.subTextColor}
            />
            <AbilityMini
              label="持"
              title="坚持度（连续 + 累计天数）"
              value={ability.components.continuity}
              max={200}
              rawDisplay={`连${ability.raw.streak}/共${ability.raw.cumulativeDays}`}
              tone={t.theme.textColor}
              subTone={t.theme.subTextColor}
            />
            <AbilityMini
              label="量"
              title="题量（总答题数）"
              value={ability.components.volume}
              max={150}
              rawDisplay={`${ability.raw.totalAttempts}题`}
              tone={t.theme.textColor}
              subTone={t.theme.subTextColor}
            />
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * 一维能力指示器：单字标签 + 微条形图 + 原始数据 hover tooltip。
 *
 * value/max 决定填充比例（0-1）。颜色用 tier 主题里的 textColor 跟整张卡呼应。
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
    <div className="flex flex-col gap-1" title={`${title}\n实际 ${rawDisplay} · 得分 ${Math.round(value)}/${max}`}>
      <div className="flex items-baseline gap-1">
        <span className={`text-[11px] font-display ${tone}`}>{label}</span>
        <span className={`text-[10px] tabular-nums ${subTone}`}>{rawDisplay}</span>
      </div>
      <div className="h-1.5 rounded-full bg-black/25 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-300 via-pink-300 to-violet-300 transition-all duration-700"
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
