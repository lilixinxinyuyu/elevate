import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../db/dexie";
import { ensureSeeded } from "../db/seed";
import { finalizeSession, getOrCreateSession, getTotalXp, submitAttempt, trophyById, recordMockExamCompleted } from "../db/service";
import { isMockExamReportV1 } from "../lib/featureFlags";
import type { DailySession, Question, SessionMode, SessionSummary } from "../core/types";
import { GameShell, type AttemptResult } from "../components/game/GameShell";
import { RewardChest } from "../components/game/RewardChest";
import { TutorPanel } from "../components/tutor/TutorPanel";
import { sfx } from "../lib/sfx";
import { ABILITY_LABELS } from "../core/types";
import { levelFromXp } from "../core/scoring";
import { findParallelQuestion } from "../core/scheduler";
import { isWriteHeavyQuestion } from "../games/questionCapabilities";
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
import { CelebrationBurst, type BurstKind } from "../components/CelebrationBurst";
import { ATELIER_REALMS, type AtelierRealmId } from "../content/atelier/realms";
import { addInspiration, recordRealmCompletion } from "../lib/atelier/atelierProgress";
import { MascotPIP } from "../components/atelier/MascotPIP";
import type { MascotEmotion, MascotGesture } from "../components/Mascot3D";

export function TrainPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mode = (params.get("mode") as SessionMode | null) ?? "normal";
  const freshParam = params.get("fresh");
  const skillIdSingle = params.get("skillId");
  const skillIdsParam = params.get("skillIds");
  // v0.35.10: mock_exam ExamPrep dashboard 传 ?size=30|60|80 & ?hard=0|1
  const sizeParam = params.get("size");
  const hardParam = params.get("hard");
  const overrideTargetCount = useMemo(() => {
    if (mode !== "mock_exam" || !sizeParam) return undefined;
    const n = parseInt(sizeParam, 10);
    if (!Number.isFinite(n) || n < 20) return undefined;
    return Math.min(100, n);
  }, [mode, sizeParam]);
  const hardTimeLimit = hardParam === "1";
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

  // v0.31.71: 正反馈密度引擎状态
  //   - consecutiveWrong：连续答错计数（答对 reset 0），用于触发"鼓励"节点
  //   - manualBurst：显式触发其他节点（session_win），递增 nonce 即可
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);

  // v0.32.9 沙箱：工坊 session 才显示的 Mascot PIP 反应状态
  const fromAtelierForPIP = params.get("fromAtelier") as AtelierRealmId | null;
  const atelierRealmForPIP = fromAtelierForPIP ? ATELIER_REALMS.find((r) => r.id === fromAtelierForPIP) : null;
  const [pipState, setPipState] = useState<{ gesture: MascotGesture; emotion: MascotEmotion; line?: string }>({
    gesture: "idle",
    emotion: "happy",
  });
  const [manualBurst, setManualBurst] = useState<{ kind: BurstKind; nonce: number }>({
    kind: "first_correct",
    nonce: 0,
  });

  // 唯一标识本次"想要的训练"——只有 URL 真的改变才重新建会话；HMR / 重渲染都不会重置。
  const initKey = useMemo(
    () => `${effectiveMode}::${selectedSkillIds?.join(",") ?? ""}::${params.get("unitId") ?? ""}::${freshParam ?? ""}::${sizeParam ?? ""}::${hardParam ?? ""}`,
    [effectiveMode, selectedSkillIds, freshParam, params, sizeParam, hardParam],
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
          unitId: params.get("unitId") ?? undefined,
          overrideTargetCount,
          hardTimeLimit,
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
    // v0.30.8: 第二参数 currentQuestion = GameShell 当前真实在答的题
    //   - 默认 = state.questions[index]（原题）
    //   - 1st 错答 retry 后变式题 = 不同的 questionId
    // 用 currentQuestion 优先决定提交给 submitAttempt 的 question，避免
    // "学生在变式题上答对，记账却记到了原题"的 bug。
    async (result: AttemptResult, currentQuestion?: Question) => {
      if (state.status !== "running") return { points: 0 };
      const { session, studentId, combo, questions, index } = state;
      const submittedQuestion = currentQuestion ?? questions[index]!;
      const outcome = await submitAttempt({
        studentId,
        session,
        question: submittedQuestion,
        userAnswer: result.answer,
        isCorrect: result.isCorrect,
        partialCorrect: result.partialCorrect,
        matchedErrorTags: result.matchedErrorTags,
        hintsOpened: result.hintsOpened,
        elapsedSeconds: result.elapsedSeconds,
        comboBeforeAttempt: combo,
        // v0.30.7: tutor-assisted + ordinal 透传给 service.submitAttempt
        usedTutor: result.usedTutor,
        attemptOrdinal: result.attemptOrdinal,
        // v0.34.99 iter 33 P0-1: EstimationGate 完成数据落 attempt.metadata
        estimationGate: result.estimationGate,
        // v0.35.0 iter 34 P0-2: ScratchInsurance 数据落 attempt.metadata + 触发 insured-wrong XP bypass
        scratch: result.scratch,
        // v0.35.1 iter 35 P0-3: MultiStepApplication 数据落 attempt.metadata
        multiStep: result.multiStep,
        // v0.35.10 iter 41 (爸爸反馈): CanvasScratch 数据落 attempt.metadata
        canvasScratch: result.canvasScratch,
      });
      setState((s) =>
        s.status === "running"
          ? { ...s, xp: s.xp + outcome.points, combo: outcome.comboAfter }
          : s,
      );
      if (outcome.comboAfter >= 3 && outcome.comboAfter % 3 === 0) sfx.combo();

      // v0.31.71: 正反馈密度 —— 答对清零连错计数，答错累加（>=2 触发鼓励 burst）
      if (result.isCorrect) {
        setConsecutiveWrong(0);
      } else {
        setConsecutiveWrong((w) => w + 1);
      }

      // v0.32.9 工坊 PIP 反应（仅在 atelier session 时生效）
      if (atelierRealmForPIP) {
        if (result.isCorrect) {
          const correctReactions: { gesture: MascotGesture; line: string }[] = [
            { gesture: "thumbsUp", line: "棒！" },
            { gesture: "wave", line: "对啦～" },
            { gesture: "nod", line: "👏" },
            { gesture: "cheer", line: "✨ Yes!" },
          ];
          const r = correctReactions[Math.floor(Math.random() * correctReactions.length)]!;
          setPipState({ gesture: r.gesture, emotion: "happy", line: r.line });
        } else {
          const wrongReactions: { gesture: MascotGesture; emotion: MascotEmotion; line: string }[] = [
            { gesture: "shake", emotion: "sad", line: "再想想？" },
            { gesture: "nod", emotion: "confused", line: "差一点～" },
            { gesture: "shake", emotion: "confused", line: "我们一起再看看" },
          ];
          const r = wrongReactions[Math.floor(Math.random() * wrongReactions.length)]!;
          setPipState({ gesture: r.gesture, emotion: r.emotion, line: r.line });
        }
        // 2.5s 后 PIP 恢复 idle
        setTimeout(() => {
          setPipState({ gesture: "idle", emotion: "happy" });
        }, 2500);
      }
      return {
        points: outcome.points,
        repeatDecay: outcome.repeatDecay,
        newSkillBonus: outcome.newSkillBonus,
        errorPattern: outcome.errorPattern,
      };
    },
    [state],
  );

  /**
   * v0.30.8: 1st 错答后帮 GameShell 找一道"同型同难度"的变式题给重做用。
   *
   * 数据源：
   *   - 主池：当前 session 已加载 + db.questions 全表
   *   - 排除：原题、本 session 已经做过的、本 session 还要做的（防提前消费 + 防剧透）
   *   - 优先：用户没见过的（attemptCounts undefined or 0）→ 见的最少的
   *
   * 没找到 → 返回 null → GameShell 退化成"原题重做"（向后兼容）
   * 异步执行（DB query 调用），但通常 < 100ms（题库 ~900 道）
   */
  const handleRequestVariant = useCallback(
    async (original: Question): Promise<Question | null> => {
      if (state.status !== "running") return null;
      try {
        const { studentId, session, questions: sessionQs } = state;
        const allQs = await db.questions.toArray();
        // 已经在本 session 做过的（attempts 表查 sessionId）—— 必须排除（不重复出题）
        const sessionAttempts = await db.attempts.where({ sessionId: session.id }).toArray();
        const attemptedInSession = new Set(sessionAttempts.map((a) => a.questionId));
        // v0.31.17 取消"排除 sessionPlannedIds"：用户的核心诉求是"重做绝不能看到刚做过的题"，
        // 这比"保持 session 排队 15 道完整"更重要。如果变式题恰好命中后续 plan 里的题，
        // 我们把它从 plan 里 splice 掉（防止稍后又被作为正题看到一次）。
        const plannedSet = new Set(sessionQs.map((q) => q.question_id));
        const exclude = new Set<string>([...attemptedInSession]);
        // 全用户历史 attempt 计数（少见的题优先）
        const allAttempts = await db.attempts.where({ studentId }).toArray();
        const attemptCounts = new Map<string, number>();
        for (const a of allAttempts) {
          attemptCounts.set(a.questionId, (attemptCounts.get(a.questionId) ?? 0) + 1);
        }
        const variant = findParallelQuestion(original, allQs, exclude, attemptCounts);
        // 命中后续 plan 里的题 → 从 questions 数组里 splice 掉，否则后面 handleNext 推到那个 idx
        // 时会再露脸一次
        if (variant && plannedSet.has(variant.question_id)) {
          setState((s) => {
            if (s.status !== "running") return s;
            const removeAt = s.questions.findIndex(
              (q, i) => i > s.index && q.question_id === variant.question_id,
            );
            if (removeAt < 0) return s;
            const newQuestions = s.questions.slice();
            newQuestions.splice(removeAt, 1);
            return { ...s, questions: newQuestions };
          });
        }
        return variant;
      } catch (e) {
        console.warn("[handleRequestVariant] failed", e);
        return null;
      }
    },
    [state],
  );

  /**
   * v0.31.38: AI 生成的"再出一道类似的 / 加难度"的题真插进当前 session 的队列。
   * sessionAdaptive 已经把题写入 db.questions（带 ai_generated/session_adaptive tag），
   * 这里再把它 splice 进 state.questions[index+1]，下一次 handleNext 切到的就是这道。
   *
   * 一道题一次 inject — 防止用户连点 2 次插出 2 道。
   */
  const handleInjectQuestion = useCallback((q: Question) => {
    setState((s) => {
      if (s.status !== "running") return s;
      // 防重：已经有同 id 的待答题就不再插
      const existsAfterCursor = s.questions.findIndex(
        (x, i) => i > s.index && x.question_id === q.question_id,
      );
      if (existsAfterCursor >= 0) return s;
      const newQuestions = s.questions.slice();
      newQuestions.splice(s.index + 1, 0, q);
      return { ...s, questions: newQuestions };
    });
  }, []);

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
        // 考试模拟模式：记录完成时间用于一周节流 + 跳成绩分析报告 (v0.35.7 iter 41 P2-2)
        if (effectiveMode === "mock_exam") {
          await recordMockExamCompleted(state.studentId);
          // 跳转到成绩分析页 (sessionId 透传, isMockExamReportV1 默认 ON)
          if (isMockExamReportV1()) {
            navigate(`/math/mock-report?sessionId=${state.session.id}`);
            return; // 不再走 done state, 直接由 report page 渲染
          }
        }
        // v0.32.9: 沙箱版工坊 — 如果本次 session 从工坊启动，给灵感 + 记录 realm 完成
        const fromAtelier = params.get("fromAtelier") as AtelierRealmId | null;
        if (fromAtelier && ATELIER_REALMS.some((r) => r.id === fromAtelier)) {
          const correct = summary.correct;
          const total = summary.total;
          const inspirationDelta = correct + (correct === total && total > 0 ? 3 : 0);
          await addInspiration(inspirationDelta);
          const stars: 1 | 2 | 3 = summary.accuracy >= 0.95 ? 3 : summary.accuracy >= 0.7 ? 2 : 1;
          await recordRealmCompletion(fromAtelier, stars);
        }
        setState({ status: "done", summary, studentId: state.studentId });
        // v0.31.71: session 完成 → 触发 session_win burst（在 SummaryView 出现前的"凯旋"瞬间）
        setManualBurst((b) => ({ kind: "session_win", nonce: b.nonce + 1 }));
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
    <>
      {/* v0.32.9 工坊 session 顶部"回工坊"逃生入口（主路径 train 无 fromAtelier 时不显示） */}
      {atelierRealmForPIP && (
        <Link
          to="/math/atelier"
          className="fixed top-3 right-3 z-30 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm border shadow-lg hover:scale-105 transition"
          style={{
            background: `linear-gradient(135deg, ${atelierRealmForPIP.accent.color}cc, ${atelierRealmForPIP.accent.color}77)`,
            borderColor: atelierRealmForPIP.accent.color + "aa",
            color: "#fff",
          }}
        >
          🏠 回工坊
        </Link>
      )}
      {/* v0.35.30 (爸爸第 5 次反馈: Selena 不知今天为啥 17 题): mode label
          让用户清楚是哪个 session 类型 + 多少题. 防混淆"今日挑战 ≠ 期末冲刺". */}
      <div className="max-w-md mx-auto px-1 mb-1 flex items-center gap-2 text-xs text-slate-400">
        <span className="px-2 py-0.5 rounded bg-slate-800/60 border border-slate-500/30">
          {effectiveMode === "mock_exam" ? "📝 模拟考"
            : effectiveMode === "final_sprint" ? "🚀 期末冲刺"
            : effectiveMode === "midterm" ? "⏰ 期中冲刺"
            : effectiveMode === "skill" ? "🎯 专项练"
            : effectiveMode === "big_problems" ? "🐺 闯关"
            : effectiveMode === "review" ? "🔁 错题复习"
            : "✨ 今日挑战"}
        </span>
        <span className="text-slate-400">共 {state.questions.length} 道</span>
      </div>
      <GameShell
        question={question}
        index={state.index}
        total={state.questions.length}
        xp={state.xp}
        combo={state.combo}
        onSubmit={handleSubmit}
        onNext={handleNext}
        showStarter={state.index === 0}
        // v0.31.38: 闯关 (big_problems) 不限时
        // v0.35.26 (爸爸 explicit): write-heavy 题 (canvas_scratch / multi_step_application /
        // requiresScratch / requiresMultiStep) 不开 countdown — 电脑书写慢,
        // 倒计时变成"逼孩子心算" 反向激励 (爸爸反馈过 2 次).
        // v0.35.32: 散落判定收到 games/questionCapabilities.ts 单一真相源.
        // mock_exam 硬限时 仍走 examMode 路径 (不被这个 short-circuit 影响).
        countdownEnabled={(() => {
          if (effectiveMode === "big_problems") return false;
          const q = state.questions[state.index];
          if (q && isWriteHeavyQuestion(q)) return false;
          return true;
        })()}
        examMode={effectiveMode === "mock_exam"}
        onRequestVariant={handleRequestVariant}
        onInjectQuestion={handleInjectQuestion}
      />
      {/* v0.31.71: 正反馈密度引擎 —— combo 5/10/20 burst + 连续 2 错鼓励 + session 完成凯旋 */}
      <CelebrationBurst
        combo={state.combo}
        consecutiveWrong={consecutiveWrong}
        manualTrigger={manualBurst}
      />
      {/* v0.32.9 工坊 session 才有 Mascot PIP — 答题时小进在右下角陪伴 + 答对/答错给反应 */}
      {atelierRealmForPIP && (
        <MascotPIP
          gesture={pipState.gesture}
          emotion={pipState.emotion}
          outfit={atelierRealmForPIP.xiaojinOutfit}
          skin={atelierRealmForPIP.xiaojinSkin}
          line={pipState.line}
          accent={atelierRealmForPIP.accent.color}
        />
      )}
    </>
  );
}

