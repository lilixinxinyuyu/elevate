import { checkAuth, corsHeaders, ensureSchema, jsonResponse, USER_KEY, type Env } from "../../_shared";

interface UploadBody {
  payload: Record<string, unknown>;     // 全量 IndexedDB JSON：{ attempts, mastery, mistakes, ... }
  attemptsCount?: number;
  sessionsCount?: number;
  totalXp?: number;
  clientId?: string;
}

/**
 * POST /api/sync/upload
 * 全量上传一份 IndexedDB 快照。每次都新增一行（保留历史，方便后续 Agent 看进度）。
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;

  let body: UploadBody;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body || typeof body.payload !== "object") {
    return jsonResponse({ ok: false, error: "missing_payload" }, 400);
  }
  await ensureSchema(env.DB);
  const now = Date.now();

  await env.DB
    .prepare(
      `INSERT INTO snapshots (user_key, payload, attempts_count, sessions_count, total_xp, client_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      USER_KEY,
      JSON.stringify(body.payload),
      body.attemptsCount ?? 0,
      body.sessionsCount ?? 0,
      body.totalXp ?? 0,
      body.clientId ?? null,
      now,
    )
    .run();

  // 历史保留最近 50 个；多了就清旧的
  await env.DB
    .prepare(
      `DELETE FROM snapshots
       WHERE user_key = ?1
         AND id NOT IN (
           SELECT id FROM snapshots WHERE user_key = ?1 ORDER BY created_at DESC LIMIT 50
         )`,
    )
    .bind(USER_KEY)
    .run();

  return jsonResponse({ ok: true, version: now });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
