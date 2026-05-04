import { useEffect, useRef, useState } from "react";

/**
 * 倒计时进度条。
 *
 * v0.28.3 视觉重写（v0.28.1 加的"时间到"显示在外面、bar 还是彩虹色，是 bug）：
 *   - 基础 timer-bar CSS 不再带默认渐变（在 index.css 改），渐变全部由 className
 *     控制，避免 className 跟 base 抢颜色
 *   - 默认状态：violet → pink → amber 渐变
 *   - 50% 以下：amber → orange
 *   - 20% 以下：rose 闪烁
 *   - 时间到（expired）：bar 整条红 + 强 pulse + 上方独立显示 "⏰ 时间到！"
 *     标签（不再压在 bar 内导致挤出来）
 *
 * 父组件接住 `onTimeUp` 决定语义（auto-submit / 警告 / 锁交互）。
 */
export function CountdownBar({
  seconds,
  resetKey,
  paused,
  onTick,
  onTimeUp,
}: {
  seconds: number;
  resetKey: string | number;
  paused?: boolean;
  onTick?: (remaining: number) => void;
  onTimeUp?: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const startRef = useRef<number>(Date.now());
  const firedRef = useRef<boolean>(false);
  useEffect(() => {
    startRef.current = Date.now();
    setRemaining(seconds);
    firedRef.current = false;
  }, [resetKey, seconds]);
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const left = Math.max(0, seconds - elapsed);
      setRemaining(left);
      onTick?.(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onTimeUp?.();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [seconds, paused, onTick, onTimeUp]);

  const pct = Math.max(0, Math.min(100, (remaining / seconds) * 100));
  const expired = remaining <= 0;
  const hot = !expired && pct < 20;
  const warm = !expired && pct < 50 && !hot;

  // 渐变 class：放在 className 里，不跟 base 冲突
  const barColorClass = expired
    ? "bg-rose-500 animate-pulse-bar"
    : hot
      ? "bg-gradient-to-r from-rose-400 to-rose-500 animate-pulse-bar"
      : warm
        ? "bg-gradient-to-r from-amber-300 to-orange-400"
        : "bg-gradient-to-r from-violet-400 via-pink-400 to-amber-300";

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="timer-track flex-1">
        <div
          className={`timer-bar ${barColorClass}`}
          style={{ width: `${expired ? 100 : pct}%` }}
        />
      </div>
      {/* 状态标签放在 bar 旁边而不是叠在里面 */}
      <span
        className={`text-[11px] tabular-nums font-display whitespace-nowrap shrink-0 ${
          expired
            ? "text-rose-300 animate-pulse"
            : hot
              ? "text-rose-300"
              : warm
                ? "text-amber-200"
                : "text-slate-400"
        }`}
      >
        {expired ? "⏰ 时间到" : `${Math.ceil(remaining)}s`}
      </span>
    </div>
  );
}
