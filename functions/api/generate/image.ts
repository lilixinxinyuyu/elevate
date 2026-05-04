import { checkAuth, corsHeaders, jsonResponse, type Env } from "../../_shared";

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

const ENDPOINT_CREATE =
  "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";
const ENDPOINT_TASK = (id: string) =>
  `https://dashscope-intl.aliyuncs.com/api/v1/tasks/${id}`;

/**
 * 候选模型链 — 按"在 DashScope intl free tier 实际可用"排序。
 *
 * Round 4 调整：用户上轮所有 qwen-image-* 都返回 InvalidParameter（要么模型不
 * 存在要么 endpoint 不对）。改成万相 wanx2.1 优先（DashScope 老牌文生图，free
 * tier 一般有），qwen-image 留作 best-effort。
 */
const MODELS = [
  // 万相 2.1 — 多数账号可用
  "wanx2.1-t2i-turbo",
  "wanx2.1-t2i-plus",
  "wanx-v1",
  // Qwen-Image 系列（用户截图里的，但调用格式可能不一样）
  "qwen-image-plus",
  "qwen-image",
  "qwen-image-2.0-pro-2026-04-22",
  "qwen-image-2.0-2026-03-03",
];

async function createTask(
  apiKey: string,
  model: string,
  prompt: string,
  size: string,
  n: number,
): Promise<{ ok: true; taskId: string } | { ok: false; status: number; code: string; message: string }> {
  const r = await fetch(ENDPOINT_CREATE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // 异步任务必须带这个 header
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
 * OpenAI-compatible 同步 endpoint，部分新模型（qwen-image）走这里更稳。
 * POST /compatible-mode/v1/images/generations
 *   { model, prompt, n, size }
 * 直接返回 { data: [{url}] } 或 { data: [{b64_json}] }
 */
async function callSyncImageGen(
  apiKey: string,
  model: string,
  prompt: string,
  size: string,
  n: number,
): Promise<{ ok: true; urls: string[] } | { ok: false; status: number; code: string; message: string }> {
  // OpenAI image gen 用 1024x1024 这种格式，不是 1024*1024
  const sizeOpenAi = size.replace("*", "x");
  const r = await fetch(
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/images/generations",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
  apiKey: string,
  taskId: string,
  maxAttempts = 60,
): Promise<{ ok: true; urls: string[] } | { ok: false; status: number; code: string; message: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    const r = await fetch(ENDPOINT_TASK(taskId), {
      headers: { Authorization: `Bearer ${apiKey}` },
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
  if (!env.DASHSCOPE_API_KEY) {
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
  const size = body.size ?? "512*512";
  const n = body.n ?? 1;

  // 用户传 model = 只跑那一个；否则跑全链
  const modelChain = body.model ? [body.model] : MODELS;
  const tried: { model: string; endpoint: string; status: number; code: string; message: string }[] = [];

  for (const m of modelChain) {
    const isQwenImage = m.startsWith("qwen-image");
    // qwen-image 系列：先试 sync OpenAI-compat（稳定）；wanx 系列：用 async task
    if (isQwenImage) {
      const sync = await callSyncImageGen(env.DASHSCOPE_API_KEY, m, fullPrompt, size, n);
      if (sync.ok) {
        return jsonResponse({ ok: true, urls: sync.urls, model: m, endpoint: "sync" });
      }
      tried.push({
        model: m,
        endpoint: "sync",
        status: sync.status,
        code: sync.code,
        message: sync.message,
      });
      if (sync.code === "InvalidApiKey" || sync.code === "AccessDenied") break;
      // sync 失败也试一次 async（有些模型走 async 才行）
    }
    const created = await createTask(env.DASHSCOPE_API_KEY, m, fullPrompt, size, n);
    if (!created.ok) {
      tried.push({
        model: m,
        endpoint: "async",
        status: created.status,
        code: created.code,
        message: created.message,
      });
      if (created.code === "InvalidApiKey" || created.code === "AccessDenied") break;
      continue;
    }
    const polled = await pollTask(env.DASHSCOPE_API_KEY, created.taskId);
    if (polled.ok) {
      return jsonResponse({
        ok: true,
        urls: polled.urls,
        model: m,
        endpoint: "async",
        taskId: created.taskId,
      });
    }
    tried.push({
      model: m,
      endpoint: "async",
      status: polled.status,
      code: polled.code,
      message: polled.message,
    });
  }

  console.error("[generate.image] all models failed", tried);
  // 给前端一个可读的 detail（前几个失败的 model + reason）
  const briefDetail = tried
    .slice(0, 4)
    .map((t) => `${t.model}(${t.endpoint}):${t.code}`)
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
