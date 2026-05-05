/**
 * 段位校徽图——hero 卡 + 段位勋章柜共用。
 *
 * v0.30.3 重构：cache key 统一到 `math_tier_${tierId}`（跟 BadgeInventory /
 * TrophyIcon 同源）。第一次进入 hero 会触发 ensureTrophyImage 生成 + 缓存到
 * db.trophyImages。命中后 BadgeInventory 也立刻显示同一张图。
 *
 * 入场：mount 时 animate-badge-enter（弹性缩放 + 微旋转）。
 * hover：scale-110 + 描边发光 + 7° 摆动（interactive=true 时）。
 * 切换段位：key={tierId} 重新挂载 → 重新跑入场动画（升级视觉冲击）。
 */

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { ensureTierBadgeImage, tierBadgeImageKey } from "../lib/tierBadge";

interface Props {
  /** 段位 id：school / district / city / province / country */
  tierId: string;
  /** 缓存 miss 时显示的 emoji */
  fallbackEmoji: string;
  /** 像素尺寸，默认 32 */
  size?: number;
  /** 是否启用 hover 高亮 + 入场动画（hero 用 true，其他静态显示用 false） */
  interactive?: boolean;
  /** 额外 wrapper 类（控制描边/光晕） */
  className?: string;
  /** 透传给 img 的 alt */
  alt?: string;
  /** 形状：默认 circle；hero 大块 badge 想要圆角矩形可以传 "rounded" */
  shape?: "circle" | "rounded";
}

export function TierBadgeImg({
  tierId,
  fallbackEmoji,
  size = 32,
  interactive = false,
  className = "",
  alt,
  shape = "circle",
}: Props) {
  // useLiveQuery：缓存写入后自动刷新组件
  const cached = useLiveQuery(
    () => db.trophyImages.get(tierBadgeImageKey(tierId)),
    [tierId],
  );
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    if (cached?.imageDataUrl) return;
    void ensureTierBadgeImage(tierId).catch(() => void 0);
  }, [tierId, cached?.imageDataUrl]);

  const src = cached?.imageDataUrl ?? null;

  const radiusClass = shape === "circle" ? "rounded-full" : "rounded-2xl";
  const wrapClass = [
    "inline-flex items-center justify-center overflow-hidden shrink-0",
    radiusClass,
    interactive ? "transition-all duration-300" : "",
    interactive
      ? "ring-1 ring-white/15 hover:ring-2 hover:ring-white/40 hover:shadow-glow"
      : "",
    interactive && src ? "animate-badge-enter" : "",
    interactive && isHovering ? "animate-badge-wiggle" : "",
    className,
  ].filter(Boolean).join(" ");

  // key={tierId} 让切换段位时重新挂载 → 重跑入场动画
  return (
    <span
      key={tierId}
      className={wrapClass}
      style={{ width: size, height: size }}
      onMouseEnter={() => interactive && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onAnimationEnd={(e) => {
        if (e.animationName === "badgeHoverWiggle") setIsHovering(false);
      }}
      aria-label={alt}
    >
      {src ? (
        <img
          src={src}
          alt={alt ?? ""}
          width={size}
          height={size}
          loading="eager"
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        // fallback：emoji。size*0.55 字号让它在大的 badge 框里也居中合适
        <span
          aria-hidden="true"
          className="leading-none select-none"
          style={{ fontSize: Math.round(size * (size > 60 ? 0.45 : 0.65)) }}
        >
          {fallbackEmoji}
        </span>
      )}
    </span>
  );
}
