/**
 * /api/profile —— 同学 profile 读写
 *
 * v0.34.13 (Ep143): 爸爸 2026-05-17 加单。
 * 学生 profile 持久化到 OSS users/{userId}/profile.json，前端首登读这里渲染；
 * 缺字段时弹 onboarding modal 让监护人补。
 *
 * Schema (schemaVersion=1):
 *   {
 *     userId, displayName, gradeBand,
 *     school, city, grade, class, birthday,
 *     guardianRole, guardianPhone,
 *     createdAt, updatedAt, createdBy
 *   }
 *
 * 任意字段可 null（待补）。前端用 ProfileGate 检 missing fields 弹补全表单。
 */

import { Hono } from "hono";
import type { Env } from "../lib/env";
import { requireAuth, getUserId } from "../lib/auth";
import { getOssConfig, ossGet, ossPut } from "../lib/oss";
import { patchUserInIndex } from "../lib/users-index";

const profile = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

profile.use("*", requireAuth);

function profileKey(userId: string): string {
  return `users/${userId}/profile.json`;
}

interface Profile {
  schemaVersion: number;
  userId: string;
  displayName?: string | null;
  gradeBand?: string | null;
  school?: string | null;
  city?: string | null;
  grade?: string | null;
  class?: string | null;
  birthday?: string | null;
  guardianRole?: string | null;
  guardianPhone?: string | null;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
  /**
   * v0.34.92 iter 26: admin 远程触发 trophy-images 重拉.
   * admin 点 SuperAdmin "🔄 Force resync trophies" → POST 写这个时间戳.
   * 学生客户端 AuthGate bootstrap 读 profile, 如果 forceTrophyResyncRequestedAt
   * > localStorage xiaojinapp.lastForceTrophyResyncSeen → 自动 forceTrophyResync()
   * + 更新 LS. 不影响 student session, 完全 background.
   */
  forceTrophyResyncRequestedAt?: number;
}

const REQUIRED_FIELDS = [
  "displayName",
  "school",
  "grade",
  "class",
  "birthday",
  "guardianRole",
  "guardianPhone",
] as const;

function missingFields(p: Profile | null): string[] {
  if (!p) return [...REQUIRED_FIELDS];
  return REQUIRED_FIELDS.filter((k) => !p[k]);
}

/** GET /api/profile — 当前 userId 的 profile + 缺字段提示 */
profile.get("/", async (c) => {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  const got = await ossGet(cfg, profileKey(userId));
  if (got.status === 404) {
    return c.json({
      ok: true,
      userId,
      profile: null,
      missing: [...REQUIRED_FIELDS],
      needsOnboarding: true,
    });
  }
  if (!got.ok || !got.text) {
    return c.json({ ok: false, error: got.error ?? "get_failed" }, 502);
  }
  let p: Profile;
  try {
    p = JSON.parse(got.text);
  } catch (e) {
    return c.json({ ok: false, error: "corrupt_profile", detail: (e as Error).message }, 500);
  }
  const missing = missingFields(p);
  return c.json({
    ok: true,
    userId,
    profile: p,
    missing,
    needsOnboarding: missing.length > 0,
  });
});

/**
 * POST /api/profile — patch profile（merge 进现有，不是 replace）
 * Body: { displayName?, school?, city?, grade?, class?, birthday?, guardianRole?, guardianPhone? }
 *
 * userId 永远从 auth 取，不接受 body 覆写（防租户污染）。
 */
profile.post("/", async (c) => {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  let patch: Partial<Profile>;
  try {
    patch = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!patch || typeof patch !== "object") {
    return c.json({ ok: false, error: "invalid_body" }, 400);
  }

  // 读现有 profile
  let current: Profile = {
    schemaVersion: 1,
    userId,
    createdAt: Date.now(),
    createdBy: "self-onboarding",
  };
  const got = await ossGet(cfg, profileKey(userId));
  if (got.ok && got.text) {
    try {
      current = JSON.parse(got.text);
    } catch {
      // corrupt → 重新建
    }
  }

  // merge：只接受白名单字段，长度限制
  const ALLOWED = new Set([
    "displayName", "gradeBand", "school", "city", "grade", "class",
    "birthday", "guardianRole", "guardianPhone",
  ]);
  const merged: Profile = { ...current };
  let changed = 0;
  for (const [k, v] of Object.entries(patch)) {
    if (!ALLOWED.has(k)) continue;
    // 简单 sanitize
    if (v === null) {
      (merged as unknown as Record<string, unknown>)[k] = null;
      changed++;
      continue;
    }
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (trimmed.length > 100) continue; // 单字段超长拒
    (merged as unknown as Record<string, unknown>)[k] = trimmed;
    changed++;
  }
  merged.userId = userId; // force
  merged.updatedAt = Date.now();
  if (!merged.schemaVersion) merged.schemaVersion = 1;

  if (changed === 0) {
    return c.json({ ok: false, error: "no_valid_fields" }, 400);
  }

  const put = await ossPut(cfg, profileKey(userId), JSON.stringify(merged, null, 2), {
    contentType: "application/json; charset=utf-8",
  });
  if (!put.ok) {
    return c.json({ ok: false, error: put.error }, 502);
  }
  // Ep153 同步到 users-index
  await patchUserInIndex(c.env, userId, {
    profile: merged as unknown as Record<string, unknown>,
    displayName: (merged.displayName as string) ?? userId,
  });
  const missing = missingFields(merged);
  return c.json({
    ok: true,
    userId,
    profile: merged,
    missing,
    needsOnboarding: missing.length > 0,
    updated: changed,
  });
});

export default profile;
