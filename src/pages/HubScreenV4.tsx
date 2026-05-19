/**
 * v0.35.75 — Hub Screen v4 (Bruce 反馈 v3 "4K 屏中间一小块, 信息密度不够")
 *
 * v3 问题 (Bruce 实测):
 * - 4K 屏 max-w-md 中间一小块, 周围全空 → 像 placeholder
 * - 信息密度比老首页低很多 → 不激励 (老首页 27 interactive / 23 emoji)
 *
 * v4 改造:
 * - **3-column grid 大屏**: 左信息卡 / 中 Mascot+PLAY / 右成就卡
 * - **响应式**: 手机 → 单列堆叠 (mobile-first), 平板 / 桌面 → 3 列
 * - **大屏 max-w-7xl** (4K 也铺满, 不局促中间)
 * - **更多信息** (但有结构):
 *   左: Profile + 段位 + 今日 3 quest 列表 + 进度
 *   中: BIG Mascot + 主 CTA + 今日任务条
 *   右: 成就 chip 行 + 红旗 skill 提醒 + 期末倒计时
 * - 仍 fixed inset overlay + 1 屏不 scroll (但密度更高)
 *
 * 入口: `/math/hub-v4`. 跟 v3 (/math/hub-v3) 并存对比.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { loadDaily, FREEZE_MAX_TOKENS } from "../lib/dailyTarget";
import { tierFromScore } from "../core/tiers";
import { getTotalXp, getFragileSkillsToReview } from "../db/service";
import { levelFromXp } from "../core/scoring";
import { TrainRoute } from "../lib/routes";
import { currentExam, daysUntil } from "../core/examDates";

export function HubScreenV4Page() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("Selena");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [freezeTokens, setFreezeTokens] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [todayTarget, setTodayTarget] = useState(10);
  const [fragileSkills, setFragileSkills] = useState<{ skillId: string; skillName: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const students = await db.students.toArray();
      const s = students[0];
      if (cancelled || !s) return;
      setStudentName(s.name ?? "Selena");
      setStudentId(s.id);
      const totalXp = await getTotalXp(s.id);
      setXp(totalXp);
      const daily = await loadDaily("math", s.id);
      setStreak(daily.streak);
      setFreezeTokens(daily.freezeTokens ?? 0);
      setTodayCount(daily.todayCount);
      setTodayTarget(daily.target ?? 10);
      const fragile = await getFragileSkillsToReview(s.id);
      if (!cancelled) setFragileSkills(fragile.slice(0, 3).map((f) => ({ skillId: f.skillId, skillName: f.skillName })));
    })();
    return () => { cancelled = true; };
  }, []);

  // 今日 attempts 总数 (用 useLiveQuery 实时)
  const attemptsToday = useLiveQuery(async () => {
    if (!studentId) return 0;
    const todayKey = new Date().toISOString().slice(0, 10);
    return await db.attempts
      .where({ studentId })
      .filter((a) => (a.createdAt ?? 0) > Date.now() - 86400000)
      .count();
  }, [studentId]) ?? 0;

  const tier = tierFromScore(xp);
  const tierProgress = Math.min(100, Math.max(0, ((xp - tier.range[0]) / (tier.range[1] - tier.range[0])) * 100));
  const level = levelFromXp(xp);
  const todayProgress = Math.min(100, (todayCount / Math.max(1, todayTarget)) * 100);
  const challengeDone = todayCount >= todayTarget;

  // 期末倒计时
  const exam = currentExam(new Date());
  const examDays = exam ? daysUntil(exam.date, new Date()) : null;

  // Today's 3 quest 状态
  const quests = [
    { id: "challenge", emoji: "🎯", label: "今日挑战", progress: todayCount, total: todayTarget, done: challengeDone, accent: "from-amber-400 to-orange-500" },
    { id: "fluency", emoji: "⚡", label: "闪电口算", progress: 0, total: 30, done: false, accent: "from-cyan-400 to-blue-500" },
    { id: "mistakes", emoji: "⚔️", label: "驯龙营 (错题)", progress: fragileSkills.length, total: 3, done: fragileSkills.length === 0, accent: "from-rose-400 to-pink-500" },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-950 text-white"
         style={{ height: "100dvh" }}>

      {/* 星空背景 */}
      <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none">
        {[...Array(120)].map((_, i) => {
          const x = (i * 41) % 100;
          const y = (i * 67) % 100;
          const r = (i % 3) * 0.5 + 0.5;
          return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="white" />;
        })}
      </svg>

      <div className="relative h-full max-w-7xl mx-auto px-4 py-4 flex flex-col">

        {/* ─── 顶部 HUD ─── */}
        <div className="flex items-center gap-3 mb-3 shrink-0">
          {/* Profile + 段位 (左) */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/95 text-slate-900 shadow-lg flex-1 min-w-0 max-w-xs">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-2xl shrink-0">🐼</div>
            <div className="min-w-0 flex-1">
              <div className="font-display font-bold text-base leading-tight truncate">{studentName}</div>
              <div className="text-xs text-slate-500 leading-tight truncate">{tier.name} · Lv {level} · {xp.toLocaleString()} XP</div>
              <div className="h-1.5 mt-1 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-400 to-amber-300" style={{ width: `${tierProgress}%` }} />
              </div>
            </div>
            <div className="text-3xl shrink-0">{tier.badgeIcon}</div>
          </div>

          <div className="flex-1" />

          {/* 货币 + streak (右) */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900/70 border border-amber-400/40">
              <span className="text-xl">🔥</span>
              <span className="font-display font-bold text-lg tabular-nums">{streak}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900/70 border border-yellow-400/40">
              <span className="text-xl">🎫</span>
              <span className="font-display font-bold text-lg tabular-nums">{freezeTokens}<span className="text-xs opacity-60">/{FREEZE_MAX_TOKENS}</span></span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900/70 border border-emerald-400/40">
              <span className="text-xl">⭐</span>
              <span className="font-display font-bold text-lg tabular-nums">{attemptsToday}</span>
            </div>
          </div>
        </div>

        {/* ─── 主体 3-column grid ─── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_1fr] gap-4 min-h-0">

          {/* 左列 — 今日 quest list */}
          <div className="space-y-3 overflow-hidden">
            <div className="font-display font-bold text-amber-300 text-sm uppercase tracking-widest">📋 今日任务</div>
            {quests.map((q) => (
              <Link
                key={q.id}
                to={q.id === "challenge" ? TrainRoute.build({ fresh: Date.now() }) : q.id === "fluency" ? "/math/fluency" : "/math/mistakes"}
                className={`block p-3 rounded-2xl bg-gradient-to-br ${q.accent} shadow-lg hover:scale-[1.02] active:scale-95 transition-transform`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{q.emoji}</span>
                  <span className="font-display font-bold text-white text-sm flex-1">{q.label}</span>
                  {q.done && <span className="text-lg">✓</span>}
                </div>
                <div className="text-[11px] text-white/80 mb-1 flex justify-between tabular-nums">
                  <span>{q.progress} / {q.total}</span>
                  <span>{Math.round((q.progress / Math.max(1, q.total)) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
                  <div className="h-full bg-white/80" style={{ width: `${Math.min(100, (q.progress / Math.max(1, q.total)) * 100)}%` }} />
                </div>
              </Link>
            ))}

            {/* 期末倒计时 */}
            {exam && examDays !== null && examDays >= 0 && (
              <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-800 to-fuchsia-800 border border-violet-400/40">
                <div className="text-[11px] text-violet-200 uppercase tracking-widest mb-1">⏳ 距 {exam.name}</div>
                <div className="font-display font-black text-2xl text-violet-100">
                  {examDays === 0 ? "今天!" : `${examDays} 天`}
                </div>
                <Link to="/math/exam-prep" className="text-[11px] text-violet-200 underline">→ 期末备考中心</Link>
              </div>
            )}
          </div>

          {/* 中列 — Mascot + PLAY */}
          <div className="flex flex-col items-center justify-end relative min-h-0">
            {/* 圆形 platform */}
            <div className="absolute bottom-32 w-64 h-14 rounded-full bg-violet-500/30 blur-md" />
            {/* Mascot pair (大屏更大) */}
            <div className="relative flex items-end justify-center gap-2 mb-4 flex-1 max-h-[60vh]">
              <div className="text-[clamp(120px,22vh,260px)] leading-none animate-float">🐼</div>
              <div className="text-[clamp(60px,12vh,140px)] leading-none animate-float-slow mb-4">🦊</div>
            </div>

            {/* 今日进度条 */}
            <div className="w-full max-w-md mb-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-black/30 border border-violet-300/20">
                <span className="text-base">🎯</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs">
                    <span className="text-violet-100/80">今日已练 {attemptsToday} 题</span>
                    <span className="text-amber-300 tabular-nums">{todayCount} / {todayTarget}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800/80 border border-slate-600 overflow-hidden mt-1">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all" style={{ width: `${todayProgress}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* 巨大 PLAY 按钮 */}
            <button
              onClick={() => navigate(TrainRoute.build({ fresh: Date.now() }))}
              className="w-full max-w-md py-4 rounded-3xl bg-gradient-to-r from-amber-300 via-orange-400 to-pink-400 text-slate-900 font-display font-black text-2xl shadow-2xl shadow-orange-500/40 border-4 border-amber-200 hover:scale-[1.02] active:scale-95 transition-transform"
            >
              ▶ 开始战斗
            </button>
          </div>

          {/* 右列 — 红旗 / 工坊 / 成就 */}
          <div className="space-y-3 overflow-hidden">
            {/* 红旗 skill (反复错题) */}
            {fragileSkills.length > 0 && (
              <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-700/60 to-pink-700/40 border border-rose-400/40">
                <div className="text-[11px] text-rose-200 uppercase tracking-widest mb-1">🚩 反复出错</div>
                {fragileSkills.slice(0, 2).map((s) => (
                  <div key={s.skillId} className="text-xs text-rose-100 truncate mb-0.5">• {s.skillName}</div>
                ))}
                <Link to="/math/mistakes" className="text-[11px] text-rose-200 underline">→ 找小进讲</Link>
              </div>
            )}

            <div className="font-display font-bold text-amber-300 text-sm uppercase tracking-widest pt-2">✨ 更多</div>

            <Link to="/math/exam-prep" className="block p-3 rounded-2xl bg-gradient-to-br from-cyan-600 to-sky-700 border border-cyan-300/40 hover:scale-[1.02] transition">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📝</span>
                <div className="flex-1">
                  <div className="font-display font-bold text-white text-sm">期末备考中心</div>
                  <div className="text-[10px] text-cyan-100/80">30 / 60 / 80 题模拟卷</div>
                </div>
              </div>
            </Link>

            <Link to="/math/atelier" className="block p-3 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-700 border border-violet-300/40 hover:scale-[1.02] transition">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎨</span>
                <div className="flex-1">
                  <div className="font-display font-bold text-white text-sm">小进工坊</div>
                  <div className="text-[10px] text-violet-100/80">沙箱探险</div>
                </div>
              </div>
            </Link>

            <Link to="/math/skills" className="block p-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 border border-emerald-300/40 hover:scale-[1.02] transition">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                <div className="flex-1">
                  <div className="font-display font-bold text-white text-sm">技能图</div>
                  <div className="text-[10px] text-emerald-100/80">51 个 skill 雷达</div>
                </div>
              </div>
            </Link>

            <Link to="/math/world-preview" className="block p-3 rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 border border-amber-300/40 hover:scale-[1.02] transition">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🗺️</span>
                <div className="flex-1">
                  <div className="font-display font-bold text-white text-sm">数学世界地图</div>
                  <div className="text-[10px] text-amber-100/80">看进度</div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* ─── 底部 prototype 评审 tag ─── */}
        <div className="text-center text-[10px] text-violet-300/40 pt-2 shrink-0">
          Hub v4 prototype (大屏 grid + 信息密度) ·{" "}
          <Link className="underline" to="/math">老首页</Link> ·{" "}
          <Link className="underline" to="/math/hub-v3">v3</Link> ·{" "}
          <Link className="underline" to="/math/celebration-preview">🎉</Link> ·{" "}
          <Link className="underline" to="/math/streak-preview">🔥</Link>
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
