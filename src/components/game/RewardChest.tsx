import { useEffect, useState } from "react";
import { sfx } from "../../lib/sfx";

export function RewardChest({
  onOpened,
}: {
  onOpened: () => void;
}) {
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (opened) {
      sfx.chest();
      const t = window.setTimeout(onOpened, 700);
      return () => window.clearTimeout(t);
    }
  }, [opened, onOpened]);
  return (
    <div className="flex flex-col items-center py-8">
      <button
        type="button"
        onClick={() => !opened && setOpened(true)}
        aria-label="打开宝箱"
        className="relative w-36 h-36 flex items-center justify-center focus:outline-none"
      >
        <div className={`absolute inset-0 rounded-full bg-amber-400/25 blur-2xl ${opened ? "animate-burst" : "animate-sparkle"}`} />
        <div className={`text-[7rem] leading-none ${opened ? "" : "animate-chest-bob"}`}>
          {opened ? "🌟" : "🎁"}
        </div>
      </button>
      {!opened && <div className="mt-4 text-sm text-slate-300">点击宝箱领取奖励</div>}
    </div>
  );
}
