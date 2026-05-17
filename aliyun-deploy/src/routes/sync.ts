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
import { patchUserInIndex } from "../lib/users-index";

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

  // v0.34.95 iter 29: multi-device conflict detection. Client 在 push 前 在
  // X-Parent-LastModified header 带它"基于哪个版本"做的 modify. Server head OSS
  // current lastModifiedMs, 如果 server 比 client-parent 新 ≥ 5s → 409.
  // 5s 缓冲是给同设备 push-back-to-back 留容差.
  // Client 收 409 → pullFromCloud() 拉新 → retry push (merge 已发生).
  // 不带 header 的老客户端 → 跳过检查 (向后兼容).
  const parentLastModifiedHeader = c.req.header("X-Parent-LastModified");
  const parentLastModified = parentLastModifiedHeader ? Number(parentLastModifiedHeader) : null;

  // v0.34.18: 数据保护 —— 防止小 payload 把已有的大 snapshot 覆写
  // (Ep148 我用 197B 测试 payload 覆写了 Selena 2.5MB snapshot, 触发数据丢失.
  //  幸好 bucket versioning 开了, 通过 _restore-selena.mjs 恢复了)
  // v0.34.96 iter 30 加强: X-Allow-Shrink 单独不够 (Iter 29 我又踩了一次,
  // 测试时给 Selena 灌 29B JSON 把 5.3MB 覆盖). 现在要双 header:
  //   X-Allow-Shrink: true     +
  //   X-Confirm-Wipe: <userId>  (必须跟当前 auth userId 一致)
  // 单条 X-Allow-Shrink 不再 bypass shrink check. 真的要 wipe 必须明确指认
  // 哪个用户, 防 typo / 自动化工具误用.
  const allowShrinkHeader = c.req.header("X-Allow-Shrink") === "true";
  const confirmWipeHeader = c.req.header("X-Confirm-Wipe") ?? "";
  const allowShrink = allowShrinkHeader && confirmWipeHeader === userId;

  // iter 29: 先 head 当前 OSS snapshot, 比 client-parent 拿到的版本号
  if (parentLastModified && Number.isFinite(parentLastModified)) {
    const head = await ossHead(cfg, snapshotKey(userId));
    if (head.ok && head.lastModifiedMs && head.lastModifiedMs > parentLastModified + 5000) {
      return c.json(
        {
          ok: false,
          error: "conflict_stale_parent",
          detail: `server snapshot lastModifiedMs=${head.lastModifiedMs} > client parent=${parentLastModified}. Pull first, merge, then retry push.`,
          serverLastModifiedMs: head.lastModifiedMs,
          clientParentLastModifiedMs: parentLastModified,
        },
        409,
      );
    }
  }

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
  // Ep35 P0 修：parse 一次复用给后续 stats 计算，避免对 3MB 串 parse 两次触发
  // ESA EdgeRoutine "forcibly terminated due to resource constraints" (599).
  // Selena 实测：bodyText 2.9MB，单 JSON.parse ~200-400ms × 2 = 出超时。
  let parsedPayload: Record<string, unknown> | null = null;
  try {
    parsedPayload = JSON.parse(bodyText) as Record<string, unknown>;
    if (!parsedPayload || typeof parsedPayload !== "object") {
      return c.json({ ok: false, error: "invalid_payload" }, 400);
    }
  } catch (e) {
    return c.json({ ok: false, error: "invalid_json", detail: (e as Error).message }, 400);
  }

  const sizeKB = (bodyText.length / 1024).toFixed(1);
  const key = snapshotKey(userId);
  const version = Date.now();

  // 防 truncate (v0.34.96 iter 30 强化, 两级 fallback):
  // - 优先: ossHead snapshot.json 直接拿 Content-Length (最权威)
  // - 兜底: 读 stats.json sidecar (上次 push 写的 snapshotBytes)
  //
  // 之前只用 stats.json sidecar — 但 sidecar 是 push 之后才写的 lagging value.
  // 如果有人 (admin 测试 / 我!) 先用小 payload 推一次, stats.json 被覆 → 第二次
  // 推小 payload 时 sidecar 显示 "existingBytes=15", 没触发 50KB 阈值 → 静默
  // wipe 真数据. iter 29-30 我连续踩两次. 现在 ossHead 优先, 大数 wins.
  if (!allowShrink) {
    let existingBytes = 0;
    const head = await ossHead(cfg, key);
    if (head.ok && head.contentLength) {
      existingBytes = head.contentLength;
    } else {
      const statsGot = await ossGet(cfg, `users/${userId}/stats.json`);
      if (statsGot.ok && statsGot.text) {
        try {
          const stats = JSON.parse(statsGot.text) as { snapshotBytes?: number };
          existingBytes = stats.snapshotBytes ?? 0;
        } catch { /* */ }
      }
    }
    if (existingBytes > 50_000 && bodyText.length < existingBytes * 0.5) {
      const why = allowShrinkHeader && confirmWipeHeader !== userId
        ? `X-Allow-Shrink: true 已传 但 X-Confirm-Wipe="${confirmWipeHeader}" 不等于 userId="${userId}"`
        : `双 header 必传: X-Allow-Shrink: true + X-Confirm-Wipe: ${userId}`;
      return c.json(
        {
          ok: false,
          error: "shrink_blocked",
          detail: `incoming ${bodyText.length}B is < 50% of existing ${existingBytes}B for ${userId}. ${why}`,
          existingBytes,
          incomingBytes: bodyText.length,
        },
        409,
      );
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
  // Ep35 P0: 复用上面 parsedPayload，不重复 parse；大于 3MB 时直接 skip 整段
  // stats 计算（client 端可以从 download 后自己算），避免单 request CPU 爆。
  try {
    if (bodyText.length > 3 * 1024 * 1024) {
      console.warn(`[upload] skipping stats compute for ${userId}: payload ${sizeKB}KB > 3MB`);
      throw new Error("payload_too_large_for_stats");
    }
    const stats = computeSnapshotStatsFromParsed(parsedPayload);
    await ossPut(
      cfg,
      `users/${userId}/stats.json`,
      JSON.stringify({ ...stats, fetchedAt: Date.now(), snapshotBytes: bodyText.length }),
      { contentType: "application/json; charset=utf-8" },
    );
    // Ep153 同步 users-index
    const s = stats as {
      today?: { attempts?: number };
      last7Days?: { attempts?: number };
      correctRateRecent100?: number;
    };
    await patchUserInIndex(c.env, userId, {
      snapshotMs: version,
      snapshotBytes: bodyText.length,
      statsKpi: {
        todayAttempts: s.today?.attempts ?? 0,
        last7Attempts: s.last7Days?.attempts ?? 0,
        correctRate: s.correctRateRecent100 ?? 0,
      },
    });
  } catch (e) {
    console.warn(`[sync/upload] stats compute failed for ${userId}:`, (e as Error).message);
  }

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
/** Ep35 P0: 接受已 parsed 的 payload object，不再重 JSON.parse。
 * 老入口 computeSnapshotStats(bodyText) 保留作 backcompat（其它路径还在用） */
function computeSnapshotStats(bodyText: string): Record<string, unknown> {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return { computeError: "parse_failed" };
  }
  return computeSnapshotStatsFromParsed(payload);
}

function computeSnapshotStatsFromParsed(payload: Record<string, unknown>): Record<string, unknown> {
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

  // Ep35 P0: 不用 Intl.DateTimeFormat — 对 3635 attempts 调 2 次 / 项是 O(7k) toLocaleDateString
  // 触发 ESA CPU budget 爆。改用纯算术：Asia/Shanghai = UTC+8 固定偏移，按
  // (now / 86400e3) integer day 比较。
  const SHANGHAI_OFFSET_MS = 8 * 3600_000;
  const todayDayIdx = Math.floor((Date.now() + SHANGHAI_OFFSET_MS) / 86400_000);
  const isToday = (ts: number | undefined): boolean =>
    typeof ts === "number" && Math.floor((ts + SHANGHAI_OFFSET_MS) / 86400_000) === todayDayIdx;
  const todayAttempts = attempts.filter((a) => isToday(a.createdAt)).length;
  const todaySessions = sessions.filter((s) => isToday(s.createdAt)).length;
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
  // Ep35 P0 修：3MB snapshot 不再 JSON.parse + Hono c.json 再 JSON.stringify
  // (实测会触发 ESA 599 resource constraint)。
  // payload 已是有效 JSON 字符串（upload 时 parse 校验过），直接拼到 wrapper。
  // 廉价 sanity check：首字符是 `{` 即放行；不行返 corrupt。
  const text = got.text;
  if (text.length === 0 || text[0] !== "{") {
    return c.json({ ok: false, error: "corrupt_snapshot", detail: "not_json_object" }, 500);
  }
  const version = lastModifiedMs || Date.now();
  const wrapped =
    `{"ok":true,"userId":${JSON.stringify(userId)},"latest":{"payload":` +
    text +
    `,"version":${version}` +
    (got.etag ? `,"etag":${JSON.stringify(got.etag)}` : "") +
    (got.versionId ? `,"versionId":${JSON.stringify(got.versionId)}` : "") +
    `}}`;
  return new Response(wrapped, {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * v0.34.77 iter 11: per-key ai-questions merge.
 *
 * 历史: 老路径只读 users/{uid}/ai-questions.json blob (单文件).
 * Ep46 加 per-key 模式 (users/{uid}/ai-questions/{qid}.json) 救 1288 missing,
 * 但客户端 pull 不知道这个 prefix → 学生看不到新写的题.
 *
 * 现在 GET /api/sync/ai-questions 主动 list per-key prefix + fetch new ones
 * (cap 30 per call 避免 ESA 11s 超时) + merge 进 rows.
 */
const PER_KEY_PULL_CAP = 30;

async function listAiQuestionsPerKey(
  cfg: { bucket: string; region: string; accessKeyId: string; accessKeySecret: string },
  userId: string,
  sinceMs: number,
): Promise<Array<{ key: string; lastModifiedMs: number }>> {
  const prefix = `users/${userId}/ai-questions/`;
  const date = new Date().toUTCString();
  const stringToSign = ["GET", "", "", date, `/${cfg.bucket}/`].join("\n");
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(cfg.accessKeySecret),
    { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(stringToSign));
  let bin = "";
  const bytes = new Uint8Array(sigBuf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const sig = btoa(bin);
  const host = `${cfg.bucket}.${cfg.region}.aliyuncs.com`;
  const url = `https://${host}/?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000`;
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: { Host: host, Date: date, Authorization: `OSS ${cfg.accessKeyId}:${sig}` },
    });
    if (!r.ok) return [];
    const xml = await r.text();
    const items: Array<{ key: string; lastModifiedMs: number }> = [];
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const block = m[1] ?? "";
      const key = block.match(/<Key>([^<]+)<\/Key>/)?.[1] ?? "";
      const lm = block.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1] ?? "";
      if (!key.endsWith(".json")) continue;
      const lmMs = Date.parse(lm) || 0;
      if (sinceMs > 0 && lmMs <= sinceMs) continue;
      items.push({ key, lastModifiedMs: lmMs });
    }
    // 最新的优先 (lastModifiedMs desc)
    items.sort((a, b) => b.lastModifiedMs - a.lastModifiedMs);
    return items;
  } catch {
    return [];
  }
}

