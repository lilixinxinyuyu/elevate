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

import { useEffect, useState, type CSSProperties } from "react";

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
  /** v0.33.45 (Ep119 mini-hud): 当前订单代表 emoji（替代固定 title emoji） */
  currentOrderEmoji?: string;
  /**
   * v0.33.45 (Ep119 mini-hud): 当前订单的时间预算（秒）— HudTimer 用
   * 提供则显示时间进度 chip + 细 bar；不提供则不显示
   */
  budgetSeconds?: number;
  /**
   * 关键：每次新订单时 orderKey 变 → HudTimer 重置 elapsed
   * 用 orderIdx 当 key 最简洁
   */
  orderKey?: string | number;
}

export function WorldTopHUD({
  title,
  current,
  total,
  unitLabel = "客人",
  onBack,
  backLabel = "离开",
  accent,
  currentOrderEmoji,
  budgetSeconds,
  orderKey,
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

      <div className="world-chip world-top-title">
        {currentOrderEmoji && (
          <span className="world-top-order-emoji" aria-hidden>
            {currentOrderEmoji}
          </span>
        )}
        <span>{title}</span>
      </div>

      <div className="world-top-right-stack">
        <div className="world-chip world-chip-dark world-top-count">
          <span className="world-top-count-text">
            {unitLabel} {safeCurrent}/{total}
          </span>
          <span className="world-top-dots" aria-hidden>
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={`world-top-dot${i < safeCurrent ? " world-top-dot-filled" : ""}`}
                style={
                  i < safeCurrent
                    ? ({ ["--dot-i" as string]: i } as CSSProperties)
                    : undefined
                }
              />
            ))}
          </span>
        </div>
        {/* v0.33.45 (Ep119 mini-hud): 当前订单时间进度 chip + 细 bar */}
        {budgetSeconds && budgetSeconds > 0 && (
          <HudTimer key={String(orderKey ?? "default")} budgetSec={budgetSeconds} />
        )}
      </div>
    </div>
  );
}

/**
 * v0.33.45 (Ep119 mini-hud): HUD 时间进度
 *  - 内部 setInterval 计 elapsed seconds，每 200ms 更新
 *  - 显示：⏱ N/Bs 文字 chip + 细 progress bar 宽度按 elapsed/budget
 *  - bar 颜色：< 70% → cyan / 70-100% → amber / overflow → rose
 *  - 通过 key=orderKey 每次订单切换重置
 *  - prefers-reduced-motion: 仅显示文字数字，不显示 bar
 */
function HudTimer({ budgetSec }: { budgetSec: number }) {
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsedSec((Date.now() - start) / 1000);
    }, 200);
    return () => window.clearInterval(id);
  }, []);
  const ratio = Math.min(1.5, elapsedSec / budgetSec);
  const pct = Math.min(100, ratio * 100);
  const tone =
    ratio < 0.7
      ? "world-top-timer-cool"
      : ratio < 1.0
        ? "world-top-timer-warm"
        : "world-top-timer-hot";
  return (
    <div className={`world-chip world-chip-dark world-top-timer ${tone}`}>
      <span className="world-top-timer-icon" aria-hidden>
        ⏱
      </span>
      <span className="world-top-timer-text">
        {elapsedSec.toFixed(1)}s
      </span>
      <span className="world-top-timer-bar-wrap" aria-hidden>
        <span
          className="world-top-timer-bar"
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  );
}
