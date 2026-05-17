/**
 * /api/super-admin/* —— 项目超级管理员视角
 *
 * v0.34.15 (Ep145) 爸爸 2026-05-17 加单：需要看到所有同学的账户 + 进度。
 *
 * 鉴权：除 requireAuth 外还要 userId ∈ SUPER_ADMINS。
 * SUPER_ADMINS env：JSON array 或逗号分隔 string，默认 ["selena"]。
 *
 * Endpoints (本 ep):
 *   GET /api/super-admin/users
 *     - 列所有已知 userId (从 APP_USERS map + APP_PASSWORD fallback "selena")
 *     - 对每个：拉 profile.json (有没都返) + snapshot.json HEAD (lastModified)
 *     - 返回 { ok, count, users: [{userId, profile, lastActiveMs, snapshotBytes?}] }
 *
 * 后续 ep:
 *   POST /api/super-admin/users/:userId/profile  — 改任意同学 profile
 *   POST /api/super-admin/users/:userId/password — 重置密码
 *   GET  /api/super-admin/users/:userId/stats    — attempts 趋势 / 24h agent summary
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../lib/env";
import { requireAuth, getUserId } from "../lib/auth";
import { getOssConfig, ossGet, ossHead, ossPut, ossCopy, snapshotKey } from "../lib/oss";
import {
  listKnownUserIds as listKnownUserIdsAsync,
  resetPasswordForUser,
  addNewStudent,
} from "../lib/auth-store";
import { getProxyFallbackStats } from "./proxy-fallback";
import { readUsersIndex, patchUserInIndex, rebuildIndexFromUserIds, type UserIndexEntry } from "../lib/users-index";

const superAdmin = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

function getSuperAdmins(env: Env): Set<string> {
  // 默认 selena 是 super-admin（爸爸 currently uses Selena's password）
  const raw = (env as unknown as { SUPER_ADMINS?: string }).SUPER_ADMINS ?? "";
  if (!raw) return new Set(["selena"]);
  try {
    if (raw.startsWith("[")) {
      const arr = JSON.parse(raw) as string[];
      return new Set(arr.filter((s) => typeof s === "string"));
    }
  } catch {
    /* fall through */
  }
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

function isValidUserId(v: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(v);
}

/** legacy sync — 现在不用了，全部走 async listKnownUserIdsAsync (OSS-aware) */

/**
 * Ep158 (爸爸 2026-05-17 反馈)：super-admin 只能从 admin.xiaojin.app 访问。
 * Selena / 其他同学子域不能拿到 super-admin endpoint，保持游戏域纯净。
 *
 * 允许的 host:
 *   - admin.xiaojin.app (主)
 *   - localhost (dev)
 * 拒绝：selena.xiaojin.app, xiaojin.app (apex), 其他子域
 */
function isAdminHost(req: Request): boolean {
  const host = (req.headers.get("Host") ?? "").split(":")[0]!.toLowerCase();
  if (host === "admin.xiaojin.app") return true;
  if (host === "localhost" || host === "127.0.0.1") return true; // dev
  return false;
}

/**
 * Ep33: 如果是 backup-snapshot path + 带 BACKUP_TOKEN service token，
 * 直接放行 — 让 Aliyun FC cron 函数无需 super-admin 密码也能定时调。
 * Token compare 走常量时间比较（防 timing attack）。
 *
 * 仅对 /backup-snapshot* 路径生效，其它 super-admin endpoint 仍走 user/role auth。
 */
function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function isBackupPath(path: string): boolean {
  // /api/super-admin/backup-snapshot / .../backup-snapshot/:id / .../backup-snapshot/:id/restore / .../backup-snapshot/:id/file
  return path.includes("/backup-snapshot");
}

function tryServiceToken(c: { env: Env; req: { raw: Request } }): boolean {
  const tok = c.env.BACKUP_TOKEN;
  if (!tok) return false;
  const auth = c.req.raw.headers.get("Authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  return constantTimeEq(m[1]!, tok);
}

// 所有 super-admin endpoints 都先校验 host + auth + role
superAdmin.use("*", async (c, next) => {
  if (!isAdminHost(c.req.raw)) {
    return c.json(
      {
        ok: false,
        error: "wrong_host",
        detail: "super-admin 接口只能从 https://admin.xiaojin.app 访问",
      },
      403,
    );
  }
  // Ep33: backup-snapshot* + service token 旁路
  if (isBackupPath(new URL(c.req.raw.url).pathname) && tryServiceToken(c)) {
    // 模拟 super-admin user 上下文给下游 endpoint（getUserId() 用）
    c.set("userId", "cron:backup");
    return await next();
  }
  // 内联 requireAuth + role check
  const authResp = await requireAuth(c, async () => {
    const userId = getUserId(c);
    const admins = getSuperAdmins(c.env);
    if (!admins.has(userId)) {
      throw new HTTPException(403, {
        res: c.json({ ok: false, error: "not_super_admin", userId }, 403),
      });
    }
    await next();
  });
  return authResp;
});

superAdmin.get("/users", async (c) => {
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  const ids = await listKnownUserIdsAsync(c.env);
  const admins = getSuperAdmins(c.env);

  // Ep153: 走 users-index.json (单 fetch)，避开 ESA 8 fetch 限制
  const idx = await readUsersIndex(c.env);

  const users = ids.map((uid) => {
    const entry = idx.users[uid];
    return {
      userId: uid,
      isSuperAdmin: admins.has(uid),
      profile: entry?.profile ?? null,
      snapshot: {
        present: !!entry?.snapshotMs,
        lastModifiedMs: entry?.snapshotMs ?? null,
        etag: null,
        bytes: entry?.snapshotBytes ?? null,
      },
      statsKpi: entry?.statsKpi ?? null,
      latestSummary: entry?.latestSummary ?? null,
      indexedAt: entry?.lastIndexedAt ?? null,
    };
  });

  return c.json({
    ok: true,
    count: users.length,
    superAdminCount: users.filter((u) => u.isSuperAdmin).length,
    asOf: Date.now(),
    indexUpdatedAt: idx.updatedAt,
    indexHasEntries: Object.keys(idx.users).length,
    users,
  });
});

/**
 * GET /api/super-admin/users/:userId/reports
 * super-admin 看任意同学的报题列表（不限于自己的）
 */
superAdmin.get("/users/:userId/reports", async (c) => {
  const targetUserId = c.req.param("userId");
  if (!isValidUserId(targetUserId)) {
    return c.json({ ok: false, error: "invalid_target_userId" }, 400);
  }
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);
  const got = await ossGet(cfg, `users/${targetUserId}/reports/index.json`);
  if (!got.ok || !got.text) {
    return c.json({ ok: true, targetUserId, count: 0, reports: [] });
  }
  try {
    const idx = JSON.parse(got.text) as {
      entries?: Array<{ id: string; questionId: string; reason: string; fixStatus: string | null; createdAt: number }>;
    };
    const entries = idx.entries ?? [];
    const pendingCount = entries.filter((e) => e.fixStatus === "pending").length;
    return c.json({
      ok: true,
      targetUserId,
      count: entries.length,
      pendingCount,
      reports: entries,
    });
  } catch {
    return c.json({ ok: false, error: "corrupt_index" }, 500);
  }
});

