import { checkAuth, corsHeaders, ensureSchema, jsonResponse, USER_KEY, type Env } from "../../_shared";

/**
 * GET /api/sync/download[?since=<ms>]
 * 拉取最新快照。若 since 给定且最新版本不晚于它，返回 { ok:true, latest:null }。
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  await ensureSchema(env.DB);

  const url = new URL(request.url);
  const since = Number(url.searchParams.get("since") ?? 0);

  const row = await env.DB
    .prepare(
      `SELECT id, payload, attempts_count, sessions_count, total_xp, client_id, created_at
       FROM snapshots
       WHERE user_key = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(USER_KEY)
    .first<{
      id: number;
      payload: string;
      attempts_count: number;
      sessions_count: number;
      total_xp: number;
      client_id: string | null;
      created_at: number;
    }>();

  if (!row) return jsonResponse({ ok: true, latest: null });

  if (since && row.created_at <= since) {
    return jsonResponse({ ok: true, latest: null, currentVersion: row.created_at });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    return jsonResponse({ ok: false, error: "corrupt_snapshot" }, 500);
  }

  return jsonResponse({
    ok: true,
    latest: {
      id: row.id,
      payload,
      attemptsCount: row.attempts_count,
      sessionsCount: row.sessions_count,
      totalXp: row.total_xp,
      clientId: row.client_id,
      version: row.created_at,
    },
  });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
