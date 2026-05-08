/**
 * POST /api/tutor/judge-handwriting
 *
 * Selena 在 canvas 上手写一个汉字，前端把图发到这里，让 qwen-vl-max（视觉模型）判
 * 这个图是不是要求的字。
 *
 * 这个端点是为了修 v0.31.41 的 bug：之前 chinese 写字练习用 input 框，Selena 打
 * 拼音输入法直接 IME 出字，没真在写。改成 canvas 手画 + LLM 视觉判。
 *
 * 输入 body:
 *   {
 *     targetChar: string,     // 要写的目标字（如 "描"）
 *     pinyin?: string,        // 拼音（可选，给 LLM 上下文）
 *     imageBase64: string,    // 手写图 PNG/JPEG base64（不带 data: 前缀也行）
 *     imageMime?: string,     // 默认 "image/png"
 *   }
 *
 * 输出:
 *   { ok: true, isCorrect: boolean, confidence: "high"|"medium"|"low",
 *     observed?: string,    // LLM 看到的字（用于 "你写成了 X" 反馈）
 *     comment?: string,     // 80 字内简短鼓励/纠正
 *     model: string }
 *   或 { ok: false, error: string, detail?: string }
 *
 * 模型策略：
 *   1. token-plan 的 qwen3-vl-plus（订阅版，识别中文手写效果最好）
 *   2. dashscope-intl 的 qwen-vl-max-latest（兜底）
 */

import {
  checkAuth,
  corsHeaders,
  jsonResponse,
  type Env,
} from "../../_shared";

interface JudgeRequest {
  targetChar?: string;
  pinyin?: string;
  imageBase64?: string;
  imageMime?: string;
}

interface JudgeResult {
  isCorrect: boolean;
  confidence: "high" | "medium" | "low";
  observed?: string;
  comment?: string;
}

/**
 * 视觉模型 provider 链：token-plan 优先（订阅版有 qwen3.6-plus 多模态），
 * DashScope intl 兜底（qwen-vl-max-latest）
 *
 * 模型名注意：
 *   - token-plan: `qwen3.6-plus` 是订阅版的多模态主力（支持文本 + 图片输入）
 *   - 之前误用的 `qwen3-vl-plus` 在 token-plan 上不存在，所以 all_providers_failed
 *   - DashScope intl: `qwen-vl-max-latest` / `qwen-vl-plus` 是 free-tier 视觉链
 */
function getVisionProviders(env: Env): {
  baseUrl: string;
  apiKey: string;
  models: string[];
  label: string;
}[] {
  const providers = [];
  if (env.TOKEN_PLAN_API_KEY) {
    providers.push({
      baseUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com",
      apiKey: env.TOKEN_PLAN_API_KEY,
      models: ["qwen3.6-plus", "qwen-vl-max-latest", "qwen-vl-plus"],
      label: "token-plan",
    });
  }
  if (env.DASHSCOPE_API_KEY) {
    providers.push({
      baseUrl: "https://dashscope-intl.aliyuncs.com",
      apiKey: env.DASHSCOPE_API_KEY,
      models: ["qwen-vl-max-latest", "qwen-vl-plus"],
      label: "dashscope-intl",
    });
  }
  return providers;
}

const SYSTEM_PROMPT = `你是一个温柔耐心的小学语文老师助手"小进"。
学生在画板上手写一个汉字，你需要看图判断她写的是不是要求的目标字。

判断标准（4 年级小学生标准，宽松友好）：
- 字形结构正确 → 算对（即使笔画不工整、字歪斜、缺一两笔但结构清晰）
- 完全不同的字 → 错
- 写到一半空白 → 看起来像就给"medium 信心"算对，鼓励完成

返回严格 JSON：
{
  "isCorrect": true|false,
  "confidence": "high"|"medium"|"low",
  "observed": "你看到的字（最像的一个字）",
  "comment": "30-60 字鼓励或纠正话，比如'写得很棒！横画再平一点会更好' 或 '看起来像写成了 X 字哦，再看看拼音和含义'"
}

不要输出 JSON 以外的任何东西。不要包 markdown code block。`;

async function callVisionAPI(
  baseUrl: string,
  apiKey: string,
  model: string,
  targetChar: string,
  pinyin: string | undefined,
  imageDataUrl: string,
): Promise<JudgeResult> {
  const userText = `目标字：${targetChar}${pinyin ? `（拼音：${pinyin}）` : ""}\n\n请看图判断学生写的是不是这个字。返回 JSON。`;

  const reqBody = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    // v0.31.45: 不强制 json_object — 部分模型不支持，让 system prompt 强制 JSON
    temperature: 0.2,
    max_tokens: 200,
  };

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 25000);

  let resp: Response;
  try {
    resp = await fetch(`${baseUrl}/compatible-mode/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`api_error_${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty_content");
  // v0.31.45: 更宽松的 JSON 提取——模型可能在 JSON 前后说点啥，找到第一个 { ... } block
  let parsed: JudgeResult;
  try {
    let cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    // 找 first { ... last } — 防模型在前后包了文字
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
    parsed = JSON.parse(cleaned) as JudgeResult;
  } catch (e) {
    throw new Error(`parse_failed: ${(e as Error).message}; content=${content.slice(0, 120)}`);
  }
  if (typeof parsed.isCorrect !== "boolean") {
    throw new Error(`invalid_isCorrect; got=${JSON.stringify(parsed.isCorrect)}`);
  }
  if (!["high", "medium", "low"].includes(parsed.confidence)) {
    parsed.confidence = "medium";
  }
  return parsed;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }
  // checkAuth 约定：未授权返回 Response，授权返回 null
  const authResp = checkAuth(request, env);
  if (authResp) return authResp;

  let body: JudgeRequest;
  try {
    body = (await request.json()) as JudgeRequest;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const targetChar = (body.targetChar ?? "").trim();
  const imageBase64 = (body.imageBase64 ?? "").trim();
  if (!targetChar) {
    return jsonResponse({ ok: false, error: "missing_target_char" }, 400);
  }
  if (!imageBase64) {
    return jsonResponse({ ok: false, error: "missing_image" }, 400);
  }
  // 大小限制 ~512KB base64 (~ 384KB binary)
  if (imageBase64.length > 700_000) {
    return jsonResponse({ ok: false, error: "image_too_large" }, 413);
  }

  const mime = body.imageMime ?? "image/png";
  // base64 可能已经带 data: 前缀，规范化
  const cleanB64 = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:${mime};base64,${imageBase64}`;

  const providers = getVisionProviders(env);
  if (providers.length === 0) {
    return jsonResponse(
      {
        ok: false,
        error: "no_vision_provider_configured",
        detail: "需要 TOKEN_PLAN_API_KEY 或 DASHSCOPE_API_KEY",
      },
      503,
    );
  }

  const errors: string[] = [];
  for (const p of providers) {
    for (const model of p.models) {
      try {
        const result = await callVisionAPI(
          p.baseUrl,
          p.apiKey,
          model,
          targetChar,
          body.pinyin,
          cleanB64,
        );
        return jsonResponse({
          ok: true,
          ...result,
          model,
          provider: p.label,
        });
      } catch (e) {
        errors.push(`[${p.label}/${model}] ${(e as Error).message}`);
      }
    }
  }

  return jsonResponse(
    {
      ok: false,
      error: "all_providers_failed",
      detail: errors.join(" | "),
    },
    502,
  );
};
