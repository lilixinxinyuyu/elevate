/**
 * Phase B — Hub Screen v6 (character-led math lobby).
 *
 * 设计目标 (peer-reviewed plan):
 * - 角色立绘当主角 (centerpiece), 不再是头像角标 → <TierCharacter size="xl" />
 * - 段位 chevron 浮在角色头顶 (tier name + roman + badge)
 * - 顶部 HUD 一行: 🐼 name · Lv · XP
 * - 巨大不可错过的 "开始今日挑战" CTA (1-tap, sticky bottom-center)
 * - MOBILE PORTRAIT PRIMARY (~390px): Z-stack / 分层, 不左中右并排
 *
 * 当前 = Step 1 + Step 2 only. 后续 step 的占位 TODO 已标注:
 *   - rings-as-halo (step 3)
 *   - mission stack (step 4)
 *   - stats bottom bar + sidekick mascot (step 5)
 *
 * 入口: `/math/hub-v6`. Flag isHubV6Default OFF-by-default (live 首页不变).
 * Step 6 (later) 才 wire into HomeRoute.
 *
 * 数据加载块 + onboarding gating 复用自 HubScreenV5 (保持行为一致).
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../db/dexie";
import { loadDaily } from "../lib/dailyTarget";
import { getTotalXp, computeCurrentRating, getFragileSkillsToReview } from "../db/service";
import { levelFromXp } from "../core/scoring";
import { TrainRoute } from "../lib/routes";
import { currentExam, daysUntil } from "../core/examDates";
import { computeAbilityDiagnostic, type AbilityDiagnostic, type RatingResult } from "../core/rating";
import { TIERS } from "../core/tiers";
import { TierCharacter } from "../components/TierCharacter";
import { CharacterOnboardingModal } from "../components/CharacterOnboardingModal";
import { getCharacterChoice, type CharacterChoice } from "../lib/characterChoice";

// Fallback tier 给 TierCharacter (rating 加载前 / compute 失败时). school 段第一档.
// TIERS 静态非空, 故 [0] 必有值.
const FALLBACK_TIER = TIERS[0]!;

export function HubScreenV6Page() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("Selena");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [todayTarget, setTodayTarget] = useState(10);
  const [fragileSkills, setFragileSkills] = useState<{ skillId: string; skillName: string }[]>([]);
  // 真 rating (段位 chevron 用) + ability diagnostic (stats bar 用)
  const [rating, setRating] = useState<RatingResult | null>(null);
  const [abilityReal, setAbilityReal] = useState<AbilityDiagnostic | null>(null);
  // character choice (archetype + gender) — onboarding modal 决定
  const [characterChoice, setCharacterChoice] = useState<CharacterChoice | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // ── 数据加载 (复用 HubV5 load pattern: students → totalXp / daily / choice / rating) ──
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
      setTodayCount(daily.todayCount);
      setTodayTarget(daily.target ?? 10);
      const fragile = await getFragileSkillsToReview(s.id);
      if (!cancelled) setFragileSkills(fragile.slice(0, 3).map((f) => ({ skillId: f.skillId, skillName: f.skillName })));
      // character choice (onboarding 之后) — 没 choice → 自动弹 modal
      const choice = await getCharacterChoice(s.id);
      if (!cancelled) {
        setCharacterChoice(choice);
        setOnboardingChecked(true);
        if (!choice) setShowOnboarding(true);
      }
      // 真 rating + ability (computeCurrentRating + computeAbilityDiagnostic, 下册赛季)
      try {
        const r = await computeCurrentRating(s.id, "下册");
        if (!cancelled) setRating(r);
        const attempts = await db.attempts.where({ studentId: s.id }).toArray();
        const mastery = await db.mastery.where({ studentId: s.id }).toArray();
        const ab = computeAbilityDiagnostic(attempts, mastery, "下册");
        if (!cancelled) setAbilityReal(ab);
      } catch (e) {
        // prototype fallback OK
        console.warn("[hub-v6] rating/ability compute failed (fallback)", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const level = levelFromXp(xp);
  const remaining = Math.max(0, todayTarget - todayCount);

  // 段位 chevron 字段 (computeCurrentRating → RatingResult)
  const tier = rating?.tier ?? null;
  const tierName = tier?.name ?? "和平街小学";
  const tierBadge = tier?.badgeIcon ?? "🏫";
  const subRankRoman = rating?.subRankRoman ?? "I";
  const subRank = rating?.subRank ?? 1;
  const subTierLabel = rating?.subTierLabel ?? "";

  // ── Step 3: 3-ring halo progress (复用 HubV5 算法 + 颜色/标签) ──
  const ringChallenge = Math.min(1, todayCount / Math.max(1, todayTarget));
  const ringFluency = 0.4; // mock: 平时这里读 fluencyTodayCount + tricks
  const ringFocus = fragileSkills.length > 0 ? 0.3 : 0.7; // mock: 错题环
  // 内→外: focus(amber) / challenge(violet) / fluency(cyan) — 与 HubV5 hue 一致
  const rings = [
    { id: "fluency", label: "口算", progress: ringFluency, hue: "#22d3ee", hue2: "#0891b2" },
    { id: "challenge", label: "挑战", progress: ringChallenge, hue: "#a78bfa", hue2: "#7c3aed" },
    { id: "focus", label: "专注", progress: ringFocus, hue: "#fcd34d", hue2: "#d97706" },
  ];
  const closedCount = rings.filter((r) => r.progress >= 0.99).length;
  // 扁平 halo SVG 常量 (固定 viewBox, 渲染随父 div 缩放 — flat, NOT 旋转地板)
  const haloSize = 320;
  const haloC = haloSize / 2;
  const haloStroke = 14;
  const haloGap = 7;
  const haloRadii = [
    haloC - haloStroke / 2 - 4,
    haloC - haloStroke - haloGap - haloStroke / 2 - 4,
    haloC - 2 * (haloStroke + haloGap) - haloStroke / 2 - 4,
  ];

  // ── Step 4: 期末 BOSS 倒计时 (currentExam 恒非空) ──
  const exam = currentExam(new Date());
  const examDays = daysUntil(exam.date, new Date());

  // ── Step 5: 能力诊断 4 维 + 总分 (真数据, fallback to mock 若无 attempt) ──
  const ability = abilityReal && abilityReal.raw.totalAttempts > 0
    ? {
        accuracy: Math.min(1, abilityReal.components.accuracy / 250),
        mastery: Math.min(1, abilityReal.components.mastery / 400),
        continuity: Math.min(1, abilityReal.components.continuity / 200),
        volume: Math.min(1, abilityReal.components.volume / 150),
      }
    : {
        accuracy: 0.78,
        mastery: 0.62,
        continuity: streak >= 7 ? 0.9 : streak / 7,
        volume: 0.5,
      };
  const abilityScoreTotal = abilityReal && abilityReal.raw.totalAttempts > 0
    ? abilityReal.score
    : Math.round((ability.accuracy + ability.mastery + ability.continuity + ability.volume) * 250);
  const statVals = [
    { label: "准确", value: ability.accuracy, color: "#22d3ee" },
    { label: "熟练", value: ability.mastery, color: "#a78bfa" },
    { label: "坚持", value: ability.continuity, color: "#f97316" },
    { label: "广度", value: ability.volume, color: "#10b981" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden text-white"
      style={{
        height: "100dvh",
        background: "radial-gradient(ellipse at top, #1e1b4b 0%, #0f0d2e 60%, #050315 100%)",
      }}
    >
      {/* 4 角 soft blob — 整体光晕 (剧场聚光灯, 与 HubV5 vibe 一致) */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-violet-600/30 blur-[120px] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-fuchsia-500/25 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-indigo-500/25 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full bg-amber-500/15 blur-[140px] pointer-events-none" />

      {/* 星空 */}
      <svg className="absolute inset-0 w-full h-full opacity-40 pointer-events-none">
        {[...Array(80)].map((_, i) => {
          const x = (i * 41) % 100;
          const y = (i * 67) % 100;
          const r = (i % 3) * 0.5 + 0.5;
          const op = ((i * 13) % 100) / 100 * 0.6 + 0.2;
          return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="white" opacity={op} />;
        })}
      </svg>

      {/* ─── 顶部 HUD 一行: 🐼 name · Lv · XP  +  N/3 环 summary (Step 3) ─── */}
      <div className="absolute top-3 left-0 right-0 px-4 z-20 flex justify-center items-center gap-2 pointer-events-none">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg pointer-events-auto">
          <span className="text-lg leading-none">🐼</span>
          <span className="font-display font-bold text-sm leading-none truncate max-w-[34vw]">{studentName}</span>
          <span className="text-white/40">·</span>
          <span className="text-[12px] text-violet-200 leading-none">Lv {level}</span>
          <span className="text-white/40">·</span>
          <span className="text-[12px] text-amber-200 leading-none tabular-nums">{xp.toLocaleString()} XP</span>
        </div>
        {/* N/3 环 summary chip (与中央 halo 呼应) */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-black/40 backdrop-blur-md border border-amber-300/40 shadow-lg pointer-events-auto shrink-0">
          <span className="text-base leading-none">◎</span>
          <span className="font-display font-bold text-amber-200 text-[12px] leading-none tabular-nums">{closedCount}/3 环</span>
        </div>
      </div>

      {/* ─── 中央 stage: 角色立绘 centerpiece + 头顶段位 chevron ───
          MOBILE PORTRAIT PRIMARY: Z-stack 分层. 角色居中略偏上,
          底部留给 sticky CTA, 不被立绘压到 fold 下面. */}
      <main className="absolute inset-x-0 top-[52px] bottom-[312px] md:bottom-[128px] flex items-center justify-center px-4 pointer-events-none">
        <div className="relative flex flex-col items-center">

          {/* 段位 chevron — 浮在角色头顶 (tier name + roman + badge) */}
          <div className="relative z-10 mb-[-10px]">
            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-amber-300/50 shadow-lg shadow-amber-500/20">
              <span className="text-base leading-none">{tierBadge}</span>
              <span className="font-display font-bold text-amber-100 text-sm leading-none truncate max-w-[44vw]">{tierName}</span>
              <span className="font-display font-black text-amber-300 text-sm leading-none tabular-nums">{subRankRoman}</span>
            </div>
            {/* chevron 小三角 指向角色 */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-0 h-0 border-l-[7px] border-r-[7px] border-t-[8px] border-l-transparent border-r-transparent border-t-amber-300/50" />
            {subTierLabel && (
              <div className="text-center mt-1 text-[10px] text-amber-100/70 leading-none truncate max-w-[60vw]">{subTierLabel}</div>
            )}
          </div>

          {/* ─── Step 3 + 角色: ring halo 当 backdrop, 角色立绘叠在正中 ───
              halo = FLAT 同心环 (peer-review: 不旋转, 不斜成地板). 仅 gentle pulse. */}
          <div className="relative flex flex-col items-center">

            {/* 扁平 ring halo — 绝对居中于角色之后 (z-0), 角色 z-10 叠上 */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(80vw,330px)] aspect-square pointer-events-none z-0 animate-halo-pulse">
              <svg viewBox={`0 0 ${haloSize} ${haloSize}`} width="100%" height="100%" className="absolute inset-0 overflow-visible">
                <defs>
                  {rings.map((r) => (
                    <linearGradient key={r.id} id={`hub6-ring-${r.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={r.hue} />
                      <stop offset="100%" stopColor={r.hue2} />
                    </linearGradient>
                  ))}
                  <radialGradient id="hub6-halo-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.18" />
                    <stop offset="55%" stopColor="#a78bfa" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0" />
                  </radialGradient>
                </defs>
                {/* 中心柔光晕 (聚光灯 vibe) */}
                <circle cx={haloC} cy={haloC} r={(haloRadii[2] ?? 50) + 6} fill="url(#hub6-halo-glow)" />
                {rings.map((r, i) => {
                  const radius = haloRadii[i] ?? 50;
                  const circ = 2 * Math.PI * radius;
                  const offset = circ * (1 - Math.max(0.04, r.progress));
                  const done = r.progress >= 0.99;
                  return (
                    <g key={r.id}>
                      {/* 底环 (淡) */}
                      <circle cx={haloC} cy={haloC} r={radius} fill="none" stroke={r.hue} strokeOpacity={0.16} strokeWidth={haloStroke} />
                      {/* 进度弧 — 从顶部起 (rotate -90), 顺时针 */}
                      <circle
                        cx={haloC}
                        cy={haloC}
                        r={radius}
                        fill="none"
                        stroke={`url(#hub6-ring-${r.id})`}
                        strokeWidth={haloStroke}
                        strokeLinecap={r.progress >= 0.5 ? "round" : "butt"}
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        transform={`rotate(-90 ${haloC} ${haloC})`}
                        className="transition-[stroke-dashoffset] duration-700"
                        opacity={done ? 0.95 : 1}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* 角色立绘 — THE centerpiece (size="xl", 大全身), 叠在 halo 上 */}
            <div className="relative z-10 drop-shadow-[0_18px_36px_rgba(0,0,0,0.5)] animate-float">
              <TierCharacter
                tier={tier ?? FALLBACK_TIER}
                subRank={subRank}
                subRankRoman={subRankRoman}
                size="xl"
                characterChoice={characterChoice}
              />
            </div>

            {/* Step 5 sidekick: 小 🐼 在平台底部 (非交互, 不抢角色风头) */}
            <div className="relative z-10 -mt-1 text-3xl leading-none animate-float-slow pointer-events-none select-none" aria-hidden>🐼</div>
          </div>

          {/* ring 颜色图例 (legible: 每环 label + 颜色 + 进度%) */}
          <div className="relative z-10 mt-2 flex items-center gap-2.5 px-3 py-1 rounded-full bg-black/35 backdrop-blur-md border border-white/10">
            {rings.map((r) => (
              <span key={r.id} className="flex items-center gap-1 text-[10px] leading-none tabular-nums">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: r.hue }} />
                <span className="text-white/80">{r.label}</span>
                <span className="text-white/50">{Math.round(r.progress * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* ─── Step 4 (desktop): mission stack 当左 rail (md+ only, absolute) ─── */}
      <aside className="hidden md:flex absolute left-[2.5%] top-1/2 -translate-y-1/2 z-20 w-[clamp(210px,21vw,270px)] flex-col gap-2.5 pointer-events-auto">
        <MissionCards
          fragileCount={fragileSkills.length}
          examName={exam.name}
          examDays={examDays}
          abilityScore={abilityScoreTotal}
        />
      </aside>

      {/* ─── 底部 action zone: (mobile) mission stack → 巨大 CTA → stats bar ───
          CTA 恒为 dominant 大独立按钮; mission cards 在它"之外/之上", 不混入. */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pb-[max(8px,env(safe-area-inset-bottom))] pt-3 px-4 bg-gradient-to-t from-[#050315] via-[#050315]/92 to-transparent">
        <div className="w-full max-w-[440px] mx-auto flex flex-col gap-2.5">

          {/* Step 4 (mobile): vertical mission cards 在 CTA 上方 (md+ 隐藏, 走左 rail) */}
          <div className="md:hidden flex flex-col gap-2">
            <MissionCards
              fragileCount={fragileSkills.length}
              examName={exam.name}
              examDays={examDays}
              abilityScore={abilityScoreTotal}
            />
          </div>

          {/* 巨大 "开始今日挑战" CTA — THE dominant element (大独立按钮, 1-tap) */}
          <button
            onClick={() => navigate(TrainRoute.build({ fresh: Date.now() }))}
            className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-3xl bg-gradient-to-r from-amber-300 via-orange-400 to-pink-400 text-slate-900 font-display font-black shadow-2xl shadow-orange-500/60 border-4 border-amber-200 hover:scale-[1.03] active:scale-95 transition-transform animate-pulse-glow"
          >
            <span className="text-3xl leading-none">▶</span>
            <span className="text-left leading-tight">
              <span className="block text-2xl">开始今日挑战</span>
              <span className="block text-[11px] font-bold opacity-80">
                {remaining > 0 ? `还差 ${remaining} 题 · 赢 ⭐` : "今日已达标 · 加练得 ⭐"}
              </span>
            </span>
          </button>

          {/* ─── Step 5: 细 stats bar — 段位 · 学校 · 4 维 · 综合/1000 ─── */}
          <div className="flex items-center justify-center gap-x-2.5 gap-y-1 flex-wrap px-3 py-1.5 rounded-2xl bg-black/45 backdrop-blur-md border border-white/10 text-[10px] leading-none">
            <span className="font-display font-bold text-amber-200 truncate max-w-[34vw]">{tierName}</span>
            <span className="text-white/25">·</span>
            <span className="text-white/55">和平街小学</span>
            <span className="text-white/25">·</span>
            {statVals.map((s) => (
              <span key={s.label} className="flex items-center gap-1 tabular-nums">
                <span className="text-white/55">{s.label}</span>
                <span className="font-bold" style={{ color: s.color }}>{Math.round(s.value * 100)}</span>
              </span>
            ))}
            <span className="text-white/25">·</span>
            <span className="flex items-center gap-1 tabular-nums">
              <span className="text-violet-200/80">综合</span>
              <span className="font-display font-black text-violet-100">{abilityScoreTotal}</span>
              <span className="text-white/40">/1000</span>
            </span>
          </div>
        </div>
      </div>

      {/* Onboarding modal (新用户 character choice) — VERBATIM gating from HubV5 */}
      {showOnboarding && studentId && (
        <CharacterOnboardingModal
          studentId={studentId}
          onComplete={async () => {
            const refreshed = await getCharacterChoice(studentId);
            setCharacterChoice(refreshed);
            setShowOnboarding(false);
          }}
        />
      )}

      {/* dev re-trigger onboarding */}
      {onboardingChecked && characterChoice && (
        <button
          onClick={() => setShowOnboarding(true)}
          className="fixed bottom-1 right-2 text-[9px] text-violet-300/40 hover:text-violet-300 z-40 px-2 py-0.5 rounded backdrop-blur-md"
          title="重新选 character"
        >
          🎭 重选
        </button>
      )}

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes halo-pulse { 0%, 100% { opacity: 0.92; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 1; transform: translate(-50%, -50%) scale(1.015); } }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 40px rgba(251,146,60,0.5), 0 0 80px rgba(251,146,60,0.2); }
          50% { box-shadow: 0 0 60px rgba(251,146,60,0.7), 0 0 120px rgba(251,146,60,0.35); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
        .animate-halo-pulse { animation: halo-pulse 3.5s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulse-glow 2.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/**
 * Step 4 — mission stack 卡片 (mobile vertical / desktop 左 rail 共用).
 * CTA 仍是唯一 dominant 大按钮; 这三张是次级任务入口, 不与 CTA 竞争.
 *   - 红牌救援 → /math/mistakes (显示待救援错题数)
 *   - 期末 BOSS → /math/exam-prep (显示距考试天数)
 *   - 能力诊断 mini → /math/radar (脑力雷达; 显示综合分)
 */
function MissionCards({
  fragileCount,
  examName,
  examDays,
  abilityScore,
}: {
  fragileCount: number;
  examName: string;
  examDays: number;
  abilityScore: number;
}) {
  return (
    <>
      {/* 红牌救援 */}
      <Link
        to="/math/mistakes"
        className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-rose-500/15 backdrop-blur-md border border-rose-300/30 shadow-lg hover:bg-rose-500/25 active:scale-[0.98] transition pointer-events-auto"
      >
        <span className="text-2xl leading-none shrink-0">🚩</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-bold text-rose-50 text-sm leading-tight">红牌救援</span>
          <span className="block text-[11px] text-rose-200/80 leading-tight truncate">
            {fragileCount > 0 ? `${fragileCount} 个知识待支援` : "暂无待救援 · 保持住"}
          </span>
        </span>
        {fragileCount > 0 && (
          <span className="shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full bg-rose-500 text-white text-[12px] font-black flex items-center justify-center tabular-nums">{fragileCount}</span>
        )}
        <span className="shrink-0 text-rose-200/60 text-lg leading-none">›</span>
      </Link>

      {/* 期末 BOSS */}
      <Link
        to="/math/exam-prep"
        className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-violet-500/15 backdrop-blur-md border border-violet-300/30 shadow-lg hover:bg-violet-500/25 active:scale-[0.98] transition pointer-events-auto"
      >
        <span className="text-2xl leading-none shrink-0">⚔️</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-bold text-violet-50 text-sm leading-tight truncate">{examName} BOSS</span>
          <span className="block text-[11px] text-violet-200/80 leading-tight truncate">
            {examDays > 0 ? `${examDays} 天后来袭 · 今天备战 +1` : examDays === 0 ? "今天来袭 · 全力一战!" : "已结束 · 复盘走起"}
          </span>
        </span>
        {examDays >= 0 && (
          <span className="shrink-0 text-right leading-none">
            <span className="block font-display font-black text-violet-100 text-lg tabular-nums">{examDays === 0 ? "今天" : examDays}</span>
            {examDays > 0 && <span className="block text-[9px] text-violet-200/70">天</span>}
          </span>
        )}
        <span className="shrink-0 text-violet-200/60 text-lg leading-none">›</span>
      </Link>

      {/* 能力诊断 mini → 脑力雷达 */}
      <Link
        to="/math/radar"
        className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-cyan-500/12 backdrop-blur-md border border-cyan-300/25 shadow-lg hover:bg-cyan-500/20 active:scale-[0.98] transition pointer-events-auto"
      >
        <span className="text-xl leading-none shrink-0">⚡</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-bold text-cyan-50 text-[13px] leading-tight">能力诊断</span>
          <span className="block text-[10px] text-cyan-200/75 leading-tight">看脑力雷达 4 维成长</span>
        </span>
        <span className="shrink-0 text-right leading-none tabular-nums">
          <span className="font-display font-black text-cyan-100 text-sm">{abilityScore}</span>
          <span className="text-[9px] text-cyan-200/60">/1000</span>
        </span>
        <span className="shrink-0 text-cyan-200/60 text-lg leading-none">›</span>
      </Link>
    </>
  );
}
