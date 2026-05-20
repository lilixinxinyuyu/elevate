/**
 * /api/tutor/* —— AI tutor (讲题 / 语音 / 手写判)
 *
 * v0.34.25 (Ep154): 移植 explain. voice + judge-handwriting 暂走 proxy.
 *
 * 端点：
 *   POST /api/tutor/explain — 答错时给苏格拉底式引导 (80-130 字)
 *
 * 模型链：TOKEN_PLAN_CN qwen3.6-flash → BAILIAN qwen3.6-flash fallback。
 * enable_thinking:false 关键，否则 6s+ 超 ESA 11s 限制。
 */

import { Hono } from "hono";
import type { Env } from "../lib/env";
import { requireAuth } from "../lib/auth";
import proxyFallback from "./proxy-fallback";

const tutor = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// 移植自 prompts/tutor/text-system.md (Selena 小进姐姐 引导教学)
const TUTOR_TEXT_SYSTEM = `你是 Selena（4 年级女生）的 AI 引导老师"小进姐姐"。当 Selena 答错时，你的任务是用苏格拉底式提问引导她自己想出来，而不是直接告诉答案。

## 核心原则 - 必须严格执行

1. **绝对不要在第一回合直接给答案**。直接给答案会让 Selena 放弃思考，毁掉学习。
2. 第一回合必须是引导性提问，让她回顾自己的思路。
3. 给答案是最后一步，只在她真的卡住或主动求答时才给。

## 第一回合的回复结构（80-130 字）

① **一句肯定她**（不超过 10 字）："没关系" / "这道题考点确实容易混"

② **一个反思性提问**，让她自己说出当时怎么想的

③ **一个观察线索**（让她去看题目里的关键信息）

④ **鼓励她回答你的问题**："你跟我说说你的想法"

## 后续回合（60-100 字）

- 顺着 Selena 的回应深入：如果她说出了部分正确的思路 → 肯定 + 追问
- 如果她说"不知道" → 给更具体的线索（半步答案）
- 如果她在第 3 回合还想不出 → 揭示答案，但要带上"为什么是这个"的解释
- 任何回合都要保持口语化，不超过 130 字

## 绝对禁忌

- ❌ 不要说"正确答案是 ___"在第一回合
- ❌ 不要列 1/2/3 步骤
- ❌ 不要 Markdown / 编号
- ❌ 不要"作为 AI..."等话头
- ❌ 不要超过 130 字（TTS 念出来超过 30 秒就枯燥）

## 风格

口语，亲切，像比 Selena 大几岁的姐姐。读起来要像聊天，不像讲座。`;

interface TutorRequest {
  subjectId?: "math" | "chinese" | "english";
  stem?: string;
  correctAnswer?: string;
  studentAnswer?: string;
  skillName?: string;
  hint?: string;
  /** v0.36.23: Selena 学情 (弱项 + 当前 skill mastery), 客户端 gatherSnapshot 拼好传 */
  studentContext?: string;
  conversation?: { role: "assistant" | "user"; content: string }[];
}

interface Provider {
  label: "token-plan-cn" | "bailian";
  baseUrl: string;
  apiKey: string;
}

function getProviders(env: Env): Provider[] {
  const ps: Provider[] = [];
  if (env.TOKEN_PLAN_CN_API_KEY) {
    ps.push({
      label: "token-plan-cn",
      baseUrl: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
      apiKey: env.TOKEN_PLAN_CN_API_KEY,
    });
  }
  if (env.BAILIAN_API_KEY) {
    ps.push({
      label: "bailian",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: env.BAILIAN_API_KEY,
    });
  }
  return ps;
}

// v0.36.10 (爸爸 P0 perf audit): qwen3.6-flash 0.32s + deepseek-v4-flash 0.96s
// 兜底, 比之前 [flash, plus] 更快 fallback.
const MODELS = ["qwen3.6-flash", "deepseek-v4-flash", "qwen3.6-plus"];

