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
 * POST /api/generate/questions
 *
 * Round 6 重写：**并发批次** 模式。
 *
 * 之前的单调用模型出 5-10 道题 + 长 prompt + reasoning model → 经常 30-50s
 * 触发 60s 客户端硬超时 + Cloudflare Pages 30s wall clock。
 *
 * 现在：把 count 拆成 N 个并发的 4 题 sub-batch，Promise.allSettled 等 max。
 * 每个 sub-batch 25s AbortController 兜底。整体即使 30 题也能 ~25s 完成。
 *
 * 输入 body:
 *   {
 *     subjectId: "chinese" | "math",
 *     unitId, unitName, skillId, skillName,
 *     count: 1-30,                 // 30 题以内一次搞定（内部并发）
 *     difficulty: "2-4",
 *     term: "上册" | "下册",
 *     existingStems?: string[],    // 截断到 10 条避免 prompt 爆长
 *     recentMistakeStems?: string[],
 *   }
 *
 * 输出:
 *   { ok: true, questions: Question[], model, provider, generatedCount, requestedCount }
 *   或 { ok: false, error, detail }
 *
 * 关键设计：**partial success** —— 哪怕 5 个 sub-batch 里只有 1 个返回了
 * 有效题，我们也返回 ok:true（请求方至少能用上）。
 */

interface GenerateRequest {
  subjectId?: "math" | "chinese";
  unitId?: string;
  unitName?: string;
  skillId?: string;
  skillName?: string;
  count?: number;
  difficulty?: string;
  term?: "上册" | "下册";
  existingStems?: string[];
  recentMistakeStems?: string[];
  gameType?: string;
}

/** 单 sub-batch 题数上限。
 * Round 6.6: 4 → 2，因为 LLM 输出 ~800 tokens 用 25s+。改 2 题/批 ~400 tokens
 * 在 12-15s 完成。count=10 → 5 个并发批，总墙钟 ~15s。 */
const SUB_BATCH_SIZE = 2;
/** 整个请求的最大题数（防止恶意调用） */
const MAX_TOTAL_COUNT = 30;
/** 单次 LLM 调用的 wall-clock 限制（ms）。
 * Round 6.7：去掉 response_format json_object 约束后，模型可以快 2-3 倍。
 * 但 first-token 时间仍可能 10s+ — 给 30s 兜底。 */
const PER_CALL_TIMEOUT_MS = 30_000;
/**
 * 单个 provider 的 wallclock budget。
 *
 * lazy 启动 — token-plan 用完 35s 后 dashscope 还有 35s 单独的预算。
 * worst case = 70s（client 90s 之内）。
 */
const PER_PROVIDER_BUDGET_MS = 35_000;

function buildSystemPrompt(subjectId: string): string {
  const subjLabel = subjectId === "math" ? "数学" : "语文";
  const dictionary =
    subjectId === "math"
      ? "（北师大版四年级下册：小数 / 方程 / 三角形 / 立体观察 / 平均数等单元；不要超纲到五年级如比例、函数）"
      : "（人教版四年级下册：1-4单元字音字形 / 古诗 / 修辞 / 听写词语 / 阅读）";
  // **简化**：去掉一切非必要规则，只留对生成 JSON 严格性的要求
  return `你是 4 年级女生 Selena 的${subjLabel}出题助手。${dictionary}

输出顶层 { "questions": [...] } JSON，不要 markdown，不要解释。

每题：
- stem 写在题目里，4 选 1（A/B/C/D），feedback_correct/wrong 各一句话
- common_errors 至少 2 项 (tag/error/remediation)
- difficulty 1-5：3=单元中等
- 不重复 existingStems
- 不超纲，不出现真实姓名/广告/负面词`;
}

interface QwenChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { code?: string; message?: string };
}

/**
 * 单次 LLM 调用 — 带双 AbortController：
 *   1. PER_CALL_TIMEOUT_MS 单调用上限（18s）
 *   2. globalSignal 全局预算（50s 总 budget），超了所有 in-flight 都 abort
 *
 * 失败时返回 ok:false + 详细 code/message。
 */
