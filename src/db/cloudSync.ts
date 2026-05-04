import { db } from "./dexie";

/**
 * 云同步：把 IndexedDB 全表 dump 成 JSON 上传到 /api/sync；下载时反向写回。
 *
 * 数据策略：
 * - 单用户场景，全量上传/下载（每次 ~1-5MB JSON，含 AI 勋章图后会大）
 * - 服务端保留最近 50 个快照历史
 * - 客户端在 localStorage 存最后一次成功 push 的 version
 *
 * 表覆盖：
 *   ✓ attempts / mastery / mistakes / sessions / trophies / meta / students /
 *     tutorSessions / trophyImages（v0.29.4 起，让 AI 勋章图跨设备同步）
 *   ✗ questions / skills / units（教材定义从代码 seed 来）
 *     —— 但题清理通过 meta:deletedQuestionIds 同步删除列表，让 A 设备的清理在 B 生效
 */

const PUSH_TABLES = [
  "attempts",
  "mastery",
  "mistakes",
  "sessions",
  "trophies",
  "meta",
  "students",
  "tutorSessions",
  // v0.29.4: AI 生成的勋章图也跨设备同步
  // 每张 ~150 KB base64 data URL, 总 ~3-5MB. 接受这个 bandwidth 成本。
  "trophyImages",
] as const;

const LAST_PUSH_KEY = "selena.cloud.lastPush";
const LAST_PULL_KEY = "selena.cloud.lastPull";
const PASSWORD_KEY = "selena.cloud.pwd";
const CLIENT_ID_KEY = "selena.cloud.clientId";

export function getStoredPassword(): string | null {
  try {
    return localStorage.getItem(PASSWORD_KEY);
  } catch {
    return null;
  }
}
export function storePassword(pwd: string): void {
  try {
    localStorage.setItem(PASSWORD_KEY, pwd);
  } catch {
    // ignore
  }
}
export function clearPassword(): void {
  try {
    localStorage.removeItem(PASSWORD_KEY);
  } catch {
    // ignore
  }
}

export function getClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = "client-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return "client-anon";
  }
}

export function getLastPushAt(): number {
  return Number(localStorage.getItem(LAST_PUSH_KEY) ?? 0);
}
export function getLastPullAt(): number {
  return Number(localStorage.getItem(LAST_PULL_KEY) ?? 0);
}
function setLastPushAt(t: number) {
  localStorage.setItem(LAST_PUSH_KEY, String(t));
}
function setLastPullAt(t: number) {
  localStorage.setItem(LAST_PULL_KEY, String(t));
}

interface SnapshotPayload {
  attempts: unknown[];
  mastery: unknown[];
  mistakes: unknown[];
  sessions: unknown[];
  trophies: unknown[];
  meta: unknown[];
  students: unknown[];
  /** v0.27.0：小进姐姐对话日志，按 id 合并、按 updatedAt 取新 */
  tutorSessions?: unknown[];
  /** v0.29.4：AI 生成的勋章图，按 trophyId 合并、按 generatedAt 取新 */
  trophyImages?: unknown[];
}

async function dumpLocal(): Promise<SnapshotPayload> {
  const bag: Record<string, unknown[]> = {};
  for (const t of PUSH_TABLES) {
    bag[t] = await db.table(t).toArray();
  }
  return bag as unknown as SnapshotPayload;
}

/**
 * 紧急覆盖：清空本地表然后从云端整体写回。**会丢失本地未推送的所有数据**。
 *
 * 平时不要用！只在需要"全设备硬重置回云端最近一份快照"时用（admin 紧急恢复）。
 *
 * 默认 pullFromCloud 走 applyPayloadMerged 安全合并。
 */
export async function applyPayloadOverwrite(payload: SnapshotPayload): Promise<void> {
  await db.transaction(
    "rw",
    [db.attempts, db.mastery, db.mistakes, db.sessions, db.trophies, db.meta, db.students, db.tutorSessions, db.trophyImages],
    async () => {
      for (const t of PUSH_TABLES) {
        const rows = (payload[t] ?? []) as Record<string, unknown>[];
        if (!Array.isArray(rows)) continue;
        const tbl = db.table(t);
        await tbl.clear();
        if (rows.length > 0) await tbl.bulkPut(rows);
      }
    },
  );
}

