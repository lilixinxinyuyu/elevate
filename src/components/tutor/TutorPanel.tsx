/**
 * AI 老师面板 — 答错题后弹出的"小进姐姐讲题"面板。
 *
 * 设计原则（重要！）：
 *  - 苏格拉底式：第一回合不给答案，问引导问题让 Selena 思考
 *  - 第二/三回合：顺着她的思路追问、给线索
 *  - 必须在多轮里建立思维习惯，而不是灌答案
 *
 * 交互：
 *  1. 文本讲解：进面板自动调 /api/tutor/explain，TTS 朗读
 *  2. 语音对话：按住 🎤 录音，松开发送 → TTS 朗读
 *
 * TTS 防双播：
 *  - audioRef 维护当前正在播的 HTMLAudioElement
 *  - 每次新 speakText 前先 pause 旧的 → 永远只有一个声源
 *  - 准备阶段（请求 TTS bytes）显示 ⏳ + 禁用 🔊 按钮
 *
 * 语音降级：
 *  - 如果第一次 voiceAsk 报 FreeTierOnly / AllocationQuota / model_unavailable
 *    → 标记 voiceUnavailable，隐藏 🎤 按钮 + 显示文字"账号无 omni 权限，先用文字"
 */

import { useEffect, useRef, useState } from "react";
import {
  createMicRecorder,
  explainQuestion,
  voiceAsk,
  type MicRecorder,
} from "../../lib/tutor";
import { speakText } from "../../lib/tts";

interface TutorPanelProps {
  subjectId: "math" | "chinese";
  stem: string;
  correctAnswer: string;
  studentAnswer: string;
  skillName?: string;
  onClose: () => void;
}

interface ChatMsg {
  role: "assistant" | "user";
  content: string;
  via?: "voice" | "text";
  ts: number;
}

type AudioStatus =
  | { kind: "idle" }
  | { kind: "loading"; messageTs: number }
  | { kind: "playing"; messageTs: number };

/** 错误码里包含这些 = 模型在用户的账号不可用，建议关掉语音模式 */
function isQuotaError(msg: string): boolean {
  return /FreeTierOnly|AllocationQuota|model.+not.+exist|model.+unavailable/i.test(msg);
}

