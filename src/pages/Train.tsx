import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../db/dexie";
import { ensureSeeded } from "../db/seed";
import { finalizeSession, getOrCreateSession, getTotalXp, submitAttempt, trophyById, recordMockExamCompleted } from "../db/service";
import type { DailySession, Question, SessionMode, SessionSummary } from "../core/types";
import { GameShell, type AttemptResult } from "../components/game/GameShell";
import { RewardChest } from "../components/game/RewardChest";
import { sfx } from "../lib/sfx";
import { ABILITY_LABELS } from "../core/types";
import { levelFromXp } from "../core/scoring";
import { SKILLS } from "../content/skills";
import { UNITS } from "../content/units";
import { pushToCloud } from "../db/cloudSync";
import { UnlockCelebration } from "../components/UnlockCelebration";
import { AutoGenerateOnEmpty } from "../components/AutoGenerateOnEmpty";
import { triggerBgGenIfLow } from "../lib/bgGen";
import { TrophyIcon } from "../components/TrophyIcon";
import { LotteryBoxModal } from "../components/LotteryBoxModal";
import { trophyImageKey } from "../lib/allTrophies";
import type { TrophyMeta } from "../lib/trophyImages";
import { TROPHIES } from "../core/trophies";
import { tierById } from "../core/tiers";

