/**
 * Cloudflare Pages Functions 共用工具。
 *
 * 环境变量（在 Cloudflare Pages 设置里配）：
 *   APP_PASSWORD       - 单密码，给 Selena 自己用（家长设置）
 *   DB                 - D1 binding（在 Pages → Settings → Functions → D1 database bindings）
 *   DASHSCOPE_API_KEY  - 阿里云 DashScope（Qwen TTS）API key；可选，没设时 /api/tts/generate 返回 503
 */

export interface Env {
  APP_PASSWORD: string;
  DB: D1Database;
  /** 可选：Qwen TTS / DashScope intl OpenAI-compat。多学科 Phase 1 给语文听写用 */
  DASHSCOPE_API_KEY?: string;
  /**
   * 可选：阿里云 Token Plan 订阅 API key (sk-sp-...)。
   * 如果设了，AI 出题 / 讲题 / 图像生成会优先走 token-plan endpoint，
   * 它有 qwen3.6-plus / wan2.7-image-pro 等更新模型。
   * 没设就 fallback 到 DashScope intl。
   */
  TOKEN_PLAN_API_KEY?: string;
}

/**
 * AI provider context — 描述当前 endpoint 应该用什么 base URL / API key /
 * 候选 model 链。Round 5 加上 token-plan 优先。
 *
 * 调用方拿到 ctx 后调 ctx.chatModels[] / ctx.imageModels[] 依次试。
 */
export interface AiProviderContext {
  baseUrl: string;
  apiKey: string;
  /** 标识用，error log 里能看到走的是哪个 endpoint */
  label: "token-plan" | "dashscope-intl";
}

/**
 * 选 chat 模型用的 provider 列表（按优先级）。
 *
 * v0.30.1 反转：用户已付费 token-plan 订阅，**token-plan 优先用满**，
 * DashScope (Free Tier，只有 qwen-plus 能用且较慢) 当兜底。
 *
 * 历史：Round 6.8 曾把 DashScope 设为 primary 因为 token-plan 上的 deepseek/
 * glm/MiniMax/qwen3.6-plus 经常 25s+ 超时。但 DashScope Free Tier 限额经常打到
 * AllocationQuota，且 token-plan 不用就浪费订阅费。所以反过来：先打 token-plan，
 * 失败再 fallback 到 DashScope。
 */
export function getChatProviders(env: Env): AiProviderContext[] {
  const providers: AiProviderContext[] = [];
  if (env.TOKEN_PLAN_API_KEY) {
    providers.push({
      baseUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com",
      apiKey: env.TOKEN_PLAN_API_KEY,
      label: "token-plan",
    });
  }
  if (env.DASHSCOPE_API_KEY) {
    providers.push({
      baseUrl: "https://dashscope-intl.aliyuncs.com",
      apiKey: env.DASHSCOPE_API_KEY,
      label: "dashscope-intl",
    });
  }
  return providers;
}

/**
 * 给定 provider，返回它对应的可用 chat 模型链。
 *
 * Round 6.5 实测调整：
 * - DashScope 账号是 **Free Tier** ── qwen-flash/turbo/max 都返回
 *   `AllocationQuota.FreeTierOnly` 错误。**只 qwen-plus 能用**，且它较慢（~15-25s）。
 * - token-plan 的 MiniMax-M2.5 实测 18s+ 经常超时；deepseek-v3.2/glm-5 没充分测试。
 *   尝试用 deepseek 第一（非 reasoning，应较快），其次 glm-5 / MiniMax / qwen3.6-plus 兜底。
 */
export function getChatModelsFor(ctx: AiProviderContext): string[] {
  if (ctx.label === "token-plan") {
    return ["deepseek-v3.2", "glm-5", "MiniMax-M2.5", "qwen3.6-plus"];
  }
  // 只留 qwen-plus；其他都被 Free Tier 限了反而浪费 budget
  return ["qwen-plus"];
}

/** 给定 provider，返回它对应的图像生成模型链。 */
export function getImageModelsFor(ctx: AiProviderContext): string[] {
  if (ctx.label === "token-plan") {
    return [
      "wan2.7-image-pro",
      "wan2.7-image",
      "qwen-image-2.0-pro",
      "qwen-image-2.0",
    ];
  }
  return ["wanx2.1-t2i-turbo", "wanx2.1-t2i-plus", "wanx-v1"];
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

/** API 响应永不缓存（避免 Cloudflare 边缘缓存把同步状态卡住） */
export const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...noCacheHeaders,
    },
  });
}

/** 时间安全比较，避免 timing attack */
export function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function unauthorized(): Response {
  return jsonResponse({ ok: false, error: "unauthorized" }, 401);
}

/**
 * 校验请求里的 Authorization: Bearer <password>。
 * 返回 null 表示通过；否则返回 401 Response 直接给调用者 return。
 */
export function checkAuth(req: Request, env: Env): Response | null {
  if (!env.APP_PASSWORD) {
    // 没设密码：开发期跳过，但日志一下
    console.warn("APP_PASSWORD env var not set; skipping auth");
    return null;
  }
  const auth = req.headers.get("Authorization") ?? "";
  const m = /^Bearer\s+(.+)$/.exec(auth);
  if (!m) return unauthorized();
  if (!safeEq(m[1]!, env.APP_PASSWORD)) return unauthorized();
  return null;
}

export async function ensureSchema(db: D1Database): Promise<void> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_key TEXT NOT NULL,
      payload TEXT NOT NULL,
      attempts_count INTEGER DEFAULT 0,
      sessions_count INTEGER DEFAULT 0,
      total_xp INTEGER DEFAULT 0,
      client_id TEXT,
      created_at INTEGER NOT NULL
    )`.replace(/\s+/g, " ").trim(),
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_snapshots_user_created ON snapshots (user_key, created_at DESC)`,
  );
}

export const USER_KEY = "selena"; // 单用户场景；以后扩多用户改这里
