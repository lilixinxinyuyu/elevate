/**
 * v0.31.104 英语朗读判分 panel — **走 wss realtime 路径**（跟数学小进同一条路）。
 *
 * v0.31.103 第一版用 /api/tutor/voice HTTP path，但那条路 Free Tier 已 403
 * 全废（TutorPanel.tsx 注释里写过）。数学小进现行 working path 是
 * wss → selena-tutor-realtime Worker → wss dashscope realtime endpoint。
 *
 * 单次判分流程：
 *   1. connect → session.update (text-only modalities, judge prompt with target)
 *   2. user 按下录音 → startRecording (PCM16 24kHz 流式 append)
 *   3. user 松开 → stopAndRespond → commit + response.create(["text"])
 *   4. onAssistantTurnDone(fullText) → parse JSON → 返回 { score, transcript, feedback }
 *   5. close 释放 ws
 */

import { useEffect, useRef, useState } from "react";
import {
  RealtimeTutor,
  type RealtimeState,
} from "../../lib/realtimeTutor";

const REALTIME_URL =
  (import.meta as unknown as { env: { VITE_REALTIME_URL?: string } }).env
    .VITE_REALTIME_URL ??
  "wss://selena-tutor-realtime.lilixinxinyuyu.workers.dev";

interface SpeakWordPanelProps {
  target: string;
  hintMeaning?: string;
  mode?: "word" | "sentence";
  onScore: (score: number, transcript: string, feedback: string) => void;
}

type Phase = "idle" | "connecting" | "recording" | "judging" | "result" | "error";

function buildJudgePrompt(target: string, mode: "word" | "sentence"): string {
  const what = mode === "sentence" ? "英文短句" : "英文单词";
  return `你是英语发音判分老师，帮 10 岁中国小女孩 Selena 练英语口语。

她要读的目标 ${what}是：「${target}」

收到她的录音后：
1. 听她读出来的内容
2. 跟目标对照打 0-100 分（90+ 很准 / 70-89 基本对 / 50-69 能懂但错音多 / <50 勉强懂）
3. 一句中文反馈（10-30 字），温和鼓励指出哪里改

**输出格式（必须严格按这 3 行，每行一项，不要别的话，不要 markdown）：**
转写：<你听到的英文原文>
评分：<0-100 整数>
反馈：<中文一句话>

示例：
转写：apple
评分：88
反馈：a 元音再饱满一点就更准了`;
}

/**
 * 解析 AI 回复。先尝试老的 JSON 格式（兼容），fallback 到新的"转写/评分/反馈"3 行格式。
 * 再 fallback 到正则抓任意数字 + 全部文字当 feedback。最差也能给出 score。
 */
