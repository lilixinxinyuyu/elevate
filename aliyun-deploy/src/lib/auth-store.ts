/**
 * Auth store — dynamic password map persisted in OSS.
 *
 * v0.34.17 (Ep147) 爸爸要的密码重置 + 新同学 onboarding without redeploy。
 *
 * 历史问题：APP_USERS 烤进 worker bundle，runtime 改不了 → 加同学/重置密码
 * 都得 rebuild + redeploy 一次。这套 cycle 太重，super-admin UI 没法用。
 *
 * 方案：把可变 auth 移到 OSS `_auth/users.json`，baked env 当 cold-start 种子。
 *
 * 文件 shape:
 *   {
 *     schemaVersion: 1,
 *     passwords: { "<bcrypt-or-plain-pwd>": "<userId>" },
 *     updatedAt: <ms>,
 *     migratedFromBakedAt: <ms>
 *   }
 *
 * 简化：密码先存明文（OSS bucket 私有，不暴露），后续考虑 hash + salt。
 *
 * 读策略：每次 OSS GET（~50ms），后续可加内存 cache 30s TTL。
 * 写策略：先读 → merge → 写回（race condition 小概率，super-admin 操作低频）。
 *
 * Merge 规则：OSS 优先，没 OSS 才回 baked。OSS 一旦写过，baked 就被冷冻
 * （reset 时如果想清掉 baked 默认 selena 也能做）。
 */

import type { Env } from "./env";
import { getOssConfig, ossGet, ossPut, type OssConfig } from "./oss";
import { isReservedUserId } from "./auth";

const AUTH_KEY = "_auth/users.json";

interface AuthStore {
  schemaVersion: 1;
  passwords: Record<string, string>; // password → userId
  updatedAt?: number;
  migratedFromBakedAt?: number;
}

function emptyStore(): AuthStore {
  return { schemaVersion: 1, passwords: {} };
}

/** Read baked env APP_USERS + APP_PASSWORD → password→userId map */
function readBaked(env: Env): Record<string, string> {
  const out: Record<string, string> = {};
  if (env.APP_USERS) {
    try {
      const m = JSON.parse(env.APP_USERS) as Record<string, string>;
      for (const [k, v] of Object.entries(m)) {
        if (typeof k === "string" && typeof v === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(v)) {
          out[k] = v;
        }
      }
    } catch {
      /* */
    }
  }
  if (env.APP_PASSWORD) {
    out[env.APP_PASSWORD] = "selena"; // legacy default
  }
  return out;
}

/** Read OSS store; returns null on 404 / parse fail */
async function readOssStore(cfg: OssConfig): Promise<AuthStore | null> {
  const got = await ossGet(cfg, AUTH_KEY);
  if (!got.ok || !got.text) return null;
  try {
    const parsed = JSON.parse(got.text) as AuthStore;
    if (!parsed || typeof parsed !== "object" || !parsed.passwords) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Combined view used by auth resolve.
 *
 * 关键：OSS store 一旦存在就 **完全 shadow** baked env，不 merge。
 * 否则 reset 后老密码还能登（baked 还在）。
 * 第一次写 OSS（reset 或 add）会把 baked 全量种进去，所以不丢字段。
 */
export async function readEffectivePasswords(
  env: Env,
): Promise<Record<string, string>> {
  const cfg = getOssConfig(env);
  if (!cfg) return readBaked(env);
  const oss = await readOssStore(cfg);
  if (!oss) return readBaked(env);
  // OSS exists → ONLY OSS (它的 passwords 在第一次写时已经吃过 baked)
  return { ...oss.passwords };
}

/** Full set of known userIds (from effective passwords). */
export async function listKnownUserIds(env: Env): Promise<string[]> {
  const map = await readEffectivePasswords(env);
  return [...new Set(Object.values(map))].sort();
}

/**
 * Generate a new password for a given userId.
 * - Reads OSS store (or seeds from baked if absent)
 * - Removes any existing passwords mapped to that userId
 * - Adds new password → userId
 * - Writes back OSS
 * Returns the new plaintext password to caller (so super-admin can hand it off).
 */
const SAFE_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genPassword(len = 20): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += SAFE_CHARS[bytes[i]! % SAFE_CHARS.length];
  return out;
}

export async function resetPasswordForUser(
  env: Env,
  userId: string,
): Promise<
  | { ok: true; newPassword: string; rotated: number }
  | { ok: false; error: string }
> {
  const cfg = getOssConfig(env);
  if (!cfg) return { ok: false, error: "oss_not_configured" };
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
    return { ok: false, error: "invalid_userId" };
  }
  const known = await listKnownUserIds(env);
  if (!known.includes(userId)) {
    return { ok: false, error: "unknown_userId" };
  }

  // Load existing store (or seed from baked)
  let store = await readOssStore(cfg);
  if (!store) {
    store = emptyStore();
    store.passwords = { ...readBaked(env) };
    store.migratedFromBakedAt = Date.now();
  }

  // Remove old passwords for this userId
  let rotated = 0;
  for (const [pwd, uid] of Object.entries(store.passwords)) {
    if (uid === userId) {
      delete store.passwords[pwd];
      rotated++;
    }
  }

  const newPwd = genPassword(20);
  store.passwords[newPwd] = userId;
  store.updatedAt = Date.now();

  const put = await ossPut(cfg, AUTH_KEY, JSON.stringify(store, null, 2), {
    contentType: "application/json; charset=utf-8",
  });
  if (!put.ok) {
    return { ok: false, error: put.error ?? "oss_put_failed" };
  }
  return { ok: true, newPassword: newPwd, rotated };
}

/** Future Ep12: add new student (writes both _auth + profile). */
export async function addNewStudent(
  env: Env,
  userId: string,
): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const cfg = getOssConfig(env);
  if (!cfg) return { ok: false, error: "oss_not_configured" };
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
    return { ok: false, error: "invalid_userId" };
  }
  // 大 reserved 列表（系统/marketing/auth/AI/品牌词/1-2 字母 等 80+ 项）
  if (isReservedUserId(userId)) {
    return { ok: false, error: "reserved_userId" };
  }
  // Selena 是 legacy 默认家，不能再分配新同学
  if (userId.toLowerCase() === "selena") {
    return { ok: false, error: "userId_reserved_for_legacy" };
  }
  const known = await listKnownUserIds(env);
  if (known.includes(userId)) {
    return { ok: false, error: "userId_exists" };
  }

  let store = await readOssStore(cfg);
  if (!store) {
    store = emptyStore();
    store.passwords = { ...readBaked(env) };
    store.migratedFromBakedAt = Date.now();
  }
  const newPwd = genPassword(20);
  store.passwords[newPwd] = userId;
  store.updatedAt = Date.now();
  const put = await ossPut(cfg, AUTH_KEY, JSON.stringify(store, null, 2), {
    contentType: "application/json; charset=utf-8",
  });
  if (!put.ok) return { ok: false, error: put.error ?? "oss_put_failed" };
  return { ok: true, password: newPwd };
}
