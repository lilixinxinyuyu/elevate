/**
 * POST /api/agent/judge-questions
 *
 * AI 质检：把一批已入库的题发给 LLM，按 prompts/quality-rubric.md 的规范判定，
 * 返回每题 verdict / severity / reason / issues，让 admin UI 决定要不要删。
 *
 * 单次调用建议 ≤ 10 道（每道 ~300 tokens 输入 + ~80 tokens 输出 = 4000 tokens 总量）。
 * 客户端按 chunk 拆批并发。Cloudflare Pages Function 30s 墙钟内 1 次 LLM 调用够了。
 *
 * Body:
 *   {
 *     questions: Array<{
 *       question_id: string,
 *       stem: string,
 *       options?: Array<{id,text}>,
 *       answer?: any,
 *       skill_id?: string,
 *       skill_name?: string,
 *       unit_id?: string,
 *       game_type?: string,
 *       difficulty?: number,
 *       estimated_time_seconds?: number,
 *       common_errors?: any[],
 *       hints?: any[],
 *       solution_steps?: any[],
 *       tags?: string[],
 *     }>,
 *     subjectId?: "math" | "chinese",
 *     scopeLabel?: string,    // "数学 · G4B 小数乘法 · plain_choice" 之类，纯展示用
 *     scopeFilter?: string,   // 同上，更结构化（key=value 串）
 *   }
 *
 * Response:
 *   { ok, judgments: Array<{question_id, verdict, severity, reason, issues}>, model, provider }
 *   或 { ok:false, error, detail, tried }
 */

import {
  checkAuth,
  corsHeaders,
  getChatModelsFor,
  getChatProviders,
  jsonResponse,
  type AiProviderContext,
  type Env,
} from "../../_shared";
import { PROMPTS } from "../../_prompts.generated";
import { composeJudgeUserPrompt } from "../../_promptComposer";

interface JudgeQuestion {
  question_id: string;
  stem: string;
  options?: Array<{ id?: string; text?: string }>;
  answer?: unknown;
  skill_id?: string;
  skill_name?: string;
  unit_id?: string;
  game_type?: string;
  difficulty?: number;
  estimated_time_seconds?: number;
  common_errors?: unknown[];
  hints?: unknown[];
  solution_steps?: unknown[];
  tags?: string[];
}

interface JudgeRequest {
  questions: JudgeQuestion[];
  subjectId?: "math" | "chinese";
  scopeLabel?: string;
  scopeFilter?: string;
}

interface Judgment {
  question_id: string;
  verdict: "keep" | "delete" | "borderline";
  severity: 1 | 2 | 3 | 4 | 5;
  reason: string;
  issues: string[];
}

/** 单次 LLM 调用上限：50 题 ≈ 25k tokens 总量，留 5s 余量 */
const MAX_BATCH = 30;
const PER_CALL_TIMEOUT_MS = 28_000;

interface QwenChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { code?: string; message?: string };
}

