import { useEffect, useState } from "react";

export interface Floater {
  id: number;
  text: string;
  x: number;
  y: number;
  /** kind 决定 floater 的视觉 + 运动样式：
   *   - gain  = 琥珀色 + 向上飘（默认 FX）
   *   - lose  = 玫红色 + 向上飘
   *   - burst = v0.31.93 新增 — 沿随机方向辐射飞出，更有"爽"感（5 新玩法用） */
  kind?: "gain" | "lose" | "burst";
  /** burst kind 专用 — 飞行向量（dx, dy），其他 kind 忽略 */
  vx?: number;
  vy?: number;
}

export function FloatLayer({ floaters, onDone }: { floaters: Floater[]; onDone: (id: number) => void }) {
  return (
    <>
      {floaters.map((f) => (
        <FloatItem key={f.id} floater={f} onDone={onDone} />
      ))}
    </>
  );
}

function FloatItem({ floater, onDone }: { floater: Floater; onDone: (id: number) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = window.setTimeout(() => onDone(floater.id), 900);
    return () => window.clearTimeout(t);
  }, [floater.id, onDone]);
  if (!mounted) return null;
  // v0.31.93: burst kind 走 inline CSS variables 让每个粒子有自己的飞行向量
  if (floater.kind === "burst") {
    const dx = floater.vx ?? 0;
    const dy = floater.vy ?? 0;
    return (
      <div
        className="float-plus animate-xp-fly"
        style={{
          left: floater.x,
          top: floater.y,
          ["--fx" as never]: `${dx}px`,
          ["--fy" as never]: `${dy}px`,
          fontSize: "1.5rem",
          pointerEvents: "none",
        }}
      >
        {floater.text}
      </div>
    );
  }
  const color = floater.kind === "lose" ? "text-rose-400" : "text-amber-300";
  return (
    <div
      className={`float-plus ${color} animate-float-up`}
      style={{ left: floater.x, top: floater.y }}
    >
      {floater.text}
    </div>
  );
}

let nextFloaterId = 1;
export function makeFloater(text: string, x: number, y: number, kind: "gain" | "lose" = "gain"): Floater {
  return { id: nextFloaterId++, text, x, y, kind };
}

/**
 * v0.31.93: 生成一组"放射 burst" floater — 从 (x,y) 出发，N 个 emoji 向随机方向飞 80-150px。
 *
 * 用于 5 个新玩法（discount_drift / coin_combo / time_heist / number_hunt / shape_builder）
 * 答对时的奖励反馈。emoji 跟玩法主题对齐。
 *
 * 用法：
 *   triggerFx.burstAt(rect.left+rect.width/2, rect.top, ['🪙','💰','💸'], 6)
 */
export function makeBurst(
  x: number,
  y: number,
  emojis: string[],
  count = 6,
): Floater[] {
  const out: Floater[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const dist = 80 + Math.random() * 70;
    const vx = Math.cos(angle) * dist;
    const vy = Math.sin(angle) * dist - 30; // 略往上偏一点
    out.push({
      id: nextFloaterId++,
      text: emojis[i % emojis.length] ?? "✨",
      x,
      y,
      kind: "burst",
      vx,
      vy,
    });
  }
  return out;
}