async function callQwenChat(
  ctx: AiProviderContext,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  withJsonFormat = true,
  globalSignal?: AbortSignal,
): Promise<{ ok: true; text: string } | { ok: false; status: number; code: string; message: string }> {
  // 全局 budget 已经过期 → 立即返回（不再发起调用）
  if (globalSignal?.aborted) {
    return { ok: false, status: 408, code: "global_budget_exceeded", message: "skipped after wallclock budget" };
  }
  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    // Round 6.9: 1500 → 2500. 实测 2 题 + 全字段 JSON ~1500-2200 token，
    // 1500 容易截断导致 json_parse_failed。2500 给安全边际。
    max_tokens: 2500,
  };
  // qwen3.x 系列是 reasoning 模型，关掉 thinking 不浪费 token；
  // 其他模型（MiniMax / deepseek / glm）会拒收 enable_thinking=false
  // (Round 6.4 root cause fix: MiniMax 报 invalid_parameter_error)
  if (/^qwen3/i.test(model)) {
    requestBody.enable_thinking = false;
  }
  if (withJsonFormat) {
    requestBody.response_format = { type: "json_object" };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_CALL_TIMEOUT_MS);
  // 全局 budget abort 时也要 abort 这个 call
  const onGlobalAbort = () => ctrl.abort();
  globalSignal?.addEventListener("abort", onGlobalAbort, { once: true });
  try {
    const upstream = await fetch(
      `${ctx.baseUrl}/compatible-mode/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: ctrl.signal,
      },
    );
    let json: QwenChatResponse | null = null;
    try {
      json = (await upstream.json()) as QwenChatResponse;
    } catch {
      return { ok: false, status: upstream.status, code: "non_json", message: "upstream non-JSON" };
    }
    if (!upstream.ok || json.error) {
      const errMsg = `${json.error?.code ?? ""} ${json.error?.message ?? ""}`;
      // 一些模型不支持 response_format → 自动重试一次
      if (
        withJsonFormat &&
        /response_format|json_object|not.*support|unrecognized|invalid.*parameter/i.test(
          errMsg,
        )
      ) {
        return await callQwenChat(ctx, model, systemPrompt, userPrompt, false, globalSignal);
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
  } catch (e) {
    const isAbort = (e as Error)?.name === "AbortError";
    const reason = globalSignal?.aborted ? "global_budget_exceeded" : "timeout";
    return {
      ok: false,
      status: isAbort ? 408 : 0,
      code: isAbort ? reason : "fetch_error",
      message: isAbort
        ? `per-call ${PER_CALL_TIMEOUT_MS / 1000}s timeout (or global budget)`
        : (e instanceof Error ? e.message : String(e)),
    };
  } finally {
    clearTimeout(timer);
    globalSignal?.removeEventListener("abort", onGlobalAbort);
  }
}

/** 从 LLM 文本里安全抓 JSON 数组（5 级降级 fallback） */
function extractJsonArray(text: string): unknown[] | null {
  if (!text) return null;
  const tryParseTopLevel = (s: string): unknown[] | null => {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") {
        for (const v of Object.values(parsed)) {
          if (Array.isArray(v)) return v;
        }
      }
    } catch {
      /* fallthrough */
    }
    return null;
  };

  let cleaned = text.trim();
  let r = tryParseTopLevel(cleaned);
  if (r) return r;

  cleaned = cleaned
    .replace(/^```(?:json|JSON)?\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
  r = tryParseTopLevel(cleaned);
  if (r) return r;

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

  const fixJson = (s: string): string =>
    s
      .replace(/,(\s*[}\]])/g, "$1")
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

