/**
 * v0.35.22 iter 51 (爸爸 explicit 提): 试卷 OCR via vision FC.
 *
 * Admin /math/paper-entry 老 v1 是手敲, 现在 admin 拍照即可自动出 mistakes 列表.
 * 爸爸 explicit 说"试卷可以直接发给 qwen3.6 plus 或 Kimi K2.6". 实测
 * qwen3.6-plus vision 11.3s OCR 出"23+47=70". 走 FC 旁路 (ESA 11s 临界).
 *
 * 决策:
 *   - 只走 TOKEN_PLAN_CN qwen3.6-plus (vision multi-modal, 月订阅)
 *   - fallback: kimi-k2.6 (也是 multi-modal, registry 列的)
 *   - 0 BAILIAN
 *   - 50s timeout (vision 11-25s, 留 buffer)
 *
 * Input:
 *   { image_base64: string (data URL prefix optional), mode?: "extract_mistakes" | "ocr_raw" }
 *   - extract_mistakes (默认): 返结构化 mistakes 列表
 *   - ocr_raw: 返原始 OCR 文本 (debug 用)
 *
 * Output:
 *   200 { ok: true, papers: [{stem, correctAnswer, studentAnswer, errorTag, confidence}], model, elapsedMs }
 *   200 { ok: true, raw: "...", model, elapsedMs }  (ocr_raw mode)
 *   401 { ok: false, error: "unauthorized" }
 *   502 { ok: false, error: "no_model_worked", tried: [...] }
 */

