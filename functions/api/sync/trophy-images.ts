/**
 * 单独的 trophy-images 跨设备同步 endpoint。
 *
 * 背景：v0.29.4 把 trophyImages 加进主 sync payload 后实测 cloud 500 ——
 * Cloudflare D1 单 bound 参数大小有限制（实测 2.77 MB → "Worker threw exception"）。
 * 主 sync upload 的 INSERT 把整个 payload 作为一个 TEXT 参数 bind，超限崩。
 *
 * 解法：trophyImages 拆出来，每张图存 D1 trophy_images 表里一行（每张 ~30 KB）。
 * 主 sync 只带 attempts/mastery/etc 数据（< 1 MB），不带 trophyImages。
 *
 * Schema:
 *   CREATE TABLE trophy_images (
 *     user_key TEXT NOT NULL,
 *     trophy_id TEXT NOT NULL,
 *     payload TEXT NOT NULL,  -- JSON of full TrophyImageRow
 *     updated_at INTEGER NOT NULL,
 *     PRIMARY KEY (user_key, trophy_id)
 *   );
 *
 * Endpoints：
 *   POST /api/sync/trophy-images
 *     Body: { rows: [{ trophyId, subjectId, imageDataUrl, prompt?, model?, generatedAt, isLottery?, sourceUrl? }, ...] }
 *     → upsert each. 单批最多 30 张（避免 SQL transaction 太长）。
 *   GET /api/sync/trophy-images?since=<ms>
 *     → 返回 { rows: [...] }，可按 since 增量拉。
 */

import { checkAuth, corsHeaders, jsonResponse, USER_KEY, type Env } from "../../_shared";

async function ensureSchema(db: D1Database) {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS trophy_images (
      user_key TEXT NOT NULL,
      trophy_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_key, trophy_id)
    )`.replace(/\s+/g, " ").trim(),
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_trophy_images_updated ON trophy_images (user_key, updated_at)`,
  );
}

interface UploadRow {
  trophyId: string;
  subjectId?: string;
  imageDataUrl: string;
  prompt?: string;
  model?: string;
  generatedAt?: number;
  isLottery?: boolean;
  sourceUrl?: string;
}

const MAX_BATCH = 30;
const MAX_ROW_BYTES = 500 * 1024; // 500 KB per row sanity check

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
  const rejected: { trophyId: string; reason: string }[] = [];

  for (const row of body.rows) {
    if (!row.trophyId || typeof row.trophyId !== "string") {
      rejected.push({ trophyId: String(row.trophyId), reason: "missing_trophyId" });
      continue;
    }
    if (!row.imageDataUrl || typeof row.imageDataUrl !== "string") {
      rejected.push({ trophyId: row.trophyId, reason: "missing_imageDataUrl" });
      continue;
    }
    const payloadJson = JSON.stringify(row);
    if (payloadJson.length > MAX_ROW_BYTES) {
      rejected.push({
        trophyId: row.trophyId,
        reason: `row_too_big_${payloadJson.length}B (max ${MAX_ROW_BYTES})`,
      });
      continue;
    }
    try {
      // v0.31.79：keep-newer-by-generatedAt 守门
      // 之前：UPSERT 无条件覆盖。问题：客户端 push 包含 ALL local trophyImages，
      //   如果 Selena 本地 Dexie 还有旧 JPEG（没 pull 新 PNG）→ push 覆盖 D1 PNG。
      //   admin 用 OpenCV 处理后 push 的透明 PNG 被一次 Selena's session 写回。
      // 修：incoming.generatedAt >= existing.generatedAt 才 UPSERT；否则保留 existing。
      const incomingGenAt =
        typeof row.generatedAt === "number" ? row.generatedAt : 0;
      const existing = await env.DB.prepare(
        `SELECT payload FROM trophy_images WHERE user_key = ? AND trophy_id = ?`,
      )
        .bind(USER_KEY, row.trophyId)
        .first<{ payload: string }>();
      let existingGenAt = 0;
      if (existing?.payload) {
        try {
          const parsed = JSON.parse(existing.payload);
          existingGenAt =
            typeof parsed?.generatedAt === "number" ? parsed.generatedAt : 0;
        } catch {
          /* */
        }
      }
      if (existing && existingGenAt > incomingGenAt) {
        // 旧的 incoming，跳过覆盖
        rejected.push({
          trophyId: row.trophyId,
          reason: `older_than_existing (incoming=${incomingGenAt} < existing=${existingGenAt})`,
        });
        continue;
      }
      await env.DB.prepare(
        `INSERT INTO trophy_images (user_key, trophy_id, payload, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_key, trophy_id) DO UPDATE SET
           payload = excluded.payload,
           updated_at = excluded.updated_at`,
      )
        .bind(USER_KEY, row.trophyId, payloadJson, now)
        .run();
      accepted.push(row.trophyId);
    } catch (e) {
      rejected.push({
        trophyId: row.trophyId,
        reason: `db_error: ${(e as Error).message}`,
      });
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

  const result = await env.DB.prepare(
    `SELECT trophy_id, payload, updated_at FROM trophy_images
     WHERE user_key = ? AND updated_at > ?
     ORDER BY trophy_id`,
  )
    .bind(USER_KEY, since)
    .all<{ trophy_id: string; payload: string; updated_at: number }>();

  const rows = (result.results ?? [])
    .map((r) => {
      try {
        return JSON.parse(r.payload);
      } catch {
        return null;
      }
    })
    .filter((x): x is UploadRow => x != null);

  return jsonResponse({ ok: true, rows, version: Date.now() });
};

/**
 * DELETE /api/sync/trophy-images
 *
 * Body: { trophyIds: string[] }  // 最多 30 个
 *
 * 删 cloud D1 里指定 trophyId 的 row。本地 db.trophyImages 不连带删（调用方自己负责）。
 * 用途：admin 清理临时 inspect/ dump 行；旧 trophy 重命名时迁移。
 */
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  await ensureSchema(env.DB);

  let body: { trophyIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  if (!Array.isArray(body.trophyIds) || body.trophyIds.length === 0) {
    return jsonResponse({ ok: false, error: "missing_trophyIds" }, 400);
  }
  if (body.trophyIds.length > 30) {
    return jsonResponse({ ok: false, error: "batch_too_large" }, 400);
  }

  const deleted: string[] = [];
  for (const id of body.trophyIds) {
    if (typeof id !== "string" || !id) continue;
    try {
      const r = await env.DB.prepare(
        "DELETE FROM trophy_images WHERE user_key = ? AND trophy_id = ?",
      )
        .bind(USER_KEY, id)
        .run();
      // D1 type doesn't expose .changes; just record attempt as success
      if (r.success) deleted.push(id);
    } catch {
      // skip
    }
  }
  return jsonResponse({ ok: true, deleted });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: { ...corsHeaders, "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS" },
  });
