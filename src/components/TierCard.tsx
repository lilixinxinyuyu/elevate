import { useEffect, useRef, useState } from "react";
import type { RatingResult, AbilityDiagnostic } from "../core/rating";
import type { Tier } from "../core/tiers";
import { TierBadgeImg } from "./TierBadgeImg";

/**
 * v0.31.4：XP roll-up 动画 — 进首页时从"上次记录的 XP"滚到当前 XP。
 *
 * 方案：localStorage 存最后看到的 XP 数；进 Hero 时读老值 → 动画到新值 →
 * 写回最新值。每次进首页都"涨给她看"，给 9 岁孩子最强反馈。
 *
 * 控制：
 *   - delta < 0（不可能，但防御）→ 直接显示新值无动画
 *   - delta > 200（一次性大涨）→ 限速到 1200ms 内完成，避免太长
 *   - 数字 ease-out（先快后慢）匹配人眼期待
 */
function useRollupNumber(target: number, key: string): number {
  const [display, setDisplay] = useState<number>(() => {
    if (typeof window === "undefined") return target;
    const stored = localStorage.getItem(key);
    const last = stored != null ? Number(stored) : NaN;
    return Number.isFinite(last) && last <= target ? last : target;
  });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(key);
    const last = stored != null ? Number(stored) : NaN;
    const start = Number.isFinite(last) && last <= target ? last : target;
    const delta = target - start;
    if (delta <= 0) {
      setDisplay(target);
      localStorage.setItem(key, String(target));
      return;
    }
    const duration = Math.min(1200, 350 + delta * 4);
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const v = Math.round(start + delta * eased);
      setDisplay(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        localStorage.setItem(key, String(target));
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, key]);

  return display;
}

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
  // v0.31.16：Hero 背景框 / 文字色跟着佩戴的勋章走（用户切徽章 → 框换色）。
  // rating.tier 仍然决定显示的段位文字（左下"再得 X 升 ★II" / 右下"锦江区 I"），
  // 这是真实段位进度，不被佩戴影响。
  const theme = equippedBadge.theme;
  const [abilityOpen, setAbilityOpen] = useState(false);
  // v0.31.4：XP 大数 roll-up（昨日总分 → 今日总分），key 含学期避免学期切换误滚
  const displayScore = useRollupNumber(rating.score, `tierCard:lastSeenScore:${rating.tier.id}`);

  // v0.31.50: 即将升大段 = sub V (最后一档) 且 ≤ 200 XP 跨段。
  // 老版判定 subRank >= 4（4 档系统的最后一档）→ 现在改 subRank === 5。
  const tierUpImminent =
    rating.subRank >= 5 && rating.nextTier && rating.deltaToNext > 0 && rating.deltaToNext <= 200;

  // v0.31.50: 升小段 hint 用完整称号（"升 锦江数学小达人"），比 "升 ★II" 有荣誉感。
  // - 还在大段里：升下一小段称号
  // - 大段顶（V 档）：跨入下一大段第 1 档（"升 成都数学爱好者"）
  // - 全国 V：已封顶
  const nextHint = (() => {
    if (rating.nextSubTierLabel) {
      return (
        <>
          再得 <span className={`font-bold tabular-nums ${theme.textColor}`}>{rating.deltaToNextSubRank.toLocaleString()}</span> XP 升
          <span className={`ml-1 ${theme.textColor} font-display font-bold`}>
            {rating.nextSubTierLabel}
          </span>
        </>
      );
    }
    return <>🏆 中华数学小状元 · 永远在涨</>;
  })();

  // v0.31.79: 小段位徽章装饰层级 — 重做，让 5 档渐进更明显（之前 ring 差异太弱）。
  // 主徽章不变，只叠 ring / glow / emoji 角标。
  const subPolishClass = (() => {
    switch (rating.subRank) {
      case 1:
        return ""; // 基础 — 朴素初学者
      case 2:
        return "ring-2 ring-cyan-300/60 shadow-[0_0_18px_rgba(34,211,238,0.35)]"; // 青蓝圈
      case 3:
        return "ring-2 ring-violet-300/70 shadow-[0_0_24px_rgba(167,139,250,0.5)] animate-pulse-soft"; // 紫光呼吸
      case 4:
        return "ring-[3px] ring-amber-300/80 shadow-[0_0_30px_rgba(251,191,36,0.65)] animate-pulse-soft"; // 金圈强光
      case 5:
        return "ring-[4px] ring-amber-200 shadow-[0_0_40px_rgba(252,211,77,0.85)] animate-pulse-soft"; // 顶级金光环
      default:
        return "";
    }
  })();
  // v0.31.79: 角标 emoji — 给 4 / 5 级加显眼标记
  const subOrnamentEmoji = (() => {
    switch (rating.subRank) {
      case 2: return "✨";
      case 3: return "💎";
      case 4: return "🏅";
      case 5: return "👑";
      default: return null;
    }
  })();

  return (
    <section
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${theme.fromColor} ${theme.toColor} border ${theme.borderColor} px-5 py-4 sm:px-6 sm:py-5`}
    >
      {/* ambient 光晕 — 给"宝物展示柜"感 */}
      <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-20 w-72 h-72 rounded-full bg-white/[0.06] blur-3xl pointer-events-none" />

      {/* v0.31.2：紧凑化 — 高度 -30%。XP 大数从 7xl 降到 5xl，徽章从 210→150，
         gap/padding 收紧。视觉重量让位给下面 3 环 + CTA。 */}
      <div className="relative flex flex-row gap-4 sm:gap-5 items-center">
        {/* 左：成长块 */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className={`text-xs sm:text-sm ${theme.subTextColor}`}>你好 {studentName} 👋</div>

          {/* XP 数字 — 紧凑 hero scale */}
          <div className="animate-score-slide-in">
            <div className="flex items-baseline gap-1.5">
              <div
                className={`font-display font-bold text-4xl sm:text-5xl ${theme.textColor} drop-shadow-glow tabular-nums leading-[0.95]`}
              >
                {displayScore.toLocaleString()}
              </div>
              <div className={`text-xs sm:text-sm ${theme.subTextColor}`}>XP</div>
            </div>

            {/* v0.31.50: 小段位称号 = 主身份显示（替代过去只显示 ★ 罗马数字），
                给 Selena 看到的是"锦江数学课代表"这种有荣誉感的头衔。
                星级跟在称号后面当 grade 标识 */}
            <div className={`mt-1.5 flex flex-wrap items-center gap-1.5 text-xs ${theme.subTextColor}`}>
              <span className={`font-display font-bold text-sm ${theme.textColor}`}>
                {rating.subTierLabel}
              </span>
              <span className="text-amber-300 text-sm tracking-tighter leading-none">
                {rating.subRankStars}
              </span>
              <span className="opacity-50">·</span>
              <span>超过 <span className={`font-display font-bold ${theme.textColor}`}>{rating.percentSurpassed}%</span></span>
            </div>
          </div>

          {/* v0.31.50: 进度条只显示当前小段位（短，2-7 天能爬满）。
              老版本是整个大段位（10k+ XP，几个月才走完）— 体感太静止。
              即将跨大段时仍显示 chip（pulse），其他时间安静展示 nextHint。 */}
          <div>
            {tierUpImminent && rating.nextTier && (
              <div className="mb-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/50 text-[11px] font-bold text-amber-100 animate-pulse-soft">
                <span>🔥</span>
                <span>仅剩 <span className="tabular-nums">{rating.deltaToNext}</span> XP 跨入 {rating.nextTier.badgeIcon} {rating.nextTier.name}</span>
              </div>
            )}
            <div className="h-1.5 rounded-full bg-black/25 overflow-hidden ring-1 ring-white/5">
              <div
                className="h-full bg-gradient-to-r from-amber-300 via-pink-300 to-violet-300 shadow-glow-amber transition-all duration-700"
                style={{ width: `${Math.round(rating.subTierProgress * 100)}%` }}
              />
            </div>
            <div className={`mt-1 flex items-center justify-between gap-2 text-[10px] tabular-nums ${theme.subTextColor}`}>
              <span>{rating.subTierInto.toLocaleString()} / {rating.subTierSize.toLocaleString()} XP</span>
              <span className="opacity-70">大段总进度 {Math.round(rating.progressInTier * 100)}%</span>
            </div>
            {!tierUpImminent && (
              <div className={`mt-1.5 text-[11px] ${theme.subTextColor}`}>{nextHint}</div>
            )}
          </div>
        </div>

        {/* 右：身份块（紧凑徽章 + 段位名） */}
        <div
          className="shrink-0 flex flex-col items-center justify-center gap-2"
          title={equippedBadge.badgeDesc}
        >
          <div className="relative">
            <div
              className="absolute inset-0 -m-3 rounded-full blur-2xl opacity-40 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.5), rgba(255,255,255,0) 65%)",
              }}
            />
            <TierBadgeImg
              tierId={equippedBadge.id}
              fallbackEmoji={equippedBadge.badgeIcon}
              size={120}
              interactive
              shape="circle"
              alt={equippedBadge.badgeName}
              className={`relative shadow-glow sm:!w-[150px] sm:!h-[150px] rounded-full ${subPolishClass}`}
            />
            {/* v0.31.79：sub-rank 角标 emoji（rank 2-5 显示）*/}
            {subOrnamentEmoji && (
              <span
                className="absolute -top-2 -right-2 text-2xl drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] pointer-events-none animate-pop"
                aria-hidden
                title={`${rating.subRankRoman} 段`}
              >
                {subOrnamentEmoji}
              </span>
            )}
          </div>
          <div className="text-center">
            <div className={`text-sm sm:text-base font-display font-bold ${theme.textColor} leading-tight`}>
              {t.name}
              <span className="ml-1 text-xs">{rating.subRankRoman}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 能力诊断（折叠 row：label + 分数 + ▾。删了内联 bar 避免起止不齐）
          v0.31.5：去掉 border-t 分割线（视觉噪音）。用纯垂直间距区分。 */}
      {ability && ability.raw.totalAttempts > 0 && (
        <div className="relative mt-4">
          <button
            type="button"
            onClick={() => setAbilityOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 text-left rounded-lg -mx-1 px-2 py-1.5 transition-colors hover:bg-white/5"
            aria-expanded={abilityOpen}
          >
            <div className="flex items-baseline gap-3">
              <span className={`text-[11px] uppercase tracking-widest ${theme.subTextColor}`}>
                能力诊断
              </span>
              <span className={`text-sm tabular-nums ${theme.subTextColor}`}>
                <span className={`font-display font-bold text-base ${theme.textColor}`}>
                  {ability.score}
                </span>
                <span className="ml-1 opacity-70">/ 1000</span>
              </span>
            </div>
            <span
              className={`text-xs ${theme.subTextColor} transition-transform shrink-0 ${abilityOpen ? "rotate-180" : ""}`}
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
                tone={theme.textColor}
                subTone={theme.subTextColor}
              />
              <AbilityMini
                label="熟练"
                title="技能熟练度（按考试权重加权）"
                value={ability.components.mastery}
                max={400}
                rawDisplay={`${Math.round(ability.raw.weightedMastery)} 分`}
                tone={theme.textColor}
                subTone={theme.subTextColor}
              />
              <AbilityMini
                label="坚持"
                title="坚持度（连续天数 + 累计天数）"
                value={ability.components.continuity}
                max={200}
                rawDisplay={`连 ${ability.raw.streak} · 共 ${ability.raw.cumulativeDays} 天`}
                tone={theme.textColor}
                subTone={theme.subTextColor}
              />
              <AbilityMini
                label="广度"
                title={`练习广度（每 skill 最多贡献 5 道独立答对，最大 150）。\n反"姊妹题刷分"：1 skill 100 道也只 5 分；30 skill 各 5 道 = 150 满分。\n衡量"练得广不广"，不是"练得多不多"。`}
                value={ability.components.volume}
                max={150}
                rawDisplay={`${ability.raw.skillCoverageScore} 分 · ${ability.raw.uniqueQuestionsCorrect} 独立答对`}
                tone={theme.textColor}
                subTone={theme.subTextColor}
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

/** 紧凑版：在结算页 / 其他位置显示分数 + 段位（不带佩戴概念，按 rating tier 染色） */
export function TierCompact({ rating }: { rating: RatingResult }) {
  const t = rating.tier;
  const theme = t.theme;
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border ${theme.borderColor}`}>
      <span className="text-base">{t.badgeIcon}</span>
      <span className={`text-sm font-display font-bold ${theme.textColor}`}>
        {rating.score}
      </span>
      <span className={`text-xs ${theme.subTextColor}`}>{t.name}</span>
    </div>
  );
}
