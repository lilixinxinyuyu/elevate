/**
 * /api/tts/generate — TTS（语文听写等）
 *
 * v0.34.11 (Ep141): 移植自 functions/api/tts/generate.ts.
 *
 * 端点切换：
 *   intl → BAILIAN (cn-hangzhou)
 *   https://dashscope-intl.aliyuncs.com → https://dashscope.aliyuncs.com
 *
 * 模型链（按优先级，BAILIAN 上确认可用）：
 *   1. qwen3-tts-instruct-flash + Cherry voice (多模态返 url/base64)
 *   2. cosyvoice-v3-plus + longxiaochun (sync_audio_tts 返 mp3 bytes)
 *   3. qwen3.5-omni-flash fallback
 *
 * TTS 一般 < 5s，远低于 ESA 11s 超时，可以同步实现。
 *
 * 失败时回 502 + 详细 attempt log，客户端有 browser speechSynthesis fallback。
 */

import { Hono } from "hono";
import type { Env } from "../lib/env";
import { requireAuth } from "../lib/auth";

const tts = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

tts.use("*", requireAuth);

interface AttemptLog {
  strategy: string;
  status: number;
  code?: string;
  message?: string;
}

interface TtsStrategy {
  name: string;
  endpoint: string;
  buildBody: (text: string, voice?: string) => Record<string, unknown>;
  /** 二进制响应优先（audio/mpeg directly）；JSON 响应才 parse */
  expectBinary?: boolean;
}

const MULTIMODAL_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
const AUDIO_TTS_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/generation";

function qwenTtsStrategy(model: string, voice: string): TtsStrategy {
  return {
    name: `multimodal:${model}`,
    endpoint: MULTIMODAL_URL,
    buildBody: (text) => ({ model, input: { text, voice } }),
  };
}

function syncAudioStrategy(model: string, voice?: string): TtsStrategy {
  return {
    name: `audio_tts:${model}`,
    endpoint: AUDIO_TTS_URL,
    buildBody: (text) => ({
      model,
      input: { text },
      parameters: voice
        ? { voice, format: "mp3", sample_rate: 22050 }
        : { format: "mp3", sample_rate: 22050 },
    }),
    expectBinary: true,
  };
}

// v0.36.22 (爸爸: 统一小进声音 Serena): TTS 主声 Cherry → Serena.
// Serena 是 qwen3-tts + qwen3.5-omni 唯一都支持的女声, 让 TTS 朗读跟 omni
// realtime 语音对话声音一致 (之前 Cherry vs Tina 不一致). cosyvoice fallback
// 保留 longxiaochun (cosyvoice 不一定支持 Serena, 它只是最后兜底).
const DEFAULT_STRATEGIES: TtsStrategy[] = [
  qwenTtsStrategy("qwen3-tts-instruct-flash", "Serena"),
  qwenTtsStrategy("qwen3.5-omni-flash", "Serena"),
  syncAudioStrategy("cosyvoice-v3-plus", "longxiaochun"),
  qwenTtsStrategy("cosyvoice-v3-plus", "longxiaochun"),
];

// GET 健康检查
tts.get("/generate", (c) => {
  return c.json({
    ok: true,
    configured: !!c.env.BAILIAN_API_KEY,
    provider: c.env.BAILIAN_API_KEY ? "bailian" : null,
  });
});

tts.post("/generate", async (c) => {
  const apiKey = c.env.BAILIAN_API_KEY ?? c.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return c.json({ ok: false, error: "tts_not_configured" }, 503);
  }

  let body: { text?: string; voice?: string; model?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  const text = (body.text ?? "").trim();
  if (!text) return c.json({ ok: false, error: "missing_text" }, 400);
  if (text.length > 500) return c.json({ ok: false, error: "text_too_long" }, 400);

  const strategies = body.model
    ? [
        qwenTtsStrategy(body.model, body.voice ?? "Serena"),
        syncAudioStrategy(body.model, body.voice),
      ]
    : DEFAULT_STRATEGIES;

  const attemptLog: AttemptLog[] = [];

  for (const strat of strategies) {
    let upstream: Response;
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 9_000); // ESA 11s 内
      upstream = await fetch(strat.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(strat.buildBody(text, body.voice)),
        signal: ctrl.signal,
      });
      clearTimeout(to);
    } catch (e) {
      attemptLog.push({
        strategy: strat.name,
        status: 0,
        code: "fetch_failed",
        message: (e as Error).message.slice(0, 100),
      });
      continue;
    }

    const ctype = upstream.headers.get("content-type") ?? "";

    // 二进制成功路径（audio_tts 直接返 mp3）
    if (upstream.ok && ctype.startsWith("audio/")) {
      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": ctype,
          "Cache-Control": "no-store",
          "X-TTS-Strategy": strat.name,
        },
      });
    }

    // JSON 响应（multimodal 或错误）
    let json: {
      output?: { audio?: { url?: string; data?: string } };
      code?: string;
      message?: string;
    };
    try {
      json = await upstream.json();
    } catch {
      attemptLog.push({ strategy: strat.name, status: upstream.status, code: "non_json" });
      continue;
    }

    if (json.code) {
      attemptLog.push({
        strategy: strat.name,
        status: upstream.status,
        code: json.code,
        message: json.message?.slice(0, 200),
      });
      // 鉴权类错误直接 break 不再重试
      if (["InvalidApiKey", "AccessDenied", "Throttling"].includes(json.code)) {
        return c.json(
          {
            ok: false,
            error: json.code,
            detail: json.message ?? "",
            tried: attemptLog,
          },
          502,
        );
      }
      continue;
    }

    // multimodal 返 url 或 base64
    if (json.output?.audio?.data) {
      const b64 = json.output.audio.data;
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
          "X-TTS-Strategy": strat.name,
        },
      });
    }
    if (json.output?.audio?.url) {
      try {
        const audioResp = await fetch(json.output.audio.url);
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
          },
        });
      } catch (e) {
        attemptLog.push({
          strategy: strat.name,
          status: 0,
          code: "audio_fetch_error",
          message: (e as Error).message.slice(0, 100),
        });
        continue;
      }
    }
    attemptLog.push({
      strategy: strat.name,
      status: upstream.status,
      code: "no_audio",
    });
  }

  console.error("[tts] all strategies failed", attemptLog);
  return c.json(
    {
      ok: false,
      error: "no_model_worked",
      detail: `tried ${strategies.length} strategies, none returned audio.`,
      tried: attemptLog,
    },
    502,
  );
});

export default tts;
