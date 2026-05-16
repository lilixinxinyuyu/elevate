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

function listKnownUserIds(env: Env): string[] {
  const ids = new Set<string>();
  if (env.APP_PASSWORD) ids.add("selena"); // legacy default
  if (env.APP_USERS) {
    try {
      const m = JSON.parse(env.APP_USERS) as Record<string, string>;
      for (const v of Object.values(m)) {
        if (typeof v === "string" && isValidUserId(v)) ids.add(v);
      }
    } catch {
      /* */
    }
  }
  return [...ids].sort();
}

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

  const ids = listKnownUserIds(c.env);
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
  const known = new Set(listKnownUserIds(c.env));
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

export default superAdmin;