/**
 * POST /api/super-admin/users/:userId/reports/:reportId/fix
 * super-admin 触发任意同学某条 pending 报告的 AI 修题。
 * 直接复用 admin.ts fix 逻辑 — 通过 internal fetch 转发（避免代码重复）。
 */
superAdmin.post("/users/:userId/reports/:reportId/fix", async (c) => {
  const targetUserId = c.req.param("userId");
  const reportId = c.req.param("reportId");
  if (!isValidUserId(targetUserId)) {
    return c.json({ ok: false, error: "invalid_target_userId" }, 400);
  }
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  // 复用 admin.ts 修题逻辑：读 report → call LLM → 写回。
  // 但 admin.ts 鉴权是 own userId only，所以这里内联同样的代码片段。
  const apiKey = c.env.TOKEN_PLAN_CN_API_KEY ?? c.env.BAILIAN_API_KEY;
  if (!apiKey) return c.json({ ok: false, error: "no_llm_api_key" }, 503);

  const reportKey = `users/${targetUserId}/reports/${reportId}.json`;
  const got = await ossGet(cfg, reportKey);
  if (!got.ok || !got.text) {
    return c.json({ ok: false, error: "not_found" }, got.status === 404 ? 404 : 502);
  }
  let report: {
    id: string;
    reason: string;
    reasonText: string | null;
    originalPayload: Record<string, unknown>;
    userAnswer: unknown;
    fixStatus: string | null;
    fixedPayload: Record<string, unknown> | null;
  };
  try { report = JSON.parse(got.text); } catch { return c.json({ ok: false, error: "corrupt_report" }, 500); }
  if (report.fixStatus === "fixed" && report.fixedPayload) {
    return c.json({ ok: true, alreadyFixed: true, fixedPayload: report.fixedPayload });
  }

  // Build prompt (same as admin.ts)
  const REASON_HINT: Record<string, string> = {
    answer_wrong: "用户报告：答案不对",
    stem_unclear: "用户报告：题面看不懂 / 措辞不清",
    options_same: "用户报告：4 个选项看起来一样或区分度太低",
    options_no_correct: "用户报告：4 个选项里没有正确答案",
    math_error: "用户报告：数字 / 计算有错",
    other: "用户报告：其他问题",
  };
  const reasonHint = REASON_HINT[report.reason] ?? `用户报告（${report.reason}）`;
  const reasonText = report.reasonText ? `\n用户额外补充：${report.reasonText}` : "";
  const userAnswerLine = report.userAnswer !== null && report.userAnswer !== undefined
    ? `\nSelena 这次选/答了：${JSON.stringify(report.userAnswer)}` : "";
  const userPrompt = `# 报告
${reasonHint}${reasonText}${userAnswerLine}

# 原题 JSON
\`\`\`json
${JSON.stringify(report.originalPayload, null, 2)}
\`\`\`

按 system 要求修这道题，输出 { "question": {...}, "changesSummary": "..." } JSON。`;

  const FIX_SYS = `你是题库修复 AI。给你一道有问题的小学题 + 用户报告的具体问题。
你只输出修后的整道题 JSON，结构完全跟原题一样，只改有问题的字段。

修复原则：
1. 保 enum 字段不变 (subjectId/skill_id/grade/difficulty/game_type/...)
2. 数学闭合：答案合常识
3. 题面纯净：不写"（无关）/（误算）"等元注解
4. distractor 区分度：错误选项源自学生具体误解思路
5. 保题型保结构：选项数量/字段名都不动

返回 { "question": {...}, "changesSummary": "一句话说改了啥" } JSON。`;

  const baseUrl = c.env.TOKEN_PLAN_CN_API_KEY
    ? "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"
    : "https://dashscope.aliyuncs.com/compatible-mode/v1";

  let fixedPayload: Record<string, unknown> | null = null;
  let changesSummary: string | null = null;
  let llmError: string | null = null;
  for (const m of ["qwen3.6-flash", "qwen3.6-plus"]) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 9_500);
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: m,
          messages: [{ role: "system", content: FIX_SYS }, { role: "user", content: userPrompt }],
          temperature: 0.5, max_tokens: 2500,
          response_format: { type: "json_object" }, enable_thinking: false,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(to);
      const j = await r.json().catch(() => null) as { choices?: { message?: { content?: string } }[]; error?: { code?: string } } | null;
      if (!r.ok || !j || j.error) { llmError = j?.error?.code ?? `http_${r.status}`; continue; }
      const text = j.choices?.[0]?.message?.content?.trim();
      if (!text) { llmError = "empty"; continue; }
      let parsed: { question?: Record<string, unknown>; changesSummary?: string };
      try { parsed = JSON.parse(text); } catch { llmError = "parse_failed"; continue; }
      const q = parsed.question;
      if (!q || typeof q !== "object" || typeof q.stem !== "string") { llmError = "missing_field"; continue; }
      const orig = report.originalPayload;
      fixedPayload = {
        ...q,
        question_id: orig.question_id, subjectId: orig.subjectId, skill_id: orig.skill_id,
        skill_name: orig.skill_name, unit_id: orig.unit_id, unit_name: orig.unit_name,
        term: orig.term, grade: orig.grade ?? 4, difficulty: orig.difficulty,
        game_type: orig.game_type, play_as: orig.play_as, question_format: orig.question_format,
        cognitive_level: orig.cognitive_level, ability_dimension: orig.ability_dimension,
        exam_priority: orig.exam_priority, status: "approved",
        version: (typeof orig.version === "number" ? orig.version : 1) + 1,
        tags: Array.from(new Set([...((orig.tags as string[] | undefined) ?? []), "ai_fixed", `fixed_after:${report.reason}`])),
      };
      changesSummary = parsed.changesSummary ?? null;
      llmError = null;
      break;
    } catch (e) {
      llmError = "fetch_failed: " + (e as Error).message.slice(0, 80);
    }
  }

  const updated = {
    ...report,
    fixedPayload, changesSummary,
    fixStatus: fixedPayload ? "fixed" : "failed",
    fixedAt: Date.now(),
    llmError,
  };
  await ossPut(cfg, reportKey, JSON.stringify(updated, null, 2), {
    contentType: "application/json; charset=utf-8",
  });
  // Update index entry status
  try {
    const idxKey = `users/${targetUserId}/reports/index.json`;
    const idxGet = await ossGet(cfg, idxKey);
    if (idxGet.ok && idxGet.text) {
      const idx = JSON.parse(idxGet.text);
      const entry = idx.entries?.find((e: { id: string }) => e.id === reportId);
      if (entry) { entry.fixStatus = updated.fixStatus; idx.updatedAt = Date.now(); }
      await ossPut(cfg, idxKey, JSON.stringify(idx, null, 2), { contentType: "application/json; charset=utf-8" });
    }
  } catch { /* */ }

  if (!fixedPayload) {
    return c.json({ ok: false, error: "fix_failed", llmError }, 502);
  }
  return c.json({ ok: true, targetUserId, reportId, fixStatus: "fixed", changesSummary, fixedPayload });
});

