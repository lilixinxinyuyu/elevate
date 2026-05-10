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
import { sanitizeRow, type UploadRow } from "../../_sanitize";

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

// v0.31.80：服务端 sanitize 抽到 functions/_sanitize.ts 共享。本文件只用 sanitizeRow。
// v0.31.86：扩展 sanitize 覆盖 stem / subq.prompt / option.text。

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
  const skippedStale: string[] = [];

  // v0.31.86: keep-newer guard — Selena 的 stale PWA push 旧 row 不应该覆盖
  //   server 上更新过的版本（之前 trophy_images 已加了平行守门，这里漏了）。
  //   Question.version 在 fix-question 路径会 +1，作为对比依据。
  //   没有 version 字段的（老题）走原来的覆盖语义（任何写入都接受）。
  const qids = body.rows
    .map((r) => (typeof r.question_id === "string" ? r.question_id : ""))
    .filter((s) => s.length > 0);
  const existingMap = new Map<string, { version: number; updated_at: number }>();
  if (qids.length > 0) {
    const placeholders = qids.map(() => "?").join(",");
    const existRes = await env.DB
      .prepare(
        `SELECT question_id, payload, updated_at FROM ai_questions
         WHERE user_key = ? AND question_id IN (${placeholders})`,
      )
      .bind(USER_KEY, ...qids)
      .all<{ question_id: string; payload: string; updated_at: number }>();
    for (const r of existRes.results ?? []) {
      let version = 0;
      try {
        const parsed = JSON.parse(r.payload) as { version?: number };
        version = typeof parsed.version === "number" ? parsed.version : 0;
      } catch {
        // 老 row 解不开就当 version=0
      }
      existingMap.set(r.question_id, { version, updated_at: r.updated_at });
    }
  }

  for (const rawRow of body.rows) {
    const qid = typeof rawRow.question_id === "string" ? rawRow.question_id : "";
    if (!qid) {
      rejected.push({ question_id: String(rawRow.question_id), reason: "missing_question_id" });
      continue;
    }
    // v0.31.80：服务端 sanitize — strip leak 模式（无关 / errorTag 等）
    const row = sanitizeRow(rawRow);
    // v0.31.86: keep-newer 检查
    const existing = existingMap.get(qid);
    if (existing) {
      const incomingVersion =
        typeof row.version === "number" ? (row.version as number) : 0;
      // 版本严格小于已存的 → stale，跳过；等于的允许（同版本可能补字段）；大于的接受
      if (incomingVersion > 0 && existing.version > 0 && incomingVersion < existing.version) {
        skippedStale.push(qid);
        continue;
      }
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

  return jsonResponse({
    ok: true,
    accepted: accepted.length,
    rejected,
    skippedStale,
    version: now,
  });
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

/**
 * v0.31.87: DELETE /api/sync/ai-questions
 *   Body: { ids: ["AI_xxx", ...] }   // up to MAX_BATCH per call
 *
 * 用于：
 *   - admin 删 AI 题（cull 过量 / 删除 user-reported 错题）
 *   - cull 脚本（_cull-overpopulated-skills.mjs --apply）
 *
 * 注意：D1 删除是物理删（不写 deleted 列表 — 跨设备同步靠 PWA 下次 pull 时
 * /api/sync/ai-questions GET 重新拉 = 不在结果集 = 客户端会自动从 IndexedDB
 * 移除（applyPayloadMerged 走 union 但 questions 表会 merge by question_id）。
 * 实际上需要客户端 explicit 看到这是"被删了"的状态——为了简单这里先物理删，
 * 客户端 stale 的话 PWA 下次启动 pull 会自动同步。
 */
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  await ensureSchema(env.DB);

  let body: { ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return jsonResponse({ ok: false, error: "missing_ids" }, 400);
  }
  if (body.ids.length > MAX_BATCH) {
    return jsonResponse(
      { ok: false, error: `batch_too_large: max ${MAX_BATCH}` },
      400,
    );
  }

  const ids = body.ids.filter((s): s is string => typeof s === "string" && s.length > 0);
  if (ids.length === 0) {
    return jsonResponse({ ok: false, error: "no_valid_ids" }, 400);
  }

  const placeholders = ids.map(() => "?").join(",");
  await env.DB
    .prepare(
      `DELETE FROM ai_questions WHERE user_key = ? AND question_id IN (${placeholders})`,
    )
    .bind(USER_KEY, ...ids)
    .run();

  return jsonResponse({ ok: true, deleted: ids.length });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
