/**
 * v0.35.72 — Celebration Screen (Sprint 2, P0-5 from hub-redesign integration plan).
 *
 * Duolingo "Lesson complete!" style 庆祝屏. Bruce + 2 家 peer review 共识:
 * 战斗结束 / session 完成后必须有 emotional payoff 屏, 不只是 toast.
 *
 * 用法:
 *   <CelebrationScreen
 *     xp={20}
 *     combo={5}
 *     tierProgressDelta={18}
 *     correctCount={9}
 *     totalCount={10}
 *     onContinue={() => navigate(...)}
 *   />
 *
 * 设计 DNA (来自 Duolingo Lesson Complete + Hamster):
 * - Mascot Panda + 红熊猫副手 pair 跳跃
 * - 大字 "干得漂亮!" / "怪兽被赶跑了!" (不是 "得分" / "成绩")
 * - 3 奖励 stat cards (+XP / Combo / 段位进度)
 * - 错题多时 reframe: "今天找到 X 个再练的点" 不显示低分
 * - 绿色巨大 CONTINUE button
 * - 烟花动画 (CSS, SVG 装饰)
 */
import { useEffect, useState } from "react";

export interface CelebrationScreenProps {
  /** 本次 session 获得 XP (不含 combo bonus) */
  xp: number;
  /** 最高 combo */
  combo: number;
  /** 段位进度增加 % (0-100, e.g. 18 表示 +18%) */
  tierProgressDelta?: number;
  /** 答对题数 */
  correctCount: number;
  /** 总题数 */
  totalCount: number;
  /** 点 CONTINUE 后回调 */
  onContinue?: () => void;
  /** 可选: 段位名 (e.g. "和平街数学爱好者") */
  tierName?: string;
}

const ENCOURAGE_TITLES = [
  "干得漂亮！",
  "战利品到手！",
  "怪兽被赶跑了！",
  "数学怪物认输啦！",
  "今天又变强了！",
];

const ENCOURAGE_SUBTITLES_HIGH = [
  "小进姐姐看到都笑了 ✨",
  "Panda 跟你击掌！",
  "你今天 unstoppable",
];

const ENCOURAGE_SUBTITLES_MID = [
  "Panda 觉得你越来越厉害了",
  "继续这样, 越来越稳",
  "今天的进度很扎实",
];

const ENCOURAGE_SUBTITLES_LOW = [
  "今天找到 N 个再练的点, 明天回来收拾它",
  "怪兽硬, 但 Panda 跟你不怕",
  "明天的 Panda 比今天更强",
];

export function CelebrationScreen({
  xp,
  combo,
  tierProgressDelta,
  correctCount,
  totalCount,
  onContinue,
  tierName,
}: CelebrationScreenProps) {
  // 文案随机选 (per session, 不在 re-render 时变)
  const [titleIdx] = useState(() => Math.floor(Math.random() * ENCOURAGE_TITLES.length));
  const accuracy = totalCount > 0 ? correctCount / totalCount : 0;

  // accuracy >= 80% → high, 50-80 → mid, < 50 → low (reframed positive)
  const subtitlePool =
    accuracy >= 0.8 ? ENCOURAGE_SUBTITLES_HIGH :
    accuracy >= 0.5 ? ENCOURAGE_SUBTITLES_MID :
    ENCOURAGE_SUBTITLES_LOW;
  const [subIdx] = useState(() => Math.floor(Math.random() * subtitlePool.length));
  const subtitle = subtitlePool[subIdx]?.replace("N", String(totalCount - correctCount));

  // entrance animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 overflow-y-auto">
      {/* 烟花/彩纸 SVG 装饰 */}
      <svg className="absolute inset-0 pointer-events-none opacity-60" preserveAspectRatio="none">
        {[...Array(20)].map((_, i) => {
          const x = (i * 73) % 100;
          const y = (i * 47) % 50;
          const colors = ["#fef08a", "#fda4af", "#a5f3fc", "#bbf7d0", "#ddd6fe"];
          const color = colors[i % colors.length];
          return (
            <circle
              key={i}
              cx={`${x}%`}
              cy={`${y}%`}
              r={(i % 4) + 2}
              fill={color}
              opacity={0.6}
              className="animate-float-slow"
            />
          );
        })}
      </svg>

      <div className={`relative max-w-md mx-auto px-6 py-8 transition-all duration-500 ${mounted ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}>

        {/* 标题 */}
        <div className="text-center mb-6">
          <div className="font-display font-black text-4xl text-white drop-shadow-lg mb-2">
            {ENCOURAGE_TITLES[titleIdx]}
          </div>
          <div className="text-amber-50 text-sm font-medium">
            {subtitle}
          </div>
        </div>

        {/* Mascot Pair (Panda + 红熊猫) 跳跃 */}
        <div className="flex justify-center items-end gap-4 mb-8">
          <div className="text-[140px] leading-none animate-bounce">🐼</div>
          <div className="text-[80px] leading-none animate-bounce" style={{ animationDelay: "150ms" }}>🦊</div>
        </div>

        {/* 3 奖励卡 */}
        <div className="space-y-3 mb-8">
          <RewardCard
            emoji="⚡"
            label="XP 获得"
            value={`+${xp}`}
            tone="amber"
            extra={combo >= 3 ? `Combo ×${combo}` : null}
          />
          <RewardCard
            emoji="🎯"
            label="今日命中"
            value={`${correctCount} / ${totalCount}`}
            tone="emerald"
            extra={accuracy >= 0.8 ? "高准确 ✨" : null}
          />
          {tierProgressDelta !== undefined && tierProgressDelta > 0 && tierName && (
            <RewardCard
              emoji="🏆"
              label={tierName + " 进度"}
              value={`+${tierProgressDelta}%`}
              tone="violet"
            />
          )}
        </div>

        {/* CONTINUE 按钮 */}
        <button
          onClick={onContinue}
          className="w-full py-4 rounded-2xl bg-white text-emerald-700 font-display font-black text-xl shadow-xl hover:scale-105 active:scale-95 transition-transform border-4 border-emerald-200"
        >
          继续 →
        </button>
      </div>

      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function RewardCard({
  emoji, label, value, tone, extra,
}: {
  emoji: string;
  label: string;
  value: string;
  tone: "amber" | "emerald" | "violet";
  extra?: string | null;
}) {
  const toneStyle = {
    amber: "from-amber-100 to-orange-200 text-amber-900 border-amber-300",
    emerald: "from-emerald-100 to-teal-200 text-emerald-900 border-emerald-300",
    violet: "from-violet-100 to-fuchsia-200 text-violet-900 border-violet-300",
  }[tone];
  return (
    <div className={`flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-br ${toneStyle} border-2 shadow-md`}>
      <div className="text-3xl">{emoji}</div>
      <div className="flex-1">
        <div className="text-[11px] uppercase tracking-widest opacity-70">{label}</div>
        <div className="font-display font-black text-2xl">{value}</div>
      </div>
      {extra && (
        <div className="text-[11px] px-2 py-0.5 rounded-full bg-white/60 font-bold">
          {extra}
        </div>
      )}
    </div>
  );
}
