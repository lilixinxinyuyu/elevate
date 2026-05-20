/**
 * v0.36.19 (爸爸深度优化 #2): Aliyun FC 出题服务 — 完全脱离 ESA.
 *
 * 痛点: ESA EdgeRoutine 9-30s timeout 跟 LLM 出题时间 (完整 prompt 10-15s) 冲突,
 * 经常 504. CF Pages 已删 (不再有兜底). FC nodejs20 timeout 60s, 没这个限制,
 * 而且可以 cascade 多 model + count 更大.
 *
 * 复用 ESA lib (composer/prompts/normalize/gameTypePicker), esbuild bundle 进来.
 * 唯一出题逻辑源, 不重写一套.
 *
 * FC 3.0 HTTP handler: 返 { statusCode, headers, body }.
 * Auth: Bearer <APP_PASSWORD> (baked). 客户端直调 FC URL (绕过 ESA).
 */
import {
  composeQuestionUserPrompt,
  cognitiveLevelFor,
  estimatedTimeFor,
  questionFormatFor,
} from "../src/lib/promptComposer";
import { pickGameType } from "../src/lib/gameTypePicker";
import { PROMPTS } from "../src/generated/_prompts.generated";
import { normalizeAiQuestion } from "../src/lib/normalizeAiQuestion";

declare const __BAKED_FC_ENV__: {
  TOKEN_PLAN_CN_API_KEY?: string;
  APP_PASSWORD?: string;
  APP_USERS?: string;
};
const ENV = __BAKED_FC_ENV__;

const TOKEN_PLAN_BASE = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
// 实测 count=2 完整 prompt ~13s. FC function 硬限 60s.
// 单 call 24s + cascade 2 model = 48s < 60s 安全. 单 call 24s 够 count≤4 出题.
const PER_CALL_TIMEOUT_MS = 24_000;
// FC 60s 容纳 count≤4 (单 call ~13-25s). 比 ESA (cap 3, 30s) 略大.
const QUESTIONS_MAX = 4;
// cascade 2 model (qwen3.6-flash 最快 ~0.3s首token, deepseek-v4-flash 兜底). 2×24=48s<60s.
const MODELS = ["qwen3.6-flash", "deepseek-v4-flash"];

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function jsonResp(statusCode: number, payload: unknown) {
  return {
    statusCode,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
    isBase64Encoded: false,
  };
}

function safeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function checkAuth(authHeader: string | undefined): boolean {
  const m = /^Bearer\s+(.+)$/.exec(authHeader ?? "");
  if (!m) return false;
  const pwd = m[1]!;
  if (ENV.APP_PASSWORD && safeEq(pwd, ENV.APP_PASSWORD)) return true;
  if (ENV.APP_USERS) {
    try {
      const map = JSON.parse(ENV.APP_USERS) as Record<string, string>;
      for (const k of Object.keys(map)) if (safeEq(pwd, k)) return true;
    } catch { /* noop */ }
  }
  return false;
}

interface GenBody {
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
}

function buildSystemPrompt(subjectId: string): string {
  const subjLabel = subjectId === "math" ? "数学" : "语文";
  const subjKey = subjectId === "math" ? "math" : "chinese";
  const sys = PROMPTS.questionsSystem as unknown as
    | string
    | { math?: string; chinese?: string; raw?: string };
  const template =
    typeof sys === "string" ? sys : (sys[subjKey as "math" | "chinese"] ?? sys.raw ?? "");
  return template.replace(/\{\{subjectLabel\}\}/g, subjLabel);
}

function parseDifficulty(raw: string | number | undefined): 1 | 2 | 3 | 4 | 5 {
  if (typeof raw === "number") return Math.min(5, Math.max(1, Math.round(raw))) as 1|2|3|4|5;
  if (!raw) return 3;
  const single = /^([1-5])$/.exec(raw);
  if (single) return Number(single[1]) as 1|2|3|4|5;
  const range = /^([1-5])-([1-5])$/.exec(raw);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2) as 1|2|3|4|5;
  return 3;
}

function buildUserPrompt(body: GenBody): string {
  const count = Math.max(1, Math.min(QUESTIONS_MAX, body.count ?? 3));
  const subjectId = body.subjectId === "chinese" ? "chinese" : "math";
  const difficulty = parseDifficulty(body.difficulty);
  const gameType = body.gameType ?? (body.skillId ? pickGameType(body.skillId) : "plain_choice");
  const skillMeta = body.skillId
    ? (PROMPTS.skillMetadata as unknown as Record<string, { ability: string[]; examPriority: string } | undefined>)[body.skillId]
    : undefined;
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
    prefilledFields: {
      grade: 4,
      cognitiveLevel: cognitiveLevelFor(body.skillId ?? "", gameType),
      questionFormat: questionFormatFor(gameType),
      estimatedTimeSeconds: estimatedTimeFor(gameType, difficulty),
      status: "approved",
      examPriority: skillMeta?.examPriority,
      abilityDimension: skillMeta?.ability,
    },
  });
}

