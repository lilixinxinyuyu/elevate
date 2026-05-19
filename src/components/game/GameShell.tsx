import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CountdownBar } from "./CountdownBar";
import { speedBonus } from "../../core/scoring";
import { adjustedEstimatedTime } from "../../core/timing";
import { ComboBadge } from "./ComboBadge";
import { XpBar } from "./XpBar";
import { HintLadder } from "./HintLadder";
import { FloatLayer, makeBurst, makeFloater, type Floater } from "./FloatPlus";
import { StarterOverlay } from "./StarterOverlay";
import { sfx } from "../../lib/sfx";
// v0.35.52: TutorPanel 不再在 GameShell 直接用 (FeedbackPanel / RetryHintPanel 内部 import)
import { ReportQuestionButton } from "./ReportQuestionButton";
import type { Question } from "../../core/types";
// v0.34.99 iter 33 P0-1: EstimationGate 元认知前置
import { EstimationGate, type EstimationCompleteSignal } from "./EstimationGate";
import { requiresEstimation } from "../../core/estimationPolicy";
// v0.35.0 iter 34 P0-2: ScratchInsurance
import { ScratchPanel, ScratchInterceptDialog, type ScratchState } from "./ScratchPanel";
import {
  requiresScratch,
  useMentalCalcQuota,
  getMentalCalcRemaining,
  hasShownInterceptThisSession,
  markInterceptShown,
} from "../../core/scratchPolicy";
// v0.35.3 iter 37 P1-2: 强化挑战 inline CTA
import { StrengthenInlineCTA } from "./StrengthenModal";
import {
  isStrengthenOpportunity,
  pickStrengthSkillContext,
} from "../../core/strengthenPolicy";
// v0.35.6 iter 40 P2-1: 稳准挑战 banner
import { SteadyAimBanner } from "../SteadyAim";
// v0.35.47 Refactor Priority 14: 22 panel imports + GAME_TEMPLATES + pickPanel +
// templateTitle 迁到 ./templateRegistry. GameShell 只引用 registry 入口.
import { GAME_TEMPLATES, pickPanel, templateTitle } from "./templateRegistry";
// v0.35.49 Refactor Priority 16: answer describe 纯函数
import { describeAnswer, describeUserAnswer } from "./answerDescribe";
// v0.35.50 Refactor Priority 17: RetryHintPanel 子组件
import { RetryHintPanel } from "./RetryHintPanel";
// v0.35.52 Refactor Priority 18: FeedbackPanel 子组件
import { FeedbackPanel } from "./FeedbackPanel";
import { resolveTemplate } from "./templates/resolve";
// v0.35.32 Refactor Priority 1: GameTemplate Capabilities SSOT
import { suppressesExternalScratchTools } from "../../core/templateCapabilities";
import type { GameTemplate } from "../../core/types";
// v0.35.36 Refactor Priority 4: ErrorBoundary 兜底 unknown templateId
import { GameErrorBoundary } from "../common/GameErrorBoundary";

// v0.35.53 Refactor Priority 19: AttemptResult / TemplateRenderProps / TriggerFx
// 迁到 ./templates/types.ts (SSOT). GameShell re-export 保持 24 个 template
// 文件 + 上游 Train.tsx import "./GameShell" 完全兼容.
// 注: 同时再 import 一遍 (作为 value namespace 名字), 让 GameShell 内部 typed 引用有效.
import type { AttemptResult, TemplateRenderProps, TriggerFx } from "./templates/types";
export type { AttemptResult, TemplateRenderProps, TriggerFx };

