/**
 * POST /api/sync/oss/upload
 *
 * v0.33.59 (Ep132): 新主路径 — 上传 snapshot 到阿里云 OSS（替代 D1 主存）。
 *
 * - Auth: getUserId(req, env) → 推出 userId (multi-tenant)
 * - OSS key: users/{userId}/snapshot.json
 * - 支持 X-Body-Encoding: gzip（client 压缩 body 降带宽）
 * - 没限制 payload size（OSS 单对象 5GB）
 * - 失败返回 5xx + 具体 detail，方便客户端 fallback D1
 */

import { corsHeaders, getUserId, jsonResponse, type Env } from "../../../_shared";
import { getOssConfig, ossPut, snapshotKey } from "../../../_oss";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const u = getUserId(request, env);
  if (u instanceof Response) return u;
  const userId = u;

  const cfg = getOssConfig(env);
  if (!cfg) {
    return jsonResponse(
      { ok: false, error: "oss_not_configured", detail: "ALIYUN_OSS_* env vars missing" },
      503,
    );
  }

  // 读 body — 支持 gzip
  let bodyText: string;
  try {
    const enc = request.headers.get("X-Body-Encoding");
    if (enc === "gzip") {
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

  // 校验是合法 JSON
  try {
    const parsed = JSON.parse(bodyText);
    if (!parsed || typeof parsed !== "object") {
      return jsonResponse({ ok: false, error: "invalid_payload" }, 400);
    }
  } catch (e) {
    return jsonResponse(
      { ok: false, error: "invalid_json", detail: (e as Error).message },
      400,
    );
  }

  // PUT to OSS
  const key = snapshotKey(userId);
  const r = await ossPut(cfg, key, bodyText, { contentType: "application/json; charset=utf-8" });
  if (!r.ok) {
    console.error(`[oss/upload] userId=${userId} key=${key} failed:`, r.error);
    return jsonResponse(
      {
        ok: false,
        error: "oss_put_failed",
        detail: r.error,
        status: r.status,
      },
      r.status >= 500 ? 502 : 500,
    );
  }

  const version = Date.now(); // OSS lastModified 不到毫秒；用本地 ts 当 version
  console.log(
    `[oss/upload] userId=${userId} bytes=${bodyText.length} etag=${r.etag} versionId=${r.versionId}`,
  );
  return jsonResponse({
    ok: true,
    userId,
    version,
    bytes: bodyText.length,
    etag: r.etag,
    versionId: r.versionId,
  });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
