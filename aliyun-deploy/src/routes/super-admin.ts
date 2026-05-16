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
import type { Env } from "../lib/env";
import { requireAuth, getUserId } from "../lib/auth";
import { getOssConfig, ossGet, ossHead, ossPut, snapshotKey } from "../lib/oss";
import {
  listKnownUserIds as listKnownUserIdsAsync,
  resetPasswordForUser,
  addNewStudent,
} from "../lib/auth-store";

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

// 所有 super-admin endpoints 都先校验权限
superAdmin.use("*", requireAuth, async (c, next) => {
  const userId = getUserId(c);
  const admins = getSuperAdmins(c.env);
  if (!admins.has(userId)) {
    return c.json({ ok: false, error: "not_super_admin", userId }, 403);
  }
  await next();
});

superAdmin.get("/users", async (c) => {
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  const ids = await listKnownUserIdsAsync(c.env);
  const admins = getSuperAdmins(c.env);

  const users = await Promise.all(
    ids.map(async (uid) => {
      // 并行拉 profile + snapshot HEAD
      const [profileGet, snapHead] = await Promise.all([
        ossGet(cfg, `users/${uid}/profile.json`),
        ossHead(cfg, snapshotKey(uid)),
      ]);
      let profile: Record<string, unknown> | null = null;
      if (profileGet.ok && profileGet.text) {
        try {
          profile = JSON.parse(profileGet.text);
        } catch {
          /* corrupt → null */
        }
      }
      return {
        userId: uid,
        isSuperAdmin: admins.has(uid),
        profile,
        snapshot: {
          present: snapHead.ok,
          lastModifiedMs: snapHead.lastModifiedMs ?? null,
          etag: snapHead.etag ?? null,
          bytes: snapHead.contentLength ?? null,
        },
      };
    }),
  );

  return c.json({
    ok: true,
    count: users.length,
    superAdminCount: users.filter((u) => u.isSuperAdmin).length,
    asOf: Date.now(),
    users,
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
      await ossPut(cfg, `users/${body.userId}/profile.json`, JSON.stringify({
        schemaVersion: 1,
        userId: body.userId,
        displayName: body.displayName.slice(0, 50),
        createdAt: Date.now(),
        createdBy: `super-admin:${getUserId(c)}`,
      }, null, 2), { contentType: "application/json; charset=utf-8" });
    }
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