/**
 * GET /api/super-admin/proxy-fallback-stats
 *
 * Ep32：本 EdgeRoutine isolate 启动以来，每个 path 被 proxy-fallback 命中
 * 多少次 + 上次时间 + 上次响应状态。
 *
 * 用途：让爸爸数据驱动决定先移植哪个 endpoint（高频被 proxy 的优先 native）。
 *
 * 限制：EdgeRoutine 跨 isolate 不聚合，worker 重启就清零；不是审计精度。
 * 但作 "本 isolate 在跑的几小时内哪个 endpoint 还在被打" 的 sampling 信号足够。
 */
superAdmin.get("/proxy-fallback-stats", (c) => {
  return c.json({ ok: true, ...getProxyFallbackStats() });
});

/**
 * GET /api/super-admin/data-integrity
 *
 * Ep41 (2026-05-17): 每个 cadet 的 snapshot 关键表行数矩阵 + 0 行告警.
 *
 * 背景：Ep38 救火时发现 OSS snapshot 的 fluencyAttempts/tutorSessions/fluencyStats
 * 全 0 — Selena 设备 push 时本地 IDB 也丢了 (dexie schema 漂移 / fresh browser 之类).
 * 这种"隐式数据丢失"完全没告警, 直到爸爸觉得不对手动 dump backup 对比才发现.
 *
 * 这个 endpoint 主动暴露: 每个用户每张关键表的当前行数, 哪个为 0 高亮告警.
 *
 * 读源：users/{userId}/stats.json (Ep148 在 push 时预计算的, ~1KB/user).
 * 不去 parse snapshot 本身 (3MB × N 用户 = ESA fetch budget 爆).
 *
 * 返回:
 *   { ok, users: [{userId, counts: {attempts,mistakes,trophies,...}, alerts: [...]}] }
 */
const REQUIRED_NONZERO_TABLES = [
  // 这些表 0 行 = 几乎肯定数据丢了 (Selena 用 > 1 天)
  "attempts", "mastery", "trophies",
];
const OFTEN_USED_TABLES = [
  // 这些 0 也可疑 (Selena 实际有数据)
  "mistakes", "fluencyAttempts", "tutorSessions",
];