/**
 * 单 sub-batch 的 user prompt。
 *
 * 关键改动：
 *   - existingStems 截断到 8 条（之前 30 条让 prompt 长一倍）
 *   - 每条 stem 截短到 30 字符（之前 50）
 *   - JSON 模板用 placeholder ${SKILL_ID} 替换，下面会运行时填
 *   - count 单 sub-batch ≤ 4
 */
function buildUserPrompt(args: GenerateRequest, batchIndex: number): string {
  const count = Math.max(1, Math.min(SUB_BATCH_SIZE, args.count ?? SUB_BATCH_SIZE));
  const subj = args.subjectId === "math" ? "数学" : "语文";
  const subjectId = args.subjectId === "math" ? "math" : "chinese";
  const defaultAbility = subjectId === "math" ? "calculation" : "vocabulary";
  const errorTagExample =
    subjectId === "math" ? "decimal_point_error" : "wrong_phonics";
  const term = args.term ?? "下册";

  const lines: string[] = [];
  lines.push(`生成 ${count} 道四年级${term}（${term === "上册" ? "G4A" : "G4B"}）${subj}题：`);
  lines.push(`⚠️ 内容必须是【${term}】，不要混【${term === "上册" ? "下册" : "上册"}】`);
  lines.push(`单元：${args.unitName ?? args.unitId} (${args.unitId})`);
  lines.push(`技能：${args.skillName ?? args.skillId} (${args.skillId})`);
  lines.push(`难度：${args.difficulty ?? "2-4"}（在该范围内分布）`);
  // 关键：批次种子让不同并发批次出不同的题（情境/数字/字词）
  lines.push(`变化方向${batchIndex}：本批用 ${["A 角度", "B 角度", "C 角度", "D 角度", "E 角度", "F 角度", "G 角度", "H 角度"][batchIndex % 8]}（不同情境/不同数字/不同字词组合）`);

  if (args.existingStems && args.existingStems.length > 0) {
    lines.push(`\n以下题干已有，请勿重复（换情境换字换数）：`);
    for (const s of args.existingStems.slice(0, 8)) {
      lines.push(`- ${s.slice(0, 30)}`);
    }
  }
  if (args.recentMistakeStems && args.recentMistakeStems.length > 0) {
    lines.push(`\n围绕这些考点出新题：`);
    for (const s of args.recentMistakeStems.slice(0, 5)) {
      lines.push(`- ${s.slice(0, 30)}`);
    }
  }

  // 紧凑 schema 模板，省 token
  lines.push(`\n输出 JSON：

{"questions":[
  {
    "question_id":"AI_${args.skillId}_001",
    "subjectId":"${subjectId}",
    "version":1,"status":"approved","grade":4,"term":"${term}",
    "unit_id":"${args.unitId}","unit_name":"${args.unitName ?? ""}",
    "skill_id":"${args.skillId}","skill_name":"${args.skillName ?? ""}",
    "ability_dimension":["${defaultAbility}"],
    "exam_priority":"HIGH_BIG","game_type":"plain_choice","play_as":"plain_choice",
    "cognitive_level":"conceptual","difficulty":3,"estimated_time_seconds":25,
    "stem":"题面",
    "question_format":"single_choice",
    "options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""},{"id":"D","text":""}],
    "answer":{"type":"choice","value":"A"},
    "solution_steps":["分析"],
    "common_errors":[{"tag":"${errorTagExample}","error":"","remediation":""}],
    "feedback_correct":"","feedback_wrong":"",
    "hints":[{"text":"","penalty":1}],
    "tags":["ai_generated"]
  }
]}`);
  return lines.join("\n");
}

function isValidQuestionShape(q: unknown): boolean {
  if (!q || typeof q !== "object") return false;
  const o = q as Record<string, unknown>;
  if (typeof o.question_id !== "string" || !o.question_id) return false;
  if (typeof o.stem !== "string" || !o.stem) return false;
  if (!Array.isArray(o.options) || o.options.length < 2) return false;
  if (!o.answer || typeof o.answer !== "object") return false;
  return true;
}

