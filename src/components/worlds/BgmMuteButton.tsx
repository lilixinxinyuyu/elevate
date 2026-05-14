/**
 * v0.32.21: BGM 静音/恢复浮动按钮，worlds page 顶部右上角。
 *
 * v0.32.75 (Ep51 FFF): chunky chip 升级
 *   - 替换 black/55 → 白/奶油 gradient + 主题色 3px 边
 *   - icon 持续轻 bob + muted 态降饱和 + slash 装饰
 *   - hover lift + active press (复用 chip 视觉语言)
 *   - prefers-reduced-motion 关动画
 */
import { useState } from "react";
import { isBgmMuted, setBgmMuted } from "../../lib/worlds/bgm";

export function BgmMuteButton({ accent = "#a78bfa" }: { accent?: string }) {
  const [muted, setMuted] = useState(() => isBgmMuted());
  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setBgmMuted(next);
  };
  return (
    <>
      <style>{`
        .world-bgm-chip {
          position: absolute;
          top: 4rem;
          right: 0.75rem;
          z-index: 62;
          pointer-events: auto;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.45rem 0.85rem;
          border-radius: 999px;
          background: linear-gradient(180deg, #ffffff 0%, #fffbeb 100%);
          color: #1f2937;
          font-weight: 900;
          font-size: 12.5px;
          letter-spacing: 0.02em;
          border: 3px solid var(--bgm-accent, #a78bfa);
          box-shadow:
            0 2px 0 rgba(0, 0, 0, 0.12),
            0 6px 14px rgba(0, 0, 0, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.95);
          cursor: pointer;
          transition:
            transform 200ms cubic-bezier(.34, 1.56, .64, 1),
            box-shadow 200ms ease-out,
            filter 200ms ease-out;
          white-space: nowrap;
        }
        .world-bgm-chip:hover {
          transform: translateY(-3px) scale(1.05);
          filter: brightness(1.06);
          box-shadow:
            0 4px 0 rgba(0, 0, 0, 0.16),
            0 12px 22px rgba(0, 0, 0, 0.32),
            0 0 0 4px rgba(255, 255, 255, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.95);
        }
        .world-bgm-chip:active {
          transform: translateY(-1px) scale(1.01);
        }
        .world-bgm-chip:focus-visible {
          outline: 3px solid var(--bgm-accent, #a78bfa);
          outline-offset: 3px;
        }
        .world-bgm-chip-muted {
          background: linear-gradient(180deg, #f1f5f9 0%, #cbd5e1 100%);
          filter: grayscale(0.45);
        }
        .world-bgm-icon {
          font-size: 16px;
          display: inline-block;
          line-height: 1;
          animation: world-bgm-icon-bob 2.4s ease-in-out infinite;
        }
        .world-bgm-chip-muted .world-bgm-icon {
          animation: none;
          opacity: 0.85;
        }
        @keyframes world-bgm-icon-bob {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50%      { transform: translateY(-1.5px) rotate(3deg); }
        }
        .world-bgm-label {
          font-variant-numeric: tabular-nums;
          color: var(--bgm-accent, #6b7280);
        }
        .world-bgm-chip-muted .world-bgm-label {
          color: #64748b;
        }
        @media (prefers-reduced-motion: reduce) {
          .world-bgm-chip,
          .world-bgm-icon {
            transition: none;
            animation: none;
          }
        }
      `}</style>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={muted}
        aria-label={muted ? "开启背景音乐" : "静音背景音乐"}
        title={muted ? "开启背景音乐" : "静音背景音乐"}
        className={`world-bgm-chip${muted ? " world-bgm-chip-muted" : ""}`}
        style={{ ["--bgm-accent" as string]: accent } as React.CSSProperties}
      >
        <span className="world-bgm-icon">{muted ? "🔇" : "🔊"}</span>
        <span className="world-bgm-label">{muted ? "静音" : "BGM"}</span>
      </button>
    </>
  );
}
