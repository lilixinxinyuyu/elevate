/**
 * AI 老师面板 — 答错题后弹出的"小进姐姐讲题"面板。
 *
 * 包含两种交互方式：
 *  1. 文本讲解：自动调 /api/tutor/explain 拿一段文字，立即用 Cherry TTS 朗读
 *  2. 语音对话：按住 🎤 录音，松开发送给 /api/tutor/voice，AI 回复文字 + 朗读
 *
 * 多轮对话：保留 conversation 历史，文本和语音都能续讲。
 *
 * 使用：
 *   <TutorPanel
 *     subjectId="chinese"
 *     stem={q.stem}
 *     correctAnswer="A：是 hái"
 *     studentAnswer="C：是 huán"
 *     skillName="多音字辨义"
 *     onClose={() => setShowTutor(false)}
 *   />
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
  /** 用户消息：voice = 语音录的；text = 文字打的 */
  via?: "voice" | "text";
  ts: number;
}

export function TutorPanel(props: TutorPanelProps) {
  const [conversation, setConversation] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState<"explain" | "voice" | "follow" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followText, setFollowText] = useState("");
  // 语音录制状态
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MicRecorder | null>(null);
  // 自动滚动到最新一句
  const scrollRef = useRef<HTMLDivElement | null>(null);

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
        // 自动朗读
        void speakText(r.explanation).catch(() => void 0);
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

  // 滚到最新
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation]);

  // 释放麦克风
  useEffect(() => {
    return () => {
      recorderRef.current?.release();
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
      const aiMsg: ChatMsg = {
        role: "assistant",
        content: r.explanation,
        ts: Date.now(),
      };
      setConversation((prev) => [...prev, aiMsg]);
      void speakText(r.explanation).catch(() => void 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const startRecording = async () => {
    if (recording || loading) return;
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
      // 在 conversation 里加一条占位的 user 语音消息
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
      void speakText(r.reply).catch(() => void 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const replayLast = () => {
    const last = [...conversation].reverse().find((m) => m.role === "assistant");
    if (last) void speakText(last.content).catch(() => void 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
      <div className="card-glow w-full sm:max-w-md max-h-[90vh] flex flex-col bg-ink-900/95 border border-violet-400/40 animate-slide-up overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between p-3 border-b border-ink-700/60">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-rose-400 text-white flex items-center justify-center font-display font-bold shadow-glow text-sm">
              小进
            </div>
            <div>
              <div className="font-display font-bold text-amber-200">AI 讲题</div>
              <div className="text-[10px] text-slate-400">小进姐姐 · {props.skillName ?? props.subjectId}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              recorderRef.current?.release();
              recorderRef.current = null;
              props.onClose();
            }}
            className="text-slate-400 hover:text-slate-200 text-2xl leading-none px-2"
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
            <div className="text-slate-400 mt-1">
              正确：<span className="text-emerald-300">{props.correctAnswer}</span>
              {props.studentAnswer && (
                <>
                  {" · "}
                  你写的：<span className="text-rose-300">{props.studentAnswer}</span>
                </>
              )}
            </div>
          </div>

          {conversation.length === 0 && loading === "explain" && (
            <div className="text-sm text-slate-400 flex items-center gap-2">
              <span className="animate-pulse">●</span>
              小进姐姐正在想怎么讲给你听…
            </div>
          )}

          {conversation.map((m, i) => (
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
          ))}

          {loading === "follow" && (
            <div className="text-xs text-slate-400 ml-2 animate-pulse">
              小进姐姐正在打字…
            </div>
          )}
          {loading === "voice" && (
            <div className="text-xs text-slate-400 ml-2 animate-pulse">
              小进姐姐在听…
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-400/30 text-rose-200 text-xs p-2 break-all">
              ⚠ {error}
              <div className="text-[10px] text-slate-500 mt-1">
                tip: 第一次用语音需要授权麦克风。如果 explain/voice 报 InvalidApiKey 或 model not exist，去管理页测一下 TTS 是不是也挂了。
              </div>
            </div>
          )}
        </div>

        {/* 底部操作区 */}
        <div className="p-3 border-t border-ink-700/60 space-y-2">
          {/* 语音按钮：按住录音、松开发送 */}
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
              disabled={conversation.length === 0 || loading !== null}
              className="px-3 py-2.5 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-200 text-sm hover:bg-amber-500/25 disabled:opacity-40"
              title="再听一遍"
            >
              🔊
            </button>
          </div>
          {/* 文字追问 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={followText}
              onChange={(e) => setFollowText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) handleAskAgain();
              }}
              placeholder="或者打字追问…"
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
          <div className="text-[10px] text-slate-500 text-center">
            🎤 用语音问「这道题还有别的解法吗」 · 💬 也可以打字
          </div>
        </div>
      </div>
    </div>
  );
}
