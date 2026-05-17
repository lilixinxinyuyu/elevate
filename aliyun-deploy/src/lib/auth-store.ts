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

/**
 * v0.34.69 (iter 3): friendly password — 8 位数字, 给小学生 / 监护人 / 演示用.
 * 老师演示加同学时不要一串 20 位 randomstring 让对方记不住; 8 位数字像 PIN
 * 容易写在便签上 + 容易输入 (手机数字键盘). 同学拿到后可以在 Settings 改成
 * 自己想要的字符串密码 (changePasswordForUser 自己挑长度).
 *
 * 8 位 = 10^8 ≈ 1 亿组合, 配合 ESA EdgeRoutine 自带的速率限制 (短时间内
 * 100+ 错密码访问会被拦), 暴力破解不现实. 不接受 4-6 位以防 brute force.
 */
function genFriendlyPassword(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 8; i++) out += String(bytes[i]! % 10);
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

  // v0.34.69: 默认 friendly (8 位数字). super-admin 可以传 secure=true 拿老 20 位.
  const newPwd = genFriendlyPassword();
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
  // v0.34.69: 新同学默认拿 friendly 8 位数字密码 (老师演示 / 监护人记得住)
  const newPwd = genFriendlyPassword();
  store.passwords[newPwd] = userId;
  store.updatedAt = Date.now();
  const put = await ossPut(cfg, AUTH_KEY, JSON.stringify(store, null, 2), {
    contentType: "application/json; charset=utf-8",
  });
  if (!put.ok) return { ok: false, error: put.error ?? "oss_put_failed" };
  return { ok: true, password: newPwd };
}

/**
 * 同学自己改密码 (or super-admin 替同学指定特定密码).
 * 校验:
 *   - newPassword 至少 6 字符, 最多 64 字符 (genFriendlyPassword 8 位 + 用户自定义)
 *   - 不能跟 baked APP_PASSWORD 冲突 (baked 是 Selena fallback, 给 selena 留)
 *   - 不能跟其他 userId 的密码冲突 (避免一密码两身份)
 *   - 同 userId 老密码全清, 替换为新密码
 */
export async function changePasswordForUser(
  env: Env,
  userId: string,
  newPassword: string,
): Promise<{ ok: true; rotated: number } | { ok: false; error: string }> {
  const cfg = getOssConfig(env);
  if (!cfg) return { ok: false, error: "oss_not_configured" };
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
    return { ok: false, error: "invalid_userId" };
  }
  const pwd = (newPassword ?? "").trim();
  if (pwd.length < 6 || pwd.length > 64) {
    return { ok: false, error: "password_length_6_to_64" };
  }
  if (!/^[\x21-\x7e]+$/.test(pwd)) {
    return { ok: false, error: "password_must_be_ascii_printable" };
  }
  // 不能跟 baked Selena 兜底密码冲突
  if (env.APP_PASSWORD && pwd === env.APP_PASSWORD) {
    return { ok: false, error: "password_conflict_with_legacy_fallback" };
  }
  let store = await readOssStore(cfg);
  if (!store) {
    store = emptyStore();
    store.passwords = { ...readBaked(env) };
    store.migratedFromBakedAt = Date.now();
  }
  // 跟别的同学密码冲突 → 拒
  const existingOwner = store.passwords[pwd];
  if (existingOwner && existingOwner !== userId) {
    return { ok: false, error: "password_taken_by_other_user" };
  }
  // 清掉这个 userId 的所有老密码 → 添加新的
  let rotated = 0;
  for (const [oldPwd, uid] of Object.entries(store.passwords)) {
    if (uid === userId && oldPwd !== pwd) {
      delete store.passwords[oldPwd];
      rotated++;
    }
  }
  store.passwords[pwd] = userId;
  store.updatedAt = Date.now();
  const put = await ossPut(cfg, AUTH_KEY, JSON.stringify(store, null, 2), {
    contentType: "application/json; charset=utf-8",
  });
  if (!put.ok) return { ok: false, error: put.error ?? "oss_put_failed" };
  return { ok: true, rotated };
}
