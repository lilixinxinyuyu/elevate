import { checkAuth, corsHeaders, jsonResponse, USER_KEY, type Env } from "../../_shared";

/**
 * GET /api/admin/list-reports
 *
 * v0.31.79: 列出用户报告的题目 + AI 修题前后状态。给 admin tab 的 reports 视图用。
 *
 * Query params:
 *   ?limit=50      （默认 50，最多 200）
 *   ?onlyFailed=1  （仅返回 ai_fix_succeeded=false）
 *   ?since=<ms>    （仅返回 created_at > since）
 *
 * Response:
 *   { ok: true, reports: [{ id, question_id, reason, reason_text, original, fixed,
 *      changes_summary, ai_fix_succeeded, llm_error, created_at }] }
 */

interface ReportRow {
  id: number;
  question_id: string;
  reason: string;
  reason_text: string | null;
  original_payload: string;
  fixed_payload: string | null;
  changes_summary: string | null;
  ai_fix_succeeded: number;
  llm_error: string | null;
  created_at: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;

  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
  const onlyFailed = url.searchParams.get("onlyFailed") === "1";
  const since = Number(url.searchParams.get("since") ?? 0);

  // 兼容：表可能还没创建（第一次 GET 时）
  try {
    await env.DB.exec(
      `CREATE TABLE IF NOT EXISTS question_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        question_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        reason_text TEXT,
        original_payload TEXT NOT NULL,
        fixed_payload TEXT,
        changes_summary TEXT,
        ai_fix_succeeded INTEGER NOT NULL DEFAULT 0,
        llm_error TEXT,
        created_at INTEGER NOT NULL
      )`.replace(/\s+/g, " ").trim(),
    );
  } catch {
    /* */
  }

  const conditions = ["user_key = ?"];
  const binds: (string | number)[] = [USER_KEY];
  if (onlyFailed) conditions.push("ai_fix_succeeded = 0");
  if (since > 0) {
    conditions.push("created_at > ?");
    binds.push(since);
  }
  const sql = `SELECT * FROM question_reports
               WHERE ${conditions.join(" AND ")}
               ORDER BY created_at DESC
               LIMIT ?`;
  binds.push(limit);

  let rows: ReportRow[] = [];
  try {
    const result = await env.DB.prepare(sql)
      .bind(...binds)
      .all<ReportRow>();
    rows = result.results ?? [];
  } catch (e) {
    return jsonResponse({ ok: false, error: "db_error", detail: (e as Error).message }, 500);
  }

  // Parse JSON payloads to objects
  const reports = rows.map((r) => {
    let original: unknown = null;
    let fixed: unknown = null;
    try {
      original = JSON.parse(r.original_payload);
    } catch {
      /* */
    }
    if (r.fixed_payload) {
      try {
        fixed = JSON.parse(r.fixed_payload);
      } catch {
        /* */
      }
    }
    return {
      id: r.id,
      question_id: r.question_id,
      reason: r.reason,
      reason_text: r.reason_text,
      original,
      fixed,
      changes_summary: r.changes_summary,
      ai_fix_succeeded: r.ai_fix_succeeded === 1,
      llm_error: r.llm_error,
      created_at: r.created_at,
    };
  });

  return jsonResponse({
    ok: true,
    count: reports.length,
    reports,
  });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
