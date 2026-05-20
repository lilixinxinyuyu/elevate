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
import { useNavigate } from "react-router-dom";
import { db } from "../db/dexie";
import { loadDaily } from "../lib/dailyTarget";
import { getTotalXp, computeCurrentRating } from "../db/service";
import { levelFromXp } from "../core/scoring";
import { TrainRoute } from "../lib/routes";
import { type RatingResult } from "../core/rating";
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
  const [todayCount, setTodayCount] = useState(0);
  const [todayTarget, setTodayTarget] = useState(10);
  // 真 rating (段位 chevron 用)
  const [rating, setRating] = useState<RatingResult | null>(null);
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
      setTodayCount(daily.todayCount);
      setTodayTarget(daily.target ?? 10);
      // character choice (onboarding 之后) — 没 choice → 自动弹 modal
      const choice = await getCharacterChoice(s.id);
      if (!cancelled) {
        setCharacterChoice(choice);
        setOnboardingChecked(true);
        if (!choice) setShowOnboarding(true);
      }
      // 真 rating (computeCurrentRating, 下册赛季)
      try {
        const r = await computeCurrentRating(s.id, "下册");
        if (!cancelled) setRating(r);
      } catch (e) {
        // prototype fallback OK
        console.warn("[hub-v6] rating compute failed (fallback)", e);
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

      {/* ─── 顶部 HUD 一行: 🐼 name · Lv · XP ─── */}
      <div className="absolute top-3 left-0 right-0 px-4 z-20 flex justify-center pointer-events-none">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg pointer-events-auto">
          <span className="text-lg leading-none">🐼</span>
          <span className="font-display font-bold text-sm leading-none truncate max-w-[40vw]">{studentName}</span>
          <span className="text-white/40">·</span>
          <span className="text-[12px] text-violet-200 leading-none">Lv {level}</span>
          <span className="text-white/40">·</span>
          <span className="text-[12px] text-amber-200 leading-none tabular-nums">{xp.toLocaleString()} XP</span>
        </div>
      </div>

      {/* ─── 中央 stage: 角色立绘 centerpiece + 头顶段位 chevron ───
          MOBILE PORTRAIT PRIMARY: Z-stack 分层. 角色居中略偏上,
          底部留给 sticky CTA, 不被立绘压到 fold 下面. */}
      <main className="absolute inset-x-0 top-[52px] bottom-[140px] flex items-center justify-center px-4 pointer-events-none">
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

          {/* TODO (step 3): rings-as-halo — 3 同心环环绕角色当光环 */}

          {/* 角色立绘 — THE centerpiece (size="xl", 大全身) */}
          <div className="relative drop-shadow-[0_18px_36px_rgba(0,0,0,0.5)] animate-float">
            <TierCharacter
              tier={tier ?? FALLBACK_TIER}
              subRank={subRank}
              subRankRoman={subRankRoman}
              size="xl"
              characterChoice={characterChoice}
            />
          </div>

          {/* TODO (step 4): mission stack — 今日任务 / 错题救援 / BOSS 倒计时 */}
          {/* TODO (step 5): stats bottom bar (能力诊断 4 维) + sidekick mascot 🦊 */}
        </div>
      </main>

      {/* ─── 底部 sticky action: 巨大 "开始今日挑战" CTA (dominant, 1-tap) ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pb-[max(14px,env(safe-area-inset-bottom))] pt-4 px-4 bg-gradient-to-t from-[#050315] via-[#050315]/85 to-transparent">
        <button
          onClick={() => navigate(TrainRoute.build({ fresh: Date.now() }))}
          className="w-full max-w-[420px] mx-auto flex items-center justify-center gap-3 px-8 py-4 rounded-3xl bg-gradient-to-r from-amber-300 via-orange-400 to-pink-400 text-slate-900 font-display font-black shadow-2xl shadow-orange-500/60 border-4 border-amber-200 hover:scale-[1.03] active:scale-95 transition-transform animate-pulse-glow"
        >
          <span className="text-3xl leading-none">▶</span>
          <span className="text-left leading-tight">
            <span className="block text-2xl">开始今日挑战</span>
            <span className="block text-[11px] font-bold opacity-80">
              {remaining > 0 ? `还差 ${remaining} 题 · 赢 ⭐` : "今日已达标 · 加练得 ⭐"}
            </span>
          </span>
        </button>
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
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 40px rgba(251,146,60,0.5), 0 0 80px rgba(251,146,60,0.2); }
          50% { box-shadow: 0 0 60px rgba(251,146,60,0.7), 0 0 120px rgba(251,146,60,0.35); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulse-glow 2.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
