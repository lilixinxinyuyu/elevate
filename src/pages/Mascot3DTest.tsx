/**
 * /math/mascot3d — 隐藏的 3D 形象调试页（Phase C 起步）。
 *
 * 不进 nav；只通过直链访问。Selena 不需要看到这页（还没正式开放）。
 *
 * 用途：
 *  1. 看 procedural 卡通形象长什么样
 *  2. 切 skin（default / graduation / wizard / legendary）看视觉
 *  3. 接 RealtimeTutor 验嘴型同步（说话时嘴动）
 *  4. 验麦克风 amplitude → 嘴型也能跟着自己的语音动（测试用）
 *
 * 体积：Mascot3D 用 React.lazy 懒加载，主包不变。
 */

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { RealtimeTutor, type RealtimeState } from "../lib/realtimeTutor";
import { getStoredPassword } from "../db/cloudSync";
import type { MascotSkin } from "../components/Mascot3D";

const Mascot3D = lazy(() => import("../components/Mascot3D"));

const REALTIME_URL =
  (import.meta as unknown as { env: { VITE_REALTIME_URL?: string } }).env.VITE_REALTIME_URL ??
  "wss://selena-tutor-realtime.lilixinxinyuyu.workers.dev";

const SKIN_OPTIONS: { id: MascotSkin; label: string; lockLv?: number }[] = [
  { id: "default", label: "默认（Lv 1）" },
  { id: "graduation", label: "毕业袍（Lv 5）", lockLv: 5 },
  { id: "wizard", label: "小巫师（Lv 12）", lockLv: 12 },
  { id: "legendary", label: "传奇（Lv 20）", lockLv: 20 },
];

