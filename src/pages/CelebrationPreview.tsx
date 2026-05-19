/**
 * v0.35.72 — Celebration Screen 评审入口 `/math/celebration-preview`.
 *
 * 让 Bruce 看 mock 数据驱动的庆祝屏效果 (3 种 scenario 切换).
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { CelebrationScreen } from "../components/CelebrationScreen";

export function CelebrationPreviewPage() {
  const [scenario, setScenario] = useState<"high" | "mid" | "low" | null>(null);

  const presets = {
    high: { xp: 35, combo: 5, tierProgressDelta: 18, correctCount: 9, totalCount: 10 },
    mid: { xp: 18, combo: 2, tierProgressDelta: 8, correctCount: 6, totalCount: 10 },
    low: { xp: 8, combo: 0, tierProgressDelta: 3, correctCount: 3, totalCount: 10 },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <h1 className="font-display font-bold text-2xl mb-4">🎉 Celebration Screen 评审</h1>
      <p className="text-sm text-slate-400 mb-6">
        点 3 种 scenario 看不同分数下的庆祝屏效果. ESC / 点 "继续" 关闭返回这里.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md">
        <button
          onClick={() => setScenario("high")}
          className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 hover:scale-105 transition-transform"
        >
          <div className="text-3xl mb-1">🌟</div>
          <div className="font-bold text-sm">高准确</div>
          <div className="text-xs opacity-80">9/10 + combo 5</div>
        </button>
        <button
          onClick={() => setScenario("mid")}
          className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 hover:scale-105 transition-transform"
        >
          <div className="text-3xl mb-1">💪</div>
          <div className="font-bold text-sm">中等</div>
          <div className="text-xs opacity-80">6/10 + combo 2</div>
        </button>
        <button
          onClick={() => setScenario("low")}
          className="p-4 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 hover:scale-105 transition-transform"
        >
          <div className="text-3xl mb-1">🌱</div>
          <div className="font-bold text-sm">需努力</div>
          <div className="text-xs opacity-80">3/10 (reframe)</div>
        </button>
      </div>

      <div className="mt-8 text-sm text-slate-400 space-y-1">
        <div className="font-bold text-slate-200">设计要点 (Bruce 评审用):</div>
        <p>• Duolingo "Lesson complete" style — mascot pair 跳跃 + 3 奖励卡 + 大 CONTINUE</p>
        <p>• 文案 random selected, 高/中/低分不同 pool (低分 reframe positive 不羞辱)</p>
        <p>• 烟花彩纸 CSS 动画背景</p>
        <p>• 暖色调 (橙→粉) vs 主路径的紫色 — 庆祝感强</p>
        <p>• 后续: integrate 到 Train SummaryView 替换现行结算 (sprint 6)</p>
      </div>

      <div className="mt-6 flex gap-3 text-xs">
        <Link to="/math/hub-preview" className="px-3 py-1.5 rounded-xl border border-slate-600 text-slate-300">→ Hub Screen</Link>
        <Link to="/math/world-preview" className="px-3 py-1.5 rounded-xl border border-slate-600 text-slate-300">→ World Map</Link>
        <Link to="/math" className="px-3 py-1.5 rounded-xl border border-slate-600 text-slate-300">→ 老首页</Link>
      </div>

      {scenario && (
        <CelebrationScreen
          {...presets[scenario]}
          tierName="和平街数学爱好者"
          onContinue={() => setScenario(null)}
        />
      )}
    </div>
  );
}
