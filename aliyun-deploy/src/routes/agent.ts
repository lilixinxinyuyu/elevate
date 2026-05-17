/**
 * /api/agent/* — AI 质检 / 修题 endpoints native impl
 *
 * Ep34 (2026-05-17): port `/api/agent/judge-questions` from CF Pages.
 * 干掉 admin AI 流对 CF Pages fallback 的强依赖。
 *
 * 差异 vs CF Pages 版本：
 * - Prompt 简化为 inline (不依赖 _prompts.generated / _promptComposer)。
 *   原 prompt 是 subject-aware + skill-scope-injected 的复杂 composer。本
 *   inline 版给 qwen3.6 一个清晰的 verdict/severity/issues schema 已足够 —
 *   实测准召率没明显下降，长 prompt 反而拖慢响应。Follow-up 可以 port 完整版。
 * - 单 batch 30 题（同 CF Pages），qwen3.6-flash 主 + qwen3.6-plus fallback。
 * - PER_CALL_TIMEOUT 9s（ESA EdgeRoutine 11s 硬限，留 2s 余量给 OSS sync）。
 *
 * 客户端 src/lib/qualityJudge.ts 不需改 —— path 一样，response shape 兼容。
 *
 * 未 port: /api/agent/fix-question （CF Pages 已 admin.ts /report/:id/fix 替代，
 * 实际生产 qualityJudge.ts 的 fix path 也走 /report/:id/fix）。
 */

import { Hono } from "hono";
import type { Env } from "../lib/env";
import { requireAuth, getUserId } from "../lib/auth";
import { getChatProviders, getChatModels } from "../lib/providers";

const agent = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

const MAX_BATCH = 30;
const PER_CALL_TIMEOUT_MS = 9_000;

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

const VALID_VERDICTS = new Set(["keep", "delete", "borderline"]);
const VALID_ISSUES = new Set([
  "forbidden_verb", "stem_too_short", "stem_options_mismatch",
  "answer_invalid", "out_of_scope", "off_topic", "wrong_answer",
  "low_distractor_quality", "time_off", "duplicate_pattern",
  "bracket_instruction", "cryptic_stem", "weak_hint",
  "bad_punctuation", "name_violation", "other",
]);

function buildSystemPrompt(subjectId: string): string {
  const subjLabel = subjectId === "math" ? "数学" : "语文";
  return `你是 Selena 题库的资深质检员，负责审 ${subjLabel} 题入库前的最后一道关。

# 任务
对收到的每道题，输出 verdict + severity + reason + issues。

# Verdict 规则
- "keep"：题面清晰、答案正确、distractor 合理、scope 对、time 合理 → 留
- "delete"：明显错（答案错 / 题面乱 / out_of_scope / 跟其它题重复模板）→ 删
- "borderline"：能用但有小瑕疵（hint 弱 / 标点小问题 / time ±20% 偏） → 保留待人审

# Severity (1-5)
- 1 = 微 (标点 / 不影响理解)
- 2 = 小 (hint 偏弱)
- 3 = 中 (distractor 不够区分)
- 4 = 大 (答案不准 / scope 跑偏)
- 5 = 致命 (答案错 / 题面无意义)

# Issues 标签（多选，必须在白名单内）
forbidden_verb / stem_too_short / stem_options_mismatch / answer_invalid /
out_of_scope / off_topic / wrong_answer / low_distractor_quality / time_off /
duplicate_pattern / bracket_instruction / cryptic_stem / weak_hint /
bad_punctuation / name_violation / other

# 输出
顶层 JSON: \`{ "judgments": [{ "question_id", "verdict", "severity", "reason", "issues" }, ...] }\`
- reason 一句话 ≤ 40 字
- 不要 markdown 代码块，不要解释文字`;
}

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
      ans && typeof ans === "object" ? { type: ans.type, value: ans.value } : undefined,
    has_solution_steps: Array.isArray(q.solution_steps) && q.solution_steps.length > 0,
    common_errors_count: Array.isArray(q.common_errors) ? q.common_errors.length : 0,
    hints_count: Array.isArray(q.hints) ? q.hints.length : 0,
    is_ai: (q.tags ?? []).includes("ai_generated") || q.question_id.startsWith("AI_"),
  };
}

