/**
 * 多租户鉴权：Authorization: Bearer <password> → userId
 *
 * 移植自 functions/_shared.ts 的 getUserId。
 */

import type { Context } from "hono";
import type { Env } from "./env";

export function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** 从 Authorization 头解析 userId；返回 null 表示未授权（调用方负责回 401） */
export function resolveUserId(req: Request, env: Env): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  const m = /^Bearer\s+(.+)$/.exec(auth);
  if (!m) {
    if (!env.APP_PASSWORD && !env.APP_USERS) {
      console.warn("[auth] no APP_PASSWORD / APP_USERS — dev mode, userId=selena");
      return "selena";
    }
    return null;
  }
  const pwd = m[1]!;
  // 1. 多租户 map
  if (env.APP_USERS) {
    try {
      const map = JSON.parse(env.APP_USERS) as Record<string, string>;
      for (const [k, v] of Object.entries(map)) {
        if (safeEq(pwd, k)) {
          if (!/^[a-zA-Z0-9_-]{1,64}$/.test(v)) {
            console.error(`[auth] invalid userId in APP_USERS: ${v}`);
            return null;
          }
          return v;
        }
      }
    } catch (e) {
      console.error("[auth] APP_USERS parse failed:", (e as Error).message);
    }
  }
  // 2. fallback 单家庭 password（向后兼容 Selena 家）
  if (env.APP_PASSWORD && safeEq(pwd, env.APP_PASSWORD)) {
    return "selena";
  }
  return null;
}

/**
 * hono middleware: 校验 Authorization，set c.var.userId。
 * 不通过直接 401。
 */
export async function requireAuth(
  c: Context<{ Bindings: Env; Variables: { userId: string } }>,
  next: () => Promise<void>,
): Promise<Response | void> {
  const userId = resolveUserId(c.req.raw, c.env);
  if (!userId) {
    return c.json({ ok: false, error: "unauthorized" }, 401);
  }
  c.set("userId", userId);
  await next();
}

/** 从 hono Context 取出当前 userId（必经 requireAuth） */
export function getUserId(
  c: Context<{ Bindings: Env; Variables: { userId: string } }>,
): string {
  return c.var.userId;
}
