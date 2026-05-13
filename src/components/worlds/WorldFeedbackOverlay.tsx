/**
 * v0.32.23: 奇遇乐园反馈层 DOM overlay（含 v0.32.23 confetti 加厚）。
 *
 * 跟 useWorldFeedback 配合：
 *   - 屏幕闪光：correct=绿 / wrong=红 / complete=金，radial gradient，200ms fade
 *   - 中央 scale-up + fade 文案（correct ✓ / wrong ✗ / complete +5 XP）
 *   - **confetti 粒子喷射（correct 12 个 / complete 28 个，纯 CSS）**
 *   - pickup/drop 不显示视觉（仅 SFX + 震动）
 *
 * 渲染在 fixed inset-0 div，pointer-events-none，不挡交互。
 */

import { useMemo } from "react";
import type { FeedbackPulse } from "../../lib/worlds/useWorldFeedback";

interface Props {
  pulses: FeedbackPulse[];
}

export function WorldFeedbackOverlay({ pulses }: Props) {
  return (
    <>
      {/* v0.32.23：CSS keyframes 永久 mount，确保 page root 加 class 时
          动画立刻可用（不依赖 pulse 渲染） */}
      <FeedbackStyles />
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 80 }}
      >
        {pulses.map((p) => (
          <PulseFx key={p.id} pulse={p} />
        ))}
      </div>
    </>
  );
}

function FeedbackStyles() {
  return (
    <style>{`
      @keyframes worlds-flash {
        0% { opacity: 0; }
        18% { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes worlds-pulse {
        0% { opacity: 0; transform: scale(0.6); }
        20% { opacity: 1; transform: scale(1.12); }
        45% { transform: scale(1); }
        100% { opacity: 0; transform: scale(1.04) translateY(-8px); }
      }
      @keyframes worlds-confetti-fly {
        0%   { transform: translate(-50%, -50%) rotate(0deg); opacity: 1; }
        80%  { opacity: 1; }
        100% {
          transform:
            translate(calc(-50% + var(--dx)), calc(-50% + var(--dy)))
            rotate(var(--rot));
          opacity: 0;
        }
      }
      .animate-worlds-flash {
        animation: worlds-flash 600ms ease-out forwards;
      }
      .animate-worlds-pulse {
        animation: worlds-pulse 900ms ease-out forwards;
      }
      .worlds-confetti {
        animation: worlds-confetti-fly 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      /* v0.32.23: 屏幕震动 (correct) — 短促 350ms */
      @keyframes worlds-screen-shake-kf {
        0%, 100% { transform: translate(0, 0); }
        15%      { transform: translate(-3px, 1px); }
        30%      { transform: translate(3px, -2px); }
        45%      { transform: translate(-2px, 2px); }
        60%      { transform: translate(2px, -1px); }
        80%      { transform: translate(-1px, 0); }
      }
      .worlds-screen-shake {
        animation: worlds-screen-shake-kf 350ms ease-out;
      }
      /* v0.32.23: 屏幕 zoom in (complete) — 800ms 弹性 */
      @keyframes worlds-screen-zoom-kf {
        0%   { transform: scale(1); }
        25%  { transform: scale(1.03); }
        55%  { transform: scale(0.995); }
        100% { transform: scale(1); }
      }
      .worlds-screen-zoom {
        animation: worlds-screen-zoom-kf 800ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }
    `}</style>
  );
}

