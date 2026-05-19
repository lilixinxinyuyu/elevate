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

/**
 * v0.34.30 (Ep159): 预留 subdomain 大单。
 * 任何同学创建账号时这些 userId 全拒，防止：
 *   - 占用我们未来要用的系统域 (api / admin / dashboard / agent...)
 *   - 占用通用 marketing / auth / status 域
 *   - 占用品牌词 (xiaojin / selena, Selena 是 legacy 默认家)
 *   - 中文 / 1-2 字符 / 全数字（含 unicode）默认拒
 *
 * 任何子域 host 也走这个列表 → null userId（不能 claim）。
 *
 * 注：Selena 是 legacy 默认家的 userId（APP_PASSWORD fallback），所以这里
 * 不能拒 "selena"（会自家撞）。但禁止再有新同学拿到 "selena" userId（在
 * addNewStudent 里另外卡）。
 */
export const RESERVED_SUBDOMAINS = new Set([
  // 系统 / 基础设施
  "api", "www", "mail", "admin", "dashboard", "console", "ops", "operator",
  "system", "super", "superadmin", "root", "host", "hostmaster", "webmaster",
  "postmaster", "abuse", "security", "monitor", "monitoring", "log", "logs",
  "status", "health", "metrics", "ping", "edge", "cdn", "static", "assets",
  "media", "files", "img", "images", "video", "audio",
  // 认证 / 账户
  "auth", "login", "signin", "sso", "oauth", "identity", "account",
  "accounts", "register", "signup", "join", "password", "reset",
  // 邮件 / 通信
  "smtp", "imap", "pop", "pop3", "ws", "wss", "websocket",
  // 应用入口 / Marketing
  "app", "web", "mobile", "ios", "android", "home", "landing",
  "marketing", "about", "contact", "terms", "privacy", "legal",
  "support", "help", "docs", "doc", "wiki", "blog", "news", "changelog",
  // 开发环境
  "dev", "develop", "staging", "stage", "test", "qa", "beta", "alpha",
  "preview", "sandbox", "demo", "canary",
  // AI / agent / 未来产品入口
  "ai", "agent", "bot", "chat", "voice", "tutor", "teacher", "coach",
  "tts", "stt", "asr",
  // 品牌词（防混淆）
  "xiaojin", "elevate", "official", "verified",
  // 通用 noise
  "null", "undefined", "default", "guest", "anonymous", "anon",
  "everyone", "all", "nobody",
  // 1-2 字母 / 数字（粗略防短码占用）
  "a", "b", "c", "i", "x", "z",
  "ad", "ai", "an", "am", "at", "av", "ax", "be", "bi", "bo", "by",
  "co", "cs", "di", "do", "eh", "el", "em", "en", "ex",
  "fa", "fi", "fy", "go", "hi", "id", "if", "in", "is", "it",
  "jo", "ju", "ka", "ki", "la", "lo", "ma", "me", "mi", "mo", "my",
  "na", "no", "nu", "of", "oh", "ok", "on", "or", "ow", "ox",
  "pa", "pi", "qi", "ra", "re", "rx", "sh", "so", "to", "ug",
  "um", "un", "up", "us", "vi", "vs", "we", "wo", "ya", "ye", "yo",
  "ad",
]);

/** Host header 里抽 subdomain。返回 null 表示 apex / 系统域 等无 claim */
export function extractSubdomainUserId(host: string): string | null {
  // host 可能含 :port，先去掉
  const h = host.split(":")[0]!.toLowerCase();
  // apex
  if (h === "xiaojin.app" || h === "www.xiaojin.app") return null;
  // 单层子域
  const m = /^([a-zA-Z0-9_-]{1,64})\.xiaojin\.app$/.exec(h);
  if (!m) return null;
  const sub = m[1]!;
  // 保留字 — 不当 userId claim
  if (RESERVED_SUBDOMAINS.has(sub)) {
    return null;
  }
  return sub;
}

/** 给 add-student / API 校验：返 true 表示这个 userId **不允许**给同学用 */
export function isReservedUserId(userId: string): boolean {
  const lc = userId.toLowerCase();
  return RESERVED_SUBDOMAINS.has(lc);
}

/**
 * 把 password 查映射到 userId。返回 null 表示密码不对。
 *
 * v0.34.17 (Ep147): 改成 async，先查 OSS _auth/users.json（动态、可改），
 * 没找到再回 baked APP_USERS + APP_PASSWORD（启动种子）。
 *
 * OSS 优先就支持了 super-admin 在线重置密码（不用 redeploy）。
 */
export async function passwordToUserId(pwd: string, env: Env): Promise<string | null> {
  // v0.36.10 (爸爸 P0 perf audit): 先 check baked (0ms), 再 fallback OSS (1-2s).
  // 99% traffic 是 Selena 用 APP_PASSWORD, 直接命中 baked, 永远不 hit OSS.
  // 只有其他同学 (super-admin 加的) 走 OSS 查. cold start 11s spike 大幅减少.

  // 1a. Baked APP_PASSWORD (legacy Selena)
  if (env.APP_PASSWORD && safeEq(pwd, env.APP_PASSWORD)) {
    return "selena";
  }
  // 1b. Baked APP_USERS map (静态多租户)
  if (env.APP_USERS) {
    try {
      const map = JSON.parse(env.APP_USERS) as Record<string, string>;
      for (const [k, v] of Object.entries(map)) {
        if (safeEq(pwd, k)) {
          if (!isValidUserId(v)) {
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

  // 2. OSS 动态 store (super-admin 加的同学 / 用户自改密码)
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
