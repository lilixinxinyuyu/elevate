/**
 * Cloudflare Pages Functions 共用工具。
 *
 * 环境变量（在 Cloudflare Pages 设置里配）：
 *   APP_PASSWORD     - 单密码，给 Selena 自己用（家长设置）
 *   DB               - D1 binding（在 Pages → Settings → Functions → D1 database bindings）
 */

export interface Env {
  APP_PASSWORD: string;
  DB: D1Database;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
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
