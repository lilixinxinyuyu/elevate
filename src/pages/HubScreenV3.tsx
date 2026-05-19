/**
 * v0.35.73 — Hub Screen v3 (Bruce 反馈: "真游戏主界面 一屏可见, 不 scroll, 不顶部 nav")
 *
 * v2 (v0.35.71) 问题:
 * - SubjectShell header + footer 抢屏 → 仍像网页
 * - 内容超 viewport 高度 → 要 scroll
 * - 双货币位置 ok 但整体 too dashboard
 *
 * v3 改造:
 * - `fixed inset-0 z-50` overlay SubjectShell — 全屏占满
 * - 用 `h-[100dvh]` 锁视口高度 + flex 内部, 不允许 scroll
 * - 所有信息一屏全可见: HUD + 角色 + 进度 + 段位 + 主 CTA + 侧栏
 * - 底部状态条 (今日完成 / streak / 灵感) 取代 SubjectShell footer nav
 *
 * 入口: `/math/hub-v3` 给 Bruce 评审.
 *
 * 跟 Hub v2 (/math/hub-preview) 并存 — 对比看进展.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../db/dexie";
import { loadDaily, FREEZE_MAX_TOKENS } from "../lib/dailyTarget";
import { tierFromScore } from "../core/tiers";
import { getTotalXp } from "../db/service";
import { levelFromXp } from "../core/scoring";
import { TrainRoute } from "../lib/routes";

export function HubScreenV3Page() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("Selena");
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [freezeTokens, setFreezeTokens] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [todayTarget, setTodayTarget] = useState(10);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const students = await db.students.toArray();
      const s = students[0];
      if (cancelled || !s) return;
      setStudentName(s.name ?? "Selena");
      const totalXp = await getTotalXp(s.id);
      setXp(totalXp);
      const daily = await loadDaily("math", s.id);
      setStreak(daily.streak);
      setFreezeTokens(daily.freezeTokens ?? 0);
      setTodayCount(daily.todayCount);
      setTodayTarget(daily.target ?? 10);
    })();
    return () => { cancelled = true; };
  }, []);

  const tier = tierFromScore(xp);
  const tierProgress = Math.min(100, Math.max(0, ((xp - tier.range[0]) / (tier.range[1] - tier.range[0])) * 100));
  const level = levelFromXp(xp);
  const todayProgress = Math.min(100, (todayCount / Math.max(1, todayTarget)) * 100);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-950 text-white"
         style={{ height: "100dvh" }}>

      {/* 星空背景 (装饰) */}
      <svg className="absolute inset-0 w-full h-full opacity-40 pointer-events-none">
        {[...Array(80)].map((_, i) => {
          const x = (i * 41) % 100;
          const y = (i * 67) % 100;
          const r = (i % 3) * 0.5 + 0.5;
          return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="white" />;
        })}
      </svg>

      <div className="relative h-full max-w-md mx-auto px-3 py-3 flex flex-col">

        {/* ─── 顶部 HUD: Profile + 段位 + 货币 ─── */}
        <div className="flex items-center gap-2 mb-2 shrink-0">
          {/* Profile + 段位 */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/95 text-slate-900 shadow-lg flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-xl shrink-0">🐼</div>
            <div className="min-w-0 flex-1">
              <div className="font-display font-bold text-sm leading-tight truncate">{studentName}</div>
              <div className="text-[10px] text-slate-500 leading-tight truncate">{tier.name} · Lv {level}</div>
            </div>
          </div>

          {/* 段位徽章 */}
          <div className="px-2 py-1 rounded-xl bg-slate-900/80 border border-amber-400/40 shrink-0">
            <span className="text-xl">{tier.badgeIcon}</span>
          </div>

          {/* 双货币 */}
          <div className="flex flex-col gap-1 shrink-0">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/70 border border-amber-400/40">
              <span className="text-amber-400">🔥</span>
              <span className="font-display font-bold text-xs tabular-nums">{streak}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/70 border border-yellow-400/40">
              <span>🎫</span>
              <span className="font-display font-bold text-xs tabular-nums">{freezeTokens}/{FREEZE_MAX_TOKENS}</span>
            </div>
          </div>
        </div>

        {/* ─── 段位进度条 ─── */}
        <div className="flex items-center gap-2 px-2 mb-3 shrink-0">
          <span className="text-[10px] text-violet-200/70 whitespace-nowrap">段位进度</span>
          <div className="flex-1 h-2 rounded-full bg-slate-800/60 border border-violet-300/20 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-400 to-amber-300 transition-all" style={{ width: `${tierProgress}%` }} />
          </div>
          <span className="text-[10px] text-violet-200/70 tabular-nums whitespace-nowrap">{Math.round(tierProgress)}%</span>
        </div>

        {/* ─── 中央: 侧栏 + Mascot + 副侧栏 ─── */}
        <div className="flex-1 flex items-center justify-center gap-2 min-h-0 relative">

          {/* 左侧栏 */}
          <div className="flex flex-col gap-2">
            <SideButton emoji="🏆" label="勋章" to="/math/skills" tone="emerald" />
            <SideButton emoji="📝" label="模拟" to="/math/exam-prep" tone="cyan" />
            <SideButton emoji="🎨" label="工坊" to="/math/atelier" tone="violet" />
          </div>

          {/* Mascot 中央 */}
          <div className="flex-1 flex flex-col items-center justify-end relative h-full">
            {/* 圆形 platform */}
            <div className="absolute bottom-4 w-44 h-10 rounded-full bg-violet-500/30 blur-md" />
            <div className="relative flex items-end justify-center gap-1">
              <div className="text-[110px] sm:text-[140px] leading-none animate-float">🐼</div>
              <div className="text-[50px] sm:text-[64px] leading-none animate-float-slow mb-3">🦊</div>
            </div>
          </div>

          {/* 右侧栏 */}
          <div className="flex flex-col gap-2">
            <SideButton emoji="⚔️" label="错题" to="/math/mistakes" tone="rose" />
            <SideButton emoji="⚡" label="基本功" to="/math/fluency" tone="amber" />
            <SideButton emoji="🗺️" label="地图" to="/math/world-preview" tone="sky" />
          </div>
        </div>

        {/* ─── 今日进度 + PLAY 区 ─── */}
        <div className="shrink-0 space-y-2 pt-2">
          {/* 今日进度条 */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-black/30 border border-violet-300/20">
            <span className="text-base">🎯</span>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-[11px]">
                <span className="text-violet-100/80">今日任务</span>
                <span className="text-amber-300 tabular-nums">{todayCount} / {todayTarget}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800/80 border border-slate-600 overflow-hidden mt-1">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all" style={{ width: `${todayProgress}%` }} />
              </div>
            </div>
          </div>

          {/* PLAY 巨钮 */}
          <button
            onClick={() => navigate(TrainRoute.build({ fresh: Date.now() }))}
            className="w-full py-4 rounded-3xl bg-gradient-to-r from-amber-300 via-orange-400 to-pink-400 text-slate-900 font-display font-black text-2xl shadow-2xl shadow-orange-500/40 border-4 border-amber-200 hover:scale-[1.02] active:scale-95 transition-transform"
          >
            ▶ 开始战斗
          </button>

          {/* 评审 tag 行 */}
          <div className="text-center text-[9px] text-violet-300/40 pt-1">
            Hub v3 prototype (Bruce 评审) · <Link className="underline" to="/math">老首页</Link> · <Link className="underline" to="/math/hub-preview">v2</Link> · <Link className="underline" to="/math/celebration-preview">🎉</Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function SideButton({ emoji, label, to, tone }: { emoji: string; label: string; to: string; tone: "emerald" | "cyan" | "violet" | "rose" | "amber" | "sky" }) {
  const toneStyle = {
    emerald: "from-emerald-500 to-teal-600 border-emerald-300",
    cyan: "from-cyan-500 to-sky-600 border-cyan-300",
    violet: "from-violet-500 to-fuchsia-600 border-violet-300",
    rose: "from-rose-500 to-pink-600 border-rose-300",
    amber: "from-amber-500 to-orange-600 border-amber-300",
    sky: "from-sky-500 to-blue-600 border-sky-300",
  }[tone];
  return (
    <Link to={to} className={`flex flex-col items-center justify-center gap-0.5 px-1.5 py-2 rounded-xl bg-gradient-to-br ${toneStyle} border-2 shadow-md w-14 hover:scale-105 active:scale-95 transition-transform`}>
      <span className="text-xl leading-none">{emoji}</span>
      <span className="text-[9px] font-bold text-white whitespace-nowrap">{label}</span>
    </Link>
  );
}
