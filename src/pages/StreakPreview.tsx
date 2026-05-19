/**
 * v0.35.74 — Streak Screen 评审入口 `/math/streak-preview`.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { StreakScreen } from "../components/StreakScreen";

export function StreakPreviewPage() {
  const [scenario, setScenario] = useState<"day1" | "day5" | "day21" | null>(null);

  const presets = {
    day1: {
      streakDays: 1,
      weekProgress: [false, false, "today", null, null, null, null] as Array<true | false | "today" | null>,
      freezeTokens: 0,
    },
    day5: {
      streakDays: 5,
      weekProgress: [true, true, true, true, "today", null, null] as Array<true | false | "today" | null>,
      freezeTokens: 2,
    },
    day21: {
      streakDays: 21,
      weekProgress: [true, true, true, true, true, "today", null] as Array<true | false | "today" | null>,
      freezeTokens: 3,
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <h1 className="font-display font-bold text-2xl mb-4">🔥 Streak Screen 评审</h1>
      <p className="text-sm text-slate-400 mb-6">点 scenario 看不同 streak 数下的火焰屏.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md">
        <button onClick={() => setScenario("day1")} className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 hover:scale-105 transition-transform">
          <div className="text-3xl mb-1">🌱</div>
          <div className="font-bold text-sm">第 1 天</div>
          <div className="text-xs opacity-80">刚点火</div>
        </button>
        <button onClick={() => setScenario("day5")} className="p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 hover:scale-105 transition-transform">
          <div className="text-3xl mb-1">🔥</div>
          <div className="font-bold text-sm">5 天连续</div>
          <div className="text-xs opacity-80">+ 2 请假条</div>
        </button>
        <button onClick={() => setScenario("day21")} className="p-4 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 hover:scale-105 transition-transform">
          <div className="text-3xl mb-1">🔥🔥</div>
          <div className="font-bold text-sm">21 天 (高)</div>
          <div className="text-xs opacity-80">火焰大师</div>
        </button>
      </div>

      <div className="mt-8 text-sm text-slate-400 space-y-1">
        <div className="font-bold text-slate-200">设计要点 (Bruce 评审):</div>
        <p>• Duolingo Streak style — 巨大 🔥 (多层 pulse) + 中心 streak 数字</p>
        <p>• 周日 dots (M T W T F S S) — 已打卡橙色 / 今日 glow / 未来灰</p>
        <p>• 标题/文案 3 档池: &lt;3 / 3-14 / &gt;=14 天 (温和正向, 不"断签惩罚")</p>
        <p>• freezeTokens 显示卡片 (有时才显)</p>
        <p>• 暖色调 (orange→amber→yellow 火焰 vibe), 跟 Celebration (橙→粉) 区分</p>
        <p>• 后续 (sprint 6): integrate 到 Train SummaryView, 每日 first complete 弹出</p>
      </div>

      <div className="mt-6 flex gap-3 text-xs flex-wrap">
        <Link to="/math/hub-v3" className="px-3 py-1.5 rounded-xl border border-slate-600 text-slate-300">→ Hub v3</Link>
        <Link to="/math/celebration-preview" className="px-3 py-1.5 rounded-xl border border-slate-600 text-slate-300">→ 庆祝屏</Link>
        <Link to="/math/world-preview" className="px-3 py-1.5 rounded-xl border border-slate-600 text-slate-300">→ 地图</Link>
        <Link to="/math" className="px-3 py-1.5 rounded-xl border border-slate-600 text-slate-300">→ 老首页</Link>
      </div>

      {scenario && (
        <StreakScreen
          {...presets[scenario]}
          onContinue={() => setScenario(null)}
        />
      )}
    </div>
  );
}
