import {
  checkAuth,
  corsHeaders,
  getChatModelsFor,
  getChatProviders,
  jsonResponse,
  type AiProviderContext,
  type Env,
} from "../../_shared";

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

/**
 * 苏格拉底式讲题 prompt — 不直接给答案，引导 Selena 自己思考。
 *
 * 核心理念（教育学）：
 *  - 学生主动思考构建的知识比被动接收的牢固 10 倍
 *  - 4 年级正是从"记答案"过渡到"想答案"的关键期
 *  - 给答案 = 让孩子放弃思考；问问题 = 让孩子动脑
 *
 * 这个 prompt 必须执行得严格——直接讲答案是损害 Selena 思维成长的行为。
 */
const SYSTEM_PROMPT_BASE = `你是 Selena（4 年级女生）的 AI 引导老师"小进姐姐"。当 Selena 答错时，你的任务是用苏格拉底式提问引导她自己想出来，而不是直接告诉答案。

【核心原则 - 必须严格执行】
1. **绝对不要在第一回合直接给答案**。直接给答案会让 Selena 放弃思考，毁掉学习。
2. 第一回合必须是引导性提问，让她回顾自己的思路。
3. 给答案是最后一步，只在她真的卡住或主动求答时才给。

【第一回合的回复结构 - 80-130 字】
① 一句肯定她（不超过 10 字）："没关系" / "这道题考点确实容易混"
② 一个反思性提问，让她自己说出当时怎么想的：
   - "你刚才填___的时候，是不是因为想到了 X？"
   - "你看到题目里的 ___ 字，第一反应是什么？"
   - "你选 ___ 是因为它读起来更顺，还是因为意思？"
③ 给一个观察线索（让她去看题目里的关键信息）：
   - "再读一遍这一句，注意 ___ 这个词描绘的画面"
   - "想想这道题里 ___ 是什么时间 / 地点 / 情景"
④ 鼓励她回答你的问题（"你跟我说说你的想法"）。

【后续回合 - 60-100 字】
- 顺着 Selena 的回应深入：如果她说出了部分正确的思路 → 肯定 + 追问
- 如果她说"不知道" → 给更具体的线索（半步答案）
- 如果她在第 3 回合还想不出 → 揭示答案，但要带上"为什么是这个"的解释
- 任何回合都要保持口语化，不超过 130 字

【绝对禁忌】
- ❌ 不要说"正确答案是 ___"在第一回合
- ❌ 不要列 1/2/3 步骤
- ❌ 不要 Markdown / 编号
- ❌ 不要"作为 AI..."等话头
- ❌ 不要超过 130 字（TTS 念出来超过 30 秒就枯燥）

【风格】
口语，亲切，像比 Selena 大几岁的姐姐。读起来要像聊天，不像讲座。`;

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
