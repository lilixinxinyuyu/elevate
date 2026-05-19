/**
 * v0.35.79 — Hub Screen v5 (Bruce 反馈 v4 "整体感太弱, 老 3环段位能力诊断扔了")
 *
 * v4 失败点:
 * - 左中右 3 列 hard 分块, 视觉切割
 * - 丢掉了 TodayRings 同心 3 环 (Selena 最有反馈的元素)
 * - 丢掉了段位徽章大圆 (升级 sub-rank 的成就感)
 * - 丢掉了能力诊断 4 维 bar (家长 + Selena 都看)
 *
 * v5 设计哲学:
 * - ONE 大 hero scene (不是 3 列, 不是卡片堆)
 * - 中央 SVG composition: 大 3 同心环 + Mascot 🐼+🦊 在环正中央
 * - 浮在 hero 之上 4 个 HUD 微件 (不分块, 飘): tier badge 左上, streak 右上,
 *   ability radar 左下, exam countdown 右下
 * - 唯一巨大 PLAY 按钮 sticky bottom-center
 * - 统一装饰: gradient + 60 constellation + 4 soft blob at corners
 *   (整体光晕 → 像剧场聚光灯)
 *
 * Bruce 原话: "原来的一些好设计 (3 环 / 段位徽章 / 能力诊断 bar)
 *  好像你把它全部都扔掉了" → v5 全数捡回
 *
 * 入口: `/math/hub-v5`. 与 v3/v4/老首页并存对比.
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

export function HubScreenV5Page() {
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

  const attemptsToday = useLiveQuery(async () => {
    if (!studentId) return 0;
    return await db.attempts
      .where({ studentId })
      .filter((a) => (a.createdAt ?? 0) > Date.now() - 86400000)
      .count();
  }, [studentId]) ?? 0;

  const tier = tierFromScore(xp);
  const tierProgress = Math.min(100, Math.max(0, ((xp - tier.range[0]) / (tier.range[1] - tier.range[0])) * 100));
  const level = levelFromXp(xp);

  // 3 环 progress (简化版, 给 v5 prototype 用)
  // 真接通版会用 buildTodayRingsInput; 这里 prototype 直接算
  const ringChallenge = Math.min(1, todayCount / Math.max(1, todayTarget));
  const ringFluency = 0.4; // mock: 平时这里读 fluencyTodayCount + tricks
  const ringFocus = fragileSkills.length > 0 ? 0.3 : 0.7; // mock: 错题环

  // 期末倒计时
  const exam = currentExam(new Date());
  const examDays = exam ? daysUntil(exam.date, new Date()) : null;

  // 能力诊断 4 维 (mock, prototype 用; 真版 hooks computeAbilityDiagnostic)
  const ability = {
    accuracy: 0.78,
    mastery: 0.62,
    continuity: streak >= 7 ? 0.9 : streak / 7,
    volume: 0.5,
  };

  // SVG 3-ring constants — viewBox 固定 320, 用 CSS clamp() 缩放
  // (peer review v0.35.79 反馈: 写死 320 在 4K 偏小, 在 375 偏大)
  const ringSize = 320;
  const cx = ringSize / 2;
  const cy = ringSize / 2;
  const stroke = 22;
  const gap = 6;
  const radii = [
    cx - stroke / 2 - 6,
    cx - stroke - gap - stroke / 2 - 6,
    cx - 2 * (stroke + gap) - stroke / 2 - 6,
  ];
  const rings = [
    { id: "fluency", progress: ringFluency, hue: "#22d3ee", hue2: "#0891b2" }, // 外 cyan 基本功
    { id: "challenge", progress: ringChallenge, hue: "#a78bfa", hue2: "#7c3aed" }, // 中 violet 今日挑战
    { id: "focus", progress: ringFocus, hue: "#fcd34d", hue2: "#d97706" }, // 内 amber 焦点
  ];
  const closedCount = rings.filter((r) => r.progress >= 0.99).length;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden text-white"
      style={{
        height: "100dvh",
        background: "radial-gradient(ellipse at top, #1e1b4b 0%, #0f0d2e 60%, #050315 100%)",
      }}
    >
      {/* 4 角 soft blob — 整体光晕 (剧场聚光) */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-violet-600/30 blur-[120px] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-fuchsia-500/25 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-indigo-500/25 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full bg-amber-500/15 blur-[140px] pointer-events-none" />

      {/* 星空 + sparkle */}
      <svg className="absolute inset-0 w-full h-full opacity-40 pointer-events-none">
        {[...Array(100)].map((_, i) => {
          const x = (i * 41) % 100;
          const y = (i * 67) % 100;
          const r = (i % 3) * 0.5 + 0.5;
          const op = ((i * 13) % 100) / 100 * 0.6 + 0.2;
          return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="white" opacity={op} />;
        })}
        {/* 几颗大 sparkle 装饰 */}
        {[...Array(8)].map((_, i) => {
          const x = (i * 173) % 100;
          const y = (i * 251) % 90 + 5;
          return (
            <g key={`s${i}`} className="animate-twinkle" style={{ animationDelay: `${i * 0.7}s` } as React.CSSProperties}>
              <circle cx={`${x}%`} cy={`${y}%`} r={2.5} fill="#fcd34d" opacity={0.8} />
            </g>
          );
        })}
      </svg>

      {/* ─── 顶部 HUD: 透明浮于 hero 之上, 不分块 ─── */}
      <div className="absolute top-3 left-0 right-0 px-4 z-20 flex items-center gap-2">
        {/* 左: profile */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-400 to-pink-500 flex items-center justify-center text-lg">🐼</div>
          <div className="min-w-0">
            <div className="font-display font-bold text-sm leading-tight truncate">{studentName}</div>
            <div className="text-[10px] text-violet-200 leading-tight truncate">Lv {level} · {xp.toLocaleString()} XP</div>
          </div>
        </div>

        <div className="flex-1" />

        {/* 右: streak + tokens + today */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-2xl bg-orange-500/20 backdrop-blur-md border border-orange-300/40 shadow-lg">
            <span className="text-base">🔥</span>
            <span className="font-display font-bold text-sm tabular-nums">{streak}</span>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-2xl bg-yellow-500/20 backdrop-blur-md border border-yellow-300/40 shadow-lg">
            <span className="text-base">🎫</span>
            <span className="font-display font-bold text-sm tabular-nums">{freezeTokens}<span className="text-[10px] opacity-60">/{FREEZE_MAX_TOKENS}</span></span>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-2xl bg-emerald-500/20 backdrop-blur-md border border-emerald-300/40 shadow-lg">
            <span className="text-base">⭐</span>
            <span className="font-display font-bold text-sm tabular-nums">{attemptsToday}</span>
          </div>
        </div>
      </div>

      {/* ─── Scene Container (peer review: max-w + clamp 避免 4K 散 / 375 挤) ─── */}
      <main className="absolute inset-x-0 top-[56px] bottom-[112px] flex items-center justify-center px-4 pointer-events-none">
        <section className="relative w-full h-full max-w-[1180px] max-h-[720px] min-h-[480px]">

      {/* ─── 中央 hero stage: 3 同心环 + Mascot (clamp 缩放) ─── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="relative w-[min(78vw,320px)] sm:w-[clamp(260px,38vmin,400px)] aspect-square overflow-visible"
        >
          {/* 大圆 SVG: 3 同心环 — viewBox 固定, 渲染尺寸 = 父 div 100% */}
          <svg viewBox={`0 0 ${ringSize} ${ringSize}`} width="100%" height="100%" className="absolute inset-0">
            <defs>
              {rings.map((r) => (
                <linearGradient key={r.id} id={`hub5-ring-${r.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={r.hue} />
                  <stop offset="100%" stopColor={r.hue2} />
                </linearGradient>
              ))}
              <radialGradient id="hub5-stage-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.25" />
                <stop offset="60%" stopColor="#a78bfa" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#000" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* 中心 stage 光晕 */}
            <circle cx={cx} cy={cy} r={(radii[2] ?? 50) - 10} fill="url(#hub5-stage-glow)" />
            {rings.map((r, i) => {
              const radius = radii[i] ?? 50;
              const c = 2 * Math.PI * radius;
              const offset = c * (1 - Math.max(0.05, r.progress));
              const done = r.progress >= 0.99;
              return (
                <g key={r.id}>
                  {/* 底环 */}
                  <circle cx={cx} cy={cy} r={radius} fill="none" stroke={r.hue} strokeOpacity={0.18} strokeWidth={stroke} />
                  {/* 进度弧 */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke={`url(#hub5-ring-${r.id})`}
                    strokeWidth={stroke}
                    strokeLinecap={r.progress >= 0.5 ? "round" : "butt"}
                    strokeDasharray={c}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${cx} ${cy})`}
                    className="transition-[stroke-dashoffset] duration-700"
                    opacity={done ? 0.95 : 1}
                  />
                </g>
              );
            })}
          </svg>

          {/* 中央 Mascot pair — overflow-visible 让 fox 可溢出, 不被 ring 下沿 clip
              (peer review: items-end 导致角色脚部撞底; 改 absolute + translate-y 居中略偏下) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[38%] flex items-end gap-1 pointer-events-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.4)]">
            <div className="text-[clamp(68px,11vmin,128px)] leading-none animate-float">🐼</div>
            <div className="text-[clamp(40px,7vmin,80px)] leading-none animate-float-slow mb-2">🦊</div>
          </div>

          {/* 环上 N/3 闭标 */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-amber-300/40 z-10">
            <span className="font-display font-bold text-amber-300 text-sm tabular-nums">{closedCount} / 3 环已闭</span>
          </div>
        </div>
      </div>

      {/* ─── 左上 浮件: 段位徽章 (大金圆) — scene-relative % offset ─── */}
      <div className="absolute left-[3%] top-[4%] z-10 max-w-[200px] pointer-events-auto">
        <div className="relative">
          {/* badge 光环 */}
          <div
            className="absolute inset-0 -m-3 rounded-full blur-2xl opacity-50"
            style={{ background: "radial-gradient(circle, rgba(252,211,77,0.6), transparent 65%)" }}
          />
          <div
            className="relative w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-2xl border-4 border-amber-300 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500"
            style={{
              boxShadow: "0 0 40px rgba(252,211,77,0.5), inset 0 2px 8px rgba(255,255,255,0.3)",
            }}
          >
            {tier.badgeIcon}
          </div>
        </div>
        <div className="mt-2 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-amber-300/30">
          <div className="font-display font-bold text-amber-200 text-xs leading-tight">{tier.name}</div>
          <div className="h-1 mt-1 rounded-full bg-black/40 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-400 to-amber-300" style={{ width: `${tierProgress}%` }} />
          </div>
          <div className="text-[10px] text-amber-100/70 tabular-nums mt-0.5">{Math.round(tierProgress)}%</div>
        </div>
      </div>

      {/* ─── 右上 浮件: 能力诊断 4 mini-bar ─── */}
      <div className="absolute right-[3%] top-[4%] z-10 w-[clamp(160px,18vw,220px)] pointer-events-auto">
        <div className="px-3 py-2.5 rounded-2xl bg-black/40 backdrop-blur-md border border-violet-300/30 shadow-lg">
          <div className="text-[10px] text-violet-200 uppercase tracking-widest mb-2">⚡ 能力诊断</div>
          {[
            { label: "准确", value: ability.accuracy, color: "#22d3ee" },
            { label: "熟练", value: ability.mastery, color: "#a78bfa" },
            { label: "坚持", value: ability.continuity, color: "#f97316" },
            { label: "广度", value: ability.volume, color: "#10b981" },
          ].map((a) => (
            <div key={a.label} className="mb-1.5 last:mb-0">
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-slate-200">{a.label}</span>
                <span className="text-slate-300 tabular-nums">{Math.round(a.value * 100)}</span>
              </div>
              <div className="h-1 rounded-full bg-black/40 overflow-hidden">
                <div
                  className="h-full transition-all duration-700"
                  style={{ width: `${a.value * 100}%`, background: a.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 左下 浮件: 反复出错 (red flag) — mobile hidden 防挤 (peer review) ─── */}
      {fragileSkills.length > 0 && (
        <div className="hidden md:block absolute bottom-[6%] left-[3%] z-10 w-[clamp(180px,18vw,240px)] pointer-events-auto">
          <Link to="/math/mistakes" className="block px-3 py-2 rounded-2xl bg-rose-500/15 backdrop-blur-md border border-rose-300/40 shadow-lg hover:scale-105 active:scale-95 transition">
            <div className="text-[10px] text-rose-200 uppercase tracking-widest mb-1">🚩 反复出错</div>
            {fragileSkills.slice(0, 2).map((s) => (
              <div key={s.skillId} className="text-xs text-rose-100 truncate leading-tight mb-0.5">• {s.skillName}</div>
            ))}
            <div className="text-[10px] text-rose-200/70 mt-1 underline">→ 找小进讲</div>
          </Link>
        </div>
      )}

      {/* ─── 右下 浮件: 期末倒计时 — mobile hidden + 文案改可行动 (peer review) ─── */}
      {exam && examDays !== null && examDays >= 0 && (
        <div className="hidden md:block absolute bottom-[6%] right-[3%] z-10 w-[clamp(150px,15vw,200px)] pointer-events-auto">
          <Link to="/math/exam-prep" className="block px-3 py-2 rounded-2xl bg-violet-700/25 backdrop-blur-md border border-violet-300/40 shadow-lg hover:scale-105 active:scale-95 transition">
            <div className="text-[10px] text-violet-200 uppercase tracking-widest mb-1">⏳ {exam.name}挑战</div>
            <div className="font-display font-black text-2xl text-violet-100 leading-none tabular-nums">
              {examDays === 0 ? "今天!" : `${examDays} 天`}
            </div>
            <div className="text-[10px] text-violet-200/80 mt-1 leading-tight">今天赢 1 ⭐ 就近一步</div>
          </Link>
        </div>
      )}

        </section>
      </main>

      {/* ─── 底部 action bar: PLAY + chips (peer review: 整体一个 action bar 而非分别 absolute) ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pb-[max(8px,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-[#050315] via-[#050315]/85 to-transparent pointer-events-none">
        {/* PLAY 加任务化副标题 (peer review: 单 "PLAY" 太抽象, 改主+副) */}
        <div className="flex justify-center mb-2 px-4">
          <button
            onClick={() => navigate(TrainRoute.build({ fresh: Date.now() }))}
            className="pointer-events-auto px-8 sm:px-10 py-3 rounded-3xl bg-gradient-to-r from-amber-300 via-orange-400 to-pink-400 text-slate-900 font-display font-black shadow-2xl shadow-orange-500/60 border-4 border-amber-200 hover:scale-105 active:scale-95 transition-transform animate-pulse-glow flex items-center gap-3"
          >
            <span className="text-3xl">▶</span>
            <span className="text-left leading-tight">
              <span className="block text-xl sm:text-2xl">开始今日挑战</span>
              <span className="block text-[10px] sm:text-xs font-bold opacity-80">
                {todayCount < todayTarget ? `还差 ${todayTarget - todayCount} 题 · 赢 ⭐` : `今日已达标 · 加练得 ⭐`}
              </span>
            </span>
          </button>
        </div>

        {/* chip 横向 scroll on mobile (peer review: justify-center 在 375 挤爆) */}
        <div className="overflow-x-auto px-4 pb-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] pointer-events-auto">
          <div className="mx-auto flex w-max gap-2 justify-center">
            <ChipLink to="/math/fluency" emoji="⚡" label="闪电口算" color="cyan" />
            <ChipLink to="/math/mistakes" emoji="⚔️" label="错题营" color="rose" />
            <ChipLink to="/math/exam-prep" emoji="📝" label="模拟卷" color="violet" />
            <ChipLink to="/math/skills" emoji="🏆" label="技能图" color="amber" />
            <ChipLink to="/math/atelier" emoji="🎨" label="工坊" color="fuchsia" />
          </div>
        </div>
      </div>

      {/* ─── 评审 footer (左下角小 ghost, 不挡视觉中心) ─── */}
      <div className="fixed bottom-1 left-2 text-[9px] text-violet-300/30 z-40 pointer-events-auto">
        v5.1 · <Link className="underline" to="/math">老</Link>·<Link className="underline" to="/math/hub-v3">v3</Link>·<Link className="underline" to="/math/hub-v4">v4</Link>
      </div>

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 40px rgba(251,146,60,0.5), 0 0 80px rgba(251,146,60,0.2); }
          50% { box-shadow: 0 0 60px rgba(251,146,60,0.7), 0 0 120px rgba(251,146,60,0.35); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
        .animate-twinkle { animation: twinkle 2s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulse-glow 2.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function ChipLink({ to, emoji, label, color }: { to: string; emoji: string; label: string; color: "cyan" | "rose" | "violet" | "amber" | "fuchsia" }) {
  const ringClass = {
    cyan: "border-cyan-300/40 bg-cyan-500/15",
    rose: "border-rose-300/40 bg-rose-500/15",
    violet: "border-violet-300/40 bg-violet-500/15",
    amber: "border-amber-300/40 bg-amber-500/15",
    fuchsia: "border-fuchsia-300/40 bg-fuchsia-500/15",
  }[color];
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl backdrop-blur-md border ${ringClass} shadow-lg hover:scale-105 active:scale-95 transition-transform`}
    >
      <span className="text-lg">{emoji}</span>
      <span className="text-xs font-bold text-white whitespace-nowrap">{label}</span>
    </Link>
  );
}
