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
  subjectId?: "math" | "chinese";
  unitId?: string;
  unitName?: string;
  skillId?: string;
  skillName?: string;
  count?: number;
  difficulty?: string;
  /** "上册" / "下册"，让 AI 知道是 G4A 还是 G4B */
  term?: "上册" | "下册";
  existingStems?: string[];
  recentMistakeStems?: string[];
  /** 可选：让 AI 输出哪种题型（plain_choice / pair_match / sentence_shuffle / poem_cloze） */
  gameType?: string;
}

function buildSystemPrompt(subjectId: string): string {
  const subjLabel = subjectId === "math" ? "数学" : "语文";
  const dictionary =
    subjectId === "math"
      ? "（北师大版四年级下册：小数 / 方程 / 三角形 / 立体观察 / 平均数等单元；不要超纲到五年级如比例、函数）"
      : "（人教版四年级下册：1-4单元字音字形 / 古诗 / 修辞 / 听写词语 / 阅读）";
  return `你是 Selena（4 年级女生）的${subjLabel}出题助手。${dictionary}

你必须严格输出 JSON 数组，每个对象都符合下面给的题目模板。

题目质量要求：
1. 内容必须符合 4 年级下册大纲（不能超纲）
2. 题面（stem）写在题目内，不要"请选择"等多余前缀
3. 4 个选项（id 用 "A" "B" "C" "D"），其中一个正确，三个干扰项必须看似合理但能讲出错因
4. feedback_correct 用一句话解释为什么对（含知识点要点）
5. feedback_wrong 用一句话给学习方向，不要批评（不要用"笨"等负面词）
6. solution_steps 给 1-2 步思路文字
7. 必须有 common_errors，至少 2 项（tag + error + remediation）
8. 不重复给定的 existingStems 题干（要换不同语境 / 例字 / 数字）
9. difficulty 1-5：1=送分，3=单元中等，5=拔高
10. 内容安全：不出现真实姓名、广告、付费、负面词

输出格式：必须输出顶层 { "questions": [...] } 的 JSON 对象，不要 markdown 代码块标记，不要解释文字。`;
}

interface QwenChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { code?: string; message?: string };
}

