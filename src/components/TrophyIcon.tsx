/**
 * 勋章图标 — v0.29.9 回归独立精修 AI 图路线：
 *
 * 用户反馈 v0.29.8 单色+CSS 染色"一致是一致，但太单调没质感，离 Apple Fitness 差太远"。
 * 决定每枚 trophy 独立创作（每枚 1 个手写 rich prompt），tier 变体通过 tier 金属调
 * 各自生成（最理想 img2img，目前用 text2img + tier flavor）。
 *
 * 渲染：所有 AI 图直接 <img> 显示（不再 mask 染色）。
 * tier 由 image 本身的金属调 + 外层 CSS ring/glow/角标 共同表达。
 */

import { getCommemorativeShape, useTrophyImage } from "../lib/trophyImages";
import { trophyImageKey } from "../lib/allTrophies";
import type { TrophyCategory, TrophyTier } from "../core/types";

interface TrophyIconProps {
  trophyId: string;
  subjectId?: "math" | "chinese";
  /** tier-leveled 勋章必须传；其他可不传。 */
  tier?: TrophyTier;
  /** 决定形状：commemorative=六角星 / skill=盾 / ability=六边形 / 其他=圆 */
  category?: TrophyCategory;
  emoji: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** 已废弃保留兼容；现 tier 自带 glow */
  glow?: boolean;
  /** 是否解锁（false 时灰色 + 不显示 tier 框） */
  unlocked?: boolean;
  className?: string;
}

const SIZE_PX: Record<NonNullable<TrophyIconProps["size"]>, { box: string; emoji: string; corner: string }> = {
  sm: { box: "w-8 h-8", emoji: "text-xl", corner: "text-[8px] px-1 py-px" },
  md: { box: "w-12 h-12", emoji: "text-2xl", corner: "text-[9px] px-1.5 py-0.5" },
  lg: { box: "w-20 h-20", emoji: "text-4xl", corner: "text-[10px] px-1.5 py-0.5" },
  xl: { box: "w-32 h-32", emoji: "text-6xl", corner: "text-xs px-2 py-1" },
};

const RING_PX: Record<NonNullable<TrophyIconProps["size"]>, number> = {
  sm: 1.5,
  md: 2,
  lg: 2.5,
  xl: 3,
};

const GLOW_PX: Record<NonNullable<TrophyIconProps["size"]>, number> = {
  sm: 4,
  md: 6,
  lg: 10,
  xl: 14,
};

/**
 * 五角星 clip：v0.30.11 调胖款（outer R=50, inner R=30），跟 buildCommemorativePrompt
 * 默认 "five-pointed star" 严格对应 — AI 画什么形状，clip 切什么形状。
 */
const PENTAGRAM_CLIP =
  "polygon(50% 0%, 67.6% 25.7%, 97.5% 34.5%, 78.5% 59.3%, 79.4% 90.5%, 50% 80%, 20.6% 90.5%, 21.5% 59.3%, 2.5% 34.5%, 32.4% 25.7%)";

/**
 * 六角星 clip：outer R=50, inner R=37.5（ratio 0.75 "胖星"，跟普通六芒星 ratio 0.577 比凹很浅）。
 * 12 顶点交替 outer↔inner，从顶部 0° 起顺时针。
 * v0.31.14：用户反馈"想看到更多徽章画面" → 把内半径从 30 提到 37.5（凹深从 40% 减到 25%）。
 * 给跨段纪念勋章（破晓登阶 / 蓉城启航 / 天府跃升 / 凤翔九天）用，多一个角 = 视觉权重更重。
 */
const HEXAGRAM_CLIP =
  "polygon(50% 0%, 69% 17.5%, 93.3% 25%, 87.5% 50%, 93.3% 75%, 69% 82.5%, 50% 100%, 31% 82.5%, 6.7% 75%, 12.5% 50%, 6.7% 25%, 31% 17.5%)";

