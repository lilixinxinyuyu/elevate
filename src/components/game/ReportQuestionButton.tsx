import { useState } from "react";
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
    | { ok: true; fixed: boolean; summary?: string }
    | { ok: false; detail: string }
  >(null);

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
        }),
      });
      const j = (await r.json()) as
        | {
            ok: true;
            fixed: Record<string, unknown> | false;
            changesSummary?: string;
            detail?: string;
          }
        | { ok: false; error: string; detail?: string };
      if (!j.ok) {
        setResult({ ok: false, detail: j.detail ?? j.error });
      } else if (j.fixed && typeof j.fixed === "object") {
        // 把修好的题写进本地 questions 表，下次出题就用新版
        try {
          await db.questions.put(j.fixed as never);
        } catch {
          /* */
        }
        setResult({ ok: true, fixed: true, summary: j.changesSummary });
      } else {
        setResult({ ok: true, fixed: false, summary: j.detail });
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
              <div className="text-center py-3">
                <div className="text-4xl">✨</div>
                <div className="font-display font-bold text-emerald-200 mt-2">
                  AI 已修好了
                </div>
                {result.summary && (
                  <div className="text-xs text-slate-300 mt-1">
                    改动：{result.summary}
                  </div>
                )}
                <div className="text-[11px] text-slate-400 mt-2">
                  下次再做这道题，就是修好的新版了
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
