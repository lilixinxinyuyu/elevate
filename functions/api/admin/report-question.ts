import {
  checkAuth,
  corsHeaders,
  getChatProviders,
  jsonResponse,
  USER_KEY,
  type Env,
} from "../../_shared";
import { PROMPTS } from "../../_prompts.generated";
import { composeFixUserPrompt } from "../../_promptComposer";

/**
 * POST /api/admin/report-question
 *
 * v0.31.77：用户在做题时举报"这道题有问题"，后端立刻 AI 自动修题 + UPSERT 回 D1。
 *
 * 用例：Selena 答题时点 "🐛 报告"。reason 是固定枚举（"answer_wrong" 等）。
 * 后端走 fix-question 同款 prompt，但简化（已知 reason 不需要 judge 给 issues）。
 *
 * Body:
 *   {
 *     question: <full question JSON>,    // 客户端把当前题完整传过来
 *     reason: "answer_wrong" | "stem_unclear" | "options_same" | "math_error" | "other",
 *     reasonText?: string,                // 可选自由说明
 *   }
 *
 * Response:
 *   { ok: true, fixed: <full question>, changesSummary: string, model, provider }
 *   或 { ok: false, error, detail }
 *
 * 注意：fix 失败不 fail-soft —— 至少在 question 上加 reported_by_user tag，
 * 让后续 audit 知道这道题被举报过；UPSERT 包含原题 + 标签。
 */

const PER_CALL_TIMEOUT_MS = 25_000;

interface ReportRequest {
  question?: Record<string, unknown>;
  reason?: string;
  reasonText?: string;
}

const REASON_TO_ISSUES: Record<string, string[]> = {
  answer_wrong: ["wrong_answer"],
  stem_unclear: ["cryptic_stem"],
  options_same: ["low_distractor_quality"],
  options_no_correct: ["answer_invalid"],
  math_error: ["wrong_answer"],
  other: ["other"],
};

const REASON_TO_TEXT: Record<string, string> = {
  answer_wrong: "用户报告：答案不对",
  stem_unclear: "用户报告：题面看不懂 / 措辞不清",
  options_same: "用户报告：4 个选项看起来一样或区分度太低",
  options_no_correct: "用户报告：4 个选项里没有正确答案",
  math_error: "用户报告：数字 / 计算有错",
  other: "用户报告：其他问题",
};

interface QwenChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { code?: string; message?: string };
}

