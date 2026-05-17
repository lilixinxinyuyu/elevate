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
import { getChatProviders as getChatProvidersLib, getChatModels as getChatModelsLib } from "../lib/providers";
import { normalizeAiQuestion } from "../lib/normalizeAiQuestion";
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

/**
 * POST /api/generate/questions — Ep36 native impl
 *
 * CF Pages 原版 765 行，含跨 batch lazy timer、broken-model 共享、partial-success
 * 收集等。本 simplified 版只覆盖客户端实际用法：sessionAdaptive count=1 + tutor 单批，
 * 真没有 sub-batch 并发的必要（qwen3.6-flash 单次 5 题 ~6-8s under ESA 11s 硬限）。
 *
 * 输入 body (兼容 CF Pages shape)：
 *   { subjectId, unitId, unitName, skillId, skillName, term, count, difficulty,
 *     format, gameType, existingStems?, extraSkillIds?, recentMistakeStems?, callerTag? }
 *
 * 输出：{ ok, questions[], model, provider, generatedCount, requestedCount, partial }
 */
// Ep36 实测：ESA EdgeRoutine 单 fetch ~9s 上限 + qwen3.6-flash 每题 ~3-4s 输出。
// count=1 稳 7-8s, count=2 9-10s（仍 ok），count=3 边缘 / 超时。
// cap 3 给客户端 sessionAdaptive（实际 count=1）+ tutor（小批）足够头道，
// 想要更大批客户端可拆并发。
const QUESTIONS_MAX = 3;
const QUESTIONS_TIMEOUT_MS = 10_000;

interface GenReqBody {
  subjectId?: "math" | "chinese";
  unitId?: string;
  unitName?: string;
  skillId?: string;
  skillName?: string;
  term?: string;
  count?: number;
  difficulty?: string | number;
  format?: string;
  gameType?: string;
  existingStems?: string[];
  extraSkillIds?: string[];
  recentMistakeStems?: string[];
  callerTag?: string;
}

function buildQuestionsSystemPrompt(subjectId: string): string {
  const label = subjectId === "chinese" ? "语文" : "数学";
  return `你是 4 年级 ${label} AI 出题员。严格按下面 schema 返回 JSON：

{
  "questions": [
    {
      "question_id": "AI_<skill>_<idx>",
      "stem": "题面（清晰、自然、不要 '（无关）' 之类元注解）",
      "options": [{"id":"a","text":"..."},{"id":"b","text":"..."}],  // plain_choice 才需要
      "answer": { "type": "choice"|"number"|"multi_step", "value": ... },
      "hints": ["逐层提示，从轻到重"],
      "common_errors": [],
      "solution_steps": [],
      "estimated_time_seconds": 15-90,
      "difficulty": 1-5
    }
  ]
}

要求：
- 数学闭合：实物=整数、钱=2 位小数、答案算得通
- 不出 forbidden_verb 元注解；distractor 要源自学生具体误解（不是随机数字）
- options 数量与 game_type 匹配；plain_choice 4 个，true_false 2 个
- 不要 markdown 代码块、不要解释文字

⚠ 严格的字段一致性（违反会被 normalize / 拒收）：
- answer.type=="number" → question_format 必须是 "numeric" 或 "numeric_choice"，**绝不**写 "single_choice"
- answer.type=="choice" → question_format=="single_choice" + 至少 2 个 options + answer.value 必须是 options 里某个 id
- single_choice 题的 answer.value 永远写成 "a"/"b"/"c"/"d"（小写），不是数字
- 单步题不要塞 subquestions（subquestions 只在 multi_step 多小问时用，且数量必须 ≥2）`;
}

