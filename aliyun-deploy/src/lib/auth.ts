/**
 * 多租户鉴权：subdomain + password → userId
 *
 * 两套互相配合：
 *   1. **Subdomain** 声明"我是谁"：
 *      - `selena.xiaojin.app` → claim userId="selena"
 *      - `alice.xiaojin.app`  → claim userId="alice"
 *      - `xiaojin.app` / `www.xiaojin.app` / `api.xiaojin.app` → 无 claim
 *
 *   2. **Password** 证明"对得上"：
 *      - APP_USERS map 查 password → 真实 userId
 *      - 老 APP_PASSWORD 单 fallback → userId="selena"
 *      - 如果 subdomain 有 claim 但 password 解出来的 userId 跟 claim 不一致 → 401
 *
 * 这样别人就算瞎拼 alice.xiaojin.app 也进不来 Alice 的数据（除非有 Alice 的密码）。
 *
 * 加新同学走 `scripts/add-student.mjs`，自动 patch .dev.vars + 重 deploy。
 */

import type { Context } from "hono";
import type { Env } from "./env";
import { readEffectivePasswords } from "./auth-store";

export function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** 校验 userId 是不是合法 slug */
function isValidUserId(v: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(v);
}

/** Host header 里抽 subdomain。返回 null 表示 apex / www / api 等无 claim 域名 */
export function extractSubdomainUserId(host: string): string | null {
  // host 可能含 :port，先去掉
  const h = host.split(":")[0]!.toLowerCase();
  // apex
  if (h === "xiaojin.app" || h === "www.xiaojin.app") return null;
  // 单层子域
  const m = /^([a-zA-Z0-9_-]{1,64})\.xiaojin\.app$/.exec(h);
  if (!m) return null;
  const sub = m[1]!;
  // 保留字：api / www / mail / admin —— 不当 userId
  if (["api", "www", "mail", "admin", "static", "cdn", "assets", "edge"].includes(sub)) {
    return null;
  }
  return sub;
}

/**
 * 把 password 查映射到 userId。返回 null 表示密码不对。
 *
 * v0.34.17 (Ep147): 改成 async，先查 OSS _auth/users.json（动态、可改），
 * 没找到再回 baked APP_USERS + APP_PASSWORD（启动种子）。
 *
 * OSS 优先就支持了 super-admin 在线重置密码（不用 redeploy）。
 */
async function passwordToUserId(pwd: string, env: Env): Promise<string | null> {
  // 1. OSS 动态 store + baked merge
  try {
    const map = await readEffectivePasswords(env);
    for (const [k, v] of Object.entries(map)) {
      if (safeEq(pwd, k)) {
        if (!isValidUserId(v)) {
          console.error(`[auth] invalid userId in store: ${v}`);
          return null;
        }
        return v;
      }
    }
  } catch (e) {
    console.error("[auth] auth-store read failed:", (e as Error).message);
  }
  return null;
}

/**
 * 解析当前请求的 userId。
 *
 * 优先级：
 *   1. subdomain claim + password 匹配 → claim userId
 *   2. subdomain claim + password 不匹配 → null (401)
 *   3. 无 subdomain claim + password 解出 userId → 用 password 的 userId
 *   4. 无 password 且没设 APP_PASSWORD/APP_USERS（dev mode）→ "selena"
 *   5. 其他 → null
 */
export async function resolveUserId(req: Request, env: Env): Promise<string | null> {
  const host = req.headers.get("Host") ?? "";
  const subClaim = extractSubdomainUserId(host);

  const auth = req.headers.get("Authorization") ?? "";
  const m = /^Bearer\s+(.+)$/.exec(auth);
  if (!m) {
    // dev mode：环境完全没配密码 → "selena"
    if (!env.APP_PASSWORD && !env.APP_USERS) {
      console.warn("[auth] no APP_PASSWORD / APP_USERS — dev mode, userId=selena");
      return "selena";
    }
    return null;
  }
  const pwd = m[1]!;
  const pwdUserId = await passwordToUserId(pwd, env);
  if (!pwdUserId) return null;

  // subdomain 声明必须跟 password 解出来的对上
  if (subClaim && subClaim !== pwdUserId) {
    console.warn(`[auth] subdomain claim '${subClaim}' != password userId '${pwdUserId}' — denying`);
    return null;
  }
  return pwdUserId;
}

/**
 * hono middleware：校验 Authorization，set c.var.userId。
 * 不通过直接 401。
 */
export async function requireAuth(
  c: Context<{ Bindings: Env; Variables: { userId: string } }>,
  next: () => Promise<void>,
): Promise<Response | void> {
  const userId = await resolveUserId(c.req.raw, c.env);
  if (!userId) {
    return c.json({ ok: false, error: "unauthorized" }, 401);
  }
  c.set("userId", userId);
  await next();
}

export function getUserId(
  c: Context<{ Bindings: Env; Variables: { userId: string } }>,
): string {
  return c.var.userId;
}