/**
 * 跑单 sub-batch（迭代 provider × model）：
 *   - 拿到任何一个 model 给的有效 questions 数组就 return ok
 *   - 跨 batch 共享 brokenModels Set——某 model 在另一 batch 已挂，本 batch 直接跳过
 *   - 全局 wallclock 用 globalSignal abort
 */
async function runSubBatch(
  args: GenerateRequest,
  batchIndex: number,
  providers: AiProviderContext[],
  systemPrompt: string,
  providerCtrls: Map<
    string,
    { signal: AbortSignal; ensureStarted: () => void; cleanup: () => void }
  >,
  brokenModels: Set<string>,
): Promise<{
  questions: unknown[];
  modelUsed?: string;
  providerUsed?: string;
  errors: { provider: string; model: string; code: string; message: string }[];
}> {
  const userPrompt = buildUserPrompt(args, batchIndex);
  const errors: { provider: string; model: string; code: string; message: string }[] = [];

  for (const ctx of providers) {
    const ctrl = providerCtrls.get(ctx.label);
    if (!ctrl || ctrl.signal.aborted) continue; // 这家预算用光，试下一家
    ctrl.ensureStarted(); // 第一次摸到才开始烧 30s budget
    const providerSignal = ctrl.signal;
    const models = getChatModelsFor(ctx);
    for (const m of models) {
      if (providerSignal.aborted) break;
      const modelKey = `${ctx.label}/${m}`;
      // 跨 batch 已知坏模型 → 直接跳过，省时间
      if (brokenModels.has(modelKey)) continue;

      // Round 6.7：默认不带 response_format=json_object（实测它让 deepseek/qwen
       // constrained decoding 慢 2-3 倍）。extractJsonArray 5 级 fallback 已经很
       // 鲁棒，纯 prompt 引导 + 解析就够。
      let r = await callQwenChat(ctx, m, systemPrompt, userPrompt, false, providerSignal);
      if (!r.ok) {
        errors.push({ provider: ctx.label, model: m, code: r.code, message: r.message });
        // 标记坏模型让其他 batch 跳过：
        // - timeout / budget exhausted / 鉴权挂 / 不支持参数 → 一定是模型问题
        // - AllocationQuota.* → DashScope 账户 Free Tier 限制，永远不会变
        if (
          r.code === "timeout" ||
          r.code === "global_budget_exceeded" ||
          r.code === "InvalidApiKey" ||
          r.code === "AccessDenied" ||
          r.code === "invalid_parameter_error" ||
          r.code.startsWith("Allocation") // FreeTierOnly / Quota etc.
        ) {
          brokenModels.add(modelKey);
        }
        if (r.code === "InvalidApiKey" || r.code === "AccessDenied") break;
        continue;
      }
      let arr = extractJsonArray(r.text);
      if (!arr) {
        const r2 = await callQwenChat(
          ctx,
          m,
          systemPrompt,
          `${userPrompt}\n\n（重要：只输出顶层 { "questions": [...] } JSON，不要解释、不要 markdown）`,
          false,
          providerSignal,
        );
        if (r2.ok) arr = extractJsonArray(r2.text);
        if (!arr) {
          errors.push({
            provider: ctx.label,
            model: m,
            code: "json_parse_failed",
            message: r.text.slice(0, 120),
          });
          continue;
        }
        r = r2.ok ? r2 : r;
      }
      const valid = arr.filter(isValidQuestionShape);
      if (valid.length === 0) {
        errors.push({
          provider: ctx.label,
          model: m,
          code: "no_valid_questions",
          message: `${arr.length} items but none valid`,
        });
        continue;
      }
      return {
        questions: valid,
        modelUsed: m,
        providerUsed: ctx.label,
        errors,
      };
    }
  }
  return { questions: [], errors };
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  const providers = getChatProviders(env);
  if (providers.length === 0) {
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
  const requestedCount = Math.max(1, Math.min(MAX_TOTAL_COUNT, body.count ?? 5));

  const systemPrompt = buildSystemPrompt(subjectId);

  // 跨 batch 共享：某个 model 在 batch A 已 timeout 了，batch B 直接跳过
  const brokenModels = new Set<string>();

  // **每 provider 独立 budget**：每家 30s。如果 token-plan 全失败，dashscope
  // 仍能从 30s 新预算开始尝试。client 总 timeout 90s。
  // sub-batch 内部按 provider 顺序串行（试完 token-plan 才试 dashscope）。
  // 多 sub-batch 之间并发，但每个 sub-batch 共享同一组 perProviderSignal。

  // **Lazy timer**：每个 provider 的 30s budget 只在第一次"摸到"它时启动，
  // 而不是 t=0 就开始烧。修复 bug：token-plan 用 30s 时 dashscope 的预算也烧光了。
  const providerCtrls = new Map<
    string,
    { signal: AbortSignal; ensureStarted: () => void; cleanup: () => void }
  >();
  for (const p of providers) {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let started = false;
    providerCtrls.set(p.label, {
      signal: ctrl.signal,
      ensureStarted: () => {
        if (started) return;
        started = true;
        timer = setTimeout(() => ctrl.abort(), PER_PROVIDER_BUDGET_MS);
      },
      cleanup: () => {
        if (timer) clearTimeout(timer);
      },
    });
  }

  // 拆 sub-batches: 每批 4 题，并发跑
  const batchCount = Math.ceil(requestedCount / SUB_BATCH_SIZE);
  const batches: Promise<Awaited<ReturnType<typeof runSubBatch>>>[] = [];
  let remaining = requestedCount;
  for (let i = 0; i < batchCount; i++) {
    const thisBatch = Math.min(SUB_BATCH_SIZE, remaining);
    remaining -= thisBatch;
    batches.push(
      runSubBatch(
        { ...body, subjectId, count: thisBatch },
        i,
        providers,
        systemPrompt,
        providerCtrls,
        brokenModels,
      ),
    );
  }

  const settled = await Promise.allSettled(batches);
  // 清理所有 timer
  for (const { cleanup } of providerCtrls.values()) cleanup();

  const allQuestions: unknown[] = [];
  const allErrors: { provider: string; model: string; code: string; message: string }[] = [];
  let modelUsed: string | undefined;
  let providerUsed: string | undefined;

  for (const s of settled) {
    if (s.status === "fulfilled") {
      allQuestions.push(...s.value.questions);
      allErrors.push(...s.value.errors);
      if (!modelUsed && s.value.modelUsed) modelUsed = s.value.modelUsed;
      if (!providerUsed && s.value.providerUsed) providerUsed = s.value.providerUsed;
    } else {
      allErrors.push({
        provider: "?",
        model: "?",
        code: "batch_rejected",
        message: (s.reason as Error)?.message ?? String(s.reason),
      });
    }
  }

  // partial-success：只要总数 ≥ 1 就返回，让客户端能用上
  if (allQuestions.length === 0) {
    console.error("[generate.questions] all batches failed", allErrors);
    return jsonResponse(
      {
        ok: false,
        error: "no_model_worked",
        detail: allErrors
          .slice(0, 6)
          .map((t) => `${t.provider}/${t.model}:${t.code}`)
          .join(", "),
        tried: allErrors,
      },
      502,
    );
  }

  // 给每道题加唯一时间戳后缀（避免 question_id 撞）
  const stamp = Date.now().toString(36);
  const stamped = allQuestions.map((q, i) => {
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
    model: modelUsed ?? "mixed",
    provider: providerUsed ?? "mixed",
    generatedCount: stamped.length,
    requestedCount,
    /** 部分成功标记：返回数比请求数少时，UI 可以提示"AI 出了 N 道（你点的是 M 道）" */
    partial: stamped.length < requestedCount,
    /** 失败的批次详情（用于诊断） */
    batchErrors: allErrors.length > 0 && stamped.length < requestedCount ? allErrors.slice(0, 6) : undefined,
  });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
