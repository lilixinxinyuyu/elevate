/**
 * Sync 路由：snapshot upload / download / check
 *
 * 走 OSS REST，没有 D1 fallback（全 Aliyun stack）。
 *
 * 两套 path 都支持（backward-compat 老客户端）：
 *   /api/sync/upload         (new)
 *   /api/sync/oss/upload     (legacy)
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { type Env } from "../lib/env";
import { requireAuth, getUserId } from "../lib/auth";
import {
  getOssConfig,
  ossPut,
  ossGet,
  ossHead,
  snapshotKey,
  aiQuestionsKey,
} from "../lib/oss";

type Ctx = Context<{ Bindings: Env; Variables: { userId: string } }>;

const sync = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

sync.use("*", requireAuth);

// ─── handlers ─────────────────────────────────────────────────────

async function checkHandler(c: Ctx): Promise<Response> {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) {
    return c.json({
      ok: false,
      error: "oss_not_configured",
      userId,
      envCheck: {
        REGION: !!c.env.ALIYUN_OSS_REGION,
        BUCKET: !!c.env.ALIYUN_OSS_BUCKET,
        AK: !!c.env.ALIYUN_OSS_ACCESS_KEY_ID,
        SK: !!c.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
      },
    });
  }
  const key = snapshotKey(userId);
  const head = await ossHead(cfg, key);
  return c.json({
    ok: true,
    userId,
    snapshotKey: key,
    bucket: cfg.bucket,
    region: cfg.region,
    headResult: {
      status: head.status,
      ok: head.ok,
      lastModifiedMs: head.lastModifiedMs,
      etag: head.etag,
      error: head.error,
    },
  });
}

async function uploadHandler(c: Ctx): Promise<Response> {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  // 跟 CF Pages 对齐：支持 gzip body（client 用 X-Body-Encoding，老 spec），
  // 也支持 Content-Encoding（HTTP 标准）。读出来后解压成 plain JSON 文本再存 OSS。
  // 这样 OSS 里始终是纯 JSON，下次 download 直接 parse 不会踩 "Unexpected token ''".
  const enc =
    (c.req.header("X-Body-Encoding") ?? c.req.header("Content-Encoding") ?? "").toLowerCase();
  let bodyText: string;
  try {
    if (enc === "gzip" && c.req.raw.body) {
      const decompressed = c.req.raw.body.pipeThrough(new DecompressionStream("gzip"));
      bodyText = await new Response(decompressed).text();
    } else {
      bodyText = await c.req.text();
    }
  } catch (e) {
    return c.json(
      { ok: false, error: "body_read_failed", detail: (e as Error).message },
      400,
    );
  }
  // 校验 JSON 合法（防止存进去后下次 download crash 客户端）
  try {
    const parsed = JSON.parse(bodyText);
    if (!parsed || typeof parsed !== "object") {
      return c.json({ ok: false, error: "invalid_payload" }, 400);
    }
  } catch (e) {
    return c.json({ ok: false, error: "invalid_json", detail: (e as Error).message }, 400);
  }

  const sizeKB = (bodyText.length / 1024).toFixed(1);
  const key = snapshotKey(userId);
  const result = await ossPut(cfg, key, bodyText, {
    contentType: "application/json; charset=utf-8",
  });
  if (!result.ok) {
    return c.json(
      { ok: false, error: result.error, status: result.status, sizeKB },
      502,
    );
  }
  const version = Date.now();
  return c.json({
    ok: true,
    userId,
    version,
    bytes: bodyText.length,
    sizeKB,
    etag: result.etag,
    versionId: result.versionId,
  });
}

async function downloadHandler(c: Ctx): Promise<Response> {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  const sinceStr = c.req.query("since");
  const since = sinceStr ? Number(sinceStr) : 0;
  const key = snapshotKey(userId);

  // 跟 CF Pages 对齐：返回 wrapped {ok, latest:{payload,version,...}} | {ok, latest:null}
  // 不返 304 / 不返 raw —— 老 client (pullMainSnapshotOss) parse 这个 shape。
  const head = await ossHead(cfg, key);
  if (!head.ok && head.status === 404) {
    return c.json({ ok: true, latest: null, userId });
  }
  if (!head.ok) {
    return c.json(
      { ok: false, error: "oss_head_failed", detail: head.error, status: head.status },
      502,
    );
  }
  const lastModifiedMs = head.lastModifiedMs ?? 0;
  if (since > 0 && lastModifiedMs > 0 && lastModifiedMs <= since) {
    return c.json({ ok: true, latest: null, currentVersion: lastModifiedMs, userId });
  }

  const got = await ossGet(cfg, key);
  if (!got.ok || got.text === undefined) {
    return c.json(
      { ok: false, error: "oss_get_failed", detail: got.error, status: got.status },
      502,
    );
  }
  // payload 应该是有效 JSON（upload 时已校验过）
  let payload: unknown;
  try {
    payload = JSON.parse(got.text);
  } catch (e) {
    return c.json(
      { ok: false, error: "corrupt_snapshot", detail: (e as Error).message },
      500,
    );
  }
  return c.json({
    ok: true,
    userId,
    latest: {
      payload,
      version: lastModifiedMs || Date.now(),
      etag: got.etag,
      versionId: got.versionId,
    },
  });
}

async function aiQuestionsGetHandler(c: Ctx): Promise<Response> {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);
  const since = Number(c.req.query("since") ?? "0");
  const key = aiQuestionsKey(userId);
  const head = await ossHead(cfg, key);
  if (!head.ok && head.status === 404) {
    return c.json({ ok: true, questions: [], lastModifiedMs: 0 });
  }
  if (!head.ok) return c.json({ ok: false, error: head.error }, 502);
  if (since > 0 && head.lastModifiedMs && head.lastModifiedMs <= since) {
    return c.body(null, 304);
  }
  const got = await ossGet(cfg, key);
  if (!got.ok || !got.text) {
    return c.json({ ok: false, error: got.error ?? "get_failed" }, 502);
  }
  return new Response(got.text, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-LastModified": String(head.lastModifiedMs ?? 0),
    },
  });
}

async function aiQuestionsPostHandler(c: Ctx): Promise<Response> {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);
  const body = await c.req.arrayBuffer();
  const key = aiQuestionsKey(userId);
  const result = await ossPut(cfg, key, body, {
    contentType: "application/json; charset=utf-8",
  });
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, 502);
  }
  return c.json({ ok: true, etag: result.etag });
}

/** trophy-images endpoint: 老 D1 表，OSS 化暂存空（前端有 fallback） */
async function trophyImagesGetHandler(c: Ctx): Promise<Response> {
  return c.json({ ok: true, images: [], lastModifiedMs: 0 });
}

async function trophyImagesPostHandler(c: Ctx): Promise<Response> {
  // TODO: 实现 trophy 图 OSS 存储；暂时接受但 noop
  return c.json({ ok: true, stored: 0 });
}

// ─── routes ───────────────────────────────────────────────────────

// 新 path
sync.get("/check", checkHandler);
sync.post("/upload", uploadHandler);
sync.get("/download", downloadHandler);
sync.get("/ai-questions", aiQuestionsGetHandler);
sync.post("/ai-questions", aiQuestionsPostHandler);
sync.get("/trophy-images", trophyImagesGetHandler);
sync.post("/trophy-images", trophyImagesPostHandler);

// 老 path (backward-compat for stale clients)
sync.get("/oss/check", checkHandler);
sync.post("/oss/upload", uploadHandler);
sync.get("/oss/download", downloadHandler);

export default sync;