/** 形状：CSS clip-path 完整值（含 polygon(...)）；圆形用空字符串特判 */
const SHAPE_CLIP: Record<TrophyCategory, string> = {
  daily: "",
  milestone: "",
  // 六边形（横纤竖宽）—— ability 用
  ability: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
  // 真盾形（flat top + 底部尖角）—— skill 用，跟 ability 六边形明显区分
  skill: "polygon(0% 5%, 100% 5%, 100% 55%, 50% 100%, 0% 55%)",
  // commemorative 默认五角星；运行时被 PENTAGRAM_CLIP / HEXAGRAM_CLIP 双形态替换。
  // 这里保留 default 是为了 SHAPE_CLIP[category] 在外面用得起来。
  commemorative: PENTAGRAM_CLIP,
  // Phase 2 boss：方形 shield 风格（接近 skill 但顶部更平 + 加了"V" notch）
  boss: "polygon(0% 0%, 100% 0%, 100% 70%, 50% 100%, 0% 70%)",
};

/**
 * v0.29.8: 每个 category 一个代表色 gradient，用于把单色 AI 线稿染成对应色。
 *
 * 选色逻辑：
 *  - daily 翠绿：每天的小胜利，活力清新
 *  - milestone 真金：里程碑成就，黄金质感
 *  - ability 钴蓝：能力维度，冷静理性
 *  - skill 紫罗兰：学科精通，神秘高级
 *  - commemorative 不用（直接显示 AI 多彩图）
 */
const CATEGORY_COLOR: Record<TrophyCategory, string> = {
  daily: "linear-gradient(135deg, #34d399, #059669)", // emerald
  milestone: "linear-gradient(135deg, #fbbf24, #d97706)", // gold
  ability: "linear-gradient(135deg, #60a5fa, #1d4ed8)", // blue
  skill: "linear-gradient(135deg, #c084fc, #6d28d9)", // violet
  commemorative: "transparent", // AI 图本身多彩，不需要染色
  boss: "linear-gradient(135deg, #fb923c, #c2410c)", // orange — 闯关战斗感
};

/** category 配色的"暗一点版本"，用于 emoji 兜底时的内底（避免太刺眼） */
const CATEGORY_BG: Record<TrophyCategory, string> = {
  daily: "linear-gradient(135deg, rgba(52,211,153,0.20), rgba(5,150,105,0.10), rgba(0,0,0,0.55))",
  milestone: "linear-gradient(135deg, rgba(251,191,36,0.25), rgba(217,119,6,0.12), rgba(0,0,0,0.55))",
  ability: "linear-gradient(135deg, rgba(96,165,250,0.20), rgba(29,78,216,0.10), rgba(0,0,0,0.55))",
  skill: "linear-gradient(135deg, rgba(192,132,252,0.20), rgba(109,40,217,0.10), rgba(0,0,0,0.55))",
  commemorative: "linear-gradient(135deg, rgba(251,191,36,0.20), rgba(0,0,0,0.55))",
  boss: "linear-gradient(135deg, rgba(251,146,60,0.25), rgba(194,65,12,0.12), rgba(0,0,0,0.55))",
};

interface TierStyle {
  /** 外环背景色（实色）。platinum 用 ringGradient 不用 ring。 */
  ring: string;
  /** 外环渐变背景（platinum 用） */
  ringGradient?: string;
  glowColor: string;
  cornerBg: string;
  cornerFg: string;
  cornerLabel: string;
  /** 钻档：是否叠加旋转全息光晕动画 */
  animated?: boolean;
  /**
   * v0.29.3: emoji 兜底时的内层渐变背景（让没 AI 图的勋章也有 tier 色感）。
   * 有 AI 图时不用（图本身有色）。
   */
  innerGradient: string;
}

/**
 * v0.31.12: commemorative 金属外框 + glow。
 * 跟 PENTAGRAM_CLIP / HEXAGRAM_CLIP 用同一个 polygon → 数学上 100% 对齐。
 * AI 图改成纯 motif on bg（不画外框），由 CSS 沿 clip 边缘渲染金属边框。
 *
 * 双形态调色：
 *  - pentagram（普通纪念）= 古典暖金，给"奖状级"事件
 *  - hexagram（跨段纪念）= 多彩鎏金 conic gradient，更隆重，类似钻档动画但不旋转（避免太刺眼）
 */
const COMMEMORATIVE_RING: Record<
  "pentagram" | "hexagram",
  { ring: string; glowColor: string }
