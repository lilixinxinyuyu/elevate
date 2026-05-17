/**
 * Auth 路由：check 当前密码是否能换出 userId（前端登录用）
 *
 * 对齐老 CF Pages 协议：
 *   POST /api/auth/check
 *   Header: Authorization: Bearer <password>
 *   Body: 无
 *   Resp: 200 {ok:true, userId} 或 401 {ok:false, error}
 *
 * 注：不挂 requireAuth middleware（要让 401 返回受控错误，而不是裸 401）
 */
import { Hono } from "hono";
import { type Env } from "../lib/env";
import { resolveUserId, extractSubdomainUserId, passwordToUserId } from "../lib/auth";
import { changePasswordForUser } from "../lib/auth-store";

const auth = new Hono<{ Bindings: Env }>();

auth.post("/check", async (c) => {
  const userId = await resolveUserId(c.req.raw, c.env);
  if (userId) return c.json({ ok: true, userId });

  // Ep 爸爸-2026-05-17: distinguish cross-subdomain mismatch from real bad-pwd.
  // If password resolves to userId X but request came from sub Y → return rich
  // error so client can show "you should go to X.xiaojin.app" instead of misleading
  // "密码不对".
  const host = c.req.raw.headers.get("Host") ?? "";
  const subClaim = extractSubdomainUserId(host);
  const authHeader = c.req.raw.headers.get("Authorization") ?? "";
  const m = /^Bearer\s+(.+)$/.exec(authHeader);
  if (m && subClaim) {
    const pwdUserId = await passwordToUserId(m[1]!, c.env);
    if (pwdUserId && pwdUserId !== subClaim) {
      // 200 not 401 — payload IS the answer, just not "ok"
      return c.json({
        ok: false,
        error: "wrong_subdomain",
        intendedFor: pwdUserId,
        currentSubdomain: subClaim,
      });
    }
  }
  return c.json({ ok: false, error: "unauthorized" }, 401);
});

/**
 * v0.34.69 iter 3: 同学自己改密码 (从 Settings 页发).
 *
 * POST /api/auth/change-password
 * Header: Authorization: Bearer <currentPassword>
 * Body: { newPassword: string }
 *
 * 校验:
 *   - currentPassword 必须 resolve 出 userId (否则 401)
 *   - newPassword 6-64 ASCII printable
 *   - 不能跟其他 userId 已用密码冲突
 *
 * 成功返 { ok: true, rotated: N } — 客户端用 newPassword 替代 localStorage 存的旧密码.
 * 旧密码立即失效 (changePasswordForUser 会清掉同 userId 的所有老 password 行).
 */
auth.post("/change-password", async (c) => {
  const userId = await resolveUserId(c.req.raw, c.env);
  if (!userId) return c.json({ ok: false, error: "unauthorized" }, 401);
  let body: { newPassword?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  const newPassword = (body?.newPassword ?? "").trim();
  if (!newPassword) return c.json({ ok: false, error: "missing_newPassword" }, 400);
  const r = await changePasswordForUser(c.env, userId, newPassword);
  if (!r.ok) return c.json({ ok: false, error: r.error }, 400);
  return c.json({ ok: true, rotated: r.rotated, userId });
});

export default auth;
