import { checkAuth, corsHeaders, jsonResponse, type Env } from "../../_shared";

/**
 * POST /api/generate/questions
 *
 * 用 qwen-plus 按 Selena 当前的薄弱情况自动生成新题，去重 / 难度梯度由 prompt
 * 控制。返回到客户端后，客户端再用 validateQuestion 校验 + 写入 db.questions。
 *
 * 输入 body:
 *   {
 *     subjectId: "chinese",            // 暂时只支持 chinese
 *     unitId: "C4B_U2_SCIENCE",        // 单元 id
 *     unitName: "第二单元 · 科学之光",  // 单元名（让 AI 知道主题）
 *     skillId: "C4B_U2_VOCAB",         // 技能 id
 *     skillName: "科技词语 / 形近字辨析",
 *     count: 5,                        // 生成多少题（1-10）
 *     difficulty: "2-4",               // 难度范围
 *     existingStems?: string[],        // 现有题的题干前缀，让 AI 避免重复
 *     recentMistakeStems?: string[],   // 最近错题题干，AI 可侧重这些
 *   }
 *
 * 输出:
 *   { ok: true, questions: Question[], model: string, raw?: string }
 *   或 { ok: false, error, detail? }
 */

interface GenerateRequest {
  subjectId?: string;
  unitId?: string;
  unitName?: string;
  skillId?: string;
  skillName?: string;
  count?: number;
  difficulty?: string;
  existingStems?: string[];
  recentMistakeStems?: string[];
  /** 可选：让 AI 输出哪种题型（plain_choice / pair_match / sentence_shuffle / poem_cloze） */
  gameType?: string;
}

const SYSTEM_PROMPT = `你是 Selena（4 年级女生，人教版四下）的语文出题助手。你必须严格输出 JSON 数组，每个对象都符合下面给的题目模板。

题目质量要求：
1. 内容必须符合人教版四年级下册大纲（不能超纲到五年级以上）
2. 题面（stem）写在题目内，不要"请选择"等多余前缀
3. 4 个选项（id 用 "A" "B" "C" "D"），其中一个正确，三个干扰项必须看似合理但能讲出错因
4. feedback_correct 用一句话解释为什么对（含知识点要点）
5. feedback_wrong 用一句话给学习方向，不要批评
6. solution_steps 给 1-2 步思路文字
7. 必须有 common_errors，至少 2 项（tag + error + remediation）
8. 不重复给定的 existingStems 题干（要换不同语境 / 例字）
9. difficulty 1-5：1=送分，3=单元中等，5=拔高
10. 内容安全：不出现真实姓名、广告、负面词（"笨"等）

输出格式：必须是纯 JSON 数组，不要 markdown 代码块标记，不要解释文字。`;

interface QwenChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { code?: string; message?: string };
}

async function callQwenChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
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
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 4000,
        // 强制 JSON 输出
        response_format: { type: "json_object" },
      }),
    },
  );
  let json: QwenChatResponse | null = null;
  try {
    json = (await upstream.json()) as QwenChatResponse;
  } catch {
    return { ok: false, status: upstream.status, code: "non_json", message: "upstream non-JSON" };
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
  if (!text) return { ok: false, status: 200, code: "empty_response", message: "empty content" };
  return { ok: true, text };
}

/** 从 LLM 文本里安全抓出 JSON 数组（容忍 ```json 包裹和零碎换行）。 */
function extractJsonArray(text: string): unknown[] | null {
  let cleaned = text.trim();
  // 去掉 markdown code block
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  // 如果是对象包裹（response_format=json_object 时），找数组字段
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      // 找第一个数组值
      for (const v of Object.values(parsed)) {
        if (Array.isArray(v)) return v;
      }
    }
    return null;
  } catch {
    // 容错：找 [ ... ] 子串
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (!m) return null;
    try {
      const arr = JSON.parse(m[0]);
      return Array.isArray(arr) ? arr : null;
    } catch {
      return null;
    }
  }
}

