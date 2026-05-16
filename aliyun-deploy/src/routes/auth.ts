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
import { resolveUserId } from "../lib/auth";

const auth = new Hono<{ Bindings: Env }>();

auth.post("/check", async (c) => {
  const userId = await resolveUserId(c.req.raw, c.env);
  if (!userId) return c.json({ ok: false, error: "unauthorized" }, 401);
  return c.json({ ok: true, userId });
});

export default auth;