export function TutorPanel(props: TutorPanelProps) {
  const [conversation, setConversation] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState<"explain" | "voice" | "follow" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followText, setFollowText] = useState("");
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MicRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // TTS 单声源管控
  const [audioStatus, setAudioStatus] = useState<AudioStatus>({ kind: "idle" });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 语音模式可用性（FreeTierOnly 错误后置为 false）
  const [voiceUnavailable, setVoiceUnavailable] = useState(false);
  const [voiceUnavailableReason, setVoiceUnavailableReason] = useState<string | null>(null);

  /**
   * 安全播放：永远只有一个 audio 在响。
   * 来源消息 ts 用于在 UI 上区分 "正在为哪条消息准备/播放语音"。
   */
  const safePlayTts = async (text: string, messageTs: number) => {
    // 1. 停掉旧的
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
    // 2. 标记 loading，禁用 🔊 按钮
    setAudioStatus({ kind: "loading", messageTs });
    try {
      const audio = await speakText(text);
      audioRef.current = audio;
      setAudioStatus({ kind: "playing", messageTs });
      const handleDone = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setAudioStatus({ kind: "idle" });
        }
      };
      audio.addEventListener("ended", handleDone);
      audio.addEventListener("error", handleDone);
      audio.addEventListener("pause", () => {
        // pause 不一定意味着结束（可能是被 safePlayTts 主动 pause 的）
        // 如果还是 current，说明是用户/外部暂停，标记 idle
        if (audioRef.current === audio && audio.currentTime > 0 && audio.ended) {
          handleDone();
        }
      });
    } catch (e) {
      console.warn("[tutor] TTS failed", e);
      setAudioStatus({ kind: "idle" });
    }
  };

  // 进面板：自动拉一段文字讲解 + 朗读
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading("explain");
      setError(null);
      try {
        const r = await explainQuestion({
          subjectId: props.subjectId,
          stem: props.stem,
          correctAnswer: props.correctAnswer,
          studentAnswer: props.studentAnswer,
          skillName: props.skillName,
        });
        if (cancelled) return;
        const msg: ChatMsg = { role: "assistant", content: r.explanation, ts: Date.now() };
        setConversation([msg]);
        // 自动朗读（但 safe，不会和手动点击叠播）
        void safePlayTts(r.explanation, msg.ts);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自动滚到最新一条
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation]);

  // 关闭时释放麦 + 停 audio
  useEffect(() => {
    return () => {
      recorderRef.current?.release();
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const handleAskAgain = async () => {
    if (!followText.trim() || loading) return;
    const userMsg: ChatMsg = {
      role: "user",
      content: followText.trim(),
      via: "text",
      ts: Date.now(),
    };
    const newConv = [...conversation, userMsg];
    setConversation(newConv);
    setFollowText("");
    setLoading("follow");
    setError(null);
    try {
      const r = await explainQuestion({
        subjectId: props.subjectId,
        stem: props.stem,
        correctAnswer: props.correctAnswer,
        studentAnswer: props.studentAnswer,
        skillName: props.skillName,
        conversation: newConv.map((m) => ({ role: m.role, content: m.content })),
      });
      const aiMsg: ChatMsg = { role: "assistant", content: r.explanation, ts: Date.now() };
      setConversation((prev) => [...prev, aiMsg]);
      void safePlayTts(r.explanation, aiMsg.ts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const startRecording = async () => {
    if (recording || loading || voiceUnavailable) return;
    setError(null);
    try {
      if (!recorderRef.current) {
        recorderRef.current = await createMicRecorder();
      }
      await recorderRef.current.start();
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const stopRecording = async () => {
    if (!recording || !recorderRef.current) return;
    setRecording(false);
    setLoading("voice");
    try {
      const { blob, mimeType, durationMs } = await recorderRef.current.stop();
      if (durationMs < 500 || blob.size < 1000) {
        setError("录得太短了，按住按钮 1 秒以上再说话");
        setLoading(null);
        return;
      }
      const userMsg: ChatMsg = {
        role: "user",
        content: `🎤 (语音 ${Math.round(durationMs / 100) / 10}s)`,
        via: "voice",
        ts: Date.now(),
      };
      const newConv = [...conversation, userMsg];
      setConversation(newConv);
      const r = await voiceAsk({
        audioBlob: blob,
        mimeType,
        subjectId: props.subjectId,
        questionContext: {
          stem: props.stem,
          correctAnswer: props.correctAnswer,
          skillName: props.skillName,
        },
        conversation: conversation.map((m) => ({ role: m.role, content: m.content })),
      });
      const aiMsg: ChatMsg = { role: "assistant", content: r.reply, ts: Date.now() };
      setConversation((prev) => [...prev, aiMsg]);
      void safePlayTts(r.reply, aiMsg.ts);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      // 鉴权 / 配额错 → 自动关掉语音模式，引导用文字
      if (isQuotaError(msg)) {
        setVoiceUnavailable(true);
        setVoiceUnavailableReason(
          "DashScope 账号当前等级没有开通 omni 语音模型权限。继续用 💬 文字追问，效果一样好。",
        );
      }
    } finally {
      setLoading(null);
    }
  };

  const replayLast = () => {
    const last = [...conversation].reverse().find((m) => m.role === "assistant");
    if (last) void safePlayTts(last.content, last.ts);
  };

  // 当前最后一条 AI 消息（用于 🔊 状态判断）
  const lastAssistantMsg = [...conversation].reverse().find((m) => m.role === "assistant");
  const audioForLast =
    lastAssistantMsg && audioStatus.kind !== "idle" && audioStatus.messageTs === lastAssistantMsg.ts;
  const speakerDisabled =
    !lastAssistantMsg || (audioStatus.kind === "loading" && audioForLast);
  const speakerLabel =
    audioStatus.kind === "loading" && audioForLast
      ? "⏳"
      : audioStatus.kind === "playing" && audioForLast
        ? "🔉"
        : "🔊";
  const speakerClass =
    audioStatus.kind === "loading" && audioForLast
      ? "animate-pulse opacity-70"
      : audioStatus.kind === "playing" && audioForLast
        ? "bg-amber-500/30 animate-pulse"
        : "";

  // 关闭：清理麦 + 停 audio + 通知父组件
  const closePanel = () => {
    recorderRef.current?.release();
    recorderRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    props.onClose();
  };

  // 监听 Escape 键关闭（键盘 a11y）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4"
      onClick={(e) => {
        // 点击 backdrop（不在 card 内部）= 关闭
        if (e.target === e.currentTarget) closePanel();
      }}
    >
      {/* 浮动关闭按钮 — 永远固定在视口右上角，确保即便 panel 高度异常也能关掉 */}
      <button
        type="button"
        onClick={closePanel}
        className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[60] w-10 h-10 rounded-full bg-ink-900/90 border border-violet-400/40 text-slate-200 hover:bg-rose-500/30 hover:text-rose-100 hover:border-rose-400/60 text-2xl leading-none shadow-glow flex items-center justify-center transition-all"
        aria-label="关闭面板"
        title="关闭（Esc）"
      >
        ×
      </button>

      {/* 主面板：用 dvh 而不是 vh（dvh 排除 iOS Safari 地址栏，避免顶部被吃掉） */}
      <div
        className="card-glow w-full sm:max-w-md flex flex-col bg-ink-900/95 border border-violet-400/40 animate-slide-up overflow-hidden"
        style={{ maxHeight: "min(85dvh, 85vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between p-3 border-b border-ink-700/60 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-rose-400 text-white flex items-center justify-center font-display font-bold shadow-glow text-sm shrink-0">
              小进
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-amber-200">AI 引导</div>
              <div className="text-[10px] text-slate-400 truncate">小进姐姐 · {props.skillName ?? props.subjectId}</div>
            </div>
          </div>
          {/* 内嵌 × 兜底（如果浮动 × 被某个布局遮住） */}
          <button
            type="button"
            onClick={closePanel}
            className="text-slate-400 hover:text-slate-200 text-2xl leading-none px-3 py-1 rounded shrink-0"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* 对话区 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[180px]">
          {/* 题面提示卡 */}
          <div className="rounded-lg bg-violet-500/10 border border-violet-400/20 p-2 text-[11px] text-slate-300">
            <div className="text-slate-400 mb-0.5">题目：</div>
            <div className="text-slate-200">{props.stem}</div>
            {props.correctAnswer && (
              <div className="text-slate-400 mt-1">
                <span className="hidden">参考答案（小进会引导你想出来，不直接告诉）</span>
              </div>
            )}
          </div>

          {conversation.length === 0 && loading === "explain" && (
            <div className="text-sm text-slate-400 flex items-center gap-2">
              <span className="animate-pulse">●</span>
              小进姐姐正在想怎么引导你思考…
            </div>
          )}

          {conversation.map((m, i) => {
            const isLastAssistant =
              m.role === "assistant" && i === conversation.length - 1;
            const isLoadingThisMsg =
              isLastAssistant &&
              audioStatus.kind === "loading" &&
              audioStatus.messageTs === m.ts;
            const isPlayingThisMsg =
              isLastAssistant &&
              audioStatus.kind === "playing" &&
              audioStatus.messageTs === m.ts;
            return (
              <div
                key={`${m.ts}-${i}`}
                className={`rounded-xl p-2.5 text-sm leading-relaxed animate-slide-up ${
                  m.role === "assistant"
                    ? "bg-gradient-to-br from-amber-500/10 to-rose-500/10 border border-amber-400/30 text-amber-100"
                    : "bg-violet-500/15 border border-violet-400/30 text-violet-100 ml-6"
                }`}
              >
                {m.role === "assistant" ? (
                  <>
                    <div className="text-[10px] text-amber-300/80 mb-1 flex items-center gap-1">
                      <span>👩‍🏫</span> 小进姐姐说：
                      {isLoadingThisMsg && (
                        <span className="ml-2 text-slate-400 animate-pulse">⏳ 正在准备朗读…</span>
                      )}
                      {isPlayingThisMsg && (
                        <span className="ml-2 text-emerald-300">🔉 正在播放</span>
                      )}
                    </div>
                    <div>{m.content}</div>
                  </>
                ) : (
                  <div className="flex items-start gap-1.5">
                    {m.via === "voice" ? <span>🎤</span> : <span>💬</span>}
                    <span>{m.content}</span>
                  </div>
                )}
              </div>
            );
          })}

          {loading === "follow" && (
            <div className="text-xs text-slate-400 ml-2 animate-pulse">
              小进姐姐正在想…
            </div>
          )}
          {loading === "voice" && (
            <div className="text-xs text-slate-400 ml-2 animate-pulse">
              小进姐姐在听你的语音…
            </div>
          )}

          {error && !voiceUnavailable && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-400/30 text-rose-200 text-xs p-2 break-all">
              ⚠ {error}
            </div>
          )}

          {voiceUnavailable && voiceUnavailableReason && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-400/30 text-amber-200 text-xs p-2">
              ℹ️ {voiceUnavailableReason}
            </div>
          )}
        </div>

        {/* 底部操作区 */}
        <div className="p-3 border-t border-ink-700/60 space-y-2">
          {/* 语音按钮：账号没权限就直接隐藏，剩下文字模式 */}
          {!voiceUnavailable && (
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={() => recording && stopRecording()}
                onTouchStart={(e) => {
                  e.preventDefault();
                  startRecording();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  stopRecording();
                }}
                disabled={loading !== null}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm border transition-all select-none ${
                  recording
                    ? "bg-rose-500/30 border-rose-400/60 text-rose-100 scale-105 animate-pulse"
                    : "bg-violet-500/15 border-violet-400/40 text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
                }`}
              >
                {recording ? "🎤 松开发送…" : loading === "voice" ? "处理中…" : "🎤 按住说话"}
              </button>
              <button
                type="button"
                onClick={replayLast}
                disabled={speakerDisabled}
                title={
                  audioStatus.kind === "loading" && audioForLast
                    ? "正在准备语音…"
                    : "再听一遍"
                }
                className={`px-3 py-2.5 rounded-xl border text-sm transition-all ${speakerClass} ${
                  speakerDisabled
                    ? "bg-slate-700/40 border-slate-600/40 text-slate-400 cursor-not-allowed"
                    : "bg-amber-500/15 border-amber-400/30 text-amber-200 hover:bg-amber-500/25"
                }`}
              >
                {speakerLabel}
              </button>
            </div>
          )}
          {voiceUnavailable && lastAssistantMsg && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={replayLast}
                disabled={speakerDisabled}
                className={`px-3 py-2 rounded-xl border text-sm ${speakerClass} ${
                  speakerDisabled
                    ? "bg-slate-700/40 border-slate-600/40 text-slate-400 cursor-not-allowed"
                    : "bg-amber-500/15 border-amber-400/30 text-amber-200 hover:bg-amber-500/25"
                }`}
              >
                {speakerLabel} 再听一遍
              </button>
            </div>
          )}
          {/* 文字追问 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={followText}
              onChange={(e) => setFollowText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) handleAskAgain();
              }}
              placeholder={
                conversation.length === 0
                  ? "等小进先讲，再来追问…"
                  : "回答小进的引导问题 / 继续追问…"
              }
              disabled={loading !== null}
              className="field flex-1 text-sm"
            />
            <button
              type="button"
              onClick={handleAskAgain}
              disabled={!followText.trim() || loading !== null}
              className="btn-primary text-sm disabled:opacity-50"
            >
              问
            </button>
          </div>
          <div className="text-[10px] text-slate-500 text-center leading-relaxed">
            💡 小进会引导你<strong className="text-slate-400">自己想答案</strong>，不直接告诉你。
            认真回答她的问题，越想越聪明 ✨
          </div>
        </div>
      </div>
    </div>
  );
}
