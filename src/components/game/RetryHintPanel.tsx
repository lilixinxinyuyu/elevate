/**
 * v0.35.50 Refactor Priority 17 (GameShell 拆分 step 4): 抽 RetryHintPanel 子组件.
 *
 * 1st 错答后显示的"先别急 — 想想是哪里不对" UI. 内含 3 个 CTA:
 *   - 👩‍🏫 让小进讲一讲 (打开 TutorPanel + 通知父级 setShowedTutorInRetry)
 *   - ↻ 再做一次 (onRetry — 父级走 retry flow)
 *   - 跳过这题 → (onSkip — 父级 advance to next)
 *
 * 本身有 1 个 local state (showTutor), 跟 GameShell 其余无 coupling.
 * 提到独立文件让 GameShell 减重, 子组件单独可测.
 */
import { useState } from "react";
import { TutorPanel } from "../tutor/TutorPanel";
import { describeAnswer } from "./answerDescribe";
import type { Question } from "../../core/types";

export interface RetryHintPanelProps {
  question: Question;
  onRetry: () => void;
  onSkip: () => void;
  /**
   * v0.30.7: 用户点了"让小进讲一讲"时调用, 让父级把 showedTutorInRetry 置 true.
   * 之后的 2nd 提交会带 usedTutor=true, 触发 0.7× XP / 不增 combo / Elo 半计.
   */
  onTutorOpened?: () => void;
}

export function RetryHintPanel({ question, onRetry, onSkip, onTutorOpened }: RetryHintPanelProps) {
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
