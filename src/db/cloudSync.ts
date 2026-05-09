import { db } from "./dexie";
import { cleanupOrphanMistakes } from "./seed";

/**
 * 云同步：把 IndexedDB 全表 dump 成 JSON 上传到 /api/sync；下载时反向写回。
 *
 * 数据策略：
 * - 单用户场景，全量上传/下载主数据（每次 ~0.5-1 MB JSON）
 * - **trophyImages 走独立 endpoint** /api/sync/trophy-images（按行存 D1）
 *   —— 因为整体 payload > 1.5 MB 时 D1 单参数超限会让 Worker 抛异常
 * - 服务端保留最近 50 个主快照历史
 * - 客户端在 localStorage 存最后一次成功 push 的 version
 *
 * 表覆盖：
 *   ✓ 主 sync: attempts / mastery / mistakes / sessions / trophies / meta /
 *     students / tutorSessions
 *   ✓ 专用 sync: trophyImages（v0.30.0 拆出）
 *   ✗ questions / skills / units（教材定义从代码 seed 来）
 *     —— 但题清理通过 meta:deletedQuestionIds 同步删除列表
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
  // v0.31.71: 闪电口算两张表也加进来，否则 Selena 的 fluency 进度永远不同步。
  "fluencyAttempts",
  "fluencyStats",
  // v0.30.0: trophyImages 拆出走独立 endpoint（D1 单参数大小限制）
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
  /** v0.31.71: 闪电口算 attempts，append-only union by id */
  fluencyAttempts?: unknown[];
  /** v0.31.71: 闪电口算累计 stats，按 id 合并取 newer */
  fluencyStats?: unknown[];
  /** v0.30.0: trophyImages 不再走主 sync——拆走 /api/sync/trophy-images 独立端点 */
  /**
   * v0.31.52: AI 生成的题（仅 ai_generated tagged 或 AI_ 前缀），跨设备同步。
   * Seed 题不进 — 它们从代码 bundle 来，每个设备都能离线拿到。
   * 合并策略：union by question_id，本地已有的 ID 不覆盖（题创建后不可变）。
   */
  aiQuestions?: unknown[];
}