function PulseFx({ pulse }: { pulse: FeedbackPulse }) {
  const { kind, label } = pulse;
  if (kind === "pickup" || kind === "drop") return null;

  const palette = {
    correct: {
      bg: "rgba(16,185,129,0.35)", // emerald-500
      text: "#10b981",
      icon: "✓",
      defaultLabel: "对了！",
      confettiColors: ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0"],
      confettiCount: 12,
    },
    wrong: {
      bg: "rgba(239,68,68,0.42)", // rose-500
      text: "#f43f5e",
      icon: "✗",
      defaultLabel: "再试一次",
      confettiColors: [],
      confettiCount: 0,
    },
    complete: {
      bg: "rgba(251,191,36,0.45)", // amber-500
      text: "#fbbf24",
      icon: "🎉",
      defaultLabel: "+5 XP · 完成！",
      // 金色 + 粉色 + 蓝色 + 紫色：庆典调色板
      confettiColors: [
        "#fbbf24", "#fde047", "#fb923c",
        "#f472b6", "#ec4899",
        "#60a5fa", "#a78bfa",
        "#34d399",
      ],
      confettiCount: 32,
    },
  }[kind];

  return (
    <>
      {/* 屏幕径向闪光（200ms fade） */}
      <div
        className="absolute inset-0 animate-worlds-flash"
        style={{
          background: `radial-gradient(circle, ${palette.bg} 0%, transparent 60%)`,
        }}
      />
      {/* v0.32.23: confetti 粒子喷射（correct 12 / complete 32） */}
      {palette.confettiCount > 0 && (
        <ConfettiBurst
          count={palette.confettiCount}
          colors={palette.confettiColors}
          big={kind === "complete"}
        />
      )}
      {/* 中央文案 scale-up + fade */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="text-center animate-worlds-pulse"
          style={{ color: palette.text }}
        >
          <div
            style={{
              fontSize: kind === "complete" ? 96 : 72,
              lineHeight: 1,
              textShadow: "0 4px 18px rgba(0,0,0,0.6), 0 0 24px currentColor",
            }}
          >
            {palette.icon}
          </div>
          <div
            className="mt-2 font-display font-bold whitespace-nowrap"
            style={{
              fontSize: kind === "complete" ? 28 : 20,
              textShadow: "0 2px 8px rgba(0,0,0,0.7)",
            }}
          >
            {label ?? palette.defaultLabel}
          </div>
        </div>
      </div>
    </>
  );
}

/** v0.32.23: confetti 粒子喷射（纯 CSS，无外部库） */
function ConfettiBurst({
  count,
  colors,
  big,
}: {
  count: number;
  colors: string[];
  big: boolean;
}) {
  // useMemo 让粒子参数稳定，避免每次 render 重算
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      // 360° 散开，加少量随机扰动避免完全 radial 整齐
      const baseAngle = (i / count) * Math.PI * 2;
      const angle = baseAngle + (Math.random() - 0.5) * 0.4;
      // big 喷得更远
      const dist = (big ? 280 : 180) + Math.random() * (big ? 220 : 120);
      const dx = Math.cos(angle) * dist;
      // 加点重力感：粒子末端会偏下
      const dy = Math.sin(angle) * dist + (big ? 80 : 50);
      const rot = (Math.random() - 0.5) * 1440; // ±2 圈
      const color = colors[i % colors.length] ?? "#fbbf24";
      const size = big ? 8 + Math.random() * 6 : 5 + Math.random() * 4;
      const height = size * (1.5 + Math.random() * 0.5);
      const delay = Math.random() * 60; // 0-60ms 错开起步
      const shape = Math.random() > 0.5 ? "0.4em" : "50%"; // 长方 vs 圆
      return { id: i, dx, dy, rot, color, size, height, delay, shape };
    });
  }, [count, colors, big]);

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="worlds-confetti absolute"
          style={
            {
              left: "50%",
              top: "55%",
              width: p.size,
              height: p.height,
              background: p.color,
              borderRadius: p.shape,
              boxShadow: `0 0 ${big ? 6 : 4}px ${p.color}80`,
              animationDelay: `${p.delay}ms`,
              // CSS variables 让单个 @keyframes 支持每个粒子不同方向
              ["--dx" as string]: `${p.dx}px`,
              ["--dy" as string]: `${p.dy}px`,
              ["--rot" as string]: `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