async function aiQuestionsGetHandler(c: Ctx): Promise<Response> {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);
  const since = Number(c.req.query("since") ?? "0");

  // 1. 读老 v1 blob (兼容存量数据)
  const key = aiQuestionsKey(userId);
  const head = await ossHead(cfg, key);
  let blobRows: Array<{ question_id?: string; [k: string]: unknown }> = [];
  let blobLastMs = 0;
  if (head.ok) {
    blobLastMs = head.lastModifiedMs ?? 0;
    const got = await ossGet(cfg, key);
    if (got.ok && got.text) {
      try {
        const parsed = JSON.parse(got.text) as { rows?: unknown[]; questions?: unknown[] };
        if (Array.isArray(parsed.rows)) blobRows = parsed.rows as typeof blobRows;
        else if (Array.isArray(parsed.questions)) blobRows = parsed.questions as typeof blobRows;
      } catch { /* corrupt blob; skip */ }
    }
  } else if (head.status !== 404) {
    return c.json({ ok: false, error: head.error }, 502);
  }

  // 2. 列 per-key prefix + fetch new ones (cap PER_KEY_PULL_CAP)
  // v0.34.77 iter 11: 新增 — 让 iter 10 textbook synthesize 写的题流到学生.
  const perKeyItems = await listAiQuestionsPerKey(cfg, userId, since);
  const limited = perKeyItems.slice(0, PER_KEY_PULL_CAP);
  const perKeyRows: Array<{ question_id?: string; [k: string]: unknown }> = [];
  let maxPerKeyMs = 0;
  if (limited.length > 0) {
    // parallel get
    const fetches = await Promise.allSettled(
      limited.map(async (it) => {
        const got = await ossGet(cfg, it.key);
        if (!got.ok || !got.text) return null;
        try {
          return { item: it, row: JSON.parse(got.text) as Record<string, unknown> };
        } catch {
          return null;
        }
      }),
    );
    for (const r of fetches) {
      if (r.status === "fulfilled" && r.value) {
        perKeyRows.push(r.value.row as { question_id?: string });
        if (r.value.item.lastModifiedMs > maxPerKeyMs) maxPerKeyMs = r.value.item.lastModifiedMs;
      }
    }
  }

  // 3. union by question_id — blob 优先, per-key 补充 (per-key 是新的)
  const seen = new Set<string>();
  const merged: Array<{ question_id?: string; [k: string]: unknown }> = [];
  for (const row of [...perKeyRows, ...blobRows]) {
    const qid = row.question_id;
    if (typeof qid !== "string" || !qid || seen.has(qid)) continue;
    seen.add(qid);
    merged.push(row);
  }

  // 4. 304 short-circuit: blob 没新 + per-key 没新 → 不返 body
  const latestMs = Math.max(blobLastMs, maxPerKeyMs);
  if (since > 0 && latestMs > 0 && latestMs <= since) {
    return c.body(null, 304);
  }

  return c.json(
    { ok: true, rows: merged, latestVersion: latestMs, perKeyCount: perKeyRows.length, blobCount: blobRows.length },
    200,
    { "X-LastModified": String(latestMs) },
  );
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

