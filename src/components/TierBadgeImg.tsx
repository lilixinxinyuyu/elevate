/**
 * 段位校徽图——hero 卡 + 段位勋章柜共用。
 *
 * 第一次进入 hero 时（每段都触发一次） ensureTierBadgeImage 会去后台生成 + 缓存。
 * 缓存命中：渲染真实 AI 图。未命中：fallback 到 emoji，不阻塞 UI。
 *
 * 入场动画：mount 时跑 `animate-badge-enter`，scale 从 0.55→1.08→1（弹性回正）
 * + 微旋转。hover：scale-110 + ring-glow + 7°小摆动。
 *
 * 注：动画类只跑一次（key={tierId}），切换段位时重新挂载 → 重新跑动画。
 */

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { ensureTierBadgeImage } from "../lib/tierBadge";

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
}

export function TierBadgeImg({
  tierId,
  fallbackEmoji,
  size = 32,
  interactive = false,
  className = "",
  alt,
}: Props) {
  // useLiveQuery：缓存写入后自动刷新组件。trophyImages 表里 _tier_badge_<id> 一行
  const cached = useLiveQuery(
    () => db.trophyImages.get(`_tier_badge_${tierId}`),
    [tierId],
  );
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    if (cached?.imageDataUrl) return;
    void ensureTierBadgeImage(tierId).catch(() => void 0);
  }, [tierId, cached?.imageDataUrl]);

  const src = cached?.imageDataUrl ?? null;

  const wrapClass = [
    "inline-flex items-center justify-center rounded-full overflow-hidden shrink-0",
    interactive ? "transition-all duration-300" : "",
    interactive
      ? "ring-1 ring-white/15 hover:ring-2 hover:ring-white/40 hover:shadow-glow"
      : "",
    interactive && src ? "animate-badge-enter" : "",
    interactive && isHovering ? "animate-badge-wiggle" : "",
    className,
  ].filter(Boolean).join(" ");

  // 用 key={tierId} 让切换段位时重新挂载，重新跑动画
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
        // fallback：emoji。约 size*0.7 字号让它在圆里居中合适
        <span
          aria-hidden="true"
          className="leading-none select-none"
          style={{ fontSize: Math.round(size * 0.7) }}
        >
          {fallbackEmoji}
        </span>
      )}
    </span>
  );
}
