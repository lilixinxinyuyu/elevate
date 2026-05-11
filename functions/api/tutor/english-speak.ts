import { checkAuth, corsHeaders, jsonResponse, type Env } from "../../_shared";

/**
 * v0.31.103 POST /api/tutor/english-speak
 *
 * 英语发音判断：Selena 按住录音读一个英文单词或短句 → 浏览器把 webm/opus base64
 * 发上来 → 服务端调 qwen3-omni-flash（multimodal audio in / text out）判断 Selena
 * 读得对不对 → 返回 { score 0-100, transcript, feedback }。
 *
 * 复刻 /api/tutor/voice 的 callQwenOmni 思路，但 system prompt 不同 — voice
 * 是讲题，english-speak 是单词朗读判分。
 *
 * 输入 body:
 *   {
 *     audioBase64: string,            // 浏览器录的 webm/opus
 *     mimeType: string,
 *     target: string,                 // 目标词或句子（e.g. "apple" / "How are you?"）
 *     mode?: "word" | "sentence",     // 影响打分严格度
 *   }
 *
 * 输出:
 *   { ok: true, score: number, transcript: string, feedback: string, model }
 *   或 { ok: false, error, detail? }
 */

interface SpeakRequest {
  audioBase64?: string;
  mimeType?: string;
  target?: string;
  mode?: "word" | "sentence";
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

const SPEAK_SYSTEM_PROMPT = `你是英语发音 AI 判分老师，专门帮 10 岁中国小女孩 Selena 练英语口语。

收到她的录音 + 一个目标词或短句，你要：
1. 转写她实际说出来的内容（transcript）
2. 跟目标对照，给一个 0-100 的发音准确度分数（score）：
   - 90-100：发音很准，可以听出每个音节
   - 70-89：基本听得懂，但有 1-2 个音不太对（卷舌 / 元音偏 / 重音错）
   - 50-69：能听懂但发音问题明显（漏音 / 替换音 / 节奏错）
   - 30-49：勉强能听懂，发音错得多
   - 0-29：基本听不出是目标词，或几乎没说
3. 一句中文反馈（feedback，10-40 字）——重点指出哪个音怎么改进，**温和鼓励**
   不要打击 Selena 的信心，但也别假装她说得很完美。

严格按 JSON 输出（不要 markdown 包裹，不要任何其他文字）：
{
  "transcript": "...",
  "score": 88,
  "feedback": "..."
}`;

async function callQwenOmni(
  apiKey: string,
  model: string,
  messages: OmniMessage[],
): Promise<
  | { ok: true; text: string }
  | { ok: false; status: number; code: string; message: string }
> {
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
        temperature: 0.3,
        max_tokens: 200,
      }),
    },
  );
  let json: OmniResponse | null = null;
  try {
    json = (await upstream.json()) as OmniResponse;
  } catch {
    return {
      ok: false,
      status: upstream.status,
      code: "non_json",
      message: "upstream non-JSON",
    };
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
  if (!text)
    return {
      ok: false,
      status: 200,
      code: "empty_response",
      message: "empty content",
    };
  return { ok: true, text };
}

function parseJudgeResponse(raw: string): {
  transcript: string;
  score: number;
  feedback: string;
} | null {
  // 容错：去掉可能的 markdown 包裹
  const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
  try {
    const j = JSON.parse(cleaned) as {
      transcript?: string;
      score?: number;
      feedback?: string;
    };
    if (typeof j.score !== "number") return null;
    return {
      transcript: j.transcript ?? "",
      score: Math.max(0, Math.min(100, Math.round(j.score))),
      feedback: j.feedback ?? "",
    };
  } catch {
    return null;
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  if (!env.DASHSCOPE_API_KEY) {
    return jsonResponse({ ok: false, error: "tutor_not_configured" }, 503);
  }

  let body: SpeakRequest;
  try {
    body = (await request.json()) as SpeakRequest;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.audioBase64 || !body.target) {
    return jsonResponse({ ok: false, error: "missing_audio_or_target" }, 400);
  }

  const userText =
    body.mode === "sentence"
      ? `请听我读这个英文短句，目标是："${body.target}"。判断准确度并按 JSON 返回。`
      : `请听我读这个英文单词，目标是："${body.target}"。判断发音准确度并按 JSON 返回。`;

  const messages: OmniMessage[] = [
    { role: "system", content: SPEAK_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        {
          type: "input_audio",
          input_audio: {
            data: body.audioBase64,
            format: mimeToFormat(body.mimeType),
          },
        },
        { type: "text", text: userText },
      ],
    },
  ];

  const models = [
    "qwen3-omni-flash",
    "qwen-omni-turbo",
    "qwen2-audio-instruct",
    "qwen-audio-turbo",
  ];
  const tried: {
    model: string;
    status: number;
    code: string;
    message: string;
  }[] = [];
  let allQuotaErrors = true;
  for (const m of models) {
    const r = await callQwenOmni(env.DASHSCOPE_API_KEY, m, messages);
    if (r.ok) {
      const parsed = parseJudgeResponse(r.text);
      if (parsed) {
        return jsonResponse({
          ok: true,
          score: parsed.score,
          transcript: parsed.transcript,
          feedback: parsed.feedback,
          model: m,
        });
      }
      // parse 失败也算成功调用了 model，但内容无效
      return jsonResponse({
        ok: false,
        error: "judge_parse_failed",
        detail: r.text.slice(0, 200),
      }, 502);
    }
    tried.push({
      model: m,
      status: r.status,
      code: r.code,
      message: r.message,
    });
    if (
      !/FreeTierOnly|AllocationQuota|model.+not.+exist|Forbidden/i.test(
        `${r.code} ${r.message}`,
      )
    ) {
      allQuotaErrors = false;
    }
    if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
  }
  console.error("[tutor.english-speak] all omni models failed", tried);
  const errorCode = allQuotaErrors
    ? "voice_not_available_on_plan"
    : "no_model_worked";
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
