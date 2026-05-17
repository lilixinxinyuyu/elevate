/**
 * v0.35.0 (iter 34 P0-2): ScratchPanel — 软锁草稿险工具.
 *
 * 2-button v1 (peer review 共识简化):
 *   1. 📝 写草稿 → 展开 textarea (等宽 + grid 背景), 用了且答错 → insurance (不扣 XP, 不更新 mastery/streak)
 *   2. 🧠 心算挑战 (今日还有 N 次) → 消耗配额, 答对正常, 答错正常扣
 *
 * 默认 (不选工具): 等于"心算 (不耗配额)" — 但 GameShell 在 submit 时如果 scratch 必选未选,
 *   会弹拦截 dialog "用草稿险 / 用一次心算挑战 / 继续直接答"
 *
 * 跟 EstimationGate 互斥, 见 src/core/scratchPolicy.ts requiresScratchByHeuristic.
 */
import { useState } from "react";
import {
  getMentalCalcRemaining,
  isMeaningfulScratch,
  type ScratchTool,
} from "../../core/scratchPolicy";

export interface ScratchState {
  tool: ScratchTool;
  textContent: string;
  insured: boolean;
  mentalOverrideUsed: boolean;
  charCount: number;
}

interface Props {
  /** 当前 scratch 状态 (由 parent GameShell 管理) */
  state: ScratchState;
  /** 修改 scratch state */
  onChange: (next: ScratchState) => void;
  /** Mental quota 消耗回调 (持久化由 parent 决定何时调用 useMentalCalcQuota) */
  onMentalCalcRequest: () => void;
}

export function ScratchPanel({ state, onChange, onMentalCalcRequest }: Props) {
  const remaining = getMentalCalcRemaining();
  const [showMentalConfirm, setShowMentalConfirm] = useState(false);

  function pickScratch() {
    onChange({
      ...state,
      tool: "scratch",
      // 切换工具时不清空已有文本 — 保留她写的
      insured: isMeaningfulScratch(state.textContent),
      mentalOverrideUsed: false,
    });
  }

  function pickMental() {
    if (remaining <= 0) return;
    setShowMentalConfirm(true);
  }

  function confirmMental() {
    onMentalCalcRequest();
    onChange({
      ...state,
      tool: "mental_calc",
      textContent: "",
      insured: false,
      mentalOverrideUsed: true,
      charCount: 0,
    });
    setShowMentalConfirm(false);
  }

  function onTextChange(text: string) {
    const cleaned = text.replace(/\s/g, "");
    onChange({
      ...state,
      tool: state.tool === "none" ? "scratch" : state.tool,
      textContent: text,
      insured: isMeaningfulScratch(text),
      charCount: cleaned.length,
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-3 py-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-emerald-200/80">解题工具 (可选):</span>
        <button
          onClick={pickScratch}
          className={`px-2.5 py-1 rounded-lg text-xs border transition ${
            state.tool === "scratch"
              ? "bg-emerald-400/30 border-emerald-300 text-emerald-50 font-semibold"
              : "bg-slate-800 border-emerald-400/30 text-emerald-200 hover:bg-slate-700"
          }`}
        >
          📝 写草稿 {state.insured && "(已开保险)"}
        </button>
        <button
          onClick={pickMental}
          disabled={remaining <= 0 || state.mentalOverrideUsed}
          className={`px-2.5 py-1 rounded-lg text-xs border transition disabled:opacity-50 disabled:cursor-not-allowed ${
            state.tool === "mental_calc"
              ? "bg-rose-400/30 border-rose-300 text-rose-50 font-semibold"
              : "bg-slate-800 border-rose-400/30 text-rose-200 hover:bg-slate-700"
          }`}
          title={remaining <= 0 ? "今日心算挑战配额已用完" : `今日还有 ${remaining} 次心算挑战`}
        >
          🧠 心算挑战 ({remaining}/3)
        </button>
      </div>

      {state.tool === "scratch" && (
        <div className="space-y-1">
          <textarea
            value={state.textContent}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="在这里写你的算式 / 竖式 / 思路..."
            rows={4}
            className="w-full rounded-md px-2 py-1.5 bg-slate-900/60 text-emerald-50 text-sm font-mono border border-emerald-400/30 focus:outline-none focus:border-emerald-300 resize-y"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, transparent, transparent 22px, rgba(52, 211, 153, 0.08) 22px, rgba(52, 211, 153, 0.08) 23px)",
              backgroundSize: "100% 23px",
              lineHeight: "23px",
            }}
          />
          <p className={`text-xs ${state.insured ? "text-emerald-200" : "text-emerald-300/60"}`}>
            {state.insured
              ? "✓ 草稿险已激活: 这道题答错不扣 XP"
              : "再多写几个数字或算式, 草稿险就激活了"}
          </p>
        </div>
      )}

      {state.tool === "mental_calc" && (
        <p className="text-xs text-rose-200">
          🧠 心算挑战! 答错按正常扣 XP. 加油!
        </p>
      )}

      {showMentalConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowMentalConfirm(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-rose-400/40 rounded-xl px-4 py-4 max-w-sm space-y-3 shadow-2xl"
          >
            <h3 className="text-base font-bold text-rose-100">🧠 心算挑战</h3>
            <p className="text-sm text-rose-100/90">
              你今天还有 <b>{remaining}</b> 次心算挑战. 用了就少一次.
            </p>
            <p className="text-xs text-rose-200/70">
              心算挑战 = 不用草稿, 答错按正常扣 XP (没保险). 答对一切正常.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowMentalConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
              >
                我再想想
              </button>
              <button
                onClick={confirmMental}
                className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-sm font-semibold hover:bg-rose-400"
              >
                开始心算 →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * "未选工具直接答" 拦截 dialog. GameShell 在 submit 时如果 scratch 必选 + 未选 + 答错风险高 → 弹.
 * 3 选 1: 用草稿险 / 用心算挑战 / 继续直接答.
 */
interface InterceptProps {
  remaining: number;
  onPickScratch: () => void;
  onPickMental: () => void;
  onProceed: () => void;
  onCancel: () => void;
}
export function ScratchInterceptDialog({ remaining, onPickScratch, onPickMental, onProceed, onCancel }: InterceptProps) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-amber-400/40 rounded-xl px-4 py-4 max-w-sm space-y-3 shadow-2xl"
      >
        <h3 className="text-base font-bold text-amber-100">这道题有点复杂</h3>
        <p className="text-sm text-amber-100/90">
          要不要先开个保险或者用心算挑战?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onPickScratch}
            className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 text-left"
          >
            📝 写草稿 (答错不扣 XP)
          </button>
          <button
            onClick={onPickMental}
            disabled={remaining <= 0}
            className="px-3 py-2 rounded-lg bg-rose-500 text-white text-sm font-semibold hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            🧠 心算挑战 (今日剩 {remaining}/3)
          </button>
          <button
            onClick={onProceed}
            className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 text-left"
          >
            继续直接答 (没保险)
          </button>
        </div>
      </div>
    </div>
  );
}
