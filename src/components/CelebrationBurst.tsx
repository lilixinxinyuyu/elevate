import { useEffect, useRef, useState } from "react";

/**
 * v0.31.71：正反馈密度引擎 v1。把"题量推动"升级为"正反馈密度"——挫折时段
 * 被夹在不断的小庆祝里。
 *
 * 这是 Path B 共享引擎的雏形：所有节点都通过 `<CelebrationBurst/>` 渲染，
 * mount 后 1.6s 自动消失。一次只渲一个；多个 trigger 几乎同时来时取最高 tier。
 *
 * v1 节点：
 *   - combo 突破 5 / 10 / 20 → tier 1/2/3 大字 burst
 *   - 连续 2 错 → 鼓励"没关系，再来"（mascot tone，不刷分）
 *   - session 大胜（v1 还没接，留 hook）
 *
 * 后续可以加 D4 / D5 win、闪电连胜、错题复活等节点 —— 都通过同一个 trigger
 * 接口走，UI 视觉一致。
 */

export type BurstKind =
  | "combo5"
  | "combo10"
  | "combo20"
  | "encourage"
  | "session_win"
  | "first_correct";

const BURST_CONFIG: Record<BurstKind, {
  emoji: string;
  primaryText: string;
  subText?: string;
  color: string;
  durationMs: number;
}> = {
  combo5: {
    emoji: "🔥",
    primaryText: "5 连击！",
    subText: "节奏起来了",
    color: "from-amber-500/30 to-rose-500/20 text-amber-100",
    durationMs: 1400,
  },
  combo10: {
    emoji: "⚡",
    primaryText: "10 连击！",
    subText: "你在状态里",
    color: "from-rose-500/40 to-orange-500/30 text-rose-100",
    durationMs: 1700,
  },
  combo20: {
    emoji: "🚀",
    primaryText: "20 连击！",
    subText: "无人能挡 ✨",
    color: "from-fuchsia-500/40 to-violet-500/40 text-fuchsia-100",
    durationMs: 2200,
  },
  encourage: {
    emoji: "🌱",
    primaryText: "没关系",
    subText: "深呼吸，再来一道",
    color: "from-emerald-500/25 to-teal-500/15 text-emerald-100",
    durationMs: 1600,
  },
  session_win: {
    emoji: "🏆",
    primaryText: "今日完成！",
    subText: "比昨天的自己又强了",
    color: "from-amber-400/40 to-yellow-300/30 text-amber-100",
    durationMs: 2400,
  },
  first_correct: {
    emoji: "✨",
    primaryText: "好开始",
    color: "from-violet-500/25 to-pink-500/15 text-violet-100",
    durationMs: 900,
  },
};

interface BurstEvent {
  id: number;
  kind: BurstKind;
}

interface CelebrationBurstProps {
  /**
   * 当前连击数；组件内部记忆上次值，跨过 5/10/20 时触发 burst。
   * Train.tsx 直接传 state.combo 即可。
   */
  combo: number;
  /**
   * 当前的连续答错数（在 session 内累计）。跨过 2 时触发 encourage。
   * 答对会被外面 reset 到 0。
   */
  consecutiveWrong: number;
  /**
   * 显式触发其他节点（比如 session 结束）。父组件递增 nonce 即可触发。
   */
  manualTrigger?: { kind: BurstKind; nonce: number };
}

export function CelebrationBurst({
  combo,
  consecutiveWrong,
  manualTrigger,
}: CelebrationBurstProps) {
  const [active, setActive] = useState<BurstEvent | null>(null);
  const lastComboRef = useRef(combo);
  const lastWrongRef = useRef(consecutiveWrong);
  const lastManualNonceRef = useRef(manualTrigger?.nonce ?? 0);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fire(kind: BurstKind) {
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = ++idRef.current;
    setActive({ id, kind });
    const cfg = BURST_CONFIG[kind];
    timerRef.current = setTimeout(() => {
      // 只在没被新 burst 覆盖时清掉
      setActive((cur) => (cur && cur.id === id ? null : cur));
    }, cfg.durationMs);
  }

  // combo 跨阈值
  useEffect(() => {
    const prev = lastComboRef.current;
    lastComboRef.current = combo;
    if (combo >= 20 && prev < 20) fire("combo20");
    else if (combo >= 10 && prev < 10) fire("combo10");
    else if (combo >= 5 && prev < 5) fire("combo5");
  }, [combo]);

  // 连续错跨 2
  useEffect(() => {
    const prev = lastWrongRef.current;
    lastWrongRef.current = consecutiveWrong;
    if (consecutiveWrong >= 2 && prev < 2) fire("encourage");
  }, [consecutiveWrong]);

  // 手动触发
  useEffect(() => {
    if (!manualTrigger) return;
    if (manualTrigger.nonce === lastManualNonceRef.current) return;
    lastManualNonceRef.current = manualTrigger.nonce;
    fire(manualTrigger.kind);
  }, [manualTrigger]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!active) return null;
  const cfg = BURST_CONFIG[active.kind];

  return (
    <div
      key={active.id}
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center"
    >
      {/* 径向光晕，背景模糊 */}
      <div
        aria-hidden
        className={`absolute inset-0 bg-gradient-radial bg-gradient-to-br ${cfg.color} animate-flash`}
        style={{ mixBlendMode: "screen", opacity: 0.55 }}
      />
      {/* 主 burst：emoji 大字弹出 */}
      <div className="relative flex flex-col items-center gap-1 animate-burst-text">
        <div className="text-7xl select-none drop-shadow-[0_0_40px_rgba(255,255,255,0.4)]">
          {cfg.emoji}
        </div>
        <div className="font-display text-3xl font-bold drop-shadow-[0_0_15px_rgba(0,0,0,0.6)] text-white">
          {cfg.primaryText}
        </div>
        {cfg.subText && (
          <div className="text-sm text-slate-100/90 drop-shadow-[0_0_8px_rgba(0,0,0,0.6)]">
            {cfg.subText}
          </div>
        )}
      </div>
      {/* 飘落小粒子（emoji 多份淡出） */}
      <ParticleField emoji={cfg.emoji} />
    </div>
  );
}

function ParticleField({ emoji }: { emoji: string }) {
  // 简化粒子：8 个 emoji 在屏幕上方飘下
  const particles = Array.from({ length: 8 }, (_, i) => {
    const left = 10 + i * 11 + (i % 2 === 0 ? 3 : -3);
    const delay = (i % 4) * 80;
    const dur = 1200 + (i % 3) * 200;
    return { left, delay, dur, key: i };
  });

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.key}
          className="absolute text-3xl select-none animate-particle-fall"
          style={{
            left: `${p.left}%`,
            top: "-10%",
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.dur}ms`,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}