/** 安全抓 JSON (LLM 可能裹 markdown / 前后有杂质) */
function extractJsonObj(text: string): { questions?: unknown[] } | null {
  if (!text) return null;
  const tries = [
    text.trim(),
    text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "").trim(),
  ];
  for (const t of tries) {
    try {
      const p = JSON.parse(t);
      if (p && typeof p === "object") return p as { questions?: unknown[] };
    } catch { /* fallthrough */ }
  }
  // 找第一个 { 到最后一个 } 的平衡子串
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const p = JSON.parse(text.slice(start, end + 1));
      if (p && typeof p === "object") return p as { questions?: unknown[] };
    } catch { /* noop */ }
  }
  return null;
}

async function callQwen(model: string, sys: string, usr: string):
  Promise<{ ok: true; text: string } | { ok: false; code: string; message: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_CALL_TIMEOUT_MS);
  try {
    const resp = await fetch(`${TOKEN_PLAN_BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.TOKEN_PLAN_CN_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
        temperature: 0.7,
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
      return { ok: false, code: j?.error?.code ?? `http_${resp.status}`, message: j?.error?.message ?? "" };
    }
    const text = j.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false, code: "empty_response", message: "" };
    return { ok: true, text };
  } catch (e) {
    clearTimeout(timer);
    const isAbort = (e as Error)?.name === "AbortError";
    return { ok: false, code: isAbort ? "timeout" : "fetch_error", message: (e as Error).message };
  }
}

// FC 3.0 HTTP handler: handler(rawEvent, context). rawEvent 是 API Gateway-like
// (Buffer 或 object), 不是 Web Request. 跟 fc-image-gen 同格式.
export const handler = async (rawEvent: unknown, _context?: unknown) => {
  // OPTIONS preflight / 空 event → 204
  const isEmpty =
    !rawEvent ||
    (typeof Buffer !== "undefined" && Buffer.isBuffer(rawEvent) && (rawEvent as Buffer).length === 0) ||
    (typeof rawEvent === "string" && rawEvent.length === 0);
  if (isEmpty) return { statusCode: 204, headers: CORS, body: "" };

  let event: Record<string, unknown>;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(rawEvent)) {
    try {
      event = JSON.parse((rawEvent as Buffer).toString("utf8"));
    } catch {
      return { statusCode: 204, headers: CORS, body: "" };
    }
  } else {
    event = (rawEvent ?? {}) as Record<string, unknown>;
  }

  const rawHeaders = (event.headers ?? {}) as Record<string, string>;
  const lh: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawHeaders)) lh[k.toLowerCase()] = v;
  const method = String(
    event.method ??
    event.httpMethod ??
    (event.requestContext as { http?: { method?: string } } | undefined)?.http?.method ??
    "POST",
  ).toUpperCase();
  let bodyStr = (event.body as string) ?? "";
  if (event.isBase64Encoded && bodyStr && typeof Buffer !== "undefined") {
    bodyStr = Buffer.from(bodyStr, "base64").toString("utf8");
  }

  if (method === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (method !== "POST") return jsonResp(405, { ok: false, error: "method_not_allowed" });

  const auth = lh.authorization ?? "";
  if (!auth) return { statusCode: 204, headers: CORS, body: "" }; // 无 auth 当 preflight
  if (!checkAuth(auth)) return jsonResp(401, { ok: false, error: "unauthorized" });
  if (!ENV.TOKEN_PLAN_CN_API_KEY) {
    return jsonResp(503, { ok: false, error: "generator_not_configured" });
  }

  let body: GenBody;
  try {
    body = bodyStr ? (JSON.parse(bodyStr) as GenBody) : {};
  } catch {
    return jsonResp(400, { ok: false, error: "invalid_json" });
  }
  if (!body.skillId) return jsonResp(400, { ok: false, error: "missing_skillId" });

  const subjectId = body.subjectId === "chinese" ? "chinese" : "math";
  const requestedCount = Math.max(1, Math.min(QUESTIONS_MAX, body.count ?? 3));
  const sys = buildSystemPrompt(subjectId);
  const usr = buildUserPrompt({ ...body, count: requestedCount });
  const stamp = Date.now().toString(36);
  const errors: { model: string; code: string; message: string }[] = [];

  for (const model of MODELS) {
    const r = await callQwen(model, sys, usr);
    if (!r.ok) {
      errors.push({ model, code: r.code, message: r.message.slice(0, 100) });
      if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
      continue;
    }
    const parsed = extractJsonObj(r.text);
    const rawQs = Array.isArray(parsed?.questions) ? parsed!.questions : null;
    if (!rawQs || rawQs.length === 0) {
      errors.push({ model, code: "json_parse_failed", message: r.text.slice(0, 100) });
      continue;
    }
    const stamped = rawQs
      .filter((q): q is Record<string, unknown> =>
        typeof q === "object" && q !== null && typeof (q as Record<string, unknown>).stem === "string")
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
        return normalizeAiQuestion(tagged).q;
      });
    if (stamped.length === 0) {
      errors.push({ model, code: "no_valid_questions", message: "" });
      continue;
    }
    return jsonResp(200, {
      ok: true,
      questions: stamped,
      model,
      provider: "token-plan-fc",
      generatedCount: stamped.length,
      requestedCount,
      partial: stamped.length < requestedCount,
    });
  }

  return jsonResp(502, {
    ok: false,
    error: "no_model_worked",
    detail: errors.slice(0, 5).map((t) => `${t.model}:${t.code}`).join(", "),
    tried: errors,
  });
};
