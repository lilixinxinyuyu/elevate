import { checkAuth, corsHeaders, jsonResponse, type Env } from "../../_shared";
import { PROMPTS } from "../../_prompts.generated";

/**
 * POST /api/tutor/voice
 *
 * 近实时语音对话：Selena 按住麦克风说话 → 客户端把录音 base64 发上来 → 服务端
 * 调 qwen3-omni-flash（多模态：audio + text in，text out），返回 AI 文本回复。
 * 客户端拿到文本后用 Cherry TTS 朗读，整个回路 2-5 秒，比真正的 WebSocket
 * realtime 简单得多，但体感已经"在和老师对话"。
 *
 * 输入 body:
 *   {
 *     audioBase64: string,    // 浏览器录的 webm/opus，base64 编码
 *     mimeType: string,       // "audio/webm" / "audio/wav" 等
 *     subjectId?: "math" | "chinese",
 *     questionContext?: { stem, correctAnswer, skillName },  // 可选：让 AI 知道是哪道题
 *     conversation?: { role, content }[],                    // 多轮对话历史（文本）
 *   }
 *
 * 输出:
 *   { ok: true, reply: string, model: string }
 *   或 { ok: false, error, detail? }
 */

interface VoiceRequest {
  audioBase64?: string;
  mimeType?: string;
  subjectId?: "math" | "chinese";
  questionContext?: {
    stem?: string;
    correctAnswer?: string;
    skillName?: string;
  };
  conversation?: { role: "assistant" | "user"; content: string }[];
}

// system prompt 从 prompts/tutor/voice-system.md 读
const VOICE_SYSTEM_PROMPT = PROMPTS.tutorVoiceSystem;

function buildContextLine(ctx: VoiceRequest["questionContext"]): string {
  if (!ctx) return "";
  const lines: string[] = ["（当前 Selena 在做的题：）"];
  if (ctx.stem) lines.push(`题目：${ctx.stem}`);
  if (ctx.correctAnswer) lines.push(`正确答案：${ctx.correctAnswer}`);
  if (ctx.skillName) lines.push(`技能点：${ctx.skillName}`);
  return lines.join("\n");
}

interface OmniMessage {
  role: string;
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "input_audio"; input_audio: { data: string; format: string } }
      >;
}

interface OmniResponse {
  choices?: { message?: { content?: string } }[];
  error?: { code?: string; message?: string };
}

/**
 * 把 mime type 转成 omni 接受的 format 字符串。
 * qwen3-omni-flash 支持 wav / mp3 / webm / opus / m4a。
 */
function mimeToFormat(mime: string | undefined): string {
  if (!mime) return "webm";
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("opus")) return "opus";
  if (m.includes("wav")) return "wav";
  if (m.includes("mp3") || m.includes("mpeg")) return "mp3";
  if (m.includes("m4a") || m.includes("mp4")) return "m4a";
  return "webm";
}

async function callQwenOmni(
  apiKey: string,
  model: string,
  messages: OmniMessage[],
): Promise<{ ok: true; text: string } | { ok: false; status: number; code: string; message: string }> {
  const upstream = await fetch(
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        modalities: ["text"],
        temperature: 0.7,
        max_tokens: 280,
      }),
    },
  );
  let json: OmniResponse | null = null;
  try {
    json = (await upstream.json()) as OmniResponse;
  } catch {
    return { ok: false, status: upstream.status, code: "non_json", message: "upstream non-JSON" };
  }
  if (!upstream.ok || json.error) {
    return {
      ok: false,
      status: upstream.status,
      code: json.error?.code ?? "http_error",
      message: json.error?.message ?? `upstream ${upstream.status}`,
    };
  }
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, status: 200, code: "empty_response", message: "empty content" };
  return { ok: true, text };
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  if (!env.DASHSCOPE_API_KEY) {
    return jsonResponse({ ok: false, error: "tutor_not_configured" }, 503);
  }

  let body: VoiceRequest;
  try {
    body = (await request.json()) as VoiceRequest;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.audioBase64) {
    return jsonResponse({ ok: false, error: "missing_audio" }, 400);
  }

  const ctxLine = buildContextLine(body.questionContext);
  const systemContent = ctxLine
    ? `${VOICE_SYSTEM_PROMPT}\n\n${ctxLine}`
    : VOICE_SYSTEM_PROMPT;

  const messages: OmniMessage[] = [
    { role: "system", content: systemContent },
  ];
  // 历史对话（文本）
  if (Array.isArray(body.conversation)) {
    for (const m of body.conversation) {
      if (m.role === "assistant" || m.role === "user") {
        messages.push({ role: m.role, content: m.content });
      }
    }
  }
  // 当前 turn：音频 + 一个引导句
  messages.push({
    role: "user",
    content: [
      {
        type: "input_audio",
        input_audio: { data: body.audioBase64, format: mimeToFormat(body.mimeType) },
      },
      { type: "text", text: "请听我刚才的语音问题，用 60-120 字回答我。" },
    ],
  });

  // Free Tier 上 omni 模型一般不可用；试一组多模态候选
  const models = [
    "qwen3-omni-flash",
    "qwen-omni-turbo",
    "qwen2-audio-instruct",
    "qwen-audio-turbo",
  ];
  const tried: { model: string; status: number; code: string; message: string }[] = [];
  let allQuotaErrors = true;
  for (const m of models) {
    const r = await callQwenOmni(env.DASHSCOPE_API_KEY, m, messages);
    if (r.ok) {
      return jsonResponse({ ok: true, reply: r.text, model: m });
    }
    tried.push({ model: m, status: r.status, code: r.code, message: r.message });
    // 不是配额类错误 → 标记，后面给清晰错误码
    if (
      !/FreeTierOnly|AllocationQuota|model.+not.+exist|Forbidden/i.test(
        `${r.code} ${r.message}`,
      )
    ) {
      allQuotaErrors = false;
    }
    if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
  }
  console.error("[tutor.voice] all omni models failed", tried);
  // 如果所有失败都是 FreeTierOnly 类，给前端一个明确信号让它隐藏语音按钮
  const errorCode = allQuotaErrors ? "voice_not_available_on_plan" : "no_model_worked";
  return jsonResponse(
    {
      ok: false,
      error: errorCode,
      detail: tried.map((t) => `${t.model}:${t.code}`).join(", "),
      tried,
    },
    502,
  );
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
