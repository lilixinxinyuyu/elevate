/**
 * users-index.json — 单文件聚合所有 user 的 dashboard 数据
 *
 * v0.34.24 (Ep153) 解决 ESA EdgeRoutine 8 fetch limit：
 * 之前 /users 每 user 4 reads × N users 爆 8 fetch。
 * 现在 /users 只读 1 个 index = 1 fetch 总，无关 N。
 *
 * OSS path: `_index/users.json`
 *
 * Shape:
 *   {
 *     schemaVersion: 1,
 *     updatedAt: <ms>,
 *     users: {
 *       "<userId>": {
 *         userId, displayName,
 *         profile: <full profile snapshot>,
 *         snapshotMs, snapshotBytes,
 *         statsKpi: { todayAttempts, last7Attempts, correctRate },
 *         latestSummary: { generatedAt, preview },
 *         lastIndexedAt
 *       }
 *     }
 *   }
 *
 * 写策略：每个产生数据变化的 endpoint 都 patch index 对应字段：
 *   - sync.ts uploadHandler   → patch stats + snapshot info
 *   - super-admin.ts profile  → patch profile snapshot
 *   - super-admin.ts password → 不 patch (密码不在 index)
 *   - super-admin.ts agent-summary → patch latestSummary
 *   - super-admin.ts add user → insert userId entry
 *   - profile.ts POST → patch profile snapshot
 *
 * 并发风险：read-merge-write 在并发更新时 last-write-wins。super-admin 低
 * 频操作风险小；sync upload 频繁但单同学单 push，跨同学不冲突，所以也 OK。
 *
 * 自愈：失败 patch 不阻塞主响应。读 index 时如果某 user 缺，前端 fallback 0/null。
 */

import type { Env } from "./env";
import { getOssConfig, ossGet, ossPut } from "./oss";

const INDEX_KEY = "_index/users.json";

export interface UserIndexEntry {
  userId: string;
  displayName?: string | null;
  profile?: Record<string, unknown> | null;
  snapshotMs?: number | null;
  snapshotBytes?: number | null;
  statsKpi?: {
    todayAttempts?: number;
    last7Attempts?: number;
    correctRate?: number;
  } | null;
  latestSummary?: {
    generatedAt?: number;
    preview?: string;
  } | null;
  lastIndexedAt?: number;
}

export interface UsersIndex {
  schemaVersion: 1;
  updatedAt: number;
  users: Record<string, UserIndexEntry>;
}

function emptyIndex(): UsersIndex {
  return { schemaVersion: 1, updatedAt: Date.now(), users: {} };
}

/** Read; returns empty if missing/corrupt */
export async function readUsersIndex(env: Env): Promise<UsersIndex> {
  const cfg = getOssConfig(env);
  if (!cfg) return emptyIndex();
  const got = await ossGet(cfg, INDEX_KEY);
  if (!got.ok || !got.text) return emptyIndex();
  try {
    const parsed = JSON.parse(got.text) as UsersIndex;
    if (!parsed || typeof parsed !== "object" || !parsed.users) return emptyIndex();
    return parsed;
  } catch {
    return emptyIndex();
  }
}

/**
 * Patch a user's entry. read-merge-write.
 * Best-effort: errors don't propagate (don't break main handler).
 */
export async function patchUserInIndex(
  env: Env,
  userId: string,
  patch: Partial<UserIndexEntry>,
): Promise<void> {
  const cfg = getOssConfig(env);
  if (!cfg) return;
  try {
    const idx = await readUsersIndex(env);
    const cur = idx.users[userId] ?? { userId };
    idx.users[userId] = {
      ...cur,
      ...patch,
      userId, // force
      lastIndexedAt: Date.now(),
    };
    idx.updatedAt = Date.now();
    await ossPut(cfg, INDEX_KEY, JSON.stringify(idx, null, 2), {
      contentType: "application/json; charset=utf-8",
    });
  } catch (e) {
    console.warn(`[users-index] patch ${userId} failed:`, (e as Error).message);
  }
}

/** Rebuild index from per-user files (for migration / cron healing) */
export async function rebuildIndexFromUserIds(env: Env, userIds: string[]): Promise<UsersIndex> {
  const cfg = getOssConfig(env);
  if (!cfg) return emptyIndex();
  const idx = emptyIndex();
  for (const uid of userIds) {
    // Sequential: avoid fetch limit
    const profileGet = await ossGet(cfg, `users/${uid}/profile.json`);
    let profile: Record<string, unknown> | null = null;
    if (profileGet.ok && profileGet.text) {
      try { profile = JSON.parse(profileGet.text); } catch { /* */ }
    }
    const statsGet = await ossGet(cfg, `users/${uid}/stats.json`);
    let statsKpi: UserIndexEntry["statsKpi"] = null;
    let snapshotBytes: number | null = null;
    if (statsGet.ok && statsGet.text) {
      try {
        const s = JSON.parse(statsGet.text) as {
          today?: { attempts?: number };
          last7Days?: { attempts?: number };
          correctRateRecent100?: number;
          snapshotBytes?: number;
        };
        statsKpi = {
          todayAttempts: s.today?.attempts ?? 0,
          last7Attempts: s.last7Days?.attempts ?? 0,
          correctRate: s.correctRateRecent100 ?? 0,
        };
        snapshotBytes = s.snapshotBytes ?? null;
      } catch { /* */ }
    }
    const summaryGet = await ossGet(cfg, `users/${uid}/agent-summaries/latest.json`);
    let latestSummary: UserIndexEntry["latestSummary"] = null;
    if (summaryGet.ok && summaryGet.text) {
      try {
        const su = JSON.parse(summaryGet.text) as { generatedAt?: number; summary?: string };
        latestSummary = { generatedAt: su.generatedAt, preview: (su.summary ?? "").slice(0, 50) };
      } catch { /* */ }
    }
    idx.users[uid] = {
      userId: uid,
      displayName: (profile?.displayName as string) ?? uid,
      profile,
      snapshotBytes,
      snapshotMs: null,
      statsKpi,
      latestSummary,
      lastIndexedAt: Date.now(),
    };
  }
  idx.updatedAt = Date.now();
  await ossPut(cfg, INDEX_KEY, JSON.stringify(idx, null, 2), {
    contentType: "application/json; charset=utf-8",
  });
  return idx;
}
