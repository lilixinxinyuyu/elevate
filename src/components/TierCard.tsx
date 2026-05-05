import { useState } from "react";
import type { RatingResult, AbilityDiagnostic } from "../core/rating";
import type { Tier } from "../core/tiers";
import { TierBadgeImg } from "./TierBadgeImg";

/**
 * Hero 卡 v0.30.6 专业级 polish：
 *
 * 修了 v0.30.5 几个细节：
 *   1. 双 rim 冲突：之前 CSS ring-2 外圈 + AI 图自带银 rim 不重合 → 视觉双线毛刺。
 *      v0.30.6 删 CSS ring，只留 shadow-glow + 内嵌径向白光晕，让 AI rim 独占
 *   2. 能力诊断 inline bar 起止不齐：删 inline bar，只留 label + 分数 + ▾，
 *      展开后看 4 个对齐 mini bar（已有，且对齐）
 *   3. 垂直节奏全部对齐到 4-base grid（4/8/12/16/20/24/32）
 *   4. 左列改 flex justify-between，让左下"再得 X 升 ★"跟右下"和平街小学"基线对齐
 *   5. badge sharpness：trophyImages.ts 加 large 档（512×512 q=0.92），retina 不糊
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
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${t.theme.fromColor} ${t.theme.toColor} border ${t.theme.borderColor} px-6 py-6`}
    >
      {/* ambient 光晕 — 给"宝物展示柜"感 */}
      <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-20 w-72 h-72 rounded-full bg-white/[0.06] blur-3xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row gap-6 sm:gap-8">
        {/* 左：成长块（greeting 顶 + XP/进度/提示 底，左右底部对齐） */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-6">
          <div className={`text-sm ${t.theme.subTextColor}`}>你好 {studentName} 👋</div>

          <div className="flex flex-col gap-4">
            {/* XP 数字 — hero scale */}
            <div className="animate-score-slide-in">
              <div className="flex items-baseline gap-2">
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
            </div>

            {/* 进度条 + 下个目标 */}
            <div>
              <div className="h-2 rounded-full bg-black/25 overflow-hidden ring-1 ring-white/5">
                <div
                  className="h-full bg-gradient-to-r from-amber-300 via-pink-300 to-violet-300 shadow-glow-amber transition-all duration-700"
                  style={{ width: `${Math.round(rating.progressInTier * 100)}%` }}
                />
              </div>
              <div className={`mt-2 text-xs ${t.theme.subTextColor}`}>{nextHint}</div>
            </div>
          </div>
        </div>

        {/* 右：身份块（BIG 校徽 + 段位名）— 居中对齐左列 */}
        <div
          className="self-center sm:self-stretch shrink-0 flex flex-col items-center justify-center gap-4"
          title={equippedBadge.badgeDesc}
        >
          {/* 校徽座：径向白光晕作底，让校徽像"放在玻璃罩里"。删了 CSS ring 让 AI 银 rim 独占 */}
          <div className="relative">
            <div
              className="absolute inset-0 -m-4 rounded-full blur-2xl opacity-40 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.5), rgba(255,255,255,0) 65%)",
              }}
            />
            <TierBadgeImg
              tierId={equippedBadge.id}
              fallbackEmoji={equippedBadge.badgeIcon}
              size={210}
              interactive
              shape="circle"
              alt={equippedBadge.badgeName}
              className="relative shadow-glow"
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

      {/* 能力诊断（折叠 row：label + 分数 + ▾。删了内联 bar 避免起止不齐） */}
      {ability && ability.raw.totalAttempts > 0 && (
        <div className="relative mt-6 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => setAbilityOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 text-left rounded-lg -mx-1 px-2 py-1.5 transition-colors hover:bg-white/5"
            aria-expanded={abilityOpen}
          >
            <div className="flex items-baseline gap-3">
              <span className={`text-[11px] uppercase tracking-widest ${t.theme.subTextColor}`}>
                能力诊断
              </span>
              <span className={`text-sm tabular-nums ${t.theme.subTextColor}`}>
                <span className={`font-display font-bold text-base ${t.theme.textColor}`}>
                  {ability.score}
                </span>
                <span className="ml-1 opacity-70">/ 1000</span>
              </span>
            </div>
            <span
              className={`text-xs ${t.theme.subTextColor} transition-transform shrink-0 ${abilityOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>

          {abilityOpen && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 animate-score-slide-in">
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
                label="覆盖"
                title={`覆盖广度（每 skill 最多贡献 5 道独立答对，最大 150）。\n反"姊妹题刷分"：1 skill 100 道也只 5 分；30 skill 各 5 道 = 150 满分。`}
                value={ability.components.volume}
                max={150}
                rawDisplay={`${ability.raw.skillCoverageScore} 分 · ${ability.raw.uniqueQuestionsCorrect} 独立答对`}
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

/** 单维能力指示器：单色细条 + 标签 + 原始数据。跟主进度条 ring 风格一致 */
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
      className="flex flex-col gap-1.5"
      title={`${title}\n实际 ${rawDisplay} · 得分 ${Math.round(value)}/${max}`}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className={`text-[11px] ${tone}`}>{label}</span>
        <span className={`text-[10px] tabular-nums ${subTone}`}>{rawDisplay}</span>
      </div>
      <div className="h-1 rounded-full bg-black/25 overflow-hidden ring-1 ring-white/5">
        <div
          className="h-full bg-white/40 transition-all duration-700"
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
