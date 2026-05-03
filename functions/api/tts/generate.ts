import { checkAuth, corsHeaders, jsonResponse, type Env } from "../../_shared";

/**
 * POST /api/tts/generate
 *
 * 代理调用阿里云 DashScope（Qwen TTS）。前端给文本，服务端返回 mp3 字节流。
 *
 * Body:
 *   { text: string,                 // 要朗读的文本，<=500 字符
 *     voice?: string,               // DashScope voice id；默认 longxiaochun（童声）
 *     speed?: number,               // 0.5 ~ 2.0；默认 1.0
 *     format?: "mp3" | "wav" }      // 默认 mp3
 *
 * 响应：
 *   200 audio/mpeg | audio/wav      （binary stream）
 *   400 invalid_json / missing_text / text_too_long
 *   401 unauthorized                （Authorization: Bearer 不对）
 *   502 upstream_error              （DashScope 返回错）
 *   503 tts_not_configured          （DASHSCOPE_API_KEY 没配）
 *
 * 用途：语文听写、拼音、古诗朗读。Phase 1 暂时只在 /math/admin 的 TTS 测试
 * 按钮接入；Phase 2 chinese 各题型组件直接用 src/lib/tts.ts 的 speakText()。
 *
 * 不缓存到 Cloudflare 边缘（Cache-Control: no-store），但浏览器端 lib/tts.ts
 * 用 ObjectURL 内存缓存重复文本。
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;

  if (!env.DASHSCOPE_API_KEY) {
    return jsonResponse(
      { ok: false, error: "tts_not_configured" },
      503,
    );
  }

  let body: { text?: string; voice?: string; speed?: number; format?: "mp3" | "wav" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  const text = (body.text ?? "").trim();
  if (!text) return jsonResponse({ ok: false, error: "missing_text" }, 400);
  if (text.length > 500) return jsonResponse({ ok: false, error: "text_too_long" }, 400);

  const voice = body.voice ?? "longxiaochun";
  const format = body.format === "wav" ? "wav" : "mp3";
  const speed = typeof body.speed === "number"
    ? Math.min(2.0, Math.max(0.5, body.speed))
    : 1.0;

  // Alibaba Cloud Model Studio (International, ap-southeast-1) 的 qwen-tts 模型：
  //  - endpoint: /api/v1/services/aigc/multimodal-generation/generation
  //  - model: qwen-tts-latest（Cherry/Serena/Ethan/Chelsie 四个 voice）
  //  - 响应是 JSON，audio.url 拿到 mp3 链接，要再 fetch 一次拿 bytes
  // 之前用的 cosyvoice-v1 是国内 endpoint 的 model，国际 endpoint 没有。
  // 文档：https://www.alibabacloud.com/help/en/model-studio/qwen-tts
  const dashscopeVoice = voice && voice !== "longxiaochun" ? voice : "Cherry";
  const upstream = await fetch(
    "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen-tts-latest",
        input: {
          text,
          voice: dashscopeVoice,
        },
      }),
    },
  );

  if (!upstream.ok) {
    const errText = await upstream.text();
    console.error("[tts] qwen-tts upstream failed", {
      status: upstream.status,
      body: errText,
      voice: dashscopeVoice,
      textLength: text.length,
    });
    return jsonResponse(
      {
        ok: false,
        error: "upstream_error",
        status: upstream.status,
        detail: errText.slice(0, 1000),
      },
      502,
    );
  }

  // qwen-tts 返回 JSON: { output: { audio: { url: "https://..." } } }
  type QwenTtsResp = {
    output?: {
      audio?: {
        url?: string;
        data?: string; // base64 (alternative)
      };
      finish_reason?: string;
    };
    code?: string;
    message?: string;
    request_id?: string;
  };
  let respJson: QwenTtsResp;
  try {
    respJson = (await upstream.json()) as QwenTtsResp;
  } catch (e) {
    return jsonResponse(
      { ok: false, error: "upstream_invalid_json", detail: String(e).slice(0, 200) },
      502,
    );
  }

  if (respJson.code) {
    console.error("[tts] qwen-tts returned error", respJson);
    return jsonResponse(
      {
        ok: false,
        error: respJson.code,
        detail: `${respJson.message ?? ""} (${respJson.request_id ?? ""})`.slice(0, 1000),
      },
      502,
    );
  }

  const audioUrl = respJson.output?.audio?.url;
  if (audioUrl) {
    // 再 fetch 一次拿 mp3 字节流转发回去
    const audioResp = await fetch(audioUrl);
    if (!audioResp.ok) {
      return jsonResponse(
        { ok: false, error: "audio_fetch_failed", detail: `status ${audioResp.status}` },
        502,
      );
    }
    return new Response(audioResp.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        ...corsHeaders,
      },
    });
  }

  // base64 备用路径
  const b64 = respJson.output?.audio?.data;
  if (b64) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        ...corsHeaders,
      },
    });
  }

  return jsonResponse(
    { ok: false, error: "no_audio_in_response", detail: JSON.stringify(respJson).slice(0, 600) },
    502,
  );
};

/**
 * GET /api/tts/generate
 *
 * Smoke check：返回是否配置好了 DASHSCOPE_API_KEY。前端 /math/admin 测试按钮
 * 用这个判断是否显示"未配置"提示。
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  return jsonResponse({ ok: true, configured: !!env.DASHSCOPE_API_KEY });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
