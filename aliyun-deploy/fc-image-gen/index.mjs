/**
 * v0.35.19 (爸爸反馈 5-18 "开干"): Aliyun FC image-gen HTTP service.
 *
 * 解决: ESA EdgeRoutine 11s 上游 timeout → token-plan image gen 跑不动 (15-25s).
 * FC nodejs20 没这个限制 (function timeout 60s).
 *
 * 只走 TOKEN_PLAN_CN (月订阅, 已付费). 不 fallback BAILIAN. 4 model fail-fast.
 *
 * FC nodejs20 HTTP handler: 用 standard Web API Request/Response (Fetch API).
 *   export const handler = async (request) => new Response(body, { status, headers })
 */

const TOKEN_PLAN_BASE_URL = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODELS = [
  "wan2.7-image",
  "qwen-image-2.0",
  "wan2.7-image-pro",
  "qwen-image-2.0-pro",
];
const SINGLE_MODEL_TIMEOUT_MS = 28_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function jsonResp(statusCode, payload) {
  // FC 3.0 HTTP handler 期望返回 plain object with statusCode/headers/body (类 API Gateway shape)
  return {
    statusCode,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    isBase64Encoded: false,
  };
}

function safeEq(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function checkAuth(authHeader, env) {
  const m = /^Bearer\s+(.+)$/.exec(authHeader ?? "");
  if (!m) return null;
  const pwd = m[1];
  if (env.APP_PASSWORD && safeEq(pwd, env.APP_PASSWORD)) return "admin";
  try {
    const map = env.APP_USERS ? JSON.parse(env.APP_USERS) : {};
    for (const [k, v] of Object.entries(map)) {
      if (safeEq(pwd, k)) return typeof v === "string" ? v : null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function callTokenPlanImageGen(apiKey, model, prompt) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), SINGLE_MODEL_TIMEOUT_MS);
  try {
    const r = await fetch(`${TOKEN_PLAN_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        max_tokens: 2000,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    let json;
    try { json = await r.json(); } catch { return { ok: false, status: r.status, code: "non_json", message: "non-JSON" }; }
    if (!r.ok || json.code) {
      return {
        ok: false, status: r.status,
        code: json.code ?? "http_error",
        message: json.message ?? `upstream ${r.status}`,
      };
    }
    const contentArr = json.output?.choices?.[0]?.message?.content ?? [];
    const urls = contentArr.map((c) => c.image).filter((u) => typeof u === "string" && u.startsWith("http"));
    if (urls.length === 0) {
      return { ok: false, status: r.status, code: "no_urls", message: `no URLs: ${JSON.stringify(json).slice(0, 200)}` };
    }
    return { ok: true, urls };
  } catch (e) {
    clearTimeout(to);
    const msg = e?.message ?? String(e);
    return { ok: false, status: 0, code: msg.includes("aborted") ? "timeout" : "fetch_failed", message: msg };
  }
}

/**
 * FC 3.0 nodejs20 HTTP handler — Web Fetch API (Request/Response).
 */
/**
 * FC 3.0 nodejs20 HTTP handler — 实测 (2026-05-18 verify):
 *   - signature: (event, context, callback). event 是 Buffer, 内含 JSON
 *     `{headers, method, body, isBase64Encoded?}`. (类似 API Gateway v1 shape)
 *   - return plain object `{statusCode, headers, body, isBase64Encoded?}`
 */
export const handler = async (rawEvent, _context) => {
  const env = process.env;
  const start = Date.now();

  // FC 3.0 HTTP trigger 给 OPTIONS preflight 时 event 可能是空 Buffer.
  // 在 JSON.parse 失败前先识别这种情况, 返 204 让浏览器 CORS pass.
  const isEmptyEvent =
    !rawEvent ||
    (Buffer.isBuffer(rawEvent) && rawEvent.length === 0) ||
    (typeof rawEvent === "string" && rawEvent.length === 0);
  if (isEmptyEvent) {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  let event;
  if (Buffer.isBuffer(rawEvent)) {
    try {
      event = JSON.parse(rawEvent.toString("utf8"));
    } catch {
      // 不是 JSON → 也当 preflight / 非标 invocation 处理, 返 204 比 400 友好
      return { statusCode: 204, headers: CORS, body: "" };
    }
  } else {
    event = rawEvent ?? {};
  }

  const headers = event.headers ?? {};
  const lh = {};
  for (const [k, v] of Object.entries(headers)) lh[k.toLowerCase()] = v;
  // method 检测: event.method / httpMethod / requestContext.http.method 三路兜底
  const method = (
    event.method ??
    event.httpMethod ??
    event.requestContext?.http?.method ??
    "POST"
  ).toUpperCase();
  let bodyStr = event.body ?? "";
  if (event.isBase64Encoded && bodyStr) {
    bodyStr = Buffer.from(bodyStr, "base64").toString("utf8");
  }

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if (method !== "POST") {
    return jsonResp(405, { ok: false, error: "method_not_allowed" });
  }

  const auth = lh.authorization ?? "";
  // v0.35.29 iter 2 (跟 fc-paper-ocr 同 fix): 没 auth header 当 preflight 处理返 204
  if (!auth) return { statusCode: 204, headers: CORS, body: "" };
  const userId = checkAuth(auth, env);
  if (!userId) {
    return jsonResp(401, { ok: false, error: "unauthorized" });
  }

  let body;
  try {
    body = bodyStr ? JSON.parse(bodyStr) : {};
  } catch (e) {
    return jsonResp(400, { ok: false, error: "invalid_json", detail: String(e) });
  }
  const prompt = body?.prompt;
  if (!prompt || typeof prompt !== "string") {
    return jsonResp(400, { ok: false, error: "missing_prompt" });
  }
  const fullPrompt = body.style ? `${prompt}, ${body.style}` : prompt;

  if (!env.TOKEN_PLAN_CN_API_KEY) {
    return jsonResp(503, {
      ok: false,
      error: "token_plan_not_configured",
      reason: "TOKEN_PLAN_CN_API_KEY 未设. image gen 走已付订阅, 不走 BAILIAN 按量.",
    });
  }

  const models = body.model ? [body.model] : DEFAULT_MODELS;
  const tried = [];
  for (const m of models) {
    const r = await callTokenPlanImageGen(env.TOKEN_PLAN_CN_API_KEY, m, fullPrompt);
    if (r.ok) {
      const elapsedMs = Date.now() - start;
      console.log(`[fc-image-gen] ok userId=${userId} model=${m} elapsedMs=${elapsedMs} urls=${r.urls.length}`);
      return jsonResp(200, {
        ok: true,
        urls: r.urls,
        model: m,
        provider: "token-plan-cn",
        elapsedMs,
      });
    }
    tried.push({ model: m, code: r.code, message: r.message });
    if (
      r.code === "InvalidApiKey" ||
      r.code === "AccessDenied" ||
      r.code === "AccessDenied.QuotaExhausted"
    ) {
      console.warn(`[fc-image-gen] fatal ${r.code}, stop chain`);
      break;
    }
  }
  const elapsedMs = Date.now() - start;
  console.warn(`[fc-image-gen] all models failed userId=${userId} elapsedMs=${elapsedMs}`, tried);
  return jsonResp(502, {
    ok: false,
    error: "no_model_worked",
    tried,
    elapsedMs,
    note: "已尝试 token-plan 所有 image model. 不 fallback BAILIAN 按量.",
  });
};