// v0.36.23 (爸爸 prompt review): 加英语学科 + Selena 学情注入.
function buildSystemPrompt(subjectId: string, skillName?: string, studentContext?: string): string {
  const subjLabel = subjectId === "chinese" ? "语文" : subjectId === "english" ? "英语" : "数学";
  const skillLine = skillName ? `\n\n这道题考的是「${skillName}」。` : "";
  // 学情注入: 客户端拉的弱项 + 当前 skill mastery (让讲题更针对她薄弱处)
  const ctxLine = studentContext ? `\n\n${studentContext}` : "";
  return `${TUTOR_TEXT_SYSTEM}\n\n你正在引导 Selena 思考${subjLabel}题。${skillLine}${ctxLine}`;
}

function buildUserMessage(args: TutorRequest): string {
  const parts: string[] = [];
  parts.push(`题目：${args.stem ?? ""}`);
  parts.push(`参考答案（你心里知道，但不要直接说出来）：${args.correctAnswer ?? ""}`);
  if (args.studentAnswer) parts.push(`Selena 这次的回答：${args.studentAnswer}`);
  if (args.hint) parts.push(`需要重点引导的方向：${args.hint}`);
  parts.push(
    "\n现在用苏格拉底式提问开始引导她思考。第一回合必须是问她「你当时是怎么想的」或者一个让她注意到关键线索的问题，绝对不能直接告诉答案。",
  );
  return parts.join("\n");
}

async function callChat(
  p: Provider,
  model: string,
  messages: { role: string; content: string }[],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<{ ok: true; text: string } | { ok: false; status: number; code: string; message: string }> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 9_500);
    const r = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts?.temperature ?? 0.6,
        max_tokens: opts?.maxTokens ?? 350,
        enable_thinking: false,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    let json: { choices?: { message?: { content?: string } }[]; error?: { code?: string; message?: string } };
    try {
      json = await r.json();
    } catch {
      return { ok: false, status: r.status, code: "non_json", message: "non-JSON" };
    }
    if (!r.ok || json.error) {
      return {
        ok: false,
        status: r.status,
        code: json.error?.code ?? "http_error",
        message: json.error?.message ?? `upstream ${r.status}`,
      };
    }
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false, status: 200, code: "empty_response", message: "no text" };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, status: 0, code: "fetch_failed", message: (e as Error).message };
  }
}

tutor.use("*", requireAuth);

/** POST /api/tutor/explain — 苏格拉底式引导讲题 */
tutor.post("/explain", async (c) => {
  const providers = getProviders(c.env);
  if (providers.length === 0) {
    return c.json({ ok: false, error: "tutor_not_configured" }, 503);
  }

  let body: TutorRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.stem || !body.correctAnswer) {
    return c.json({ ok: false, error: "missing_stem_or_answer" }, 400);
  }

  const systemPrompt = buildSystemPrompt(body.subjectId ?? "math", body.skillName, body.studentContext);
  const messages: { role: string; content: string }[] = [{ role: "system", content: systemPrompt }];
  if (Array.isArray(body.conversation) && body.conversation.length > 0) {
    for (const m of body.conversation) {
      if (m.role === "assistant" || m.role === "user") {
        messages.push({ role: m.role, content: m.content });
      }
    }
  } else {
    messages.push({ role: "user", content: buildUserMessage(body) });
  }

  const tried: Array<{ provider: string; model: string; code: string; message: string }> = [];
  for (const p of providers) {
    for (const m of MODELS) {
      const r = await callChat(p, m, messages);
      if (r.ok) {
        return c.json({
          ok: true,
          explanation: r.text,
          model: m,
          provider: p.label,
        });
      }
      tried.push({ provider: p.label, model: m, code: r.code, message: r.message?.slice(0, 100) ?? "" });
      if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
    }
  }

  console.error("[tutor/explain] all failed", tried);
  return c.json(
    {
      ok: false,
      error: "no_model_worked",
      detail: tried.slice(0, 6).map((t) => `${t.provider}/${t.model}:${t.code}`).join(", "),
      tried,
    },
    502,
  );
});

