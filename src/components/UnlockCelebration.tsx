import { useEffect, useRef, useState } from "react";
import { tierById } from "../core/tiers";
import { TrophyIcon } from "./TrophyIcon";

/**
 * 跨段升档全屏庆祝。
 *
 * 使用：在 Train 结算 / Home 加载时检测 summary.tierUpgrade，传入这个组件。
 *
 * 视觉：
 * - 1.6s 渐入 + 烟花 emoji 飘落
 * - 居中显示新段位勋章 + slogan
 * - 4s 后渐出 + 自动关闭
 * - 点击空白可立即关闭
 */
export function UnlockCelebration({
  fromTierId,
  toTierId,
  onClose,
}: {
  fromTierId: string;
  toTierId: string;
  onClose: () => void;
}) {
  const fromTier = tierById(fromTierId);
  const toTier = tierById(toTierId);
  const [phase, setPhase] = useState<"in" | "show" | "out">("in");

  // 把 onClose 稳到一个 ref，避免父组件每次 re-render 重建箭头函数导致计时器重置
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    // 只在挂载时启一次，不依赖父 prop 变化（否则 5.5s 计时会被打断）
    const t1 = setTimeout(() => setPhase("show"), 50);
    const t2 = setTimeout(() => setPhase("out"), 4500);
    const t3 = setTimeout(() => onCloseRef.current(), 5500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!toTier) return null;

  const opacity = phase === "in" ? 0 : phase === "out" ? 0 : 1;

  return (
    <div
      role="dialog"
      aria-label="段位升档"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center cursor-pointer"
      style={{
        background: "radial-gradient(circle at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.95) 100%)",
        opacity,
        transition: "opacity 700ms ease",
      }}
    >
      {/* 飘落的烟花 emoji */}
      <FireworksRain />

      {/* 中心卡片 */}
      <div
        className={`relative max-w-md w-[88%] mx-auto px-6 py-8 rounded-3xl border ${toTier.theme.borderColor} bg-gradient-to-br ${toTier.theme.fromColor} ${toTier.theme.toColor} text-center shadow-glow-amber`}
        style={{
          transform: phase === "show" ? "scale(1)" : "scale(0.8)",
          transition: "transform 700ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* 大勋章 — 优先用 AI 生成的段位 badge 图（math 风格），fallback emoji */}
        <div
          className="mb-3 inline-block"
          style={{
            animation: phase === "show" ? "pulse-glow 1.5s ease-in-out infinite" : undefined,
          }}
        >
          <TrophyIcon
            trophyId={`tier_${toTier.id}`}
            subjectId="math"
            emoji={toTier.badgeIcon}
            size="xl"
            glow
            unlocked
          />
        </div>

        <div className="text-xs text-slate-300 font-display mb-1">恭喜跨段升档</div>
        {fromTier && (
          <div className="text-sm text-slate-200 mb-3">
            <span className={fromTier.theme.textColor}>{fromTier.name}</span>
            <span className="mx-2 opacity-60">→</span>
            <span className={`${toTier.theme.textColor} font-display font-bold`}>
              {toTier.name}
            </span>
          </div>
        )}
        <div className={`font-display font-bold text-xl ${toTier.theme.textColor} mb-1`}>
          {toTier.unlockSlogan}
        </div>
        <div className={`text-sm ${toTier.theme.subTextColor}`}>
          已解锁勋章：{toTier.badgeName}
        </div>

        <div className="text-xs text-slate-500 mt-5">点击任意位置继续</div>
      </div>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 12px rgba(251, 191, 36, 0.8)); }
          50% { transform: scale(1.1); filter: drop-shadow(0 0 24px rgba(251, 191, 36, 1)); }
        }
        @keyframes fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(540deg); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

const FIREWORK_EMOJIS = ["🎉", "🎊", "✨", "🌟", "💫", "🎆", "🥳", "🌈"];

function FireworksRain() {
  // 30 个错落分布的飘落 emoji
  const items = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2.5 + Math.random() * 2,
    emoji: FIREWORK_EMOJIS[Math.floor(Math.random() * FIREWORK_EMOJIS.length)],
    size: 18 + Math.random() * 22,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {items.map((it) => (
        <div
          key={it.id}
          className="absolute select-none"
          style={{
            left: `${it.left}%`,
            top: 0,
            fontSize: `${it.size}px`,
            animation: `fall ${it.duration}s linear ${it.delay}s infinite`,
          }}
        >
          {it.emoji}
        </div>
      ))}
    </div>
  );
}
