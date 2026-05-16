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

  const contentType = c.req.header("Content-Type") ?? "application/json";
  const contentEncoding = c.req.header("Content-Encoding") ?? null;
  const body = await c.req.arrayBuffer();
  const sizeKB = (body.byteLength / 1024).toFixed(1);

  const key = snapshotKey(userId);
  const result = await ossPut(cfg, key, body, {
    contentType: contentEncoding === "gzip" ? "application/json+gzip" : contentType,
  });
  if (!result.ok) {
    return c.json(
      { ok: false, error: result.error, status: result.status, sizeKB },
      502,
    );
  }
  return c.json({
    ok: true,
    userId,
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

  const head = await ossHead(cfg, key);
  if (!head.ok && head.status === 404) {
    return c.json({ ok: false, error: "no_snapshot_yet" }, 404);
  }
  if (!head.ok) {
    return c.json({ ok: false, error: head.error, status: head.status }, 502);
  }
  if (since > 0 && head.lastModifiedMs && head.lastModifiedMs <= since) {
    return c.body(null, 304);
  }

  const got = await ossGet(cfg, key);
  if (!got.ok || !got.text) {
    return c.json({ ok: false, error: got.error ?? "get_failed" }, 502);
  }

  const isGzip = (got.contentType ?? "").includes("gzip");
  return new Response(got.text, {
    status: 200,
    headers: {
      "Content-Type": isGzip ? "application/json" : "application/json; charset=utf-8",
      ...(isGzip ? { "Content-Encoding": "gzip" } : {}),
      "X-Snapshot-LastModified": String(head.lastModifiedMs ?? 0),
      "X-Snapshot-Etag": head.etag ?? "",
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
