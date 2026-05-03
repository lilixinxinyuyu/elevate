import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../db/dexie";
import { ensureSeeded } from "../db/seed";
import { finalizeSession, getOrCreateSession, getTotalXp, submitAttempt, trophyById } from "../db/service";
import type { DailySession, Question, SessionMode, SessionSummary } from "../core/types";
import { GameShell, type AttemptResult } from "../components/game/GameShell";
import { RewardChest } from "../components/game/RewardChest";
import { sfx } from "../lib/sfx";
import { ABILITY_LABELS } from "../core/types";
import { levelFromXp } from "../core/scoring";
import { SKILLS } from "../content/skills";
import { pushToCloud } from "../db/cloudSync";
import { UnlockCelebration } from "../components/UnlockCelebration";
import { tierById } from "../core/tiers";

export function TrainPage() {
  const [params] = useSearchParams();
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
        setState({ status: "done", summary, studentId: state.studentId });
        // 后台静默上传到云端，不阻塞 UI
        pushToCloud().catch(() => {/* 忽略：失败下次再试 */});
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
    if (state.starved) {
      return (
        <div className="card-glow border-amber-400/50 bg-gradient-to-br from-amber-500/15 to-rose-500/10">
          <div className="text-3xl text-center">🌟</div>
          <div className="font-display font-bold text-amber-100 text-xl text-center mt-2">
            Selena，今天的题都被你做光啦！
          </div>
          <div className="text-sm text-amber-200/90 text-center mt-2">
            说明你已经很熟练了。让爸爸 / 妈妈给你出几道<span className="font-bold">新</span>的吧～
          </div>
          {(state.starvedSkillNames ?? []).length > 0 && (
            <div className="text-xs text-amber-200/70 text-center mt-2">
              重点想再练：{state.starvedSkillNames!.slice(0, 4).join("、")}
            </div>
          )}
          <div className="flex gap-3 justify-center mt-4">
            <Link to="/admin" className="btn-primary text-sm">去 AI 出题</Link>
            <Link to="/" className="btn-secondary text-sm">回首页</Link>
          </div>
        </div>
      );
    }
    return (
      <div className="card">
        <div className="font-semibold mb-2">暂无可用题目</div>
        <div className="text-sm text-slate-400">
          先到<Link to="/admin" className="text-violet-300">管理页</Link>补一下题库。
        </div>
      </div>
    );
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
    />
  );
}

function SummaryView({ summary }: { summary: SessionSummary }) {
  const [chestOpened, setChestOpened] = useState(false);
  const [showTierCelebration, setShowTierCelebration] = useState(
    !!summary.tierUpgrade,
  );
  const levelUp = summary.levelAfter > summary.levelBefore;
  const ratingDelta =
    summary.ratingBefore !== undefined && summary.ratingAfter !== undefined
      ? summary.ratingAfter - summary.ratingBefore
      : 0;
  const newTier = summary.tierUpgrade ? tierById(summary.tierUpgrade.toTierId) : null;

  return (
    <div className="space-y-5 pb-8">
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
                  return (
                    <span key={aw.trophyId} className="chip bg-amber-500/20 text-amber-100 border border-amber-400/40 px-3 py-1.5">
                      <span className="mr-1">{t?.icon ?? "🏆"}</span>
                      {t?.name ?? aw.trophyId}
                      {aw.count > 1 && (
                        <span className="ml-2 text-amber-300 font-display font-bold">× {aw.count}</span>
                      )}
                    </span>
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
            <Link to={`/train?fresh=${Date.now()}`} className="btn-primary">再来一把</Link>
            <Link to="/" className="btn-secondary">回首页</Link>
          </div>
        </div>
      )}
    </div>
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