async function dumpLocal(): Promise<SnapshotPayload> {
  const bag: Record<string, unknown[]> = {};
  for (const t of PUSH_TABLES) {
    bag[t] = await db.table(t).toArray();
  }
  // v0.31.65: aiQuestions 不再放主 snapshot — 走 /api/sync/ai-questions 独立端点
  // 旧 snapshot 还可能含有 payload.aiQuestions，pull 时会 merge 进 db.questions
  bag.aiQuestions = [];
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
    [db.attempts, db.mastery, db.mistakes, db.sessions, db.trophies, db.meta, db.students, db.tutorSessions, db.questions, db.fluencyAttempts, db.fluencyStats],
    async () => {
      for (const t of PUSH_TABLES) {
        const rows = (payload[t] ?? []) as Record<string, unknown>[];
        if (!Array.isArray(rows)) continue;
        const tbl = db.table(t);
        await tbl.clear();
        if (rows.length > 0) await tbl.bulkPut(rows);
      }
      // v0.31.52: aiQuestions 单独覆盖（仅 AI 生成的题，seed 留着）
      const remoteAi = (payload.aiQuestions ?? []) as Array<{ question_id?: string }>;
      if (Array.isArray(remoteAi) && remoteAi.length > 0) {
        // 先删本地所有 AI 题，再写云端的
        const localQs = (await db.questions.toArray()) as Array<{
          question_id?: string;
          tags?: string[];
        }>;
        const localAiIds = localQs
          .filter(
            (q) =>
              (q.tags ?? []).includes("ai_generated") ||
              (q.question_id ?? "").startsWith("AI_"),
          )
          .map((q) => q.question_id!)
          .filter(Boolean);
        if (localAiIds.length > 0) await db.questions.bulkDelete(localAiIds);
        await db.questions.bulkPut(remoteAi as never);
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
    [db.attempts, db.mastery, db.mistakes, db.sessions, db.trophies, db.meta, db.students, db.tutorSessions, db.questions, db.fluencyAttempts, db.fluencyStats],
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

      // v0.31.71: fluencyAttempts append-only union by id（闪电口算 attempts 不可变）
      const remoteFa = (payload.fluencyAttempts ?? []) as Array<{ id: string }>;
      if (Array.isArray(remoteFa) && remoteFa.length > 0) {
        const localFa = await db.fluencyAttempts.toArray();
        const localIds = new Set(localFa.map((r) => r.id));
        const toAdd = remoteFa.filter((r) => !localIds.has(r.id));
        if (toAdd.length > 0) await db.fluencyAttempts.bulkPut(toAdd as never);
      }

      // v0.31.71: fluencyStats union by id, prefer newer lastSession.at 或 masteredAt
      const remoteFs = (payload.fluencyStats ?? []) as Array<{
        id: string;
        masteredAt?: number | null;
        lastSession?: { at?: number } | null;
        totalAttempts?: number;
      }>;
      if (Array.isArray(remoteFs) && remoteFs.length > 0) {
        const localFs = await db.fluencyStats.toArray();
        const localById = new Map(localFs.map((r) => [r.id, r]));
        const toPut: typeof remoteFs = [];
        for (const r of remoteFs) {
          const local = localById.get(r.id);
          const remoteTs = r.lastSession?.at ?? r.masteredAt ?? 0;
          const localTs = local?.lastSession?.at ?? local?.masteredAt ?? 0;
          // 用 lastSession.at 比时间；若 ts 一样则比 totalAttempts（更多 attempts 视为更新）
          if (!local) {
            toPut.push(r);
          } else if (remoteTs > localTs) {
            toPut.push(r);
          } else if (remoteTs === localTs && (r.totalAttempts ?? 0) > (local.totalAttempts ?? 0)) {
            toPut.push(r);
          }
        }
        if (toPut.length > 0) await db.fluencyStats.bulkPut(toPut as never);
      }

      // v0.31.52: aiQuestions union by question_id — 题创建后视为不可变，本地已有的 ID 不覆盖
      const remoteQ = (payload.aiQuestions ?? []) as Array<{ question_id?: string }>;
      if (Array.isArray(remoteQ) && remoteQ.length > 0) {
        const localQs = await db.questions.toArray();
        const localIds = new Set(localQs.map((q) => q.question_id));
        const toAdd = remoteQ.filter((q) => q.question_id && !localIds.has(q.question_id));
        if (toAdd.length > 0) await db.questions.bulkPut(toAdd as never);
      }

      // v0.30.0: trophyImages 不在主 sync payload 里了——走 /api/sync/trophy-images 独立端点

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
  // v0.31.16: pullFromCloud 内部已经做 cleanupOrphanMistakes，这里 dump 出去
  // 的快照就不会再带着孤儿错题。
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
  let mainVersion: number | undefined;
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
    if (data.version) {
      setLastPushAt(data.version);
      mainVersion = data.version;
    }
  } catch (e) {
    return { ok: false, error: "network: " + (e as Error).message };
  }

  // v0.30.0: 单独 push trophyImages（每张按行，避免 D1 单参数超限）
  try {
    const r = await pushTrophyImages();
    if (!r.ok) {
      console.warn("[pushToCloud] trophyImages push failed:", r.error);
      // 不让 trophy-image 失败阻塞主 sync 成功；返回主版本号
    } else if (r.pushed > 0) {
      console.log(`[pushToCloud] pushed ${r.pushed} trophy image(s)`);
    }
  } catch (e) {
    console.warn("[pushToCloud] trophyImages push threw:", e);
  }

  // v0.31.65: 单独 push aiQuestions（每行一道题，避免主 sync payload > 2MB）
  try {
    const r = await pushAiQuestions();
    if (!r.ok) {
      console.warn("[pushToCloud] aiQuestions push failed:", r.error);
    } else if (r.pushed > 0) {
      console.log(`[pushToCloud] pushed ${r.pushed} AI question(s)`);
    }
  } catch (e) {
    console.warn("[pushToCloud] aiQuestions push threw:", e);
  }

  return { ok: true, version: mainVersion };
}

export async function pullFromCloud(opts: { force?: boolean } = {}): Promise<SyncResult> {
  const pwd = getStoredPassword();
  if (!pwd) return { ok: false, error: "no_password" };
  const since = opts.force ? 0 : getLastPullAt();
  let changed = false;
  let version: number | undefined;
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
    if (data.latest) {
      // v0.26.1：用 merge 而非覆盖。本地新写入永远不会被远程旧快照清掉
      await applyPayloadMerged(data.latest.payload);
      // v0.31.16: 合并是 union-by-id，云端旧快照里已删的孤儿错题会被合回来。
      // 立刻清一次（按 questions 表为 source of truth）。幂等，0 孤儿时无副作用。
      await cleanupOrphanMistakes().catch(() => {/* 不阻塞 sync */});
      setLastPullAt(data.latest.version);
      changed = true;
      version = data.latest.version;
    }
  } catch (e) {
    return { ok: false, error: "network: " + (e as Error).message };
  }

  // v0.30.0: 拉 trophyImages（增量；force=true 时强制全量重拉）
  if (opts.force) {
    try {
      localStorage.removeItem(TROPHY_LAST_PULL_KEY);
      localStorage.removeItem(AI_QS_LAST_PULL_KEY);
    } catch {
      /* */
    }
  }
  try {
    const r = await pullTrophyImages();
    if (r.ok && r.pulled > 0) {
      console.log(`[pullFromCloud] pulled ${r.pulled} trophy image(s)`);
      changed = true;
    } else if (!r.ok) {
      console.warn("[pullFromCloud] trophyImages pull failed:", r.error);
    }
  } catch (e) {
    console.warn("[pullFromCloud] trophyImages pull threw:", e);
  }

  // v0.31.65: 拉 ai_questions（独立端点，避免主 sync payload 过大）
  try {
    const r = await pullAiQuestions();
    if (r.ok && r.pulled > 0) {
      console.log(`[pullFromCloud] pulled ${r.pulled} AI question(s)`);
      changed = true;
    } else if (!r.ok) {
      console.warn("[pullFromCloud] aiQuestions pull failed:", r.error);
    }
  } catch (e) {
    console.warn("[pullFromCloud] aiQuestions pull threw:", e);
  }

  return { ok: true, changed, version };
}

