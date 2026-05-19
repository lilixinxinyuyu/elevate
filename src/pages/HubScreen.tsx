/**
 * v0.35.71 — Hub Screen prototype v2 (Bruce 反馈 "整体差得还挺远", 给了 7 张参考).
 *
 * 核心 DNA 来自 hamster 战斗数学游戏 (Bruce 最看重 2 张):
 *   - Profile 卡左上 (avatar + name)
 *   - 双货币右上 (⭐ stars + 🟡 coins/灵感) + 🔥 streak
 *   - **Mascot 居中大 + 等级进度条** (3x 之前 size, 真主角不是 HUD 装饰)
 *   - 侧栏 icon 菜单 (左 3: Shop/Task/Inventory, 右 2: Profile/Menu)
 *   - **巨大 PLAY 按钮右下** as primary CTA (不是 27 个 interactive)
 *
 * Click PLAY → /math/world-preview (Duolingo-style 蜿蜒地图)
 * Click 各 side icon → 对应已有 page (mistakes/atelier/exam-prep/etc)
 *
 * 入口: `/math/hub-preview` (不替换 /math home, 让 Bruce 比较)
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../db/dexie";
import { loadDaily, FREEZE_MAX_TOKENS } from "../lib/dailyTarget";
import { tierFromScore } from "../core/tiers";
import { getTotalXp } from "../db/service";
import { TrainRoute } from "../lib/routes";

export function HubScreenPage() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("Selena");
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [freezeTokens, setFreezeTokens] = useState(0);

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
    })();
    return () => { cancelled = true; };
  }, []);

  const tier = tierFromScore(xp);
  // 段位内进度 % (e.g. xp=193 in school tier [0, 10000] → 1.93%)
  const tierProgress = Math.min(100, Math.max(0, ((xp - tier.range[0]) / (tier.range[1] - tier.range[0])) * 100));

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-indigo-900 via-violet-900 to-fuchsia-950 text-white">
      {/* 装饰星空背景 */}
      <div className="absolute inset-0 pointer-events-none">
        <svg width="100%" height="100%" className="opacity-30">
          {[...Array(60)].map((_, i) => {
            const x = (i * 41) % 100;
            const y = (i * 67) % 100;
            const r = (i % 3) * 0.5 + 0.5;
            return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="white" />;
          })}
        </svg>
      </div>

      <div className="relative max-w-md mx-auto h-screen flex flex-col px-4 py-4">

        {/* ─── 顶部 HUD: Profile 左 + 双货币右 ─── */}
        <div className="flex items-center gap-2 mb-2">
          {/* Profile 卡 */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/95 text-slate-900 shadow-lg">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-xl">🐼</div>
            <div>
              <div className="font-display font-bold text-sm leading-tight">{studentName}</div>
              <div className="text-[10px] text-slate-500 leading-tight">{tier.name}</div>
            </div>
          </div>

          <div className="flex-1" />

          {/* 双货币 + streak chip */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/70 border border-amber-400/40">
              <span className="text-amber-400">⭐</span>
              <span className="font-display font-bold text-sm">{streak}</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/70 border border-yellow-400/40">
              <span>🟡</span>
              <span className="font-display font-bold text-sm">{freezeTokens}/{FREEZE_MAX_TOKENS}</span>
            </div>
          </div>
        </div>

        {/* ─── 等级进度条 (居中, mascot 上方) ─── */}
        <div className="flex justify-center mt-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-900/80 border border-violet-300/40 flex items-center justify-center font-display font-bold text-xs text-violet-100">
              {Math.min(99, Math.floor(xp / 100) + 1)}
            </div>
            <div className="w-40 h-2.5 rounded-full bg-slate-800/80 border border-slate-600 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-orange-400 to-amber-300" style={{ width: `${tierProgress}%` }} />
            </div>
          </div>
        </div>

        {/* ─── 中央 Mascot 大占位 (主角) ─── */}
        <div className="flex-1 flex items-center justify-center relative my-4">
          {/* 圆形平台 */}
          <div className="absolute bottom-12 w-44 h-12 rounded-full bg-gradient-to-r from-violet-700/40 via-fuchsia-600/40 to-violet-700/40 blur-md" />

          {/* Mascot 主图 — 用 emoji 巨大 */}
          <div className="relative">
            <div className="text-[180px] leading-none animate-float">🐼</div>
            {/* 红熊猫 副手 */}
            <div className="absolute -right-12 bottom-4 text-[64px] animate-float-slow">🦊</div>
          </div>
        </div>

        {/* ─── 左侧栏 (Shop/Task/Inventory 类比) ─── */}
        <div className="absolute left-3 top-1/3 flex flex-col gap-3">
          <SideButton emoji="🏆" label="勋章" to="/math/skills" tone="emerald" />
          <SideButton emoji="📝" label="模拟" to="/math/exam-prep" tone="cyan" />
          <SideButton emoji="🎨" label="工坊" to="/math/atelier" tone="violet" />
        </div>

        {/* ─── 右侧栏 (Profile/Menu) ─── */}
        <div className="absolute right-3 top-1/3 flex flex-col gap-3">
          <SideButton emoji="⚔️" label="错题" to="/math/mistakes" tone="rose" />
          <SideButton emoji="⚡" label="基本功" to="/math/fluency" tone="amber" />
        </div>

        {/* ─── 主 PLAY 按钮 (巨大唯一) ─── */}
        <div className="flex justify-end items-end pb-2">
          <button
            onClick={() => navigate(TrainRoute.build({ fresh: Date.now() }))}
            className="bg-gradient-to-br from-amber-300 to-orange-500 text-slate-900 font-display font-black text-3xl px-10 py-5 rounded-3xl shadow-2xl shadow-orange-500/50 border-4 border-amber-200 hover:scale-105 active:scale-95 transition-transform"
          >
            ▶ PLAY
          </button>
        </div>

        {/* 底部细节 */}
        <div className="text-center text-[10px] text-violet-200/40 pt-1">
          ↑ Hub prototype v2 (Bruce 评审) · <Link className="underline" to="/math">回老首页</Link> · <Link className="underline" to="/math/world-preview">看地图</Link>
        </div>
      </div>

      {/* float animation CSS */}
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function SideButton({ emoji, label, to, tone }: { emoji: string; label: string; to: string; tone: "emerald" | "cyan" | "violet" | "rose" | "amber" }) {
  const toneStyle = {
    emerald: "from-emerald-500 to-teal-600 border-emerald-300",
    cyan: "from-cyan-500 to-sky-600 border-cyan-300",
    violet: "from-violet-500 to-fuchsia-600 border-violet-300",
    rose: "from-rose-500 to-pink-600 border-rose-300",
    amber: "from-amber-500 to-orange-600 border-amber-300",
  }[tone];
  return (
    <Link to={to} className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-2xl bg-gradient-to-br ${toneStyle} border-2 shadow-lg w-16 hover:scale-105 active:scale-95 transition-transform`}>
      <span className="text-2xl">{emoji}</span>
      <span className="text-[10px] font-bold text-white whitespace-nowrap">{label}</span>
    </Link>
  );
}
