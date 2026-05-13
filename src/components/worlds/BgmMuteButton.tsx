/**
 * v0.32.21: BGM 静音/恢复浮动按钮，worlds page 顶部右上角。
 *
 * 设计：
 *   - 不抢 TopHUD 现有布局，绝对定位在 TopHUD 下方
 *   - 状态持久化（isBgmMuted localStorage）
 *   - 切换时 BGM gain 0.2s ramp 到目标，避免咔哒
 */
import { useState } from "react";
import { isBgmMuted, setBgmMuted } from "../../lib/worlds/bgm";

export function BgmMuteButton({ accent = "#a78bfa" }: { accent?: string }) {
  const [muted, setMuted] = useState(() => isBgmMuted());
  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setBgmMuted(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      title={muted ? "开启背景音乐" : "静音背景音乐"}
      className="absolute top-16 right-3 pointer-events-auto px-2 py-1.5 rounded-xl bg-black/55 text-white text-base backdrop-blur-md hover:bg-black/70 border shadow-lg"
      style={{ zIndex: 62, borderColor: `${accent}55` }}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