/**
 * trophy-images endpoint — Ep39 (2026-05-17) per-image API
 *
 * 历史：v0.30.0 拆走独立 endpoint, OSS 化时实测把 205 entries / 17MB 整
 * bundle 返一次 → ESA 599 resource_constraints (ESA worker memory 上限).
 *
 * 新架构：
 *   - 每个 trophy 图存独立 OSS key:  users/{userId}/trophy-images/{trophyId}.json
 *     value = {trophyId, subjectId, imageDataUrl, generatedAt}
 *   - GET /trophy-images (manifest)
 *     → OSS list-v2 users/{userId}/trophy-images/ → 返 [{trophyId, lastModifiedMs, bytes}]
 *     manifest 小 (~5KB / 205 entry), 安全返
 *   - GET /trophy-images/:trophyId (单图)
 *     → OSS get users/{userId}/trophy-images/{trophyId}.json → 返单 entry
 *     每图 < 100KB, ESA 安全
 *   - POST /trophy-images (单图写)
 *     → body = {trophyId, subjectId, imageDataUrl, generatedAt}
 *     → OSS put users/{userId}/trophy-images/{trophyId}.json
 *   - GET (legacy, since=N) — backward-compat: 返 [], 让老 client 不报错
 *     新 client 走 manifest + 增量拉单图
 *
 * 客户端 src/db/cloudSync.ts 改造留下个 ep (本 ep 只 ship server API + data)。
 */
