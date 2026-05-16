/**
 * /api/generate/* —— 图片 / 题目生成
 *
 * v0.34.12 (Ep142): image async pattern (跨 ESA EdgeRoutine 11s 限制)。
 *
 * 设计：
 *   POST /api/generate/image
 *     → BAILIAN createTask (返 task_id, ~1-2s)
 *     → 写 OSS users/{uid}/image-tasks/{taskId}.json 状态 pending
 *     → 立刻返 {ok:true, taskId, status:"pending", statusUrl}
 *
 *   GET /api/generate/image/status/:taskId
 *     → 读 OSS 状态
 *     → 如果 pending → 调 upstream poll 一次 → 更新 OSS → 返新状态
 *     → 如果 done/failed → 直接返
 *
 * 前端 generateImage() 改为 start + poll (每 2s 拉一次 status，最多 90s)。
 *
 * 其他 generate/* 仍走 proxy fallback。
 */

import { Hono } from "hono";
import type { Env } from "../lib/env";
import { requireAuth, getUserId } from "../lib/auth";
import { getOssConfig, ossPut, ossGet } from "../lib/oss";
import proxyFallback from "./proxy-fallback";

const generate = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

interface GenImageRequest {
  prompt?: string;
  model?: string;
  size?: string;
  style?: string;
  n?: number;
}

