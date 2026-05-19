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
import { tierFromScore, TIERS } from "../core/tiers";
import { getTotalXp, getFragileSkillsToReview, computeCurrentRating } from "../db/service";
import { levelFromXp } from "../core/scoring";
import { TrainRoute } from "../lib/routes";
import { currentExam, daysUntil } from "../core/examDates";
import { computeAbilityDiagnostic, type AbilityDiagnostic, type RatingResult } from "../core/rating";
import { TierCharacter } from "../components/TierCharacter";

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
  // v5.3: 真数据接通 — rating + ability
  const [rating, setRating] = useState<RatingResult | null>(null);
  const [abilityReal, setAbilityReal] = useState<AbilityDiagnostic | null>(null);

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
      // v5.3: 真 rating + ability (接通 computeCurrentRating + computeAbilityDiagnostic)
      try {
        const r = await computeCurrentRating(s.id, "下册");
        if (!cancelled) setRating(r);
        const attempts = await db.attempts.where({ studentId: s.id }).toArray();
        const mastery = await db.mastery.where({ studentId: s.id }).toArray();
        const ab = computeAbilityDiagnostic(attempts, mastery, "下册");
        if (!cancelled) setAbilityReal(ab);
      } catch (e) {
        // prototype fallback OK
        console.warn("[hub-v5] rating/ability compute failed (mock fallback)", e);
      }
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

  // v5.5: dev tier-preview override (?tier=country in URL switches tier 让 Bruce 评审)
  const urlOverrideTier = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tier") : null;
  const overrideTier = urlOverrideTier ? TIERS.find((t) => t.id === urlOverrideTier) : null;
  const tier = overrideTier ?? tierFromScore(xp);
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

  // v5.3: 真 ability 数据 (fallback to mock 若用户无 attempt 历史)
  const ability = abilityReal && abilityReal.raw.totalAttempts > 0
    ? {
        // raw component / max (per rating.ts: accuracy 250, mastery 400, continuity 200, volume 150)
        accuracy: Math.min(1, abilityReal.components.accuracy / 250),
        mastery: Math.min(1, abilityReal.components.mastery / 400),
        continuity: Math.min(1, abilityReal.components.continuity / 200),
        volume: Math.min(1, abilityReal.components.volume / 150),
      }
    : {
        // mock fallback (新用户尚无数据)
        accuracy: 0.78,
        mastery: 0.62,
        continuity: streak >= 7 ? 0.9 : streak / 7,
        volume: 0.5,
      };
  const abilityScoreTotal = abilityReal && abilityReal.raw.totalAttempts > 0
    ? abilityReal.score
    : Math.round((ability.accuracy + ability.mastery + ability.continuity + ability.volume) * 250);

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

      {/* ─── 左 Mission Panel (v5.3 — 接通真 rating + 段位 sub-rank ornament + 动词化) ─── */}
      <aside className="hidden md:flex absolute left-[2%] top-1/2 -translate-y-1/2 z-10 w-[clamp(200px,20vw,260px)] flex-col gap-3 pointer-events-auto">
        <div className="rounded-3xl bg-black/40 backdrop-blur-md border border-white/15 shadow-2xl overflow-hidden">
          {/* 段位 section (v5.4 character growth Phase 1 — 立绘 portrait 替换 emoji 圆) */}
          <div className="relative px-4 py-3 bg-gradient-to-br from-amber-500/20 to-orange-600/10 border-b border-white/10">
            <div
              className="absolute -top-4 -right-4 w-20 h-20 rounded-full blur-xl opacity-50 pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(252,211,77,0.6), transparent 65%)" }}
            />
            <div className="flex items-start gap-3">
              {/* v5.4: TierCharacter 立绘 (220x280 portrait, fallback to emoji 圆) */}
              <TierCharacter
                tier={tier}
                subRank={rating?.subRank ?? 1}
                subRankRoman={rating?.subRankRoman ?? "I"}
                size="md"
              />
              <div className="min-w-0 flex-1 pt-1">
                <div className="text-[10px] text-amber-200 uppercase tracking-widest leading-none mb-0.5">段位 {rating?.subRankRoman ?? ""}</div>
                <div className="font-display font-bold text-amber-100 text-sm leading-tight truncate">{tier.name}</div>
                {rating?.subTierLabel && (
                  <div className="text-[10px] text-amber-100/80 leading-tight truncate">{rating.subTierLabel}</div>
                )}
                <div className="h-1.5 mt-1.5 rounded-full bg-black/40 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-400 to-amber-300 transition-all duration-700" style={{ width: `${tierProgress}%` }} />
                </div>
                <div className="text-[10px] text-amber-100/70 tabular-nums leading-none mt-0.5">{Math.round(tierProgress)}%</div>
              </div>
            </div>
          </div>

          {/* 反复出错 → 待救援 (v5.3 动词化) */}
          {fragileSkills.length > 0 && (
            <Link to="/math/mistakes" className="block px-4 py-2.5 hover:bg-rose-500/10 active:bg-rose-500/20 transition border-b border-white/10">
              <div className="text-[10px] text-rose-300 uppercase tracking-widest mb-1">🚩 待救援知识 ({fragileSkills.length})</div>
              {fragileSkills.slice(0, 2).map((s) => (
                <div key={s.skillId} className="text-xs text-rose-100 truncate leading-tight mb-0.5">• {s.skillName}</div>
              ))}
              <div className="text-[10px] text-rose-300/70 mt-0.5">→ 去支援</div>
            </Link>
          )}

          {/* 期末挑战 → BOSS 来袭 (v5.3 动词化) */}
          {exam && examDays !== null && examDays >= 0 && (
            <Link to="/math/exam-prep" className="block px-4 py-2.5 hover:bg-violet-500/10 active:bg-violet-500/20 transition">
              <div className="text-[10px] text-violet-300 uppercase tracking-widest mb-0.5">⚔️ {exam.name} BOSS</div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display font-black text-xl text-violet-100 leading-none tabular-nums">
                  {examDays === 0 ? "今天!" : `${examDays}`}
                </span>
                {examDays > 0 && <span className="text-[11px] text-violet-200">天后来袭</span>}
              </div>
              <div className="text-[10px] text-violet-200/80 leading-tight mt-0.5">今天通关 1 关 → 备战 +1</div>
            </Link>
          )}
        </div>

        {/* connector — 视觉关联到中央 ring */}
        <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-3 h-px bg-gradient-to-r from-amber-300/40 to-transparent pointer-events-none" />
      </aside>

      {/* ─── 右 Stats Panel — 能力诊断 4 维 + 总分 (peer P1) ─── */}
      <aside className="hidden md:flex absolute right-[2%] top-1/2 -translate-y-1/2 z-10 w-[clamp(200px,20vw,260px)] flex-col gap-3 pointer-events-auto">
        <div className="rounded-3xl bg-black/40 backdrop-blur-md border border-white/15 shadow-2xl overflow-hidden">
          {/* 总分 header (v5.3 真数据) */}
          <div className="relative px-4 py-3 bg-gradient-to-br from-violet-500/20 to-cyan-600/10 border-b border-white/10">
            <div className="text-[10px] text-violet-200 uppercase tracking-widest mb-0.5">⚡ 能力诊断</div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-black text-2xl text-violet-100 tabular-nums leading-none">
                {abilityScoreTotal}
              </span>
              <span className="text-[10px] text-violet-200/70">/ 1000</span>
            </div>
            <div className="text-[10px] text-violet-200/60 mt-0.5">
              {abilityReal && abilityReal.raw.totalAttempts > 0
                ? `本学期 · 共 ${abilityReal.raw.totalAttempts} 题`
                : "本学期 · 等首次答题"}
            </div>
          </div>

          {/* 4 维 bar */}
          <div className="px-4 py-3 space-y-2">
            {[
              { label: "准确", value: ability.accuracy, color: "#22d3ee", desc: "近 7 天准确率" },
              { label: "熟练", value: ability.mastery, color: "#a78bfa", desc: "skill 平均熟练" },
              { label: "坚持", value: ability.continuity, color: "#f97316", desc: "连续 + 累计天" },
              { label: "广度", value: ability.volume, color: "#10b981", desc: "skill 覆盖" },
            ].map((a) => (
              <div key={a.label}>
                <div className="flex justify-between items-baseline text-[11px] mb-0.5">
                  <span className="text-slate-200 font-bold">{a.label}</span>
                  <span className="text-slate-400 tabular-nums">{Math.round(a.value * 100)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                  <div
                    className="h-full transition-all duration-700"
                    style={{ width: `${a.value * 100}%`, background: a.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* connector */}
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-3 h-px bg-gradient-to-l from-violet-300/40 to-transparent pointer-events-none" />
      </aside>

      {/* ─── Mobile focus card (替代 2 浮件 panel 在 < md) ─── */}
      <div className="md:hidden absolute top-[10%] left-1/2 -translate-x-1/2 z-10 w-[min(92vw,360px)] pointer-events-auto">
        <div className="rounded-2xl bg-black/40 backdrop-blur-md border border-white/15 shadow-lg px-4 py-2.5">
          <div className="flex items-center gap-3">
            {/* 段位徽章 mini */}
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0 border-2 border-amber-300 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500">
              {tier.badgeIcon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-amber-200 uppercase tracking-widest leading-none">{tier.name}</div>
              <div className="h-1 mt-1 rounded-full bg-black/40 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-400 to-amber-300" style={{ width: `${tierProgress}%` }} />
              </div>
              <div className="text-[10px] text-violet-200 mt-1 truncate">
                {exam && examDays !== null && examDays >= 0
                  ? `⏳ ${exam.name} ${examDays} 天 · 今天赢 1 ⭐`
                  : "⚡ 准备好开始"}
              </div>
            </div>
          </div>
        </div>
      </div>

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

      {/* ─── 评审 footer (左下角小 ghost) + tier-preview switcher (Bruce 用) ─── */}
      <div className="fixed bottom-1 left-2 text-[9px] text-violet-300/40 z-40 pointer-events-auto flex items-center gap-2 flex-wrap">
        <span className="opacity-50">v5.5 ·</span>
        <Link className="underline" to="/math">老</Link>
        <span className="opacity-30">|</span>
        <span className="opacity-60">立绘:</span>
        {TIERS.map((t) => (
          <Link
            key={t.id}
            to={`/math/hub-v5?tier=${t.id}`}
            className={`px-1 rounded hover:bg-white/10 ${tier.id === t.id ? "text-amber-300 font-bold" : ""}`}
          >
            {t.badgeIcon}
          </Link>
        ))}
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
