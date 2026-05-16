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
 *
 * v0.33.58 (P0 sync fix): 支持 X-Body-Encoding: gzip 头，客户端可 gzip 压缩 body
 *   减少 payload size 避免 D1 单参数限制（~1-2MB）触发 500
 *   并改进错误处理：D1 INSERT 失败时返回具体错误而不是裸 500
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;

  // v0.33.58: 读 body — 如果有 X-Body-Encoding: gzip 头则先解压
  let bodyText: string;
  try {
    const encoding = request.headers.get("X-Body-Encoding");
    if (encoding === "gzip") {
      // Worker runtime 内置 DecompressionStream
      const decompressed = request.body!.pipeThrough(new DecompressionStream("gzip"));
      bodyText = await new Response(decompressed).text();
    } else {
      bodyText = await request.text();
    }
  } catch (e) {
    return jsonResponse(
      { ok: false, error: "body_read_failed", detail: (e as Error).message },
      400,
    );
  }

  let body: UploadBody;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body || typeof body.payload !== "object") {
    return jsonResponse({ ok: false, error: "missing_payload" }, 400);
  }

  // v0.33.58: 计算 JSON 化 payload 大小，便于诊断 D1 超限
  const payloadJson = JSON.stringify(body.payload);
  const payloadBytes = payloadJson.length;

  await ensureSchema(env.DB);
  const now = Date.now();

  // v0.33.58: 包裹 D1 调用 try/catch，超限时返回具体错误
  try {
    await env.DB
      .prepare(
        `INSERT INTO snapshots (user_key, payload, attempts_count, sessions_count, total_xp, client_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        USER_KEY,
        payloadJson,
        body.attemptsCount ?? 0,
        body.sessionsCount ?? 0,
        body.totalXp ?? 0,
        body.clientId ?? null,
        now,
      )
      .run();
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error(`[upload] D1 INSERT failed (payload=${payloadBytes} bytes):`, msg);
    return jsonResponse(
      {
        ok: false,
        error: "d1_insert_failed",
        detail: msg.slice(0, 240),
        payloadBytes,
        hint:
          payloadBytes > 1_000_000
            ? "payload 超过 1MB 接近 D1 单参数限制，建议管理页清缓存或拆批"
            : undefined,
      },
      500,
    );
  }

  // 历史保留最近 50 个；多了就清旧的
  try {
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
  } catch (e) {
    // 清理失败不影响成功响应；只 log
    console.warn("[upload] cleanup failed:", (e as Error).message);
  }

  return jsonResponse({ ok: true, version: now, payloadBytes });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