export function TrainPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mode = (params.get("mode") as SessionMode | null) ?? "normal";
  const freshParam = params.get("fresh");
  const skillIdSingle = params.get("skillId");
  const skillIdsParam = params.get("skillIds");
  const selectedSkillIds = useMemo(() => {
    if (skillIdSingle) return [skillIdSingle];
    if (skillIdsParam) return skillIdsParam.split(",").filter(Boolean);
    return undefined;
  }, [skillIdSingle, skillIdsParam]);
  const effectiveMode: SessionMode = selectedSkillIds ? "skill" : mode;

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "empty"; starved?: boolean; starvedSkillNames?: string[] }
    | { status: "error"; message: string }
    | {
        status: "running";
        session: DailySession;
        questions: Question[];
        index: number;
        studentId: string;
        xp: number;
        combo: number;
        poolStarved?: boolean;
      }
    | { status: "done"; summary: SessionSummary; studentId: string }
  >({ status: "loading" });

  // 唯一标识本次"想要的训练"——只有 URL 真的改变才重新建会话；HMR / 重渲染都不会重置。
  const initKey = useMemo(
    () => `${effectiveMode}::${selectedSkillIds?.join(",") ?? ""}::${freshParam ?? ""}`,
    [effectiveMode, selectedSkillIds, freshParam],
  );
  const lastInitKeyRef = useRef<string>("__none__");

  useEffect(() => {
    // 不能依赖"effect cleanup 取消"，因为 StrictMode 下首次 effect 会被立刻 cleanup，
    // 而第二次 effect 会因 ref 已设置而跳过——结果永远卡 loading。
    // 改为：每次开始一个新的 init key，用 myKey 比对 ref 来决定要不要 setState。
    if (lastInitKeyRef.current === initKey) return;
    lastInitKeyRef.current = initKey;
    const myKey = initKey;
    setState({ status: "loading" });
    (async () => {
      try {
        const students = await db.students.toArray();
        if (lastInitKeyRef.current !== myKey) return;
        if (students.length === 0) {
          // 学生记录被清空了，重新跑一次 seed
          await ensureSeeded();
          if (lastInitKeyRef.current !== myKey) return;
        }
        const studentsAfterSeed = await db.students.toArray();
        if (lastInitKeyRef.current !== myKey) return;
        if (studentsAfterSeed.length === 0) {
          setState({ status: "empty" });
          return;
        }
        const student = studentsAfterSeed[0]!;
        const { session, questions, poolStarved, starvedSkillIds } = await getOrCreateSession(student.id, {
          mode: effectiveMode,
          selectedSkillIds,
          fresh: freshParam != null,
        });
        if (lastInitKeyRef.current !== myKey) return;
        if (questions.length === 0) {
          const starvedSkillNames = (starvedSkillIds ?? [])
            .map((id) => SKILLS.find((s) => s.id === id)?.name)
            .filter((n): n is string => !!n);
          setState({ status: "empty", starved: !!poolStarved, starvedSkillNames });
          return;
        }
        const xp = await getTotalXp(student.id);
        setState({
          status: "running",
          session,
          questions,
          index: 0,
          studentId: student.id,
          xp,
          combo: 0,
          poolStarved,
        });
      } catch (e) {
        if (lastInitKeyRef.current !== myKey) return;
        setState({ status: "error", message: (e as Error).message });
      }
    })();
  }, [initKey, effectiveMode, freshParam, selectedSkillIds]);

  const handleSubmit = useCallback(
    async (result: AttemptResult) => {
      if (state.status !== "running") return { points: 0 };
      const { session, studentId, combo, questions, index } = state;
      const outcome = await submitAttempt({
        studentId,
        session,
        question: questions[index]!,
        userAnswer: result.answer,
        isCorrect: result.isCorrect,
        partialCorrect: result.partialCorrect,
        matchedErrorTags: result.matchedErrorTags,
        hintsOpened: result.hintsOpened,
        elapsedSeconds: result.elapsedSeconds,
        comboBeforeAttempt: combo,
      });
      setState((s) =>
        s.status === "running"
          ? { ...s, xp: s.xp + outcome.points, combo: outcome.comboAfter }
          : s,
      );
      if (outcome.comboAfter >= 3 && outcome.comboAfter % 3 === 0) sfx.combo();
      return {
        points: outcome.points,
        repeatDecay: outcome.repeatDecay,
        newSkillBonus: outcome.newSkillBonus,
        errorPattern: outcome.errorPattern,
      };
    },
    [state],
  );

  const finalizingRef = useRef(false);
  const handleNext = useCallback(async () => {
    if (state.status !== "running") return;
    const next = state.index + 1;
    if (next >= state.questions.length) {
      if (finalizingRef.current) return;
      finalizingRef.current = true;
      try {
        const summary = await finalizeSession(state.studentId, state.session.id);
        if (summary.levelAfter > summary.levelBefore) sfx.levelUp();
        // 考试模拟模式：记录完成时间用于一周节流
        if (effectiveMode === "mock_exam") {
          await recordMockExamCompleted(state.studentId);
        }
        setState({ status: "done", summary, studentId: state.studentId });
        // 后台静默上传到云端，不阻塞 UI
        pushToCloud().catch(() => {/* 忽略：失败下次再试 */});
        // 完成时智能补题：检查 fresh 题数，< 30 才触发；触发时跨 3 个最弱 skill
        // 各出 10 题，整出 30 道丰富新题。Selena 离开时不打扰，回来题库丰富。
        const allQs = await db.questions.toArray();
        const student = (await db.students.toArray())[0];
        if (student) {
          void triggerBgGenIfLow({
            subjectId: "math",
            studentId: student.id,
            skills: SKILLS,
            units: UNITS,
            seedQuestions: allQs.filter((q) => (q.subjectId ?? "math") === "math"),
            currentTerm: (student.currentTerm as "上册" | "下册") ?? "下册",
            preferredUnitId: student.currentUnitId,
            count: 10,
            multiSkillCount: 3,
          });
        }
      } catch (e) {
        setState({ status: "error", message: (e as Error).message });
      } finally {
        finalizingRef.current = false;
      }
    } else {
      setState({ ...state, index: next });
    }
  }, [state]);

  if (state.status === "loading") return <div className="card">准备今日挑战…</div>;
  if (state.status === "error") return <div className="card text-rose-300">出错了：{state.message}</div>;
  if (state.status === "empty") {
    /**
     * AutoGen 完成后 reload session。
     *
     * v0.26.10 修复：必须保留/重置 fresh=Date.now()，否则 getOrCreateSession 走
     * "resume existing" 会拿到 AutoGen 之前那个 questionIds=[] 的空 session，
     * 进入死循环（再次 empty → 再次 AutoGen）。
     *
     * 用 fresh 强制创建新 session，新 session 会从已经填充好的 db.questions 里挑题。
     */
    const reloadSession = () => {
      const newParams = new URLSearchParams(params);
      newParams.set("fresh", String(Date.now()));
      navigate({ search: `?${newParams.toString()}` }, { replace: true });
    };
    return <MathAutoGen reloadSession={reloadSession} preferredSkillId={selectedSkillIds?.[0]} starved={!!state.starved} />;
  }

  if (state.status === "done") {
    return <SummaryView summary={state.summary} />;
  }

  const question = state.questions[state.index]!;
  return (
    <GameShell
      question={question}
      index={state.index}
      total={state.questions.length}
      xp={state.xp}
      combo={state.combo}
      onSubmit={handleSubmit}
      onNext={handleNext}
      showStarter={state.index === 0}
      countdownEnabled={true}
      examMode={effectiveMode === "mock_exam"}
    />
  );
}

