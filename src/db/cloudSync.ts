import { db } from "./dexie";

/**
 * 云同步：把 IndexedDB 全表 dump 成 JSON 上传到 /api/sync；下载时反向写回。
 *
 * 数据策略：
 * - 单用户场景，全量上传/下载（每次 ~1-2MB JSON）
 * - 服务端保留最近 50 个快照历史
 * - 客户端在 localStorage 存最后一次成功 push 的 version
 *
 * 表覆盖：
 *   ✓ attempts / mastery / mistakes / sessions / trophies / meta / students
 *   ✗ questions / skills / units（这些是「教材定义」从代码 seed 来，不需要同步）
 */

const PUSH_TABLES = ["attempts", "mastery", "mistakes", "sessions", "trophies", "meta", "students"] as const;

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
}

async function dumpLocal(): Promise<SnapshotPayload> {
  const bag: Record<string, unknown[]> = {};
  for (const t of PUSH_TABLES) {
    bag[t] = await db.table(t).toArray();
  }
  return bag as unknown as SnapshotPayload;
}

async function applyPayload(payload: SnapshotPayload): Promise<void> {
  await db.transaction(
    "rw",
    [db.attempts, db.mastery, db.mistakes, db.sessions, db.trophies, db.meta, db.students],
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

export interface SyncResult {
  ok: boolean;
  error?: string;
  version?: number;
  /** 拉取时是否发生了实际写入；上传时无意义 */
  changed?: boolean;
}

export async function pushToCloud(): Promise<SyncResult> {
  const pwd = getStoredPassword();
  if (!pwd) return { ok: false, error: "no_password" };
  let payload: SnapshotPayload;
  try {
    payload = await dumpLocal();
  } catch (e) {
    return { ok: false, error: "dump_failed: " + (e as Error).message };
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
    await applyPayload(data.latest.payload);
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
