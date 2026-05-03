import { checkAuth, corsHeaders, jsonResponse, type Env } from "../../_shared";

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

const VOICE_SYSTEM_PROMPT = `你叫小进姐姐，是 Selena（4 年级女生）的语音学习伴侣。她会用语音问你问题，你用 60-120 字的回复。

核心原则：
1. 永远先用一句话肯定她（"嗯，这是个好问题" / "我懂你的疑惑"）
2. 然后正面回答，用最简单的话和小学生比喻
3. 不要说"作为AI"或"我没法听到声音"等话——你就是在和她对话
4. 不要用 Markdown / 编号 / 列表，纯口语
5. 一次只讲一个核心点，不要列好几条
6. 如果她的录音听不清，说"刚才声音有点小，再说一次好吗？"

如果她在问当前这道题，你已经知道题目和答案，所以可以直接讲解。`;

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

  const models = ["qwen3-omni-flash", "qwen-omni-turbo"];
  const tried: { model: string; status: number; code: string; message: string }[] = [];
  for (const m of models) {
    const r = await callQwenOmni(env.DASHSCOPE_API_KEY, m, messages);
    if (r.ok) {
      return jsonResponse({ ok: true, reply: r.text, model: m });
    }
    tried.push({ model: m, status: r.status, code: r.code, message: r.message });
    if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
  }
  console.error("[tutor.voice] all omni models failed", tried);
  return jsonResponse(
    { ok: false, error: "no_model_worked", detail: tried.map((t) => `${t.model}:${t.code}`).join(", "), tried },
    502,
  );
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
