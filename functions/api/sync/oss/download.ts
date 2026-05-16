/**
 * GET /api/sync/oss/download[?since=<ms>]
 *
 * v0.33.59 (Ep132): 新主路径 — 从阿里云 OSS 拉 snapshot。
 *
 * - Auth: getUserId(req, env)
 * - OSS key: users/{userId}/snapshot.json
 * - since 参数：客户端 lastPullAt；server HEAD 检查 lastModified
 *   - if lastModified <= since → 返 { ok: true, latest: null }（不传 payload，省带宽）
 *   - else → GET 完整 payload 返
 * - 没找到（首次新用户） → 返 { ok: true, latest: null }
 */

import { corsHeaders, getUserId, jsonResponse, type Env } from "../../../_shared";
import { getOssConfig, ossGet, ossHead, snapshotKey } from "../../../_oss";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const u = getUserId(request, env);
  if (u instanceof Response) return u;
  const userId = u;

  const cfg = getOssConfig(env);
  if (!cfg) {
    return jsonResponse(
      { ok: false, error: "oss_not_configured" },
      503,
    );
  }

  const url = new URL(request.url);
  const since = Number(url.searchParams.get("since") ?? 0);
  const key = snapshotKey(userId);

  // 1. HEAD 检查 lastModified
  const head = await ossHead(cfg, key);
  if (head.status === 404) {
    // 首次该用户没数据
    return jsonResponse({ ok: true, latest: null, userId });
  }
  if (!head.ok) {
    console.error(`[oss/download] HEAD userId=${userId} failed:`, head.error);
    return jsonResponse(
      { ok: false, error: "oss_head_failed", detail: head.error },
      502,
    );
  }
  const lastModifiedMs = head.lastModifiedMs ?? 0;
  if (since > 0 && lastModifiedMs > 0 && lastModifiedMs <= since) {
    // 客户端已最新，免传 payload
    return jsonResponse({
      ok: true,
      latest: null,
      currentVersion: lastModifiedMs,
      userId,
    });
  }

  // 2. GET 完整 payload
  const g = await ossGet(cfg, key);
  if (!g.ok) {
    console.error(`[oss/download] GET userId=${userId} failed:`, g.error);
    return jsonResponse(
      { ok: false, error: "oss_get_failed", detail: g.error },
      502,
    );
  }

  // payload 应该是有效 JSON（upload 时校验过）
  let payload: unknown;
  try {
    payload = JSON.parse(g.text!);
  } catch (e) {
    console.error(`[oss/download] parse failed userId=${userId}:`, e);
    return jsonResponse(
      { ok: false, error: "corrupt_snapshot", detail: (e as Error).message },
      500,
    );
  }

  const version = g.lastModifiedMs ?? Date.now();
  return jsonResponse({
    ok: true,
    userId,
    latest: {
      payload,
      version,
      etag: g.etag,
      versionId: g.versionId,
    },
  });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
