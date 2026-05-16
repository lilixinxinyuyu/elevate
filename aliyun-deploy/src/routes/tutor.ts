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
  subjectId?: "math" | "chinese";
  stem?: string;
  correctAnswer?: string;
  studentAnswer?: string;
  skillName?: string;
  hint?: string;
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

const MODELS = ["qwen3.6-flash", "qwen3.6-plus"];

function buildSystemPrompt(subjectId: string, skillName?: string): string {
  const subjLabel = subjectId === "chinese" ? "语文" : "数学";
  const skillLine = skillName ? `\n\n这道题考的是「${skillName}」。` : "";
  return `${TUTOR_TEXT_SYSTEM}\n\n你正在引导 Selena 思考${subjLabel}题。${skillLine}`;
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
        temperature: 0.6,
        max_tokens: 350,
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

  const systemPrompt = buildSystemPrompt(body.subjectId ?? "math", body.skillName);
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

// voice + judge-handwriting 暂走 proxy-fallback (复杂度高，下个 ep)
tutor.all("*", async (c) => {
  return proxyFallback.fetch(c.req.raw, c.env);
});

export default tutor;