superAdmin.get("/data-integrity", async (c) => {
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);
  const userIds = await listKnownUserIdsAsync(c.env);
  // ESA 8 fetch limit: 4 users × 1 stats.json = 4 fetches, safe
  const rows: Array<{
    userId: string;
    counts: Record<string, number>;
    snapshotBytes?: number;
    fetchedAt?: number;
    lastActivityMs?: number | null;
    alerts: string[];
    error?: string;
  }> = [];
  for (const uid of userIds) {
    const got = await ossGet(cfg, `users/${uid}/stats.json`);
    if (!got.ok || !got.text) {
      rows.push({
        userId: uid,
        counts: {},
        alerts: ["no_stats_json"],
        error: got.error ?? `oss_${got.status}`,
      });
      continue;
    }
    let stats: {
      counts?: Record<string, number>;
      snapshotBytes?: number;
      fetchedAt?: number;
      lastActivityMs?: number | null;
    };
    try {
      stats = JSON.parse(got.text);
    } catch {
      rows.push({ userId: uid, counts: {}, alerts: ["stats_corrupt"] });
      continue;
    }
    const counts = stats.counts ?? {};
    const alerts: string[] = [];
    // 只对实际"用过的"账号 alert: snapshotBytes 大 = 实际有数据，再有 0 行就告警
    const hasSnapshotData = (stats.snapshotBytes ?? 0) > 50_000;
    if (hasSnapshotData) {
      for (const t of REQUIRED_NONZERO_TABLES) {
        if ((counts[t] ?? 0) === 0) alerts.push(`${t}_zero`);
      }
      for (const t of OFTEN_USED_TABLES) {
        if ((counts[t] ?? 0) === 0) alerts.push(`${t}_zero_suspicious`);
      }
    }
    rows.push({
      userId: uid,
      counts,
      snapshotBytes: stats.snapshotBytes,
      fetchedAt: stats.fetchedAt,
      lastActivityMs: stats.lastActivityMs ?? null,
      alerts,
    });
  }
  // sort: alert 多的在前 (问题用户优先)
  rows.sort((a, b) => b.alerts.length - a.alerts.length);
  const totalAlerts = rows.reduce((s, r) => s + r.alerts.length, 0);
  return c.json({
    ok: true,
    asOf: Date.now(),
    userCount: rows.length,
    totalAlerts,
    requiredTables: REQUIRED_NONZERO_TABLES,
    suspiciousTables: OFTEN_USED_TABLES,
    users: rows,
  });
});

/** POST /api/super-admin/rebuild-index — 重建 users-index.json from per-user files */
superAdmin.post("/rebuild-index", async (c) => {
  const ids = await listKnownUserIdsAsync(c.env);
  const idx = await rebuildIndexFromUserIds(c.env, ids);
  return c.json({
    ok: true,
    rebuilt: Object.keys(idx.users).length,
    indexUpdatedAt: idx.updatedAt,
  });
});

/**
 * POST /api/super-admin/backup-snapshot
 *
 * 给 **全局映射文件**（_auth/users.json + _index/users.json）打点位时间命名快照，
 * 写到 `_backups/{ISO-timestamp}/...` 同 bucket 前缀。
 *
 * 为啥不备份 per-user snapshot.json？OSS bucket 已开 versioning，user 数据
 * 每次 PUT 自动新版本；点位恢复用 list-versions 即可。真正缺的是给「密码 map /
 * 用户索引」这俩高敏文件起一个 **可读的命名快照**，万一 reset 错或 onboarding
 * 误删 index，能一键挑出"昨天午饭前那版"。
 *
 * Body 可选 `{ note?: string }`（落到 manifest，方便人类后查找原因）。
 *
 * 返回 manifest: { backupId, copied: [{src, dest, versionId, etag, bytes}], skipped, errors }。
 */
const BACKUP_TARGETS = [
  "_auth/users.json",
  "_index/users.json",
] as const;

superAdmin.post("/backup-snapshot", async (c) => {
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  let body: { note?: string } = {};
  try { body = await c.req.json(); } catch { /* allow empty body */ }
  const note = (body.note ?? "").slice(0, 200);

  // ISO timestamp safe for OSS keys: 2026-05-17T091500Z
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const backupId = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const prefix = `_backups/${backupId}`;

  const copied: Array<{ src: string; dest: string; versionId?: string; etag?: string }> = [];
  const errors: Array<{ src: string; error: string }> = [];

  for (const src of BACKUP_TARGETS) {
    const dest = `${prefix}/${src}`;
    // ossCopy 不下载源到 worker，OSS 内部直接复制（零数据出口、不算 fetch budget）
    const r = await ossCopy(cfg, src, dest);
    if (!r.ok) {
      errors.push({ src, error: r.error ?? `oss_${r.status}` });
      continue;
    }
    copied.push({ src, dest, versionId: r.versionId, etag: r.etag });
  }

  // 写 manifest 方便后查
  const manifest = {
    schemaVersion: 1,
    backupId,
    createdAt: now.toISOString(),
    createdAtMs: now.getTime(),
    createdBy: getUserId(c),
    note,
    targets: BACKUP_TARGETS as readonly string[],
    copied,
    errors,
  };
  const manifestPut = await ossPut(
    cfg,
    `${prefix}/manifest.json`,
    JSON.stringify(manifest, null, 2),
    { contentType: "application/json; charset=utf-8" },
  );

  return c.json({
    ok: errors.length === 0,
    backupId,
    copied,
    errors,
    manifestOk: manifestPut.ok,
    manifestKey: `${prefix}/manifest.json`,
  });
});

/**
 * GET /api/super-admin/backup-snapshot
 * 列最近的 backup（按 prefix 列举 manifest.json）。
 *
 * 用 OSS ListObjectsV2 取 _backups/ 一级目录下的 CommonPrefixes，反向排序 limit 20。
 * 让 super-admin 可以看 "最近 N 次 backup 都在哪个时间点"。
 */
