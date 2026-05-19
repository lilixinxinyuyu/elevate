/**
 * v0.35.52 Refactor Priority 18 (GameShell 拆分 step 5): 抽 FeedbackPanel 子组件.
 *
 * GameShell.tsx 内最大的内嵌子组件 (~243 行). 答题后显示:
 *   - 对/错/部分对 状态 banner + 渐变背景
 *   - 速度档位 + 重做 + 新知识点 + 估算 + 草稿险 等 chip labels (buildFeedbackLabels)
 *   - 错题情况下: 正确答案 + 解析展开 + "🔍 这个错你之前也踩过" pattern card
 *   - CTAs: 👩‍🏫 让小进讲一讲 / 🔄 再出一道类似的 / 🚀 来道更难的 / 下一题 →
 *   - TutorPanel modal (showTutor state)
 *   - Adaptive question loading state (retry / bump)
 *
 * 跟 GameShell 无 state coupling — 仅 props 进 + 1 个 onInjectQuestion callback 出.
 */
import { useState } from "react";
import { TutorPanel } from "../tutor/TutorPanel";
import { requestRetryQuestion, requestHarderQuestion } from "../../lib/sessionAdaptive";
import { buildFeedbackLabels } from "./feedbackLabels";
import type { Question } from "../../core/types";
// (FeedbackPanelProps 自包含, 不需 import AttemptResult)


export interface FeedbackPanelProps {
  feedback: {
    isCorrect: boolean;
    partialCorrect: boolean;
    correctAnswerDisplay: string;
    userAnswerDisplay: string;
    points: number;
    repeatDecay?: number;
    newSkillBonus?: number;
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
    errorPattern?: {
      matchedTag: string;
      tagLabel: string;
      remediation: string | null;
      pastQuestions: { questionId: string; stem: string; happenedAt: number }[];
    } | null;
  };
  question: Question;
  onNext: () => void;
  onInjectQuestion?: (q: Question) => void;
  /** v0.31.85：boss 模式下不渲染"小进讲讲" + "再出一道类似" 这俩 CTA（boss 有自己的救场流） */
  noRetry?: boolean;
  countdownEnabled: boolean;
}

export function FeedbackPanel({
  feedback, question, onNext, onInjectQuestion, noRetry, countdownEnabled,
}: FeedbackPanelProps) {
  const { isCorrect, partialCorrect, repeatDecay, newSkillBonus, speedTier, tooFast, slowThink, estimationXp, estimationMagnitudeMismatch, insuredWrong, errorPattern } = feedback;
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

  // v0.35.48 Refactor: 标签生成在 feedbackLabels.ts 纯函数
  const labels = buildFeedbackLabels({
    isCorrect, tooFast, slowThink, speedTier, repeatDecay, newSkillBonus,
    estimationXp, estimationMagnitudeMismatch, insuredWrong, countdownEnabled,
  });

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
                l.startsWith("🧠")
                  ? "bg-indigo-400/30 text-indigo-100 border border-indigo-300/50 animate-pulse"
                  : l.startsWith("⏱️")
                    ? "bg-amber-400/20 text-amber-100 border border-amber-300/40"
                  : l.startsWith("⚖️")
                    ? "bg-amber-500/20 text-amber-100 border border-amber-400/40"
                  : l.startsWith("🛡️")
                    ? "bg-emerald-500/25 text-emerald-100 border border-emerald-400/50"
                  : l.startsWith("⚡⚡⚡")
                  ? "bg-cyan-400/30 text-cyan-100 border border-cyan-300/50 animate-pulse"
                  : l.startsWith("⚡⚡")
                    ? "bg-violet-400/30 text-violet-100 border border-violet-300/50"
                    : l.startsWith("⚡")
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

        {/* v0.31.34: 答对 + 闪电速度时给"加难度"选项 — v0.35.28 加 countdownEnabled gate */}
        {isCorrect && countdownEnabled && (speedTier === "lightning" || speedTier === "quick") && question.difficulty < 5 && (
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