async function callOnce(
  baseUrl: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ ok: true; text: string } | { ok: false; status: number; code: string; message: string }> {
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
        temperature: 0.3,
        max_tokens: 3500,
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
    if (!content) return { ok: false, status: 500, code: "empty", message: "no content" };
    return { ok: true, text: content };
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

function extractJsonObject(text: string): unknown {
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

async function upsertToD1(env: Env, row: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const qid = typeof row.question_id === "string" ? row.question_id : null;
  if (!qid) return { ok: false, error: "missing_question_id" };
  const payloadJson = JSON.stringify(row);
  if (payloadJson.length > 30 * 1024) {
    return { ok: false, error: `row_too_big: ${payloadJson.length}B` };
  }
  try {
    await env.DB.prepare(
      `INSERT INTO ai_questions (user_key, question_id, payload, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_key, question_id) DO UPDATE SET
         payload = excluded.payload, updated_at = excluded.updated_at`,
    )
      .bind(USER_KEY, qid, payloadJson, Date.now())
      .run();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;

  let body: ReportRequest;
  try {
    body = (await request.json()) as ReportRequest;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  const q = body.question;
  if (!q || typeof q !== "object" || typeof q.question_id !== "string") {
    return jsonResponse({ ok: false, error: "missing_question" }, 400);
  }
  const reasonKey = body.reason ?? "other";
  const issues = REASON_TO_ISSUES[reasonKey] ?? ["other"];
  const reasonText = body.reasonText
    ? `${REASON_TO_TEXT[reasonKey] ?? "用户报告"}：${body.reasonText}`
    : (REASON_TO_TEXT[reasonKey] ?? "用户报告：未指定");

  // 标记题被报告过（即使 fix 失败，原题也带上 tag）
  const taggedOriginal = {
    ...q,
    tags: Array.from(
      new Set([
        ...((q.tags as string[] | undefined) ?? []),
        "user_reported",
        `reported:${reasonKey}`,
      ]),
    ),
  };

  // Compose fix prompt + call LLM
  const subjectId = q.subjectId === "chinese" ? "chinese" : "math";
  const sysFix = (PROMPTS.qualityJudgeSystem as unknown as Record<string, string>).math; // reuse math judge sys (has principles)
  void sysFix;
  // 用 fix-question 的 system prompt — 它专门修题
  const FIX_SYS = `你是 Selena 题库的修题员。给你一道用户报告有问题的题 + 报告原因，请输出修好的题。

任务：在保持 question_id / skill_id / unit_id / game_type / play_as / question_format / difficulty 不变的前提下，按报告原因修好题。

输出顶层 \`{ "fixed": <整道题 JSON>, "changesSummary": "改了什么的中文一句话（≤ 30 字）" }\`，**不要** markdown 代码块。

## 修题守则（按 reason 类型）

- **answer_wrong**: 重新算一遍正确答案。如果原题数字本身不能算出整数（果树/人数等），改一组能整除的数。
- **stem_unclear**: 重写 stem 用 4 年级孩子能懂的话。
- **options_same**: 4 个选项区分度提升，每个 distractor 来自具体的学生误解。
- **options_no_correct**: 检查 answer.value 是否真在 options 列表里；不在就重写选项让正确答案在内。
- **math_error**: 重新核算所有数字。
- **other**: 综合判断 + 修复明显问题。

## 4 P 原则（必守）

- **P1 题面纯净**：clue / option / hint 不带"（无关）/（解题设定）"等元注解；errorTag 不在 student-visible 字段。
- **P2 数学闭合**：整数情境答必须整数，数字必须能闭合。
- **P3 干扰项独立**：distractor 不能是题中数字直接衍生（如 6x 的值）。
- **P4 skill 真考**：选项量级一致，不让蒙得到。

如果 visual 字段在 4 个选项上完全相同（只为展示题面），删掉所有 visual 字段。
`;

  const userFix = composeFixUserPrompt({
    question: taggedOriginal,
    issues,
    reason: reasonText,
    subjectId,
  });

  const providers = getChatProviders(env);
  if (providers.length === 0) {
    // 无 LLM 可用 → 仅打 tag 入库
    const r = await upsertToD1(env, taggedOriginal);
    return jsonResponse({
      ok: r.ok,
      tagged: true,
      fixed: false,
      detail: r.ok ? "no_llm_provider" : r.error,
    });
  }
  const ctx = providers[0]!;
  const llm = await callOnce(ctx.baseUrl, ctx.apiKey, FIX_SYS, userFix);
  if (!llm.ok) {
    // LLM 失败 → 至少把 tagged 原题入库，让 admin 后续看
    await upsertToD1(env, taggedOriginal);
    return jsonResponse({
      ok: true,
      tagged: true,
      fixed: false,
      detail: `${llm.code}: ${llm.message}`,
    });
  }

  const parsed = extractJsonObject(llm.text);
  const fixed = (parsed as { fixed?: Record<string, unknown> } | null)?.fixed;
  const summary = (parsed as { changesSummary?: string } | null)?.changesSummary ?? "";
  if (!fixed || typeof fixed !== "object") {
    await upsertToD1(env, taggedOriginal);
    return jsonResponse({
      ok: true,
      tagged: true,
      fixed: false,
      detail: "could_not_parse_fix",
      rawSnippet: llm.text.slice(0, 200),
    });
  }

  // Force-merge stable fields from original (AI不能改)
  const merged = {
    ...fixed,
    question_id: taggedOriginal.question_id,
    skill_id: taggedOriginal.skill_id,
    skill_name: taggedOriginal.skill_name,
    unit_id: taggedOriginal.unit_id,
    unit_name: taggedOriginal.unit_name,
    subjectId: taggedOriginal.subjectId,
    grade: taggedOriginal.grade ?? 4,
    term: taggedOriginal.term,
    game_type: taggedOriginal.game_type,
    play_as: taggedOriginal.play_as,
    question_format: taggedOriginal.question_format,
    status: "approved",
    version: ((taggedOriginal.version as number) ?? 1) + 1,
    tags: Array.from(
      new Set([
        ...((fixed.tags as string[] | undefined) ?? []),
        ...((taggedOriginal.tags as string[] | undefined) ?? []),
        "ai_fixed_by_report",
        `reported:${reasonKey}`,
      ]),
    ),
  };

  const r = await upsertToD1(env, merged);
  if (!r.ok) {
    return jsonResponse({
      ok: false,
      error: "d1_upsert_failed",
      detail: r.error,
      fixed: merged,
    });
  }
  return jsonResponse({
    ok: true,
    fixed: merged,
    changesSummary: summary,
    model: "qwen-plus",
    provider: ctx.label,
  });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