/**
 * 三方合并：云端 ⊕ 本地 → 写回本地。
 *
 * 设计原则：**本地新写入永不被远程旧快照覆盖**。
 *
 * 表逻辑：
 * - attempts：append-only。union by id，从来不动已有 row（attempts 不可改）
 * - mastery：id-keyed (studentId::skillId)。比 updatedAt，新覆盖旧
 * - mistakes：id-keyed。比 lastAttemptAt，新覆盖旧
 * - sessions：id-keyed。比 finishedAt > startedAt，新覆盖旧
 * - trophies：append-only (每次 unlock 一个 row)。union by id
 * - students：id-keyed (一般就 1 行)。**保留本地**（user 主动改的 currentUnitId/currentTerm）
 * - meta：key-keyed。分类处理：
 *     - 数值（totalXp 等单调递增）→ 取 max
 *     - 数组（tiersUnlocked 等只增加）→ union
 *     - object 带 computedAt（rating::*）→ 取 newer
 *     - 其他（selectedTerm/selectedSubject/equippedBadge）→ **保留本地**
 *
 * 这套逻辑保证：A 设备的进度被 push 后，B 设备 pull 能拿到 A 的所有 row；
 * 同时 B 在 pull 之间做的进度不会被 pull 清空。
 */
async function applyPayloadMerged(payload: SnapshotPayload): Promise<void> {
  await db.transaction(
    "rw",
    [db.attempts, db.mastery, db.mistakes, db.sessions, db.trophies, db.meta, db.students, db.tutorSessions, db.trophyImages],
    async () => {
      // attempts: pure union (immutable rows)
      const remoteA = (payload.attempts ?? []) as Array<{ id: string }>;
      if (remoteA.length > 0) {
        const localA = await db.attempts.toArray();
        const localIds = new Set(localA.map((r) => r.id));
        const toAdd = remoteA.filter((r) => !localIds.has(r.id));
        if (toAdd.length > 0) await db.attempts.bulkPut(toAdd as never);
      }

      // mastery: union by id, prefer newer updatedAt
      const remoteM = (payload.mastery ?? []) as Array<{
        id: string;
        updatedAt?: number;
      }>;
      if (remoteM.length > 0) {
        const localM = await db.mastery.toArray();
        const localById = new Map(localM.map((r) => [r.id, r]));
        const toPut: typeof remoteM = [];
        for (const r of remoteM) {
          const local = localById.get(r.id);
          if (!local || (r.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
            toPut.push(r);
          }
        }
        if (toPut.length > 0) await db.mastery.bulkPut(toPut as never);
      }

      // mistakes: union by id, prefer newer lastAttemptAt
      const remoteMi = (payload.mistakes ?? []) as Array<{
        id: string;
        lastAttemptAt?: number;
      }>;
      if (remoteMi.length > 0) {
        const localMi = await db.mistakes.toArray();
        const localById = new Map(localMi.map((r) => [r.id, r]));
        const toPut: typeof remoteMi = [];
        for (const r of remoteMi) {
          const local = localById.get(r.id);
          if (!local || (r.lastAttemptAt ?? 0) > (local.lastAttemptAt ?? 0)) {
            toPut.push(r);
          }
        }
        if (toPut.length > 0) await db.mistakes.bulkPut(toPut as never);
      }

      // sessions: union by id, prefer newer finishedAt or startedAt
      const remoteS = (payload.sessions ?? []) as Array<{
        id: string;
        startedAt?: number;
        finishedAt?: number;
      }>;
      if (remoteS.length > 0) {
        const localS = await db.sessions.toArray();
        const localById = new Map(localS.map((r) => [r.id, r]));
        const toPut: typeof remoteS = [];
        for (const r of remoteS) {
          const local = localById.get(r.id);
          if (!local) {
            toPut.push(r);
            continue;
          }
          const remoteTs = r.finishedAt ?? r.startedAt ?? 0;
          const localTs = local.finishedAt ?? local.startedAt ?? 0;
          if (remoteTs > localTs) toPut.push(r);
        }
        if (toPut.length > 0) await db.sessions.bulkPut(toPut as never);
      }

      // trophies: pure union by id (each unlock creates a unique row)
      const remoteT = (payload.trophies ?? []) as Array<{ id: string }>;
      if (remoteT.length > 0) {
        const localT = await db.trophies.toArray();
        const localIds = new Set(localT.map((r) => r.id));
        const toAdd = remoteT.filter((r) => !localIds.has(r.id));
        if (toAdd.length > 0) await db.trophies.bulkPut(toAdd as never);
      }

      // tutorSessions: union by id, prefer newer updatedAt
      // 对话日志只增不删，本地 / 云端各有的最终都汇总到本地。
      const remoteTu = (payload.tutorSessions ?? []) as Array<{
        id: string;
        updatedAt?: number;
      }>;
      if (remoteTu.length > 0) {
        const localTu = await db.tutorSessions.toArray();
        const localById = new Map(localTu.map((r) => [r.id, r]));
        const toPut: typeof remoteTu = [];
        for (const r of remoteTu) {
          const local = localById.get(r.id);
          if (!local || (r.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
            toPut.push(r);
          }
        }
        if (toPut.length > 0) await db.tutorSessions.bulkPut(toPut as never);
      }

      // v0.29.4: trophyImages：union by trophyId, prefer newer generatedAt
      // AI 生成的勋章图缓存，跨设备同步让 A 设备生成的图 B 设备也能看到
      const remoteTi = (payload.trophyImages ?? []) as Array<{
        trophyId: string;
        generatedAt?: number;
      }>;
      if (remoteTi.length > 0) {
        const localTi = await db.trophyImages.toArray();
        const localById = new Map(localTi.map((r) => [r.trophyId, r]));
        const toPut: typeof remoteTi = [];
        for (const r of remoteTi) {
          const local = localById.get(r.trophyId);
          if (!local || (r.generatedAt ?? 0) > (local.generatedAt ?? 0)) {
            toPut.push(r);
          }
        }
        if (toPut.length > 0) await db.trophyImages.bulkPut(toPut as never);
      }

      // students: 保留本地（用户主动改的字段不被云端旧值覆盖）
      // 但本地不存在的 student 还是要从云端拉
      const remoteSt = (payload.students ?? []) as Array<{ id: string }>;
      if (remoteSt.length > 0) {
        const localSt = await db.students.toArray();
        const localIds = new Set(localSt.map((r) => r.id));
        const toAdd = remoteSt.filter((r) => !localIds.has(r.id));
        if (toAdd.length > 0) await db.students.bulkPut(toAdd as never);
      }

      // meta: 按 key 类型分别处理
      const remoteMeta = (payload.meta ?? []) as Array<{
        key: string;
        value: unknown;
      }>;
      if (remoteMeta.length > 0) {
        const localMeta = await db.meta.toArray();
        const localByKey = new Map(localMeta.map((r) => [r.key, r]));
        for (const r of remoteMeta) {
          const local = localByKey.get(r.key);
          if (!local) {
            await db.meta.put(r);
            continue;
          }
          // 数值（totalXp 等单调递增计数器）→ 取 max
          if (typeof r.value === "number" && typeof local.value === "number") {
            if (r.value > local.value) await db.meta.put(r);
            continue;
          }
          // 数组（tiersUnlocked 等只增加的解锁集）→ union
          if (Array.isArray(r.value) && Array.isArray(local.value)) {
            const merged = Array.from(
              new Set([...(local.value as unknown[]), ...(r.value as unknown[])]),
            );
            await db.meta.put({ key: r.key, value: merged });
            continue;
          }
          // object 带 computedAt（rating::*）→ 取 newer
          if (
            r.value &&
            typeof r.value === "object" &&
            local.value &&
            typeof local.value === "object" &&
            "computedAt" in (r.value as Record<string, unknown>) &&
            "computedAt" in (local.value as Record<string, unknown>)
          ) {
            const rTs = (r.value as { computedAt: number }).computedAt;
            const lTs = (local.value as { computedAt: number }).computedAt;
            if (rTs > lTs) await db.meta.put(r);
            continue;
          }
          // 其他（selectedTerm / selectedSubject / equippedBadge / mockExamLastAt）
          // → 保留本地（这些是 user 主动选的最新偏好）
          // 但 mockExamLastAt 应该取 max（最近一次完成更应保留）
          if (r.key.startsWith("mockExamLastAt::")) {
            if (
              typeof r.value === "number" &&
              typeof local.value === "number" &&
              r.value > local.value
            ) {
              await db.meta.put(r);
            }
            continue;
          }
          // 默认：保留本地不动
        }
      }
    },
  );
}

export interface SyncResult {
  ok: boolean;
  error?: string;
  version?: number;
  /** 拉取时是否发生了实际写入；上传时无意义 */
  changed?: boolean;
}

/**
 * 推送本地到云端。
 *
 * v0.29.6 关键修复：**先 pull-merge 再 push**。
 *
 * 老版本（v0.29.5 及之前）每次 push 直接 dump 本地 + INSERT 一行新 snapshot，
 * 服务端 download 总返最新一条 → 谁最后 push 谁覆盖。多设备场景下：
 *   - 设备 A 生成了一堆 trophyImages → push 上去
 *   - 设备 B 没生成图，自动 push → 把 A 的图 wipe 掉
 *   - 结果：cloud 总是 trophyImages=0
 *
 * 新版本：push 前 force-pull 一次，applyPayloadMerged 把云端"我没有的"合进本地，
 * 然后再 dump+push。push 的快照永远 ≥ cloud 当前快照（在合并意义上），
 * 不会发生数据缩水。
 *
 * 即使 pull 失败（网络抖动），仍然继续 push（本地优先策略）。
 */
export async function pushToCloud(): Promise<SyncResult> {
  const pwd = getStoredPassword();
  if (!pwd) return { ok: false, error: "no_password" };

  // v0.29.6: pull-merge 防覆盖
  try {
    await pullFromCloud({ force: true });
  } catch (e) {
    console.warn("[pushToCloud] pre-push pull failed (continuing anyway):", e);
  }

  // v0.29.7: 上传前检查图片总大小，若超 5 MB 强制重新压缩
  // 防止 v0.29.5 migration bug 残留的大图导致 cloud 上传 500
  try {
    const { ensureTrophyImagesUnderSizeLimit } = await import("../lib/trophyImages");
    const r = await ensureTrophyImagesUnderSizeLimit(5);
    if (r && r.recompressed > 0) {
      console.log(`[pushToCloud] pre-push recompressed ${r.recompressed} oversized image(s)`);
    }
  } catch (e) {
    console.warn("[pushToCloud] pre-push size guard failed (continuing):", e);
  }

  let payload: SnapshotPayload;
  try {
    payload = await dumpLocal();
  } catch (e) {
    return { ok: false, error: "dump_failed: " + (e as Error).message };
  }

  // v0.29.7: 最后一道防线 — 总 payload > 8 MB 直接 fail，告诉用户去 admin 清
  const estSizeMb = JSON.stringify(payload).length / 1024 / 1024;
  if (estSizeMb > 8) {
    return {
      ok: false,
      error: `payload_too_large_${estSizeMb.toFixed(1)}MB: 请去管理页清理勋章图缓存或 db.trophyImages.clear()`,
    };
  }
  const meta = {
    attemptsCount: payload.attempts.length,
    sessionsCount: payload.sessions.length,
    totalXp: extractTotalXp(payload),
    clientId: getClientId(),
  };
  try {
    const resp = await fetch("/api/sync/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pwd}`,
      },
      body: JSON.stringify({ payload, ...meta }),
    });
    if (resp.status === 401) return { ok: false, error: "unauthorized" };
    if (!resp.ok) return { ok: false, error: `http_${resp.status}` };
    const data = (await resp.json()) as { ok: boolean; version?: number };
    if (!data.ok) return { ok: false, error: "server_error" };
    if (data.version) setLastPushAt(data.version);
    return { ok: true, version: data.version };
  } catch (e) {
    return { ok: false, error: "network: " + (e as Error).message };
  }
}

