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
import { getChatProviders as getChatProvidersLib, getChatModels as getChatModelsLib, getImageProviders, getImageModels } from "../lib/providers";
import { normalizeAiQuestion } from "../lib/normalizeAiQuestion";
import { persistAiQuestions } from "../lib/persistAiQuestions";
import proxyFallback from "./proxy-fallback";
// v0.36.15 (爸爸 P0 context engineering): ESA 改用跟 CF Pages 同一套完整 prompt 系统.
// 之前 ESA 用简化 prompt (无 scope/rubric/keywords), 用户实际走 ESA → 出题质量差.
import { PROMPTS } from "../generated/_prompts.generated";
import {
  composeQuestionUserPrompt,
  cognitiveLevelFor,
  estimatedTimeFor,
  questionFormatFor,
} from "../lib/promptComposer";
// v0.36.17: 权重抽样 game-type (一个 skill 分布到多种玩法, 防 plain_choice 占 78% 同质化)
import { pickGameType } from "../lib/gameTypePicker";

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
 * v0.35.19 (爸爸反馈 5-18): image gen 通过 FC 旁路解决 ESA 11s 超时.
 *
 * 架构:
 *   client → POST /api/generate/image (ESA)
 *   ESA → 返 { ok, fcUrl, provider:"fc-bypass" } (即时, 不调上游)
 *   client → POST FC URL with Authorization + prompt (~6-25s, FC 60s timeout)
 *   FC → token-plan chat/completions → 返 { ok, urls, model }
 *
 * 为什么不在 ESA 内 proxy: ESA EdgeRoutine 上游 fetch 实测 11s 硬限,
 * token-plan sync image gen 6-25s, 超过 11s 必 504. FC nodejs20 没此限制.
 *
 * 老 BAILIAN async 路径完全废弃 — 不再 fallback, 不再扣按量费用.
 *
 * Response (新):
 *   200 { ok: true, fcUrl, provider: "fc-bypass", note }
 *   503 { ok: false, error: "fc_image_gen_not_configured" }
 *
 * 客户端需要拿到 fcUrl 后自己 POST 一次. 见 src/lib/imageGen.ts (新).
 */
generate.post("/image", async (c) => {
  const env = c.env as { FC_IMAGE_GEN_URL?: string };
  const fcUrl = env.FC_IMAGE_GEN_URL;
  if (!fcUrl) {
    return c.json({
      ok: false,
      error: "fc_image_gen_not_configured",
      reason: "FC_IMAGE_GEN_URL 未 baked 到 ESA env. 部署 fc-image-gen FC 后把 URL 配到 baked-env.ts.",
    }, 503);
  }

  let body: GenImageRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.prompt) return c.json({ ok: false, error: "missing_prompt" }, 400);

  // 返回 FC URL, 客户端自己 POST (ESA 11s 限制绕不过)
  return c.json({
    ok: true,
    fcUrl,
    provider: "fc-bypass",
    note: "client should POST to fcUrl with same Authorization + body to get image. ESA can't proxy because 11s upstream timeout < token-plan image gen 6-25s.",
  });
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
// v0.36.15 (爸爸 P0): 完整 prompt (scope+rubric+schema) 比简化版长, qwen3.6-flash
// 单 call ~10-13s. 10s timeout 经常砍掉险过的 call → 504. 提到 25s (ESA gateway
// 30s 内, 留 5s margin). 配合下面单 model (不 cascade) 保证总时间 < 30s.
const QUESTIONS_TIMEOUT_MS = 25_000;

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

// v0.36.15: 改用 PROMPTS.questionsSystem (跟 CF Pages buildSystemPrompt 一致),
// 不再用 ESA 自己的简化 system prompt. subject-aware (数学/语文分开).
function buildQuestionsSystemPrompt(subjectId: string): string {
  const subjLabel = subjectId === "math" ? "数学" : "语文";
  const subjKey = subjectId === "math" ? "math" : "chinese";
  const sys = PROMPTS.questionsSystem as unknown as
    | string
    | { math?: string; chinese?: string; raw?: string };
  const template =
    typeof sys === "string" ? sys : (sys[subjKey as "math" | "chinese"] ?? sys.raw ?? "");
  return template.replace(/\{\{subjectLabel\}\}/g, subjLabel);
}

/** 解析 difficulty: "3" → 3, "2-4" → 取中值 3, undefined → 3 */
function parseDifficultyEsa(raw: string | number | undefined): 1 | 2 | 3 | 4 | 5 {
  if (typeof raw === "number") return Math.min(5, Math.max(1, Math.round(raw))) as 1|2|3|4|5;
  if (!raw) return 3;
  const single = /^([1-5])$/.exec(raw);
  if (single) return Number(single[1]) as 1|2|3|4|5;
  const range = /^([1-5])-([1-5])$/.exec(raw);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2) as 1|2|3|4|5;
  return 3;
}

