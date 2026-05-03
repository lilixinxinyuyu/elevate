import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CountdownBar } from "./CountdownBar";
import { ComboBadge } from "./ComboBadge";
import { XpBar } from "./XpBar";
import { HintLadder } from "./HintLadder";
import { FloatLayer, makeFloater, type Floater } from "./FloatPlus";
import { StarterOverlay } from "./StarterOverlay";
import { sfx } from "../../lib/sfx";
import { TutorPanel } from "../tutor/TutorPanel";
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
import { resolveTemplate } from "./templates/resolve";

export interface AttemptResult {
  answer: unknown;
  isCorrect: boolean;
  partialCorrect: boolean;
  matchedErrorTags: string[];
  hintsOpened: number;
  elapsedSeconds: number;
  correctAnswerDisplay: string;
}

export interface GameShellProps {
  question: Question;
  index: number;
  total: number;
  xp: number;
  combo: number;
  onSubmit: (result: AttemptResult) => Promise<{
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
  const { question, index, total, xp, combo, onSubmit, onNext, showStarter, countdownEnabled, examMode } = props;
  const resetKey = `${question.question_id}:${index}`;
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
    errorPattern?: GameShellProps["onSubmit"] extends (...args: any) => Promise<infer R>
      ? R extends { errorPattern?: infer EP } ? EP : never : never;
  } | null>(null);
  const [shake, setShake] = useState(false);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  // ROI 改进 #1：第一次错时不立刻提交，给一次行内重做机会（考试模式禁用）
  const [retryStage, setRetryStage] = useState<"none" | "showing_hint">("none");
  const [panelKey, setPanelKey] = useState(0); // 改这个值能让 TemplatePanel 整体重置
  const cardRef = useRef<HTMLDivElement>(null);
  const activeResetKeyRef = useRef(resetKey);
  const submitInFlightRef = useRef(false);
  const finishedResetKeyRef = useRef<string | null>(null);
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
    submitInFlightRef.current = false;
    finishedResetKeyRef.current = null;
  }, [resetKey]);

  const hints = question.hints ?? [];
  const estimatedSec = question.estimated_time_seconds;

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
    async (r: Omit<AttemptResult, "hintsOpened" | "elapsedSeconds" | "correctAnswerDisplay">) => {
      if (activeResetKeyRef.current !== resetKey) return;
      if (submitInFlightRef.current || finishedResetKeyRef.current === resetKey || submitting || feedback) return;

      // ROI 改进 #1：第一次答错且非考试模式 → 不入库，进入"行内重做"阶段
      // - 显示步骤提示 + "再做一次" 按钮
      // - 第二次提交才真的入库（无论对错都最终化）
      // 考试模式下跳过这个分支，错就是错，立即入库。
      if (!r.isCorrect && !examMode && retryStage === "none") {
        sfx.wrong();
        setShake(true);
        window.setTimeout(() => setShake(false), 450);
        setRetryStage("showing_hint");
        return; // 不调 onSubmit，等用户点"再做一次"
      }

      submitInFlightRef.current = true;
      setSubmitting(true);
      try {
        const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const res = await onSubmit({
          ...r,
          hintsOpened,
          elapsedSeconds: elapsed,
          correctAnswerDisplay: describeAnswer(question),
        });
        setFeedback({
          isCorrect: r.isCorrect,
          partialCorrect: r.partialCorrect,
          correctAnswerDisplay: describeAnswer(question),
          userAnswerDisplay: describeUserAnswer(question, r.answer),
          points: res.points,
          repeatDecay: res.repeatDecay,
          newSkillBonus: res.newSkillBonus,
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
    [submitting, feedback, resetKey, startedAt, hintsOpened, onSubmit, question, examMode, retryStage],
  );

  // 用户点击"再做一次"时调用：清掉提示状态，强制 panel 重新挂载
  const handleRetry = useCallback(() => {
    setRetryStage("none");
    // 把 hintsOpened 标 1，等价于"用了 1 级提示"，扣 1 分
    setHintsOpened((n) => Math.max(n, 1));
    setStartedAt(Date.now());
    setPanelKey((k) => k + 1);
  }, []);

  const onPickFeedback = useCallback((kind: "correct" | "wrong") => {
    if (kind === "wrong") {
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
    }
  }, []);

  const templateId = resolveTemplate(question);
  const common: TemplateRenderProps = {
    question,
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
                resetKey={resetKey}
                paused={!!feedback || !starterDone}
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
        </div>

        <TemplatePanel key={`${resetKey}::${panelKey}`} {...common} />

        {/* 行内重做提示（错 1 次后显示）。考试模式不会进这里。 */}
        {retryStage === "showing_hint" && !feedback && (
          <RetryHintPanel
            stem={question.solution_steps[0] ?? "再仔细读一遍题目，注意小数点和单位。"}
            onRetry={handleRetry}
          />
        )}

        {hints.length > 0 && !feedback && retryStage === "none" && !examMode && (
          <div className="mt-4">
            <HintLadder hints={hints} opened={hintsOpened} onOpen={openHint} disabled={!starterDone} />
          </div>
        )}

        {feedback && <FeedbackPanel feedback={feedback} question={question} onNext={onNext} />}
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
    const opt = (q.options ?? []).find((o) => o.id === a.value);
    return opt ? `${a.value}. ${opt.text}` : a.value;
  }
  return a.steps.map((s) => `${s.step_id}=${s.expected}`).join("；");
}

/** 把用户提交的 answer（unknown）翻译成给 AI tutor 看的人话。 */
function describeUserAnswer(q: Question, answer: unknown): string {
  if (answer === null || answer === undefined) return "（未作答）";
  if (typeof answer === "number") return `${answer}`;
  if (typeof answer === "string") {
    // choice 题：可能是 option id（"A"/"B"…），转成 "A. 选项文本"
    const opt = (q.options ?? []).find((o) => o.id === answer);
    if (opt) return `${answer}. ${opt.text}`;
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
}: {
  feedback: {
    isCorrect: boolean; partialCorrect: boolean; correctAnswerDisplay: string;
    userAnswerDisplay: string;
    points: number; repeatDecay?: number; newSkillBonus?: number;
    errorPattern?: {
      matchedTag: string; tagLabel: string; remediation: string | null;
      pastQuestions: { questionId: string; stem: string; happenedAt: number }[];
    } | null;
  };
  question: Question;
  onNext: () => void;
}) {
  const { isCorrect, partialCorrect, repeatDecay, newSkillBonus, errorPattern } = feedback;
  const [showTutor, setShowTutor] = useState(false);
  // 标签：重做递减 / 新知识点
  const labels: string[] = [];
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
                l.startsWith("🎓")
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
      <div className="flex justify-between items-center gap-2">
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
        <button type="button" className="btn-primary" onClick={onNext}>
          下一题 →
        </button>
      </div>
      {showTutor && (
        <TutorPanel
          subjectId="math"
          stem={question.stem}
          correctAnswer={feedback.correctAnswerDisplay}
          studentAnswer={feedback.userAnswerDisplay}
          skillName={question.skill_name ?? question.skill_id}
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
function RetryHintPanel({ stem, onRetry }: { stem: string; onRetry: () => void }) {
  return (
    <div className="mt-4 rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-rose-500/10 p-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="text-3xl">💡</div>
        <div className="flex-1">
          <div className="font-display font-bold text-amber-100 mb-1">先别急——给你一个提示</div>
          <div className="text-sm text-amber-200/90 mb-3 leading-relaxed">{stem}</div>
          <button type="button" className="btn-primary text-sm py-2 px-4" onClick={onRetry}>
            再做一次 →
          </button>
          <div className="text-[11px] text-amber-200/60 mt-2">
            重做一次只扣 1 分提示费。第二次还错才会算错题。
          </div>
        </div>
      </div>
    </div>
  );
}
