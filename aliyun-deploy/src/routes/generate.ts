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

// 移植自 prompts/variant/system.md
const VARIANT_SYSTEM_PROMPT = `你是变式题生成器。给你一道原题，你只需 **换数字 + 换情境**（人名/物品/地点等），保留 skill / 难度 / 题型 / 字段结构不变。

## 任务

返回 1 道**结构与原题完全相同**的新题，所有 enum 字段（subjectId/term/unit_id/skill_id/grade/difficulty/game_type/question_format/cognitive_level/ability_dimension/exam_priority/status）**原样保留**。

只改：
- \`stem\` 题面（换数字 + 换情境）
- \`options[].text\` 或 \`subquestions[]\` 里的具体内容
- \`answer.value\` / \`answer.steps[].expected\` 与新数字一致
- \`solution_steps\` / \`hints\` / \`feedback_*\` / \`common_errors\` 适配

## 4 条变式原则（违反就 fail）

1. **题面纯净**：clue / option / hint / feedback 不要写"（无关）/（非已知）"等元注解。
2. **数学闭合**：换的数字必须能算出**整数 / 合常识**的答案。
3. **distractor 独立**：错误选项必须源自"学生具体误解"思路。
4. **保题型保结构**：选项数量、字段名都不动。

## 输出协议

返回顶层 \`{ "question": {...} }\` JSON，**不要** markdown 代码块。`;

interface VariantBody {
  sourceQuestion?: Record<string, unknown>;
  callerTag?: string;
}

interface ChatProvider2 {
  label: "token-plan-cn" | "bailian";
  baseUrl: string;
  apiKey: string;
}

function getChatProviders(env: Env): ChatProvider2[] {
  const ps: ChatProvider2[] = [];
  if (env.TOKEN_PLAN_CN_API_KEY) {
    ps.push({ label: "token-plan-cn", baseUrl: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1", apiKey: env.TOKEN_PLAN_CN_API_KEY });
  }
  if (env.BAILIAN_API_KEY) {
    ps.push({ label: "bailian", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", apiKey: env.BAILIAN_API_KEY });
  }
  return ps;
}

function buildVariantUserPrompt(source: Record<string, unknown>): string {
  const trimmed = { ...source };
  delete trimmed.question_id;
  delete trimmed.tags;
  delete trimmed.status;
  return `# 原题
\`\`\`json
${JSON.stringify(trimmed, null, 2)}
\`\`\`

# 要求
- skill_id 原样: \`${source.skill_id ?? ""}\`
- difficulty 原样: ${source.difficulty ?? "?"}
- game_type 原样: \`${source.game_type ?? ""}\`
- question_format 原样: \`${source.question_format ?? ""}\`
- 数字换一组、情境换，保 4 条变式原则。

返回 \`{ "question": {...} }\` JSON。`;
}

/** POST /api/generate/variant */
generate.post("/variant", async (c) => {
  const providers = getChatProviders(c.env);
  if (providers.length === 0) return c.json({ ok: false, error: "no_provider_configured" }, 503);

  let body: VariantBody;
  try { body = await c.req.json(); } catch { return c.json({ ok: false, error: "invalid_json" }, 400); }
  const sq = body.sourceQuestion;
  if (!sq || typeof sq !== "object") return c.json({ ok: false, error: "missing_sourceQuestion" }, 400);
  if (typeof sq.skill_id !== "string") return c.json({ ok: false, error: "sourceQuestion missing skill_id" }, 400);

  const userPrompt = buildVariantUserPrompt(sq);
  const tried: Array<{ provider: string; model: string; code: string; message: string }> = [];

  for (const p of providers) {
    for (const m of ["qwen3.6-flash", "qwen3.6-plus"]) {
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 9_500);
        const r = await fetch(`${p.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${p.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: "system", content: VARIANT_SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 1800,
            response_format: { type: "json_object" },
            enable_thinking: false,
          }),
          signal: ctrl.signal,
        });
        clearTimeout(to);
        let j: { choices?: { message?: { content?: string } }[]; error?: { code?: string; message?: string } };
        try { j = await r.json(); } catch { tried.push({ provider: p.label, model: m, code: "non_json", message: "non-JSON" }); continue; }
        if (!r.ok || j.error) {
          tried.push({ provider: p.label, model: m, code: j.error?.code ?? "http_error", message: j.error?.message ?? `upstream ${r.status}` });
          if (j.error?.code === "InvalidApiKey" || j.error?.code === "AccessDenied") break;
          continue;
        }
        const text = j.choices?.[0]?.message?.content?.trim();
        if (!text) { tried.push({ provider: p.label, model: m, code: "empty", message: "no content" }); continue; }
        let parsed: { question?: Record<string, unknown> };
        try { parsed = JSON.parse(text); } catch {
          tried.push({ provider: p.label, model: m, code: "parse_failed", message: text.slice(0, 100) });
          continue;
        }
        const q = parsed.question;
        if (!q || typeof q !== "object" || typeof q.stem !== "string") {
          tried.push({ provider: p.label, model: m, code: "missing_question_field", message: "" });
          continue;
        }
        const merged = {
          ...q,
          subjectId: sq.subjectId, skill_id: sq.skill_id, skill_name: sq.skill_name,
          unit_id: sq.unit_id, unit_name: sq.unit_name, term: sq.term,
          grade: sq.grade ?? 4, difficulty: sq.difficulty, game_type: sq.game_type,
          play_as: sq.play_as, question_format: sq.question_format,
          cognitive_level: sq.cognitive_level, ability_dimension: sq.ability_dimension,
          exam_priority: sq.exam_priority, estimated_time_seconds: sq.estimated_time_seconds,
          status: "approved", version: 1,
          tags: ["ai_generated", "variant", body.callerTag ?? "variant"].filter(Boolean),
          question_id: typeof q.question_id === "string" && q.question_id.length > 0
            ? q.question_id : `AI_${sq.skill_id}_v_${Date.now().toString(36)}`,
        };
        return c.json({ ok: true, question: merged, model: m, provider: p.label });
      } catch (e) {
        tried.push({ provider: p.label, model: m, code: "fetch_failed", message: (e as Error).message?.slice(0, 100) ?? "" });
      }
    }
  }

  console.error("[generate/variant] all failed", tried);
  return c.json({ ok: false, error: "llm_failed", detail: tried.slice(0, 6).map(t => `${t.provider}/${t.model}:${t.code}`).join(", "), tried }, 502);
});

// 其他 /api/generate/* (questions) 暂未移植 → 代理到老 CF Pages
generate.all("*", async (c) => {
  return proxyFallback.fetch(c.req.raw, c.env);
});

export default generate;
