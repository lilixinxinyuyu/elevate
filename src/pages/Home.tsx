import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { todayKey } from "../lib/date";
import { TodayRings, type TodayRingsInput } from "../components/TodayRings";
import { TutorPanel } from "../components/tutor/TutorPanel";
import { MascotProfile } from "../components/MascotProfile";
import { SKILLS } from "../content/skills";
import { UNITS } from "../content/units";
import { isPhase2Live } from "../lib/featureFlags";
import { starsFromAccuracy } from "../lib/bossBattleState";
import {
  checkPoolHealth,
  computeCurrentRating,
  getEquippedBadge,
  getMistakeRevivedToday,
  getMockExamCooldown,
  getReviveSessionVitality,
  getSelectedTerm,
  getStruggleSkills,
  getUnlockedTiers,
  setEquippedBadge,
  setSelectedTerm,
  spreadOverflowDueMistakes,
} from "../db/service";
import { tierById, TIERS, tierIndex } from "../core/tiers";
import { TierCard } from "../components/TierCard";
import { WeeklyCompareCard } from "../components/WeeklyCompareCard";
import { BossStarCard } from "../components/BossStarCard";
import { TrophyWall } from "../components/TrophyWall";
import { BadgeInventory } from "../components/BadgeInventory";
import { UnlockCelebration } from "../components/UnlockCelebration";
import { UnitProgress } from "../components/UnitProgress";
import type { RatingResult, AbilityDiagnostic } from "../core/rating";
import { computeAbilityDiagnostic } from "../core/rating";
import type { Term } from "../core/types";
import { useEffect, useState } from "react";
import { ackMigrationNotice, getMigrationNoticeUnacked } from "../db/seed";
import { currentExam, daysUntil, FINAL } from "../core/examDates";
import { getTricksTodayCount } from "../lib/mathTricksProgress";

/** 把毫秒时间戳格式成本地日期字符串 YYYY-MM-DD（与 todayKey 一致） */
function localDayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** v0.31.1：根据当前数据决定 TodayRings 的 3 环输入（含动态焦点环）*/
function buildTodayRingsInput(args: {
  todayCount: number;
  challengeTarget: number;
  /** v0.31.29：今日闪电口算 session 数（≥1 算闭环） */
  fluencyTodayCount: number;
  /** v0.31.87：今日完成的巧算 trick 数（fluency 环双闭判定） */
  tricksTodayCount: number;
  /** v0.31.58：今日闯关获星总数（boss session 完成 → starsFromAccuracy 之和） */
  todayBossStars: number;
  /** v0.31.68：今日已复活（advance 过的到期错题数）；用来在 chip 显示进度 */
  mistakesRevivedToday: number;
  /** v0.31.69：今日复活是否"顺利"（>70% 准确率 + 比 estimated 快 ≥20%） */
  reviveEncourageMore: boolean;
  mastery: { skillId: string; score: number }[];
  mistakes: { resolved: boolean; nextReviewAt: number; questionId: string }[];
  streak: number;
  ratingAccuracy?: number;
  trophyIds: Set<string>;
}): TodayRingsInput {
  const now = Date.now();
  const challengeDone = args.todayCount >= args.challengeTarget;
  const fluencyTodayCount = args.fluencyTodayCount;

  const dueMistakes = args.mistakes.filter(
    (m) => !m.resolved && m.nextReviewAt <= now,
  ).length;

  // 优先级 1：哪个 unit 距闯关解锁最近（gap ≤ 15 算"接近"）
  const G4B_GATE = 75;
  const masteryById = new Map(args.mastery.map((m) => [m.skillId, m.score]));
  const g4bUnits = UNITS.filter((u) => u.term === "下册").sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const closestBoss = g4bUnits
    .map((u) => {
      const skills = SKILLS.filter((sk) => sk.unitId === u.id);
      const scores = skills.map((sk) => masteryById.get(sk.id) ?? 0);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const beaten = args.trophyIds.has(`boss_${u.id}_master`);
      return { unitName: u.name, avg: Math.round(avg), beaten };
    })
    .filter((u) => !u.beaten && u.avg < G4B_GATE)
    .sort((a, b) => b.avg - a.avg)[0]; // 取距 75 最近的（avg 最高的未通关）

  // 优先级 2：今日错题到期
  // 优先级 3：考试倒计
  // 优先级 4：3 环全闭
  let focus: TodayRingsInput["focus"];
  const phase2 = isPhase2Live();
  const exam = currentExam();
  const examDays = daysUntil(exam.date);

  // v0.31.59: 优先级重排（爸爸反馈第三环显示了错题复活，期望看到闯关赢星）
  //   1. Phase 2 + 今日还没拿到 boss 星 → 闯关赢星（默认每日打卡，强动机）
  //   2. 错题到期（仅当今日 boss 星已拿，作为下一件该做的事）
  //   3. 考试 ≤14 天倒计时
  //   4. Phase 2 + 已拿星 → 仍显示 boss_star_today (done 状态)
  //   5. all_done / idle 兜底
  const bossStarDone = (args.todayBossStars ?? 0) >= 1;
  if (phase2 && !bossStarDone) {
    focus = { kind: "boss_star_today", starsToday: args.todayBossStars, target: 1 };
  } else if (dueMistakes > 0 || args.mistakesRevivedToday > 0) {
    // v0.31.69: revivedToday > 0 也展示 mistakes_due（让闭环 / 鼓励文案能露出来）
    focus = {
      kind: "mistakes_due",
      count: dueMistakes,
      revivedToday: args.mistakesRevivedToday,
      encourageMore: args.reviveEncourageMore,
    };
  } else if (examDays >= 0 && examDays <= 14) {
    focus = { kind: "exam_countdown", examName: exam.name, days: examDays };
  } else if (phase2) {
    focus = { kind: "boss_star_today", starsToday: args.todayBossStars, target: 1 };
  } else if (challengeDone && fluencyTodayCount >= 1) {
    focus = { kind: "all_done" };
  } else {
    focus = { kind: "idle" };
  }

  return {
    fluencyTodayCount,
    tricksTodayCount: args.tricksTodayCount,
    challengeTodayCount: args.todayCount,
    challengeTarget: args.challengeTarget,
    focus,
  };
}

