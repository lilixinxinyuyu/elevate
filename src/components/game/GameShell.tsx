import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CountdownBar } from "./CountdownBar";
import { speedBonus } from "../../core/scoring";
import { adjustedEstimatedTime } from "../../core/timing";
import { ComboBadge } from "./ComboBadge";
import { XpBar } from "./XpBar";
import { HintLadder } from "./HintLadder";
import { FloatLayer, makeFloater, type Floater } from "./FloatPlus";
import { StarterOverlay } from "./StarterOverlay";
import { sfx } from "../../lib/sfx";
import { TutorPanel } from "../tutor/TutorPanel";
import { ReportQuestionButton } from "./ReportQuestionButton";
import type { Question } from "../../core/types";
import { SpeedMatchPanel } from "./templates/SpeedMatch";
import { ShopCounterPanel } from "./templates/ShopCounter";
import { EquationBuilderPanel } from "./templates/EquationBuilder";
import { ClueFinderPanel } from "./templates/ClueFinder";
import { PlainNumericPanel } from "./templates/PlainNumeric";
import { PlainChoicePanel } from "./templates/PlainChoice";
import { SortLadderPanel } from "./templates/SortLadder";
import { TrueFalseSwipePanel } from "./templates/TrueFalseSwipe";
import { VerticalRepairPanel } from "./templates/VerticalRepair";
import { DecimalShifterPanel } from "./templates/DecimalShifter";
import { MemoryMatchPanel } from "./templates/MemoryMatch";
import { ShapeCourtPanel } from "./templates/ShapeCourt";
import { BalanceLabPanel } from "./templates/BalanceLab";
import { ChartDetectivePanel } from "./templates/ChartDetective";
import { CubeViewerPanel } from "./templates/CubeViewer";
import { TriangleJudgePanel } from "./templates/TriangleJudge";
import { DotGridDrawPanel } from "./templates/DotGridDraw";
import { resolveTemplate } from "./templates/resolve";
import { requestRetryQuestion, requestHarderQuestion } from "../../lib/sessionAdaptive";

export interface AttemptResult {
  answer: unknown;
  isCorrect: boolean;
  partialCorrect: boolean;
  matchedErrorTags: string[];
  hintsOpened: number;
  elapsedSeconds: number;
  correctAnswerDisplay: string;
  /**
   * v0.30.7: 这次答题前是否打开过"小进讲题"。仅 retry 后的 2nd 提交可能为 true。
   * 1st 提交永远 false（讲题入口在 1st 错答之后才出现）。
   */
  usedTutor?: boolean;
  /**
   * v0.30.7: 同一道题的第几次提交（1=直接 / 2=1st 错答之后的重做）。
   * 决定 combo / 速度奖励 / mistake stage / mastery Elo 倍率。
   */
  attemptOrdinal?: 1 | 2;
}

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

/** 每个子模板实现这个接口 */
export interface TemplateRenderProps {
  question: Question;
  hintsOpened: number;
  openHint: () => void;
  onFinish: (r: Omit<AttemptResult, "hintsOpened" | "elapsedSeconds" | "correctAnswerDisplay">) => void;
  triggerFx: TriggerFx;
  onPickFeedback: (kind: "correct" | "wrong") => void;
  disabled: boolean;
}

export interface TriggerFx {
  correctAt: (x: number, y: number, text?: string) => void;
  wrongAt: (x: number, y: number) => void;
  hintPenaltyAt: (x: number, y: number, amount: number) => void;
}

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
          },
          displayedQuestion,
        );
        const speedTier = (wasRetriedRef.current && !examMode)
          ? ("on_time" as const) // 2nd 不奖速度（无论变式还是原题）
          : speedBonus(elapsed, adjustedEstimatedTime(displayedQuestion), r.isCorrect).tier;
        setFeedback({
          isCorrect: r.isCorrect,
          partialCorrect: r.partialCorrect,
          correctAnswerDisplay: describeAnswer(displayedQuestion),
          userAnswerDisplay: describeUserAnswer(displayedQuestion, r.answer),
          points: res.points,
          repeatDecay: res.repeatDecay,
          newSkillBonus: res.newSkillBonus,
          speedTier,
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

        <TemplatePanel key={`${resetKey}::${panelKey}`} {...common} />

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
        {feedback && <FeedbackPanel feedback={feedback} question={displayedQuestion} onNext={onNext} onInjectQuestion={onInjectQuestion} noRetry={noRetry} />}
      </div>

      <FloatLayer
        floaters={floaters}
        onDone={(id) => setFloaters((fs) => fs.filter((f) => f.id !== id))}
      />
    </div>
  );
}

