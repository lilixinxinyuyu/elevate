/**
 * AI 老师客户端：
 *
 *  1. explainQuestion(args) — 错题文本讲解（qwen-plus 文本 + Cherry TTS 朗读）
 *  2. voiceAsk({audioBlob, ...}) — 按住说话录音上传（qwen-omni 多模态）
 *  3. generateChineseQuestions(args) — 让 AI 出新题（qwen-plus + 后端生成）
 *
 * 都通过 /api/tutor/* 和 /api/generate/* endpoint 走，鉴权用 stored password。
 */

import { getStoredPassword } from "../db/cloudSync";
import { logFcCall } from "./fcCallLog";
import type { Question } from "../core/types";

function authHeader(): Record<string, string> {
  const pwd = getStoredPassword();
  return pwd ? { Authorization: `Bearer ${pwd}` } : {};
}

export class TutorError extends Error {
  constructor(public code: string, public status: number, public detail?: string) {
    const suffix = detail ? `: ${detail.slice(0, 200)}` : "";
    super(`tutor_${code}_${status}${suffix}`);
  }
}

// ============================================================
//  1. 文本讲题
// ============================================================

export interface ExplainArgs {
  subjectId: "math" | "chinese";
  stem: string;
  correctAnswer: string;
  studentAnswer: string;
  skillName?: string;
  hint?: string;
  /** 多轮对话：上一轮 AI 说 + 用户追问 */
  conversation?: { role: "assistant" | "user"; content: string }[];
}

export interface ExplainResult {
  explanation: string;
  model: string;
}

export async function explainQuestion(args: ExplainArgs): Promise<ExplainResult> {
  const r = await fetch("/api/tutor/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    let parsed: { error?: string; detail?: string } | null = null;
    try {
      parsed = await r.json();
    } catch {
      /* 上游可能不是 JSON */
    }
    throw new TutorError(parsed?.error ?? "request_failed", r.status, parsed?.detail);
  }
  const j = (await r.json()) as { ok?: boolean; explanation?: string; model?: string };
  if (!j.ok || !j.explanation) {
    throw new TutorError("empty_response", r.status, "no explanation in body");
  }
  return { explanation: j.explanation, model: j.model ?? "unknown" };
}

// ============================================================
//  2. 语音问答（push-to-talk）
// ============================================================

export interface VoiceAskArgs {
  audioBlob: Blob;
  mimeType: string;
  subjectId: "math" | "chinese";
  questionContext?: { stem?: string; correctAnswer?: string; skillName?: string };
  conversation?: { role: "assistant" | "user"; content: string }[];
}

export interface VoiceAskResult {
  reply: string;
  model: string;
}

/** Blob → base64（不带 data: 前缀） */
async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  // 分块避免超长 string 问题
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as number[]);
  }
  return btoa(bin);
}

export async function voiceAsk(args: VoiceAskArgs): Promise<VoiceAskResult> {
  const audioBase64 = await blobToBase64(args.audioBlob);
  const r = await fetch("/api/tutor/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({
      audioBase64,
      mimeType: args.mimeType,
      subjectId: args.subjectId,
      questionContext: args.questionContext,
      conversation: args.conversation,
    }),
  });
  if (!r.ok) {
    let parsed: { error?: string; detail?: string } | null = null;
    try {
      parsed = await r.json();
    } catch {
      /* */
    }
    throw new TutorError(parsed?.error ?? "request_failed", r.status, parsed?.detail);
  }
  const j = (await r.json()) as { ok?: boolean; reply?: string; model?: string };
  if (!j.ok || !j.reply) {
    throw new TutorError("empty_response", r.status, "no reply in body");
  }
  return { reply: j.reply, model: j.model ?? "unknown" };
}

// ============================================================
//  3. AI 出题
// ============================================================

export interface GenerateQuestionsArgs {
  subjectId: "chinese" | "math";
  unitId: string;
  unitName?: string;
  skillId: string;
  skillName?: string;
  count: number;
  difficulty?: string;
  /** "上册" / "下册"，让 AI 出对应学期的题（关键，避免出错版本） */
  term?: "上册" | "下册";
  existingStems?: string[];
  recentMistakeStems?: string[];
}

export interface GenerateQuestionsResult {
  questions: Question[];
  model: string;
  generatedCount: number;
  requestedCount: number;
}

