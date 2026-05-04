/**
 * 勋章图标 — 优先用 AI 生成的图，没有就 emoji + tier 底色兜底。
 *
 * v0.29 重写：
 *  - 支持 tier prop（铜银金钻）→ 4 套底色 + 边框，看一眼就知道等级
 *  - 去厚装饰围圈，主体放大占 85%
 *  - 形状按 category：commemorative=六角星，skill=盾，ability=六边形，其他=圆
 *
 * 用法：
 *   <TrophyIcon trophyId="answer_master" subjectId="math" emoji="🎯"
 *               tier="silver" category="milestone" size="lg" />
 *
 * 内部用 (subjectId)_(trophyId)[_tier] 做 db.trophyImages 的 key —— 不同 tier
 * 是不同 AI 图（铜银金钻底色不同）。
 */

import { useTrophyImage } from "../lib/trophyImages";
import { trophyImageKey } from "../lib/allTrophies";
import type { TrophyCategory, TrophyTier } from "../core/types";

interface TrophyIconProps {
  /** 该 subject 的原始 trophy id（如 "answer_master"），不要加学科前缀 */
  trophyId: string;
  /** 学科隔离（math / chinese 同名 trophy 用不同图） */
  subjectId?: "math" | "chinese";
  /** v0.29: 当前 tier。tier-leveled 勋章（milestone/ability/skill）必须传；其他可以不传。 */
  tier?: TrophyTier;
  /** v0.29: 勋章分类（决定形状）。不传默认圆形。 */
  category?: TrophyCategory;
  emoji: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** 是否给图加发光边框（rare 用） */
  glow?: boolean;
  /** 是否解锁（false 时灰色） */
  unlocked?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<TrophyIconProps["size"]>, string> = {
  sm: "w-8 h-8 text-xl",
  md: "w-12 h-12 text-2xl",
  lg: "w-20 h-20 text-4xl",
  xl: "w-32 h-32 text-6xl",
};

/** v0.29: 4 套 tier 底色（emoji 兜底用；AI 图本身就带了正确底色） */
const TIER_BG: Record<TrophyTier, string> = {
  bronze:
    "bg-gradient-to-br from-amber-700/45 via-orange-600/30 to-amber-800/40 ring-1 ring-amber-600/60",
  silver:
    "bg-gradient-to-br from-slate-300/40 via-slate-100/25 to-slate-300/35 ring-1 ring-slate-200/70",
  gold:
    "bg-gradient-to-br from-yellow-400/55 via-amber-300/40 to-yellow-500/50 ring-1 ring-yellow-300/80",
  platinum:
    "bg-[conic-gradient(from_180deg,rgba(186,230,253,0.6),rgba(244,114,182,0.5),rgba(196,181,253,0.55),rgba(186,230,253,0.6))] ring-1 ring-cyan-200/70",
};

/** v0.29: 默认（无 tier）底色——commemorative / daily 用 */
const DEFAULT_BG =
  "bg-gradient-to-br from-violet-500/25 to-rose-500/15 ring-1 ring-violet-400/40";

/** v0.29: 形状按 category */
const SHAPE_BY_CATEGORY: Record<TrophyCategory, string> = {
  daily: "rounded-full", // 圆
  milestone: "rounded-full", // 圆
  ability: "rounded-2xl [clip-path:polygon(50%_0%,93%_25%,93%_75%,50%_100%,7%_75%,7%_25%)]", // 六边形
  skill: "rounded-2xl [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]", // 盾（拉伸六边形）
  commemorative:
    "rounded-2xl [clip-path:polygon(50%_0%,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)]", // 六角星
};

export function TrophyIcon({
  trophyId,
  subjectId,
  tier,
  category,
  emoji,
  size = "md",
  glow = false,
  unlocked = true,
  className = "",
}: TrophyIconProps) {
  const fullKey = subjectId
    ? trophyImageKey(subjectId, trophyId, tier)
    : trophyId;
  const row = useTrophyImage(fullKey);
  const sizeClass = SIZE_CLASSES[size];

  // 形状：有 AI 图时按 category；emoji 兜底也按 category
  const shapeClass = category
    ? SHAPE_BY_CATEGORY[category]
    : "rounded-full";

  const baseClass = `${sizeClass} ${className} ${shapeClass} overflow-hidden flex items-center justify-center shrink-0 transition-all`;
  const glowClass = glow ? "shadow-glow" : "";
  const grayClass = unlocked ? "" : "grayscale opacity-50 saturate-50";

  if (row?.imageDataUrl) {
    return (
      <div className={`${baseClass} ${glowClass} ${grayClass}`}>
        <img
          src={row.imageDataUrl}
          alt={`trophy-${trophyId}`}
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>
    );
  }

  // emoji 兜底：tier 决定底色 + 细金属边
  const bgClass = tier ? TIER_BG[tier] : DEFAULT_BG;
  return (
    <div className={`${baseClass} ${glowClass} ${grayClass} ${bgClass}`}>
      <span>{emoji}</span>
    </div>
  );
}