/**
 * POST /api/tutor/essay-prompt — 生成一道小学作文练习题 (C7 自由作文 cluster).
 *
 * 跟 /explain 区别: explain 是苏格拉底式"引导错题", system prompt 框死了导师人格,
 * 拿来出题会被当成"学生答错"来引导 (实测返回引导语而非题目). 这里用纯出题 system
 * prompt, temperature 0.9 求变化, 严格 "题目｜提示｜难度" 三段格式让客户端好解析.
 */
tutor.post("/essay-prompt", async (c) => {
  const providers = getProviders(c.env);
  if (providers.length === 0) {
    return c.json({ ok: false, error: "tutor_not_configured" }, 503);
  }
  let body: { grade?: number; theme?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    /* 允许空 body */
  }
  const grade = body.grade ?? 4;
  const theme = (body.theme ?? "").trim();

  const sys =
    `你是小学语文老师，专门给${grade}年级学生出作文练习题。只输出一道题，` +
    `严格用这个格式（全角竖线｜分隔三段，不要任何多余文字、解释、引号或换行）：\n` +
    `题目｜写作提示｜难度\n` +
    `要求：题目贴近${grade}年级学生生活（写人/写事/写景/状物/想象/看图写话/续写 任选一种）；` +
    `写作提示在25字内给出具体写作方法；难度只能填「片段」或「成篇」（片段=2~3句，成篇=50字以上）。\n` +
    `示例：描写一场夏天的雷雨｜先写天色变化再写声音，用上比喻｜片段`;
  const userMsg = theme
    ? `请围绕主题「${theme}」出一道作文题。`
    : "请出一道新颖、不落俗套的作文题。";

  const messages = [
    { role: "system", content: sys },
    { role: "user", content: userMsg },
  ];

  const tried: Array<{ provider: string; model: string; code: string }> = [];
  for (const p of providers) {
    for (const m of MODELS) {
      const r = await callChat(p, m, messages, { temperature: 0.9, maxTokens: 120 });
      if (r.ok) {
        return c.json({ ok: true, prompt: r.text, model: m, provider: p.label });
      }
      tried.push({ provider: p.label, model: m, code: r.code });
      if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
    }
  }
  console.error("[tutor/essay-prompt] all failed", tried);
  return c.json({ ok: false, error: "no_model_worked", tried }, 502);
});

/**
 * v0.34.66 (Ep47) /api/tutor/judge-handwriting fast-path native + 兜底 proxy.
 *
 * 历史:
 *   Ep37 (2026-05-17): 试 qwen3.6-plus 视觉模型走 native, 单 call 12-18s 远超
 *     ESA 11s gateway 硬限, 100% 504 → 完全 revert 走 proxy fallback.
 *
 * 本 ep 思路:
 *   不要"全部 native"也不要"全部 fallback"。试 **fast path** — 只调 qwen-vl-plus
 *   (轻量视觉, ~5-9s 对小 canvas 图), abort timer 9000ms (ESA 留 2s buffer 返响应).
 *   - fast 成功 → 直接 native 返, 省一跳 (CF Pages → token-plan → CF Pages → ESA → client)
 *   - fast 失败 (abort / 503 / json 解析失败) → 自动 fall through 到 proxy fallback,
 *     CF Pages 仍可用 (25s budget). 客户端不感知, 体验不退步.
 *
 *   每条请求 console.log 走的是 fast 还是 fallback, admin 跟 routine logs 观察
 *   命中率。如果 fast 占大头 (e.g. ≥80%) 后续可以全 native 关 CF Pages.
 */
