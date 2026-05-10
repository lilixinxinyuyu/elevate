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
import {
  cognitiveLevelFor,
  composeQuestionUserPrompt,
  estimatedTimeFor,
  questionFormatFor,
} from "../../_promptComposer";
import { pickGameType } from "../../_gameTypePicker";

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
  /**
   * 难度。可以是范围 "2-4" 或单个 "3"。v0.31.34 起优先用单数字，
   * composer 才能精确注入对应 difficulty rubric。
   */
  difficulty?: string;
  term?: "上册" | "下册";
  existingStems?: string[];
  recentMistakeStems?: string[];
  gameType?: string;
  /**
   * v0.31.34: 显式选定 question_format，让 composer 注入对应 format rubric。
   * 不传则按 game-type 默认 format。
   */
  format?:
    | "numeric"
    | "numeric_choice"
    | "single_choice"
    | "multi_choice"
    | "multi_step"
    | "fill_blank"
    | "drag_drop"
    | "sort_ladder"
    | "geometry_operation";
  /** v0.31.34: 调用上下文标签（"admin" / "session-retry" / "session-bump-up"）— 仅日志用 */
  callerTag?: string;
  /**
   * v0.31.66: bench / 强制路由用 — 指定只用某个 provider（"dashscope-intl" 或
   * "token-plan"），不传则按 getChatProviders 默认顺序（dashscope 优先）。
   */
  forceProvider?: "dashscope-intl" | "token-plan";
  /**
   * v0.31.66: bench / 大批量用 — 覆盖默认 SUB_BATCH_SIZE=2。
   * 实测 count=20 想要 deepseek/qwen 一次出 20 道，sub-batch 必须开大才能一次性
   * 出。否则拆成 10 个 2-道 sub-batch 会让 AI 出 10 个互相重复的小批。
   * 上限 30（每个 sub-batch 最多 30 道）。
   */
  subBatchSize?: number;
  /**
   * v0.31.35: D5 综合题用 — 额外注入这些 skill 的 scope。
   * 主 skill 仍是 skillId，落库 question.skill_id 也是 skillId。
   * 例：D5 平均数 + 小数乘法综合题：
   *   skillId="average_compute", extraSkillIds=["decimal_mul_meaning"]
   */
  extraSkillIds?: string[];
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
  // 模板从 prompts/questions/system.md 读，运行时只替换占位符
  // v0.31.72: subject-aware — 数学 prompt 不再混入语文段落
  const subjLabel = subjectId === "math" ? "数学" : "语文";
  const subjKey = subjectId === "math" ? "math" : "chinese";
  const sys = PROMPTS.questionsSystem as unknown as
    | string
    | { math?: string; chinese?: string; raw?: string };
  const template =
    typeof sys === "string"
      ? sys
      : (sys[subjKey as "math" | "chinese"] ?? sys.raw ?? "");
  return template.replace(/\{\{subjectLabel\}\}/g, subjLabel);
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
 * 选用 game-type 对应的 schema 片段。
 *
 * 优先级：
 *   1. body.gameType 显式指定
 *   2. game-type-by-skill.json 里 skill_id 的映射
 *   3. fallback：plain_choice
 */
function pickGameTypeSchema(args: GenerateRequest): { gameType: string; schema: string } {
  const explicit = args.gameType && PROMPTS.questionsSchemas[args.gameType as keyof typeof PROMPTS.questionsSchemas]
    ? args.gameType
    : null;
  // v0.31.86: 用 pickGameType 按权重抽（mapping 现在是 [{type,weight}]）
  const fromSkill = args.skillId ? pickGameType(args.skillId) : undefined;
  const gameType = explicit ?? fromSkill ?? "plain_choice";
  const schema =
    PROMPTS.questionsSchemas[gameType as keyof typeof PROMPTS.questionsSchemas] ??
    PROMPTS.questionsSchemas.plain_choice;
  return { gameType, schema };
}

