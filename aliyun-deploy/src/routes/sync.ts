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

  // v0.34.18: 数据保护 —— 防止小 payload 把已有的大 snapshot 覆写
  // (Ep148 我用 197B 测试 payload 覆写了 Selena 2.5MB snapshot, 触发数据丢失.
  //  幸好 bucket versioning 开了, 通过 _restore-selena.mjs 恢复了)
  // 规则：如果 client 没显式带 X-Allow-Shrink: true 头，并且新 body < 5KB
  //   且现有 snapshot > 100KB，拒绝（明显是 truncate 风险）
  const allowShrink = c.req.header("X-Allow-Shrink") === "true";

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

  // 防 truncate（Ep148 救火）—— 不用 ossHead（V8 fetch HEAD 拿不到 Content-Length），
  // 而是读 stats.json sidecar（每次 push 都写 snapshotBytes）。
  // 如果 existing snapshotBytes > 50KB 且 incoming < 50% existing → 409。
  if (!allowShrink) {
    const statsGot = await ossGet(cfg, `users/${userId}/stats.json`);
    if (statsGot.ok && statsGot.text) {
      try {
        const stats = JSON.parse(statsGot.text) as { snapshotBytes?: number };
        const existingBytes = stats.snapshotBytes ?? 0;
        if (existingBytes > 50_000 && bodyText.length < existingBytes * 0.5) {
          return c.json(
            {
              ok: false,
              error: "shrink_blocked",
              detail: `incoming ${bodyText.length}B is < 50% of existing ${existingBytes}B for ${userId}. Add header X-Allow-Shrink: true to confirm.`,
              existingBytes,
              incomingBytes: bodyText.length,
            },
            409,
          );
        }
      } catch {
        /* corrupt stats → allow */
      }
    }
  }

  const result = await ossPut(cfg, key, bodyText, {
    contentType: "application/json; charset=utf-8",
  });
  if (!result.ok) {
    return c.json(
      { ok: false, error: result.error, status: result.status, sizeKB },
      502,
    );
  }

  // Ep148: 预计算 stats.json，避免 super-admin endpoint 每次 parse 8MB snapshot
  // (实测 routine 里 JSON.parse 8MB 触发 ESA 599 resource constraint)
  // 失败不阻塞主响应。
  try {
    const stats = computeSnapshotStats(bodyText);
    await ossPut(
      cfg,
      `users/${userId}/stats.json`,
      JSON.stringify({ ...stats, fetchedAt: Date.now(), snapshotBytes: bodyText.length }),
      { contentType: "application/json; charset=utf-8" },
    );
  } catch (e) {
    console.warn(`[sync/upload] stats compute failed for ${userId}:`, (e as Error).message);
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

/**
 * 从完整 snapshot JSON text 算 stats。这个跑在 push 流里（已经 parse 过一次了）。
 * 返回小对象（< 2KB），写到 OSS 让 super-admin 快查。
 */
function computeSnapshotStats(bodyText: string): Record<string, unknown> {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return { computeError: "parse_failed" };
  }
  const rawTables = payload.data && typeof payload.data === "object"
    ? (payload.data as Record<string, unknown>)
    : payload;
  const t = (name: string): unknown[] => {
    const v = (rawTables as Record<string, unknown>)[name];
    return Array.isArray(v) ? v : [];
  };
  const attempts = t("attempts") as Array<{ subject?: string; subjectId?: string; isCorrect?: boolean; createdAt?: number; skillId?: string }>;
  const mistakes = t("mistakes") as Array<{ skillId?: string; resolved?: boolean }>;
  const trophies = t("trophies");
  const sessions = t("sessions") as Array<{ createdAt?: number }>;
  const mastery = t("mastery");
  const fluencyAttempts = t("fluencyAttempts");
  const tutorSessions = t("tutorSessions");

  const today = new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
  const todayAttempts = attempts.filter((a) =>
    a.createdAt && new Date(a.createdAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }) === today,
  ).length;
  const todaySessions = sessions.filter((s) =>
    s.createdAt && new Date(s.createdAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }) === today,
  ).length;
  const SEVEN_AGO = Date.now() - 7 * 86400_000;
  const last7Attempts = attempts.filter((a) => (a.createdAt ?? 0) >= SEVEN_AGO).length;

  const bySubject: Record<string, number> = {};
  for (const a of attempts) {
    const subj = a.subject ?? a.subjectId ?? "math";
    bySubject[subj] = (bySubject[subj] ?? 0) + 1;
  }
  const skillCounts: Record<string, number> = {};
  for (const m of mistakes) {
    if (m.resolved) continue;
    const sk = m.skillId ?? "?";
    skillCounts[sk] = (skillCounts[sk] ?? 0) + 1;
  }
  const topMistakeSkills = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([skillId, count]) => ({ skillId, count }));

  const lastTs = attempts.reduce((max, a) => Math.max(max, a.createdAt ?? 0), 0)
    || sessions.reduce((max, s) => Math.max(max, s.createdAt ?? 0), 0);

  const recent100 = attempts.slice(-100);
  const correct = recent100.filter((a) => a.isCorrect).length;
  const correctRate = recent100.length > 0 ? correct / recent100.length : 0;

  return {
    counts: {
      attempts: attempts.length,
      mistakes: mistakes.length,
      trophies: trophies.length,
      sessions: sessions.length,
      mastery: mastery.length,
      fluencyAttempts: fluencyAttempts.length,
      tutorSessions: tutorSessions.length,
    },
    today: { attempts: todayAttempts, sessions: todaySessions },
    last7Days: { attempts: last7Attempts },
    bySubject,
    topMistakeSkills,
    correctRateRecent100: Math.round(correctRate * 100),
    lastActivityMs: lastTs || null,
  };
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