function parseJudgeJSON(raw: string): {
  transcript: string;
  score: number;
  feedback: string;
} | null {
  // 路径 1：严格 JSON（万一模型听话）
  const jsonMatch = raw.match(/\{[^{}]*"score"[^{}]*\}/);
  if (jsonMatch) {
    try {
      const j = JSON.parse(jsonMatch[0]) as { transcript?: string; score?: number; feedback?: string };
      if (typeof j.score === "number") {
        return {
          transcript: j.transcript ?? "",
          score: clampScore(j.score),
          feedback: j.feedback ?? "",
        };
      }
    } catch { /* */ }
  }

  // 路径 2：3 行结构化输出 转写/评分/反馈
  const tMatch = raw.match(/转\s*写[：:\s]+([^\n\r]+)/);
  const sMatch = raw.match(/(?:评\s*分|分数)[：:\s]+(\d{1,3})/);
  const fMatch = raw.match(/反\s*馈[：:\s]+([^\n\r]+)/);
  if (sMatch) {
    return {
      transcript: tMatch?.[1]?.trim() ?? "",
      score: clampScore(parseInt(sMatch[1]!, 10)),
      feedback: fMatch?.[1]?.trim() ?? "",
    };
  }

  // 路径 3：兜底 — 抓"X 分" or "X/100" 的数字
  const looseScore = raw.match(/(\d{1,3})\s*(?:分|\/\s*100|points?|%)/);
  if (looseScore) {
    return {
      transcript: "",
      score: clampScore(parseInt(looseScore[1]!, 10)),
      feedback: raw.trim().slice(0, 80),
    };
  }

  return null;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

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
  const tutorRef = useRef<RealtimeTutor | null>(null);
  const accumulatedTextRef = useRef("");
  // 录音时长指示
  const [recElapsed, setRecElapsed] = useState(0);
  useEffect(() => {
    if (phase !== "recording") return;
    setRecElapsed(0);
    const id = window.setInterval(() => setRecElapsed((t) => t + 0.1), 100);
    return () => window.clearInterval(id);
  }, [phase]);

  // target 切换时彻底重置 + 关连接（下一次再录会重连）
  useEffect(() => {
    setPhase("idle");
    setResult(null);
    setError(null);
    accumulatedTextRef.current = "";
    return () => {
      // 卸载时关连接
      try { tutorRef.current?.close(); } catch { /* */ }
      tutorRef.current = null;
    };
  }, [target]);

  async function startRecording() {
    setError(null);
    setResult(null);
    accumulatedTextRef.current = "";

    // 取密码（跟 TutorPanel 用同一个 localStorage key）
    const pwd = (() => {
      try {
        return localStorage.getItem("selena.cloud.pwd");
      } catch {
        return null;
      }
    })();
    if (!pwd) {
      setError("还没登录。回首页输入密码再来。");
      setPhase("error");
      return;
    }

    setPhase("connecting");
    try {
      const tutor = new RealtimeTutor(
        {
          serverUrl: REALTIME_URL,
          password: pwd,
          systemPrompt: buildJudgePrompt(target, mode),
          // **关键**：判分只要文字（JSON），不要 audio 输出——省时间 + 避免 Tina
          // 读 JSON 字符串
          responseModalities: ["text"],
        },
        {
          onAssistantTranscriptDelta: (delta) => {
            accumulatedTextRef.current += delta;
          },
          onAssistantTurnDone: (full) => {
            const text = full || accumulatedTextRef.current;
            const parsed = parseJudgeJSON(text);
            if (parsed) {
              setResult(parsed);
              setPhase("result");
              onScore(parsed.score, parsed.transcript, parsed.feedback);
            } else {
              // 解析失败时把 AI 原话显示出来诊断（最多 200 字）
              const raw = text.trim().slice(0, 200) || "(空)";
              setError(`没解析出评分。AI 说："${raw}"——请告诉 Claude 调 prompt`);
              setPhase("error");
            }
            // 一次判分完就关掉连接，下次重连
            try { tutor.close(); } catch { /* */ }
            tutorRef.current = null;
          },
          onState: (s: RealtimeState) => {
            // 把 lib 状态映射到 panel phase（已有 phase 时不覆盖）
            if (s === "error" && phase !== "result") {
              setError("WebSocket 出错");
              setPhase("error");
            }
          },
          onError: (e) => {
            setError(e.message || "未知错误");
            setPhase("error");
          },
        },
      );
      tutorRef.current = tutor;
      await tutor.connect();
      await tutor.startRecording();
      setPhase("recording");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("打不开麦克风 / 连不上 AI：" + msg);
      setPhase("error");
      try { tutorRef.current?.close(); } catch { /* */ }
      tutorRef.current = null;
    }
  }

  async function stopAndJudge() {
    const tutor = tutorRef.current;
    if (!tutor) return;
    setPhase("judging");
    try {
      await tutor.stopAndRespond();
      // 等 onAssistantTurnDone 触发后进入 "result" phase（异步）
    } catch (e) {
      setError("判分失败：" + (e instanceof Error ? e.message : String(e)));
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

      {phase === "idle" && (
        <button
          type="button"
          onClick={startRecording}
          className="w-full py-4 rounded-2xl bg-cyan-500/20 text-cyan-100 border-2 border-cyan-400/40 font-display font-bold hover:bg-cyan-500/30 active:scale-[0.98] transition-all"
        >
          🎤 按下开始录音
        </button>
      )}
      {phase === "connecting" && (
        <div className="w-full py-4 rounded-2xl bg-violet-500/15 text-violet-100 border-2 border-violet-400/40 text-center">
          🔗 连接 AI…
        </div>
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