async function trophyImagesGetHandler(c: Ctx): Promise<Response> {
  // legacy compat: 客户端老路径调 GET /trophy-images?since=N → 返空避免报错
  // 新 manifest 走 GET /trophy-images?list=1
  const wantList = c.req.query("list") === "1";
  if (!wantList) {
    return c.json({ ok: true, images: [], lastModifiedMs: 0, legacy: true });
  }
  // manifest path
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);
  const prefix = `users/${userId}/trophy-images/`;
  // ali-oss list via REST: GET /?list-type=2&prefix=...
  const date = new Date().toUTCString();
  const stringToSign = ["GET", "", "", date, `/${cfg.bucket}/`].join("\n");
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(cfg.accessKeySecret),
    { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(stringToSign));
  let bin = "";
  const bytes = new Uint8Array(sigBuf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const sig = btoa(bin);
  const host = `${cfg.bucket}.${cfg.region}.aliyuncs.com`;
  const url = `https://${host}/?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000`;
  const items: Array<{ trophyId: string; lastModifiedMs: number; bytes: number }> = [];
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: { Host: host, Date: date, Authorization: `OSS ${cfg.accessKeyId}:${sig}` },
    });
    if (r.ok) {
      const xml = await r.text();
      // parse <Contents><Key>users/selena/trophy-images/foo.json</Key><LastModified>...</LastModified><Size>...</Size></Contents>
      for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const block = m[1] ?? "";
        const key = block.match(/<Key>([^<]+)<\/Key>/)?.[1] ?? "";
        const tid = key.slice(prefix.length, -".json".length);
        if (!tid) continue;
        const lm = block.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1] ?? "";
        const sz = parseInt(block.match(/<Size>(\d+)<\/Size>/)?.[1] ?? "0", 10);
        items.push({ trophyId: tid, lastModifiedMs: Date.parse(lm) || 0, bytes: sz });
      }
    }
  } catch (e) {
    return c.json({ ok: false, error: "list_failed: " + (e as Error).message }, 502);
  }
  return c.json({ ok: true, count: items.length, items });
}