/**
 * v0.31.71: 防抖式自动 push。
 *
 * 设计动机：之前只在 finalizeSession() 末尾 push 一次，意味着 Selena 在 session
 * 中途关 tab，本地写了的 attempts 就只在她设备里。爸爸在另一台设备 pull 拉不到。
 * 现在 submitAttempt() 每次都 schedulePushToCloud()，攒 8s 静默后 push，效果：
 *   - 连答 5 题（30s 内）→ 最后一题后 8s 触发 1 次 push
 *   - 答 1 题离开 → 8s 后自动 push
 *   - 中途 push 在飞 → 标 dirty，等当前完成再来一遍
 *
 * 还监听 pagehide / visibilitychange=hidden：tab 即将关闭时若有 pending push，
 * 立刻触发（虽然可能来不及 fetch 完，但比纯靠后台轮询好）。
 */
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushInFlight = false;
let pushDirtyAfterFlight = false;
let lastPushAttemptAt = 0;
const PUSH_DEBOUNCE_MS = 8000;

const pushListeners = new Set<(state: SyncState) => void>();

export interface SyncState {
  pushing: boolean;
  pulling: boolean;
  pendingPush: boolean;
  lastPushAt: number;
  lastPullAt: number;
  lastError: string | null;
}

let pullInFlight = false;
let lastSyncError: string | null = null;

export function getSyncState(): SyncState {
  return {
    pushing: pushInFlight,
    pulling: pullInFlight,
    pendingPush: pushTimer !== null,
    lastPushAt: getLastPushAt(),
    lastPullAt: getLastPullAt(),
    lastError: lastSyncError,
  };
}

function emitSyncState(): void {
  const s = getSyncState();
  for (const l of pushListeners) {
    try {
      l(s);
    } catch {
      /* */
    }
  }
}

export function subscribeSyncState(listener: (s: SyncState) => void): () => void {
  pushListeners.add(listener);
  listener(getSyncState());
  return () => pushListeners.delete(listener);
}

async function runPushNow(): Promise<void> {
  if (pushInFlight) {
    pushDirtyAfterFlight = true;
    return;
  }
  pushInFlight = true;
  emitSyncState();
  try {
    const r = await pushToCloud();
    if (!r.ok) {
      lastSyncError = r.error ?? "push_failed";
      // no_password / unauthorized 等就静默；网络错保留 lastError 给 UI 看
    } else {
      lastSyncError = null;
    }
  } catch (e) {
    lastSyncError = (e as Error).message;
  } finally {
    pushInFlight = false;
    lastPushAttemptAt = Date.now();
    emitSyncState();
    if (pushDirtyAfterFlight) {
      pushDirtyAfterFlight = false;
      schedulePushToCloud(PUSH_DEBOUNCE_MS);
    }
  }
}

/**
 * 防抖触发 push：8s 静默后 push 一次本地快照。
 * 多次调用只会 reset timer，最终只 push 一次。
 */
export function schedulePushToCloud(delayMs: number = PUSH_DEBOUNCE_MS): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void runPushNow();
    emitSyncState();
  }, delayMs);
  emitSyncState();
}