async function callQwenChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  withJsonFormat = true,
): Promise<{ ok: true; text: string } | { ok: false; status: number; code: string; message: string }> {
  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  };
  if (withJsonFormat) {
    requestBody.response_format = { type: "json_object" };
  }
  const upstream = await fetch(
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    },
  );
  let json: QwenChatResponse | null = null;
  try {
    json = (await upstream.json()) as QwenChatResponse;
  } catch {
    return { ok: false, status: upstream.status, code: "non_json", message: "upstream non-JSON" };
  }
  if (!upstream.ok || json.error) {
    // 部分模型不支持 response_format → 自动重试一次不带这个字段
    const errMsg = `${json.error?.code ?? ""} ${json.error?.message ?? ""}`;
    if (
      withJsonFormat &&
      /response_format|json_object|not.*support|unrecognized|invalid.*parameter/i.test(
        errMsg,
      )
    ) {
      return await callQwenChat(apiKey, model, systemPrompt, userPrompt, false);
    }
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

/**
 * 从 LLM 文本里安全抓 JSON 数组。
 * 优先级：
 *   1. 直接 JSON.parse（response_format=json_object 时一般可以）
 *   2. 顶层对象 → 找值是数组的字段（key="questions" 等）
 *   3. 去 markdown ``` 包裹再试
 *   4. 用 brace-counting 找最大 { ... } JSON 子串
 *   5. 找最大 [ ... ] JSON 数组子串
 *   6. 修正常见错误（trailing comma、单引号）后再试
 */
function extractJsonArray(text: string): unknown[] | null {
  if (!text) return null;

  const tryParseTopLevel = (s: string): unknown[] | null => {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") {
        // 找第一个值是数组的字段（如 questions: [...]）
        for (const v of Object.values(parsed)) {
          if (Array.isArray(v)) return v;
        }
      }
    } catch {
      /* fallthrough */
    }
    return null;
  };

  // 1. 直接试
  let cleaned = text.trim();
  let r = tryParseTopLevel(cleaned);
  if (r) return r;

  // 2. 去 markdown code block
  cleaned = cleaned
    .replace(/^```(?:json|JSON)?\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
  r = tryParseTopLevel(cleaned);
  if (r) return r;

  // 3. 用 brace-count 找最大对象（容忍前后有解释文字）
  const findBalanced = (s: string, open: string, close: string): string | null => {
    const startIdx = s.indexOf(open);
    if (startIdx < 0) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = startIdx; i < s.length; i++) {
      const ch = s[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return s.substring(startIdx, i + 1);
      }
    }
    return null;
  };

  const objSubstr = findBalanced(cleaned, "{", "}");
  if (objSubstr) {
    r = tryParseTopLevel(objSubstr);
    if (r) return r;
  }

  const arrSubstr = findBalanced(cleaned, "[", "]");
  if (arrSubstr) {
    r = tryParseTopLevel(arrSubstr);
    if (r) return r;
  }

  // 4. 修正常见 LLM JSON 错误（trailing comma、unquoted keys）
  const fixJson = (s: string): string =>
    s
      // trailing comma
      .replace(/,(\s*[}\]])/g, "$1")
      // 中文弯引号 → 直引号（最常见）
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");

  if (objSubstr) {
    r = tryParseTopLevel(fixJson(objSubstr));
    if (r) return r;
  }
  if (arrSubstr) {
    r = tryParseTopLevel(fixJson(arrSubstr));
    if (r) return r;
  }

  return null;
}

function buildUserPrompt(args: GenerateRequest): string {
  const count = Math.max(1, Math.min(10, args.count ?? 5));
  const subj = args.subjectId === "math" ? "数学" : "语文";
  const subjectId = args.subjectId === "math" ? "math" : "chinese";
  const defaultAbility = subjectId === "math" ? "calculation" : "vocabulary";
  const errorTagExample =
    subjectId === "math" ? "decimal_point_error" : "wrong_phonics";
  const term = args.term ?? "下册";

  const lines: string[] = [];
  lines.push(`请生成 ${count} 道四年级${term}（${term === "上册" ? "G4A" : "G4B"}）${subj}题：`);
  lines.push(`- ⚠️ 重要：必须是【${term}】的内容，不要混入【${term === "上册" ? "下册" : "上册"}】的考点`);
  lines.push(`- 单元：${args.unitName ?? args.unitId} (id: ${args.unitId})`);
  lines.push(`- 技能点：${args.skillName ?? args.skillId} (id: ${args.skillId})`);
  lines.push(`- 难度范围：${args.difficulty ?? "2-4"}`);
  lines.push(`- 题型：plain_choice（4 选 1 单选）`);
  if (args.existingStems && args.existingStems.length > 0) {
    lines.push(`\n以下题干已有，请勿重复同样的语境（可换字 / 换情境 / 换例句 / 换数字）：`);
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
  lines.push(`\n严格按照下面的字段结构输出 JSON，question_id 全部以 "AI_${args.skillId}_" 开头加 3 位序号：

{
  "questions": [
    {
      "question_id": "AI_${args.skillId}_001",
      "subjectId": "${subjectId}",
      "version": 1,
      "status": "approved",
      "grade": 4,
      "term": "${term}",
      "unit_id": "${args.unitId}",
      "unit_name": "${args.unitName ?? ""}",
      "skill_id": "${args.skillId}",
      "skill_name": "${args.skillName ?? ""}",
      "ability_dimension": ["${defaultAbility}"],
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
        { "tag": "${errorTagExample}", "error": "学生可能这样错", "remediation": "怎样纠正" }
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
  const subjectId = body.subjectId === "math" ? "math" : "chinese";

  const systemPrompt = buildSystemPrompt(subjectId);
  const userPrompt = buildUserPrompt({ ...body, subjectId });

  // 模型链：qwen-plus（高质量）→ omni-plus（用户截图里 authorized）→
  //          omni-flash（authorized）→ free-tier 兜底（多半 quota 拒绝）
  const models = [
    "qwen-plus",
    "qwen3.5-omni-plus",
    "qwen3.5-omni-flash",
    "qwen-max",
    "qwen-flash",
    "qwen-turbo",
  ];
  const tried: { model: string; status: number; code: string; message: string }[] = [];
  for (const m of models) {
    let r = await callQwenChat(env.DASHSCOPE_API_KEY, m, systemPrompt, userPrompt);
    if (!r.ok) {
      tried.push({ model: m, status: r.status, code: r.code, message: r.message });
      if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
      continue;
    }
    let arr = extractJsonArray(r.text);
    // 第一次没解析出 JSON → 试一次不带 response_format（有时模型把 JSON 嵌在解释里更干净）
    if (!arr) {
      const r2 = await callQwenChat(
        env.DASHSCOPE_API_KEY,
        m,
        systemPrompt,
        `${userPrompt}\n\n（重要：只输出顶层为 { "questions": [...] } 的纯 JSON，不要任何解释、不要 markdown。）`,
        false,
      );
      if (r2.ok) arr = extractJsonArray(r2.text);
      if (!arr) {
        tried.push({
          model: m,
          status: 200,
          code: "json_parse_failed",
          message: r.text.slice(0, 200),
        });
        continue;
      }
      r = r2.ok ? r2 : r;
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
        subjectId,
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
