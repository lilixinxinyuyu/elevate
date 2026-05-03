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
  subjectId: "chinese";
  unitId: string;
  unitName?: string;
  skillId: string;
  skillName?: string;
  count: number;
  difficulty?: string;
  existingStems?: string[];
  recentMistakeStems?: string[];
}

export interface GenerateQuestionsResult {
  questions: Question[];
  model: string;
  generatedCount: number;
  requestedCount: number;
}

export async function generateChineseQuestions(
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