const HW_SYSTEM_PROMPT = `你是一个温柔耐心的小学语文老师助手"小进"。
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

interface JudgeHwBody {
  targetChar?: string;
  pinyin?: string;
  imageBase64?: string;
  imageMime?: string;
}

interface JudgeHwResult {
  isCorrect: boolean;
  confidence: "high" | "medium" | "low";
  observed?: string;
  comment?: string;
}

function extractHwJson(content: string): JudgeHwResult | null {
  let cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const a = cleaned.indexOf("{");
  const b = cleaned.lastIndexOf("}");
  if (a >= 0 && b > a) cleaned = cleaned.slice(a, b + 1);
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (typeof parsed.isCorrect !== "boolean") return null;
    const conf = parsed.confidence;
    return {
      isCorrect: parsed.isCorrect,
      confidence:
        conf === "high" || conf === "medium" || conf === "low" ? conf : "medium",
      observed: typeof parsed.observed === "string" ? parsed.observed : undefined,
      comment: typeof parsed.comment === "string" ? parsed.comment : undefined,
    };
  } catch {
    return null;
  }
}

const HW_FAST_TIMEOUT_MS = 9_000;

/**
 * 重建一个带原 body 的 Request 给 proxyFallback。
 * 原 c.req.raw 的 body 已经在解析 JSON 时被消费了 (ReadableStream 一次性),
 * 直接传给 proxyFallback 会 forward empty body → CF Pages 500.
 */
function rebuildRequest(originalReq: Request, bodyBytes: ArrayBuffer): Request {
  const headers = new Headers();
  originalReq.headers.forEach((v, k) => {
    headers.set(k, v);
  });
  return new Request(originalReq.url, {
    method: originalReq.method,
    headers,
    body: bodyBytes,
  });
}

/** 给 fallback 响应包一层 X-Native-Reason 头, 方便 curl -i 看 native 为啥放弃 */
async function fallbackWithReason(
  reason: string,
  originalReq: Request,
  bodyBytes: ArrayBuffer,
  env: Env,
): Promise<Response> {
  const resp = await proxyFallback.fetch(rebuildRequest(originalReq, bodyBytes), env);
  const headers = new Headers(resp.headers);
  headers.set("X-Native-Reason", reason.slice(0, 200));
  return new Response(resp.body, { status: resp.status, headers });
}

tutor.post("/judge-handwriting", async (c) => {
  // 关键：先读原始 bytes 一次, 再 parse JSON。
  // 之后 fallback 时 rebuildRequest(原 url + headers + 这个 bytes) 给 proxyFallback。
  let bodyBytes: ArrayBuffer;
  try {
    bodyBytes = await c.req.raw.arrayBuffer();
  } catch {
    return c.json({ ok: false, error: "body_read_failed" }, 400);
  }
  let body: JudgeHwBody;
  try {
    const text = new TextDecoder().decode(bodyBytes);
    body = JSON.parse(text) as JudgeHwBody;
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  const fallback = (reason: string) => fallbackWithReason(reason, c.req.raw, bodyBytes, c.env);
  const targetChar = (body.targetChar ?? "").trim();
  const imageBase64 = (body.imageBase64 ?? "").trim();
  if (!targetChar) return c.json({ ok: false, error: "missing_target_char" }, 400);
  if (!imageBase64) return c.json({ ok: false, error: "missing_image" }, 400);
  if (imageBase64.length > 700_000) return c.json({ ok: false, error: "image_too_large" }, 413);
  const mime = body.imageMime ?? "image/png";
  const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:${mime};base64,${imageBase64}`;

  // 视觉调用必须走 DashScope **native** multimodal endpoint (compatible-mode
  // /chat/completions 在 dashscope.cn 上无 qwen-vl-* 暴露; ep47 v0.1 验证).
  // native: POST /api/v1/services/aigc/multimodal-generation/generation
  const fastProvider = c.env.BAILIAN_API_KEY
    ? {
        baseUrl: "https://dashscope.aliyuncs.com",
        apiKey: c.env.BAILIAN_API_KEY,
        label: "bailian" as const,
      }
    : null;
  if (!fastProvider) {
    console.warn("[judge-handwriting] no BAILIAN_API_KEY → fall back to proxy");
    return fallback("no_bailian_key");
  }

  const t0 = Date.now();
  const userText = `目标字：${targetChar}${body.pinyin ? `（拼音：${body.pinyin}）` : ""}\n\n请看图判断学生写的是不是这个字。返回 JSON。`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HW_FAST_TIMEOUT_MS);
  try {
    const resp = await fetch(
      `${fastProvider.baseUrl}/api/v1/services/aigc/multimodal-generation/generation`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${fastProvider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen-vl-max-latest",
          input: {
            messages: [
              { role: "system", content: [{ text: HW_SYSTEM_PROMPT }] },
              {
                role: "user",
                content: [
                  { image: dataUrl },
                  { text: userText },
                ],
              },
            ],
          },
          parameters: { temperature: 0.2, max_tokens: 200 },
        }),
        signal: ctrl.signal,
      },
    );
    clearTimeout(timer);
    const elapsed = Date.now() - t0;
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.warn(`[judge-handwriting] fast non-ok status=${resp.status} in ${elapsed}ms detail=${errText.slice(0, 120)} → fallback`);
      return fallback(`native_status_${resp.status}_${elapsed}ms`);
    }
    const json = (await resp.json().catch(() => null)) as
      | { output?: { choices?: { message?: { content?: Array<{ text?: string }> | string } }[] }; code?: string; message?: string }
      | null;
    // DashScope native response: output.choices[0].message.content 可能是 string 或 [{text:"..."}]
    const msg = json?.output?.choices?.[0]?.message?.content;
    const content = typeof msg === "string"
      ? msg
      : Array.isArray(msg)
        ? msg.map((m) => m.text ?? "").join("")
        : "";
    if (!content) {
      console.warn(`[judge-handwriting] fast empty content in ${elapsed}ms → fallback`);
      return fallback(`native_empty_content_${elapsed}ms`);
    }
    const parsed = extractHwJson(content);
    if (!parsed) {
      console.warn(`[judge-handwriting] fast parse failed in ${elapsed}ms → fallback. content=${content.slice(0, 80)}`);
      return fallback(`native_parse_failed_${elapsed}ms`);
    }
    console.log(`[judge-handwriting] fast ok in ${elapsed}ms target='${targetChar}' observed='${parsed.observed ?? ""}'`);
    return c.json({
      ok: true,
      ...parsed,
      model: "qwen-vl-max-latest",
      provider: fastProvider.label,
      path: "fast", // 客户端可以读这个字段做命中率统计
    });
  } catch (e) {
    clearTimeout(timer);
    const elapsed = Date.now() - t0;
    const isAbort = (e as Error)?.name === "AbortError";
    console.warn(
      `[judge-handwriting] fast ${isAbort ? "timeout" : "error"} in ${elapsed}ms → fallback. msg=${(e as Error).message?.slice(0, 80) ?? ""}`,
    );
    return fallback(`native_${isAbort ? "timeout" : "error"}_${elapsed}ms`);
  }
});