/**
 * 立即 flush pending push（不等防抖）。如果已在 push 中，等当前完成。
 * 用于 tab 即将关闭 / 用户手动点同步按钮。
 */
export function flushPushNow(): void {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  void runPushNow();
}

/**
 * 包装 pullFromCloud，带 in-flight 状态广播 + 1 分钟节流。
 * 用于 visibilitychange / focus 事件。
 */
let lastPullAttemptAt = 0;
export async function pullIfStale(opts: { minIntervalMs?: number } = {}): Promise<void> {
  const now = Date.now();
  const minInterval = opts.minIntervalMs ?? 60_000;
  if (pullInFlight) return;
  if (now - lastPullAttemptAt < minInterval) return;
  lastPullAttemptAt = now;
  pullInFlight = true;
  emitSyncState();
  try {
    const r = await pullFromCloud();
    lastSyncError = r.ok ? null : (r.error ?? null);
  } catch (e) {
    lastSyncError = (e as Error).message;
  } finally {
    pullInFlight = false;
    emitSyncState();
  }
}

// 让其他模块能查询是否有"未推送的脏写入"。useful for UI hint.
export function hasPendingPush(): boolean {
  return pushTimer !== null || pushInFlight || pushDirtyAfterFlight;
}

// 暴露给 cleanup hook（虽然 SPA 一般不卸载，但类型完整）
export function _resetPushStateForTest(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  pushInFlight = false;
  pushDirtyAfterFlight = false;
  lastPushAttemptAt = 0;
}
void lastPushAttemptAt; // 避免 lint unused

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

/**
 * v0.30.0: trophyImages 独立同步（每张 ~30 KB，按行存 D1）。
 *
 * 主 sync payload 走 /api/sync/upload，但 trophyImages 走这里，因为：
 *  - D1 单 bound 参数大小有限制，含 trophyImages 后 payload 2.77 MB → Worker 抛异常
 *  - 拆出来按行存（每行 30 KB）就稳了
 */
const TROPHY_IMAGES_BATCH = 20;
const TROPHY_LAST_PUSH_KEY = "selena.cloud.trophyImagesLastPush";
const TROPHY_LAST_PULL_KEY = "selena.cloud.trophyImagesLastPull";

interface TrophyImageRow {
  trophyId: string;
  subjectId?: string;
  imageDataUrl: string;
  prompt?: string;
  model?: string;
  generatedAt?: number;
  isLottery?: boolean;
  sourceUrl?: string;
}

async function pushTrophyImages(): Promise<{ ok: boolean; pushed: number; error?: string }> {
  const pwd = getStoredPassword();
  if (!pwd) return { ok: false, pushed: 0, error: "no_password" };

  const all = (await db.trophyImages.toArray()) as TrophyImageRow[];
  if (all.length === 0) return { ok: true, pushed: 0 };

  let pushed = 0;
  for (let i = 0; i < all.length; i += TROPHY_IMAGES_BATCH) {
    const batch = all.slice(i, i + TROPHY_IMAGES_BATCH);
    try {
      const r = await fetch("/api/sync/trophy-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pwd}`,
        },
        body: JSON.stringify({ rows: batch }),
      });
      if (!r.ok) {
        return { ok: false, pushed, error: `http_${r.status}` };
      }
      const j = (await r.json()) as { ok: boolean; accepted?: number; rejected?: unknown[] };
      if (!j.ok) return { ok: false, pushed, error: "server_error" };
      pushed += j.accepted ?? 0;
    } catch (e) {
      return { ok: false, pushed, error: "network: " + (e as Error).message };
    }
  }
  try {
    localStorage.setItem(TROPHY_LAST_PUSH_KEY, String(Date.now()));
  } catch {
    /* */
  }
  return { ok: true, pushed };
}

