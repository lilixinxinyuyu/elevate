/**
 * v0.32.58 (Ep34 L): 4 店共用顶部 HUD —— 替代 4 页 inline 重复 TopHUD。
 *
 * 提供:
 *   - ← 离开 chip (左)
 *   - 标题 chip (中)
 *   - 客人进度 chip + dot chain (右) —— ●●○ 视觉 progress
 *
 * 之前 4 页各自 inline `function TopHUD()` 实现重复；现集中到一个组件 +
 * `.world-top-hud` 布局 class（响应式 mobile）。后续 chip 升级只动这一处。
 */

import type { CSSProperties } from "react";

interface WorldTopHUDProps {
  /** 主标题，e.g. "🏪 和平小卖部" */
  title: string;
  /** 当前进度（已完成单数 + 当前进行单是否算入）*/
  current: number;
  /** 总订单数 */
  total: number;
  /** 进度文字前缀，e.g. "客人" / "旅客" */
  unitLabel?: string;
  /** 离开按钮回调 */
  onBack: () => void;
  /** 离开按钮文字 */
  backLabel?: string;
  /** 主题色 (CSS var --world-accent) */
  accent?: string;
}

export function WorldTopHUD({
  title,
  current,
  total,
  unitLabel = "客人",
  onBack,
  backLabel = "离开",
  accent,
}: WorldTopHUDProps) {
  const safeCurrent = Math.min(Math.max(current, 0), total);
  return (
    <div
      className="world-top-hud"
      style={
        accent
          ? ({ ["--world-accent" as string]: accent } as CSSProperties)
          : undefined
      }
    >
      <button
        type="button"
        onClick={onBack}
        className="world-chip world-chip-dark world-top-back"
      >
        <span className="world-top-back-arrow">←</span>
        {backLabel}
      </button>

      <div className="world-chip world-top-title">{title}</div>

      <div className="world-chip world-chip-dark world-top-count">
        <span className="world-top-count-text">
          {unitLabel} {safeCurrent}/{total}
        </span>
        <span className="world-top-dots" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`world-top-dot${i < safeCurrent ? " world-top-dot-filled" : ""}`}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