/**
 * 用 _promptComposer.composeQuestionUserPrompt 拼出当前 batch 的 user prompt。
 *
 * v0.31.34：从模板字符串替换升级到模块化 composer——
 *   - 注入 skill scope（精确教学范围 + 公式 + 常见错误）
 *   - 注入 difficulty rubric（按精确难度）
 *   - 注入 format rubric（按 question_format）
 *   - 注入 game-type schema
 *   - 加 existing stems + recent mistakes（去重 + 巩固）
 */
function buildUserPrompt(args: GenerateRequest, batchIndex: number): string {
  // v0.31.66: 不再 hard-cap 到 SUB_BATCH_SIZE，让 onRequestPost 上游已经把 args.count
  // 限到 effectiveSubBatchSize（≤30）。这里只兜底防 0/负数。
  const count = Math.max(1, Math.min(30, args.count ?? 2));
  const subjectId = args.subjectId === "math" ? "math" : "chinese";

  // 难度：把 "2-4" 这种范围 pick 一个（按 batchIndex 轮询），单数字直接用
  const difficulty = parseDifficulty(args.difficulty, batchIndex);

  const angles = ["数字换一组", "情境换一种", "提问角度反一下", "增加一个干扰条件", "数字使用小数", "数字使用整数", "数字含 0", "数字相等"];
  const batchAngle = angles[batchIndex % angles.length]!;

  // 自动选 game-type — v0.31.86: 按 mapping 池权重抽（每次可能不同）
  const fromSkill = args.skillId ? pickGameType(args.skillId) : undefined;
  const gameType = args.gameType ?? fromSkill ?? "plain_choice";

  // v0.31.86: 把 caller-known fields 提前算好喂给 composer（v0.31.72 4 P 原则的
  // "已知字段不让 AI 反复猜"轴）。之前 composeQuestionUserPrompt 接 prefilledFields
  // 但调用方从来不传，整段 prefilled 渲染块运行时不可达。现在补上 wiring。
  const prefilledFields = {
    grade: 4,
    cognitiveLevel: cognitiveLevelFor(args.skillId ?? "", gameType),
    questionFormat: questionFormatFor(gameType),
    estimatedTimeSeconds: estimatedTimeFor(gameType, difficulty),
    status: "approved",
  };

  return composeQuestionUserPrompt({
    subjectId,
    unitId: args.unitId ?? "",
    unitName: args.unitName,
    skillId: args.skillId ?? "",
    skillName: args.skillName,
    extraSkillIds: args.extraSkillIds,
    term: args.term ?? "下册",
    difficulty,
    format: args.format,
    gameType,
    count,
    existingStems: args.existingStems,
    recentMistakeStems: args.recentMistakeStems,
    batchAngle,
    callerTag: args.callerTag,
    prefilledFields,
  });
}

/**
 * 解析 difficulty 字段。
 *   - "3" → 3
 *   - "2-4" → batchIndex 0 → 2，1 → 3，2 → 4，3 → 2，...
 *   - undefined → 3（默认中等）
 */
function parseDifficulty(raw: string | undefined, batchIndex: number): 1 | 2 | 3 | 4 | 5 {
  if (!raw) return 3;
  const single = raw.match(/^([1-5])$/);
  if (single) return Number(single[1]) as 1 | 2 | 3 | 4 | 5;
  const range = raw.match(/^([1-5])-([1-5])$/);
  if (range) {
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    const span = hi - lo + 1;
    return ((lo + (batchIndex % span)) as 1 | 2 | 3 | 4 | 5);
  }
  return 3;
}

/**
 * 校验 LLM 输出的 stem 是否真的围绕请求的 skill。
 *
 * 防止 LLM 偷懒乱出"求平均数"题（那是它最熟的）当作"积的小数位数"。
 *
 * 算法：
 *   1. 拿 prompts/skill-keywords.json 里 skillId 的关键词数组
 *   2. 没列在表里 → 用 skill_name 自己 tokenize（fallback，宽松）
 *   3. stem 里命中 ≥ 1 个关键词就 pass，0 个就拒绝
 *
 * 返回 true = 通过校验，false = 跑题。
 */