function SummaryView({ summary }: { summary: SessionSummary }) {
  const [chestOpened, setChestOpened] = useState(false);
  const [showTierCelebration, setShowTierCelebration] = useState(
    !!summary.tierUpgrade,
  );
  // 🎁 盲盒队列（Round 6 升级）：
  //   1. 段位升档（school→district 等）→ 队首，开 tier badge 盲盒
  //   2. rare check trophy（单次解锁）→ 100% 入队
  //   3. 计数型 trophy 在 milestone (1/5/10/25/50/100/...) 入队
  //   4. 普通增量解锁不入队（避免节奏被打断）
  const [lotteryQueue, setLotteryQueue] = useState<TrophyMeta[]>(() => {
    const out: TrophyMeta[] = [];
    const MILESTONES = new Set([1, 5, 10, 25, 50, 100, 200, 500]);

    // 1. 段位升档优先
    if (summary.tierUpgrade) {
      const newTier = tierById(summary.tierUpgrade.toTierId);
      if (newTier) {
        out.push({
          id: trophyImageKey("math", `tier_${newTier.id}`),
          subjectId: "math",
          name: `跨入 ${newTier.name}！`,
          icon: newTier.badgeIcon,
          description: newTier.unlockSlogan,
          rare: true,
        });
      }
    }

    // 2 + 3. trophy awards
    for (const aw of summary.newTrophies ?? []) {
      const def = TROPHIES.find((t) => t.id === aw.trophyId);
      if (!def) continue;
      const isRareAw = aw.isRare ?? typeof def.check === "function";
      const newTotal = aw.newTotalCount ?? 1;
      const shouldFire = isRareAw || MILESTONES.has(newTotal);
      if (!shouldFire) continue;
      out.push({
        id: trophyImageKey("math", def.id),
        subjectId: "math",
        name: newTotal > 1 ? `${def.name} ×${newTotal}` : def.name,
        icon: def.icon ?? "🏆",
        description: def.description,
        rare: isRareAw,
      });
    }
    return out;
  });
  const levelUp = summary.levelAfter > summary.levelBefore;
  const ratingDelta =
    summary.ratingBefore !== undefined && summary.ratingAfter !== undefined
      ? summary.ratingAfter - summary.ratingBefore
      : 0;
  const newTier = summary.tierUpgrade ? tierById(summary.tierUpgrade.toTierId) : null;

  return (
    <div className="space-y-5 pb-8">
      {/* 🎁 盲盒抽奖：稀有 trophy 解锁时优先播放 */}
      {lotteryQueue.length > 0 && (
        <LotteryBoxModal
          trophy={lotteryQueue[0]!}
          onClose={() => setLotteryQueue((prev) => prev.slice(1))}
        />
      )}
      {showTierCelebration && summary.tierUpgrade && (
        <UnlockCelebration
          fromTierId={summary.tierUpgrade.fromTierId}
          toTierId={summary.tierUpgrade.toTierId}
          onClose={() => setShowTierCelebration(false)}
        />
      )}
      <div className="text-center">
        <div className="text-xs text-slate-400 uppercase tracking-widest">
          {summary.dateKey}
        </div>
        <div className="font-display font-bold text-3xl mt-1 text-brand">
          完成啦！
        </div>
        <div className="mt-1 text-slate-300 text-sm">
          答对 {summary.correct} / {summary.total}，正确率 {Math.round(summary.accuracy * 100)}%
        </div>
      </div>

      {!chestOpened ? (
        <RewardChest onOpened={() => setChestOpened(true)} />
      ) : (
        <div className="space-y-4 animate-slide-up">
          {newTier && (
            <div className={`card-glow text-center bg-gradient-to-br ${newTier.theme.fromColor} ${newTier.theme.toColor} ${newTier.theme.borderColor}`}>
              <div className="text-5xl">{newTier.badgeIcon}</div>
              <div className={`font-display font-bold text-2xl mt-1 ${newTier.theme.textColor}`}>
                跨入 {newTier.name}！
              </div>
              <div className={`text-xs mt-1 ${newTier.theme.subTextColor}`}>{newTier.unlockSlogan}</div>
            </div>
          )}
          {ratingDelta > 0 && (
            <div className="card text-center bg-gradient-to-br from-cyan-500/15 to-sky-500/10 border-cyan-400/40">
              <div className="text-xs text-cyan-200/80 font-display">本学期累计 XP</div>
              <div className="font-display font-bold text-3xl text-cyan-100 mt-1 tabular-nums">
                {(summary.ratingBefore ?? 0).toLocaleString()} → {(summary.ratingAfter ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-cyan-200 mt-1 tabular-nums">+{ratingDelta.toLocaleString()} XP ✨</div>
            </div>
          )}
          {levelUp && (
            <div className="card-glow text-center bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-amber-400/40">
              <div className="text-5xl">🌟</div>
              <div className="font-display font-bold text-2xl mt-1 text-xp">升到 Lv {summary.levelAfter} 了！</div>
              <div className="text-xs text-amber-100 mt-1">Lv {summary.levelBefore} → Lv {summary.levelAfter}</div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="XP" value={`+${summary.xpGained}`} tone="amber" big />
            <StatCard label="最高连击" value={`× ${summary.maxCombo}`} tone="rose" />
            <StatCard label="最快一题" value={summary.fastestSeconds > 0 ? `${summary.fastestSeconds}s` : "-"} />
            <StatCard label="正确率" value={`${Math.round(summary.accuracy * 100)}%`} tone="emerald" />
          </div>

          {summary.newTrophies.length > 0 && (
            <div className="card-glow">
              <div className="font-display font-bold mb-2">🏆 新奖杯</div>
              <div className="flex flex-wrap gap-2">
                {summary.newTrophies.map((aw) => {
                  const t = trophyById(aw.trophyId);
                  // v0.29: tiered 勋章带 tier；commemorative/daily 没有
                  const tierLabel: Record<string, string> = {
                    bronze: "🥉 铜",
                    silver: "🥈 银",
                    gold: "🥇 金",
                    platinum: "💎 钻",
                  };
                  return (
                    <div
                      key={`${aw.trophyId}_${aw.tier ?? ""}`}
                      className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/40 rounded-xl px-3 py-1.5"
                    >
                      <TrophyIcon
                        trophyId={aw.trophyId}
                        subjectId="math"
                        emoji={t?.icon ?? "🏆"}
                        size="md"
                        tier={aw.tier}
                        category={t?.category}
                        glow
                      />
                      <div className="text-amber-100">
                        <div className="text-sm font-semibold">
                          {t?.name ?? aw.trophyId}
                          {aw.tier && (
                            <span className="ml-1 text-xs text-amber-300">{tierLabel[aw.tier]}</span>
                          )}
                        </div>
                        {aw.count > 1 && (
                          <span className="text-xs text-amber-300 font-display font-bold">× {aw.count}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {summary.masteryImprovements.length > 0 && (
            <div className="card">
              <div className="font-display font-bold mb-2">进步最大</div>
              <ul className="text-sm space-y-1 text-slate-200">
                {summary.masteryImprovements.map((i) => (
                  <li key={i.skillId} className="flex justify-between">
                    <span>{i.skillName}</span>
                    <span className="text-emerald-300 font-semibold">{i.from} → {i.to}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 justify-center pt-2">
            <Link to={`/math/train?fresh=${Date.now()}`} className="btn-primary">再来一把</Link>
            <Link to="/math" className="btn-secondary">回首页</Link>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * MathAutoGen — empty state 的小包装：读 student 拿到 currentTerm + studentId，
 * 然后传给 AutoGenerateOnEmpty 做正确的"按学期出题"。
 */
function MathAutoGen({
  reloadSession,
  preferredSkillId,
  starved,
}: {
  reloadSession: () => void;
  preferredSkillId: string | undefined;
  starved: boolean;
}) {
  const [studentInfo, setStudentInfo] = useState<{
    id: string;
    currentTerm: "上册" | "下册";
    currentUnitId: string | undefined;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const students = await db.students.toArray();
      const s = students[0];
      if (cancelled || !s) return;
      setStudentInfo({
        id: s.id,
        currentTerm: (s.currentTerm as "上册" | "下册") ?? "下册",
        currentUnitId: s.currentUnitId,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AutoGenerateOnEmpty
      subjectId="math"
      skills={SKILLS}
      units={UNITS}
      seedQuestions={[]}
      studentId={studentInfo?.id}
      currentTerm={studentInfo?.currentTerm ?? "下册"}
      preferredUnitId={studentInfo?.currentUnitId}
      onGenerated={reloadSession}
      autoStart={true}
      headlineText={
        starved
          ? "今天的题都被你做光啦！"
          : "题库还没准备好，让 AI 帮你出几道～"
      }
      // v0.27.1：自由练（preferredSkillId 已传）→ 单 skill 8 道；
      //          每日挑战（无 preferredSkillId）→ 跨 3 个最弱 skill 出 15 道综合题，
      //          这样首次进首页就拿到丰富多样的练习包，不再"今天只刷工程量/产量合计"。
      count={preferredSkillId ? 8 : 15}
      multiSkillCount={preferredSkillId ? 1 : 3}
      preferredSkillId={preferredSkillId}
    />
  );
}

function StatCard({
  label,
  value,
  tone = "violet",
  big,
}: {
  label: string;
  value: string;
  tone?: "violet" | "amber" | "rose" | "emerald";
  big?: boolean;
}) {
  const toneMap = {
    violet: "from-violet-500/20 to-fuchsia-500/10 border-violet-400/30 text-violet-100",
    amber: "from-amber-500/20 to-orange-500/10 border-amber-400/30 text-amber-100",
    rose: "from-rose-500/20 to-pink-500/10 border-rose-400/30 text-rose-100",
    emerald: "from-emerald-500/20 to-teal-500/10 border-emerald-400/30 text-emerald-100",
  }[tone];
  return (
    <div className={`rounded-2xl border p-3 bg-gradient-to-br ${toneMap} text-center`}>
      <div className="text-[11px] uppercase tracking-widest opacity-80">{label}</div>
      <div className={`font-display font-bold ${big ? "text-3xl" : "text-xl"} mt-1`}>{value}</div>
    </div>
  );
}