/** 通用：math / chinese 都用这个。函数名保留 "Chinese" 兼容老代码。 */
export const generateChineseQuestions = generateAiQuestions;

/**
 * 模块级单例：用 (subjectId, skillId) 做 key 缓存进行中的 promise，
 * 避免用户多次点击或多次 AutoGenerateOnEmpty 实例同时触发同一请求。
 */
const inflightGens = new Map<string, Promise<GenerateQuestionsResult>>();

export async function generateAiQuestions(
  args: GenerateQuestionsArgs,
): Promise<GenerateQuestionsResult> {
  const dedupKey = `${args.subjectId}::${args.skillId}::${args.count}`;
  const existing = inflightGens.get(dedupKey);
  if (existing) return existing;
  const promise = doGenerateAiQuestions(args).finally(() => {
    inflightGens.delete(dedupKey);
  });
  inflightGens.set(dedupKey, promise);
  return promise;
}

async function doGenerateAiQuestions(
  args: GenerateQuestionsArgs,
): Promise<GenerateQuestionsResult> {
  const r = await fetch("/api/generate/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    let parsed: { error?: string; detail?: string } | null = null;
    try {
      parsed = await r.json();
    } catch {
      /* */
    }
    throw new TutorError(parsed?.error ?? "request_failed", r.status, parsed?.detail);
  }
  const j = (await r.json()) as {
    ok?: boolean;
    questions?: Question[];
    model?: string;
    generatedCount?: number;
    requestedCount?: number;
  };
  if (!j.ok || !Array.isArray(j.questions)) {
    throw new TutorError("empty_response", r.status, "no questions in body");
  }
  return {
    questions: j.questions,
    model: j.model ?? "unknown",
    generatedCount: j.generatedCount ?? j.questions.length,
    requestedCount: j.requestedCount ?? args.count,
  };
}

// ============================================================
//  3.5 AI 图像生成（勋章 / 图标 / 配图）
// ============================================================

export interface GenerateImageArgs {
  prompt: string;
  /** 默认 qwen-image-2.0-pro */
  model?: "qwen-image-2.0-pro" | "qwen-image-2.0";
  /** 默认 512*512（勋章用） */
  size?: "512*512" | "1024*1024";
  style?: string;
  n?: number;
}

export interface GenerateImageResult {
  urls: string[];
  model: string;
  taskId: string;
}

/**
 * v0.35.19 (爸爸反馈 5-18): image gen 3 路径自动适配:
 *   1. **FC-bypass** (新主路径): ESA 返 fcUrl, client 自己 POST FC (走
 *      token-plan 月订阅, 6-25s sync). ESA 11s 超时绕过.
 *   2. 老 sync (CF Pages 兼容): ESA 直接返 urls
 *   3. 老 async (BAILIAN, 已废): ESA 返 taskId, client poll status
 */
