/**
 * 小进头像 — UI 全局通用的吉祥物 avatar。
 *
 * 用法：
 *   <MascotAvatar size="md" />        // AI 在干活时全 UI 配
 *   <MascotAvatar size="lg" autoEnsure />  // 出现时如果还没生成就自动生成
 *
 * 逻辑：
 *   - 从 db.trophyImages 读 mascot 图（同 trophyId="_mascot_xiaojin"）
 *   - 没有时显示 emoji 兜底（👩‍🏫 / 🐼）
 *   - autoEnsure=true 时自动触发后台生成，下次进入页面就能看到（fire-and-forget）
 */

import { useEffect, useMemo, useState } from "react";
import { useTrophyImage } from "../lib/trophyImages";
import { MASCOT_XIAOJIN, ensureMascotImage } from "../lib/mascot";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";

interface Props {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** 是否自动触发生成（用于 home / welcome 页占位） */
  autoEnsure?: boolean;
  /** 是否加发光环 */
  glow?: boolean;
  className?: string;
  /** 兜底 emoji */
  fallback?: string;
}

const SIZE_CLASSES: Record<NonNullable<Props["size"]>, string> = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-base",
  md: "w-12 h-12 text-2xl",
  lg: "w-20 h-20 text-4xl",
  xl: "w-32 h-32 text-6xl",
};

export function MascotAvatar({
  size = "md",
  autoEnsure = false,
  glow = false,
  className = "",
  fallback = "🐼",
}: Props) {
  const row = useTrophyImage(MASCOT_XIAOJIN.id);
  // v0.31.22：优先用 equipped wardrobe item 的图（用户用装扮卡 AI 生成的）
  const equippedWardrobe = useLiveQuery(async () => {
    const all = await db.mascotWardrobe.toArray();
    return all.find((r) => r.equipped === 1) ?? null;
  });
  const [wardrobeUrl, setWardrobeUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!equippedWardrobe) {
      setWardrobeUrl(null);
      return;
    }
    const u = URL.createObjectURL(equippedWardrobe.blob);
    setWardrobeUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [equippedWardrobe?.id, equippedWardrobe?.blob]);

  useEffect(() => {
    if (autoEnsure && !row?.imageDataUrl && !equippedWardrobe) {
      // fire-and-forget：失败也不报错（fallback emoji 兜底）
      void ensureMascotImage().catch(() => void 0);
    }
  }, [autoEnsure, row?.imageDataUrl, equippedWardrobe]);

  const sizeClass = SIZE_CLASSES[size];
  const glowClass = glow ? "ring-2 ring-violet-400/60 shadow-glow" : "";

  // 优先级：wardrobe equipped > trophyImages mascot > emoji fallback
  const imgUrl = wardrobeUrl ?? row?.imageDataUrl ?? null;
  if (imgUrl) {
    return (
      <div
        className={`${sizeClass} ${className} ${glowClass} rounded-full overflow-hidden flex items-center justify-center shrink-0`}
      >
        <img
          src={imgUrl}
          alt="小进"
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>
    );
  }
  return (
    <div
      className={`${sizeClass} ${className} ${glowClass} rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 border border-violet-400/40`}
    >
      <span>{fallback}</span>
    </div>
  );
}
