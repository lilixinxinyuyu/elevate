/**
 * Realtime tutor 客户端 — 通过 selena-tutor-realtime Worker 代理
 * 与 dashscope-intl realtime endpoint (qwen3.5-omni-flash-realtime) 通信。
 *
 * 协议（OpenAI Realtime 兼容）：
 *   client → server:
 *     session.update                {session: {modalities, voice, instructions, ...}}
 *     input_audio_buffer.append     {audio: <base64 PCM16 24kHz mono LE>}
 *     input_audio_buffer.commit     (告诉服务端"我说完了")
 *     response.create               (要求生成回复)
 *     response.cancel               (中断当前响应)
 *   server → client:
 *     session.created / session.updated
 *     input_audio_buffer.speech_started / speech_stopped (VAD 信号)
 *     conversation.item.input_audio_transcription.completed (用户语音转文字)
 *     response.audio_transcript.delta (assistant 文字流式)
 *     response.audio.delta (assistant PCM16 音频流式)
 *     response.done
 *     error
 *
 * 浏览器端无法直连 dashscope（API key 不能露），所以走 Worker 代理。
 * Worker 鉴权用 APP_PASSWORD（Sec-WebSocket-Protocol: 'bearer, <pwd>'）。
 */

export type RealtimeState =
  | "idle"
  | "connecting"
  | "ready"
  | "recording"
  | "thinking"
  | "speaking"
  | "tool_calling"
  | "closed"
  | "error";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string; default?: unknown }>;
    required?: string[];
  };
  /** 接到 AI 的调用请求时执行；返回值会序列化成 JSON 发回 */
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface RealtimeTutorConfig {
  /** WSS endpoint to the proxy Worker, e.g. wss://selena-tutor-realtime.<acct>.workers.dev */
  serverUrl: string;
  /** APP_PASSWORD（与 Pages 共享） */
  password?: string;
  /** dashscope realtime model id */
  model?: string;
  /** Selena 专用 system instructions（讲题角色） */
  systemPrompt?: string;
  /** 期望的音色。qwen3.5-omni-flash-realtime 支持的列表见
   *  https://www.alibabacloud.com/help/en/model-studio/omni-voice-list
   *  例：Tina（默认）、Cindy、Sunny、Serena、Mia、Hana、Ethan…
   *  注意 qwen3-omni 的"Cherry/Chelsie"在 3.5 上会报 Voice not supported。
   *  不传则用服务端默认（Tina）。 */
  voice?: string;
  /** 采样率，默认 24000（与 OpenAI realtime 一致） */
  sampleRate?: number;
  /** AI 可以调的工具列表（function calling） */
  tools?: ToolDefinition[];
  /**
   * v0.31.104：限制 response.create 时的 modalities。
   * 默认 ["text", "audio"]（讲题对话模式）。
   * 英语朗读判分场景用 ["text"]——只要 JSON 文字评分，不需要 audio 回放。
   */
  responseModalities?: ("text" | "audio")[];
}

export interface RealtimeTutorCallbacks {
  onState?: (s: RealtimeState) => void;
  /** 用户的语音被服务端转写完成 */
  onUserTranscript?: (text: string) => void;
  /** Assistant 的文字流式回复（增量） */
  onAssistantTranscriptDelta?: (delta: string) => void;
  /** 一轮 response 结束（assistant 全文） */
  onAssistantTurnDone?: (fullText: string) => void;
  /** AI 调了某个 tool（开始 + 结束） — 给 UI 显示"小进在查…" */
  onToolCall?: (info: { name: string; args: Record<string, unknown>; result?: unknown; error?: string }) => void;
  onError?: (err: { code?: string; message: string }) => void;
}