superAdmin.get("/backup-snapshot", async (c) => {
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  // OSS list v2: prefix=_backups/ + delimiter=/ → CommonPrefixes 给我们 backupId 目录
  const encodedPrefix = encodeURIComponent("_backups/");
  const date = new Date().toUTCString();
  // V1 sig with query subresource — list 不带 subresource，签名只用资源
  const stringToSign = ["GET", "", "", date, `/${cfg.bucket}/`].join("\n");
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(cfg.accessKeySecret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(stringToSign));
  let bin = "";
  const bytes = new Uint8Array(sigBuf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const sig = btoa(bin);
  const host = `${cfg.bucket}.${cfg.region}.aliyuncs.com`;
  const url = `https://${host}/?list-type=2&prefix=${encodedPrefix}&delimiter=%2F&max-keys=50`;
  let backups: Array<{ backupId: string; manifestUrl: string }> = [];
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: { Host: host, Date: date, Authorization: `OSS ${cfg.accessKeyId}:${sig}` },
    });
    if (r.ok) {
      const xml = await r.text();
      // CommonPrefixes 形如 <Prefix>_backups/2026-05-17T091500Z/</Prefix>
      const matches = xml.matchAll(/<Prefix>_backups\/([^<\/]+)\/<\/Prefix>/g);
      backups = [...matches]
        .map((m) => m[1]!)
        .filter((id) => /^\d{4}-\d{2}-\d{2}T\d{6}Z$/.test(id))
        .sort()
        .reverse()
        .slice(0, 20)
        .map((id) => ({
          backupId: id,
          manifestUrl: `/api/super-admin/backup-snapshot/${encodeURIComponent(id)}/manifest`,
        }));
    }
  } catch (e) {
    return c.json({ ok: false, error: "list_failed: " + (e as Error).message }, 502);
  }

  return c.json({ ok: true, count: backups.length, backups });
});

/**
 * GET /api/super-admin/backup-snapshot/:backupId
 * Get a single snapshot's manifest + file size headers (no body, keep response small).
 * Used by super-admin UI to "preview" a backup before rollback.
 */
const BACKUP_ID_RE = /^\d{4}-\d{2}-\d{2}T\d{6}Z$/;

superAdmin.get("/backup-snapshot/:backupId", async (c) => {
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);
  const id = c.req.param("backupId");
  if (!BACKUP_ID_RE.test(id)) {
    return c.json({ ok: false, error: "invalid_backupId" }, 400);
  }
  const prefix = `_backups/${id}`;
  const manifest = await ossGet(cfg, `${prefix}/manifest.json`);
  if (!manifest.ok || !manifest.text) {
    return c.json({ ok: false, error: "manifest_missing", status: manifest.status }, 404);
  }
  let manifestJson: unknown = null;
  try { manifestJson = JSON.parse(manifest.text); } catch { /* */ }

  // HEAD each backed-up file so we can report size + lastModified without
  // pulling the full bytes through EdgeRoutine
  const files: Array<{ key: string; bytes?: number; etag?: string; lastModifiedMs?: number }> = [];
  for (const src of BACKUP_TARGETS) {
    const key = `${prefix}/${src}`;
    const h = await ossHead(cfg, key);
    files.push({
      key,
      bytes: h.contentLength,
      etag: h.etag,
      lastModifiedMs: h.lastModifiedMs,
    });
  }
  return c.json({ ok: true, backupId: id, manifest: manifestJson, files });
});

/**
 * GET /api/super-admin/backup-snapshot/:backupId/file?path=<BACKUP_TARGETS-entry>
 *
 * 读 backup 里某个具体文件的内容（restore 前的最后一道人工 review）。
 * 路径必须在 BACKUP_TARGETS 白名单里，防止任意 OSS 读 (e.g. ?path=../users/selena/snapshot.json)。
 * 内容截到前 64 KB，避免 EdgeRoutine 11s + 128MB 限。客户端拿到 truncated
 * flag 时显示 "...内容已截断" 提示。
 */
const PREVIEW_MAX_BYTES = 64 * 1024;

superAdmin.get("/backup-snapshot/:backupId/file", async (c) => {
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);
  const id = c.req.param("backupId");
  if (!BACKUP_ID_RE.test(id)) {
    return c.json({ ok: false, error: "invalid_backupId" }, 400);
  }
  const path = c.req.query("path") ?? "";
  if (!(BACKUP_TARGETS as readonly string[]).includes(path)) {
    return c.json({ ok: false, error: "path_not_in_whitelist", allowed: BACKUP_TARGETS }, 400);
  }
  const key = `_backups/${id}/${path}`;
  const got = await ossGet(cfg, key);
  if (!got.ok || !got.text) {
    return c.json({ ok: false, error: "not_found", status: got.status }, 404);
  }
  const truncated = got.text.length > PREVIEW_MAX_BYTES;
  const content = truncated ? got.text.slice(0, PREVIEW_MAX_BYTES) : got.text;
  return c.json({
    ok: true,
    backupId: id,
    path,
    bytes: got.text.length,
    truncated,
    content,
    etag: got.etag,
    versionId: got.versionId,
  });
});

/**
 * POST /api/super-admin/backup-snapshot/:backupId/restore
 *
 * 安全 rollback：
 *   1. 先把【当前】_auth + _index 文件再做一次命名 snapshot（前缀 `_backups/{newId}-pre-restore-of-{id}/`）
 *      —— 万一回滚错版还能再翻回来
 *   2. 然后 ossCopy 把目标 backupId 的文件覆盖到主路径 (_auth/users.json, _index/users.json)
 *
 * Body 可选 `{ files: string[] }` 限定恢复哪些（默认全部 BACKUP_TARGETS）。
 */
