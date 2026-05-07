/**
 * POST /api/agent/fix-question
 *
 * 让 qwen-plus 把一道有问题的题"修好"——比删除然后重新出题省事，
 * 因为常见情况只是 stem 措辞 / answer 算错 / option 干扰项不合理这种局部问题。
 *
 * 输入：1 道题 + 该题的 judge 结果（issues + reason）
 * 输出：修好后的完整题 JSON（保持 question_id / unit_id / skill_id 不动）
 *      + changesSummary 一句话告诉 admin 改了什么
 *
 * Body:
 *   {
 *     question: <full question JSON>,
 *     issues: string[],     // 来自 judge 的 issues 标签
 *     reason: string,       // 来自 judge 的 reason 一句话
 *     subjectId?: "math" | "chinese"
 *   }
 *
 * Response:
 *   { ok: true, fixed: <full question JSON>, changesSummary: string, model, provider }
 *   或 { ok:false, error, detail, tried }
 */

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
import { composeFixUserPrompt } from "../../_promptComposer";

interface FixRequest {
  question: Record<string, unknown>;
  issues?: string[];
  reason?: string;
  subjectId?: "math" | "chinese";
}

const PER_CALL_TIMEOUT_MS = 28_000;

interface QwenChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { code?: string; message?: string };
}

