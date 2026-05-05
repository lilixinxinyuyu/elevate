import {
  checkAuth,
  corsHeaders,
  getImageProviders,
  getImageModelsFor,
  jsonResponse,
  type AiProviderContext,
  type Env,
} from "../../_shared";

/**
 * POST /api/generate/image
 *
 * 用 Qwen-Image-2.0 系列生成勋章 / 图标 / 题目配图。
 *
 * DashScope intl 的图像生成 API（异步任务）：
 *   1. POST /api/v1/services/aigc/text2image/image-synthesis
 *      → 返回 task_id
 *   2. GET  /api/v1/tasks/{task_id}
 *      → 轮询直到 SUCCEEDED，拿 image URL
 *   3. 客户端从 URL 下载，用户保存或上传到 R2
 *
 * 这个 endpoint 把 1+2 都做了：调一次返回最终 image URL（或 base64）。
 *
 * 输入 body:
 *   {
 *     prompt: string,                  // 中文/英文描述
 *     model?: "qwen-image-2.0" | "qwen-image-2.0-pro",  // 默认 qwen-image-2.0-pro
 *     size?: "512*512" | "1024*1024",  // 默认 512*512（勋章用）
 *     style?: string,                  // 可选风格 hint，会拼到 prompt
 *     n?: number,                      // 张数 1-4
 *   }
 *
 * 输出:
 *   { ok: true, urls: string[], model, taskId }
 *   或 { ok: false, error, detail? }
 */

interface GenImageRequest {
  prompt?: string;
  model?: string;
  size?: string;
  style?: string;
  n?: number;
}

interface CreateTaskResponse {
  output?: { task_id?: string; task_status?: string };
  code?: string;
  message?: string;
  request_id?: string;
}

interface TaskStatusResponse {
  output?: {
    task_id?: string;
    task_status?: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
    results?: { url?: string; b64_image?: string }[];
    code?: string;
    message?: string;
  };
  code?: string;
  message?: string;
}

// 异步任务 endpoint 路径模板（baseUrl 由 ctx 决定）
const PATH_CREATE_ASYNC = "/api/v1/services/aigc/text2image/image-synthesis";
const PATH_TASK_STATUS = (id: string) => `/api/v1/tasks/${id}`;

// （MODELS 列表已经移到 _shared.ts: getImageModelsFor(ctx)）

async function createTask(
  ctx: AiProviderContext,
  model: string,
  prompt: string,
  size: string,
  n: number,
): Promise<{ ok: true; taskId: string } | { ok: false; status: number; code: string; message: string }> {
  const r = await fetch(`${ctx.baseUrl}${PATH_CREATE_ASYNC}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model,
      input: { prompt },
      parameters: { size, n: Math.max(1, Math.min(4, n)) },
    }),
  });
  let json: CreateTaskResponse | null = null;
  try {
    json = (await r.json()) as CreateTaskResponse;
  } catch {
    return { ok: false, status: r.status, code: "non_json", message: "create task non-JSON" };
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
  if (!taskId) {
    return { ok: false, status: r.status, code: "no_task_id", message: "task_id missing" };
  }
  return { ok: true, taskId };
}

/**
 * Token-plan 通过 chat-completion 出图（用 multimodal content 格式）。
 * 实测发现 token-plan 不支持 /images/generations 路径（404），但通过
 * /compatible-mode/v1/chat/completions + content 是 list 格式，可以让
 * qwen-image-2.0-pro / wan2.7-image-pro 直接返回图片 URL。
 *
 * 响应是 DashScope native shape:
 *   { output: { choices: [{ message: { content: [{image: "https://..."}] } }] } }
 */
async function callTokenPlanImageGen(
  ctx: AiProviderContext,
  model: string,
  prompt: string,
  _size: string,
  _n: number,
): Promise<{ ok: true; urls: string[] } | { ok: false; status: number; code: string; message: string }> {
  const r = await fetch(
    `${ctx.baseUrl}/compatible-mode/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "user", content: [{ type: "text", text: prompt }] },
        ],
        max_tokens: 2000,
      }),
    },
  );
  type TokenPlanImageResp = {
    output?: {
      choices?: {
        message?: {
          content?: Array<{ image?: string; type?: string; text?: string }>;
        };
      }[];
    };
    code?: string;
    message?: string;
  };
  let json: TokenPlanImageResp;
  try {
    json = (await r.json()) as TokenPlanImageResp;
  } catch {
    return { ok: false, status: r.status, code: "non_json", message: "token-plan image non-JSON" };
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
      message: `no image URLs in response: ${JSON.stringify(json).slice(0, 200)}`,
    };
  }
  return { ok: true, urls };
}

/**
 * OpenAI-compatible 同步 endpoint，dashscope-intl 用这个走 wanx2.1 等。
 * POST /compatible-mode/v1/images/generations
 *   { model, prompt, n, size }
 * 返回 { data: [{url}] }
 */
