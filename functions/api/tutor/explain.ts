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

/**
 * POST /api/tutor/explain
 *
 * 当 Selena 答错一道题，前端调这个端点拿一段 80-150 字的"小进姐姐讲题"文本。
 * 文本回到客户端后，客户端会用 Cherry TTS 朗读。
 *
 * 模型策略：先尝试 qwen-plus（高质量），失败回落到 qwen-turbo（更快）。
 * 国际账号用 dashscope-intl.aliyuncs.com 的 OpenAI 兼容 endpoint。
 *
 * 输入 body:
 *   {
 *     subjectId: "math" | "chinese",
 *     stem: string,          // 题面
 *     correctAnswer: string, // 正确答案的文字描述
 *     studentAnswer: string, // Selena 的答案
 *     skillName?: string,    // 技能名（"古诗补字"）
 *     hint?: string,         // 可选追问，让 AI 更聚焦讲哪一点
 *   }
 *
 * 输出:
 *   { ok: true, explanation: string, model: string }
 *   或 { ok: false, error: string, detail?: string }
 */

interface TutorRequest {
  subjectId?: "math" | "chinese";
  stem?: string;
  correctAnswer?: string;
  studentAnswer?: string;
  skillName?: string;
  hint?: string;
  /** 可选：让 AI 接续上一轮做 follow-up 讲解 */
  conversation?: { role: "assistant" | "user"; content: string }[];
}

// system prompt 从 prompts/tutor/text-system.md 读
const SYSTEM_PROMPT_BASE = PROMPTS.tutorTextSystem;

function buildSystemPrompt(subjectId: string, skillName?: string): string {
  const subjLabel = subjectId === "chinese" ? "语文" : "数学";
  const skillLine = skillName ? `\n\n这道题考的是「${skillName}」。` : "";
  return `${SYSTEM_PROMPT_BASE}\n\n你正在引导 Selena 思考${subjLabel}题。${skillLine}`;
}

function buildUserMessage(args: TutorRequest): string {
  const parts: string[] = [];
  parts.push(`题目：${args.stem ?? ""}`);
  parts.push(`参考答案（你心里知道，但不要直接说出来）：${args.correctAnswer ?? ""}`);
  if (args.studentAnswer) {
    parts.push(`Selena 这次的回答：${args.studentAnswer}`);
  }
  if (args.hint) {
    parts.push(`需要重点引导的方向：${args.hint}`);
  }
  parts.push(
    "\n现在用苏格拉底式提问开始引导她思考。第一回合必须是问她「你当时是怎么想的」或者一个让她注意到关键线索的问题，绝对不能直接告诉答案。",
  );
  return parts.join("\n");
}

interface ChatCompletionsResponse {
  choices?: { message?: { content?: string } }[];
  error?: { code?: string; message?: string };
}

async function callQwenChat(
  ctx: AiProviderContext,
  model: string,
  messages: { role: string; content: string }[],
): Promise<{ ok: true; text: string } | { ok: false; status: number; code: string; message: string }> {
  const upstream = await fetch(
    `${ctx.baseUrl}/compatible-mode/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_tokens: 350,
        // 讲题不需要 reasoning（qwen3.6-plus 默认会先 think，浪费 token + 慢）
        enable_thinking: false,
      }),
    },
  );
  let json: ChatCompletionsResponse | null = null;
  try {
    json = (await upstream.json()) as ChatCompletionsResponse;
  } catch {
    return {
      ok: false,
      status: upstream.status,
      code: "non_json",
      message: "upstream returned non-JSON",
    };
  }
  if (!upstream.ok || json.error) {
    return {
      ok: false,
      status: upstream.status,
      code: json.error?.code ?? "http_error",
      message: json.error?.message ?? `upstream ${upstream.status}`,
    };
  }
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return { ok: false, status: 200, code: "empty_response", message: "no text in response" };
  }
  return { ok: true, text };
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  const providers = getChatProviders(env);
  if (providers.length === 0) {
    return jsonResponse({ ok: false, error: "tutor_not_configured" }, 503);
  }

  let body: TutorRequest;
  try {
    body = (await request.json()) as TutorRequest;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.stem || !body.correctAnswer) {
    return jsonResponse({ ok: false, error: "missing_stem_or_answer" }, 400);
  }

  const systemPrompt = buildSystemPrompt(body.subjectId ?? "chinese", body.skillName);
  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];
  if (Array.isArray(body.conversation) && body.conversation.length > 0) {
    for (const m of body.conversation) {
      if (m.role === "assistant" || m.role === "user") {
        messages.push({ role: m.role, content: m.content });
      }
    }
  } else {
    messages.push({ role: "user", content: buildUserMessage(body) });
  }

  const tried: {
    provider: string;
    model: string;
    status: number;
    code: string;
    message: string;
  }[] = [];

  for (const ctx of providers) {
    const models = getChatModelsFor(ctx);
    for (const m of models) {
      const r = await callQwenChat(ctx, m, messages);
      if (r.ok) {
        return jsonResponse({ ok: true, explanation: r.text, model: m, provider: ctx.label });
      }
      tried.push({
        provider: ctx.label,
        model: m,
        status: r.status,
        code: r.code,
        message: r.message,
      });
      if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
    }
  }
  console.error("[tutor.explain] all providers/models failed", tried);
  return jsonResponse(
    {
      ok: false,
      error: "no_model_worked",
      detail: tried
        .slice(0, 6)
        .map((t) => `${t.provider}/${t.model}:${t.code}`)
        .join(", "),
      tried,
    },
    502,
  );
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