async function callLlm(
  ctx: AiProviderContext,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ ok: true; text: string } | { ok: false; status: number; code: string; message: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_CALL_TIMEOUT_MS);
  try {
    const resp = await fetch(`${ctx.baseUrl}/compatible-mode/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3, // 修题要相对稳定，但不要 0 让它能调措辞
        max_tokens: 4000,
        ...(/^qwen3/i.test(model) ? { enable_thinking: false } : {}),
      }),
      signal: ctrl.signal,
    });
    let json: QwenChatResponse | null = null;
    try {
      json = (await resp.json()) as QwenChatResponse;
    } catch {
      return { ok: false, status: resp.status, code: "non_json", message: "upstream non-JSON" };
    }
    if (!resp.ok || json.error) {
      return {
        ok: false,
        status: resp.status,
        code: json.error?.code ?? "http_error",
        message: json.error?.message ?? `upstream ${resp.status}`,
      };
    }
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false, status: 200, code: "empty_response", message: "empty content" };
    return { ok: true, text };
  } catch (e) {
    const isAbort = (e as Error)?.name === "AbortError";
    return {
      ok: false,
      status: isAbort ? 408 : 0,
      code: isAbort ? "timeout" : "fetch_error",
      message: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractJsonObject(text: string): unknown {
  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  let cleaned = text.trim();
  let r = tryParse(cleaned);
  if (r) return r;
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  r = tryParse(cleaned);
  if (r) return r;
  const start = cleaned.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const sub = cleaned.substring(start, i + 1);
        r = tryParse(sub) ?? tryParse(sub.replace(/,(\s*[}\]])/g, "$1"));
        if (r) return r;
      }
    }
  }
  return null;
}

const FIX_SYSTEM_PROMPT = `你是 Selena 题库的资深修题员。给你一道**有问题的**四年级数学/语文题，
以及质检员标注的问题（issues + reason），请把题改好。

## 任务

读懂 issues 和 reason → 找到题中真正的问题 → 在**保持 question_id / unit_id / skill_id /
unit_name / skill_name / subjectId / version / grade / term 不变**的前提下，输出一道修好的题。

## 输出协议

输出顶层 \`{ "fixed": <整道题 JSON>, "changesSummary": "改了什么的中文一句话（≤ 30 字）" }\`，
**不要**包 markdown 代码块。

## 修题原则（按 issues 标签查表）

- \`forbidden_verb\` → 把"输/报/送/提交"改成"答/选/写出"
- \`stem_too_short\` → 把题干扩到 ≥ 8 个汉字，但意思不变
- \`stem_options_mismatch\` → 让 options 类型跟 stem 问的内容一致（数字题问数字、概念题问短句）
- \`answer_invalid\` → 让 answer.value 指向真实存在的 option.id；options 不动则改 value，反过来同理
- \`wrong_answer\` → **重算正确答案**，更新 options 中正确选项的 text + answer.value + solution_steps
- \`low_distractor_quality\` → 重新设计 4 个 options，1 正确 + 3 高质量干扰（操作反 / 漏一步 / 小数点错位）
- \`time_off\` → 调 estimated_time_seconds 到合理区间（参考下方时间表）
- \`bracket_instruction\` → 把题干括号里的指令注释挪进自然语言中
- \`cryptic_stem\` → 重写题干，让 4 年级孩子读 3 秒能懂
- \`weak_hint\` → 补 ≥ 1 条 hint、≥ 2 条 common_errors、≥ 1 步 solution_steps
- \`bad_punctuation\` → 中文标点 + 半角数字
- \`name_violation\` → 真实姓名换成"小明"/"小红"
- \`other\` → 看 reason 字段，针对性修

## 修题硬约束

1. **保留**：question_id / unit_id / unit_name / skill_id / skill_name / subjectId / version / grade / term
2. **保留**：game_type / play_as / question_format（除非这正是要修的问题）
3. **不要改 difficulty 太多**（最多 ±1）
4. **answer 必须正确**：选择题 answer.value 必须是某个 option.id；数值题 answer.value 必须是有限数
5. **保持 schema 完整**：feedback_correct / feedback_wrong / common_errors[] / hints[] / solution_steps[] / tags[] 都得有
6. **tags** 保留原有 + 新增 \`"ai_fixed"\`

## 时间表（estimated_time_seconds 参考）

| game_type | 难度 1-2 | 难度 3 | 难度 4-5 |
|---|---|---|---|
| speed_match | 10 | 15 | 20 |
| plain_choice | 20 | 30 | 40 |
| decimal_shifter | 18 | 25 | 35 |
| cube_view | 25 | 35 | 50 |
| triangle_judge | 22 | 30 | 40 |
| vertical_repair | 25 | 35 | 45 |
| balance_lab | 35 | 50 | 65 |
| shop_counter | 35 | 50 | 70 |
| word_problem_lab | 70 | 90 | 130 |

## 枚举字段（严格选值）

- term：上册 / 下册 / 综合复习
- cognitive_level：recall / procedural / application / reasoning
- ability_dimension[]：calculation / concept / reasoning / modeling / spatial / data / strategy / habit
- question_format：numeric / numeric_choice / single_choice / multi_choice / multi_step / fill_blank / drag_drop / sort_ladder / geometry_operation
- exam_priority：MUST_BIG / HIGH_BIG / MUST_SMALL / VERY_HIGH_SMALL / HIGH_SMALL / NORMAL / LOW / LOW_SMALL / EXTENSION
- difficulty：1 / 2 / 3 / 4 / 5（整数）

只输出 JSON，不要解释、不要 markdown 代码块。`;

function buildUserPrompt(req: FixRequest): string {
  // v0.31.34：用 composer 把 skill scope 注入修题 prompt，让 LLM 改完不跑出范围
  return composeFixUserPrompt({
    question: req.question,
    issues: req.issues ?? [],
    reason: req.reason ?? "",
    subjectId: req.subjectId === "chinese" ? "chinese" : "math",
  });
}

interface ProviderTryRecord {
  provider: string;
  model: string;
  status: number;
  code: string;
  message: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;

  let body: FixRequest;
  try {
    body = (await request.json()) as FixRequest;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.question || typeof body.question !== "object") {
    return jsonResponse({ ok: false, error: "missing_question" }, 400);
  }

  const subjectId = body.subjectId === "chinese" ? "chinese" : "math";
  const systemPrompt = FIX_SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(body);

  const tried: ProviderTryRecord[] = [];
  const providers = getChatProviders(env);
  for (const ctx of providers) {
    const models = getChatModelsFor(ctx);
    for (const model of models) {
      const r = await callLlm(ctx, model, systemPrompt, userPrompt);
      if (r.ok) {
        const parsed = extractJsonObject(r.text) as
          | { fixed?: Record<string, unknown>; changesSummary?: string }
          | null;
        if (!parsed?.fixed || typeof parsed.fixed !== "object") {
          tried.push({
            provider: ctx.label,
            model,
            status: 200,
            code: "bad_format",
            message: "no fixed object in LLM output",
          });
          continue;
        }
        // 强制 carry-forward 不变字段（防 LLM 改了 question_id 等）
        const carryFields = [
          "question_id",
          "subjectId",
          "version",
          "grade",
          "term",
          "unit_id",
          "unit_name",
          "skill_id",
          "skill_name",
        ] as const;
        const fixed = { ...parsed.fixed } as Record<string, unknown>;
        for (const f of carryFields) {
          if (body.question[f] !== undefined) fixed[f] = body.question[f];
        }
        // 加 ai_fixed tag
        const origTags = (body.question.tags as string[] | undefined) ?? [];
        const fixedTags = (fixed.tags as string[] | undefined) ?? [];
        const mergedTags = [...new Set([...origTags, ...fixedTags, "ai_fixed"])];
        fixed.tags = mergedTags;

        return jsonResponse({
          ok: true,
          fixed,
          changesSummary: parsed.changesSummary ?? "AI 修改",
          model,
          provider: ctx.label,
          subjectId,
        });
      }
      tried.push({ provider: ctx.label, model, status: r.status, code: r.code, message: r.message });
      if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
    }
  }
  return jsonResponse(
    {
      ok: false,
      error: "all_providers_failed",
      detail: tried.map((t) => `${t.provider}:${t.model}:${t.code}`).join(" | "),
      tried,
    },
    502,
  );
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
