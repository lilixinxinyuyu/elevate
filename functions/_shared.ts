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

/** 选 chat 模型用的 provider 列表（按优先级）。*/
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
 * Round 6.2 重排：**速度优先于质量**。出题对智力要求中等，宁可用快速模型快速
 * 失败也别等慢推理模型把整个请求拖死。qwen3.6-plus 是 reasoning 模型——即使
 * enable_thinking=false 也偶发慢/挂，挪到链尾兜底。
 */
export function getChatModelsFor(ctx: AiProviderContext): string[] {
  if (ctx.label === "token-plan") {
    // MiniMax / deepseek / glm 都是非 reasoning 的快模型；qwen3.6-plus 兜底
    return ["MiniMax-M2.5", "deepseek-v3.2", "glm-5", "qwen3.6-plus"];
  }
  // qwen-flash / qwen-turbo 是 dashscope 最快的；qwen-plus / qwen-max 兜底
  // 去掉 omni-plus / omni-flash（多模态模型，对纯文本 JSON 出题反而慢）
  return ["qwen-flash", "qwen-turbo", "qwen-plus", "qwen-max"];
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