export async function generateImage(args: GenerateImageArgs & { source?: string }): Promise<GenerateImageResult> {
  const startedAt = Date.now();
  const source = args.source;
  const r = await fetch("/api/generate/image", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(args),
  });
  if (r.status >= 400) {
    let parsed: { error?: string; detail?: string } | null = null;
    try { parsed = await r.json(); } catch { /* */ }
    throw new TutorError(parsed?.error ?? "request_failed", r.status, parsed?.detail);
  }
  const j = (await r.json()) as {
    ok?: boolean;
    urls?: string[];
    model?: string;
    taskId?: string;
    status?: "pending" | "done" | "failed";
    fcUrl?: string;
    provider?: string;
  };

  // 路径 1: FC bypass (v0.35.19 主路径)
  if (j.provider === "fc-bypass" && typeof j.fcUrl === "string") {
    const fcR = await fetch(j.fcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(args),
    });
    if (!fcR.ok) {
      let parsed: { error?: string; tried?: unknown } | null = null;
      try { parsed = await fcR.json(); } catch { /* */ }
      throw new TutorError(parsed?.error ?? "fc_request_failed", fcR.status, JSON.stringify(parsed?.tried ?? ""));
    }
    const fcJ = (await fcR.json()) as {
      ok?: boolean;
      urls?: string[];
      model?: string;
      provider?: string;
    };
    if (!Array.isArray(fcJ.urls) || fcJ.urls.length === 0) {
      logFcCall({ kind: "image_gen", success: false, elapsedMs: Date.now() - startedAt, error: "fc_no_urls", source });
      throw new TutorError("fc_no_urls", 502);
    }
    logFcCall({ kind: "image_gen", success: true, elapsedMs: Date.now() - startedAt, model: fcJ.model, source });
    return { urls: fcJ.urls, model: fcJ.model ?? "unknown", taskId: "" };
  }

  // 路径 2: 老 sync (CF Pages 兼容)
  if (Array.isArray(j.urls) && j.urls.length > 0) {
    logFcCall({ kind: "image_gen", success: true, elapsedMs: Date.now() - startedAt, model: j.model, source });
    return { urls: j.urls, model: j.model ?? "unknown", taskId: j.taskId ?? "" };
  }

  // 路径 3: 老 async (BAILIAN, 已废止但留 polling 兼容性)
  const taskId = j.taskId;
  if (!taskId) {
    throw new TutorError("empty_response", r.status, "no urls and no taskId and no fcUrl");
  }

  const MAX_POLLS = 60; // 60 × 2s = 120s
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((res) => setTimeout(res, 2000));
    const sr = await fetch(`/api/generate/image/status/${taskId}`, {
      headers: authHeader(),
    });
    if (!sr.ok) {
      if (sr.status === 401) throw new TutorError("unauthorized", 401);
      if (sr.status === 404) throw new TutorError("task_not_found", 404);
      continue;
    }
    const sj = (await sr.json()) as {
      ok?: boolean;
      status?: "pending" | "done" | "failed";
      urls?: string[];
      error?: string;
      model?: string;
    };
    if (sj.status === "done" && Array.isArray(sj.urls) && sj.urls.length > 0) {
      return { urls: sj.urls, model: sj.model ?? j.model ?? "unknown", taskId };
    }
    if (sj.status === "failed") {
      throw new TutorError("gen_failed", 502, sj.error);
    }
  }
  throw new TutorError("polling_timeout", 408, `image gen exceeded ${MAX_POLLS * 2}s`);
}

// ============================================================
//  4. 浏览器麦克风录音 helper（push-to-talk）
// ============================================================

export interface MicRecorder {
  /** 开始录音 */
  start(): Promise<void>;
  /** 停止录音并返回 Blob */
  stop(): Promise<{ blob: Blob; mimeType: string; durationMs: number }>;
  /** 强制释放麦克风 */
  release(): void;
}

/**
 * 创建一个 MediaRecorder 包装。需要用户 gesture 触发（按住按钮）才能拿到麦克风权限。
 *
 * 浏览器兼容：
 *   - Chrome / Edge: webm/opus
 *   - Safari iOS: mp4/m4a（自动检测）
 */
export async function createMicRecorder(): Promise<MicRecorder> {
  if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new TutorError("no_mic_api", 0, "浏览器不支持麦克风（getUserMedia）");
  }
  if (typeof window.MediaRecorder === "undefined") {
    throw new TutorError("no_media_recorder", 0, "浏览器不支持 MediaRecorder（试试 Chrome / Safari 14+）");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  // 选第一个浏览器接受的 mime
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "",
  ];
  let mimeType = "";
  for (const c of candidates) {
    if (c === "" || (window.MediaRecorder && MediaRecorder.isTypeSupported(c))) {
      mimeType = c;
      break;
    }
  }
  let recorder: MediaRecorder;
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw new TutorError("recorder_init", 0, e instanceof Error ? e.message : String(e));
  }
  const chunks: BlobPart[] = [];
  let startedAt = 0;
  let stopResolve: ((v: { blob: Blob; mimeType: string; durationMs: number }) => void) | null = null;
  recorder.addEventListener("dataavailable", (e: BlobEvent) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  });
  recorder.addEventListener("stop", () => {
    const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
    const durationMs = Date.now() - startedAt;
    stopResolve?.({ blob, mimeType: blob.type, durationMs });
    stopResolve = null;
  });
  return {
    async start() {
      chunks.length = 0;
      startedAt = Date.now();
      recorder.start();
    },
    async stop() {
      return new Promise((resolve) => {
        stopResolve = resolve;
        if (recorder.state !== "inactive") recorder.stop();
        else stopResolve({ blob: new Blob([], { type: mimeType }), mimeType, durationMs: 0 });
      });
    },
    release() {
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