/** 把 ArrayBuffer 编 base64（不依赖 Buffer / FileReader） */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(s);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export class RealtimeTutor {
  private cfg: Required<Omit<RealtimeTutorConfig, "password" | "systemPrompt" | "tools" | "responseModalities">> &
    Pick<RealtimeTutorConfig, "password" | "systemPrompt" | "tools">;
  private cb: RealtimeTutorCallbacks;
  private ws: WebSocket | null = null;
  private state: RealtimeState = "idle";
  private audioCtx: AudioContext | null = null;
  private captureStream: MediaStream | null = null;
  private captureSrc: MediaStreamAudioSourceNode | null = null;
  private captureWorklet: AudioWorkletNode | null = null;
  /** 累计待 commit 的 PCM 字节数 — dashscope 要求 commit 前至少 100ms 音频 */
  private bufferedSampleCount = 0;
  /** 串行播放 — 用 currentTime+offset 实现无缝拼接 */
  private playbackTime = 0;
  private assistantTextBuf = "";
  /** 播放链上挂的 analyser，用于嘴型同步等 — lazy 创建 */
  private playbackAnalyser: AnalyserNode | null = null;
  private playbackAnalyserBuf: Uint8Array | null = null;
  /** 进行中的 tool call：item_id → 累计 args JSON 字符串 */
  private pendingToolCalls = new Map<
    string,
    { callId: string; name: string; argsBuf: string }
  >();
  /** tool name → handler 映射，handler 接收已 parse 的 args */
  private toolMap = new Map<string, ToolDefinition>();

  private responseModalities: ("text" | "audio")[];

  constructor(config: RealtimeTutorConfig, cb: RealtimeTutorCallbacks = {}) {
    this.responseModalities = config.responseModalities ?? ["text", "audio"];
    this.cfg = {
      serverUrl: config.serverUrl,
      password: config.password,
      model: config.model ?? "qwen3.5-omni-flash-realtime",
      systemPrompt: config.systemPrompt,
      // 不默认指定 voice — 让服务端用 Tina（qwen3.5-omni 默认）。
      // 想改可以传 "Cindy" / "Sunny" / "Serena" 等
      voice: config.voice ?? "",
      sampleRate: config.sampleRate ?? 24000,
      tools: config.tools,
    };
    this.cb = cb;
    if (config.tools) for (const t of config.tools) this.toolMap.set(t.name, t);
  }

  getState(): RealtimeState {
    return this.state;
  }

  private setState(s: RealtimeState): void {
    if (this.state === s) return;
    this.state = s;
    this.cb.onState?.(s);
  }

  /** 建 WebSocket，发 session.update。完成后状态进入 ready。*/
  async connect(): Promise<void> {
    if (this.state !== "idle" && this.state !== "closed" && this.state !== "error") {
      throw new Error(`cannot connect from state=${this.state}`);
    }
    this.setState("connecting");

    const url = new URL(this.cfg.serverUrl);
    url.searchParams.set("model", this.cfg.model);

    // 鉴权用 subprotocol 而非 query — 不进 server log
    const protocols: string[] = [];
    if (this.cfg.password) protocols.push("bearer", this.cfg.password);

    const ws = new WebSocket(url.toString(), protocols.length > 0 ? protocols : undefined);
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        ws.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        ws.removeEventListener("open", onOpen);
        reject(new Error("ws_open_failed"));
      };
      ws.addEventListener("open", onOpen, { once: true });
      ws.addEventListener("error", onError, { once: true });
    });

    ws.addEventListener("message", (e) => this.handleServerMessage(e.data));
    ws.addEventListener("close", (e) => {
      this.setState(e.code === 1000 ? "closed" : "error");
    });
    ws.addEventListener("error", () => {
      this.cb.onError?.({ message: "websocket_error" });
      this.setState("error");
    });

    // 发 session.update — 配置 modalities / 音频格式 / 系统指令 / tools
    const sessionCfg: Record<string, unknown> = {
      // v0.31.104：modalities 可配——讲题用 ["text","audio"]，判分用 ["text"]
      modalities: this.responseModalities,
      instructions: this.cfg.systemPrompt ?? defaultSystemPrompt(),
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      input_audio_transcription: { model: "whisper-1" },
      // 关掉 server VAD — 我们用 push-to-talk 手动 commit，更可控
      turn_detection: null,
    };
    if (this.cfg.voice) sessionCfg.voice = this.cfg.voice;
    if (this.cfg.tools && this.cfg.tools.length > 0) {
      sessionCfg.tools = this.cfg.tools.map((t) => ({
        type: "function",
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }));
      sessionCfg.tool_choice = "auto";
    }
    this.send({ type: "session.update", session: sessionCfg });

    this.setState("ready");
  }

  /** 拉麦克风 + 起 AudioWorklet，PCM16 块通过 ws.append 发出去 */
  async startRecording(): Promise<void> {
    if (this.state !== "ready") {
      throw new Error(`cannot record from state=${this.state}`);
    }
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
        sampleRate: this.cfg.sampleRate,
      });
      // 加载 worklet — 文件在 public/audio/，dev / prod 路径都是 /audio/...
      try {
        await this.audioCtx.audioWorklet.addModule("/audio/pcm16-encoder-worklet.js");
      } catch (e) {
        this.cb.onError?.({ code: "worklet_load_failed", message: (e as Error).message });
        throw e;
      }
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: this.cfg.sampleRate,
        },
      });
    } catch (e) {
      this.cb.onError?.({ code: "mic_denied", message: (e as Error).message });
      throw e;
    }
    this.captureStream = stream;
    this.captureSrc = this.audioCtx.createMediaStreamSource(stream);
    this.captureWorklet = new AudioWorkletNode(this.audioCtx, "pcm16-encoder");
    this.captureWorklet.port.onmessage = (e) => {
      const buffer = e.data as ArrayBuffer;
      // 协议要求 base64 PCM16 mono LE
      this.send({
        type: "input_audio_buffer.append",
        audio: arrayBufferToBase64(buffer),
      });
      this.bufferedSampleCount += buffer.byteLength / 2;
    };
    this.captureSrc.connect(this.captureWorklet);
    // 不连 destination，避免本地回声

    this.bufferedSampleCount = 0;
    this.assistantTextBuf = "";
    this.setState("recording");
  }

  /** 停麦 + commit + 让服务端开始生成回复 */
  async stopAndRespond(): Promise<void> {
    if (this.state !== "recording") return;
    // 拆麦克风
    this.captureWorklet?.disconnect();
    this.captureSrc?.disconnect();
    this.captureStream?.getTracks().forEach((t) => t.stop());
    this.captureWorklet = null;
    this.captureSrc = null;
    this.captureStream = null;

    // 必须有至少 100ms 音频才能 commit；否则服务端报 input_audio_buffer_commit_empty
    const minSamples = (this.cfg.sampleRate * 100) / 1000;
    if (this.bufferedSampleCount < minSamples) {
      this.cb.onError?.({ code: "audio_too_short", message: "录音太短，再说一次试试" });
      this.setState("ready");
      return;
    }

    this.send({ type: "input_audio_buffer.commit" });
    this.send({
      type: "response.create",
      response: { modalities: this.responseModalities },
    });
    this.setState("thinking");
  }

  /** 中断当前响应（如果 AI 还在说话）*/
  cancelResponse(): void {
    if (this.state === "thinking" || this.state === "speaking") {
      this.send({ type: "response.cancel" });
      this.stopPlayback();
      this.setState("ready");
    }
  }

  close(): void {
    try {
      this.ws?.close(1000, "client_close");
    } catch {
      /* */
    }
    this.ws = null;
    this.stopPlayback();
    this.captureWorklet?.disconnect();
    this.captureSrc?.disconnect();
    this.captureStream?.getTracks().forEach((t) => t.stop());
    this.captureWorklet = null;
    this.captureSrc = null;
    this.captureStream = null;
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      void this.audioCtx.close();
    }
    this.audioCtx = null;
    this.setState("closed");
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  private handleServerMessage(data: unknown): void {
    let evt: { type?: string; [k: string]: unknown };
    if (typeof data === "string") {
      try {
        evt = JSON.parse(data);
      } catch {
        return;
      }
    } else if (data instanceof ArrayBuffer || data instanceof Blob) {
      // realtime 协议正常都是 JSON；二进制不期望出现
      return;
    } else {
      return;
    }

    switch (evt.type) {
      case "session.created":
      case "session.updated":
        // ack — nothing to do
        break;
      case "response.created":
        this.assistantTextBuf = "";
        this.setState("speaking");
        break;
      case "response.audio_transcript.delta": {
        const delta = (evt.delta as string) ?? "";
        if (delta) {
          this.assistantTextBuf += delta;
          this.cb.onAssistantTranscriptDelta?.(delta);
        }
        break;
      }
      case "response.audio.delta": {
        const audioB64 = evt.delta as string | undefined;
        if (audioB64) this.queueAudioChunk(audioB64);
        break;
      }
      case "conversation.item.input_audio_transcription.completed": {
        const txt = evt.transcript as string | undefined;
        if (txt) this.cb.onUserTranscript?.(txt);
        break;
      }
      // ===== tool call lifecycle =====
      case "response.output_item.added": {
        // AI 决定调一个 function — 记 item_id → name/call_id
        const item = evt.item as
          | { id?: string; type?: string; name?: string; call_id?: string }
          | undefined;
        if (item?.type === "function_call" && item.id && item.name && item.call_id) {
          this.pendingToolCalls.set(item.id, {
            callId: item.call_id,
            name: item.name,
            argsBuf: "",
          });
          this.setState("tool_calling");
        }
        break;
      }
      case "response.function_call_arguments.delta": {
        const itemId = evt.item_id as string | undefined;
        const delta = evt.delta as string | undefined;
        if (itemId && delta) {
          const pending = this.pendingToolCalls.get(itemId);
          if (pending) pending.argsBuf += delta;
        }
        break;
      }
      case "response.function_call_arguments.done": {
        const itemId = evt.item_id as string | undefined;
        if (!itemId) break;
        const pending = this.pendingToolCalls.get(itemId);
        if (!pending) break;
        // arguments 也可能直接在 evt.arguments 里给（done 事件携带完整字符串）
        const argsStr = (evt.arguments as string | undefined) ?? pending.argsBuf;
        void this.executeTool(pending.callId, pending.name, argsStr);
        this.pendingToolCalls.delete(itemId);
        break;
      }
      case "response.done":
        this.cb.onAssistantTurnDone?.(this.assistantTextBuf);
        this.assistantTextBuf = "";
        // 如果上一轮 response 含 tool call，状态已经走到 tool_calling/再 thinking；
        // 这里 done 可能只是该轮（含 function_call）结束，等我们送回 output 再开新 response。
        // 简单策略：done 后无待处理 tool 就回 ready
        if (this.pendingToolCalls.size === 0) {
          this.setState("ready");
        }
        break;
      case "error": {
        const err = evt.error as { code?: string; message?: string } | undefined;
        this.cb.onError?.({ code: err?.code, message: err?.message ?? "unknown_error" });
        // error 不一定致命；不主动改状态
        break;
      }
      default:
        // 未识别的事件忽略
        break;
    }
  }

  /** 执行本地 tool handler，把结果发回服务端，再 response.create 让 AI 继续 */
  private async executeTool(callId: string, name: string, argsJson: string): Promise<void> {
    const tool = this.toolMap.get(name);
    let args: Record<string, unknown> = {};
    try {
      args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
    } catch {
      /* 容错：参数 parse 失败当空 */
    }
    if (!tool) {
      const errMsg = `tool_not_found: ${name}`;
      this.cb.onToolCall?.({ name, args, error: errMsg });
      this.sendToolResult(callId, JSON.stringify({ error: errMsg }));
      return;
    }
    try {
      const result = await tool.handler(args);
      this.cb.onToolCall?.({ name, args, result });
      this.sendToolResult(callId, JSON.stringify(result));
    } catch (e) {
      const errMsg = (e as Error).message ?? "tool_handler_failed";
      this.cb.onToolCall?.({ name, args, error: errMsg });
      this.sendToolResult(callId, JSON.stringify({ error: errMsg }));
    }
  }

  private sendToolResult(callId: string, output: string): void {
    // 把结果作为 conversation.item 推上去
    this.send({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output,
      },
    });
    // 然后让 AI 继续生成（基于 tool 结果）
    this.send({ type: "response.create" });
    this.setState("thinking");
  }

  private queueAudioChunk(b64: string): void {
    if (!this.audioCtx) {
      // 第一次没启动 audioCtx — 用 24kHz 起一个
      this.audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
        sampleRate: this.cfg.sampleRate,
      });
    }
    // Lazy 建 analyser（嘴型同步用），挂在 source → analyser → destination
    if (!this.playbackAnalyser) {
      this.playbackAnalyser = this.audioCtx.createAnalyser();
      this.playbackAnalyser.fftSize = 256;
      this.playbackAnalyserBuf = new Uint8Array(this.playbackAnalyser.frequencyBinCount);
      this.playbackAnalyser.connect(this.audioCtx.destination);
    }
    const buffer = base64ToArrayBuffer(b64);
    const int16 = new Int16Array(buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      const v = int16[i] ?? 0;
      float32[i] = v < 0 ? v / 0x8000 : v / 0x7fff;
    }
    const audioBuf = this.audioCtx.createBuffer(1, float32.length, this.cfg.sampleRate);
    audioBuf.getChannelData(0).set(float32);
    const src = this.audioCtx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(this.playbackAnalyser);
    const startAt = Math.max(this.audioCtx.currentTime, this.playbackTime);
    src.start(startAt);
    this.playbackTime = startAt + audioBuf.duration;
  }

  /** 当前播放音频的瞬时音量（RMS, 0-1）。没在播 = 0。给嘴型同步等用。 */
  getCurrentAudioLevel(): number {
    if (!this.playbackAnalyser || !this.playbackAnalyserBuf || !this.audioCtx) return 0;
    if (this.audioCtx.currentTime > this.playbackTime + 0.05) return 0; // 不在播
    // TS 5.7 lib.dom.d.ts 把 getByteTimeDomainData 参数收紧到 Uint8Array<ArrayBuffer>
    // 这里实际就是 ArrayBuffer-backed，cast 兼容
    this.playbackAnalyser.getByteTimeDomainData(
      this.playbackAnalyserBuf as Uint8Array<ArrayBuffer>,
    );
    let sumSq = 0;
    for (const v of this.playbackAnalyserBuf) {
      const norm = (v - 128) / 128;
      sumSq += norm * norm;
    }
    return Math.sqrt(sumSq / this.playbackAnalyserBuf.length);
  }

  private stopPlayback(): void {
    this.playbackTime = 0;
    // BufferSourceNode 已 start 的没法直接 stop —— 直接靠新的 audioCtx 关闭也行；
    // 这里我们至少 reset playbackTime 让后续 chunk 排到 currentTime。
  }
}

function defaultSystemPrompt(): string {
  return `你是 Selena 的数学老师"小进姐姐"，温柔耐心。语音对话时遵守：
- 用 60-100 字的简短句，像聊天，不要长篇说教
- 苏格拉底式：先问她思路 / 让她猜、让她算，不直接给答案
- 答错后追问"你是怎么想的？"
- 鼓励多于指正
- Selena 是 9 岁四年级学生，听不懂大人术语；用具体例子
- 中文普通话，中性自然语气`;
}
