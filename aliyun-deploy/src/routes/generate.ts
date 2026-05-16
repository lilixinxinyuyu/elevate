/**
 * /api/generate/* —— 图片 / 题目生成
 *
 * v0.34.8 (Ep138): 移植自 functions/api/generate/image.ts, 走 TOKEN_PLAN_CN 主路径。
 *
 * 3 个出图通路（按优先级）：
 *   1. TOKEN_PLAN_CN chat-completions（实测 token-plan 出图必经路径，不走 /images/generations）
 *   2. BAILIAN /compatible-mode/v1/images/generations 同步
 *   3. BAILIAN /api/v1/services/aigc/text2image/image-synthesis 异步 + 轮询
 *
 * 模型链（按优先级）：
 *   wan2.7-image-pro → wan2.7-image → qwen-image-2.0-pro → qwen-image-2.0
 *
 * 其他 generate 端点（questions / variant）暂走 proxy-fallback 到 CF Pages，
 * 后续 episode 移植。
 */

import { Hono } from "hono";
import type { Env } from "../lib/env";
import { requireAuth } from "../lib/auth";
import proxyFallback from "./proxy-fallback";

const generate = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

interface GenImageRequest {
  prompt?: string;
  model?: string;
  size?: string;
  style?: string;
  n?: number;
}

interface ImageProvider {
  label: "token-plan-cn" | "bailian";
  baseUrl: string;
  apiKey: string;
}

function getImageProviders(env: Env): ImageProvider[] {
  const ps: ImageProvider[] = [];
  if (env.TOKEN_PLAN_CN_API_KEY) {
    ps.push({
      label: "token-plan-cn",
      baseUrl: "https://token-plan.cn-beijing.maas.aliyuncs.com",
      apiKey: env.TOKEN_PLAN_CN_API_KEY,
    });
  }
  if (env.BAILIAN_API_KEY) {
    ps.push({
      label: "bailian",
      baseUrl: "https://dashscope.aliyuncs.com",
      apiKey: env.BAILIAN_API_KEY,
    });
  }
  return ps;
}

const DEFAULT_MODELS = [
  "wan2.7-image-pro",
  "wan2.7-image",
  "qwen-image-2.0-pro",
  "qwen-image-2.0",
];

interface CallResult {
  ok: boolean;
  urls?: string[];
  status: number;
  code?: string;
  message?: string;
}

/** TOKEN_PLAN: chat-completions multimodal content list (返回 output.choices[0].message.content[].image) */
async function callChatCompletionImage(
  p: ImageProvider,
  model: string,
  prompt: string,
): Promise<CallResult> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 25_000);
    const r = await fetch(`${p.baseUrl}/compatible-mode/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        max_tokens: 2000,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    let json: {
      output?: {
        choices?: {
          message?: { content?: { image?: string; type?: string; text?: string }[] };
        }[];
      };
      code?: string;
      message?: string;
    };
    try {
      json = await r.json();
    } catch {
      return { ok: false, status: r.status, code: "non_json", message: "chat image non-JSON" };
    }
    if (!r.ok || json.code) {
      return {
        ok: false,
        status: r.status,
        code: json.code ?? "http_error",
        message: json.message ?? `upstream ${r.status}`,
      };
    }
    const contentArr = json.output?.choices?.[0]?.message?.content ?? [];
    const urls = contentArr
      .map((c) => c.image)
      .filter((u): u is string => typeof u === "string" && u.startsWith("http"));
    if (urls.length === 0) {
      return {
        ok: false,
        status: r.status,
        code: "no_urls",
        message: `chat returned no image urls`,
      };
    }
    return { ok: true, urls, status: r.status };
  } catch (e) {
    return { ok: false, status: 0, code: "fetch_failed", message: (e as Error).message };
  }
}

/** OpenAI-compatible 同步 /images/generations */
async function callSyncImage(
  p: ImageProvider,
  model: string,
  prompt: string,
  size: string,
  n: number,
): Promise<CallResult> {
  try {
    const sizeOA = size.replace("*", "x");
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 25_000);
    const r = await fetch(`${p.baseUrl}/compatible-mode/v1/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, prompt, n: Math.max(1, Math.min(4, n)), size: sizeOA }),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    let json: {
      data?: { url?: string }[];
      error?: { code?: string; message?: string };
    };
    try {
      json = await r.json();
    } catch {
      return { ok: false, status: r.status, code: "non_json", message: "sync image non-JSON" };
    }
    if (!r.ok || json.error) {
      return {
        ok: false,
        status: r.status,
        code: json.error?.code ?? "http_error",
        message: json.error?.message ?? `upstream ${r.status}`,
      };
    }
    const urls = (json.data ?? [])
      .map((d) => d.url)
      .filter((u): u is string => typeof u === "string");
    if (urls.length === 0) {
      return { ok: false, status: 200, code: "no_urls", message: "sync returned no urls" };
    }
    return { ok: true, urls, status: r.status };
  } catch (e) {
    return { ok: false, status: 0, code: "fetch_failed", message: (e as Error).message };
  }
}

