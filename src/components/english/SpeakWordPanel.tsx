/**
 * v0.31.103 英语朗读发音判断 panel。
 *
 * Selena 看到一个单词或短句，按住麦克风录音读出 → 调 /api/tutor/english-speak
 * → Qwen3-Omni 听完给 0-100 分 + 中文 feedback。
 *
 * 复刻 TutorPanel 的录音 + base64 上传 pattern，但 UX 更轻量（一次性，不多轮）。
 */

import { useEffect, useRef, useState } from "react";
import {
  createMicRecorder,
  judgeEnglishSpeak,
  TutorError,
  type MicRecorder,
} from "../../lib/tutor";

interface SpeakWordPanelProps {
  /** 目标词 / 句 */
  target: string;
  /** 提示翻译，可选 */
  hintMeaning?: string;
  mode?: "word" | "sentence";
  /** 评分回调，父组件用来推进游戏 / 记录 attempt */
  onScore: (score: number, transcript: string, feedback: string) => void;
}

type Phase =
  | "idle"
  | "recording"
  | "judging"
  | "result"
  | "error";

export function SpeakWordPanel({
  target,
  hintMeaning,
  mode = "word",
  onScore,
}: SpeakWordPanelProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<{
    score: number;
    transcript: string;
    feedback: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MicRecorder | null>(null);
  // 录音时长指示
  const [recElapsed, setRecElapsed] = useState(0);
  useEffect(() => {
    if (phase !== "recording") return;
    setRecElapsed(0);
    const id = window.setInterval(() => setRecElapsed((t) => t + 0.1), 100);
    return () => window.clearInterval(id);
  }, [phase]);

  // 切换 target 时重置
  useEffect(() => {
    setPhase("idle");
    setResult(null);
    setError(null);
  }, [target]);

  async function startRecording() {
    setError(null);
    setResult(null);
    try {
      const rec = await createMicRecorder();
      recorderRef.current = rec;
      await rec.start();
      setPhase("recording");
    } catch (e) {
      const msg = e instanceof TutorError ? e.message : String(e);
      setError("打不开麦克风：" + msg);
      setPhase("error");
    }
  }

  async function stopAndJudge() {
    const rec = recorderRef.current;
    if (!rec) return;
    setPhase("judging");
    try {
      const { blob, mimeType, durationMs } = await rec.stop();
      rec.release();
      recorderRef.current = null;
      if (durationMs < 300) {
        setError("录音太短了，按住 1 秒以上");
        setPhase("error");
        return;
      }
      const r = await judgeEnglishSpeak({
        audioBlob: blob,
        mimeType,
        target,
        mode,
      });
      setResult({ score: r.score, transcript: r.transcript, feedback: r.feedback });
      setPhase("result");
      onScore(r.score, r.transcript, r.feedback);
    } catch (e) {
      const code = e instanceof TutorError ? e.message : String(e);
      // FreeTier 兜底信号
      if (
        code === "voice_not_available_on_plan" ||
        code === "tutor_not_configured"
      ) {
        setError("AI 发音判分目前不可用（账号没开通语音）。先用其他模式练。");
      } else {
        setError("评分失败：" + code);
      }
      setPhase("error");
    }
  }

  const scoreCls = result
    ? result.score >= 85
      ? "text-emerald-300 border-emerald-400/60 bg-emerald-500/15"
      : result.score >= 65
        ? "text-amber-200 border-amber-400/60 bg-amber-500/15"
        : "text-rose-200 border-rose-400/60 bg-rose-500/15"
    : "";

  return (
    <div className="card-glow space-y-4">
      <div className="text-center">
        <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">
          {mode === "sentence" ? "📣 读出这句话" : "📣 读出这个单词"}
        </div>
        <div className="font-display text-3xl text-cyan-100 select-text">
          {target}
        </div>
        {hintMeaning && (
          <div className="text-xs text-slate-400 mt-1">{hintMeaning}</div>
        )}
      </div>

      {/* 录音按钮 */}
      {phase === "idle" && (
        <button
          type="button"
          onClick={startRecording}
          className="w-full py-4 rounded-2xl bg-cyan-500/20 text-cyan-100 border-2 border-cyan-400/40 font-display font-bold hover:bg-cyan-500/30 active:scale-[0.98] transition-all"
        >
          🎤 按下开始录音
        </button>
      )}
      {phase === "recording" && (
        <button
          type="button"
          onClick={stopAndJudge}
          className="w-full py-4 rounded-2xl bg-rose-500/30 text-white border-2 border-rose-300/60 font-display font-bold animate-pulse"
        >
          ⏺ 录音中 {recElapsed.toFixed(1)}s — 点击结束并判分
        </button>
      )}
      {phase === "judging" && (
        <div className="w-full py-4 rounded-2xl bg-violet-500/15 text-violet-100 border-2 border-violet-400/40 text-center">
          🤖 AI 听一下…
        </div>
      )}

      {/* 结果展示 */}
      {phase === "result" && result && (
        <div className={`rounded-xl border-2 ${scoreCls} p-4 space-y-2`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">发音准确度</span>
            <span className="font-display font-bold text-3xl tabular-nums">
              {result.score}
              <span className="text-base opacity-70">/100</span>
            </span>
          </div>
          {result.transcript && (
            <div className="text-xs opacity-80">
              AI 听到：<span className="italic">"{result.transcript}"</span>
            </div>
          )}
          {result.feedback && (
            <div className="text-sm leading-relaxed">{result.feedback}</div>
          )}
          <button
            type="button"
            onClick={() => {
              setPhase("idle");
              setResult(null);
            }}
            className="w-full mt-2 py-2 rounded-lg bg-white/10 text-slate-100 text-sm border border-white/15 hover:bg-white/15"
          >
            再录一次
          </button>
        </div>
      )}

      {phase === "error" && error && (
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          <div className="font-semibold mb-1">⚠️ 出错了</div>
          <div className="text-xs">{error}</div>
          <button
            type="button"
            onClick={() => setPhase("idle")}
            className="mt-2 text-xs underline text-rose-200"
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
}
