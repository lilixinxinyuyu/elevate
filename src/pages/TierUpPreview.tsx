/**
 * Phase D 升段仪式动画评审入口 `/math/tierup-preview`.
 *
 * 让 Bruce 看 CharacterTierUpModal 效果: 旧立绘 fade → 白光爆开 → 新立绘
 * spring-in → 庆祝卡 "🎉 形象进化!".
 *
 * 默认 demo: school → district 的 scholar-female (两张立绘都已 ship).
 * "▶ 播放升段动画" 按钮 toggle open false→true 重放整段动画.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { CharacterTierUpModal } from "../components/CharacterTierUpModal";
import type { CharacterChoice } from "../lib/characterChoice";

// 硬编码 demo choice — scholar-female 在 school + district 都有立绘资产.
const DEMO_CHOICE: CharacterChoice = {
  archetype: "scholar",
  gender: "female",
  chosenAt: 0,
};

export function TierUpPreviewPage() {
  const [open, setOpen] = useState(false);

  // 重放: 先关 (复位 phase), 下一帧再开 → 整段动画从头跑.
  const replay = () => {
    setOpen(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <h1 className="font-display font-bold text-2xl mb-4">🎉 升段仪式动画评审 (Phase D)</h1>
      <p className="text-sm text-slate-400 mb-6 max-w-md">
        点下面按钮看角色升段进化动画。Demo: 和平街小学 → 锦江区
        (scholar 女)。ESC / 点 "继续 →" / 点背景关闭后可再次播放。
      </p>

      <button
        onClick={replay}
        className="px-6 py-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 font-display font-bold text-lg hover:scale-105 active:scale-95 transition-transform shadow-lg"
      >
        ▶ 播放升段动画
      </button>

      <div className="mt-8 text-sm text-slate-400 space-y-1 max-w-md">
        <div className="font-bold text-slate-200">动画分段 (Bruce 评审用):</div>
        <p>• Phase 1 (~0.8s): 旧立绘 visible → fade + 缩小退场</p>
        <p>• Phase 2 (~0.5s): 白光爆开 burst + sparkle ✨🎉 飞溅</p>
        <p>• Phase 3 (~0.8s): 新立绘 spring 弹入 (scale 0.6→1)</p>
        <p>• Phase 4: 庆祝卡 slide up — "🎉 形象进化! 解锁 [段位 + 形象]"</p>
        <p className="text-xs text-slate-500 pt-1">
          注: 现 resolver 只 ship 了 school 段 PNG, district 立绘暂走 fallback
          (跟 school 同图); Phase C 补 district/city 立绘后会自动显示真正不同的进化形象。
        </p>
      </div>

      <div className="mt-6 flex gap-3 text-xs">
        <Link to="/math/character-gallery" className="px-3 py-1.5 rounded-xl border border-slate-600 text-slate-300">
          → 角色图鉴
        </Link>
        <Link to="/math/hub-v6" className="px-3 py-1.5 rounded-xl border border-slate-600 text-slate-300">
          → Hub v6
        </Link>
        <Link to="/math" className="px-3 py-1.5 rounded-xl border border-slate-600 text-slate-300">
          → 老首页
        </Link>
      </div>

      <CharacterTierUpModal
        open={open}
        oldTierId="school"
        newTierId="district"
        characterChoice={DEMO_CHOICE}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