/** DashScope async create + poll */
async function callAsyncImage(
  p: ImageProvider,
  model: string,
  prompt: string,
  size: string,
  n: number,
): Promise<CallResult> {
  try {
    const r1 = await fetch(`${p.baseUrl}/api/v1/services/aigc/text2image/image-synthesis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model,
        input: { prompt },
        parameters: { size, n: Math.max(1, Math.min(4, n)) },
      }),
    });
    let j1: { output?: { task_id?: string }; code?: string; message?: string };
    try {
      j1 = await r1.json();
    } catch {
      return { ok: false, status: r1.status, code: "non_json", message: "create non-JSON" };
    }
    if (!r1.ok || j1.code) {
      return {
        ok: false,
        status: r1.status,
        code: j1.code ?? "http_error",
        message: j1.message ?? `upstream ${r1.status}`,
      };
    }
    const taskId = j1.output?.task_id;
    if (!taskId) return { ok: false, status: r1.status, code: "no_task_id", message: "no task_id" };

    for (let i = 0; i < 30; i++) {
      await new Promise((res) => setTimeout(res, 2000));
      const r2 = await fetch(`${p.baseUrl}/api/v1/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${p.apiKey}` },
      });
      let j2: {
        output?: {
          task_status?: string;
          results?: { url?: string }[];
          code?: string;
          message?: string;
        };
      };
      try {
        j2 = await r2.json();
      } catch {
        continue;
      }
      const st = j2.output?.task_status;
      if (st === "SUCCEEDED") {
        const urls = (j2.output?.results ?? [])
          .map((r) => r.url)
          .filter((u): u is string => typeof u === "string");
        if (urls.length === 0) {
          return { ok: false, status: 200, code: "no_urls", message: "succeeded but no urls" };
        }
        return { ok: true, urls, status: 200 };
      }
      if (st === "FAILED" || st === "CANCELED") {
        return {
          ok: false,
          status: 200,
          code: j2.output?.code ?? "task_failed",
          message: j2.output?.message ?? `task ${st}`,
        };
      }
    }
    return { ok: false, status: 408, code: "timeout", message: "polling timeout" };
  } catch (e) {
    return { ok: false, status: 0, code: "fetch_failed", message: (e as Error).message };
  }
}

generate.use("*", requireAuth);

/** POST /api/generate/image */
generate.post("/image", async (c) => {
  const providers = getImageProviders(c.env);
  if (providers.length === 0) {
    return c.json({ ok: false, error: "image_gen_not_configured" }, 503);
  }

  let body: GenImageRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.prompt) {
    return c.json({ ok: false, error: "missing_prompt" }, 400);
  }

  const fullPrompt = body.style ? `${body.prompt}, ${body.style}` : body.prompt;
  const size = body.size ?? "1024*1024";
  const n = body.n ?? 1;
  const models = body.model ? [body.model] : DEFAULT_MODELS;

  const tried: {
    provider: string;
    model: string;
    endpoint: string;
    status: number;
    code: string;
    message: string;
  }[] = [];

  for (const p of providers) {
    for (const m of models) {
      // TOKEN_PLAN_CN: 用 chat-completions
      if (p.label === "token-plan-cn") {
        const r = await callChatCompletionImage(p, m, fullPrompt);
        if (r.ok && r.urls) {
          return c.json({
            ok: true,
            urls: r.urls,
            model: m,
            provider: p.label,
            endpoint: "chat",
          });
        }
        tried.push({
          provider: p.label,
          model: m,
          endpoint: "chat",
          status: r.status,
          code: r.code ?? "?",
          message: r.message ?? "?",
        });
        if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
        continue;
      }
      // BAILIAN: sync 优先（wan2.7 / qwen-image 都支持），失败再 async
      const sync = await callSyncImage(p, m, fullPrompt, size, n);
      if (sync.ok && sync.urls) {
        return c.json({
          ok: true,
          urls: sync.urls,
          model: m,
          provider: p.label,
          endpoint: "sync",
        });
      }
      tried.push({
        provider: p.label,
        model: m,
        endpoint: "sync",
        status: sync.status,
        code: sync.code ?? "?",
        message: sync.message ?? "?",
      });
      if (sync.code === "InvalidApiKey" || sync.code === "AccessDenied") break;

      const async_ = await callAsyncImage(p, m, fullPrompt, size, n);
      if (async_.ok && async_.urls) {
        return c.json({
          ok: true,
          urls: async_.urls,
          model: m,
          provider: p.label,
          endpoint: "async",
        });
      }
      tried.push({
        provider: p.label,
        model: m,
        endpoint: "async",
        status: async_.status,
        code: async_.code ?? "?",
        message: async_.message ?? "?",
      });
      if (async_.code === "InvalidApiKey" || async_.code === "AccessDenied") break;
    }
  }

  console.error("[generate/image] all failed", tried);
  const brief = tried
    .slice(0, 6)
    .map((t) => `${t.provider}/${t.model}(${t.endpoint}):${t.code}`)
    .join(", ");
  return c.json(
    { ok: false, error: "no_model_worked", detail: brief, tried },
    502,
  );
});

// 其他 /api/generate/* 暂未移植 → 代理到老 CF Pages（questions / variant）
// hono 的子路由 fall-through：用 .all("*") catch unmatched + 透传给 proxyFallback
generate.all("*", async (c) => {
  return proxyFallback.fetch(c.req.raw, c.env);
});

export default generate;