superAdmin.post("/backup-snapshot/:backupId/restore", async (c) => {
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);
  const id = c.req.param("backupId");
  if (!BACKUP_ID_RE.test(id)) {
    return c.json({ ok: false, error: "invalid_backupId" }, 400);
  }

  let body: { files?: string[] } = {};
  try { body = await c.req.json(); } catch { /* */ }
  const requested = Array.isArray(body.files) && body.files.length > 0
    ? body.files.filter((f) => (BACKUP_TARGETS as readonly string[]).includes(f))
    : [...BACKUP_TARGETS];
  if (requested.length === 0) {
    return c.json({ ok: false, error: "no_valid_files_requested" }, 400);
  }

  // Step 1: 先 backup 当前状态（safety net）
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const preId = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z-pre-restore-of-${id}`;
  const prePrefix = `_backups/${preId}`;
  const preBackup: Array<{ src: string; dest: string; versionId?: string }> = [];
  const preBackupErrors: Array<{ src: string; error: string }> = [];
  for (const f of requested) {
    const r = await ossCopy(cfg, f, `${prePrefix}/${f}`);
    if (!r.ok) preBackupErrors.push({ src: f, error: r.error ?? `oss_${r.status}` });
    else preBackup.push({ src: f, dest: `${prePrefix}/${f}`, versionId: r.versionId });
  }
  if (preBackupErrors.length > 0) {
    // 安全网失败就拒绝 restore（避免无法回滚）
    return c.json({
      ok: false,
      error: "pre_restore_backup_failed",
      detail: "current state pre-backup failed; restore aborted to avoid unrecoverable rollback",
      preBackupErrors,
    }, 502);
  }

  // Step 2: ossCopy backup → main
  const restored: Array<{ file: string; from: string; versionId?: string; etag?: string }> = [];
  const restoreErrors: Array<{ file: string; error: string }> = [];
  for (const f of requested) {
    const src = `_backups/${id}/${f}`;
    const r = await ossCopy(cfg, src, f);
    if (!r.ok) {
      restoreErrors.push({ file: f, error: r.error ?? `oss_${r.status}` });
      continue;
    }
    restored.push({ file: f, from: src, versionId: r.versionId, etag: r.etag });
  }

  // Step 3: 写 manifest 记录 restore 事件
  const restoreManifest = {
    schemaVersion: 1,
    type: "pre-restore-snapshot",
    preRestoreBackupId: preId,
    restoredFromBackupId: id,
    requestedAt: now.toISOString(),
    requestedAtMs: now.getTime(),
    requestedBy: getUserId(c),
    files: requested,
    preBackup,
    restored,
    restoreErrors,
  };
  await ossPut(
    cfg,
    `${prePrefix}/manifest.json`,
    JSON.stringify(restoreManifest, null, 2),
    { contentType: "application/json; charset=utf-8" },
  );

  return c.json({
    ok: restoreErrors.length === 0,
    restoredFromBackupId: id,
    preRestoreBackupId: preId,
    restored,
    restoreErrors,
  });
});

/** GET /api/super-admin/me — 当前用户是不是 super-admin（前端 nav 用） */
superAdmin.get("/me", async (c) => {
  const userId = getUserId(c);
  const admins = getSuperAdmins(c.env);
  return c.json({
    ok: true,
    userId,
    isSuperAdmin: admins.has(userId),
    superAdmins: [...admins],
  });
});

/**
 * POST /api/super-admin/users/:userId/profile
 * 超级管理员代任意同学改 profile（家长不会用 / 偷懒不补的时候）。
 * Body: 同 POST /api/profile (部分 patch)，但目标 userId 来自 URL（不是 auth）。
 */
const ALLOWED_FIELDS = new Set([
  "displayName", "gradeBand", "school", "city", "grade", "class",
  "birthday", "guardianRole", "guardianPhone",
]);

superAdmin.post("/users/:userId/profile", async (c) => {
  const targetUserId = c.req.param("userId");
  if (!isValidUserId(targetUserId)) {
    return c.json({ ok: false, error: "invalid_target_userId" }, 400);
  }
  // 必须是已知 userId（防意外创建）
  const known = new Set(await listKnownUserIdsAsync(c.env));
  if (!known.has(targetUserId)) {
    return c.json({ ok: false, error: "unknown_userId", target: targetUserId }, 404);
  }
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  let patch: Record<string, unknown>;
  try {
    patch = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!patch || typeof patch !== "object") {
    return c.json({ ok: false, error: "invalid_body" }, 400);
  }

  // 读现有 profile
  const profileKey = `users/${targetUserId}/profile.json`;
  let current: Record<string, unknown> = {
    schemaVersion: 1,
    userId: targetUserId,
    createdAt: Date.now(),
    createdBy: "super-admin",
  };
  const got = await ossGet(cfg, profileKey);
  if (got.ok && got.text) {
    try {
      current = JSON.parse(got.text);
    } catch {
      /* 重建 */
    }
  }

  const merged = { ...current };
  let changed = 0;
  for (const [k, v] of Object.entries(patch)) {
    if (!ALLOWED_FIELDS.has(k)) continue;
    if (v === null) {
      merged[k] = null;
      changed++;
      continue;
    }
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (trimmed.length > 100) continue;
    merged[k] = trimmed;
    changed++;
  }
  merged.userId = targetUserId;
  merged.updatedAt = Date.now();
  merged.lastEditedBy = `super-admin:${getUserId(c)}`;

  if (changed === 0) {
    return c.json({ ok: false, error: "no_valid_fields" }, 400);
  }

  const put = await ossPut(cfg, profileKey, JSON.stringify(merged, null, 2), {
    contentType: "application/json; charset=utf-8",
  });
  if (!put.ok) {
    return c.json({ ok: false, error: put.error }, 502);
  }
  // Ep153 同步到 users-index
  await patchUserInIndex(c.env, targetUserId, { profile: merged, displayName: merged.displayName as string });
  return c.json({
    ok: true,
    targetUserId,
    profile: merged,
    updated: changed,
  });
});

/**
 * GET /api/super-admin/users/:userId/stats
 *
 * v0.34.18 (Ep148): 拉某个同学的真实学习数据。
 * 读 OSS users/{uid}/snapshot.json，解 JSON，提取关键计数 + 分布。
 *
 * 不缓存（snapshot 频繁更新）。后续可考虑 cache 30s。
 *
 * 返回：
 *   {
 *     ok, userId, sizeKB,
 *     counts: { attempts, mistakes, trophies, sessions, mastery, ... },
 *     today: { attempts, sessions },     // 当天（本机时区简化为 UTC+8）
 *     last7Days: { attempts },
 *     bySubject: { math, chinese, english } counts
 *     topMistakeSkills: [{skillId, count}] (top 5)
 *     lastActivity: { date, sessionCount }
 *     fetchedAt
 *   }
 */
superAdmin.get("/users/:userId/stats", async (c) => {
  const targetUserId = c.req.param("userId");
  if (!isValidUserId(targetUserId)) {
    return c.json({ ok: false, error: "invalid_target_userId" }, 400);
  }
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  // 读 push 流预算好的 stats.json（小文件 < 2KB）
  // 第一次访问可能没有：snapshot.json 在 ProfileGate 启用前已存，stats.json
  // 是新加的，等下次 push 才有。
  const got = await ossGet(cfg, `users/${targetUserId}/stats.json`);
  if (got.ok && got.text) {
    try {
      const stats = JSON.parse(got.text);
      return c.json({ ok: true, userId: targetUserId, ...stats });
    } catch {
      /* fallthrough */
    }
  }
  // 没缓存 → 返 stub + 提示
  return c.json({
    ok: true,
    userId: targetUserId,
    counts: {},
    today: { attempts: 0, sessions: 0 },
    last7Days: { attempts: 0 },
    bySubject: {},
    topMistakeSkills: [],
    empty: true,
    note: "stats not cached yet, will appear after next cloud push",
  });
});

/**
 * POST /api/super-admin/users/:userId/agent-summary
 *
 * v0.34.20 (Ep150) 爸爸路线图：24h AI agent Phase 0 —— 按需生成摘要。
 *
 * 读 profile + stats，用 TOKEN_PLAN_CN qwen3.6-flash 生成 3 段中文：
 *   1. 学习状态总结（给 super-admin 看）
 *   2. 给同学的鼓励（亲切，可发给同学）
 *   3. 给监护人的反馈（按 guardianRole 调用称呼，可发给监护人）
 *
 * 结果存 OSS users/{uid}/agent-summaries/latest.json + 历史 {ts}.json，
 * 后续 Phase 1 cron 可定期跑。
 */
superAdmin.post("/users/:userId/agent-summary", async (c) => {
  const targetUserId = c.req.param("userId");
  if (!isValidUserId(targetUserId)) {
    return c.json({ ok: false, error: "invalid_target_userId" }, 400);
  }
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  const apiKey = c.env.TOKEN_PLAN_CN_API_KEY ?? c.env.BAILIAN_API_KEY;
  if (!apiKey) return c.json({ ok: false, error: "no_llm_api_key" }, 503);

  // 并行拉 profile + stats
  const [profileGet, statsGet] = await Promise.all([
    ossGet(cfg, `users/${targetUserId}/profile.json`),
    ossGet(cfg, `users/${targetUserId}/stats.json`),
  ]);

  let profile: Record<string, unknown> = { userId: targetUserId };
  if (profileGet.ok && profileGet.text) {
    try {
      profile = JSON.parse(profileGet.text);
    } catch {
      /* */
    }
  }
  let stats: Record<string, unknown> = {};
  if (statsGet.ok && statsGet.text) {
    try {
      stats = JSON.parse(statsGet.text);
    } catch {
      /* */
    }
  }

  const displayName = (profile.displayName as string) ?? targetUserId;
  const guardianRole = (profile.guardianRole as string) ?? "家长";

  const systemPrompt = `你是一位耐心、专业的小学生学习教练。你会根据同学的学习数据 (attempts/mistakes/正确率/学科分布等)，写出 3 段简短中文：
1. **学习状态摘要**（80-120字）—— 给项目管理者看的内部洞察，客观分析进展和瓶颈
2. **给同学的鼓励**（40-80字）—— 亲切、具体、有正向反馈和小目标，能直接发给同学
3. **给${guardianRole}的反馈**（80-120字）—— 平和、建设性、给家庭学习建议，能直接发给${guardianRole}

输出 JSON：
{"summary":"...", "messageToStudent":"...", "messageToGuardian":"..."}

只输出 JSON，不要 markdown 包裹，不要任何前后缀。`;

  const userPrompt = `同学：${displayName}（${profile.school ?? "未填学校"}，${profile.grade ?? "?"}年级${profile.class ?? "?"}班）
监护人：${guardianRole}（手机 ${profile.guardianPhone ?? "未填"}）
生日：${profile.birthday ?? "未填"}

学习数据（截至 ${new Date(Number(stats.fetchedAt ?? Date.now())).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}）：
- 累计：${JSON.stringify(stats.counts ?? {})}
- 今天答题：${(stats.today as { attempts?: number })?.attempts ?? 0}
- 7天答题：${(stats.last7Days as { attempts?: number })?.attempts ?? 0}
- 学科分布：${JSON.stringify(stats.bySubject ?? {})}
- 近100题正确率：${stats.correctRateRecent100 ?? "?"}%
- Top错题skill：${JSON.stringify(stats.topMistakeSkills ?? [])}
- 上次活跃：${stats.lastActivityMs ? new Date(Number(stats.lastActivityMs)).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "未知"}

按上面要求输出 JSON。`;

  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 9_500);
    const baseUrl = c.env.TOKEN_PLAN_CN_API_KEY
      ? "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"
      : "https://dashscope.aliyuncs.com/compatible-mode/v1";
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen3.6-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 1200,
        // 关键：关掉 reasoning thinking。开着的话 qwen3.6-flash 6s+ 触发
        // ESA 11s timeout；关掉 0.5-2s 内返。我们的 task 是纯写作，不需推理。
        enable_thinking: false,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return c.json({ ok: false, error: "llm_http_error", status: r.status, detail: text.slice(0, 300) }, 502);
    }
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
    const content = j.choices?.[0]?.message?.content ?? "";
    if (!content) {
      return c.json({ ok: false, error: "empty_llm_response", raw: JSON.stringify(j).slice(0, 300) }, 502);
    }
    // Strip code fences if model still wrapped
    const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
    let parsed: { summary?: string; messageToStudent?: string; messageToGuardian?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // fallback: return raw text
      return c.json({ ok: true, targetUserId, raw: cleaned, parseError: true });
    }

    const result = {
      targetUserId,
      displayName,
      guardianRole,
      summary: parsed.summary,
      messageToStudent: parsed.messageToStudent,
      messageToGuardian: parsed.messageToGuardian,
      generatedAt: Date.now(),
      model: "qwen3.6-flash",
      generatedBy: getUserId(c),
    };

    // 存档：latest + 历史
    await ossPut(
      cfg,
      `users/${targetUserId}/agent-summaries/latest.json`,
      JSON.stringify(result, null, 2),
      { contentType: "application/json; charset=utf-8" },
    );
    await ossPut(
      cfg,
      `users/${targetUserId}/agent-summaries/${result.generatedAt}.json`,
      JSON.stringify(result, null, 2),
      { contentType: "application/json; charset=utf-8" },
    );

    // Ep153 同步到 users-index
    await patchUserInIndex(c.env, targetUserId, {
      latestSummary: {
        generatedAt: result.generatedAt,
        preview: (result.summary ?? "").slice(0, 50),
      },
    });

    return c.json({ ok: true, ...result });
  } catch (e) {
    return c.json(
      { ok: false, error: "llm_fetch_failed", detail: (e as Error).message },
      502,
    );
  }
});

/** GET 上次生成的 summary（不重新调 LLM） */
superAdmin.get("/users/:userId/agent-summary", async (c) => {
  const targetUserId = c.req.param("userId");
  if (!isValidUserId(targetUserId)) {
    return c.json({ ok: false, error: "invalid_target_userId" }, 400);
  }
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);
  const got = await ossGet(cfg, `users/${targetUserId}/agent-summaries/latest.json`);
  if (!got.ok || !got.text) {
    return c.json({ ok: true, targetUserId, hasLatest: false });
  }
  try {
    const parsed = JSON.parse(got.text);
    return c.json({ ok: true, targetUserId, hasLatest: true, ...parsed });
  } catch {
    return c.json({ ok: false, error: "corrupt_summary" }, 500);
  }
});

/**
 * POST /api/super-admin/users/:userId/password
 * 重置任意同学的密码。返回新密码（明文，仅这次显示，super-admin 自己抄走给监护人）
 */
superAdmin.post("/users/:userId/password", async (c) => {
  const targetUserId = c.req.param("userId");
  const r = await resetPasswordForUser(c.env, targetUserId);
  if (!r.ok) {
    const status = r.error === "unknown_userId" ? 404 : r.error === "oss_not_configured" ? 503 : 400;
    return c.json({ ok: false, error: r.error, targetUserId }, status);
  }
  console.log(`[super-admin] ${getUserId(c)} reset password for ${targetUserId} (rotated ${r.rotated})`);
  return c.json({
    ok: true,
    targetUserId,
    newPassword: r.newPassword,
    rotatedOldPasswords: r.rotated,
    loginUrl: `https://${targetUserId}.xiaojin.app`,
    fallbackUrl: "https://xiaojin.app",
  });
});

