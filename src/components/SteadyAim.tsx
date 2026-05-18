/**
 * v0.35.6 (iter 40 P2-1): 稳准挑战 UI 组件.
 *
 * 包含:
 *   - SteadyAimBanner: Train 页顶部紫色 chip + 退出按钮 (评审共识: 不用红色, 用紫色)
 *   - SteadyAimIntroDialog: 首次开启强确认 dialog
 *   - SteadyAimEntryButton: Home / Settings 入口 (含说明)
 */
import { useState } from "react";
import {
  activateSteadyAim,
  deactivateSteadyAim,
  getSteadyAimDailyCounters,
  hasSeenSteadyAimIntro,
  isSteadyAimActive,
  markSteadyAimIntroSeen,
  STEADY_AIM_XP,
} from "../core/steadyAimPolicy";

/* ──────────────────── Banner (in Train 顶部) ──────────────────── */

interface BannerProps {
  onExit?: () => void;
}

export function SteadyAimBanner({ onExit }: BannerProps) {
  if (!isSteadyAimActive()) return null;
  const counters = getSteadyAimDailyCounters();
  return (
    <div className="mb-2 rounded-lg bg-purple-500/20 border border-purple-400/50 px-3 py-1.5 flex items-center gap-2">
      <span className="text-sm">🎯</span>
      <span className="text-xs text-purple-100 font-semibold flex-1">
        稳准挑战中 · 今日 bonus {counters.bonus}/{counters.bonusCap}
      </span>
      <button
        onClick={() => {
          deactivateSteadyAim();
          onExit?.();
        }}
        className="text-xs px-2 py-0.5 rounded bg-purple-700 text-white hover:bg-purple-600"
      >
        退出
      </button>
    </div>
  );
}

/* ──────────────────── Intro Dialog (首次开启强确认) ──────────────────── */

interface IntroDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SteadyAimIntroDialog({ open, onConfirm, onCancel }: IntroDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-purple-400/50 rounded-xl px-5 py-4 max-w-md space-y-3 shadow-2xl"
      >
        <h2 className="text-lg font-bold text-purple-100">🎯 稳准挑战 (高难度)</h2>
        <div className="space-y-2 text-sm text-purple-50/90">
          <p>这是个特殊模式 — <b>答得太快也会扣 XP</b>!</p>
          <ul className="list-disc list-inside text-xs text-purple-200/80 space-y-1">
            <li>答对 + 用时 ≥ 估算时间 1.5× → +{STEADY_AIM_XP.DEEP_THINK_BONUS} XP "稳准 bonus"</li>
            <li>答对但用时太短 (&lt; 0.5×) → <b>-{Math.abs(STEADY_AIM_XP.TOO_FAST_PENALTY)} XP</b> "太冲了"</li>
            <li>首次太快免扣 (只警告), 第二次起真扣</li>
            <li>每日 +{STEADY_AIM_XP.DEEP_THINK_BONUS} bonus 最多 {STEADY_AIM_XP.DAILY_BONUS_CAP} 次 (防发呆刷)</li>
          </ul>
          <p className="text-xs text-amber-200/90 bg-amber-500/10 rounded px-2 py-1">
            ⚠️ 如果今天心情累 / 烦 / 想放松, 不建议开启. 可随时退出.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
          >
            算了, 我再想想
          </button>
          <button
            onClick={() => {
              markSteadyAimIntroSeen();
              onConfirm();
            }}
            className="flex-1 px-3 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold hover:bg-purple-400"
          >
            我想挑战稳准 →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── Entry Button (Settings 或 Home) ──────────────────── */

interface EntryButtonProps {
  /** 开启后回调 (例如 navigate train) */
  onActivated?: () => void;
  /** UI 样式 hint */
  variant?: "card" | "inline";
}

export function SteadyAimEntryButton({ onActivated, variant = "card" }: EntryButtonProps) {
  const [showIntro, setShowIntro] = useState(false);
  const active = isSteadyAimActive();

  function handleClick() {
    if (active) {
      // 已开 → 直接关
      deactivateSteadyAim();
      return;
    }
    // 第一次 / 之前关了 → 总是显示 intro (强确认)
    setShowIntro(true);
  }

  function confirmActivate() {
    activateSteadyAim();
    setShowIntro(false);
    onActivated?.();
  }

  if (variant === "card") {
    return (
      <>
        <button
          onClick={handleClick}
          className={`block w-full text-left rounded-xl p-3 border transition ${
            active
              ? "bg-purple-500/20 border-purple-400/50 hover:bg-purple-500/30"
              : "bg-slate-800/40 border-purple-400/30 hover:bg-purple-500/10"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <div className="flex-1">
              <p className="font-semibold text-sm text-purple-100">
                稳准挑战 {active && "(已开启)"}
              </p>
              <p className="text-[11px] text-purple-200/70 mt-0.5">
                高难度自愿模式 · 答太快会扣分
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${active ? "bg-purple-400 text-white" : "bg-slate-700 text-slate-300"}`}>
              {active ? "退出" : "开启"}
            </span>
          </div>
        </button>
        <SteadyAimIntroDialog
          open={showIntro}
          onConfirm={confirmActivate}
          onCancel={() => setShowIntro(false)}
        />
      </>
    );
  }

  // inline (Home 底部弱小入口)
  return (
    <>
      <button
        onClick={handleClick}
        className="text-xs text-purple-300/70 hover:text-purple-200 underline"
      >
        {active ? "🎯 稳准挑战中, 点退出" : "🎯 想挑战自己? 试试稳准模式"}
      </button>
      <SteadyAimIntroDialog
        open={showIntro}
        onConfirm={confirmActivate}
        onCancel={() => setShowIntro(false)}
      />
    </>
  );
}