/**
 * POST /api/tutor/voice — 近实时语音对话 (v0.36.22, 爸爸同意按量付费恢复).
 *
 * Selena 按住麦克风说话 → 客户端 base64 音频上来 → omni 多模态 (audio+text in,
 * text out) → 返文本, 客户端 TTS 朗读. 整个回路 ~12-18s.
 *
 * omni 走 BAILIAN (dashscope cn-hangzhou, token-plan 不提供 omni). 实测
 * qwen3.5-omni-flash + qwen-omni-turbo 现在 HTTP 200 可用 (之前 403 无权).
 * 之前走 CF proxy, 删 CF 后改 ESA native.
 */
const VOICE_SYSTEM_PROMPT = `你是 Selena（4 年级女生）的语音老师"小进姐姐"。Selena 用语音问你问题，你用亲切、口语化的中文回答，60-120 字，像大姐姐一样温暖鼓励。引导她自己思考，不要直接报答案，除非她真的卡住或主动求答。语气活泼，多用"我们一起看看""你再想想"这类话。`;

const OMNI_MODELS = ["qwen3.5-omni-flash", "qwen-omni-turbo"];

function mimeToFormat(mime?: string): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("opus")) return "opus";
  if (m.includes("wav")) return "wav";
  if (m.includes("mp3") || m.includes("mpeg")) return "mp3";
  if (m.includes("m4a") || m.includes("mp4")) return "m4a";
  return "webm";
}

type OmniContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "input_audio"; input_audio: { data: string; format: string } }
    >;
interface OmniMsg { role: string; content: OmniContent }