> = {
  pentagram: {
    ring: "linear-gradient(135deg, #fef3c7 0%, #fde68a 30%, #f59e0b 60%, #b45309 100%)",
    glowColor: "rgba(251, 191, 36, 0.55)",
  },
  hexagram: {
    ring: "conic-gradient(from 0deg, #fde68a, #fb923c, #fde68a, #f9a8d4, #c4b5fd, #fde68a, #d97706, #fde68a)",
    glowColor: "rgba(251, 146, 60, 0.7)",
  },
};

const TIER_STYLE: Record<TrophyTier, TierStyle> = {
  bronze: {
    ring: "#cd7f32",
    glowColor: "rgba(205,127,50,0.55)",
    cornerBg: "linear-gradient(135deg, #d8954a, #a0522d)",
    cornerFg: "#fff7ed",
    cornerLabel: "★",
    innerGradient:
      "linear-gradient(135deg, rgba(205,127,50,0.30), rgba(160,82,45,0.18), rgba(0,0,0,0.55))",
  },
  silver: {
    ring: "#cbd5e1",
    glowColor: "rgba(203,213,225,0.6)",
    cornerBg: "linear-gradient(135deg, #f1f5f9, #94a3b8)",
    cornerFg: "#0f172a",
    cornerLabel: "★★",
    innerGradient:
      "linear-gradient(135deg, rgba(226,232,240,0.28), rgba(148,163,184,0.15), rgba(15,23,42,0.6))",
  },
  gold: {
    ring: "#fbbf24",
    glowColor: "rgba(251,191,36,0.7)",
    cornerBg: "linear-gradient(135deg, #fde68a, #d97706)",
    cornerFg: "#451a03",
    cornerLabel: "♛", // v0.29.3: ★★★ → ♛ 单字符王冠，不再拥挤
    innerGradient:
      "linear-gradient(135deg, rgba(251,191,36,0.34), rgba(217,119,6,0.20), rgba(0,0,0,0.55))",
  },
  platinum: {
    ring: "transparent",
    ringGradient:
      "conic-gradient(from 0deg, #bae6fd, #f9a8d4, #c4b5fd, #67e8f9, #fde68a, #bae6fd)",
    glowColor: "rgba(196,181,253,0.75)",
    cornerBg: "conic-gradient(from 0deg, #bae6fd, #f9a8d4, #c4b5fd, #67e8f9, #bae6fd)",
    cornerFg: "#1e1b4b",
    cornerLabel: "💎",
    animated: true,
    innerGradient:
      "linear-gradient(135deg, rgba(186,230,253,0.28), rgba(244,114,182,0.18), rgba(196,181,253,0.22), rgba(0,0,0,0.55))",
  },
};