/**
 * POST /api/super-admin/users
 * 新建同学账户（不需要 redeploy）。Body: { userId, displayName? }
 * 返回 { newPassword } 给 super-admin 复制给监护人。
 * 监护人首次登录会被 ProfileGate 提示补全档案。
 */
superAdmin.post("/users", async (c) => {
  let body: { userId?: string; displayName?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.userId) {
    return c.json({ ok: false, error: "missing_userId" }, 400);
  }
  const r = await addNewStudent(c.env, body.userId);
  if (!r.ok) {
    const status = r.error === "userId_exists" ? 409 : r.error === "reserved_userId" ? 400 : 400;
    return c.json({ ok: false, error: r.error }, status);
  }
  // optional displayName → seed profile
  if (body.displayName) {
    const cfg = getOssConfig(c.env);
    if (cfg) {
      const profile = {
        schemaVersion: 1,
        userId: body.userId,
        displayName: body.displayName.slice(0, 50),
        createdAt: Date.now(),
        createdBy: `super-admin:${getUserId(c)}`,
      };
      await ossPut(cfg, `users/${body.userId}/profile.json`, JSON.stringify(profile, null, 2), { contentType: "application/json; charset=utf-8" });
      await patchUserInIndex(c.env, body.userId, { profile, displayName: body.displayName.slice(0, 50) });
    }
  } else {
    // 即使没 displayName 也要 insert index entry
    await patchUserInIndex(c.env, body.userId, { displayName: body.userId });
  }
  console.log(`[super-admin] ${getUserId(c)} created new user ${body.userId}`);
  return c.json({
    ok: true,
    userId: body.userId,
    newPassword: r.password,
    loginUrl: `https://${body.userId}.xiaojin.app`,
    fallbackUrl: "https://xiaojin.app",
  });
});

export default superAdmin;
