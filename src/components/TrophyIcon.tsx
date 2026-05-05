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

import { useTrophyImage } from "../lib/trophyImages";
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

/** 形状：CSS clip-path 完整值（含 polygon(...)）；圆形用空字符串特判 */
const SHAPE_CLIP: Record<TrophyCategory, string> = {
  daily: "",
  milestone: "",
  // 六边形（横纤竖宽）—— ability 用
  ability: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
  // 真盾形（flat top + 底部尖角）—— skill 用，跟 ability 六边形明显区分
  skill: "polygon(0% 5%, 100% 5%, 100% 55%, 50% 100%, 0% 55%)",
  // commemorative 五角星 v0.30.11 调胖：之前 inner radius ≈ 18.6%（凹得很深，
  // AI 图被切剩 ~50%）；现在 inner radius ≈ 30%（凹缓很多，AI 图保留 ~75% 可见面积）。
  // 用经典五角星几何：outer R=50, inner R=30，五个外尖在 90/-54/342/270/198 度 +
  // 五个内点在 54/-18/270/198 度对偶角。
  commemorative:
    "polygon(50% 0%, 67.6% 25.7%, 97.5% 34.5%, 78.5% 59.3%, 79.4% 90.5%, 50% 80%, 20.6% 90.5%, 21.5% 59.3%, 2.5% 34.5%, 32.4% 25.7%)",
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
  const clipPath = SHAPE_CLIP[category];
  const isCircle = clipPath === "";
  const tierStyle = unlocked && tier ? TIER_STYLE[tier] : null;

  const grayClass = unlocked ? "" : "grayscale opacity-40 saturate-50";

  // 圆形用 border-radius；多边形用 clip-path（外内层共用同一形状）
  const shapeStyle: React.CSSProperties = isCircle
    ? { borderRadius: "50%" }
    : { clipPath };

  // 外层 wrapper：tier 环色 + drop-shadow glow + 形状
  const outerStyle: React.CSSProperties = {
    ...shapeStyle,
    background: tierStyle?.ringGradient ?? tierStyle?.ring ?? "transparent",
    filter: tierStyle ? `drop-shadow(0 0 ${glowPx}px ${tierStyle.glowColor})` : undefined,
  };

  // 内层 art：缩进 ringPx 让外环显示出 tier 颜色
  const innerStyle: React.CSSProperties = {
    ...shapeStyle,
    inset: tierStyle ? `${ringPx}px` : 0,
  };

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