interface ImageTaskState {
  taskId: string;
  userId: string;
  upstreamProvider: "bailian" | "token-plan-cn";
  upstreamBaseUrl: string;
  upstreamTaskId: string;
  model: string;
  prompt: string;
  size: string;
  status: "pending" | "done" | "failed";
  urls: string[];
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

// BAILIAN async /image-synthesis 实测可用模型（2026-05）：
//   wanx2.1-t2i-turbo, wanx2.1-t2i-plus, qwen-image, wanx-v1
// 不可用：wan2.7-image-pro / wan2.7-image / qwen-image-2.0-pro / qwen-image-2.0
//   （这些只在 TOKEN_PLAN_CN chat-completions 同步出图工作，不适合 async）
const DEFAULT_MODELS = [
  "wanx2.1-t2i-plus",
  "wanx2.1-t2i-turbo",
  "qwen-image",
  "wanx-v1",
];

function imageTaskKey(userId: string, taskId: string): string {
  return `users/${userId}/image-tasks/${taskId}.json`;
}

function pickAsyncProvider(env: Env): { baseUrl: string; apiKey: string; label: "bailian" } | null {
  if (env.BAILIAN_API_KEY) {
    return {
      baseUrl: "https://dashscope.aliyuncs.com",
      apiKey: env.BAILIAN_API_KEY,
      label: "bailian",
    };
  }
  return null;
}

/** 调 DashScope async create-task. 返 task_id 或 error */
async function createUpstreamTask(
  provider: { baseUrl: string; apiKey: string },
  model: string,
  prompt: string,
  size: string,
  n: number,
): Promise<{ ok: true; taskId: string } | { ok: false; status: number; code: string; message: string }> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8_000);
    const r = await fetch(`${provider.baseUrl}/api/v1/services/aigc/text2image/image-synthesis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model,
        input: { prompt },
        parameters: { size, n: Math.max(1, Math.min(4, n)) },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    let json: { output?: { task_id?: string }; code?: string; message?: string };
    try {
      json = await r.json();
    } catch {
      return { ok: false, status: r.status, code: "non_json", message: "create non-JSON" };
    }
    if (!r.ok || json.code) {
      return {
        ok: false,
        status: r.status,
        code: json.code ?? "http_error",
        message: json.message ?? `upstream ${r.status}`,
      };
    }
    const taskId = json.output?.task_id;
    if (!taskId) return { ok: false, status: r.status, code: "no_task_id", message: "no task_id" };
    return { ok: true, taskId };
  } catch (e) {
    return { ok: false, status: 0, code: "fetch_failed", message: (e as Error).message };
  }
}

/** 调 DashScope poll. 返 status + urls (if done) */
async function pollUpstreamTask(
  provider: { baseUrl: string; apiKey: string },
  upstreamTaskId: string,
): Promise<
  | { status: "done"; urls: string[] }
  | { status: "pending" }
  | { status: "failed"; error: string }
> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8_000);
    const r = await fetch(`${provider.baseUrl}/api/v1/tasks/${upstreamTaskId}`, {
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      signal: ctrl.signal,
    });
    clearTimeout(to);
    let j: {
      output?: {
        task_status?: string;
        results?: { url?: string }[];
        code?: string;
        message?: string;
      };
    };
    try {
      j = await r.json();
    } catch {
      return { status: "failed", error: "non_json" };
    }
    const st = j.output?.task_status;
    if (st === "SUCCEEDED") {
      const urls = (j.output?.results ?? [])
        .map((rr) => rr.url)
        .filter((u): u is string => typeof u === "string");
      if (urls.length === 0) return { status: "failed", error: "succeeded_no_urls" };
      return { status: "done", urls };
    }
    if (st === "FAILED" || st === "CANCELED") {
      return { status: "failed", error: j.output?.code ?? `task_${st}` };
    }
    return { status: "pending" };
  } catch (e) {
    return { status: "failed", error: (e as Error).message };
  }
}

generate.use("*", requireAuth);

/**
 * POST /api/generate/image
 * 返 202 + {ok:true, taskId, status:"pending", statusUrl}
 * 客户端调 GET /api/generate/image/status/:taskId 轮询
 */
generate.post("/image", async (c) => {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  const provider = pickAsyncProvider(c.env);
  if (!provider) return c.json({ ok: false, error: "image_gen_not_configured" }, 503);

  let body: GenImageRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.prompt) return c.json({ ok: false, error: "missing_prompt" }, 400);

  const fullPrompt = body.style ? `${body.prompt}, ${body.style}` : body.prompt;
  const size = body.size ?? "1024*1024";
  const n = body.n ?? 1;
  const model = body.model ?? DEFAULT_MODELS[0]!;

  // 试模型链直到 createTask 成功（不轮询，只取 task_id）
  const tried: { model: string; code: string; message: string }[] = [];
  const models = body.model ? [body.model] : DEFAULT_MODELS;
  let upstreamTaskId: string | null = null;
  let pickedModel = model;
  for (const m of models) {
    const r = await createUpstreamTask(provider, m, fullPrompt, size, n);
    if (r.ok) {
      upstreamTaskId = r.taskId;
      pickedModel = m;
      break;
    }
    tried.push({ model: m, code: r.code, message: r.message });
    if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
  }
  if (!upstreamTaskId) {
    return c.json(
      {
        ok: false,
        error: "create_task_failed",
        tried,
      },
      502,
    );
  }

  // 我们的 internal taskId（也用 upstream id 简单点）
  const taskId = upstreamTaskId;
  const now = Date.now();
  const state: ImageTaskState = {
    taskId,
    userId,
    upstreamProvider: provider.label,
    upstreamBaseUrl: provider.baseUrl,
    upstreamTaskId,
    model: pickedModel,
    prompt: fullPrompt,
    size,
    status: "pending",
    urls: [],
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  const putR = await ossPut(cfg, imageTaskKey(userId, taskId), JSON.stringify(state), {
    contentType: "application/json; charset=utf-8",
  });
  if (!putR.ok) {
    console.error("[generate/image] save task state failed:", putR.error);
    // 即使存 OSS 失败也返回 taskId, client 仍可查 upstream（虽然没有元数据）
  }

  return c.json(
    {
      ok: true,
      taskId,
      status: "pending",
      model: pickedModel,
      statusUrl: `/api/generate/image/status/${taskId}`,
    },
    202,
  );
});

/**
 * GET /api/generate/image/status/:taskId
 * 读 OSS 状态；如果 pending → poll upstream → 更新 → 返新状态
 */
generate.get("/image/status/:taskId", async (c) => {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  const taskId = c.req.param("taskId");
  const key = imageTaskKey(userId, taskId);
  const got = await ossGet(cfg, key);
  if (!got.ok || !got.text) {
    if (got.status === 404) {
      return c.json({ ok: false, error: "task_not_found" }, 404);
    }
    return c.json({ ok: false, error: got.error ?? "get_failed" }, 502);
  }
  let state: ImageTaskState;
  try {
    state = JSON.parse(got.text);
  } catch {
    return c.json({ ok: false, error: "corrupt_task_state" }, 500);
  }

  // 终态直接返
  if (state.status === "done" || state.status === "failed") {
    return c.json({
      ok: true,
      taskId,
      status: state.status,
      urls: state.urls,
      error: state.error,
      model: state.model,
    });
  }

  // pending → poll upstream 一次
  const provider = {
    baseUrl: state.upstreamBaseUrl,
    apiKey:
      state.upstreamProvider === "bailian"
        ? (c.env.BAILIAN_API_KEY ?? "")
        : (c.env.TOKEN_PLAN_CN_API_KEY ?? ""),
  };
  const polled = await pollUpstreamTask(provider, state.upstreamTaskId);

  if (polled.status === "done") {
    state.status = "done";
    state.urls = polled.urls;
    state.updatedAt = Date.now();
    await ossPut(cfg, key, JSON.stringify(state), {
      contentType: "application/json; charset=utf-8",
    });
    // 把 dashscope URL 转成 routine-proxied URL，避开 CORS
    const proxiedUrls = polled.urls.map(
      (u) => `/api/generate/image/proxy?url=${encodeURIComponent(u)}`,
    );
    return c.json({
      ok: true,
      taskId,
      status: "done",
      urls: proxiedUrls,
      rawUrls: polled.urls,
      model: state.model,
    });
  }
  if (polled.status === "failed") {
    state.status = "failed";
    state.error = polled.error;
    state.updatedAt = Date.now();
    await ossPut(cfg, key, JSON.stringify(state), {
      contentType: "application/json; charset=utf-8",
    });
    return c.json({
      ok: true,
      taskId,
      status: "failed",
      error: polled.error,
      model: state.model,
    });
  }
  return c.json({ ok: true, taskId, status: "pending", model: state.model });
});

/**
 * GET /api/generate/image/proxy?url=<encoded>
 *
 * DashScope 把生成的图丢在 dashscope-result-*.oss-cn-wulanchabu.aliyuncs.com，
 * 那个 bucket 没开 CORS，浏览器直接 fetch 会被拒。
 *
 * 客户端要把图缓存进 IDB（DashScope URL 24h 过期）需要拿到 bytes 转 base64，
 * 必须 fetch。所以加个 proxy：routine 拉 image → 加 Access-Control-Allow-Origin
 * → 透传 bytes。
 *
 * 安全：只允许 dashscope-* 域名，免被滥用当通用 fetch 代理。
 */
generate.get("/image/proxy", async (c) => {
  const urlParam = c.req.query("url");
  if (!urlParam) return c.json({ ok: false, error: "missing_url" }, 400);
  let u: URL;
  try {
    u = new URL(urlParam);
  } catch {
    return c.json({ ok: false, error: "invalid_url" }, 400);
  }
  // 白名单：只 proxy dashscope 域
  const okHost =
    u.hostname.endsWith(".aliyuncs.com") &&
    (u.hostname.startsWith("dashscope-") || u.hostname.startsWith("dashscope.") ||
      u.hostname.startsWith("xiaojinapp."));
  if (!okHost) {
    return c.json({ ok: false, error: "host_not_allowed", host: u.hostname }, 403);
  }
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 9_000);
    const upstream = await fetch(u.toString(), { signal: ctrl.signal });
    clearTimeout(to);
    if (!upstream.ok) {
      return c.json({ ok: false, error: `upstream_${upstream.status}` }, 502);
    }
    const ct = upstream.headers.get("Content-Type") ?? "image/png";
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return c.json({ ok: false, error: "fetch_failed", detail: (e as Error).message }, 502);
  }
});

// 其他 /api/generate/* 暂未移植 → 代理到老 CF Pages（questions / variant）
generate.all("*", async (c) => {
  return proxyFallback.fetch(c.req.raw, c.env);
});

export default generate;