export async function pullFromCloud(opts: { force?: boolean } = {}): Promise<SyncResult> {
  const pwd = getStoredPassword();
  if (!pwd) return { ok: false, error: "no_password" };
  const since = opts.force ? 0 : getLastPullAt();
  try {
    const resp = await fetch(`/api/sync/download?since=${since}`, {
      headers: { Authorization: `Bearer ${pwd}` },
    });
    if (resp.status === 401) return { ok: false, error: "unauthorized" };
    if (!resp.ok) return { ok: false, error: `http_${resp.status}` };
    const data = (await resp.json()) as {
      ok: boolean;
      latest: null | { payload: SnapshotPayload; version: number };
    };
    if (!data.ok) return { ok: false, error: "server_error" };
    if (!data.latest) return { ok: true, changed: false };
    // v0.26.1：用 merge 而非覆盖。本地新写入永远不会被远程旧快照清掉
    await applyPayloadMerged(data.latest.payload);
    setLastPullAt(data.latest.version);
    return { ok: true, changed: true, version: data.latest.version };
  } catch (e) {
    return { ok: false, error: "network: " + (e as Error).message };
  }
}

/** 主页/管理页判定是否启用云同步：默认启用，用 localStorage 关掉。 */
export function isCloudSyncEnabled(): boolean {
  try {
    return localStorage.getItem("selena.cloud.disabled") !== "1";
  } catch {
    return true;
  }
}

export async function checkPassword(pwd: string): Promise<boolean> {
  try {
    const resp = await fetch("/api/auth/check", {
      method: "POST",
      headers: { Authorization: `Bearer ${pwd}` },
    });
    return resp.ok;
  } catch {
    return false;
  }
}

function extractTotalXp(payload: SnapshotPayload): number {
  for (const m of payload.meta as Array<{ key?: string; value?: unknown }>) {
    if (typeof m?.key === "string" && m.key.startsWith("totalXp::") && typeof m.value === "number") {
      return m.value as number;
    }
  }
  return 0;
}
