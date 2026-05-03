import { useEffect, useState } from "react";

export interface Floater {
  id: number;
  text: string;
  x: number;
  y: number;
  kind?: "gain" | "lose";
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
