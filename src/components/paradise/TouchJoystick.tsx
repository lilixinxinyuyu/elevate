/**
 * v0.31.113: 触屏虚拟摇杆 —— 左下角圆形，拖动 nub 输出 [-1,1] x/z。
 *
 * 桌面也显示 (鼠标拖动也工作)，但桌面玩家一般用 WASD 更方便。
 */

import { useEffect, useRef, useState } from "react";

interface TouchJoystickProps {
  onChange: (x: number, z: number) => void;
  /** 摇杆 base 半径 (CSS px) */
  size?: number;
}

export function TouchJoystick({ onChange, size = 110 }: TouchJoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;
    const halfSize = size / 2;

    const start = (e: PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      base.setPointerCapture(e.pointerId);
      update(e);
    };
    const update = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const rect = base.getBoundingClientRect();
      const dx = e.clientX - (rect.left + halfSize);
      const dy = e.clientY - (rect.top + halfSize);
      const mag = Math.hypot(dx, dy);
      const clamp = Math.min(1, mag / halfSize);
      const nx = (dx / Math.max(mag, 0.001)) * clamp;
      const ny = (dy / Math.max(mag, 0.001)) * clamp;
      setKnob({ x: nx * halfSize, y: ny * halfSize });
      // y 反向：屏幕 down = world -Z (向下推 = 后退)
      // y up = world +Z (向前推 = 前进)
      onChange(nx, -ny);
    };
    const end = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try { base.releasePointerCapture(e.pointerId); } catch { /* */ }
      setKnob({ x: 0, y: 0 });
      onChange(0, 0);
    };
    base.addEventListener("pointerdown", start);
    base.addEventListener("pointermove", update);
    base.addEventListener("pointerup", end);
    base.addEventListener("pointercancel", end);
    base.addEventListener("pointerleave", end);
    return () => {
      base.removeEventListener("pointerdown", start);
      base.removeEventListener("pointermove", update);
      base.removeEventListener("pointerup", end);
      base.removeEventListener("pointercancel", end);
      base.removeEventListener("pointerleave", end);
    };
  }, [size, onChange]);

  return (
    <div
      ref={baseRef}
      className="absolute z-30 select-none touch-none"
      style={{
        left: 24,
        bottom: 24,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.08)",
        border: "2px solid rgba(255,255,255,0.25)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: size * 0.42,
          height: size * 0.42,
          marginLeft: -size * 0.21,
          marginTop: -size * 0.21,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.35)",
          border: "2px solid rgba(255,255,255,0.6)",
          transform: `translate(${knob.x}px, ${knob.y}px)`,
          transition: draggingRef.current ? "none" : "transform 0.15s ease-out",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