export function Mascot3DTestPage() {
  const [skin, setSkin] = useState<MascotSkin>("default");
  const [spin, setSpin] = useState(false);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const tutorRef = useRef<RealtimeTutor | null>(null);
  // 麦克风测试 — 不联 realtime，只读本地音量驱动嘴型
  const [micMode, setMicMode] = useState(false);
  const micCtxRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode; buf: Uint8Array; raf: number; stream: MediaStream } | null>(null);

  // 持续 poll audioLevel — realtime 模式下从 tutor 拿
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (tutorRef.current) {
        setAudioLevel(tutorRef.current.getCurrentAudioLevel());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const connectRealtime = async () => {
    const pwd = getStoredPassword() ?? undefined;
    const tutor = new RealtimeTutor(
      {
        serverUrl: REALTIME_URL,
        password: pwd,
        systemPrompt: `你是小进姐姐 — 一位温柔的虚拟数学老师。这是 3D 形象测试场景，请说几句话证明嘴型同步在工作。`,
      },
      {
        onState: setRealtimeState,
        onError: (e) => console.warn("[realtime]", e),
      },
    );
    tutorRef.current = tutor;
    try {
      await tutor.connect();
    } catch (e) {
      console.warn("connect failed", e);
    }
  };

  const startMicTest = async () => {
    if (micCtxRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sumSq = 0;
        for (const v of buf) {
          const norm = (v - 128) / 128;
          sumSq += norm * norm;
        }
        const rms = Math.sqrt(sumSq / buf.length);
        setAudioLevel(rms);
        if (micCtxRef.current) {
          micCtxRef.current.raf = requestAnimationFrame(tick);
        }
      };
      micCtxRef.current = { ctx, analyser, buf, raf: 0, stream };
      micCtxRef.current.raf = requestAnimationFrame(tick);
      setMicMode(true);
    } catch (e) {
      console.warn("mic failed", e);
    }
  };

  const stopMicTest = () => {
    if (!micCtxRef.current) return;
    cancelAnimationFrame(micCtxRef.current.raf);
    micCtxRef.current.stream.getTracks().forEach((t) => t.stop());
    void micCtxRef.current.ctx.close();
    micCtxRef.current = null;
    setMicMode(false);
    setAudioLevel(0);
  };

  // 简单按钮 push-to-talk —— 借用 realtime tutor
  const startRec = async () => {
    try {
      await tutorRef.current?.startRecording();
    } catch (e) {
      console.warn("rec start failed", e);
    }
  };
  const stopRec = async () => {
    try {
      await tutorRef.current?.stopAndRespond();
    } catch (e) {
      console.warn("rec stop failed", e);
    }
  };

  useEffect(() => {
    return () => {
      tutorRef.current?.close();
      stopMicTest();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 p-4">
      <div className="card-glow border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-rose-500/5">
        <div className="font-display font-bold text-amber-100 text-lg">
          🚧 小进 3D 形象（Phase C 实验）
        </div>
        <div className="text-xs text-amber-200/80 mt-1 leading-relaxed">
          Procedural 几何拼出来的卡通版本，先把整条管线走通：模型 + idle 动画 + skin 切换 + 嘴型同步。
          后续会换成 VRM 真模型；这页面先内部测试，nav 里看不到，只能直链 /math/mascot3d。
        </div>
      </div>

      {/* 3D 视口 */}
      <div className="rounded-2xl overflow-hidden border border-violet-400/30 bg-gradient-to-b from-ink-900 to-ink-950 h-[420px] sm:h-[520px]">
        <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-slate-400">加载 3D…</div>}>
          <Mascot3D audioLevel={audioLevel} skin={skin} spin={spin} />
        </Suspense>
      </div>

      {/* Skin 切换 */}
      <div className="card space-y-2">
        <div className="text-xs text-slate-400">Skin（实测调试，不受等级限制）</div>
        <div className="flex flex-wrap gap-2">
          {SKIN_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSkin(opt.id)}
              className={`chip text-xs px-3 py-1.5 ${
                skin === opt.id
                  ? "bg-violet-500/40 text-violet-50 border border-violet-300/60"
                  : "bg-white/5 text-slate-300 border border-white/10 hover:bg-violet-500/15"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSpin((v) => !v)}
            className={`chip text-xs px-3 py-1.5 ${
              spin
                ? "bg-emerald-500/30 text-emerald-100 border border-emerald-300/60"
                : "bg-white/5 text-slate-300 border border-white/10 hover:bg-emerald-500/15"
            }`}
          >
            🔄 自动旋转 {spin ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* 嘴型同步测试 */}
      <div className="card space-y-3">
        <div className="font-display font-bold text-slate-200">嘴型同步测试</div>
        <div className="text-xs text-slate-400">
          当前音量：
          <span className="font-mono text-amber-300 ml-1">{audioLevel.toFixed(3)}</span>
          <span className="mx-2 text-slate-500">·</span>
          状态：<span className="font-mono text-violet-300">{realtimeState}</span>
          {micMode && <span className="ml-2 text-emerald-300">🎤 麦克风模式</span>}
        </div>
        <div className="h-1.5 rounded-full bg-black/30 overflow-hidden ring-1 ring-white/5">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-rose-400 transition-all"
            style={{ width: `${Math.round(Math.min(1, audioLevel * 4) * 100)}%` }}
          />
        </div>
        <div className="text-[11px] text-slate-500">
          模式 1：连 realtime → 按住说话 → 小进语音回复时嘴会动<br />
          模式 2：直接对麦说话 → 嘴跟你的声音动（不发到 AI）
        </div>

        <div className="flex flex-wrap gap-2">
          {!tutorRef.current && (
            <button type="button" onClick={connectRealtime} className="btn-primary text-sm">
              ① 连 realtime 小进
            </button>
          )}
          {tutorRef.current && (
            <>
              <button
                type="button"
                onMouseDown={startRec}
                onMouseUp={stopRec}
                onTouchStart={(e) => {
                  e.preventDefault();
                  void startRec();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  void stopRec();
                }}
                disabled={realtimeState !== "ready" && realtimeState !== "recording"}
                className={`text-sm px-3 py-1.5 rounded-xl border ${
                  realtimeState === "recording"
                    ? "bg-rose-500/30 border-rose-400/60 text-rose-100 animate-pulse"
                    : "bg-violet-500/15 border-violet-400/40 text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
                }`}
              >
                {realtimeState === "recording"
                  ? "松开发送"
                  : realtimeState === "thinking"
                    ? "处理中…"
                    : realtimeState === "speaking"
                      ? "🔉 在说"
                      : "② 按住说话"}
              </button>
              <button
                type="button"
                onClick={() => {
                  tutorRef.current?.close();
                  tutorRef.current = null;
                  setRealtimeState("closed");
                }}
                className="btn-ghost text-sm"
              >
                断开 realtime
              </button>
            </>
          )}
          {!micMode ? (
            <button type="button" onClick={startMicTest} className="btn-secondary text-sm">
              🎤 仅麦克风测试嘴型
            </button>
          ) : (
            <button type="button" onClick={stopMicTest} className="btn-secondary text-sm">
              停麦克风
            </button>
          )}
        </div>
      </div>

      <div className="text-[11px] text-slate-500 leading-relaxed">
        ⚙️ 实现：procedural three.js 几何（球/胶囊/圆柱）+ react-three-fiber 渲染 +
        useFrame 每帧同步嘴型 scale.y 到 audioLevel。整个 Mascot3D 模块走 lazy import，
        不进主包；只有访问这一页才下载 ~250KB three+R3F+drei。
      </div>
    </div>
  );
}