/** game-type: body.gameType 显式 > pickGameType 权重抽样 > plain_choice */
function pickGameTypeEsa(skillId: string | undefined, explicit?: string): string {
  if (explicit) return explicit;
  if (!skillId) return "plain_choice";
  return pickGameType(skillId); // 权重抽样 (题型多样化)
}

// v0.36.15: 改用 composeQuestionUserPrompt (完整 scope + difficulty rubric + format
// rubric + game-type schema + prefilled metadata), 跟 CF Pages buildUserPrompt 一致.
// batchStamp 参数保留兼容签名 (composer 内部不用, question_id 由 onRequestPost 后处理 stamp).
function buildQuestionsUserPrompt(body: GenReqBody, _batchStamp: string): string {
  const count = Math.max(1, Math.min(QUESTIONS_MAX, body.count ?? 3));
  const subjectId = body.subjectId === "chinese" ? "chinese" : "math";
  const difficulty = parseDifficultyEsa(body.difficulty);
  const gameType = pickGameTypeEsa(body.skillId, body.gameType);
  const skillMeta = body.skillId
    ? (PROMPTS.skillMetadata as unknown as Record<string, { ability: string[]; examPriority: string } | undefined>)[body.skillId]
    : undefined;
  const prefilledFields = {
    grade: 4,
    cognitiveLevel: cognitiveLevelFor(body.skillId ?? "", gameType),
    questionFormat: questionFormatFor(gameType),
    estimatedTimeSeconds: estimatedTimeFor(gameType, difficulty),
    status: "approved",
    examPriority: skillMeta?.examPriority,
    abilityDimension: skillMeta?.ability,
  };
  return composeQuestionUserPrompt({
    subjectId,
    unitId: body.unitId ?? "",
    unitName: body.unitName,
    skillId: body.skillId ?? "",
    skillName: body.skillName,
    extraSkillIds: body.extraSkillIds,
    term: (body.term === "上册" || body.term === "下册") ? body.term : "下册",
    difficulty,
    format: body.format as never,
    gameType,
    count,
    existingStems: body.existingStems,
    recentMistakeStems: body.recentMistakeStems,
    prefilledFields,
  });
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
  // v0.36.19 (深度优化 #2): 优先走 FC (脱离 ESA 30s timeout, FC 60s 容纳完整 prompt
  // 出题 + count≤4 + cascade). 返 fcUrl, client 用同 auth+body 直调 FC.
  // 跟 image gen fc-bypass 同模式. FC URL 没配时回落 ESA native (下方逻辑).
  const fcUrl = (c.env as { FC_GENERATE_QUESTIONS_URL?: string }).FC_GENERATE_QUESTIONS_URL;
  if (fcUrl) {
    return c.json({
      ok: true,
      fcUrl,
      provider: "fc-bypass",
      note: "client should POST fcUrl with same Authorization + body (ESA 30s timeout < 完整 prompt 出题, FC 60s 没限制)",
    });
  }
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
    // v0.36.15: 只试 1 个 qwen3 model (qwen3.6-flash). 完整 prompt 单 call 25s,
    // cascade 2 个会超 ESA 30s gateway → 504. 单 model fail-fast, client 可重试.
    const models = getChatModelsLib(p).filter((m: string) => /^qwen3/i.test(m)).slice(0, 1);
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
        // v0.34.65: 持久化每道题到 OSS per-key (users/{uid}/ai-questions/{qid}.json).
        // 救未来 resurrection — Ep45 dry-run 报 1288 attempts blocked by missing question
        // defs，根因就是 AI 出过的题没存。从这次起每道题落盘，下次再扫 attempts 能匹上.
        const cfg = getOssConfig(c.env);
        let persistReport: { attempted: number; succeeded: number; failed: number; elapsedMs: number } | null = null;
        if (cfg && stamped.length > 0) {
          const userId = getUserId(c);
          const pr = await persistAiQuestions(cfg, userId, stamped);
          persistReport = {
            attempted: pr.attempted,
            succeeded: pr.succeeded,
            failed: pr.failed,
            elapsedMs: pr.elapsedMs,
          };
          if (pr.failed > 0) {
            console.warn(
              `[generate/questions] persist ${pr.succeeded}/${pr.attempted} ok, ${pr.failed} failed in ${pr.elapsedMs}ms. errors:${pr.errors.join(" | ")}`,
            );
          } else {
            console.log(
              `[generate/questions] persisted ${pr.succeeded}/${pr.attempted} to users/${userId}/ai-questions/ in ${pr.elapsedMs}ms`,
            );
          }
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
          persisted: persistReport,
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