async function callSyncImageGen(
  ctx: AiProviderContext,
  model: string,
  prompt: string,
  size: string,
  n: number,
): Promise<{ ok: true; urls: string[] } | { ok: false; status: number; code: string; message: string }> {
  const sizeOpenAi = size.replace("*", "x");
  const r = await fetch(
    `${ctx.baseUrl}/compatible-mode/v1/images/generations`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        n: Math.max(1, Math.min(4, n)),
        size: sizeOpenAi,
      }),
    },
  );
  type SyncImageResponse = {
    data?: { url?: string; b64_json?: string }[];
    error?: { code?: string; message?: string };
  };
  let json: SyncImageResponse;
  try {
    json = (await r.json()) as SyncImageResponse;
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
    return { ok: false, status: 200, code: "no_urls", message: "sync image returned no URLs" };
  }
  return { ok: true, urls };
}

async function pollTask(
  ctx: AiProviderContext,
  taskId: string,
  maxAttempts = 60,
): Promise<{ ok: true; urls: string[] } | { ok: false; status: number; code: string; message: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    const r = await fetch(`${ctx.baseUrl}${PATH_TASK_STATUS(taskId)}`, {
      headers: { Authorization: `Bearer ${ctx.apiKey}` },
    });
    let json: TaskStatusResponse | null = null;
    try {
      json = (await r.json()) as TaskStatusResponse;
    } catch {
      // 一次解析失败不算致命，下次再试
      await new Promise((res) => setTimeout(res, 2000));
      continue;
    }
    const status = json.output?.task_status;
    if (status === "SUCCEEDED") {
      const urls = (json.output?.results ?? [])
        .map((r) => r.url)
        .filter((u): u is string => typeof u === "string");
      if (urls.length === 0) {
        return { ok: false, status: 200, code: "no_urls", message: "task succeeded but no URLs" };
      }
      return { ok: true, urls };
    }
    if (status === "FAILED" || status === "CANCELED") {
      return {
        ok: false,
        status: 200,
        code: json.output?.code ?? "task_failed",
        message: json.output?.message ?? `task ${status}`,
      };
    }
    // PENDING / RUNNING → 继续轮询
    await new Promise((res) => setTimeout(res, 2000));
  }
  return { ok: false, status: 408, code: "timeout", message: `polling timed out after ${maxAttempts} tries` };
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  const providers = getImageProviders(env);
  if (providers.length === 0) {
    return jsonResponse({ ok: false, error: "image_gen_not_configured" }, 503);
  }

  let body: GenImageRequest;
  try {
    body = (await request.json()) as GenImageRequest;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.prompt) {
    return jsonResponse({ ok: false, error: "missing_prompt" }, 400);
  }

  const fullPrompt = body.style ? `${body.prompt}, ${body.style}` : body.prompt;
  const size = body.size ?? "1024*1024";
  const n = body.n ?? 1;

  const tried: {
    provider: string;
    model: string;
    endpoint: string;
    status: number;
    code: string;
    message: string;
  }[] = [];

  for (const ctx of providers) {
    const models = body.model ? [body.model] : getImageModelsFor(ctx);
    for (const m of models) {
      // token-plan: 用 chat-completion 出图（实测唯一 work 的方式）
      if (ctx.label === "token-plan") {
        const r = await callTokenPlanImageGen(ctx, m, fullPrompt, size, n);
        if (r.ok) {
          return jsonResponse({
            ok: true,
            urls: r.urls,
            model: m,
            provider: ctx.label,
            endpoint: "chat",
          });
        }
        tried.push({
          provider: ctx.label,
          model: m,
          endpoint: "chat",
          status: r.status,
          code: r.code,
          message: r.message,
        });
        if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
        continue;
      }
      const isLikelySync = m.startsWith("qwen-image") || m.startsWith("wan2.7");
      if (isLikelySync) {
        const sync = await callSyncImageGen(ctx, m, fullPrompt, size, n);
        if (sync.ok) {
          return jsonResponse({
            ok: true,
            urls: sync.urls,
            model: m,
            provider: ctx.label,
            endpoint: "sync",
          });
        }
        tried.push({
          provider: ctx.label,
          model: m,
          endpoint: "sync",
          status: sync.status,
          code: sync.code,
          message: sync.message,
        });
        if (sync.code === "InvalidApiKey" || sync.code === "AccessDenied") break;
      }
      const created = await createTask(ctx, m, fullPrompt, size, n);
      if (!created.ok) {
        tried.push({
          provider: ctx.label,
          model: m,
          endpoint: "async",
          status: created.status,
          code: created.code,
          message: created.message,
        });
        if (created.code === "InvalidApiKey" || created.code === "AccessDenied") break;
        continue;
      }
      const polled = await pollTask(ctx, created.taskId);
      if (polled.ok) {
        return jsonResponse({
          ok: true,
          urls: polled.urls,
          model: m,
          provider: ctx.label,
          endpoint: "async",
          taskId: created.taskId,
        });
      }
      tried.push({
        provider: ctx.label,
        model: m,
        endpoint: "async",
        status: polled.status,
        code: polled.code,
        message: polled.message,
      });
    }
  }

  console.error("[generate.image] all providers/models failed", tried);
  const briefDetail = tried
    .slice(0, 6)
    .map((t) => `${t.provider}/${t.model}(${t.endpoint}):${t.code}`)
    .join(", ");
  return jsonResponse(
    {
      ok: false,
      error: "no_model_worked",
      detail: briefDetail,
      tried,
    },
    502,
  );
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
