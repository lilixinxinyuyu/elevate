import { checkAuth, corsHeaders, jsonResponse, type Env } from "../../_shared";

/**
 * POST /api/auth/check
 * Body: 无（密码通过 Authorization: Bearer <pwd> 头）
 * 用于客户端 AuthGate 启动时验证密码。
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  return jsonResponse({ ok: true });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
