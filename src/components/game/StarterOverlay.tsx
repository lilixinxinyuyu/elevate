import { useEffect, useState } from "react";
import { sfx } from "../../lib/sfx";

export function StarterOverlay({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"3" | "2" | "1" | "GO" | "flash" | "done">("3");
  useEffect(() => {
    const seq: Array<{ next: typeof phase; delay: number; sound?: () => void }> = [
      { next: "2", delay: 700, sound: sfx.tick },
      { next: "1", delay: 700, sound: sfx.tick },
      { next: "GO", delay: 700, sound: sfx.go },
      { next: "flash", delay: 450 },
      { next: "done", delay: 150 },
    ];
    sfx.tick();
    let cancel = false;
    (async () => {
      for (const step of seq) {
        await new Promise((r) => setTimeout(r, step.delay));
        if (cancel) return;
        step.sound?.();
        setPhase(step.next);
      }
      onDone();
    })();
    return () => {
      cancel = true;
    };
  }, [onDone]);

  if (phase === "done") return null;
  if (phase === "flash") return <div className="starter-overlay animate-flash bg-white" />;
  const big =
    phase === "GO"
      ? "GO!"
      : phase === "3"
        ? "3"
        : phase === "2"
          ? "2"
          : "1";
  const color = phase === "GO" ? "text-emerald-300" : "text-violet-200";
  return (
    <div className="starter-overlay">
      <div
        key={phase}
        className={`font-display font-extrabold text-[14rem] leading-none ${color} animate-go-number`}
        style={{ textShadow: "0 0 40px rgba(167,139,250,0.7)" }}
      >
        {big}
      </div>
    </div>
  );
}
