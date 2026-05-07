import { useEffect, useRef, useState } from "react";
import { RealtimeTutor, type RealtimeState } from "../lib/realtimeTutor";
import { getStoredPassword } from "../db/cloudSync";
import { db } from "../db/dexie";
import { bindToolsForStudent, gatherSnapshot, snapshotToInstructions } from "../lib/tutorContext";

/**
 * /math/voice-test — 调试页：验证 realtime WebSocket 代理 + 麦克风采集 + 音频回放。
 *
 * 不进 nav；只通过直链访问。Selena 不需要看到这个页面。
 *
 * 校验项：
 *  1. WebSocket 能否握手（Worker proxy 通了？）
 *  2. session.update 后服务端 ack（dashscope 通了？）
 *  3. 录音 → commit → AI 回复（端到端）
 *  4. 实测延时（从 stopRecording 到第一个 audio.delta）
 */

const REALTIME_URL =
  (import.meta as unknown as { env: { VITE_REALTIME_URL?: string } }).env.VITE_REALTIME_URL ??
  "wss://selena-tutor-realtime.lilixinxinyuyu.workers.dev";

export function VoiceTestPage() {
  const tutorRef = useRef<RealtimeTutor | null>(null);
  const [state, setState] = useState<RealtimeState>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [userTranscript, setUserTranscript] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const firstAudioAtRef = useRef<number | null>(null);

  const log = (s: string) => setLogs((ls) => [...ls.slice(-20), `${new Date().toLocaleTimeString()} ${s}`]);

  useEffect(() => {
    return () => {
      tutorRef.current?.close();
    };
  }, []);

  const connect = async () => {
    // 收集 Selena 学情 snapshot + 绑定 tools — 给小进 Phase 2 + Phase 3 上下文
    const student = (await db.students.toArray())[0];
    if (!student) {
      log("no student in db; cannot connect");
      return;
    }
    let snapshotText = "";
    try {
      const snap = await gatherSnapshot(student.id, student.name);
      snapshotText = snapshotToInstructions(snap);
      log(`snapshot ready: 7d=${snap.last7d.totalAttempts}题 弱${snap.weakSkills.length}个 错${snap.unresolvedMistakeCount}道`);
    } catch (e) {
      log(`snapshot failed: ${(e as Error).message}`);
    }
    const tools = bindToolsForStudent(student.id);
    const sysPrompt = `你是 Selena 的数学老师"小进姐姐"，温柔耐心，普通话。
- 用 60-100 字的简短句，像聊天，不长篇说教
- 苏格拉底式：先问思路、给小线索，不直接报答案
- Selena 9 岁四年级，听不懂大人术语，用具体例子
- 鼓励多于指正

${snapshotText}

如果她问的具体问题（"具体哪些题做错了" / "我哪个 skill 最弱"等）quick snapshot 不够细，调对应 tool 拿数据再答。`;

    const tutor = new RealtimeTutor(
      {
        serverUrl: REALTIME_URL,
        password: getStoredPassword() ?? undefined,
        systemPrompt: sysPrompt,
        tools,
      },
      {
        onState: (s) => {
          setState(s);
          log(`state → ${s}`);
        },
        onUserTranscript: (text) => {
          log(`user transcript: ${text}`);
          setUserTranscript(text);
        },
        onAssistantTranscriptDelta: (delta) => {
          if (firstAudioAtRef.current == null && stopAtRef.current != null) {
            firstAudioAtRef.current = performance.now();
            setLatencyMs(Math.round(firstAudioAtRef.current - stopAtRef.current));
          }
          setAssistantText((t) => t + delta);
        },
        onAssistantTurnDone: (text) => log(`turn done: ${text.length} chars`),
        onToolCall: (info) => {
          if (info.error) log(`🔧 tool ${info.name} ERROR: ${info.error}`);
          else log(`🔧 tool ${info.name}(${JSON.stringify(info.args)}) → ${JSON.stringify(info.result).slice(0, 120)}`);
        },
        onError: (err) => log(`ERROR: ${err.code ?? ""} ${err.message}`),
      },
    );
    tutorRef.current = tutor;
    log(`connecting to ${REALTIME_URL}…`);
    try {
      await tutor.connect();
      log("connected");
    } catch (e) {
      log(`connect failed: ${(e as Error).message}`);
    }
  };

  const startRec = async () => {
    setUserTranscript("");
    setAssistantText("");
    setLatencyMs(null);
    stopAtRef.current = null;
    firstAudioAtRef.current = null;
    try {
      await tutorRef.current?.startRecording();
    } catch (e) {
      log(`startRecording failed: ${(e as Error).message}`);
    }
  };

  const stopRec = async () => {
    stopAtRef.current = performance.now();
    await tutorRef.current?.stopAndRespond();
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold">语音 realtime 调试页</h1>
      <div className="text-xs text-slate-400">
        Worker URL: <code className="text-slate-200">{REALTIME_URL}</code>
      </div>

      <div className="card-glow space-y-3">
        <div className="flex items-center gap-3">
          <div className="text-sm">
            状态: <span className="font-mono text-violet-300">{state}</span>
          </div>
          {latencyMs != null && (
            <div className="text-sm">
              首音延时:{" "}
              <span className="font-mono text-emerald-300">{latencyMs} ms</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={connect}
            disabled={state !== "idle" && state !== "closed" && state !== "error"}
          >
            ① 连接
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={startRec}
            disabled={state !== "ready"}
          >
            ② 按住说话（开始）
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={stopRec}
            disabled={state !== "recording"}
          >
            ③ 松开（送出）
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => tutorRef.current?.cancelResponse()}
            disabled={state !== "thinking" && state !== "speaking"}
          >
            打断
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => tutorRef.current?.close()}
          >
            关闭
          </button>
        </div>

        {userTranscript && (
          <div className="text-sm">
            <span className="text-slate-400">我说：</span>
            <span className="text-slate-100">{userTranscript}</span>
          </div>
        )}
        {assistantText && (
          <div className="text-sm">
            <span className="text-slate-400">小进：</span>
            <span className="text-emerald-200">{assistantText}</span>
          </div>
        )}
      </div>

      <div className="card text-xs font-mono space-y-0.5 max-h-72 overflow-auto">
        {logs.length === 0 && <div className="text-slate-500">（日志会出现在这里）</div>}
        {logs.map((l, i) => (
          <div key={i} className="text-slate-300">
            {l}
          </div>
        ))}
      </div>

      <div className="text-xs text-slate-500 leading-relaxed">
        <div>测试步骤：① 连接 → ② 按住说话 → 说一句中文 → ③ 松开 → 等 AI 回复</div>
        <div className="mt-1">
          如果 ① 失败：
          <ul className="list-disc list-inside ml-2 mt-0.5">
            <li>Worker 没部署？curl {REALTIME_URL.replace("wss://", "https://")}/health</li>
            <li>APP_PASSWORD 没匹配？wrangler secret put APP_PASSWORD --config workers/tutor-realtime/wrangler.toml</li>
            <li>DASHSCOPE_API_KEY 没配？wrangler secret put DASHSCOPE_API_KEY --config workers/tutor-realtime/wrangler.toml</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