async function trophyImageOneGetHandler(c: Ctx): Promise<Response> {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);
  const trophyId = c.req.param("trophyId") ?? "";
  if (!trophyId || !/^[A-Za-z0-9_-]{1,128}$/.test(trophyId)) {
    return c.json({ ok: false, error: "invalid_trophyId" }, 400);
  }
  const key = `users/${userId}/trophy-images/${trophyId}.json`;
  const got = await ossGet(cfg, key);
  if (!got.ok) {
    if (got.status === 404) return c.json({ ok: false, error: "not_found" }, 404);
    return c.json({ ok: false, error: got.error }, 502);
  }
  // 不 parse, 透传 text (client 自己 parse)
  return new Response(got.text ?? "", {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function trophyImagesPostHandler(c: Ctx): Promise<Response> {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);
  let body: { trophyId?: string; subjectId?: string; imageDataUrl?: string; generatedAt?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  const trophyId = (body.trophyId ?? "").trim();
  if (!trophyId || !/^[A-Za-z0-9_-]{1,128}$/.test(trophyId)) {
    return c.json({ ok: false, error: "invalid_trophyId" }, 400);
  }
  if (!body.imageDataUrl) {
    return c.json({ ok: false, error: "missing_imageDataUrl" }, 400);
  }
  // 上限单图 200KB 防爆 ESA 11s budget (oss put 大文件慢)
  if (body.imageDataUrl.length > 200_000) {
    return c.json({ ok: false, error: "image_too_large", detail: ">200KB base64" }, 413);
  }
  const key = `users/${userId}/trophy-images/${trophyId}.json`;
  const r = await ossPut(cfg, key, JSON.stringify(body), {
    contentType: "application/json; charset=utf-8",
  });
  if (!r.ok) return c.json({ ok: false, error: r.error }, 502);
  return c.json({ ok: true, trophyId, etag: r.etag });
}

// ─── routes ───────────────────────────────────────────────────────

// 新 path
sync.get("/check", checkHandler);
sync.post("/upload", uploadHandler);
sync.get("/download", downloadHandler);
sync.get("/ai-questions", aiQuestionsGetHandler);
sync.post("/ai-questions", aiQuestionsPostHandler);
sync.get("/trophy-images", trophyImagesGetHandler);
sync.get("/trophy-images/:trophyId", trophyImageOneGetHandler);
sync.post("/trophy-images", trophyImagesPostHandler);

// 老 path (backward-compat for stale clients)
sync.get("/oss/check", checkHandler);
sync.post("/oss/upload", uploadHandler);
sync.get("/oss/download", downloadHandler);

export default sync;