function stemMatchesSkill(stem: string, skillId: string | undefined, skillName: string | undefined): boolean {
  if (!stem) return false;
  if (!skillId) return true; // 没传 skillId 就不校验（兼容旧调用）
  const explicit = (PROMPTS.skillKeywords as unknown as Record<string, readonly string[]>)[skillId];
  let keywords: readonly string[];
  if (explicit && explicit.length > 0) {
    keywords = explicit;
  } else if (skillName) {
    // 把 skill name 切成 2-3 字的中文片段做 fuzzy 匹配（比如 "三位数乘两位数笔算" → ["三位", "位数", "数乘", "乘两", "两位", "笔算"]）
    const fuzz: string[] = [];
    for (let i = 0; i < skillName.length - 1; i++) {
      fuzz.push(skillName.slice(i, i + 2));
    }
    keywords = fuzz;
  } else {
    return true;
  }
  return keywords.some((kw) => stem.includes(kw));
}

function isValidQuestionShape(q: unknown): boolean {
  if (!q || typeof q !== "object") return false;
  const o = q as Record<string, unknown>;
  if (typeof o.question_id !== "string" || !o.question_id) return false;
  if (typeof o.stem !== "string" || !o.stem) return false;
  if (!o.answer || typeof o.answer !== "object") return false;
  // multi_step (word_problem_lab)：靠 subquestions 数组而不是 options
  const ans = o.answer as { type?: string };
  if (ans.type === "multi_step") {
    if (!Array.isArray(o.subquestions) || o.subquestions.length === 0) return false;
    return true;
  }
  // 其他题型：要求 options 数组
  if (!Array.isArray(o.options) || o.options.length < 2) return false;
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
      const shapeValid = arr.filter(isValidQuestionShape);
      // **skill-fidelity 校验**：把跑题的丢掉（修 "总是出平均数/方程式" bug）
      const valid = shapeValid.filter((q) => {
        const o = q as Record<string, unknown>;
        return stemMatchesSkill(
          typeof o.stem === "string" ? o.stem : "",
          args.skillId,
          args.skillName,
        );
      });
      const droppedOffTopic = shapeValid.length - valid.length;
      if (droppedOffTopic > 0) {
        console.warn(
          `[generate.questions] skill="${args.skillId}" dropped ${droppedOffTopic}/${shapeValid.length} off-topic questions`,
        );
      }
      if (valid.length === 0) {
        errors.push({
          provider: ctx.label,
          model: m,
          code:
            shapeValid.length > 0 ? "off_topic" : "no_valid_questions",
          message:
            shapeValid.length > 0
              ? `${shapeValid.length} items but none matched skill "${args.skillId}"`
              : `${arr.length} items but none valid`,
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
  let providers = getChatProviders(env);
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

  // v0.31.66: forceProvider — bench / 路由测试用
  if (body.forceProvider) {
    providers = providers.filter((p) => p.label === body.forceProvider);
    if (providers.length === 0) {
      return jsonResponse({ ok: false, error: "force_provider_not_available", detail: body.forceProvider }, 400);
    }
  }

  // v0.31.66: subBatchSize override — 让 client 决定一次出多少
  const effectiveSubBatchSize = body.subBatchSize
    ? Math.max(1, Math.min(30, body.subBatchSize))
    : SUB_BATCH_SIZE;

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

  // 拆 sub-batches: 默认 2 题/批，client 可通过 subBatchSize 覆盖
  const batchCount = Math.ceil(requestedCount / effectiveSubBatchSize);
  const batches: Promise<Awaited<ReturnType<typeof runSubBatch>>>[] = [];
  let remaining = requestedCount;
  for (let i = 0; i < batchCount; i++) {
    const thisBatch = Math.min(effectiveSubBatchSize, remaining);
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
