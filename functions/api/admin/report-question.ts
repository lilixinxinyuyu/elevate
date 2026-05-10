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
  /** v0.31.82：用户提交过的答案（如有），让 AI 判 user 答的对错 + 给解释 */
  userAnswer?: unknown;
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

/**
 * v0.31.79：question_reports 表保留 用户报告 + AI 修题前后状态。
 * 用于后台诊断 prompt 质量、找 AI 反复犯错的模式。
 */
async function ensureReportsSchema(db: D1Database): Promise<void> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS question_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_key TEXT NOT NULL,
      question_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      reason_text TEXT,
      original_payload TEXT NOT NULL,
      fixed_payload TEXT,
      changes_summary TEXT,
      ai_fix_succeeded INTEGER NOT NULL DEFAULT 0,
      llm_error TEXT,
      created_at INTEGER NOT NULL
    )`.replace(/\s+/g, " ").trim(),
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_question_reports_qid ON question_reports (user_key, question_id)`,
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_question_reports_created ON question_reports (user_key, created_at)`,
  );
}

async function logReport(
  env: Env,
  args: {
    questionId: string;
    reason: string;
    reasonText?: string;
    originalPayload: Record<string, unknown>;
    fixedPayload: Record<string, unknown> | null;
    changesSummary?: string;
    aiFixSucceeded: boolean;
    llmError?: string;
  },
): Promise<void> {
  try {
    await ensureReportsSchema(env.DB);
    await env.DB.prepare(
      `INSERT INTO question_reports
       (user_key, question_id, reason, reason_text, original_payload, fixed_payload,
        changes_summary, ai_fix_succeeded, llm_error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        USER_KEY,
        args.questionId,
        args.reason,
        args.reasonText ?? null,
        JSON.stringify(args.originalPayload),
        args.fixedPayload ? JSON.stringify(args.fixedPayload) : null,
        args.changesSummary ?? null,
        args.aiFixSucceeded ? 1 : 0,
        args.llmError ?? null,
        Date.now(),
      )
      .run();
  } catch (e) {
    // 记日志失败不阻塞主流程
    console.warn("[report-question] logReport failed:", (e as Error).message);
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
  const taggedOriginal: Record<string, unknown> = {
    ...q,
    tags: Array.from(
      new Set([
        ...((q.tags as string[] | undefined) ?? []),
        "user_reported",
        `reported:${reasonKey}`,
      ]),
    ),
  };

  // v0.31.78: 用 prompts/fix/system.md 共享 prompt（与 fix-question.ts 一致）
  const subjectId = (q.subjectId === "chinese" ? "chinese" : "math") as "math" | "chinese";
  const subjLabel = subjectId === "math" ? "数学" : "语文";
  const sysObj = PROMPTS.fixSystem as unknown as
    | string
    | { math?: string; chinese?: string; raw?: string };
  const sysTemplate =
    typeof sysObj === "string"
      ? sysObj
      : (sysObj[subjectId] ?? sysObj.raw ?? "");
  const FIX_SYS = sysTemplate.replace(/\{\{subjectLabel\}\}/g, subjLabel);

  // v0.31.82: 把 userAnswer 注入 user prompt 末尾，让 AI 判她答的对错
  // v0.31.85：pre-resolve choice id → option text，防 AI hallucinate（之前看到
  //   "0.069" 看成 "0.609"，把 D 当 B）。题面 options 已经在 question 里，但
  //   server 显式 lookup 一遍喂给 AI，更稳。
  let userAnswerLine = "";
  if (body.userAnswer !== undefined && body.userAnswer !== null) {
    const uaRaw = body.userAnswer;
    const opts = (q.options as Array<{ id?: string; text?: string }> | undefined) ?? [];
    let resolved = JSON.stringify(uaRaw);
    if (typeof uaRaw === "string" && opts.length > 0) {
      const matched = opts.find((o) => o?.id === uaRaw);
      if (matched) {
        resolved = `id="${uaRaw}", text="${matched.text}"`;
      }
    }
    userAnswerLine = `\n\n## userAnswer（必读 — 据此判定 userAnswerVerdict + 写 userAnswerExplanation）\n\n用户提交的答案：${resolved}`;
    // 也把全 options 单独再列一遍方便 AI 对照（防 lookup 时眼花）
    if (opts.length > 0) {
      const optList = opts
        .map((o) => `  ${o?.id}: ${o?.text}`)
        .join("\n");
      userAnswerLine += `\n\n（题的 options 完整列表，对照 user 答的是哪个：\n${optList}\n）`;
    }
  }
  const userAnswerSuffix = userAnswerLine;

  const userFix =
    composeFixUserPrompt({
      question: taggedOriginal,
      issues,
      reason: reasonText,
      subjectId,
    }) + userAnswerSuffix;

  const providers = getChatProviders(env);
  if (providers.length === 0) {
    // 无 LLM 可用 → 仅打 tag 入库
    const r = await upsertToD1(env, taggedOriginal);
    await logReport(env, {
      questionId: q.question_id as string,
      reason: reasonKey,
      reasonText: body.reasonText,
      originalPayload: q,
      fixedPayload: null,
      aiFixSucceeded: false,
      llmError: "no_llm_provider",
    });
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
    await logReport(env, {
      questionId: q.question_id as string,
      reason: reasonKey,
      reasonText: body.reasonText,
      originalPayload: q,
      fixedPayload: null,
      aiFixSucceeded: false,
      llmError: `${llm.code}: ${llm.message}`,
    });
    return jsonResponse({
      ok: true,
      tagged: true,
      fixed: false,
      detail: `${llm.code}: ${llm.message}`,
    });
  }

  const parsed = extractJsonObject(llm.text);
  const parsedObj = parsed as
    | {
        fixed?: Record<string, unknown>;
        changesSummary?: string;
        userAnswerVerdict?: string;
        userAnswerExplanation?: string;
      }
    | null;
  const fixed = parsedObj?.fixed;
  const summary = parsedObj?.changesSummary ?? "";
  const userAnswerVerdict = parsedObj?.userAnswerVerdict ?? "unknown";
  const userAnswerExplanation = parsedObj?.userAnswerExplanation ?? "";
  if (!fixed || typeof fixed !== "object") {
    await upsertToD1(env, taggedOriginal);
    await logReport(env, {
      questionId: q.question_id as string,
      reason: reasonKey,
      reasonText: body.reasonText,
      originalPayload: q,
      fixedPayload: null,
      aiFixSucceeded: false,
      llmError: "could_not_parse_fix",
    });
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
    await logReport(env, {
      questionId: q.question_id as string,
      reason: reasonKey,
      reasonText: body.reasonText,
      originalPayload: q,
      fixedPayload: merged,
      changesSummary: summary,
      aiFixSucceeded: false,
      llmError: `d1_upsert_failed: ${r.error}`,
    });
    return jsonResponse({
      ok: false,
      error: "d1_upsert_failed",
      detail: r.error,
      fixed: merged,
    });
  }
  // 成功路径：log report + 返回 fixed
  await logReport(env, {
    questionId: q.question_id as string,
    reason: reasonKey,
    reasonText: body.reasonText,
    originalPayload: q,
    fixedPayload: merged,
    changesSummary: summary,
    aiFixSucceeded: true,
  });
  return jsonResponse({
    ok: true,
    fixed: merged,
    changesSummary: summary,
    userAnswerVerdict,
    userAnswerExplanation,
    model: "qwen-plus",
    provider: ctx.label,
  });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