async function callLlm(
  ctx: AiProviderContext,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  globalSignal?: AbortSignal,
): Promise<{ ok: true; text: string } | { ok: false; status: number; code: string; message: string }> {
  if (globalSignal?.aborted) {
    return { ok: false, status: 408, code: "global_budget_exceeded", message: "skipped" };
  }
  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2, // 质检要稳定，不要发散
    max_tokens: 4000, // 30 题 × ~80 token = 2400，留余量
  };
  if (/^qwen3/i.test(model)) requestBody.enable_thinking = false;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_CALL_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  globalSignal?.addEventListener("abort", onAbort, { once: true });
  try {
    const resp = await fetch(`${ctx.baseUrl}/compatible-mode/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
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
        message: json.error?.message ?? `upstream ${resp.status}`,
      };
    }
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false, status: 200, code: "empty_response", message: "empty content" };
    return { ok: true, text };
  } catch (e) {
    const isAbort = (e as Error)?.name === "AbortError";
    return {
      ok: false,
      status: isAbort ? 408 : 0,
      code: isAbort ? "timeout" : "fetch_error",
      message: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timer);
    globalSignal?.removeEventListener("abort", onAbort);
  }
}

/** 复用 generate/questions.ts 的 5 级 fallback 解析（裁剪精简版） */
function extractJsonObject(text: string): unknown {
  if (!text) return null;
  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  let cleaned = text.trim();
  let r = tryParse(cleaned);
  if (r) return r;
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  r = tryParse(cleaned);
  if (r) return r;
  // balanced-brace 抓最外层 {...}
  const start = cleaned.indexOf("{");
  if (start < 0) return null;
  let depth = 0,
    inStr = false,
    esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const sub = cleaned.substring(start, i + 1);
        r = tryParse(sub) ?? tryParse(sub.replace(/,(\s*[}\]])/g, "$1"));
        if (r) return r;
      }
    }
  }
  return null;
}

/** 把一道题压成 LLM 友好的简表（去掉 noise 字段，控 token） */
function summarizeQuestion(q: JudgeQuestion): Record<string, unknown> {
  const ans = q.answer as { type?: string; value?: unknown } | undefined;
  return {
    question_id: q.question_id,
    stem: (q.stem ?? "").slice(0, 200),
    skill_id: q.skill_id,
    skill_name: q.skill_name,
    unit_id: q.unit_id,
    game_type: q.game_type,
    difficulty: q.difficulty,
    estimated_time_seconds: q.estimated_time_seconds,
    options:
      Array.isArray(q.options) && q.options.length > 0
        ? q.options.map((o) => ({ id: o?.id, text: (o?.text ?? "").slice(0, 60) }))
        : undefined,
    answer:
      ans && typeof ans === "object"
        ? { type: ans.type, value: ans.value }
        : undefined,
    has_solution_steps: Array.isArray(q.solution_steps) && q.solution_steps.length > 0,
    common_errors_count: Array.isArray(q.common_errors) ? q.common_errors.length : 0,
    hints_count: Array.isArray(q.hints) ? q.hints.length : 0,
    is_ai: (q.tags ?? []).includes("ai_generated") || q.question_id.startsWith("AI_"),
  };
}

function buildSystemPrompt(subjectId: string): string {
  const subjLabel = subjectId === "math" ? "数学" : "语文";
  return PROMPTS.qualityJudgeSystem.replace(/\{\{subjectLabel\}\}/g, subjLabel);
}

function buildUserPrompt(args: JudgeRequest): string {
  const subjectId = args.subjectId === "chinese" ? "chinese" : "math";
  // v0.31.34：用 composer 组合，能为这批题涉及到的 skill 注入 scope 上下文
  const summarized = args.questions.map((q) => summarizeQuestion(q));
  return composeJudgeUserPrompt({
    subjectId,
    scopeLabel: args.scopeLabel ?? "全部",
    scopeFilter: args.scopeFilter ?? "(none)",
    questions: summarized,
  });
}

const VALID_VERDICTS = new Set(["keep", "delete", "borderline"]);
const VALID_ISSUES = new Set([
  "forbidden_verb",
  "stem_too_short",
  "stem_options_mismatch",
  "answer_invalid",
  "out_of_scope",
  "off_topic",
  "wrong_answer",
  "low_distractor_quality",
  "time_off",
  "duplicate_pattern",
  "bracket_instruction",
  "cryptic_stem",
  "weak_hint",
  "bad_punctuation",
  "name_violation",
  "other",
]);

function normalizeJudgments(raw: unknown, expectedIds: string[]): Judgment[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const arr = Array.isArray(obj.judgments) ? obj.judgments : Array.isArray(raw) ? (raw as unknown[]) : [];
  const byId = new Map<string, Judgment>();
  for (const j of arr) {
    if (!j || typeof j !== "object") continue;
    const o = j as Record<string, unknown>;
    const qid = typeof o.question_id === "string" ? o.question_id : null;
    if (!qid) continue;
    let verdict = typeof o.verdict === "string" ? o.verdict.toLowerCase() : "";
    if (!VALID_VERDICTS.has(verdict)) verdict = "borderline";
    let severity = Number(o.severity);
    if (!Number.isFinite(severity) || severity < 1 || severity > 5) severity = 3;
    severity = Math.round(severity);
    const reason = typeof o.reason === "string" ? o.reason.slice(0, 80) : "";
    const issuesRaw = Array.isArray(o.issues) ? (o.issues as unknown[]) : [];
    const issues = issuesRaw
      .map((s) => (typeof s === "string" ? s : ""))
      .filter((s) => VALID_ISSUES.has(s));
    byId.set(qid, {
      question_id: qid,
      verdict: verdict as Judgment["verdict"],
      severity: severity as Judgment["severity"],
      reason,
      issues,
    });
  }
  // 模型可能漏判某些题——补 borderline / severity 2
  return expectedIds.map(
    (id) =>
      byId.get(id) ?? {
        question_id: id,
        verdict: "borderline" as const,
        severity: 2 as const,
        reason: "模型未返回判定",
        issues: [],
      },
  );
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  const providers = getChatProviders(env);
  if (providers.length === 0) {
    return jsonResponse({ ok: false, error: "judge_not_configured" }, 503);
  }

  let body: JudgeRequest;
  try {
    body = (await request.json()) as JudgeRequest;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    return jsonResponse({ ok: false, error: "missing_questions" }, 400);
  }
  if (body.questions.length > MAX_BATCH) {
    return jsonResponse(
      { ok: false, error: "batch_too_large", detail: `max ${MAX_BATCH}` },
      400,
    );
  }

  const subjectId = body.subjectId === "chinese" ? "chinese" : "math";
  const expectedIds = body.questions.map((q) => q.question_id).filter(Boolean);
  if (expectedIds.length === 0) {
    return jsonResponse({ ok: false, error: "no_question_ids" }, 400);
  }

  const systemPrompt = buildSystemPrompt(subjectId);
  const userPrompt = buildUserPrompt(body);

  const errors: { provider: string; model: string; code: string; message: string }[] = [];

  for (const ctx of providers) {
    const models = getChatModelsFor(ctx);
    for (const m of models) {
      const r = await callLlm(ctx, m, systemPrompt, userPrompt);
      if (!r.ok) {
        errors.push({ provider: ctx.label, model: m, code: r.code, message: r.message });
        if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
        continue;
      }
      const parsed = extractJsonObject(r.text);
      if (!parsed) {
        errors.push({
          provider: ctx.label,
          model: m,
          code: "json_parse_failed",
          message: r.text.slice(0, 120),
        });
        continue;
      }
      const judgments = normalizeJudgments(parsed, expectedIds);
      if (judgments.length === 0) {
        errors.push({
          provider: ctx.label,
          model: m,
          code: "no_valid_judgments",
          message: "model returned 0 judgments",
        });
        continue;
      }
      return jsonResponse({
        ok: true,
        judgments,
        model: m,
        provider: ctx.label,
        triedModelsBeforeSuccess: errors.length,
      });
    }
  }

  console.error("[judge-questions] all providers failed", errors);
  return jsonResponse(
    {
      ok: false,
      error: "no_model_worked",
      detail: errors.slice(0, 5).map((t) => `${t.provider}/${t.model}:${t.code}`).join(", "),
      tried: errors,
    },
    502,
  );
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
