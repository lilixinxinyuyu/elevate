/**
 * v0.32.12: 奇遇乐园反馈层 DOM overlay。
 *
 * 跟 useWorldFeedback 配合：
 *   - 屏幕闪光：correct=绿 / wrong=红 / complete=金，radial gradient，200ms fade
 *   - 中央 scale-up + fade 文案（correct ✓ / wrong ✗ / complete +5 XP）
 *   - pickup/drop 不显示视觉（仅 SFX + 震动）
 *
 * 渲染在 fixed inset-0 div，pointer-events-none，不挡交互。
 */

import type { FeedbackPulse } from "../../lib/worlds/useWorldFeedback";

interface Props {
  pulses: FeedbackPulse[];
}

export function WorldFeedbackOverlay({ pulses }: Props) {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 80 }}
    >
      {pulses.map((p) => (
        <PulseFx key={p.id} pulse={p} />
      ))}
    </div>
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
    },
    wrong: {
      bg: "rgba(239,68,68,0.42)", // rose-500
      text: "#f43f5e",
      icon: "✗",
      defaultLabel: "再试一次",
    },
    complete: {
      bg: "rgba(251,191,36,0.45)", // amber-500
      text: "#fbbf24",
      icon: "🎉",
      defaultLabel: "+5 XP · 完成！",
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
        .animate-worlds-flash {
          animation: worlds-flash 600ms ease-out forwards;
        }
        .animate-worlds-pulse {
          animation: worlds-pulse 900ms ease-out forwards;
        }
      `}</style>
    </>
  );
}
