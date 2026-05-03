import { checkAuth, corsHeaders, jsonResponse, type Env } from "../../_shared";

/**
 * POST /api/tts/generate
 *
 * 多策略 fallback：依次试 Qwen-TTS (多个 model 名) → CosyVoice → Sambert，
 * 第一个返回音频的就用。所有都失败时返回详细 attempt log，让客户端走浏览器
 * speechSynthesis 兜底。
 *
 * 国际账号 (ap-southeast-1) 上 Qwen-TTS 可能不在 Token Plan 里 → 自动降级
 * 到 CosyVoice / Sambert（都是同 endpoint 不同 model）。
 */

interface AttemptLog {
  strategy: string;
  status: number;
  code?: string;
  message?: string;
}

interface TtsStrategy {
  name: string;
  endpoint: string;
  /** 请求体 shape：multimodal / sync_audio_tts / openai_compat */
  buildBody: (text: string, voice?: string) => Record<string, unknown>;
  /** 解析返回；返回 audio Response 或 null（null = 试下一个） */
  parseResponse: (
    upstream: Response,
    json: unknown,
  ) => Promise<{ ok: true; bytes?: Uint8Array; url?: string; modelUsed: string } | { ok: false; attempt: AttemptLog }>;
}

/** 多模态 endpoint 上的 Qwen-TTS（响应有 output.audio.url 或 .data） */
function qwenTtsStrategy(model: string, voice: string): TtsStrategy {
  return {
    name: `multimodal:${model}`,
    endpoint:
      "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    buildBody: (text) => ({
      model,
      input: { text, voice },
    }),
    parseResponse: async (upstream, json) => {
      const j = json as {
        output?: { audio?: { url?: string; data?: string } };
        code?: string;
        message?: string;
      };
      if (j.code) {
        return {
          ok: false,
          attempt: { strategy: `multimodal:${model}`, status: upstream.status, code: j.code, message: j.message },
        };
      }
      if (!upstream.ok) {
        return {
          ok: false,
          attempt: { strategy: `multimodal:${model}`, status: upstream.status, code: "http_error" },
        };
      }
      if (j.output?.audio?.url) {
        return { ok: true, url: j.output.audio.url, modelUsed: model };
      }
      if (j.output?.audio?.data) {
        const bytes = Uint8Array.from(atob(j.output.audio.data), (c) => c.charCodeAt(0));
        return { ok: true, bytes, modelUsed: model };
      }
      return {
        ok: false,
        attempt: { strategy: `multimodal:${model}`, status: 200, code: "no_audio" },
      };
    },
  };
}

/** 老的 /audio/tts/generation 端点上的 CosyVoice / Sambert（响应直接是 audio bytes） */
function syncAudioStrategy(model: string, voice?: string): TtsStrategy {
  return {
    name: `audio_tts:${model}`,
    endpoint:
      "https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/generation",
    buildBody: (text) => ({
      model,
      input: { text },
      parameters: voice ? { voice, format: "mp3", sample_rate: 22050 } : { format: "mp3", sample_rate: 22050 },
    }),
    parseResponse: async (upstream, json) => {
      // 这个 endpoint 通常直接返回二进制；如果上游返回了 JSON 那一定是错
      const j = json as { code?: string; message?: string };
      if (j.code) {
        return {
          ok: false,
          attempt: {
            strategy: `audio_tts:${model}`,
            status: upstream.status,
            code: j.code,
            message: j.message,
          },
        };
      }
      return {
        ok: false,
        attempt: {
          strategy: `audio_tts:${model}`,
          status: upstream.status,
          code: "unexpected_json_or_no_audio",
        },
      };
    },
  };
}

