/**
 * 勋章图标 — 优先用 AI 生成的图，没有就 emoji 兜底。
 *
 * 用法：
 *   <TrophyIcon trophyId="first_step" subjectId="chinese" emoji="🌱" size="md" />
 *
 * 内部用 (subjectId)_(trophyId) 做 db.trophyImages 的 key，避免 math/chinese
 * 重名 trophy 撞图。
 *
 * size:
 *   sm: w-8 h-8     (内联在卡片角)
 *   md: w-12 h-12   (列表 / row 用)
 *   lg: w-20 h-20   (墙上的奖杯卡)
 *   xl: w-32 h-32   (盲盒揭示 / 单独大图)
 */

import { useTrophyImage } from "../lib/trophyImages";
import { trophyImageKey } from "../lib/allTrophies";

interface TrophyIconProps {
  /** 该 subject 的原始 trophy id（如 "first_step"），不要加学科前缀 */
  trophyId: string;
  /** 学科隔离（math / chinese 同名 trophy 用不同图） */
  subjectId?: "math" | "chinese";
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

export function TrophyIcon({
  trophyId,
  subjectId,
  emoji,
  size = "md",
  glow = false,
  unlocked = true,
  className = "",
}: TrophyIconProps) {
  const fullKey = subjectId ? trophyImageKey(subjectId, trophyId) : trophyId;
  const row = useTrophyImage(fullKey);
  const sizeClass = SIZE_CLASSES[size];
  // AI 图用圆形（badge medal 风格）；emoji 兜底用圆角方形（图标式）
  const shapeClass = row?.imageDataUrl ? "rounded-full" : "rounded-2xl";
  const baseClass = `${sizeClass} ${className} ${shapeClass} overflow-hidden flex items-center justify-center shrink-0 transition-all`;
  const glowClass = glow
    ? "ring-2 ring-amber-400/60 shadow-glow-amber"
    : "";
  const grayClass = unlocked
    ? ""
    : "grayscale opacity-50 saturate-50";

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

  // emoji 兜底 — 不再带显式 border（避免外层卡片+TrophyIcon 双框），
  // glow=true 时由 ring 给视觉边界，没 glow 时就是干净的圆角方块
  return (
    <div className={`${baseClass} ${glowClass} ${grayClass} bg-gradient-to-br from-amber-500/15 to-rose-500/10`}>
      <span>{emoji}</span>
    </div>
  );
}
