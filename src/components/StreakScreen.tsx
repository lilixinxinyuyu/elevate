/**
 * v0.35.74 — Streak Screen (Sprint 4, P1-1 from hub-redesign integration plan).
 *
 * Duolingo Streak 屏 style. Bruce + 2 家 peer review 共识: 庆祝屏 (lesson complete)
 * 之后, 独立 streak 屏给"连续打卡" 强 emotional payoff (火焰大 + 周日 dots).
 *
 * 用法:
 *   <StreakScreen
 *     streakDays={5}
 *     weekProgress={[true, true, false, true, "today", null, null]}  // M T W T F S S
 *     onContinue={() => navigate(...)}
 *     freezeTokens={2}
 *   />
 *
 * 设计 DNA:
 * - 巨大 🔥 (SVG, 几层透明度叠加 + animate-pulse)
 * - 中央大字: "X 天连续练习"
 * - 周日 dots (M T W T F S S, 已打卡橙色, 今日 glow, 未打卡灰)
 * - 文案温和正向 (不要"断签惩罚"): "连续练习让 Panda 变强" / "明天再来保持火焰"
 * - 如果有 freezeTokens, 显示"还有 X 张请假条 (可顶 X 天)"
 * - 巨大 "继续 →" 按钮
 */
import { useEffect, useState } from "react";

export interface StreakScreenProps {
  streakDays: number;
  /** 这周 7 天的状态 (M T W T F S S): true=已打卡, "today"=今日, false=断, null=未来 */
  weekProgress: Array<true | false | "today" | null>;
  freezeTokens?: number;
  onContinue?: () => void;
}

const ENCOURAGE_TITLES_LOW = [
  "好的开始!",
  "🔥 火焰点燃了",
  "明天再来, 火焰会更大",
];

const ENCOURAGE_TITLES_MID = [
  "{N} 天连续练习",
  "{N} 天不间断!",
  "{N} 天的火焰",
];

const ENCOURAGE_TITLES_HIGH = [
  "🔥 {N} 天连击!",
  "{N} 天 unstoppable",
  "Panda 看你 {N} 天没掉队",
];

const ENCOURAGE_SUBTITLE_LOW = "明天再来, 火焰会越来越大 ✨";
const ENCOURAGE_SUBTITLE_MID = "连续练习让 Panda 变强";
const ENCOURAGE_SUBTITLE_HIGH = "你已经是火焰大师啦 🎉";

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export function StreakScreen({ streakDays, weekProgress, freezeTokens, onContinue }: StreakScreenProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  // 标题池按 streak 数选
  const titlePool = streakDays < 3 ? ENCOURAGE_TITLES_LOW : streakDays < 14 ? ENCOURAGE_TITLES_MID : ENCOURAGE_TITLES_HIGH;
  const [titleIdx] = useState(() => Math.floor(Math.random() * titlePool.length));
  const title = (titlePool[titleIdx] ?? "{N} 天连续").replace("{N}", String(streakDays));
  const subtitle = streakDays < 3 ? ENCOURAGE_SUBTITLE_LOW : streakDays < 14 ? ENCOURAGE_SUBTITLE_MID : ENCOURAGE_SUBTITLE_HIGH;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-orange-300 via-amber-400 to-yellow-300 overflow-y-auto">
      <div className={`relative max-w-md mx-auto px-6 py-8 transition-all duration-500 ${mounted ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}>

        {/* 巨大 🔥 火焰 (多层 SVG 叠加 + pulse) */}
        <div className="relative mx-auto w-56 h-56 mb-4">
          {/* 外层火焰 (大, 慢 pulse) */}
          <div className="absolute inset-0 flex items-center justify-center text-[180px] leading-none animate-pulse-slow opacity-50">🔥</div>
          {/* 主火焰 (居中, 快 pulse) */}
          <div className="absolute inset-0 flex items-center justify-center text-[160px] leading-none animate-pulse">🔥</div>
          {/* 中央数字 (overlay 火焰里) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="font-display font-black text-7xl text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              {streakDays}
            </div>
          </div>
        </div>

        {/* 标题 + subtitle */}
        <div className="text-center mb-6">
          <div className="font-display font-black text-3xl text-orange-900 drop-shadow mb-1">{title}</div>
          <div className="text-orange-800/80 text-sm">{subtitle}</div>
        </div>

        {/* 周日 dots */}
        <div className="bg-white/95 rounded-2xl px-4 py-4 mb-4 shadow-lg">
          <div className="flex justify-around items-center mb-1">
            {WEEK_LABELS.map((label, i) => {
              const status = weekProgress[i] ?? null;
              const isToday = status === "today";
              const isDone = status === true;
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm border-2 transition-all
                      ${isToday ? "bg-orange-500 text-white border-orange-300 shadow-[0_0_20px_rgba(251,146,60,0.7)] animate-pulse" :
                        isDone ? "bg-orange-400 text-white border-orange-300" :
                        status === false ? "bg-slate-200 text-slate-400 border-slate-300" :
                        "bg-white text-slate-300 border-slate-200"
                      }`}
                  >
                    {isDone || isToday ? "✓" : ""}
                  </div>
                  <div className="text-[10px] text-slate-500">{label}</div>
                </div>
              );
            })}
          </div>
          <div className="text-center text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            每天练习让 🔥 越烧越大
          </div>
        </div>

        {/* freezeTokens 显示 (如有) */}
        {freezeTokens !== undefined && freezeTokens > 0 && (
          <div className="bg-amber-100 border-2 border-amber-300 rounded-2xl px-4 py-2.5 mb-4 flex items-center gap-2 shadow">
            <span className="text-2xl">🎫</span>
            <div className="flex-1 text-amber-900">
              <div className="font-display font-bold text-sm">还有 {freezeTokens} 张请假条</div>
              <div className="text-[11px] opacity-80">忘了练? 自动用 1 张, 火焰不灭</div>
            </div>
          </div>
        )}

        {/* CONTINUE 按钮 */}
        <button
          onClick={onContinue}
          className="w-full py-4 rounded-2xl bg-white text-orange-700 font-display font-black text-xl shadow-xl hover:scale-105 active:scale-95 transition-transform border-4 border-orange-200"
        >
          继续 →
        </button>
      </div>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.3; }
        }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
