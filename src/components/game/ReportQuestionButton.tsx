import { useEffect, useState } from "react";
import type { Question } from "../../core/types";
import { db } from "../../db/dexie";
import { getStoredPassword } from "../../db/cloudSync";

/**
 * v0.31.77：题面右上角的"报告这道题有问题"按钮。
 *
 * UX:
 *   - 默认是个小 chip（不抢视觉焦点）
 *   - 点击 → modal 显示 5 个原因 chip + 可选自由输入
 *   - 提交 → POST /api/admin/report-question
 *   - 后台 AI 自动修题 → UPSERT D1 → toast "已修复，下次见到这道题就是修好的版本"
 *   - 失败时也会给原题打 user_reported tag，admin 后续 review
 */

type ReasonKey =
  | "answer_wrong"
  | "stem_unclear"
  | "options_same"
  | "options_no_correct"
  | "math_error"
  | "other";

const REASONS: { key: ReasonKey; emoji: string; label: string }[] = [
  { key: "answer_wrong", emoji: "❌", label: "答案不对" },
  { key: "options_same", emoji: "🔁", label: "选项都一样 / 看不出区别" },
  { key: "options_no_correct", emoji: "🤷", label: "选项里没有正确答案" },
  { key: "stem_unclear", emoji: "🤔", label: "题面看不懂" },
  { key: "math_error", emoji: "🧮", label: "数字 / 计算错了" },
  { key: "other", emoji: "❓", label: "别的问题" },
];

interface Props {
  question: Question;
  /** 报告成功后调用，让父组件可以选择跳到下一题 / 不计入对错 */
  onReportSubmitted?: () => void;
}