export interface GameShellProps {
  question: Question;
  index: number;
  total: number;
  xp: number;
  combo: number;
  /**
   * v0.30.8: onSubmit 第二参数 — 这次提交针对的是哪道题？
   * 默认 = props.question（首次答题、或没有变式题的同题重做）
   * 提供 = displayedQuestion（变式题：1st 错答后换的同型同难度新题）
   * Train.tsx 的 handleSubmit 用这个参数定 submitAttempt 的 question；
   * 不提供时 fallback 到 props.question。
   */
  onSubmit: (result: AttemptResult, currentQuestion?: Question) => Promise<{
    points: number;
    repeatDecay?: number;
    newSkillBonus?: number;
    /** v0.34.98 iter 32 P0-0a: Accuracy-First UI nudge flags */
    tooFast?: boolean;
    slowThink?: boolean;
    /** v0.35.0 iter 34 P0-2: ScratchInsurance bypass UI flag */
    insuredWrong?: boolean;
    /** 错题故事：本次错答命中的 errorTag 在历史上踩过几次 + 踩过的题 */
    errorPattern?: {
      matchedTag: string;
      tagLabel: string;
      remediation: string | null;
      pastQuestions: { questionId: string; stem: string; happenedAt: number }[];
    } | null;
  }>;
  onNext: () => void;
  showStarter?: boolean;
  countdownEnabled: boolean;
  /** 考试模拟模式：禁用提示、不允许 retry。 */
  examMode?: boolean;
  /**
   * v0.31.83: 闯关 boss 战专用 — 禁用"1st 错答 silent + RetryHintPanel + 变式重做"
   * 链路。1st 答错就是最终结果，没有第二次机会。
   *
   * 跟 examMode 的区别：noRetry 只关 retry 链路，hints / autoRevealHint / 救场
   * 等 boss-specific 提示通道仍可用。examMode 还会禁用所有 inline hints + countdown。
   */
  noRetry?: boolean;
  /**
   * v0.30.8: 1st 错答后异步搜一道同型同难度变式题给重做用。
   * 返回 null → fallback 到原题重做（向后兼容老行为）。
   * GameShell 在 1st 错答静默入库后立刻调用，等 RetryHintPanel 期间结果就绪；
   * 用户点"再做一次"时直接 swap displayedQuestion 到变式题。
   */
  onRequestVariant?: (original: Question) => Promise<Question | null>;
  /**
   * v0.31.38: 把生成的"再出一道类似的 / 加难度"的题真插进 session 队列。
   * Train.tsx 在 state.questions[index+1] 处 splice，下一次 handleNext 就是这道。
   * 之前 sessionAdaptive 只写 db.questions，没有改 session.questions → 用户看到旧 plan 里的下一题。
   */
  onInjectQuestion?: (q: Question) => void;
}

// v0.35.53 Refactor: TemplateRenderProps + TriggerFx 迁到 ./templates/types.ts
// (re-export 在文件头部, 跟 AttemptResult 一起).