async function pullTrophyImages(): Promise<{ ok: boolean; pulled: number; error?: string }> {
  const pwd = getStoredPassword();
  if (!pwd) return { ok: false, pulled: 0, error: "no_password" };
  // 增量：拉自上次拉取后的更新。第一次为 0 全量拉。
  const since = Number(localStorage.getItem(TROPHY_LAST_PULL_KEY) ?? 0);
  try {
    const r = await fetch(`/api/sync/trophy-images?since=${since}`, {
      headers: { Authorization: `Bearer ${pwd}` },
    });
    if (!r.ok) return { ok: false, pulled: 0, error: `http_${r.status}` };
    const j = (await r.json()) as { ok: boolean; rows?: TrophyImageRow[]; version?: number };
    if (!j.ok || !Array.isArray(j.rows)) return { ok: false, pulled: 0, error: "bad_payload" };

    if (j.rows.length > 0) {
      // merge by trophyId, prefer newer generatedAt (相同 trophyId 本地新的不被覆盖)
      const localList = (await db.trophyImages.toArray()) as TrophyImageRow[];
      const localById = new Map(localList.map((r) => [r.trophyId, r]));
      const toPut: TrophyImageRow[] = [];
      for (const remote of j.rows) {
        const local = localById.get(remote.trophyId);
        if (!local || (remote.generatedAt ?? 0) > (local.generatedAt ?? 0)) {
          toPut.push(remote);
        }
      }
      if (toPut.length > 0) {
        await db.trophyImages.bulkPut(toPut as never);
      }
    }
    if (j.version) {
      try {
        localStorage.setItem(TROPHY_LAST_PULL_KEY, String(j.version));
      } catch {
        /* */
      }
    }
    return { ok: true, pulled: j.rows.length };
  } catch (e) {
    return { ok: false, pulled: 0, error: "network: " + (e as Error).message };
  }
}

// v0.31.65: 独立 aiQuestions 同步（避免主 sync payload 过 2MB → D1 拒收）
const AI_QS_BATCH = 30;
const AI_QS_LAST_PUSH_KEY = "selena.cloud.aiQuestionsLastPush";
const AI_QS_LAST_PULL_KEY = "selena.cloud.aiQuestionsLastPull";

interface AiQuestionRow {
  question_id: string;
  [k: string]: unknown;
}

async function pushAiQuestions(): Promise<{ ok: boolean; pushed: number; error?: string }> {
  const pwd = getStoredPassword();
  if (!pwd) return { ok: false, pushed: 0, error: "no_password" };
  const all = (await db.questions.toArray()) as Array<{ question_id?: string; tags?: string[] }>;
  const aiOnly = all.filter(
    (q) =>
      (q.tags ?? []).includes("ai_generated") || (q.question_id ?? "").startsWith("AI_"),
  ) as AiQuestionRow[];
  if (aiOnly.length === 0) return { ok: true, pushed: 0 };

  let pushed = 0;
  for (let i = 0; i < aiOnly.length; i += AI_QS_BATCH) {
    const batch = aiOnly.slice(i, i + AI_QS_BATCH);
    try {
      const r = await fetch("/api/sync/ai-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${pwd}` },
        body: JSON.stringify({ rows: batch }),
      });
      if (!r.ok) return { ok: false, pushed, error: `http_${r.status}` };
      const j = (await r.json()) as { ok: boolean; accepted?: number };
      if (!j.ok) return { ok: false, pushed, error: "server_error" };
      pushed += j.accepted ?? 0;
    } catch (e) {
      return { ok: false, pushed, error: "network: " + (e as Error).message };
    }
  }
  try { localStorage.setItem(AI_QS_LAST_PUSH_KEY, String(Date.now())); } catch {}
  return { ok: true, pushed };
}

async function pullAiQuestions(): Promise<{ ok: boolean; pulled: number; error?: string }> {
  const pwd = getStoredPassword();
  if (!pwd) return { ok: false, pulled: 0, error: "no_password" };
  const since = Number(localStorage.getItem(AI_QS_LAST_PULL_KEY) ?? 0);
  try {
    const r = await fetch(`/api/sync/ai-questions?since=${since}`, {
      headers: { Authorization: `Bearer ${pwd}` },
    });
    if (!r.ok) return { ok: false, pulled: 0, error: `http_${r.status}` };
    const j = (await r.json()) as { ok: boolean; rows?: AiQuestionRow[]; latestVersion?: number };
    if (!j.ok || !Array.isArray(j.rows)) return { ok: false, pulled: 0, error: "bad_payload" };
    if (j.rows.length > 0) {
      // union by question_id — 题不可变，本地已有 ID 不覆盖
      const localIds = new Set(
        ((await db.questions.toArray()) as Array<{ question_id?: string }>).map((q) => q.question_id),
      );
      const toAdd = j.rows.filter((r) => r.question_id && !localIds.has(r.question_id));
      if (toAdd.length > 0) await db.questions.bulkPut(toAdd as never);
    }
    if (j.latestVersion) {
      try { localStorage.setItem(AI_QS_LAST_PULL_KEY, String(j.latestVersion)); } catch {}
    }
    return { ok: true, pulled: j.rows.length };
  } catch (e) {
    return { ok: false, pulled: 0, error: "network: " + (e as Error).message };
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