function buildUserPrompt(args: GenerateRequest): string {
  const count = Math.max(1, Math.min(10, args.count ?? 5));
  const lines: string[] = [];
  lines.push(`请生成 ${count} 道语文题：`);
  lines.push(`- 单元：${args.unitName ?? args.unitId} (id: ${args.unitId})`);
  lines.push(`- 技能点：${args.skillName ?? args.skillId} (id: ${args.skillId})`);
  lines.push(`- 难度范围：${args.difficulty ?? "2-4"}`);
  lines.push(`- 题型：plain_choice（4 选 1 单选）`);
  if (args.existingStems && args.existingStems.length > 0) {
    lines.push(`\n以下题干已有，请勿重复同样的语境（可换字 / 换情境 / 换例句）：`);
    for (const s of args.existingStems.slice(0, 30)) {
      lines.push(`- ${s.slice(0, 50)}`);
    }
  }
  if (args.recentMistakeStems && args.recentMistakeStems.length > 0) {
    lines.push(`\nSelena 最近答错过这些类型的题（请围绕同样的考点出新题加练）：`);
    for (const s of args.recentMistakeStems.slice(0, 10)) {
      lines.push(`- ${s.slice(0, 50)}`);
    }
  }
  lines.push(`\n严格按照下面的字段结构输出 JSON 数组，question_id 全部以 "AI_${args.skillId}_" 开头加 6 位时间戳后缀，唯一即可：

{
  "questions": [
    {
      "question_id": "AI_${args.skillId}_001",
      "subjectId": "chinese",
      "version": 1,
      "status": "approved",
      "grade": 4,
      "term": "下册",
      "unit_id": "${args.unitId}",
      "unit_name": "${args.unitName ?? ""}",
      "skill_id": "${args.skillId}",
      "skill_name": "${args.skillName ?? ""}",
      "ability_dimension": ["vocabulary"],
      "exam_priority": "HIGH_BIG",
      "game_type": "plain_choice",
      "play_as": "plain_choice",
      "cognitive_level": "conceptual",
      "difficulty": 3,
      "estimated_time_seconds": 25,
      "stem": "题目题面",
      "question_format": "single_choice",
      "options": [
        { "id": "A", "text": "选项 A 内容" },
        { "id": "B", "text": "选项 B 内容" },
        { "id": "C", "text": "选项 C 内容" },
        { "id": "D", "text": "选项 D 内容" }
      ],
      "answer": { "type": "choice", "value": "A" },
      "solution_steps": ["分析步骤 1"],
      "common_errors": [
        { "tag": "wrong_phonics", "error": "学生可能这样错", "remediation": "怎样纠正" }
      ],
      "feedback_correct": "对的解释",
      "feedback_wrong": "错的提示，鼓励为主",
      "hints": [{ "text": "提示一", "penalty": 1 }],
      "tags": ["ai_generated"]
    }
  ]
}

请直接输出顶层为 { "questions": [...] } 的 JSON。`);
  return lines.join("\n");
}

/** 简单 schema 校验，确保关键字段都在（前端会再 validateQuestion 一次） */
function isValidQuestionShape(q: unknown): boolean {
  if (!q || typeof q !== "object") return false;
  const o = q as Record<string, unknown>;
  if (typeof o.question_id !== "string" || !o.question_id) return false;
  if (typeof o.stem !== "string" || !o.stem) return false;
  if (!Array.isArray(o.options) || o.options.length < 2) return false;
  if (!o.answer || typeof o.answer !== "object") return false;
  return true;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  if (!env.DASHSCOPE_API_KEY) {
    return jsonResponse({ ok: false, error: "generator_not_configured" }, 503);
  }

  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.unitId || !body.skillId) {
    return jsonResponse({ ok: false, error: "missing_unitId_or_skillId" }, 400);
  }
  if (body.subjectId && body.subjectId !== "chinese") {
    return jsonResponse(
      { ok: false, error: "only_chinese_supported_currently" },
      400,
    );
  }

  const userPrompt = buildUserPrompt(body);

  const models = ["qwen-plus", "qwen-flash", "qwen-turbo"];
  const tried: { model: string; status: number; code: string; message: string }[] = [];
  for (const m of models) {
    const r = await callQwenChat(env.DASHSCOPE_API_KEY, m, SYSTEM_PROMPT, userPrompt);
    if (!r.ok) {
      tried.push({ model: m, status: r.status, code: r.code, message: r.message });
      if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
      continue;
    }
    const arr = extractJsonArray(r.text);
    if (!arr) {
      tried.push({
        model: m,
        status: 200,
        code: "json_parse_failed",
        message: r.text.slice(0, 200),
      });
      continue;
    }
    const valid = arr.filter(isValidQuestionShape);
    if (valid.length === 0) {
      tried.push({
        model: m,
        status: 200,
        code: "no_valid_questions",
        message: `got ${arr.length} items but none valid`,
      });
      continue;
    }
    // 给每道题加唯一时间戳后缀，避免和已有 question_id 撞
    const stamp = Date.now().toString(36);
    const stamped = valid.map((q, i) => {
      const obj = q as Record<string, unknown>;
      const baseId =
        typeof obj.question_id === "string"
          ? obj.question_id
          : `AI_${body.skillId}_${i}`;
      return {
        ...obj,
        question_id: `${baseId}__${stamp}_${i}`,
        subjectId: "chinese",
        tags: Array.isArray(obj.tags)
          ? Array.from(new Set([...(obj.tags as string[]), "ai_generated"]))
          : ["ai_generated"],
      };
    });
    return jsonResponse({
      ok: true,
      questions: stamped,
      model: m,
      generatedCount: stamped.length,
      requestedCount: body.count ?? 5,
    });
  }

  console.error("[generate.questions] all models failed", tried);
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