export function GameShell(props: GameShellProps) {
  const { question, index, total, xp, combo, onSubmit, onNext, showStarter, countdownEnabled, examMode, noRetry, onRequestVariant, onInjectQuestion } = props;
  const resetKey = `${question.question_id}:${index}`;
  // v0.30.8: 当前在 TemplatePanel 里"渲染并接受答题"的题
  // - 默认 = props.question（原题）
  // - 1st 错答后，若拿到变式题就 swap 成变式题
  // - tutor / RetryHintPanel 始终使用原题，让讲解针对错的那题
  const [displayedQuestion, setDisplayedQuestion] = useState<Question>(question);
  const variantRef = useRef<Question | null>(null);
  const [starterDone, setStarterDone] = useState(!showStarter);
  // v0.34.99 iter 33 P0-1: EstimationGate state
  const [estDone, setEstDone] = useState(false);
  const [estSignal, setEstSignal] = useState<EstimationCompleteSignal | null>(null);
  // v0.35.0 iter 34 P0-2: Scratch state
  const [scratchState, setScratchState] = useState<ScratchState>({
    tool: "none",
    textContent: "",
    insured: false,
    mentalOverrideUsed: false,
    charCount: 0,
  });
  const [pendingSubmit, setPendingSubmit] = useState<AttemptResult | null>(null);
  // v0.35.3 iter 37 P1-2: 强化挑战 inline CTA dismiss 状态
  const [strengthenCTADismissed, setStrengthenCTADismissed] = useState(false);
  // 每换题重置
  useEffect(() => {
    setEstDone(false);
    setEstSignal(null);
    setScratchState({
      tool: "none",
      textContent: "",
      insured: false,
      mentalOverrideUsed: false,
      charCount: 0,
    });
    setPendingSubmit(null);
    setStrengthenCTADismissed(false);
  }, [resetKey]);
  const [hintsOpened, setHintsOpened] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    partialCorrect: boolean;
    correctAnswerDisplay: string;
    /** 用户提交的答案的文字描述（数学 tutor panel 用） */
    userAnswerDisplay: string;
    points: number;
    repeatDecay?: number;
    newSkillBonus?: number;
    /** v0.28.1：本次提交的速度档位（lightning/quick/on_time/overdue/slow） */
    speedTier?: "lightning" | "quick" | "on_time" | "overdue" | "slow";
    /** v0.34.98 iter 32 P0-0a: Accuracy-First flag — 显示"答太快请检查" nudge */
    tooFast?: boolean;
    /** v0.34.98 iter 32 P0-0a: Accuracy-First flag — 显示"🧠 深思 +5" bonus */
    slowThink?: boolean;
    /** v0.34.99 iter 33 P0-1: 估算 phase 拿到的 XP (附加到 points) */
    estimationXp?: number;
    /** v0.34.99 iter 33 P0-1: 真答案数量级 vs 估算数量级 不一致 → soft nudge */
    estimationMagnitudeMismatch?: boolean;
    /** v0.35.0 iter 34 P0-2: ScratchInsurance bypass — 显示"🛡️ 草稿险" */
    insuredWrong?: boolean;
    errorPattern?: GameShellProps["onSubmit"] extends (...args: any) => Promise<infer R>
      ? R extends { errorPattern?: infer EP } ? EP : never : never;
  } | null>(null);
  const [shake, setShake] = useState(false);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  // ROI 改进 #1：第一次错时不立刻提交，给一次行内重做机会（考试模式禁用）
  const [retryStage, setRetryStage] = useState<"none" | "showing_hint">("none");
  const [panelKey, setPanelKey] = useState(0); // 改这个值能让 TemplatePanel 整体重置
  // v0.30.7: 这一题里有没有打开过"小进讲题"（在 1st 错答和 2nd 提交之间）
  const [showedTutorInRetry, setShowedTutorInRetry] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const activeResetKeyRef = useRef(resetKey);
  const submitInFlightRef = useRef(false);
  const finishedResetKeyRef = useRef<string | null>(null);
  // v0.30.7: 这一题是否经历过 retry 流程（1st 错答后又进了 RetryHintPanel）
  // 比 hintsOpened ≥ 1 更可靠（用户用了 hint 但没错也不算 retry）
  const wasRetriedRef = useRef(false);
  activeResetKeyRef.current = resetKey;

  // reset on question change
  useEffect(() => {
    activeResetKeyRef.current = resetKey;
    setHintsOpened(0);
    setStartedAt(Date.now());
    setFeedback(null);
    setShake(false);
    setFloaters([]);
    setRetryStage("none");
    setPanelKey(0);
    setShowedTutorInRetry(false); // v0.30.7
    setDisplayedQuestion(question); // v0.30.8: 新题进来重置渲染
    variantRef.current = null;
    submitInFlightRef.current = false;
    finishedResetKeyRef.current = null;
    wasRetriedRef.current = false;
  }, [resetKey, question]);

  const hints = question.hints ?? [];
  // v0.31.51: 长题（stem ≥60 字 或 多行选项）自动加阅读时间，避免 Selena 读字慢被超时坑
  const estimatedSec = adjustedEstimatedTime(question);

  const triggerFx: TriggerFx = useMemo(
    () => ({
      correctAt: (x, y, text) => {
        setFloaters((fs) => [...fs, makeFloater(text ?? "+✓", x, y, "gain")]);
      },
      wrongAt: (_x, _y) => {
        setShake(true);
        window.setTimeout(() => setShake(false), 450);
      },
      hintPenaltyAt: (x, y, amount) => {
        setFloaters((fs) => [...fs, makeFloater(`-${amount}`, x, y, "lose")]);
      },
      // v0.31.93: 放射 burst — 5 个新玩法答对时用
      burstAt: (x, y, emojis, count = 6) => {
        setFloaters((fs) => [...fs, ...makeBurst(x, y, emojis, count)]);
      },
    }),
    [],
  );

  const openHint = useCallback(() => {
    if (hintsOpened >= hints.length) return;
    const penalty = hints[hintsOpened]?.penalty ?? 1;
    sfx.hint();
    setHintsOpened((n) => n + 1);
    if (cardRef.current) {
      const box = cardRef.current.getBoundingClientRect();
      triggerFx.hintPenaltyAt(box.left + box.width - 80, box.top + box.height - 60, penalty);
    }
  }, [hints, hintsOpened, triggerFx]);

  const handleFinish = useCallback(
    async (r: Omit<AttemptResult, "hintsOpened" | "elapsedSeconds" | "correctAnswerDisplay" | "usedTutor" | "attemptOrdinal">) => {
      if (activeResetKeyRef.current !== resetKey) return;
      if (submitInFlightRef.current || finishedResetKeyRef.current === resetKey || submitting || feedback) return;

      // v0.35.0 iter 34 P0-2: ScratchInsurance 拦截 — requiresScratch 题 + 未选工具 → 弹 dialog
      // 仅 1st attempt 拦截 (2nd retry 不再打扰), 仅非考试模式
      // post-review: 每 session 最多弹 1 次 (双家共识)
      // v0.35.27 (爸爸第 3 次反馈): canvas_scratch 模板内置 canvas, **不再弹 ScratchInsurance dialog**
      // (canvas 本身就是草稿, 再问"用草稿还是心算" 多余 + 干扰流程)
      // v0.35.32 Refactor: suppressesExternalScratchTools capability 取代 inline templateId 比对.
      // multi_step_application 也自带输入面板, 同样跳过 (修上轮漏的边缘 case).
      if (
        !examMode && !noRetry && !wasRetriedRef.current &&
        !suppressesExternalScratchTools(templateId) &&
        requiresScratch(displayedQuestion) &&
        scratchState.tool === "none" &&
        !scratchState.insured &&
        !hasShownInterceptThisSession()
      ) {
        markInterceptShown();
        setPendingSubmit(r as AttemptResult);
        return;
      }

      // v0.30.7：1st 错答 — **静默入库为 ordinal=1 错答**（保留错题、扣 mastery、reset combo），
      // 然后进入 retry 阶段让用户讲题/重做。考试模式跳过这个分支，错就是错。
      // 跟 v0.30.6 之前的区别：之前是 return 不入库，现在是 record + 进 retry 不显示 feedback。
      // v0.31.25：加 !wasRetriedRef.current —— 防止 retry 后第二次又错时再走 silent branch
      // 重新拉变式 + 重新 retry，造成"小进讲的题跟刚做的题对不上"等怪事。
      if (!r.isCorrect && !examMode && !noRetry && retryStage === "none" && !wasRetriedRef.current) {
        sfx.wrong();
        setShake(true);
        window.setTimeout(() => setShake(false), 450);

        // 静默入库 1st-wrong（针对原题 props.question，不是 displayedQuestion）
        submitInFlightRef.current = true;
        const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        try {
          await onSubmit(
            {
              ...r,
              hintsOpened,
              elapsedSeconds: elapsed,
              correctAnswerDisplay: describeAnswer(question),
              usedTutor: false,
              attemptOrdinal: 1,
            },
            question, // 显式传原题（防止以后 displayedQuestion 提前 swap 出 bug）
          );
        } finally {
          submitInFlightRef.current = false;
        }

        // v0.31.17：同步等变式题（< 100ms IndexedDB 查询）。原版 fire-and-forget
        // 异步取，用户秒点"再做一次"时 variantRef 还没 resolve → swap 失败 → 原题再做。
        // 同步 await 让 retry panel 一显示，variantRef 就 100% 就绪。findParallelQuestion
        // v0.31.17 已经阶梯放宽，几乎不会返 null（保底返同学科任意一题）。
        if (onRequestVariant) {
          try {
            variantRef.current = await onRequestVariant(question);
          } catch {
            variantRef.current = null;
          }
        }

        setRetryStage("showing_hint");
        return; // 不 setFeedback，让 RetryHintPanel 显示
      }

      submitInFlightRef.current = true;
      setSubmitting(true);
      try {
        const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        // v0.30.7：判定 attemptOrdinal —— 用 wasRetriedRef（在 handleRetry 里 set true）
        // 比 hintsOpened≥1 启发更可靠（用户用 hint 但没错也算第一次提交）
        // v0.30.8：如果 displayedQuestion 是变式题（不同于原题），ordinal=1 因为对变式题来说
        //         这是第一次作答；scoring 仍然通过 usedTutor 来抑制 combo/速度奖励。
        //         如果 displayedQuestion === 原题（pool 没找到变式 fallback），ordinal=2 同前。
        const isVariant = displayedQuestion.question_id !== question.question_id;
        const ordinal: 1 | 2 = wasRetriedRef.current && !examMode && !isVariant ? 2 : 1;
        const res = await onSubmit(
          {
            ...r,
            hintsOpened,
            elapsedSeconds: elapsed,
            correctAnswerDisplay: describeAnswer(displayedQuestion),
            usedTutor: showedTutorInRetry,
            attemptOrdinal: ordinal,
            // v0.34.99 iter 33 P0-1: 把 estimation 数据传给 Train → service.submitAttempt → attempt.metadata
            estimationGate: estSignal
              ? {
                  earnedXp: estSignal.estimationXp,
                  userRounds: estSignal.userRounds,
                  userEstimate: estSignal.userEstimate,
                  userMagnitude: estSignal.userMagnitude,
                  actualMagnitude: estSignal.actualMagnitude,
                  magnitudeMismatch:
                    estSignal.userMagnitude !== estSignal.actualMagnitude,
                  elapsedMsByPhase: estSignal.elapsedPerPhase,
                }
              : undefined,
            // v0.35.0 iter 34 P0-2: scratch payload
            scratch: scratchState.tool !== "none"
              ? {
                  tool: scratchState.tool,
                  charCount: scratchState.charCount,
                  insured: scratchState.insured,
                  mentalOverrideUsed: scratchState.mentalOverrideUsed,
                  // 不持久化 textContent (隐私 + 体积) — 只存元数据
                }
              : undefined,
            // v0.35.1 iter 35 P0-3: multi-step payload
            multiStep: r.multiStep,
          },
          displayedQuestion,
        );
        const speedTier = (wasRetriedRef.current && !examMode)
          ? ("on_time" as const) // 2nd 不奖速度（无论变式还是原题）
          : speedBonus(elapsed, adjustedEstimatedTime(displayedQuestion), r.isCorrect).tier;
        // v0.34.99 iter 33 P0-1: 把 estimation XP 加到本次主 attempt 分数上.
        // estimation 不存独立 attempt — 通过 points 累计 + UI 标签暴露给 Selena.
        const estXp = estSignal?.estimationXp ?? 0;
        // v0.35.1 iter 35 P0-3: multi-step XP 同样累加
        const multiStepXp = r.multiStep?.earnedXp ?? 0;
        const finalPoints = res.points + estXp + multiStepXp;
        setFeedback({
          isCorrect: r.isCorrect,
          partialCorrect: r.partialCorrect,
          correctAnswerDisplay: describeAnswer(displayedQuestion),
          userAnswerDisplay: describeUserAnswer(displayedQuestion, r.answer),
          points: finalPoints,
          repeatDecay: res.repeatDecay,
          newSkillBonus: res.newSkillBonus,
          speedTier,
          tooFast: res.tooFast,
          slowThink: res.slowThink,
          insuredWrong: res.insuredWrong,
          estimationXp: estXp || undefined,
          estimationMagnitudeMismatch: estSignal
            ? estSignal.userMagnitude !== estSignal.actualMagnitude
            : undefined,
          errorPattern: res.errorPattern ?? null,
        });
        finishedResetKeyRef.current = resetKey;
        if (r.isCorrect) {
          sfx.correct();
        } else {
          sfx.wrong();
          setShake(true);
          window.setTimeout(() => setShake(false), 450);
        }
      } finally {
        submitInFlightRef.current = false;
        setSubmitting(false);
      }
    },
    [submitting, feedback, resetKey, startedAt, hintsOpened, onSubmit, question, examMode, noRetry, retryStage, showedTutorInRetry, displayedQuestion, onRequestVariant],
  );

  // 用户点击"再做一次"时调用：清掉提示状态，强制 panel 重新挂载
  const handleRetry = useCallback(() => {
    setRetryStage("none");
    // 把 hintsOpened 标 1，等价于"用了 1 级提示"，扣 1 分
    setHintsOpened((n) => Math.max(n, 1));
    setStartedAt(Date.now());
    setPanelKey((k) => k + 1);
    // v0.30.7: 标记本题"经过 retry"，下次提交走 attemptOrdinal=2
    wasRetriedRef.current = true;
    // v0.30.8: 如果 1st 错答异步预取的变式题就绪，swap displayedQuestion 到变式题
    // 用户接下来作答的是新题（同型同难度），不是刚看过的原题
    if (variantRef.current) {
      setDisplayedQuestion(variantRef.current);
      // 不清空 variantRef.current 让 isVariant 判定能在 handleFinish 里用
    }
  }, []);

  const onPickFeedback = useCallback((kind: "correct" | "wrong") => {
    if (kind === "wrong") {
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
    }
  }, []);

  // v0.30.8: TemplatePanel 渲染 displayedQuestion（变式题 swap 后会变），
  // resolveTemplate 也基于 displayedQuestion（虽然变式题 game_type 同原题，
  // 这里防御性以 displayedQuestion 为准）
  const templateId = resolveTemplate(displayedQuestion);
  const common: TemplateRenderProps = {
    question: displayedQuestion,
    hintsOpened,
    openHint,
    onFinish: handleFinish,
    triggerFx,
    onPickFeedback,
    // 显示 retry 提示时也要禁用 panel，避免重复提交
    disabled: !!feedback || submitting || retryStage === "showing_hint",
  };
  const TemplatePanel = pickPanel(templateId);

  return (
    <div className="relative">
      {showStarter && !starterDone && <StarterOverlay onDone={() => setStarterDone(true)} />}
      {/* v0.35.6 iter 40 P2-1: 稳准挑战 banner (紫色, 顶部) */}
      <SteadyAimBanner />
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-3">
        <XpBar xp={xp} />
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs text-slate-400">
            第 <span className="text-slate-100 font-semibold">{index + 1}</span> / {total}
          </span>
          {countdownEnabled && (
            <div className="flex-1">
              <CountdownBar
                seconds={estimatedSec}
                resetKey={`${resetKey}::${panelKey}`}
                paused={!!feedback || !starterDone || retryStage === "showing_hint"}
                onTimeUp={() => {
                  // v0.28.1：时间到自动判错入库 + 触发"再做一次"流程（含小进讲题入口）
                  // 因为模板还没调 onFinish，这里直接走 wrong path：
                  //   - 非考试模式 → retryStage="showing_hint" 弹"再做一次 / 让小进讲一讲"
                  //   - 考试模式 → handleFinish 直接入库判错（empty answer）
                  if (feedback || submitting || finishedResetKeyRef.current === resetKey) return;
                  if (examMode || noRetry) {
                    // 考试模式 / 无重试模式：超时 = 错，立即入库
                    void handleFinish({
                      answer: null,
                      isCorrect: false,
                      partialCorrect: false,
                      matchedErrorTags: ["timeout"],
                    });
                  } else {
                    // 普通模式：超时 = 进 retryStage，让小进讲题
                    if (retryStage === "none") {
                      sfx.wrong();
                      setShake(true);
                      window.setTimeout(() => setShake(false), 450);
                      setRetryStage("showing_hint");
                    }
                  }
                }}
              />
            </div>
          )}
        </div>
        <ComboBadge combo={combo} />
      </div>

      <div
        ref={cardRef}
        className={`card-glow relative ${shake ? "animate-shake" : ""}`}
      >
        <div className="text-xs text-slate-400 mb-1 flex items-center gap-2">
          <span className="chip bg-violet-500/20 text-violet-200 border border-violet-400/30">
            {templateTitle(templateId)}
          </span>
          <span>难度 {question.difficulty}</span>
          {(question.tags ?? [])
            .filter((t) => !/^(start|factor|sticks|eq|pair|vert|op|result|hl|bars|step|solid|grid-front|grid-top|grid-left|opt-solid|opt-solid-[A-Z]|opt-grid-[A-Z]|tri-angles|tri-sides|tri-iso|tri-mark):/.test(t))
            .slice(0, 2)
            .map((t) => (
              <span key={t} className="chip bg-white/5 text-slate-300 border border-white/10">
                {t}
              </span>
            ))}
          {/* v0.31.77：报告 bug button — 答完之前都能用 */}
          <div className="ml-auto">
            <ReportQuestionButton
              question={question}
              onReportSubmitted={() => {
                // 报告完跳到下一题（不算对错）
                onNext();
              }}
            />
          </div>
        </div>

        {/* v0.34.99 iter 33 P0-1: EstimationGate 前置 — 满足 heuristic 的多位数 ×/+ 题先估算
            v0.35.36 (Gemini peer review HOTFIX): 用 GameErrorBoundary 兜底 —
            pickPanel 如果碰到旧 IDB cache 里 unknown templateId 抛 assertUnreachable,
            ErrorBoundary 接住, 显示"跳过这题"按钮, 不白屏崩溃整个 Train 页. */}
        <GameErrorBoundary
          fallbackTitle="这道题渲染出问题了 — 大概率是题型新得系统还没认得. 跳到下一题继续."
          onSkip={onNext}
        >
          {(() => {
            const needsGate = !examMode && !noRetry && starterDone && !estDone && requiresEstimation(displayedQuestion);
            if (needsGate) {
              return (
                <EstimationGate
                  question={displayedQuestion}
                  onComplete={(signal) => {
                    setEstSignal(signal);
                    setEstDone(true);
                  }}
                />
              );
            }
            return <TemplatePanel key={`${resetKey}::${panelKey}`} {...common} />;
          })()}
        </GameErrorBoundary>

        {/* v0.35.0 iter 34 P0-2: ScratchInsurance — answer panel 下方工具栏.
            v0.35.27 (爸爸第 3 次反馈): canvas_scratch 模板自带 canvas, 不再渲染
            ScratchPanel textarea 工具栏 (重复 + 干扰).
            v0.35.32 Refactor: 用 suppressesExternalScratchTools capability — multi_step_application
            也自带输入, 同样跳过. */}
        {!examMode && !noRetry && starterDone && !feedback && !suppressesExternalScratchTools(templateId) && requiresScratch(displayedQuestion) && (
          <ScratchPanel
            state={scratchState}
            onChange={setScratchState}
            onMentalCalcRequest={() => useMentalCalcQuota()}
            resetKey={resetKey}
          />
        )}

        {/* v0.35.0 iter 34 P0-2: 未选工具直接答 拦截 dialog */}
        {pendingSubmit && (
          <ScratchInterceptDialog
            remaining={getMentalCalcRemaining()}
            onPickScratch={() => {
              setScratchState((s) => ({ ...s, tool: "scratch" }));
              setPendingSubmit(null);
            }}
            onPickMental={() => {
              useMentalCalcQuota();
              setScratchState((s) => ({ ...s, tool: "mental_calc", mentalOverrideUsed: true }));
              const r = pendingSubmit;
              setPendingSubmit(null);
              // 用 setTimeout 让 state 先 flush 再 re-submit
              setTimeout(() => { void handleFinish(r); }, 0);
            }}
            onProceed={() => {
              // post-review GPT: 区分 direct_bypass vs mental_calc 在 telemetry 里别混淆
              setScratchState((s) => ({ ...s, tool: "direct_bypass", mentalOverrideUsed: false }));
              const r = pendingSubmit;
              setPendingSubmit(null);
              setTimeout(() => { void handleFinish(r); }, 0);
            }}
            onCancel={() => setPendingSubmit(null)}
          />
        )}

        {/* 行内重做提示（错 1 次后显示）。考试模式不会进这里。 */}
        {retryStage === "showing_hint" && !feedback && (
          <RetryHintPanel
            question={question}
            onRetry={handleRetry}
            onSkip={onNext}
            onTutorOpened={() => setShowedTutorInRetry(true)}
          />
        )}

        {hints.length > 0 && !feedback && retryStage === "none" && !examMode && (
          <div className="mt-4">
            <HintLadder hints={hints} opened={hintsOpened} onOpen={openHint} disabled={!starterDone} />
          </div>
        )}

        {/* v0.31.25：传 displayedQuestion 而非原题 — 变式题流程下 Selena 答的是变式题，
            FeedbackPanel 内的"小进讲一讲"按钮也应该讲她刚答的那道，而不是原题。
            之前传 props.question 导致 tutor 打开看到的 stem 跟 feedback 显示的答案对不上。 */}
        {feedback && <FeedbackPanel feedback={feedback} question={displayedQuestion} onNext={onNext} onInjectQuestion={onInjectQuestion} noRetry={noRetry} countdownEnabled={countdownEnabled} />}

        {/* v0.35.3 iter 37 P1-2: 强化挑战 inline CTA — 错答 + 满足条件时显示 */}
        {feedback && !feedback.isCorrect && !strengthenCTADismissed && (() => {
          // 当前是否在 strengthen / mini-game 内: noRetry=true 视为禁用强化嵌套
          const eligible = isStrengthenOpportunity(
            feedback.isCorrect,
            true, // 1st attempt (handleFinish 内已经过滤了 2nd)
            displayedQuestion,
            {
              examMode,
              noRetry,
              insideStrengthen: noRetry, // 复用 noRetry 标记 quiet mode
              sessionCount: 0, // TODO: 跟 Train.tsx 通讯 session 计数
            },
          );
          if (!eligible) return null;
          const skillCtx = pickStrengthSkillContext(displayedQuestion);
          return (
            <StrengthenInlineCTA
              skillCtx={skillCtx}
              onSkip={() => setStrengthenCTADismissed(true)}
            />
          );
        })()}
      </div>

      <FloatLayer
        floaters={floaters}
        onDone={(id) => setFloaters((fs) => fs.filter((f) => f.id !== id))}
      />
    </div>
  );
}

// v0.35.47 Refactor Priority 14: GAME_TEMPLATES + pickPanel + templateTitle
// 提到 ./templateRegistry.tsx (单一 registry, 23 templates × satisfies enforce).
// 这里再 re-export 给 GameShell 内部使用 (saves ~60 lines).

// v0.35.49 Refactor Priority 16: describeAnswer + describeUserAnswer 抽到 ./answerDescribe.ts


/**
 * ROI 改进 #1：第 1 次错时显示的"行内提示 + 再做一次"面板。
 * 不入库、不算分，只给一次"读完提示再来"的机会。
 * 第 2 次提交（不管对错）才真的走 onSubmit 入库。
 */
/**
 * 错答 1 次后的引导卡片。Round 5 重写：
 *  - 不再直接显示 solution_steps[0]（之前会泄答案 "答案是 9"）
 *  - 主操作改成 "👩‍🏫 让小进讲一讲" 开 TutorPanel 苏格拉底引导
 *  - 次操作 "再做一次" 给已经知道怎么做的孩子用
 *  - 第三按钮 "跳过这题" 给真的卡住的孩子兜底
 */
// v0.35.50 Refactor Priority 17: RetryHintPanel 子组件抽到 ./RetryHintPanel.tsx