const TOKEN_PLAN_BASE_URL = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODELS = ["qwen3.6-plus", "kimi-k2.6"];
const SINGLE_MODEL_TIMEOUT_MS = 50_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function jsonResp(statusCode, payload) {
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

const EXTRACT_MISTAKES_SYS_PROMPT = `你是小学四年级数学卷子分析助手. 给你一张学生写的卷子照片, 找出**所有学生答错的题**.

每道错题输出:
- stem: 题面文字 (50 字内, 关键算式 / 应用题情境)
- correctAnswer: 正确答案 (一般在批改边写了红笔, 你也可以重新算一遍 verify)
- studentAnswer: 学生写的错答 (照抄她写的, 如果没写就写"(空)")
- errorTag: 错因 (从下面选一个最合适的):
    粗心 / 计算错 / 概念错 / 单位错 / 进位漏 / 退位错 / 抄错号 / 看错题 / 列式错 / 没读懂 / 其它
- confidence: 0-1, 你对这道题判定 (题面+正解+错答) 的把握度, < 0.5 说明可能识别不清

输出格式: 严格 JSON 数组, **仅 JSON, 无 markdown 无解释**. 没错题返 []. 示例:
[{"stem":"3.6 × 2.5 = ?","correctAnswer":"9","studentAnswer":"8.5","errorTag":"小数点错","confidence":0.9}]`;

async function callVision(apiKey, model, sysPrompt, userText, imageDataUrl) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), SINGLE_MODEL_TIMEOUT_MS);
  try {
    const r = await fetch(`${TOKEN_PLAN_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: sysPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0.1,
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
    const content = json.choices?.[0]?.message?.content ?? "";
    if (!content || typeof content !== "string") {
      return { ok: false, status: r.status, code: "empty_content", message: "no content in choice" };
    }
    return { ok: true, content };
  } catch (e) {
    clearTimeout(to);
    const msg = e?.message ?? String(e);
    return { ok: false, status: 0, code: msg.includes("aborted") ? "timeout" : "fetch_failed", message: msg };
  }
}

function tryParseJsonArray(text) {
  // 兼容: LLM 可能输出 ```json ... ``` markdown 包. strip 一下
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return { ok: true, papers: parsed };
    return { ok: false, error: "not_array", raw: cleaned.slice(0, 300) };
  } catch (e) {
    return { ok: false, error: `parse_fail: ${e.message}`, raw: cleaned.slice(0, 300) };
  }
}

export const handler = async (rawEvent, _context) => {
  const env = process.env;
  const start = Date.now();

  // OPTIONS preflight (跟 fc-image-gen 同 pattern)
  const isEmptyEvent = !rawEvent || (Buffer.isBuffer(rawEvent) && rawEvent.length === 0);
  if (isEmptyEvent) return { statusCode: 204, headers: CORS, body: "" };

  let event;
  if (Buffer.isBuffer(rawEvent)) {
    try { event = JSON.parse(rawEvent.toString("utf8")); }
    catch { return { statusCode: 204, headers: CORS, body: "" }; }
  } else {
    event = rawEvent ?? {};
  }
  const headers = event.headers ?? {};
  const lh = {};
  for (const [k, v] of Object.entries(headers)) lh[k.toLowerCase()] = v;
  const method = (event.method ?? event.httpMethod ?? "POST").toUpperCase();
  let bodyStr = event.body ?? "";
  if (event.isBase64Encoded && bodyStr) {
    bodyStr = Buffer.from(bodyStr, "base64").toString("utf8");
  }

  if (method === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (method !== "POST") return jsonResp(405, { ok: false, error: "method_not_allowed" });

  const auth = lh.authorization ?? "";
  const userId = checkAuth(auth, env);
  if (!userId) return jsonResp(401, { ok: false, error: "unauthorized" });

  let body;
  try { body = bodyStr ? JSON.parse(bodyStr) : {}; }
  catch (e) { return jsonResp(400, { ok: false, error: "invalid_json", detail: String(e) }); }

  let imageBase64 = body.image_base64;
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return jsonResp(400, { ok: false, error: "missing_image_base64" });
  }
  // Auto-add data URL prefix if missing
  const imageDataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/png;base64,${imageBase64}`;
  const mode = body.mode === "ocr_raw" ? "ocr_raw" : "extract_mistakes";

  if (!env.TOKEN_PLAN_CN_API_KEY) {
    return jsonResp(503, { ok: false, error: "token_plan_not_configured" });
  }

  const models = body.model ? [body.model] : DEFAULT_MODELS;
  const tried = [];

  for (const m of models) {
    let r;
    if (mode === "ocr_raw") {
      r = await callVision(
        env.TOKEN_PLAN_CN_API_KEY,
        m,
        "你是 OCR 助手. 把图片里所有文字 + 算式照原样抄出来 (保留换行).",
        "请抄写这张图片所有文字.",
        imageDataUrl,
      );
    } else {
      r = await callVision(
        env.TOKEN_PLAN_CN_API_KEY,
        m,
        EXTRACT_MISTAKES_SYS_PROMPT,
        "请分析这张数学卷子, 输出所有错题的结构化 JSON 数组.",
        imageDataUrl,
      );
    }
    if (r.ok) {
      const elapsedMs = Date.now() - start;
      console.log(`[fc-paper-ocr] ok userId=${userId} model=${m} mode=${mode} elapsedMs=${elapsedMs}`);
      if (mode === "ocr_raw") {
        return jsonResp(200, { ok: true, raw: r.content, model: m, provider: "token-plan-cn", elapsedMs });
      }
      const parsed = tryParseJsonArray(r.content);
      if (!parsed.ok) {
        // LLM 返了 OK content 但 JSON parse fail. Return as-is for client debug.
        return jsonResp(200, {
          ok: false,
          error: "llm_output_not_json",
          parseDetail: parsed.error,
          rawContent: r.content.slice(0, 1000),
          model: m,
          elapsedMs,
        });
      }
      return jsonResp(200, { ok: true, papers: parsed.papers, model: m, provider: "token-plan-cn", elapsedMs });
    }
    tried.push({ model: m, code: r.code, message: r.message });
    if (r.code === "InvalidApiKey" || r.code === "AccessDenied" || r.code === "AccessDenied.QuotaExhausted") {
      console.warn(`[fc-paper-ocr] fatal ${r.code}, stop chain`);
      break;
    }
  }

  const elapsedMs = Date.now() - start;
  console.warn(`[fc-paper-ocr] all models failed userId=${userId} elapsedMs=${elapsedMs}`, tried);
  return jsonResp(502, { ok: false, error: "no_model_worked", tried, elapsedMs });
};
