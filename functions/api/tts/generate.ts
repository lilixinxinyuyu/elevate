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

  // DashScope 同步 HTTP TTS：CosyVoice v1 走 /audio/tts/generation；
  // 模型名 cosyvoice-v1（之前误写成不存在的 "qwen-tts-v1" 导致 502）。
  // 文档：https://help.aliyun.com/zh/model-studio/cosyvoice-quick-start
  const upstream = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/generation",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "cosyvoice-v1",
        input: { text },
        parameters: {
          voice,            // 默认 longxiaochun（童声）
          format,
          sample_rate: 22050,
          // CosyVoice v1 不支持 speed 参数，传 speed_ratio
          speed_ratio: speed,
        },
      }),
    },
  );

  if (!upstream.ok) {
    const errText = await upstream.text();
    // 把完整错误打到 CF Pages function 日志（dashboard 可看），同时 detail 透传到客户端
    console.error("[tts] DashScope upstream failed", {
      status: upstream.status,
      body: errText,
      voice,
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

  // 防呆：DashScope 有时 200 返回的是 JSON（task pending / async）而不是音频字节
  const ctype = upstream.headers.get("content-type") ?? "";
  if (ctype.includes("application/json")) {
    const body = await upstream.text();
    console.warn("[tts] DashScope returned JSON instead of audio", { body, voice });
    return jsonResponse(
      {
        ok: false,
        error: "upstream_returned_json",
        detail: body.slice(0, 1000),
      },
      502,
    );
  }

  // 流式转发音频。浏览器端缓存由 src/lib/tts.ts 管。
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": format === "wav" ? "audio/wav" : "audio/mpeg",
      "Cache-Control": "no-store",
      ...corsHeaders,
    },
  });
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