function SummaryView({ summary }: { summary: SessionSummary }) {
  // v0.32.9 工坊沙箱：如果本次 session 是从 atelier 启动的，summary 卡片要给"回工坊"按钮
  const [searchParams] = useSearchParams();
  const fromAtelier = searchParams.get("fromAtelier") as AtelierRealmId | null;
  const fromRealm = fromAtelier ? ATELIER_REALMS.find((r) => r.id === fromAtelier) : null;
  const inspirationEarned = fromRealm
    ? summary.correct + (summary.correct === summary.total && summary.total > 0 ? 3 : 0)
    : 0;
  const [chestOpened, setChestOpened] = useState(false);
  const [showTierCelebration, setShowTierCelebration] = useState(
    !!summary.tierUpgrade,
  );
  // 跟小进总结今天的对话面板
  const [reviewTutorOpen, setReviewTutorOpen] = useState(false);
  // 🎁 盲盒队列（v0.29.2 重写规则）：
  //
  //   触发条件（什么时候弹盲盒）：
  //     ✅ 段位升档（school→district 等）       → mode=generate（生成段位 badge 图）
  //     ✅ commemorative 首次解锁（第一步等）  → mode=generate（生成专属图）
  //     ✅ daily trophy 首次解锁 (count=1)    → mode=generate（生成专属图）
  //     ✅ tiered 勋章升钻 (platinum)          → mode=reveal-only（图已存在，弹庆祝）
  //     🚫 tiered 升金 (gold)                  → 不入队，只在"新奖杯"卡片里高亮
  //     🚫 tiered 升铜/银                       → 静默（角标更新就好）
  //     🚫 daily 累计 (count > 1)              → 静默（避免每 5 次都弹打断节奏）
  //
  //   新规则核心：盲盒 = "真正不可重得的事件" 或 "本学期级里程碑"。
  //   减少打扰频率 + 同 prop 区分新生成/已存在图（reveal-only 走快路径）。
  type QueueItem = {
    trophy: TrophyMeta;
    mode: "generate" | "reveal-only";
    subtitle?: string;
  };
  const [lotteryQueue, setLotteryQueue] = useState<QueueItem[]>(() => {
    const out: QueueItem[] = [];

    // 1. 段位升档（v0.31.11 改）：
    //    之前 mode="generate" 强制重画 tier_${id} → 出来跟桌上段位徽章一模一样，
    //    没有"纪念解锁"的感觉。现在改成 reveal-only：弹一个庆祝展示已有的段位徽章，
    //    真正的"专属纪念勋章"由 enter_${id} commemorative 走"trophy awards"分支
    //    自然颁发（六角星 + 登阶/跃升 motif），跟段位徽章圆形 emblem 视觉上完全分开。
    if (summary.tierUpgrade) {
      const newTier = tierById(summary.tierUpgrade.toTierId);
      if (newTier) {
        out.push({
          trophy: {
            id: trophyImageKey("math", `tier_${newTier.id}`),
            subjectId: "math",
            name: `${newTier.name} 段位徽章`,
            icon: newTier.badgeIcon,
            description: newTier.unlockSlogan,
            rare: true,
          },
          mode: "reveal-only",
          subtitle: "你正式佩戴上新段位徽章 ✨",
        });
      }
    }

    // 2. trophy awards 按规则筛选
    for (const aw of summary.newTrophies ?? []) {
      const def = TROPHIES.find((t) => t.id === aw.trophyId);
      if (!def) continue;
      const newTotal = aw.newTotalCount ?? 1;

      // commemorative 首次解锁 → 生成专属图
      if (def.category === "commemorative" && newTotal === 1) {
        out.push({
          trophy: {
            id: trophyImageKey("math", def.id),
            subjectId: "math",
            name: def.name,
            icon: def.icon ?? "🏆",
            description: def.description,
            rare: true,
            category: def.category,
          },
          mode: "generate",
        });
        continue;
      }

      // tiered 升钻 → 已有图，弹庆祝（reveal-only）
      if (aw.tier === "platinum") {
        out.push({
          trophy: {
            id: trophyImageKey("math", def.id),
            subjectId: "math",
            name: `${def.name} · 钻石档`,
            icon: def.icon ?? "💎",
            description: `本学期最高荣誉解锁！${def.description}`,
            rare: true,
            category: def.category,
            tier: "platinum",
          },
          mode: "reveal-only",
          subtitle: "你拿到了本学期级别的最高荣誉 💎",
        });
        continue;
      }

      // daily trophy 首次解锁 (count=1) → 生成专属图
      if (def.category === "daily" && newTotal === 1) {
        out.push({
          trophy: {
            id: trophyImageKey("math", def.id),
            subjectId: "math",
            name: def.name,
            icon: def.icon ?? "🏆",
            description: def.description,
            rare: true,
            category: def.category,
          },
          mode: "generate",
        });
        continue;
      }

      // 其他（金/银/铜 tier、daily count>1）→ 静默或 inline 处理
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
          trophy={lotteryQueue[0]!.trophy}
          mode={lotteryQueue[0]!.mode}
          subtitle={lotteryQueue[0]!.subtitle}
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
        {/* v0.30.7: 区分"独立答对"和"讲题后答对"，避免统计撒谎 */}
        {(summary.firstTryCorrectCount != null || (summary.tutorAssistedCount ?? 0) > 0) && (
          <div className="mt-1.5 text-xs text-slate-400 inline-flex items-center gap-2 flex-wrap justify-center">
            {summary.firstTryCorrectCount != null && (
              <span>
                <span className="text-emerald-300 font-display font-bold">
                  {summary.firstTryCorrectCount}
                </span>{" "}
                道一遍就对
              </span>
            )}
            {(summary.tutorAssistedCount ?? 0) > 0 && (
              <>
                <span className="opacity-30">·</span>
                <span>
                  <span className="text-amber-300 font-display font-bold">
                    {summary.tutorAssistedCount}
                  </span>{" "}
                  道讲题后才对
                </span>
              </>
            )}
          </div>
        )}
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

          {/* v0.32.9 沙箱：从工坊启动 → top banner 显示获得灵感 + 回工坊按钮 */}
          {fromRealm && (
            <div
              className="card-glow border-2 mb-3"
              style={{
                borderColor: fromRealm.accent.color + "88",
                background: `linear-gradient(135deg, ${fromRealm.accent.grad[0]}, ${fromRealm.accent.grad[1]})`,
              }}
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">{fromRealm.emoji}</div>
                <div className="flex-1">
                  <div className="font-display font-bold text-base text-slate-50">
                    完成 {fromRealm.name} 探险！
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    小进给你 <span className="font-mono text-amber-300 font-bold">+{inspirationEarned}</span> 灵感
                    {summary.correct === summary.total && summary.total > 0 && (
                      <span className="text-amber-200 ml-2">（全对加 3 ✨）</span>
                    )}
                  </div>
                </div>
                <Link
                  to={`/math/atelier?just=${inspirationEarned}&realm=${fromRealm.id}`}
                  className="btn-primary text-sm px-3 py-1.5 shrink-0"
                  style={{ background: `linear-gradient(135deg, ${fromRealm.accent.color}, ${fromRealm.accent.color}cc)` }}
                >
                  🏠 回工坊
                </Link>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-center pt-2 flex-wrap">
            <button
              type="button"
              onClick={() => setReviewTutorOpen(true)}
              className="btn-secondary border-amber-400/40 text-amber-100 bg-amber-500/15 hover:bg-amber-500/30"
            >
              👩‍🏫 跟小进总结今天
            </button>
            <Link to={`/math/train?fresh=${Date.now()}`} className="btn-primary">再来一把</Link>
            <Link to="/math" className="btn-secondary">回首页</Link>
          </div>
        </div>
      )}

      {reviewTutorOpen && (
        <SummaryReviewTutor onClose={() => setReviewTutorOpen(false)} />
      )}
    </div>
  );
}

/** 包装：拿 studentId 给 SummaryView 的"跟小进总结"按钮用 */
function SummaryReviewTutor({ onClose }: { onClose: () => void }) {
  const [studentId, setStudentId] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const ss = await db.students.toArray();
      setStudentId(ss[0]?.id ?? null);
    })();
  }, []);
  if (!studentId) return null;
  return (
    <TutorPanel
      subjectId="math"
      context="review_session"
      studentId={studentId}
      onClose={onClose}
    />
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