function buildQuestionsUserPrompt(body: GenReqBody, batchStamp: string): string {
  const count = Math.max(1, Math.min(QUESTIONS_MAX, body.count ?? 3));
  const excl = (body.existingStems ?? []).slice(0, 10).map((s) => `- ${s.slice(0, 80)}`).join("\n");
  const focus = (body.recentMistakeStems ?? []).slice(0, 3).map((s) => `- ${s.slice(0, 80)}`).join("\n");
  return `# 出题任务

- skill: ${body.skillName ?? body.skillId} (${body.skillId})
- unit: ${body.unitName ?? body.unitId} (${body.unitId})
- term: ${body.term ?? "未指定"}
- difficulty: ${body.difficulty ?? 3} (1=易 5=难)
- game_type: ${body.gameType ?? "plain_choice"}
- format: ${body.format ?? "auto"}
- count: ${count}
- batch_stamp: ${batchStamp}

${excl ? `# 避免与下列 stem 重复\n${excl}\n` : ""}${focus ? `# 学生最近错过这些 (可作为考点焦点)\n${focus}\n` : ""}

输出 JSON: { "questions": [...${count} 道...] }。每题 question_id 用 "AI_${body.skillId ?? "x"}_<idx>__${batchStamp}_<idx>" 格式。`;
}

function extractJsonObj(text: string): unknown {
  if (!text) return null;
  const tryP = (s: string): unknown => { try { return JSON.parse(s); } catch { return null; } };
  let cleaned = text.trim();
  let r = tryP(cleaned);
  if (r) return r;
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  r = tryP(cleaned);
  if (r) return r;
  const start = cleaned.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const sub = cleaned.substring(start, i + 1);
        r = tryP(sub) ?? tryP(sub.replace(/,(\s*[}\]])/g, "$1"));
        if (r) return r;
      }
    }
  }
  return null;
}

generate.post("/questions", async (c) => {
  const providers = getChatProvidersLib(c.env);
  if (providers.length === 0) {
    return c.json({ ok: false, error: "generator_not_configured" }, 503);
  }
  let body: GenReqBody;
  try {
    body = await c.req.json<GenReqBody>();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.skillId) {
    return c.json({ ok: false, error: "missing_skillId" }, 400);
  }
  const subjectId = body.subjectId === "chinese" ? "chinese" : "math";
  const requestedCount = Math.max(1, Math.min(QUESTIONS_MAX, body.count ?? 3));
  const sys = buildQuestionsSystemPrompt(subjectId);
  const stamp = Date.now().toString(36);
  const usr = buildQuestionsUserPrompt({ ...body, count: requestedCount }, stamp);

  const errors: { provider: string; model: string; code: string; message: string }[] = [];

  for (const p of providers) {
    const models = getChatModelsLib(p).filter((m: string) => /^qwen3/i.test(m)).slice(0, 2);
    for (const model of models) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), QUESTIONS_TIMEOUT_MS);
      try {
        const resp = await fetch(`${p.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${p.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
            temperature: 0.7,
            max_tokens: 3500,
            response_format: { type: "json_object" },
            enable_thinking: false,
          }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        const j = (await resp.json().catch(() => null)) as
          | { choices?: { message?: { content?: string } }[]; error?: { code?: string; message?: string } }
          | null;
        if (!resp.ok || !j || j.error) {
          errors.push({
            provider: p.label, model,
            code: j?.error?.code ?? `http_${resp.status}`,
            message: j?.error?.message ?? "",
          });
          if (j?.error?.code === "InvalidApiKey" || j?.error?.code === "AccessDenied") break;
          continue;
        }
        const text = j.choices?.[0]?.message?.content?.trim();
        if (!text) {
          errors.push({ provider: p.label, model, code: "empty_response", message: "" });
          continue;
        }
        const parsed = extractJsonObj(text) as { questions?: unknown[] } | null;
        const rawQs = Array.isArray(parsed?.questions) ? parsed!.questions : null;
        if (!rawQs || rawQs.length === 0) {
          errors.push({ provider: p.label, model, code: "json_parse_failed", message: text.slice(0, 120) });
          continue;
        }
        // Validate + stamp + normalize（v0.34.64: 防 LLM 乱拼 answer.type/question_format）
        const normalizeReports: { qid: string; rules: string[]; warnings: string[] }[] = [];
        const stamped = rawQs
          .filter((q): q is Record<string, unknown> =>
            typeof q === "object" && q !== null && typeof (q as Record<string, unknown>).stem === "string"
          )
          .map((q, i) => {
            const baseId = typeof q.question_id === "string" ? q.question_id : `AI_${body.skillId}_${i}`;
            const qid = baseId.includes("__") ? baseId : `${baseId}__${stamp}_${i}`;
            const tagged = {
              ...q,
              question_id: qid,
              subjectId,
              skill_id: body.skillId,
              unit_id: body.unitId,
              tags: Array.isArray(q.tags)
                ? Array.from(new Set([...(q.tags as string[]), "ai_generated"]))
                : ["ai_generated"],
            };
            const { q: normalized, report } = normalizeAiQuestion(tagged);
            if (report.changed || report.warnings.length > 0) {
              normalizeReports.push({ qid, rules: report.rules, warnings: report.warnings });
            }
            return normalized;
          });
        if (stamped.length === 0) {
          errors.push({ provider: p.label, model, code: "no_valid_questions", message: "" });
          continue;
        }
        if (normalizeReports.length > 0) {
          // 把 normalize 报告打到 console (admin 看 routine logs 能看到 LLM 出题质量趋势)
          console.log(
            `[generate/questions] normalized ${normalizeReports.length}/${stamped.length}: ` +
              normalizeReports.map((r) => `${r.qid}[${r.rules.join(",")}]`).join("; "),
          );
        }
        return c.json({
          ok: true,
          questions: stamped,
          model,
          provider: p.label,
          generatedCount: stamped.length,
          requestedCount,
          partial: stamped.length < requestedCount,
          normalized: normalizeReports.length, // 给客户端看（可选透传 admin）
        });
      } catch (e) {
        clearTimeout(timer);
        const isAbort = (e as Error)?.name === "AbortError";
        errors.push({
          provider: p.label, model,
          code: isAbort ? "timeout" : "fetch_error",
          message: e instanceof Error ? e.message : String(e),
        });
        if (isAbort) break;
      }
    }
  }
  console.error("[generate/questions] all failed", errors);
  return c.json({
    ok: false,
    error: "no_model_worked",
    detail: errors.slice(0, 5).map((t) => `${t.provider}/${t.model}:${t.code}`).join(", "),
    tried: errors,
  }, 502);
});

// 其他 /api/generate/* (image/* 已上面注册，剩 image/proxy/...) → 代理到老 CF Pages
generate.all("*", async (c) => {
  return proxyFallback.fetch(c.req.raw, c.env);
});

export default generate;
