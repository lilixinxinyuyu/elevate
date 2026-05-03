import { checkAuth, corsHeaders, jsonResponse, type Env } from "../../_shared";

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

const SYSTEM_PROMPT_BASE = `你叫小进姐姐，是 Selena 的私人 AI 学习老师。Selena 是 4 年级女生，上学期数学掌握得不错，这学期开始练习语文期中冲刺。

你的讲题原则：
1. 永远先肯定 Selena："没关系" / "我也常错这个" 等开头一句
2. 用 80-150 个汉字，绝对不要超过 200 字（小学生的注意力窗口）
3. 三段式：① 错在哪（一句话）② 正确思路（两到三句，配一个小诀窍 / 比喻）③ 一句易记口诀
4. 语气像比她大几岁的姐姐，不要"作为AI..."这种话头
5. 不要使用 Markdown / 编号符号，纯口语，让 TTS 念出来自然
6. 如果是古诗 / 文学题，可以适当带上文化背景（"杜甫这首诗写在..."）但不超过 1 句
7. 讲完结束，不要问"还有什么要问吗"——下面有按钮让她自己点继续问`;

function buildSystemPrompt(subjectId: string, skillName?: string): string {
  const subjLabel = subjectId === "chinese" ? "语文" : "数学";
  const skillLine = skillName ? `\n这道题考的是「${skillName}」。` : "";
  return `${SYSTEM_PROMPT_BASE}\n\n现在你要讲解的是${subjLabel}题。${skillLine}`;
}

function buildUserMessage(args: TutorRequest): string {
  const parts: string[] = [];
  parts.push(`题目：${args.stem ?? ""}`);
  parts.push(`正确答案：${args.correctAnswer ?? ""}`);
  if (args.studentAnswer) {
    parts.push(`Selena 写的是：${args.studentAnswer}`);
  }
  if (args.hint) {
    parts.push(`重点解释：${args.hint}`);
  }
  parts.push("请讲一讲这道题。");
  return parts.join("\n");
}

interface ChatCompletionsResponse {
  choices?: { message?: { content?: string } }[];
  error?: { code?: string; message?: string };
}

async function callQwenChat(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
): Promise<{ ok: true; text: string } | { ok: false; status: number; code: string; message: string }> {
  const upstream = await fetch(
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_tokens: 350,
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
  if (!env.DASHSCOPE_API_KEY) {
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
  // 历史对话（多轮 follow-up）
  if (Array.isArray(body.conversation) && body.conversation.length > 0) {
    for (const m of body.conversation) {
      if (m.role === "assistant" || m.role === "user") {
        messages.push({ role: m.role, content: m.content });
      }
    }
  } else {
    messages.push({ role: "user", content: buildUserMessage(body) });
  }

  // 模型 fallback 链：plus → flash → turbo
  const models = ["qwen-plus", "qwen-flash", "qwen-turbo"];
  const tried: { model: string; status: number; code: string; message: string }[] = [];
  for (const m of models) {
    const r = await callQwenChat(env.DASHSCOPE_API_KEY, m, messages);
    if (r.ok) {
      return jsonResponse({ ok: true, explanation: r.text, model: m });
    }
    tried.push({ model: m, status: r.status, code: r.code, message: r.message });
    // 鉴权类错误直接停
    if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
  }
  console.error("[tutor.explain] all models failed", tried);
  return jsonResponse(
    {
      ok: false,
      error: "no_model_worked",
      detail: tried.map((t) => `${t.model}:${t.code}`).join(", "),
      tried,
    },
    502,
  );
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
