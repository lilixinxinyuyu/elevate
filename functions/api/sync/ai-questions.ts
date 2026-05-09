/**
 * v0.31.65: AI 生成的题独立同步端点（仿 trophy-images）。
 *
 * 背景：v0.31.52 把 aiQuestions 加进主 sync payload。问题：每次 push 都附带
 * **完整 aiQuestions 数组**。526 道 ≈ 1.3 MB + 其他数据 = 主 snapshot 接近
 * D1 单参数 ~2 MB 上限 → 上传 500。
 *
 * 解法：每道 AI 题存一行 ai_questions 表（每行 ~2-3 KB），跟主 sync 解耦。
 * cloudSync 客户端从两端拉合并。
 *
 * Schema:
 *   CREATE TABLE ai_questions (
 *     user_key TEXT NOT NULL,
 *     question_id TEXT NOT NULL,
 *     payload TEXT NOT NULL,  -- 完整 Question JSON
 *     updated_at INTEGER NOT NULL,
 *     PRIMARY KEY (user_key, question_id)
 *   )
 *
 * Endpoints:
 *   POST /api/sync/ai-questions
 *     Body: { rows: [Question, ...] }   // 单批最多 50
 *     → upsert each by question_id
 *   GET /api/sync/ai-questions[?since=<ms>]
 *     → 返回 { rows: [Question, ...] }
 *   POST /api/sync/ai-questions/delete
 *     Body: { ids: ["AI_xxx", ...] }
 *     → 用于 admin 删 AI 题（写到 deleted 列表，跨设备同步删除）
 */

import { checkAuth, corsHeaders, jsonResponse, USER_KEY, type Env } from "../../_shared";

async function ensureSchema(db: D1Database) {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS ai_questions (
      user_key TEXT NOT NULL,
      question_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_key, question_id)
    )`.replace(/\s+/g, " ").trim(),
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_ai_questions_updated ON ai_questions (user_key, updated_at)`,
  );
}

const MAX_BATCH = 50;
const MAX_ROW_BYTES = 30 * 1024; // 30 KB per question row（充分大，正常题 2-3KB）

interface UploadRow {
  question_id?: string;
  [k: string]: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  await ensureSchema(env.DB);

  let body: { rows?: UploadRow[] };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return jsonResponse({ ok: false, error: "missing_rows" }, 400);
  }
  if (body.rows.length > MAX_BATCH) {
    return jsonResponse(
      { ok: false, error: `batch_too_large: max ${MAX_BATCH}, got ${body.rows.length}` },
      400,
    );
  }

  const now = Date.now();
  const accepted: string[] = [];
  const rejected: { question_id: string; reason: string }[] = [];

  for (const row of body.rows) {
    const qid = typeof row.question_id === "string" ? row.question_id : "";
    if (!qid) {
      rejected.push({ question_id: String(row.question_id), reason: "missing_question_id" });
      continue;
    }
    const payloadJson = JSON.stringify(row);
    if (payloadJson.length > MAX_ROW_BYTES) {
      rejected.push({
        question_id: qid,
        reason: `row_too_big_${payloadJson.length}B (max ${MAX_ROW_BYTES})`,
      });
      continue;
    }
    try {
      await env.DB
        .prepare(
          `INSERT INTO ai_questions (user_key, question_id, payload, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(user_key, question_id) DO UPDATE SET
             payload = excluded.payload,
             updated_at = excluded.updated_at`,
        )
        .bind(USER_KEY, qid, payloadJson, now)
        .run();
      accepted.push(qid);
    } catch (e) {
      rejected.push({ question_id: qid, reason: `db_error: ${(e as Error).message}` });
    }
  }

  return jsonResponse({ ok: true, accepted: accepted.length, rejected, version: now });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  await ensureSchema(env.DB);

  const url = new URL(request.url);
  const since = Number(url.searchParams.get("since") ?? 0);

  const result = await env.DB
    .prepare(
      `SELECT question_id, payload, updated_at FROM ai_questions
       WHERE user_key = ? AND updated_at > ?
       ORDER BY question_id`,
    )
    .bind(USER_KEY, since)
    .all<{ question_id: string; payload: string; updated_at: number }>();

  const rows = (result.results ?? [])
    .map((r) => {
      try {
        return JSON.parse(r.payload);
      } catch {
        return null;
      }
    })
    .filter((r): r is Record<string, unknown> => r !== null);

  return jsonResponse({ ok: true, rows, latestVersion: Date.now() });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