tutor.post("/voice", async (c) => {
  const apiKey = c.env.BAILIAN_API_KEY;
  if (!apiKey) return c.json({ ok: false, error: "voice_not_configured" }, 503);

  let body: {
    audioBase64?: string;
    mimeType?: string;
    subjectId?: string;
    questionContext?: { stem?: string; correctAnswer?: string; skillName?: string };
    studentContext?: string;
    conversation?: { role: string; content: string }[];
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.audioBase64) return c.json({ ok: false, error: "missing_audio" }, 400);

  // 题目上下文注入 system
  let systemContent = VOICE_SYSTEM_PROMPT;
  const ctx = body.questionContext;
  if (ctx) {
    const lines = ["（当前 Selena 在做的题：）"];
    if (ctx.stem) lines.push(`题目：${ctx.stem}`);
    if (ctx.correctAnswer) lines.push(`正确答案：${ctx.correctAnswer}`);
    if (ctx.skillName) lines.push(`技能点：${ctx.skillName}`);
    systemContent += "\n\n" + lines.join("\n");
  }
  // v0.36.24: Selena 学情注入 (弱项+错题, 跟 explain/realtime 一致)
  if (body.studentContext) {
    systemContent += "\n\n" + body.studentContext;
  }

  const messages: OmniMsg[] = [{ role: "system", content: systemContent }];
  if (Array.isArray(body.conversation)) {
    for (const m of body.conversation) {
      if (m.role === "assistant" || m.role === "user") {
        messages.push({ role: m.role, content: m.content });
      }
    }
  }
  // v0.36.22: omni 要 data URI 格式 (data:audio/<fmt>;base64,) — 裸 base64 报
  // "provided URL not valid". 实测确认.
  const fmt = mimeToFormat(body.mimeType);
  const dataUri = `data:audio/${fmt};base64,${body.audioBase64}`;
  messages.push({
    role: "user",
    content: [
      { type: "input_audio", input_audio: { data: dataUri, format: fmt } },
      { type: "text", text: "请听我刚才的语音问题，用 60-120 字亲切地回答我。" },
    ],
  });

  const tried: { model: string; code: string }[] = [];
  for (const model of OMNI_MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 28_000);
    try {
      // v0.36.22: omni 要 stream:true (非流式报 invalid_parameter). 解析 SSE 累积 content.
      const r = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, modalities: ["text"], stream: true, temperature: 0.7, max_tokens: 280 }),
        signal: ctrl.signal,
      });
      if (!r.ok || !r.body) {
        const errJson = (await r.json().catch(() => null)) as { error?: { code?: string } } | null;
        tried.push({ model, code: errJson?.error?.code ?? `http_${r.status}` });
        clearTimeout(timer);
        continue;
      }
      // 解析 SSE 流: data: {...delta.content...}
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      let buf = "";
      let sawError: string | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (payload === "[DONE]" || !payload) continue;
          try {
            const chunk = JSON.parse(payload) as {
              choices?: { delta?: { content?: string } }[];
              error?: { code?: string };
            };
            if (chunk.error) { sawError = chunk.error.code ?? "stream_error"; continue; }
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) reply += delta;
          } catch { /* 跳过非 JSON 行 */ }
        }
      }
      clearTimeout(timer);
      if (sawError) { tried.push({ model, code: sawError }); continue; }
      reply = reply.trim();
      if (!reply) { tried.push({ model, code: "empty_response" }); continue; }
      return c.json({ ok: true, reply, model });
    } catch (e) {
      clearTimeout(timer);
      tried.push({ model, code: (e as Error)?.name === "AbortError" ? "timeout" : "fetch_error" });
    }
  }
  console.error("[tutor/voice] all omni failed", tried);
  return c.json({ ok: false, error: "no_model_worked", detail: tried.map((t) => `${t.model}:${t.code}`).join(", ") }, 502);
});

// 其他 tutor/* 未 native 路径 → 501 (CF 已删)
tutor.all("*", async (c) => {
  return proxyFallback.fetch(c.req.raw, c.env);
});

export default tutor;
