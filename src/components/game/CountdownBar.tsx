import { useEffect, useRef, useState } from "react";

/**
 * 倒计时进度条。
 *
 * v0.28.1 新增：
 *   - `onTimeUp` 在 `remaining === 0` 触发一次（用 ref 防重复触发）
 *   - 显示当前剩余秒数（视觉化"还有多少时间"）
 *   - 时间到后进度条变红 + 强 pulse，并显示 "⏰ 时间到！"
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
      // 时间到只触发一次
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onTimeUp?.();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [seconds, paused, onTick, onTimeUp]);

  const pct = Math.max(0, Math.min(100, (remaining / seconds) * 100));
  const hot = pct < 20;
  const warm = pct < 50 && !hot;
  const expired = remaining <= 0;
  return (
    <div className="relative">
      <div className="timer-track">
        <div
          className={`timer-bar ${
            expired
              ? "bg-gradient-to-r from-rose-500 to-rose-600 animate-pulse-bar"
              : hot
                ? "bg-gradient-to-r from-rose-400 to-rose-500 animate-pulse-bar"
                : warm
                  ? "bg-gradient-to-r from-amber-300 to-orange-400"
                  : ""
          }`}
          style={{ width: `${expired ? 100 : pct}%` }}
        />
      </div>
      <div
        className={`absolute right-1 top-1/2 -translate-y-1/2 text-[10px] tabular-nums font-display ${
          expired
            ? "text-rose-200"
            : hot
              ? "text-rose-200"
              : "text-slate-300"
        }`}
        style={{ pointerEvents: "none" }}
      >
        {expired ? "⏰ 时间到" : `${Math.ceil(remaining)}s`}
      </div>
    </div>
  );
}