export function HomePage() {
  const student = useLiveQuery(async () => (await db.students.toArray())[0]);
  const attempts = useLiveQuery(
    async () => (student ? db.attempts.where({ studentId: student.id }).toArray() : []),
    [student?.id],
  );
  // v0.31.16: 已经在 Dexie 层 filter 掉 questionId 已不存在的孤儿错题
  // （否则 focus ring "今日 X 道到期" 会被孤儿撑大）
  const mistakes = useLiveQuery(async () => {
    if (!student) return [];
    const [all, qids] = await Promise.all([
      db.mistakes.where({ studentId: student.id }).toArray(),
      db.questions.toCollection().primaryKeys() as Promise<string[]>,
    ]);
    const qSet = new Set(qids);
    // questions 还没 seed（qSet 空）时不要把全部 mistakes 当孤儿过滤掉
    return qSet.size === 0 ? all : all.filter((m) => qSet.has(m.questionId));
  }, [student?.id]);
  const trophies = useLiveQuery(
    async () => (student ? db.trophies.where({ studentId: student.id }).toArray() : []),
    [student?.id],
  );
  // v0.29: TrophyWall 需要完整 ctx 才能算每个 tiered 勋章的当前进度
  const mastery = useLiveQuery(
    async () => (student ? db.mastery.where({ studentId: student.id }).toArray() : []),
    [student?.id],
  );
  // v0.31.29：今日闪电口算 session 数（用于 3 环之一闭合判定）
  // v0.31.90：通关 module（mastered）的 session 不计入今日打卡 — 鼓励 Selena 挑战
  //   还没通关的 module，而不是在已经熟练的 module 上刷"完成感"
  const fluencyTodayCount = useLiveQuery(async () => {
    if (!student) return 0;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startMs = startOfToday.getTime();
    const [all, stats] = await Promise.all([
      db.fluencyAttempts.where({ studentId: student.id }).toArray(),
      db.fluencyStats.where({ studentId: student.id }).toArray(),
    ]);
    const masteredModules = new Set(
      stats.filter((s) => s.mastered).map((s) => s.moduleId),
    );
    // 按 sessionId 去重 —— 一个 session 算一次；过滤掉 mastered module
    const sessionToModule = new Map<string, string>();
    for (const a of all) {
      if (a.createdAt < startMs || !a.sessionId) continue;
      sessionToModule.set(a.sessionId, a.moduleId);
    }
    let count = 0;
    for (const moduleId of sessionToModule.values()) {
      if (!masteredModules.has(moduleId)) count += 1;
    }
    return count;
  }, [student?.id]);

  // v0.31.68: 今日已复活（推进过的到期错题数 — 含原题直接 advance + variant
  // 通过 propagate 推进的）。chip 显示 "已复活 X / X+N 道" 进度。
  const mistakesRevivedToday = useLiveQuery(async () => {
    if (!student) return 0;
    return await getMistakeRevivedToday(student.id);
  }, [student?.id, attempts?.length]);

  // v0.31.87: 今日完成的巧算 trick 数（TodayRings fluency 环双闭判定）
  const tricksTodayCount = useLiveQuery(async () => {
    if (!student) return 0;
    return await getTricksTodayCount(student.id);
  }, [student?.id]);

  // v0.31.69: 今日复活"顺利度"——决定闭环后是否鼓励继续做。
  const reviveVitality = useLiveQuery(async () => {
    if (!student) return { encourageMore: false, attempts: 0, accuracy: 0 };
    return await getReviveSessionVitality(student.id);
  }, [student?.id, attempts?.length]);

  // v0.31.69: Home 加载时若到期错题超过上限 (15)，自动把多余的推到未来 7 天，
  // 让 Selena 不被一次性 76 道吓到。idempotent — spread 后 dueCount 降到 ≤ 10
  // 不再触发。
  useEffect(() => {
    if (!student) return;
    void spreadOverflowDueMistakes(student.id);
  }, [student?.id]);

  // v0.31.58: 今日闯关获星总数 — 扫今日 mode=big_problems sessions 的 summary。
  // v0.31.86: 优先读 summary.bossStars（BossBattle 写入，含 hearts 信息）；
  // 老 session 没这字段时 fallback 到 starsFromAccuracy(correct,total) — 注意没 hearts
  // 信息，最高只能 3 星（与 starsFromAccuracy heartsLeft===undefined 的旧分支一致）。
  const todayBossStars = useLiveQuery(async () => {
    if (!student) return 0;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startMs = startOfToday.getTime();
    const sessions = await db.sessions
      .where({ studentId: student.id })
      .filter((s) => s.mode === "big_problems" && (s.finishedAt ?? 0) >= startMs)
      .toArray();
    let total = 0;
    for (const s of sessions) {
      if (typeof s.summary?.bossStars === "number") {
        total += s.summary.bossStars;
      } else {
        const correct = s.summary?.correct ?? 0;
        const total_ = s.summary?.total ?? 0;
        total += starsFromAccuracy(correct, total_);
      }
    }
    return total;
  }, [student?.id]);

  const [rating, setRating] = useState<RatingResult | null>(null);
  const [ability, setAbility] = useState<AbilityDiagnostic | null>(null);
  const [unlockedTiers, setUnlockedTiers] = useState<string[]>(["school"]);
  const [equippedTierId, setEquippedTierId] = useState<string>("school");
  const [term, setTerm] = useState<Term>("下册");
  const [poolHealth, setPoolHealth] = useState<{
    freshTotal: number;
    freshMidterm: number;
    starvedSkills: { skillId: string; skillName: string }[];
  } | null>(null);
  const [celebrationToTier, setCelebrationToTier] = useState<string | null>(null);
  const [showMigrationNotice, setShowMigrationNotice] = useState(false);
  const [struggleSkills, setStruggleSkills] = useState<{ skillId: string; skillName: string; consecutiveWrong: number; totalRecent: number }[]>([]);
  /** 点"让小进帮一下"打开的 panel（针对某个 struggle skill） */
  const [tutorForSkill, setTutorForSkill] = useState<{ skillId: string; skillName: string; consecutiveWrong: number } | null>(null);
  const [mockExam, setMockExam] = useState<{ available: boolean; daysUntilNext: number; lastAt: number | null } | null>(null);

  useEffect(() => {
    getMigrationNoticeUnacked().then(setShowMigrationNotice);
  }, []);

  // 加载初始 selectedTerm
  useEffect(() => {
    if (!student) return;
    getSelectedTerm(student.id).then(setTerm);
  }, [student?.id]);

  // 重新计算综合分（学期切换或数据变化时）
  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    (async () => {
      const r = await computeCurrentRating(student.id, term);
      if (cancelled) return;
      setRating(r);

      // 能力诊断（与 XP 不同：0-1000 综合分，反映学习"质量"）
      // 用最新的 attempts/mastery 重算；hero 底部展示
      const ab = computeAbilityDiagnostic(attempts ?? [], mastery ?? [], term);
      if (!cancelled) setAbility(ab);

      // 解锁段位（按当前 term）
      const prevUnlocked = await getUnlockedTiers(student.id, term);
      const currentIdx = tierIndex(r.tier.id);
      const shouldBeUnlocked = TIERS.slice(0, currentIdx + 1).map((t) => t.id);
      const newUnlocked = Array.from(new Set([...prevUnlocked, ...shouldBeUnlocked]));
      const grewBy = newUnlocked.filter((id) => !prevUnlocked.includes(id));

      if (grewBy.length > 0) {
        const code = term === "上册" ? "G4A" : term === "下册" ? "G4B" : "MIX";
        await db.meta.put({
          key: `tiersUnlocked::${student.id}::${code}`,
          value: newUnlocked,
        });
        // 庆祝条件
        const prevMaxIdx = prevUnlocked.length > 0
          ? Math.max(...prevUnlocked.map(tierIndex))
          : -1;
        if (prevMaxIdx >= 0 && currentIdx > prevMaxIdx && r.tier.id !== "school") {
          setCelebrationToTier(r.tier.id);
        }
      }
      setUnlockedTiers(newUnlocked);
      setEquippedTierId(await getEquippedBadge(student.id));
      setPoolHealth(await checkPoolHealth(student.id));
      setStruggleSkills(await getStruggleSkills(student.id));
      setMockExam(await getMockExamCooldown(student.id));
    })();
    return () => {
      cancelled = true;
    };
  }, [student?.id, attempts?.length, mastery?.length, term]);

  const handleEquip = async (tierId: string) => {
    if (!student) return;
    await setEquippedBadge(student.id, tierId);
    setEquippedTierId(tierId);
  };

  const handleSwitchTerm = async (t: Term) => {
    if (!student) return;
    setTerm(t);
    await setSelectedTerm(student.id, t);
  };

  if (!student) return <div className="card">正在初始化…</div>;

  // 用本地日期（与 todayKey 一致），避免 UTC 时区导致连续天数错判
  const practiceDays = new Set((attempts ?? []).map((a) => localDayKey(a.createdAt)));
  const streak = computeStreak(Array.from(practiceDays));
  const today = todayKey();
  const todayAttempts = (attempts ?? []).filter((a) => localDayKey(a.createdAt) === today);
  const unresolvedMistakes = (mistakes ?? []).filter((m) => !m.resolved).length;
  const dueMistakes = (mistakes ?? []).filter((m) => !m.resolved && m.nextReviewAt <= Date.now()).length;

  const equippedBadge = tierById(equippedTierId) ?? tierById("school")!;

  const TERMS: { id: Term; label: string }[] = [
    { id: "下册", label: "📚 四年级下册（当前）" },
    { id: "上册", label: "📕 四年级上册" },
    { id: "综合复习", label: "🎯 综合复习" },
  ];

  return (
    <div className="space-y-6">
      {/* 迁移通知（只显示一次） */}
      {showMigrationNotice && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-rose-500/15 border border-amber-400/40 p-4 relative">
          <button
            type="button"
            onClick={async () => {
              await ackMigrationNotice();
              setShowMigrationNotice(false);
            }}
            className="absolute top-2 right-3 text-amber-200/60 hover:text-amber-100 text-lg leading-none"
            aria-label="知道了"
          >
            ×
          </button>
          <div className="flex gap-3">
            <div className="text-2xl">✨</div>
            <div className="flex-1 text-sm text-amber-100">
              <div className="font-display font-bold mb-1">计分规则升级啦！</div>
              <div className="text-xs text-amber-200/90 leading-relaxed">
                同一道题重复答对会**递减**：第 2 次 50%、第 3 次 20%、第 4 次 10%、之后不加分。
                <br />
                <span className="text-emerald-200">学到新知识点首次答对 +5 XP 奖励 🎓</span>
                <br />
                你的历史 XP 已经按新规则重算啦——多做新题更划算！
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 学期切换器 */}
      <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        <span className="text-xs text-slate-400 shrink-0">赛季：</span>
        {TERMS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleSwitchTerm(t.id)}
            className={`shrink-0 chip text-xs px-3 py-1.5 transition-all ${
              term === t.id
                ? "bg-violet-500/30 text-violet-100 border border-violet-400/60 shadow-glow-violet"
                : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Hero：综合分 + 段位 + 佩戴的勋章 + 能力诊断（v0.30.2） */}
      {rating ? (
        <TierCard
          studentName={student.name}
          rating={rating}
          equippedBadge={equippedBadge}
          ability={ability}
        />
      ) : (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600/30 via-fuchsia-600/20 to-pink-600/30 border border-violet-400/20 p-6">
          <div className="text-sm text-violet-200">你好 {student.name} 👋</div>
          <div className="mt-2 font-display text-2xl text-white">载入中…</div>
        </section>
      )}

      {/* v0.31.53：闯关星章独立卡 — 24 颗星目标（含期末 4 颗 = 28 极限）。
          段位是连续 XP，星章是离散里程碑，二者并列让 Selena 多一条进步线。 */}
      <BossStarCard studentId={student.id} />

      {/* v0.31.50：本周 vs 上周 — 短周期可见进步，配合"难度加权 XP + 5 段小段位"
          一起给 Selena 一个"每天都看得到动"的反馈点 */}
      <WeeklyCompareCard attempts={attempts ?? []} />

      {/* v0.31.2：今日 3 同心环（取代之前的 chip 行）*/}
      {isPhase2Live() ? (
        <TodayRings {...buildTodayRingsInput({
          fluencyTodayCount: fluencyTodayCount ?? 0,
          tricksTodayCount: tricksTodayCount ?? 0,
          todayBossStars: todayBossStars ?? 0,
          mistakesRevivedToday: mistakesRevivedToday ?? 0,
          reviveEncourageMore: reviveVitality?.encourageMore ?? false,
          todayCount: todayAttempts.length,
          challengeTarget: 15,
          mastery: mastery ?? [],
          mistakes: mistakes ?? [],
          streak,
          ratingAccuracy: rating?.raw.accuracy,
          trophyIds: new Set((trophies ?? []).map((t) => t.trophyId)),
        })} />
      ) : (
        // Phase 2 关闭时保持原 chip 行（不动 v0.30.x 行为）
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip bg-amber-500/20 text-amber-200 border border-amber-400/30">
            🔥 {streak} 天连续
          </span>
          <span className="chip bg-violet-500/20 text-violet-100 border border-violet-400/30">
            今日已做 {todayAttempts.length}
          </span>
          {rating && rating.raw.totalAttempts > 0 && (
            <span className="chip bg-emerald-500/20 text-emerald-100 border border-emerald-400/30" title="本学期答题正确率">
              🎯 {Math.round(rating.raw.accuracy * 100)}% 准
            </span>
          )}
          {(() => {
            const exam = currentExam();
            const days = daysUntil(exam.date);
            if (days < 0) return null;
            const tone =
              exam.tone === "rose"
                ? "bg-rose-500/20 text-rose-100 border-rose-400/40"
                : "bg-cyan-500/20 text-cyan-100 border-cyan-400/40";
            const text =
              days === 0 ? `📅 今天就是${exam.name}！冲！`
              : days === 1 ? `📅 明天${exam.name}`
              : `📅 距${exam.name}还有 ${days} 天`;
            return (
              <span className={`chip border ${tone}`} title={`${exam.name}：${exam.dateKey}`}>
                {text}
              </span>
            );
          })()}
          <Link to={`/math/train?fresh=${Date.now()}`} className="btn-primary ml-auto text-base px-5 py-2.5">
            ▶ 开始今日挑战
          </Link>
        </div>
      )}

      {/* ROI #1：红旗 skill 提示（连错 3+ 次）— v0.31.19 改"让小进帮忙" */}
      {struggleSkills.length > 0 && (
        <section className="card-glow border-rose-400/50 bg-gradient-to-br from-rose-500/15 to-amber-500/10">
          <div className="flex items-start gap-3">
            <div className="text-3xl">🚩</div>
            <div className="flex-1">
              <div className="font-display font-bold text-rose-100 text-base">
                这些知识点连错了好几次，让小进帮一下
              </div>
              <ul className="mt-2 space-y-1.5 text-sm text-rose-100/90">
                {struggleSkills.slice(0, 3).map((s) => (
                  <li key={s.skillId} className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <Link
                        to={`/math/train?skillId=${encodeURIComponent(s.skillId)}&fresh=${Date.now()}`}
                        className="underline decoration-rose-400/50 underline-offset-2 hover:text-white"
                      >
                        {s.skillName}
                      </Link>
                      <span className="chip text-[10px] px-2 py-0.5 bg-rose-500/30 border border-rose-400/40 text-rose-100 shrink-0">
                        连错 {s.consecutiveWrong} 次
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setTutorForSkill({
                          skillId: s.skillId,
                          skillName: s.skillName,
                          consecutiveWrong: s.consecutiveWrong,
                        })
                      }
                      className="chip text-[11px] px-2.5 py-1 bg-amber-500/25 border border-amber-400/50 text-amber-100 hover:bg-amber-500/40 transition-colors shrink-0"
                    >
                      👩‍🏫 找小进讲讲
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-xs text-rose-200/70">
                点"找小进讲讲"开口跟小进姐姐说就行——她看得到 Selena 错过哪几道。
              </div>
            </div>
          </div>
        </section>
      )}

      {/* struggle-skill tutor panel（语音对话） */}
      {tutorForSkill && student && (
        <TutorPanel
          subjectId="math"
          context="skill_help"
          studentId={student.id}
          skillId={tutorForSkill.skillId}
          skillName={tutorForSkill.skillName}
          consecutiveWrong={tutorForSkill.consecutiveWrong}
          onClose={() => setTutorForSkill(null)}
        />
      )}

      {/* v0.31.89：3 卡 → 2 卡（专项练 + 技能树 合并为"技能图"）。
          桌面 grid-cols-2；mobile col-span-2 横跨全宽 + 单独成行 */}
      <div className="grid grid-cols-2 gap-2.5">
        {(() => {
          const exam = currentExam();
          const days = daysUntil(exam.date);
          const isMidterm = exam.id === "midterm";
          const themeCls = isMidterm
            ? "border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 to-sky-500/10"
            : "border-rose-400/40 bg-gradient-to-br from-rose-500/20 to-pink-500/10";
          const titleCls = isMidterm ? "text-cyan-100" : "text-rose-100";
          const subCls = isMidterm ? "text-cyan-200/80" : "text-rose-200/80";
          const icon = isMidterm ? "⏰" : "🚀";
          const sub = days < 0
            ? `${exam.hint}`
            : days <= 7
              ? `仅剩 ${days} 天`
              : `${exam.dateKey}`;
          return (
            <Link
              to={`/math/train?mode=${exam.mode}&fresh=${Date.now()}`}
              className={`card-glow hover:scale-[1.02] transition-transform col-span-2 sm:col-span-1 ${themeCls}`}
            >
              <div className="text-lg">{icon}</div>
              <div className={`font-display font-bold mt-1.5 text-sm ${titleCls}`}>{exam.name}冲刺</div>
              <div className={`text-[11px] ${subCls} mt-0.5`}>{sub}</div>
            </Link>
          );
        })()}
        <Link
          to="/math/skills"
          className="card-glow hover:scale-[1.02] transition-transform col-span-2 sm:col-span-1 border-violet-400/30 bg-gradient-to-br from-violet-500/20 via-indigo-500/15 to-pink-500/10"
        >
          <div className="text-lg">🌌</div>
          <div className="font-display font-bold mt-1.5 text-sm text-violet-100">技能图</div>
          <div className="text-[11px] text-violet-200/80 mt-0.5">
            点节点直接练 · 开组合模式多选一起练
          </div>
        </Link>
      </div>

      {/* v0.31.71: 巧算工具箱入口（独立一行，强调"基本功"性质） */}
      <Link
        to="/math/tricks"
        className="card-glow block border-violet-400/30 bg-gradient-to-br from-violet-500/15 via-pink-500/10 to-amber-500/5 hover:scale-[1.005] transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl">🪄</div>
          <div className="flex-1">
            <div className="font-display font-bold text-violet-100 text-sm">巧算工具箱</div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              凑整、借十、折半乘倍 · 8 个让心算变快的秘密武器
            </div>
          </div>
          <div className="text-violet-300 text-sm">→</div>
        </div>
      </Link>

      {/* ROI #2：每周一次的考试模拟 */}
      {mockExam && (
        mockExam.available ? (
          <Link
            to={`/math/train?mode=mock_exam&fresh=${Date.now()}`}
            className="card-glow block border-purple-400/40 bg-gradient-to-br from-purple-600/20 via-fuchsia-500/10 to-pink-500/10 hover:scale-[1.01] transition-transform"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-xs text-purple-200/70 uppercase tracking-widest">每周一次</div>
                <div className="font-display font-bold text-lg text-purple-100 mt-0.5">📝 考试模拟</div>
                <div className="text-xs text-purple-200/80 mt-1">
                  30 道题 · 锁时钟 · 无提示 · 仿真期末难度（D1:10 / D2:30 / D3:40 / D4:20）
                </div>
                {mockExam.lastAt && (
                  <div className="text-[11px] text-purple-200/60 mt-1">
                    上次完成：{new Date(mockExam.lastAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="chip bg-purple-500/30 border border-purple-300/50 text-purple-50 font-display font-bold">
                可以挑战
              </div>
            </div>
          </Link>
        ) : (
          <div className="card border-white/10 opacity-70">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📝</div>
              <div className="flex-1">
                <div className="font-display font-bold text-slate-200">考试模拟</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  上次刚做过，{mockExam.daysUntilNext} 天后再开放（每周 1 次保模拟感）
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* 题库快用完了提示 */}
      {poolHealth &&
        (poolHealth.freshTotal < 30 ||
          poolHealth.freshMidterm < 15 ||
          poolHealth.starvedSkills.length >= 5) && (
          <section className="card-glow border-amber-400/50 bg-gradient-to-br from-amber-500/15 to-rose-500/10">
            <div className="flex items-start gap-3">
              <div className="text-3xl">🌟</div>
              <div className="flex-1">
                <div className="font-display font-bold text-amber-100 text-lg">
                  Selena，这些题你都很熟啦！
                </div>
                <div className="text-sm text-amber-200/90 mt-1">
                  还剩 <span className="font-bold">{poolHealth.freshTotal}</span> 道新题没做（期中范围 {poolHealth.freshMidterm} 道）。
                </div>
                {poolHealth.starvedSkills.length > 0 && (
                  <div className="text-sm text-amber-200/90 mt-1">
                    这些技能你已经做完了：{poolHealth.starvedSkills.slice(0, 4).map((s) => s.skillName).join("、")}
                    {poolHealth.starvedSkills.length > 4 ? " 等" : ""}。
                  </div>
                )}
                <div className="text-sm text-amber-200/90 mt-1">让爸爸 / 妈妈给你出新题吧～</div>
                <Link to="/math/admin" className="btn-primary mt-3 inline-block text-sm py-2 px-4">
                  去 AI 出题
                </Link>
              </div>
            </div>
          </section>
        )}

      {/* v0.30.9: 学期进度（单元解锁面板） */}
      <UnitProgress studentId={student.id} term={term} />

      {/* 小进姐姐资料卡：等级 + XP 进度 + 切音色 + 一键找小进聊 */}
      <MascotProfile studentId={student.id} />

      {/* 段位勋章柜 */}
      <BadgeInventory
        unlockedTierIds={unlockedTiers}
        equippedTierId={equippedTierId}
        onEquip={handleEquip}
      />

      {/* 奖杯墙 */}
      <TrophyWall
        trophies={trophies ?? []}
        ctx={{
          studentId: student?.id ?? "",
          attempts: attempts ?? [],
          mastery: mastery ?? [],
          mistakes: mistakes ?? [],
          trophies: trophies ?? [],
          todayDateKey: today,
        }}
      />

      {/* 跨段升档庆祝 */}
      {celebrationToTier && (
        <UnlockCelebration
          fromTierId={
            // 从已解锁列表里挑出"刚才那一段以下的"作为 from
            unlockedTiers.find((id) => id !== celebrationToTier) ?? "school"
          }
          toTierId={celebrationToTier}
          onClose={() => setCelebrationToTier(null)}
        />
      )}
    </div>
  );
}

function computeStreak(dateKeys: string[]): number {
  if (dateKeys.length === 0) return 0;
  const set = new Set(dateKeys);
  let streak = 0;
  const cursor = new Date();
  if (!set.has(localDayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (set.has(localDayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
