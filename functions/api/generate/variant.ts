import {
  checkAuth,
  corsHeaders,
  getChatProviders,
  jsonResponse,
  type Env,
} from "../../_shared";
import { PROMPTS } from "../../_prompts.generated";

/**
 * POST /api/generate/variant
 *
 * v0.31.73: 变式题轻量出题端点。**实时**给 retry-after-wrong / 重做按钮用。
 *
 * 跟 /api/generate/questions 区别：
 *   - prompt 极简（system ~600 字 + user 含原题 JSON ~2-3KB），不带 skill scope /
 *     difficulty rubric / game-type schema / existing stems / format rubric
 *   - 只出 1 道
 *   - max_tokens 1500（单题足够）
 *   - 直接 dashscope qwen-plus，目标 < 10s
 *
 * 输入: { sourceQuestion: Question, callerTag?: string }
 * 输出: { ok: true, question: Question, model, provider }
 *      或 { ok: false, error, detail }
 */

const PER_CALL_TIMEOUT_MS = 25_000;

interface VariantRequest {
  sourceQuestion?: Record<string, unknown>;
  callerTag?: string;
}

interface QwenChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { code?: string; message?: string };
}

function buildVariantUserPrompt(source: Record<string, unknown>): string {
  // 只 strip 不影响出题的字段（如 question_id 必须新生成、tags / status 由 caller 重新决定）
  const trimmed = { ...source };
  delete trimmed.question_id;
  delete trimmed.tags;
  delete trimmed.status;

  const lines = [
    `# 原题（参考结构 + 风格，换数字 + 换情境后产出新题）`,
    ``,
    "```json",
    JSON.stringify(trimmed, null, 2),
    "```",
    ``,
    `# 要求`,
    ``,
    `- skill_id 保持原样: \`${source.skill_id ?? ""}\``,
    `- difficulty 保持原样: ${source.difficulty ?? "?"}`,
    `- game_type 保持原样: \`${source.game_type ?? ""}\``,
    `- question_format 保持原样: \`${source.question_format ?? ""}\``,
    `- 数字换一组、情境换（人名/物品/场景），保 4 条变式原则。`,
    `- 直接生成新 question_id（格式 \`AI_${source.skill_id ?? "skill"}_v_${Date.now().toString(36)}\`）。`,
    ``,
    `返回 \`{ "question": {...} }\` JSON，不要 markdown 代码块。`,
  ];
  return lines.join("\n");
}

async function callOnce(
  baseUrl: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ ok: true; text: string; model: string } | { ok: false; status: number; code: string; message: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_CALL_TIMEOUT_MS);
  try {
    const resp = await fetch(`${baseUrl}/compatible-mode/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen-plus",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1800,
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    let json: QwenChatResponse | null = null;
    try {
      json = (await resp.json()) as QwenChatResponse;
    } catch {
      return { ok: false, status: resp.status, code: "non_json", message: "upstream non-JSON" };
    }
    if (!resp.ok || json.error) {
      return {
        ok: false,
        status: resp.status,
        code: json.error?.code ?? "http_error",
        message: json.error?.message ?? `HTTP ${resp.status}`,
      };
    }
    const content = json.choices?.[0]?.message?.content ?? "";
    if (!content) {
      return { ok: false, status: 500, code: "empty_content", message: "no content in response" };
    }
    return { ok: true, text: content, model: "qwen-plus" };
  } catch (e) {
    const err = e as Error;
    return {
      ok: false,
      status: 0,
      code: err.name === "AbortError" ? "timeout" : "fetch_error",
      message: err.message ?? "unknown",
    };
  } finally {
    clearTimeout(timer);
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;

  let body: VariantRequest;
  try {
    body = (await request.json()) as VariantRequest;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  const sourceQuestion = body.sourceQuestion;
  if (!sourceQuestion || typeof sourceQuestion !== "object") {
    return jsonResponse({ ok: false, error: "missing_sourceQuestion" }, 400);
  }
  if (typeof sourceQuestion.skill_id !== "string") {
    return jsonResponse({ ok: false, error: "sourceQuestion missing skill_id" }, 400);
  }

  const sysVariant = PROMPTS.variantSystem;
  const userPrompt = buildVariantUserPrompt(sourceQuestion);

  const providers = getChatProviders(env);
  if (providers.length === 0) {
    return jsonResponse({ ok: false, error: "no_provider_configured" }, 503);
  }

  // 只试第一个 provider（dashscope 优先），单 call 25s budget
  // 如果想加 fallback，遍历 providers
  const ctx = providers[0]!;
  const r = await callOnce(ctx.baseUrl, ctx.apiKey, sysVariant, userPrompt);
  if (!r.ok) {
    return jsonResponse(
      { ok: false, error: "llm_failed", detail: `${r.code}: ${r.message}` },
      502,
    );
  }

  // Parse + validate basic shape
  let parsed: { question?: Record<string, unknown> };
  try {
    parsed = JSON.parse(r.text) as { question?: Record<string, unknown> };
  } catch (e) {
    return jsonResponse(
      {
        ok: false,
        error: "json_parse_failed",
        detail: (e as Error).message?.slice(0, 80) ?? "",
        rawSnippet: r.text.slice(0, 200),
      },
      502,
    );
  }
  const q = parsed.question;
  if (!q || typeof q !== "object" || typeof q.stem !== "string") {
    return jsonResponse({ ok: false, error: "missing_question_field" }, 502);
  }

  // Force-merge enum fields from source (never trust AI on these)
  const merged = {
    ...q,
    subjectId: sourceQuestion.subjectId,
    skill_id: sourceQuestion.skill_id,
    skill_name: sourceQuestion.skill_name,
    unit_id: sourceQuestion.unit_id,
    unit_name: sourceQuestion.unit_name,
    term: sourceQuestion.term,
    grade: sourceQuestion.grade ?? 4,
    difficulty: sourceQuestion.difficulty,
    game_type: sourceQuestion.game_type,
    play_as: sourceQuestion.play_as,
    question_format: sourceQuestion.question_format,
    cognitive_level: sourceQuestion.cognitive_level,
    ability_dimension: sourceQuestion.ability_dimension,
    exam_priority: sourceQuestion.exam_priority,
    estimated_time_seconds: sourceQuestion.estimated_time_seconds,
    status: "approved",
    version: 1,
    tags: ["ai_generated", "variant", body.callerTag ?? "variant"].filter(Boolean),
    question_id:
      typeof q.question_id === "string" && q.question_id.length > 0
        ? q.question_id
        : `AI_${sourceQuestion.skill_id}_v_${Date.now().toString(36)}`,
  };

  return jsonResponse({ ok: true, question: merged, model: r.model, provider: ctx.label });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