function pickPanel(id: string): (p: TemplateRenderProps) => JSX.Element {
  switch (id) {
    case "speed_match":
      return SpeedMatchPanel;
    case "shop_counter":
      return ShopCounterPanel;
    case "equation_builder":
      return EquationBuilderPanel;
    case "clue_finder":
      return ClueFinderPanel;
    case "plain_choice":
      return PlainChoicePanel;
    case "sort_ladder":
      return SortLadderPanel;
    case "true_false_swipe":
      return TrueFalseSwipePanel;
    case "vertical_repair":
      return VerticalRepairPanel;
    case "decimal_shifter":
      return DecimalShifterPanel;
    case "memory_match":
      return MemoryMatchPanel;
    case "shape_court":
      return ShapeCourtPanel;
    case "balance_lab":
      return BalanceLabPanel;
    case "chart_detective":
      return ChartDetectivePanel;
    case "cube_view":
      return CubeViewerPanel;
    case "triangle_judge":
      return TriangleJudgePanel;
    case "dot_grid_draw":
      return DotGridDrawPanel;
    default:
      return PlainNumericPanel;
  }
}

function templateTitle(id: string): string {
  switch (id) {
    case "speed_match":
      return "闪电匹配";
    case "shop_counter":
      return "小数商店";
    case "equation_builder":
      return "方程拼装";
    case "clue_finder":
      return "线索侦探";
    case "sort_ladder":
      return "数字阶梯";
    case "plain_choice":
      return "选择题";
    case "true_false_swipe":
      return "对错冲刺";
    case "vertical_repair":
      return "竖式修理厂";
    case "decimal_shifter":
      return "小数点滑梯";
    case "memory_match":
      return "记忆配对";
    case "shape_court":
      return "图形法庭";
    case "balance_lab":
      return "天平实验室";
    case "chart_detective":
      return "数据侦探";
    case "cube_view":
      return "立体观察";
    case "triangle_judge":
      return "三角形法庭";
    default:
      return "挑战";
  }
}

function describeAnswer(q: Question): string {
  const a = q.answer;
  if (a.type === "number") return `${a.value}`;
  if (a.type === "choice") {
    // v0.31.85：只返回 option text。原来带 id 前缀（"C. 1.26"）但 PlainChoice
    // 视觉洗牌后 user 看到的是 "A. 1.26"，前缀字母不一致 → 反馈"正确答案 C. 1.26"
    // 跟视觉 "A" 高亮矛盾。只显示 text 完全避开这个错位。
    const opt = (q.options ?? []).find((o) => o.id === a.value);
    return opt ? opt.text : a.value;
  }
  return a.steps.map((s) => `${s.step_id}=${s.expected}`).join("；");
}

/** 把用户提交的 answer（unknown）翻译成给 AI tutor 看的人话。 */
function describeUserAnswer(q: Question, answer: unknown): string {
  if (answer === null || answer === undefined) return "（未作答）";
  if (typeof answer === "number") return `${answer}`;
  if (typeof answer === "string") {
    // choice 题：answer 是 option id（"A"/"B"…），转成 option text（不带 id 前缀防错位）
    const opt = (q.options ?? []).find((o) => o.id === answer);
    if (opt) return opt.text;
    return answer;
  }
  if (typeof answer === "object") {
    // multi_step 等结构化答案
    try {
      return JSON.stringify(answer).slice(0, 80);
    } catch {
      return "（结构化答案）";
    }
  }
  return String(answer);
}

