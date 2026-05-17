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

export default auth;
