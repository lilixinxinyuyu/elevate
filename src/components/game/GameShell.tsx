import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CountdownBar } from "./CountdownBar";
import { ComboBadge } from "./ComboBadge";
import { XpBar } from "./XpBar";
import { HintLadder } from "./HintLadder";
import { FloatLayer, makeFloater, type Floater } from "./FloatPlus";
import { StarterOverlay } from "./StarterOverlay";
import { sfx } from "../../lib/sfx";
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
  onSubmit: (result: AttemptResult) => Promise<{ points: number }>;
  onNext: () => void;
  showStarter?: boolean;
  countdownEnabled: boolean;
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
  const { question, index, total, xp, combo, onSubmit, onNext, showStarter, countdownEnabled } = props;
  const resetKey = `${question.question_id}:${index}`;
  const [starterDone, setStarterDone] = useState(!showStarter);
  const [hintsOpened, setHintsOpened] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    partialCorrect: boolean;
    correctAnswerDisplay: string;
    points: number;
  } | null>(null);
  const [shake, setShake] = useState(false);
  const [floaters, setFloaters] = useState<Floater[]>([]);
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
          points: res.points,
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
    [submitting, feedback, resetKey, startedAt, hintsOpened, onSubmit, question],
  );

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
    disabled: !!feedback || submitting,
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

        <TemplatePanel key={resetKey} {...common} />

        {hints.length > 0 && !feedback && (
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

function FeedbackPanel({
  feedback,
  question,
  onNext,
}: {
  feedback: { isCorrect: boolean; partialCorrect: boolean; correctAnswerDisplay: string; points: number };
  question: Question;
  onNext: () => void;
}) {
  const { isCorrect, partialCorrect } = feedback;
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
        <div className="font-semibold mb-1">
          {isCorrect ? `太棒了 +${feedback.points}` : partialCorrect ? "方向对了一部分" : "再试一次，离答案很近了"}
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
      <div className="flex justify-end">
        <button type="button" className="btn-primary" onClick={onNext}>
          下一题 →
        </button>
      </div>
    </div>
  );
}