// 用户账号实际可用的 model（来自 Singapore Model Studio "Model Square" 列表 2026-04）：
//   - qwen3-tts-instruct-flash   ← Qwen 最新 TTS instruct flash（Cherry/Serena/Ethan 等）
//   - cosyvoice-v3-plus          ← CosyVoice 最新（longxiaochun 等）
//   - qwen3.5-omni-flash         ← 多模态，可输出音频
// 旧的 qwen-tts / cosyvoice-v1 / sambert-* 在这个账号都返回 "Model not exist"。
const STRATEGIES_DEFAULT: TtsStrategy[] = [
  // 1. Qwen3-TTS-Instruct-Flash（首选；Cherry 轻甜女声大概率在这里）
  qwenTtsStrategy("qwen3-tts-instruct-flash", "Cherry"),
  // 2. CosyVoice v3-plus（备选；中文童声 longxiaochun）
  syncAudioStrategy("cosyvoice-v3-plus", "longxiaochun"),
  qwenTtsStrategy("cosyvoice-v3-plus", "longxiaochun"),
  // 3. Qwen3.5-Omni-Flash（多模态兜底）
  qwenTtsStrategy("qwen3.5-omni-flash-2026-03-15", "Cherry"),
  qwenTtsStrategy("qwen3.5-omni-flash", "Cherry"),
];

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;

  if (!env.DASHSCOPE_API_KEY) {
    return jsonResponse({ ok: false, error: "tts_not_configured" }, 503);
  }

  let body: { text?: string; voice?: string; model?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  const text = (body.text ?? "").trim();
  if (!text) return jsonResponse({ ok: false, error: "missing_text" }, 400);
  if (text.length > 500) return jsonResponse({ ok: false, error: "text_too_long" }, 400);

  // 用户传 model 时只跑那一个 strategy（admin 调试用）
  const strategies = body.model
    ? [
        qwenTtsStrategy(body.model, body.voice ?? "Cherry"),
        syncAudioStrategy(body.model, body.voice),
      ]
    : STRATEGIES_DEFAULT;

  const attemptLog: AttemptLog[] = [];

  for (const strat of strategies) {
    const upstream = await fetch(strat.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(strat.buildBody(text, body.voice)),
    });

    const ctype = upstream.headers.get("content-type") ?? "";

    // 二进制成功路径（audio_tts endpoint 直接返回 mp3 字节）
    if (upstream.ok && ctype.startsWith("audio/")) {
      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": ctype,
          "Cache-Control": "no-store",
          "X-TTS-Strategy": strat.name,
          ...corsHeaders,
        },
      });
    }

    // JSON 路径（multimodal endpoint 或错误响应）
    let json: unknown = null;
    try {
      json = await upstream.json();
    } catch {
      attemptLog.push({ strategy: strat.name, status: upstream.status, code: "non_json" });
      continue;
    }

    const result = await strat.parseResponse(upstream, json);
    if (!result.ok) {
      attemptLog.push(result.attempt);
      // 鉴权类错误直接 break 不再重试（避免 4×401）
      const c = result.attempt.code ?? "";
      if (c === "InvalidApiKey" || c === "AccessDenied" || c === "Throttling") {
        console.error("[tts] non-recoverable error", attemptLog);
        return jsonResponse(
          {
            ok: false,
            error: c,
            detail: result.attempt.message ?? "",
            tried: attemptLog,
          },
          502,
        );
      }
      continue;
    }

    // 成功：bytes 直接返；url 再下载一次
    if (result.bytes) {
      // strict tsconfig 下 Uint8Array<ArrayBufferLike> 不直接接受为 BodyInit；
      // 拷一份独立 ArrayBuffer 出来 + Blob 包一层，避免 SharedArrayBuffer 类型抖动
      const buf = new ArrayBuffer(result.bytes.byteLength);
      new Uint8Array(buf).set(result.bytes);
      return new Response(new Blob([buf], { type: "audio/mpeg" }), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
          "X-TTS-Strategy": strat.name,
          ...corsHeaders,
        },
      });
    }
    if (result.url) {
      const audioResp = await fetch(result.url);
      if (!audioResp.ok) {
        attemptLog.push({
          strategy: strat.name,
          status: audioResp.status,
          code: "audio_url_fetch_failed",
        });
        continue;
      }
      return new Response(audioResp.body, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
          "X-TTS-Strategy": strat.name,
          ...corsHeaders,
        },
      });
    }
  }

  // 所有 strategy 都失败 — 客户端会 fallback 到浏览器 speechSynthesis
  console.error("[tts] all strategies failed", attemptLog);
  return jsonResponse(
    {
      ok: false,
      error: "no_model_worked",
      detail: `tried ${strategies.length} strategies, none returned audio.`,
      tried: attemptLog,
    },
    502,
  );
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  return jsonResponse({ ok: true, configured: !!env.DASHSCOPE_API_KEY });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
