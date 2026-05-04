/**
 * 勋章图标 — v0.29.8 单色 SVG + CSS 染色路线：
 *
 * 两种渲染模式（按 category 自动切换）：
 *
 * 1) commemorative（第一步等纪念勋章）→ "AI 多彩图" 模式：
 *    AI 图自带丰富配色（传家宝风），直接 <img> 渲染。
 *
 * 2) daily / milestone / ability / skill → "单色 SVG + CSS 染色" 模式：
 *    AI 图是纯白线稿在纯黑底上（buildMonochromeIconPrompt），CSS 用
 *    mask-image (luminance) + category gradient 把白色染成 daily=翠绿 /
 *    milestone=真金 / ability=钴蓝 / skill=紫罗兰。tier 仍由外环 + 角标承担。
 *
 *    优势：所有 trophy 来自同一画风的"白底黑字"基础图，**绝对一致**；
 *    富色由 CSS 硬编码，不靠 AI 抽奖；每类一种代表色一目了然。
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
  commemorative:
    "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
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
};

/** category 配色的"暗一点版本"，用于 emoji 兜底时的内底（避免太刺眼） */
const CATEGORY_BG: Record<TrophyCategory, string> = {
  daily: "linear-gradient(135deg, rgba(52,211,153,0.20), rgba(5,150,105,0.10), rgba(0,0,0,0.55))",
  milestone: "linear-gradient(135deg, rgba(251,191,36,0.25), rgba(217,119,6,0.12), rgba(0,0,0,0.55))",
  ability: "linear-gradient(135deg, rgba(96,165,250,0.20), rgba(29,78,216,0.10), rgba(0,0,0,0.55))",
  skill: "linear-gradient(135deg, rgba(192,132,252,0.20), rgba(109,40,217,0.10), rgba(0,0,0,0.55))",
  commemorative: "linear-gradient(135deg, rgba(251,191,36,0.20), rgba(0,0,0,0.55))",
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
  const fullKey = subjectId ? trophyImageKey(subjectId, trophyId) : trophyId;
  const row = useTrophyImage(fullKey);
  const sz = SIZE_PX[size];
  const ringPx = RING_PX[size];
  const glowPx = GLOW_PX[size];
  const clipPath = SHAPE_CLIP[category];
  const isCircle = clipPath === "";
  const tierStyle = unlocked && tier ? TIER_STYLE[tier] : null;
  const isMonochrome = category !== "commemorative"; // commemorative 直接渲染 AI 多彩图，其他走 CSS 染色

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
      {/* 内层 art：单色 AI 线稿走 mask 染色路线；commemorative 多彩图直接显示 */}
      {isMonochrome && row?.imageDataUrl ? (
        <MonochromeArt
          dataUrl={row.imageDataUrl}
          category={category}
          shapeStyle={shapeStyle}
          inset={tierStyle ? ringPx : 0}
        />
      ) : (
        <div
          className="absolute flex items-center justify-center overflow-hidden"
          style={{
            ...innerStyle,
            // emoji 兜底：commemorative 用金色调，其他用 category 色（不被 tier 覆盖，让 category 一眼可识别）
            background: row?.imageDataUrl
              ? "#000"
              : CATEGORY_BG[category],
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
      )}

      {/* 钻档全息光晕（仅多彩 commemorative + 钻 tier 才能看到，单色 mask 模式下天然不需要） */}
      {tierStyle?.animated && !isMonochrome && (
        <div
          className="absolute pointer-events-none animate-shimmer"
          style={{
            ...innerStyle,
            background:
              "conic-gradient(from 0deg, rgba(186,230,253,0.4), rgba(249,168,212,0.35), rgba(196,181,253,0.4), rgba(103,232,249,0.35), rgba(186,230,253,0.4))",
            mixBlendMode: "overlay",
          }}
        />
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

/**
 * v0.29.8: 单色 AI 线稿渲染。
 *
 * 两层结构：
 *   - 底层：CATEGORY_BG（深色 category 暗底）—— 让形状有"基底"
 *   - 顶层：CATEGORY_COLOR（亮 category gradient）+ luminance mask 把白色像素染色
 *
 * 实测：mask-mode: luminance 让纯白线条变成 category 色，黑底变透明 →
 * 透出底层暗 category bg → 整体观感是"亮 motif 浮在暗底上"，跟 Apple Fitness 一致。
 */
function MonochromeArt({
  dataUrl,
  category,
  shapeStyle,
  inset,
}: {
  dataUrl: string;
  category: TrophyCategory;
  shapeStyle: React.CSSProperties;
  inset: number;
}) {
  const cssUrl = `url("${dataUrl}")`;
  return (
    <>
      {/* 底层：暗 category 底，让 motif 有立体感 */}
      <div
        className="absolute"
        style={{
          ...shapeStyle,
          inset: `${inset}px`,
          background: CATEGORY_BG[category],
        }}
      />
      {/* 顶层：亮 category gradient + luminance mask
          注：mask-mode 需要 type assertion，CSS Properties 类型还没 ship 这个 */}
      <div
        className="absolute"
        style={{
          ...shapeStyle,
          inset: `${inset}px`,
          background: CATEGORY_COLOR[category],
          WebkitMaskImage: cssUrl,
          maskImage: cssUrl,
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          // luminance mode：白色像素=可见、黑底=透明
          ["WebkitMaskMode" as never]: "luminance",
          ["maskMode" as never]: "luminance",
        }}
      />
    </>
  );
}
