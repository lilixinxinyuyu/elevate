import { useEffect, useRef, useState } from "react";

export function CountdownBar({
  seconds,
  resetKey,
  paused,
  onTick,
}: {
  seconds: number;
  resetKey: string | number;
  paused?: boolean;
  onTick?: (remaining: number) => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const startRef = useRef<number>(Date.now());
  useEffect(() => {
    startRef.current = Date.now();
    setRemaining(seconds);
  }, [resetKey, seconds]);
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const left = Math.max(0, seconds - elapsed);
      setRemaining(left);
      onTick?.(left);
    }, 100);
    return () => window.clearInterval(id);
  }, [seconds, paused, onTick]);

  const pct = Math.max(0, Math.min(100, (remaining / seconds) * 100));
  const hot = pct < 20;
  const warm = pct < 50 && !hot;
  return (
    <div className="timer-track">
      <div
        className={`timer-bar ${hot ? "bg-gradient-to-r from-rose-400 to-rose-500 animate-pulse-bar" : warm ? "bg-gradient-to-r from-amber-300 to-orange-400" : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