function FeedbackPanel({
  feedback,
  question,
  onNext,
  onInjectQuestion,
  noRetry,
}: {
  feedback: {
    isCorrect: boolean; partialCorrect: boolean; correctAnswerDisplay: string;
    userAnswerDisplay: string;
    points: number; repeatDecay?: number; newSkillBonus?: number;
    speedTier?: "lightning" | "quick" | "on_time" | "overdue" | "slow";
    errorPattern?: {
      matchedTag: string; tagLabel: string; remediation: string | null;
      pastQuestions: { questionId: string; stem: string; happenedAt: number }[];
    } | null;
  };
  question: Question;
  onNext: () => void;
  onInjectQuestion?: (q: Question) => void;
  /** v0.31.85：boss 模式下不渲染"小进讲讲" + "再出一道类似" 这俩 CTA（boss 有自己的救场流） */
  noRetry?: boolean;
}) {
  const { isCorrect, partialCorrect, repeatDecay, newSkillBonus, speedTier, errorPattern } = feedback;
  const [showTutor, setShowTutor] = useState(false);
  // v0.31.34：会话内自适应出题
  const [adaptiveLoading, setAdaptiveLoading] = useState<"retry" | "bump" | null>(null);
  const [adaptiveErr, setAdaptiveErr] = useState<string>("");
  const [adaptiveDone, setAdaptiveDone] = useState<"retry" | "bump" | null>(null);

  async function onRetrySimilar() {
    if (adaptiveLoading) return;
    setAdaptiveLoading("retry");
    setAdaptiveErr("");
    try {
      const newQs = await requestRetryQuestion(question);
      console.log(`[adaptive] retry → ${newQs.length} 题入库 (skill=${question.skill_id}, d=${question.difficulty})`);
      // v0.31.38: 把生成的题真插进 session 队列，下一题就用它
      const injected = newQs[0];
      if (injected && onInjectQuestion) {
        onInjectQuestion(injected);
      }
      setAdaptiveDone("retry");
    } catch (e) {
      setAdaptiveErr(`再出题失败：${(e as Error).message.slice(0, 50)}`);
    } finally {
      setAdaptiveLoading(null);
    }
  }

  async function onBumpHarder() {
    if (adaptiveLoading) return;
    setAdaptiveLoading("bump");
    setAdaptiveErr("");
    try {
      const newQs = await requestHarderQuestion(question);
      console.log(`[adaptive] bump → ${newQs.length} 题入库 (skill=${question.skill_id}, d=${question.difficulty + 1})`);
      // v0.31.38: 把生成的题真插进 session 队列，下一题就用它
      const injected = newQs[0];
      if (injected && onInjectQuestion) {
        onInjectQuestion(injected);
      }
      setAdaptiveDone("bump");
    } catch (e) {
      setAdaptiveErr(`加难度失败：${(e as Error).message.slice(0, 50)}`);
    } finally {
      setAdaptiveLoading(null);
    }
  }
  // 标签：速度档位 / 重做递减 / 新知识点
  const labels: string[] = [];
  // v0.28.1：阶梯速度奖励显示
  if (isCorrect && speedTier === "lightning") labels.push("⚡⚡ 闪电 +5");
  else if (isCorrect && speedTier === "quick") labels.push("⚡ 迅速 +3");
  else if (isCorrect && speedTier === "on_time") labels.push("✓ 及时 +2");
  else if (isCorrect && speedTier === "overdue") labels.push("⏰ 超时");
  else if (isCorrect && speedTier === "slow") labels.push("🐢 拖拉 -1");
  if (isCorrect && repeatDecay !== undefined && repeatDecay < 1.0 && repeatDecay > 0) {
    labels.push(`重做 ×${Math.round(repeatDecay * 100)}%`);
  } else if (isCorrect && repeatDecay === 0) {
    labels.push("已熟练，不再加分");
  }
  if (newSkillBonus && newSkillBonus > 0) {
    labels.push(`🎓 新知识点 +${newSkillBonus}`);
  }
  return (
    <div className="mt-4 space-y-3 animate-slide-up">
      <div
        className={`rounded-xl px-3 py-2 text-sm border ${
          isCorrect
            ? "bg-emerald-500/15 text-emerald-100 border-emerald-400/40 shadow-glow-emerald"
            : partialCorrect
              ? "bg-amber-500/15 text-amber-100 border-amber-400/40"
              : "bg-rose-500/15 text-rose-100 border-rose-400/40"
        }`}
      >
        <div className="font-semibold mb-1 flex items-center gap-2 flex-wrap">
          <span>
            {isCorrect ? `太棒了 +${feedback.points} XP` : partialCorrect ? "方向对了一部分" : "再试一次，离答案很近了"}
          </span>
          {labels.map((l, i) => (
            <span
              key={i}
              className={`text-[11px] px-1.5 py-0.5 rounded-full font-normal ${
                l.startsWith("⚡⚡")
                  ? "bg-cyan-400/30 text-cyan-100 border border-cyan-300/50 animate-pulse"
                  : l.startsWith("⚡")
                    ? "bg-violet-400/20 text-violet-100 border border-violet-300/40"
                    : l.startsWith("✓")
                      ? "bg-emerald-400/20 text-emerald-100 border border-emerald-300/40"
                      : l.startsWith("⏰") || l.startsWith("🐢")
                        ? "bg-rose-500/20 text-rose-200 border border-rose-400/40"
                        : l.startsWith("🎓")
                          ? "bg-amber-400/20 text-amber-100 border border-amber-300/40"
                          : "bg-slate-700/60 text-slate-300 border border-slate-500/40"
              }`}
            >
              {l}
            </span>
          ))}
        </div>
        <div>{isCorrect ? question.feedback_correct : question.feedback_wrong}</div>
        {!isCorrect && (
          <div className="mt-2 text-slate-200">
            正确答案：<span className="font-semibold text-amber-200">{feedback.correctAnswerDisplay}</span>
          </div>
        )}
      </div>
      {!isCorrect && (
        <details className="rounded-xl border border-white/10 p-3 bg-white/5">
          <summary className="cursor-pointer text-sm text-slate-300">查看解析</summary>
          <ol className="list-decimal list-inside text-sm text-slate-200 mt-2 space-y-1">
            {question.solution_steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      )}
      {/* ROI 改进 #3：错题故事化 —— 你之前在哪些题也踩过这个坑 */}
      {!isCorrect && errorPattern && errorPattern.pastQuestions.length > 0 && (
        <div className="rounded-xl border border-violet-400/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 p-3 text-sm">
          <div className="font-display font-bold text-violet-100 flex items-center gap-2 mb-1">
            🔍 这个错你之前也踩过
            <span className="chip text-[11px] px-2 py-0.5 bg-violet-500/30 border border-violet-400/40 text-violet-100">
              {errorPattern.tagLabel}
            </span>
          </div>
          <ul className="list-disc list-inside text-violet-200/85 space-y-0.5">
            {errorPattern.pastQuestions.map((p) => (
              <li key={p.questionId}>{p.stem}</li>
            ))}
          </ul>
          {errorPattern.remediation && (
            <div className="mt-2 text-emerald-200/90 text-xs">
              💡 怎么改：{errorPattern.remediation}
            </div>
          )}
        </div>
      )}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        {/* v0.31.85：boss 模式（noRetry）下不显示这俩 CTA — boss 有自己的救场流（顶部 chip） */}
        {!noRetry && (
          <>
            {/* 错答时弹出"小进姐姐讲一讲"，答对也允许（学更深的解法 / 概念） */}
            <button
              type="button"
              onClick={() => setShowTutor(true)}
              className={`text-sm px-4 py-2 rounded-xl border transition-all hover:scale-105 ${
                !isCorrect
                  ? "bg-amber-500/20 border-amber-400/40 text-amber-100 animate-pulse"
                  : "bg-violet-500/10 border-violet-400/30 text-violet-200 hover:bg-violet-500/20"
              }`}
            >
              👩‍🏫 让小进讲一讲
            </button>

            {/* v0.31.34: 错答时显示"再出一道类似的"巩固训练 */}
            {!isCorrect && (
          <button
            type="button"
            onClick={onRetrySimilar}
            disabled={adaptiveLoading !== null || adaptiveDone === "retry"}
            className="text-sm px-3 py-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25 transition-all disabled:opacity-50"
          >
            {adaptiveLoading === "retry"
              ? "出题中…"
              : adaptiveDone === "retry"
                ? "✓ 已加入下一题"
                : "🔄 再出一道类似的"}
          </button>
        )}

        {/* v0.31.34: 答对 + 闪电速度时给"加难度"选项 */}
        {isCorrect && (speedTier === "lightning" || speedTier === "quick") && question.difficulty < 5 && (
          <button
            type="button"
            onClick={onBumpHarder}
            disabled={adaptiveLoading !== null || adaptiveDone === "bump"}
            className="text-sm px-3 py-2 rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100 hover:bg-fuchsia-500/25 transition-all disabled:opacity-50"
          >
            {adaptiveLoading === "bump"
              ? "出题中…"
              : adaptiveDone === "bump"
                ? "✓ 难题已加入"
                : `🚀 来道更难的（D${question.difficulty + 1}）`}
          </button>
        )}
          </>
        )}

        <button type="button" className="btn-primary" onClick={onNext}>
          下一题 →
        </button>
      </div>
      {adaptiveErr && (
        <div className="text-rose-300 text-xs bg-rose-500/10 border border-rose-400/30 rounded p-2">
          {adaptiveErr}
        </div>
      )}
      {showTutor && (
        <TutorPanel
          subjectId="math"
          stem={question.stem}
          correctAnswer={feedback.correctAnswerDisplay}
          studentAnswer={feedback.userAnswerDisplay}
          skillName={question.skill_name ?? question.skill_id}
          questionId={question.question_id}
          skillId={question.skill_id}
          onClose={() => setShowTutor(false)}
        />
      )}
    </div>
  );
}

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
function RetryHintPanel({
  question,
  onRetry,
  onSkip,
  onTutorOpened,
}: {
  question: Question;
  onRetry: () => void;
  onSkip: () => void;
  /**
   * v0.30.7: 用户点了"让小进讲一讲"时调用，让父级把 showedTutorInRetry 置 true。
   * 之后的 2nd 提交会带 usedTutor=true，触发 0.7× XP / 不增 combo / Elo 半计。
   */
  onTutorOpened?: () => void;
}) {
  const [showTutor, setShowTutor] = useState(false);
  const stemHint = "再仔细读一遍题目——题里的关键词、单位、问什么都看清楚。";

  return (
    <div className="mt-4 rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-rose-500/10 p-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="text-3xl">💡</div>
        <div className="flex-1">
          <div className="font-display font-bold text-amber-100 mb-1">
            先别急——想想是哪里不对
          </div>
          <div className="text-sm text-amber-200/90 mb-3 leading-relaxed">{stemHint}</div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="btn-primary text-sm py-2 px-4"
              onClick={() => {
                setShowTutor(true);
                onTutorOpened?.();
              }}
            >
              👩‍🏫 让小进讲一讲
            </button>
            <button
              type="button"
              className="text-sm py-2 px-4 rounded-xl border border-amber-400/40 text-amber-100 hover:bg-amber-500/20"
              onClick={onRetry}
            >
              ↻ 再做一次
            </button>
            <button
              type="button"
              className="text-sm py-2 px-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5"
              onClick={onSkip}
            >
              跳过这题 →
            </button>
          </div>
          <div className="text-[11px] text-amber-200/60 mt-2">
            刚才这次错答已经记下啦——再做时会换一道同型同难度的<strong>新题</strong>，
            考验是不是真学会了，不是只把刚刚那道题的数字背下来。
          </div>
        </div>
      </div>
      {showTutor && (
        <TutorPanel
          subjectId={question.subjectId === "chinese" ? "chinese" : "math"}
          stem={question.stem}
          correctAnswer={describeAnswer(question)}
          studentAnswer="（第一次答错，还没看到正确答案）"
          skillName={question.skill_name ?? question.skill_id}
          questionId={question.question_id}
          skillId={question.skill_id}
          onClose={() => setShowTutor(false)}
        />
      )}
    </div>
  );
}
