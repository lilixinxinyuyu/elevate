/**
 * GET /api/sync/oss/check
 *
 * v0.33.60 (Ep133): 诊断 endpoint —— 检查 OSS 4 个 env var 是否都设了。
 * 不暴露具体值（只回布尔 + length），调试用。
 * 需要 Authorization Bearer，跟其他 sync 端点一致。
 */

import { corsHeaders, getUserId, jsonResponse, type Env } from "../../../_shared";
import { getOssConfig, ossHead, snapshotKey } from "../../../_oss";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const u = getUserId(request, env);
  if (u instanceof Response) return u;
  const userId = u;

  const envCheck = {
    ALIYUN_OSS_REGION: {
      set: !!env.ALIYUN_OSS_REGION,
      length: (env.ALIYUN_OSS_REGION ?? "").length,
      preview: env.ALIYUN_OSS_REGION ?? null, // region 不敏感可以露
    },
    ALIYUN_OSS_BUCKET: {
      set: !!env.ALIYUN_OSS_BUCKET,
      length: (env.ALIYUN_OSS_BUCKET ?? "").length,
      preview: env.ALIYUN_OSS_BUCKET ?? null, // bucket 名不敏感
    },
    ALIYUN_OSS_ACCESS_KEY_ID: {
      set: !!env.ALIYUN_OSS_ACCESS_KEY_ID,
      length: (env.ALIYUN_OSS_ACCESS_KEY_ID ?? "").length,
      preview: env.ALIYUN_OSS_ACCESS_KEY_ID
        ? env.ALIYUN_OSS_ACCESS_KEY_ID.slice(0, 8) + "..."
        : null,
    },
    ALIYUN_OSS_ACCESS_KEY_SECRET: {
      set: !!env.ALIYUN_OSS_ACCESS_KEY_SECRET,
      length: (env.ALIYUN_OSS_ACCESS_KEY_SECRET ?? "").length,
      // Secret 完全不露
    },
  };

  const cfg = getOssConfig(env);
  if (!cfg) {
    return jsonResponse({
      ok: false,
      error: "oss_not_configured",
      detail: "至少一个 env var 缺失",
      envCheck,
      userId,
    });
  }

  // 真试一次 HEAD（看 RAM 权限 + bucket 是否能连）
  const key = snapshotKey(userId);
  const head = await ossHead(cfg, key);
  return jsonResponse({
    ok: true,
    envCheck,
    userId,
    snapshotKey: key,
    headResult: {
      status: head.status,
      ok: head.ok,
      error: head.error,
      lastModifiedMs: head.lastModifiedMs,
      etag: head.etag,
    },
  });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