function buildUserPrompt(body: JudgeRequest): string {
  const summarized = body.questions.map(summarizeQuestion);
  const scope = `${body.scopeLabel ?? "全部"} (${body.scopeFilter ?? "no filter"})`;
  return `# Scope
${scope}

# 待评 ${summarized.length} 道题
${JSON.stringify(summarized, null, 2)}

按 system 要求输出 JSON。`;
}

function extractJsonObject(text: string): unknown {
  if (!text) return null;
  const tryParse = (s: string): unknown => { try { return JSON.parse(s); } catch { return null; } };
  let cleaned = text.trim();
  let r = tryParse(cleaned);
  if (r) return r;
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  r = tryParse(cleaned);
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
        r = tryParse(sub) ?? tryParse(sub.replace(/,(\s*[}\]])/g, "$1"));
        if (r) return r;
      }
    }
  }
  return null;
}

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

agent.post("/judge-questions", async (c) => {
  const fail = await requireAuth(c, async () => {});
  if (fail && fail instanceof Response) return fail; // requireAuth 直接 throws/returns 时透传
  // requireAuth 已 set userId on success; if it fell through without throwing, continue
  void getUserId(c);

  const providers = getChatProviders(c.env);
  if (providers.length === 0) {
    return c.json({ ok: false, error: "judge_not_configured" }, 503);
  }

  let body: JudgeRequest;
  try {
    body = await c.req.json<JudgeRequest>();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    return c.json({ ok: false, error: "missing_questions" }, 400);
  }
  if (body.questions.length > MAX_BATCH) {
    return c.json(
      { ok: false, error: "batch_too_large", detail: `max ${MAX_BATCH}` },
      400,
    );
  }
  const subjectId = body.subjectId === "chinese" ? "chinese" : "math";
  const expectedIds = body.questions.map((q) => q.question_id).filter(Boolean);
  if (expectedIds.length === 0) {
    return c.json({ ok: false, error: "no_question_ids" }, 400);
  }

  const systemPrompt = buildSystemPrompt(subjectId);
  const userPrompt = buildUserPrompt(body);
  const errors: { provider: string; model: string; code: string; message: string }[] = [];

  // Try qwen3.6-flash 主 + qwen3.6-plus fallback per provider, stop on first success
  for (const p of providers) {
    const models = getChatModels(p).filter((m) => /^qwen3/i.test(m)).slice(0, 2);
    for (const model of models) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), PER_CALL_TIMEOUT_MS);
      try {
        const resp = await fetch(`${p.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${p.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.2,
            max_tokens: 4000,
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
            provider: p.label,
            model,
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
        const parsed = extractJsonObject(text);
        if (!parsed) {
          errors.push({
            provider: p.label,
            model,
            code: "json_parse_failed",
            message: text.slice(0, 120),
          });
          continue;
        }
        const judgments = normalizeJudgments(parsed, expectedIds);
        if (judgments.length === 0) {
          errors.push({
            provider: p.label,
            model,
            code: "no_valid_judgments",
            message: "model returned 0 judgments",
          });
          continue;
        }
        return c.json({
          ok: true,
          judgments,
          model,
          provider: p.label,
          triedModelsBeforeSuccess: errors.length,
        });
      } catch (e) {
        clearTimeout(timer);
        const isAbort = (e as Error)?.name === "AbortError";
        errors.push({
          provider: p.label,
          model,
          code: isAbort ? "timeout" : "fetch_error",
          message: e instanceof Error ? e.message : String(e),
        });
        if (isAbort) break; // 这个 provider 已超时,换下一个 provider
      }
    }
  }

  console.error("[agent/judge-questions] all providers failed", errors);
  return c.json(
    {
      ok: false,
      error: "no_model_worked",
      detail: errors.slice(0, 5).map((t) => `${t.provider}/${t.model}:${t.code}`).join(", "),
      tried: errors,
    },
    502,
  );
});

/**
 * POST /api/agent/fix-question — Ep43 native impl
 *
 * 修一道题: client 传入 question + issues + reason, LLM 输出修后题 + summary.
 * 跟 admin.ts /report/:id/fix 区别：那个是从 OSS report 记录上修；这里是
 * client 直接传问题进来修。
 *
 * vs CF Pages 260 行原版差异：
 * - prompt 简化 inline，不用 composer / PROMPTS.fixSystem subject-aware 模板
 * - 单批单 LLM call，qwen3.6-flash 主 + qwen3.6-plus fallback
 * - 9s timeout per call (ESA 11s 硬限留 2s)
 * - carry-forward 不可变字段 (question_id 等) 防 LLM 改飘
 * - 自动加 ai_fixed tag
 */
interface FixReq {
  question?: Record<string, unknown>;
  issues?: string[];
  reason?: string;
  subjectId?: "math" | "chinese";
}

const FIX_SYSTEM_TPL = (subj: string) => `你是 Selena 题库的资深修题员。给你一道**已经入库但有问题的**${subj}题，以及质检员或用户标注的问题（issues + reason）。请把题改好，**不是重出**。

# 任务边界
- question_id / subjectId / version / grade / term / unit_id / skill_id 等元数据**不能改**
- 最小改动原则：能改一句解决就别重写整道
- 数学闭合: 实物=整数, 钱=2 位小数, 答案算得通
- distractor 区分度: 错误选项必须源自学生具体误解（不是随机数字）

# 输出协议
返回 JSON: { "fixed": <整道题 JSON>, "changesSummary": "改了什么的中文一句话（≤ 40 字）" }
不要 markdown 代码块，不要解释文字。`;

const AGENT_FIX_TIMEOUT_MS = 9_000;

agent.post("/fix-question", async (c) => {
  const providers = getChatProviders(c.env);
  if (providers.length === 0) {
    return c.json({ ok: false, error: "no_llm_api_key" }, 503);
  }
  let body: FixReq;
  try {
    body = await c.req.json<FixReq>();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.question || typeof body.question !== "object") {
    return c.json({ ok: false, error: "missing_question" }, 400);
  }
  const subjectId = body.subjectId === "chinese" ? "chinese" : "math";
  const subjLabel = subjectId === "chinese" ? "语文" : "数学";
  const sys = FIX_SYSTEM_TPL(subjLabel);
  const issues = Array.isArray(body.issues) ? body.issues : [];
  const reason = body.reason ?? "";
  const usr = `# 报告问题
issues: ${issues.length ? issues.join(", ") : "(无标签)"}
reason: ${reason || "(无补充)"}

# 原题 JSON
\`\`\`json
${JSON.stringify(body.question, null, 2)}
\`\`\`

按 system 要求修。输出 JSON。`;

  const errors: { provider: string; model: string; code: string; message: string }[] = [];
  for (const p of providers) {
    const models = getChatModels(p).filter((m) => /^qwen3/i.test(m)).slice(0, 2);
    for (const model of models) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), AGENT_FIX_TIMEOUT_MS);
      try {
        const resp = await fetch(`${p.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${p.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
            temperature: 0.4,
            max_tokens: 2500,
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
        const parsed = extractJsonObject(text) as { fixed?: Record<string, unknown>; changesSummary?: string } | null;
        if (!parsed?.fixed || typeof parsed.fixed !== "object") {
          errors.push({ provider: p.label, model, code: "bad_format", message: text.slice(0, 120) });
          continue;
        }
        // carry-forward immutable fields
        const carryFields = ["question_id","subjectId","version","grade","term","unit_id","unit_name","skill_id","skill_name"];
        const fixed = { ...parsed.fixed };
        for (const f of carryFields) {
          if ((body.question as Record<string, unknown>)[f] !== undefined) {
            fixed[f] = (body.question as Record<string, unknown>)[f];
          }
        }
        // ai_fixed tag merge
        const origTags = ((body.question as { tags?: string[] }).tags ?? []) as string[];
        const fixedTags = ((fixed as { tags?: string[] }).tags ?? []) as string[];
        fixed.tags = Array.from(new Set([...origTags, ...fixedTags, "ai_fixed"]));
        return c.json({
          ok: true,
          fixed,
          changesSummary: parsed.changesSummary ?? "AI 修改",
          model,
          provider: p.label,
          subjectId,
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
  return c.json({
    ok: false,
    error: "all_providers_failed",
    detail: errors.map((t) => `${t.provider}:${t.model}:${t.code}`).join(" | "),
    tried: errors,
  }, 502);
});

// fall-through to proxy fallback for any remaining /api/agent/* sub-paths (none known)
agent.all("*", async (c) => {
  const { default: proxyFallback } = await import("./proxy-fallback");
  return proxyFallback.fetch(c.req.raw, c.env);
});

export default agent;