export function ReportQuestionButton({ question, onReportSubmitted }: Props) {
  const [open, setOpen] = useState(false);
  const [pickedReason, setPickedReason] = useState<ReasonKey | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | null
    | {
        ok: true;
        fixed: boolean;
        summary?: string;
        verdict?: string;
        explanation?: string;
        /** v0.33.56 (Ep130 P1 fix): AI 是否真改动了 answer 字段（vs 原题） */
        answerChanged?: boolean;
        /** AI 改后的新答案文本（已渲染好的） */
        newAnswerDisplay?: string;
      }
    | { ok: false; detail: string }
  >(null);
  // v0.31.82：拿到 user 上次提交过的答案（如果有），帮 AI 判定她对错
  const [userAnswer, setUserAnswer] = useState<unknown>(undefined);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const recent = await db.attempts
          .where("questionId")
          .equals(question.question_id)
          .reverse()
          .limit(1)
          .toArray();
        if (cancelled) return;
        if (recent.length > 0) {
          setUserAnswer(recent[0]?.answer);
        }
      } catch {
        /* */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, question.question_id]);

  async function submit() {
    if (!pickedReason) return;
    setSubmitting(true);
    setResult(null);
    try {
      const pwd = getStoredPassword();
      const r = await fetch("/api/admin/report-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(pwd ? { Authorization: `Bearer ${pwd}` } : {}),
        },
        body: JSON.stringify({
          question,
          reason: pickedReason,
          reasonText: reasonText.trim() || undefined,
          userAnswer,
        }),
      });
      const j = (await r.json()) as
        | {
            ok: true;
            fixed: Record<string, unknown> | false;
            changesSummary?: string;
            userAnswerVerdict?: string;
            userAnswerExplanation?: string;
            detail?: string;
          }
        | { ok: false; error: string; detail?: string };
      if (!j.ok) {
        setResult({ ok: false, detail: j.detail ?? j.error });
      } else if (j.fixed && typeof j.fixed === "object") {
        try {
          await db.questions.put(j.fixed as never);
        } catch {
          /* */
        }
        // v0.33.56 (Ep130 P1 fix): 对比 AI 修后答案 vs 原题答案，告诉用户 AI 是否同意他报错
        const origAns = JSON.stringify(question.answer ?? null);
        const fixedQ = j.fixed as { answer?: unknown; options?: Array<{ id?: string; text?: string }> };
        const newAns = JSON.stringify(fixedQ.answer ?? null);
        const answerChanged = origAns !== newAns;
        let newAnswerDisplay = "";
        if (answerChanged && fixedQ.answer && typeof fixedQ.answer === "object") {
          const a = fixedQ.answer as { type?: string; value?: unknown };
          if (a.type === "choice" && typeof a.value === "string") {
            const opt = (fixedQ.options ?? []).find((o) => o?.id === a.value);
            newAnswerDisplay = opt ? `${a.value} (${opt.text})` : String(a.value);
          } else if (a.type === "number") {
            newAnswerDisplay = String(a.value);
          } else {
            newAnswerDisplay = JSON.stringify(a.value);
          }
        }
        setResult({
          ok: true,
          fixed: true,
          summary: j.changesSummary,
          verdict: j.userAnswerVerdict,
          explanation: j.userAnswerExplanation,
          answerChanged,
          newAnswerDisplay,
        });
      } else {
        setResult({
          ok: true,
          fixed: false,
          summary: j.detail,
          verdict: j.userAnswerVerdict,
          explanation: j.userAnswerExplanation,
        });
      }
    } catch (e) {
      setResult({ ok: false, detail: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setOpen(false);
    setPickedReason(null);
    setReasonText("");
    setResult(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded-full bg-white/5 hover:bg-rose-500/20 hover:text-rose-200 border border-ink-700/60 text-slate-400 transition-colors"
        title="这道题有问题？告诉我们，AI 会自动修"
        aria-label="报告这道题有问题"
      >
        🐛 报告
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={close}
        >
          <div
            className="card-glow max-w-sm w-full bg-gradient-to-br from-rose-500/15 to-amber-500/10 border-rose-400/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-3">
              <div className="text-3xl">🐛</div>
              <div className="font-display font-bold text-lg text-rose-100 mt-1">
                这道题哪里有问题？
              </div>
              <div className="text-xs text-slate-300 mt-1">
                选一个，AI 会立刻修好
              </div>
            </div>

            {!result && (
              <>
                <div className="space-y-1.5">
                  {REASONS.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setPickedReason(r.key)}
                      className={`w-full p-2.5 rounded-lg border text-left transition-colors ${
                        pickedReason === r.key
                          ? "bg-rose-500/30 border-rose-400/60 text-rose-50"
                          : "bg-white/5 border-ink-700/60 text-slate-200 hover:bg-rose-500/10"
                      }`}
                    >
                      <span className="mr-2">{r.emoji}</span>
                      {r.label}
                    </button>
                  ))}
                </div>
                {pickedReason === "other" && (
                  <textarea
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    placeholder="可以详细说一下哪里不对（不写也行）"
                    className="w-full mt-2 field text-sm"
                    rows={2}
                    maxLength={200}
                  />
                )}
                <div className="mt-3 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={close}
                    className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2"
                    disabled={submitting}
                  >
                    算了
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!pickedReason || submitting}
                    className="btn-primary text-sm px-4 py-2 disabled:opacity-40"
                  >
                    {submitting ? "AI 修中…" : "🔧 让 AI 修"}
                  </button>
                </div>
              </>
            )}

            {result?.ok && result.fixed && (
              <VerdictPanel
                verdict={result.verdict}
                explanation={result.explanation}
                summary={result.summary}
                answerChanged={result.answerChanged}
                newAnswerDisplay={result.newAnswerDisplay}
                userReportedReason={pickedReason}
                onClose={() => {
                  close();
                  onReportSubmitted?.();
                }}
              />
            )}

            {result?.ok && !result.fixed && (
              <div className="text-center py-3">
                <div className="text-4xl">📩</div>
                <div className="font-display font-bold text-amber-100 mt-2">
                  已记录，等爸爸看
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  AI 这次没修成（{result.summary?.slice(0, 60) ?? "原因不详"}），
                  题已经被标记，爸爸会处理。
                </div>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onReportSubmitted?.();
                  }}
                  className="btn-primary mt-4 text-sm"
                >
                  跳到下一题
                </button>
              </div>
            )}

            {result && !result.ok && (
              <div className="text-center py-3">
                <div className="text-4xl">😢</div>
                <div className="font-display font-bold text-rose-200 mt-2">
                  网络出错
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  {result.detail.slice(0, 80)}
                </div>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="btn-primary mt-4 text-sm"
                >
                  再试一次
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Verdict 面板 ─────────────────────────────────────────
// v0.33.56 (Ep130 P1 fix): 同时展示两层判定，避免之前"用户报答案错但 AI 只说'再想想'"的 dismissive 感
//   1. 题本身 verdict (answerChanged) — AI 是否同意用户报错的"题有问题"
//   2. 用户答案 verdict (correct/wrong/unknown) — 用户自己答对了没
//
//   answerChanged=true → 醒目展示"AI 同意了你 — 答案已修复为 X"
//   answerChanged=false + 用户报 answer/options/math 类原因 → 共情地说"AI 看过了但题没问题，原因是 ..."
//   否则按原 verdict 逻辑（答对/答错/unknown）
function VerdictPanel({
  verdict,
  explanation,
  summary,
  answerChanged,
  newAnswerDisplay,
  userReportedReason,
  onClose,
}: {
  verdict?: string;
  explanation?: string;
  summary?: string;
  answerChanged?: boolean;
  newAnswerDisplay?: string;
  userReportedReason?: ReasonKey | null;
  onClose: () => void;
}) {
  const v = verdict ?? "unknown";
  const isCorrect = v === "correct" || v === "now_correct_after_fix";
  const isWrong = v === "wrong" || v === "still_wrong_after_fix";

  // v0.33.56 题层级判定 — AI 同意/不同意"题有问题"
  const userReportedAnswerIssue =
    userReportedReason === "answer_wrong" ||
    userReportedReason === "options_no_correct" ||
    userReportedReason === "math_error";

  // 决定主标题与色调（题层级优先于用户答案层级）
  let titleEmoji: string;
  let titleText: string;
  let titleColor: string;
  let bgClass: string;
  let primaryMsg: string | null = null;

  if (answerChanged) {
    // AI 同意了报错 — 改了 answer
    titleEmoji = "🛠";
    titleText = "AI 同意你 — 题修好了";
    titleColor = "text-emerald-200";
    bgClass = "bg-emerald-500/12";
    primaryMsg = newAnswerDisplay
      ? `修正后的答案是：${newAnswerDisplay}`
      : "AI 修改了这道题，下次见到就是新版本。";
  } else if (userReportedAnswerIssue && !isCorrect) {
    // 用户报"答案/选项/数字错"但 AI 检查后没改题 — 共情承认+解释
    titleEmoji = "🤔";
    titleText = "AI 看过了，题没问题";
    titleColor = "text-sky-200";
    bgClass = "bg-sky-500/10";
    primaryMsg = "下面是 AI 给你的解释 —— 也可以让爸爸再看一眼";
  } else if (isCorrect) {
    titleEmoji = "🎉";
    titleText = v === "now_correct_after_fix" ? "你答对了！冤枉你了" : "你答对了";
    titleColor = "text-emerald-200";
    bgClass = "bg-emerald-500/10";
  } else if (isWrong) {
    titleEmoji = "💡";
    titleText = "再想想";
    titleColor = "text-amber-200";
    bgClass = "bg-amber-500/10";
  } else {
    titleEmoji = "✨";
    titleText = "AI 已查看";
    titleColor = "text-slate-200";
    bgClass = "bg-slate-500/10";
  }

  return (
    <div className={`text-center py-3 -m-3 px-3 ${bgClass} rounded-xl`}>
      <div className="text-4xl">{titleEmoji}</div>
      <div className={`font-display font-bold mt-2 ${titleColor}`}>
        {titleText}
      </div>
      {primaryMsg && (
        <div className="text-sm text-slate-100 mt-2 px-2 leading-relaxed font-semibold">
          {primaryMsg}
        </div>
      )}
      {explanation && (
        <div className="text-sm text-slate-200 mt-2 px-2 leading-relaxed">
          {explanation}
        </div>
      )}
      {summary && summary !== explanation && (
        <div className="text-[11px] text-slate-400 mt-2 px-2">
          AI 改动：{summary}
        </div>
      )}
      <button type="button" onClick={onClose} className="btn-primary mt-4 text-sm">
        {answerChanged ? "继续做题 ✨" : isCorrect ? "继续下一题 🎉" : "明白了，下一题"}
      </button>
    </div>
  );
}
