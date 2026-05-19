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
  /**
   * v0.36.9 (爸爸明确): cn-beijing 国内订阅 key (sk-sp-...).
   * 这是主路径 — Bruce 已付费, quota 充裕. ap-southeast (TOKEN_PLAN_API_KEY)
   * quota 已耗尽, 只作旧 fallback.
   *
   * 配置: wrangler pages secret put TOKEN_PLAN_CN_API_KEY --project-name=selena-elevate
   * 见 docs/ai-models-registry.md §1.1.
   */
  TOKEN_PLAN_CN_API_KEY?: string;
  /**
   * v0.33.59 (Ep132 OSS sync): 阿里云 OSS 配置（多租户云同步主路径）
   * 都设了 → OSS 启用；任一没设 → fallback D1
   */
  ALIYUN_OSS_REGION?: string;       // e.g. "oss-cn-hongkong"
  ALIYUN_OSS_BUCKET?: string;       // e.g. "xiaojinapp"
  ALIYUN_OSS_ACCESS_KEY_ID?: string;
  ALIYUN_OSS_ACCESS_KEY_SECRET?: string;
  /**
   * v0.33.59: 多租户密码映射 (JSON map password→userId)
   * 例：'{"selena-2026":"selena","alice-pwd":"alice"}'
   * 不设 → 全部 fallback 到 APP_PASSWORD → userId="selena"
   */
  APP_USERS?: string;
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
 * v0.30.2：分流——
 *   - chat（出题、判题）：DashScope 优先（qwen-plus 实测 15-25s，token-plan 上的
 *     deepseek/glm/MiniMax/qwen3.6-plus 经常 25s+ 超时，把整个 30s 墙钟用光）。
 *   - image（勋章/校徽）：token-plan 优先（wan2.7-image-pro 比 wanx2.1-turbo 强很多，
 *     而且图片生成 60s 异步轮询，timeout 不是关键约束）。
 *
 * 这个函数给 chat 用。image 走 getImageProviders。
 */
export function getChatProviders(env: Env): AiProviderContext[] {
  const providers: AiProviderContext[] = [];
  // v0.36.9 (爸爸明确铁律): token-plan cn-beijing 是主路径 (月订阅, quota 2.71% 已用),
  // ap-southeast 是历史 fallback (quota 已耗尽). DashScope intl Free Tier 兜底.
  if (env.TOKEN_PLAN_CN_API_KEY) {
    providers.push({
      baseUrl: "https://token-plan.cn-beijing.maas.aliyuncs.com",
      apiKey: env.TOKEN_PLAN_CN_API_KEY,
      label: "token-plan",
    });
  }
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
 * 选 image 模型用的 provider 列表。
 *
 * **token-plan 优先**：用户已付费订阅，且 wan2.7-image-pro / qwen-image-2.0-pro
 * 比 DashScope Free Tier 的 wanx2.1-turbo 质感强太多（勋章/校徽 36s vs 8s 但
 * 更值）。token-plan 不可用 fallback 到 DashScope。
 *
 * image.ts 内部应该直接调这个，**不**复用 getChatProviders。
 */
export function getImageProviders(env: Env): AiProviderContext[] {
  const providers: AiProviderContext[] = [];
  // v0.36.9: cn-beijing 主路径
  if (env.TOKEN_PLAN_CN_API_KEY) {
    providers.push({
      baseUrl: "https://token-plan.cn-beijing.maas.aliyuncs.com",
      apiKey: env.TOKEN_PLAN_CN_API_KEY,
      label: "token-plan",
    });
  }
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
    // v0.36.10 (爸爸 P0 perf audit) 实测 cn-beijing 直连:
    //   qwen3.6-flash:     0.32s ✅ 最快
    //   deepseek-v4-flash: 0.96s ✅ 推理快
    //   qwen3.6-plus:      1.06s ✅ 兜底
    //   glm-5.1:           2.35s ✅ 备用
    //   deepseek-v4-pro:   2.73s ✅ 复杂任务
    //   ❌ MiniMax-M2.5:   invalid_parameter_error (dead, 移除)
    //   ❌ glm-5:          3.83s (升级到 5.1)
    return ["qwen3.6-flash", "deepseek-v4-flash", "qwen3.6-plus", "glm-5.1", "deepseek-v4-pro"];
  }
  // dashscope-intl Free Tier 只留 qwen-plus; 其他 AllocationQuota.FreeTierOnly
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
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
  const r = getUserId(req, env);
  if (r instanceof Response) return r;
  return null;
}

/**
 * v0.33.59 (Ep132 OSS sync multi-tenant):
 * 从 Authorization: Bearer <password> 解出 userId。
 * - 先查 APP_USERS JSON map (e.g. {"alice-pwd":"alice"}) → 返 alice
 * - fallback 到 APP_PASSWORD → 返 "selena"（默认家庭，向后兼容）
 * - 都不匹配 → 401 Response
 *
 * 返回 string (userId) 或 Response (401，调用方直接 return)
 */
export function getUserId(req: Request, env: Env): string | Response {
  const auth = req.headers.get("Authorization") ?? "";
  const m = /^Bearer\s+(.+)$/.exec(auth);
  if (!m) {
    // 完全没 Authorization header 且未配 APP_PASSWORD → 开发模式跳过
    if (!env.APP_PASSWORD && !env.APP_USERS) {
      console.warn("[getUserId] no APP_PASSWORD / APP_USERS — dev mode, userId=selena");
      return "selena";
    }
    return unauthorized();
  }
  const pwd = m[1]!;
  // 1. 查 APP_USERS map（多租户）
  if (env.APP_USERS) {
    try {
      const map = JSON.parse(env.APP_USERS) as Record<string, string>;
      for (const [k, v] of Object.entries(map)) {
        if (safeEq(pwd, k)) {
          // 简单 sanitize：userId 只能 a-zA-Z0-9-_
          if (!/^[a-zA-Z0-9_-]{1,64}$/.test(v)) {
            console.error(`[getUserId] invalid userId in APP_USERS: ${v}`);
            return unauthorized();
          }
          return v;
        }
      }
    } catch (e) {
      console.error("[getUserId] APP_USERS parse failed:", (e as Error).message);
    }
  }
  // 2. fallback 老 APP_PASSWORD → userId="selena"（Selena 家保留 default）
  if (env.APP_PASSWORD && safeEq(pwd, env.APP_PASSWORD)) {
    return "selena";
  }
  return unauthorized();
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