export function TrophyIcon({
  trophyId,
  subjectId,
  tier,
  category = "milestone",
  emoji,
  size = "md",
  unlocked = true,
  className = "",
}: TrophyIconProps) {
  // v0.29.9: tier-leveled 勋章每个 tier 单独存图（独立 AI 生成），key 带 tier 后缀
  const fullKey = subjectId ? trophyImageKey(subjectId, trophyId, tier) : trophyId;
  const row = useTrophyImage(fullKey);
  const sz = SIZE_PX[size];
  const ringPx = RING_PX[size];
  const glowPx = GLOW_PX[size];
  // v0.31.11: commemorative 双形态 —— 普通纪念用五角星，跨段纪念用六角星。
  // 形状从 trophyImages.ts spec 决定（getCommemorativeShape），保证跟 AI prompt 同步。
  const commemorativeShape =
    category === "commemorative" ? getCommemorativeShape(fullKey) : null;
  const clipPath =
    commemorativeShape === "hexagram"
      ? HEXAGRAM_CLIP
      : commemorativeShape === "pentagram"
        ? PENTAGRAM_CLIP
        : SHAPE_CLIP[category];
  const isCircle = clipPath === "";
  const tierStyle = unlocked && tier ? TIER_STYLE[tier] : null;
  // v0.31.12：commemorative 金属外框 —— AI 图不再自画外框，由 CSS 沿 clip-path 边缘渲染
  // 暖金/鎏金 ring，跟 polygon 共用同一组顶点 → 100% 对齐 + 找回"勋章感"。
  const commemorativeRing =
    unlocked && commemorativeShape ? COMMEMORATIVE_RING[commemorativeShape] : null;

  const grayClass = unlocked ? "" : "grayscale opacity-40 saturate-50";

  // 圆形用 border-radius；多边形用 clip-path（外内层共用同一形状）
  const shapeStyle: React.CSSProperties = isCircle
    ? { borderRadius: "50%" }
    : { clipPath };

  // 外层 wrapper：tier 环色 + drop-shadow glow + 形状
  // commemorative 优先用金属外框（普通纪念暖金 / 跨段纪念鎏金），无 tier 时也能有勋章感
  const outerBg =
    tierStyle?.ringGradient ?? tierStyle?.ring ?? commemorativeRing?.ring ?? "transparent";
  const outerGlow = tierStyle?.glowColor ?? commemorativeRing?.glowColor;
  const outerStyle: React.CSSProperties = {
    ...shapeStyle,
    background: outerBg,
    filter: outerGlow ? `drop-shadow(0 0 ${glowPx}px ${outerGlow})` : undefined,
  };

  // 内层 art：缩进 ringPx 让外环金属色露出 1-2px 边
  const hasFrame = !!tierStyle || !!commemorativeRing;
  const innerStyle: React.CSSProperties = {
    ...shapeStyle,
    inset: hasFrame ? `${ringPx}px` : 0,
  };

  // v0.31.94 回滚 v0.31.92 self-framed 旁路：所有 trophy 都走 CSS clip-path +
  // tier/commemorative ring 统一路径。新 prompt (v0.31.94) 强制 AI 画完整圆形
  // 金属外框 + 深紫渐变 bg，CSS clip-path 圆切刚好露出 AI 框 + tier 薄环叠加。

  return (
    <div
      className={`relative inline-flex shrink-0 ${sz.box} ${className} ${grayClass}`}
      style={outerStyle}
    >
      {/* 内层 art：直接 <img> 渲染 AI 图（每枚独立精心生成），emoji 兜底 */}
      <div
        className="absolute flex items-center justify-center overflow-hidden"
        style={{
          ...innerStyle,
          background: row?.imageDataUrl
            ? "#000"
            : tierStyle?.innerGradient ?? CATEGORY_BG[category],
        }}
      >
        {row?.imageDataUrl ? (
          <img
            src={row.imageDataUrl}
            alt={`trophy-${trophyId}`}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <span className={sz.emoji}>{emoji}</span>
        )}
      </div>

      {/* 钻档全息光晕——v0.30.11 三层叠加：
         1) shimmer：8s 慢慢绕轴 conic 全息（之前 4s 太快头晕）
         2) shimmer-pulse：2.6s 内层呼吸亮度
         3) shimmer-sweep：3.5s 一道斜光带从左到右扫过（"折射光"感）
       */}
      {tierStyle?.animated && (
        <>
          <div
            className="absolute pointer-events-none animate-shimmer"
            style={{
              ...innerStyle,
              background:
                "conic-gradient(from 0deg, rgba(186,230,253,0.45), rgba(249,168,212,0.4), rgba(196,181,253,0.45), rgba(103,232,249,0.4), rgba(253,230,138,0.4), rgba(186,230,253,0.45))",
              mixBlendMode: "overlay",
            }}
          />
          <div
            className="absolute pointer-events-none animate-shimmer-pulse"
            style={{
              ...innerStyle,
              background:
                "radial-gradient(circle, rgba(255,255,255,0.18), rgba(255,255,255,0) 55%)",
              mixBlendMode: "screen",
            }}
          />
          <div
            className="absolute pointer-events-none overflow-hidden"
            style={innerStyle}
            aria-hidden="true"
          >
            <div
              className="absolute inset-0 animate-shimmer-sweep"
              style={{
                background:
                  "linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)",
                mixBlendMode: "screen",
                width: "200%",
                left: "-50%",
              }}
            />
          </div>
        </>
      )}

      {/* tier corner badge（右下） — sm 太小不显示 */}
      {tierStyle && size !== "sm" && (
        <div
          className={`absolute -bottom-1 -right-1 z-10 rounded-full font-bold leading-none whitespace-nowrap shadow-md border border-black/30 ${sz.corner}`}
          style={{
            background: tierStyle.cornerBg,
            color: tierStyle.cornerFg,
          }}
          aria-label={`tier-${tier}`}
        >
          {tierStyle.cornerLabel}
        </div>
      )}
    </div>
  );
}
