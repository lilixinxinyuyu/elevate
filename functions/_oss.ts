/**
 * v0.33.59 (Ep132): 阿里云 OSS REST 客户端（V8 isolates 兼容，无外部依赖）
 *
 * 用 Signature V1（兼容性好，逻辑简单）：
 *   StringToSign = HTTP-Verb + "\n" + Content-MD5 + "\n" + Content-Type + "\n"
 *                + Date + "\n" + CanonicalizedOSSHeaders + CanonicalizedResource
 *   Signature = Base64(HMAC-SHA1(SecretKey, StringToSign))
 *
 * 不使用 Content-MD5（Web Crypto API 没 MD5；V1 sig 允许空）
 * 不使用 CanonicalizedOSSHeaders（我们不发 x-oss-* header）
 *
 * Bucket 在 endpoint subdomain：xiaojinapp.oss-cn-hongkong.aliyuncs.com
 */

import type { Env } from "./_shared";

export interface OssConfig {
  region: string;       // e.g. "oss-cn-hongkong"
  bucket: string;       // e.g. "xiaojinapp"
  accessKeyId: string;
  accessKeySecret: string;
}

export function getOssConfig(env: Env): OssConfig | null {
  if (
    !env.ALIYUN_OSS_REGION ||
    !env.ALIYUN_OSS_BUCKET ||
    !env.ALIYUN_OSS_ACCESS_KEY_ID ||
    !env.ALIYUN_OSS_ACCESS_KEY_SECRET
  ) {
    return null;
  }
  return {
    region: env.ALIYUN_OSS_REGION,
    bucket: env.ALIYUN_OSS_BUCKET,
    accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID,
    accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET,
  };
}

function ossHost(cfg: OssConfig): string {
  // public endpoint：bucket.region.aliyuncs.com
  return `${cfg.bucket}.${cfg.region}.aliyuncs.com`;
}

function ossUrl(cfg: OssConfig, key: string): string {
  // key 路径里 / 不要编码，其他特殊字符按需
  const encodedKey = key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `https://${ossHost(cfg)}/${encodedKey}`;
}

/**
 * HMAC-SHA1 → Base64. Web Crypto API 实现，V8 isolates 兼容。
 */
async function hmacSha1Base64(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  // bytes → base64
  let bin = "";
  const bytes = new Uint8Array(sigBuf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

/**
 * 构造 Authorization 头：`OSS <AccessKeyId>:<Signature>`
 */
async function signOss(
  cfg: OssConfig,
  method: string,
  key: string,
  contentType: string,
  date: string,
): Promise<string> {
  const canonicalizedResource = `/${cfg.bucket}/${key}`;
  const stringToSign = [
    method,
    "",            // Content-MD5 (空)
    contentType,
    date,
    canonicalizedResource,
  ].join("\n");
  const sig = await hmacSha1Base64(cfg.accessKeySecret, stringToSign);
  return `OSS ${cfg.accessKeyId}:${sig}`;
}

export interface OssPutOptions {
  contentType?: string;
}

export interface OssPutResult {
  ok: boolean;
  status: number;
  etag?: string;
  versionId?: string;
  error?: string;
}

/**
 * 上传对象到 OSS。body 是 string 或 Uint8Array。
 */
export async function ossPut(
  cfg: OssConfig,
  key: string,
  body: string | Uint8Array,
  opts: OssPutOptions = {},
): Promise<OssPutResult> {
  const contentType = opts.contentType ?? "application/json; charset=utf-8";
  const date = new Date().toUTCString();
  const auth = await signOss(cfg, "PUT", key, contentType, date);
  try {
    const resp = await fetch(ossUrl(cfg, key), {
      method: "PUT",
      headers: {
        Host: ossHost(cfg),
        Date: date,
        "Content-Type": contentType,
        Authorization: auth,
      },
      body,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return {
        ok: false,
        status: resp.status,
        error: `oss_${resp.status}: ${text.slice(0, 200)}`,
      };
    }
    return {
      ok: true,
      status: resp.status,
      etag: resp.headers.get("ETag") ?? undefined,
      versionId: resp.headers.get("x-oss-version-id") ?? undefined,
    };
  } catch (e) {
    return { ok: false, status: 0, error: "fetch_failed: " + (e as Error).message };
  }
}

export interface OssGetResult {
  ok: boolean;
  status: number;
  text?: string;
  etag?: string;
  versionId?: string;
  lastModifiedMs?: number;
  error?: string;
}

/**
 * GET 对象。404 也算 ok=false 但有 status=404 让上层知道是 not-found.
 */
export async function ossGet(cfg: OssConfig, key: string): Promise<OssGetResult> {
  // GET 也需要签名（私有 bucket）
  const date = new Date().toUTCString();
  const auth = await signOss(cfg, "GET", key, "", date);
  try {
    const resp = await fetch(ossUrl(cfg, key), {
      method: "GET",
      headers: {
        Host: ossHost(cfg),
        Date: date,
        Authorization: auth,
      },
    });
    if (resp.status === 404) {
      return { ok: false, status: 404, error: "not_found" };
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return {
        ok: false,
        status: resp.status,
        error: `oss_${resp.status}: ${text.slice(0, 200)}`,
      };
    }
    const text = await resp.text();
    const lm = resp.headers.get("Last-Modified");
    return {
      ok: true,
      status: resp.status,
      text,
      etag: resp.headers.get("ETag") ?? undefined,
      versionId: resp.headers.get("x-oss-version-id") ?? undefined,
      lastModifiedMs: lm ? Date.parse(lm) : undefined,
    };
  } catch (e) {
    return { ok: false, status: 0, error: "fetch_failed: " + (e as Error).message };
  }
}

/**
 * HEAD 对象 — 只查存在性 + 元数据。Snapshot 拉取前快查 lastModified。
 */
export async function ossHead(cfg: OssConfig, key: string): Promise<OssGetResult> {
  const date = new Date().toUTCString();
  const auth = await signOss(cfg, "HEAD", key, "", date);
  try {
    const resp = await fetch(ossUrl(cfg, key), {
      method: "HEAD",
      headers: {
        Host: ossHost(cfg),
        Date: date,
        Authorization: auth,
      },
    });
    if (resp.status === 404) {
      return { ok: false, status: 404, error: "not_found" };
    }
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: `oss_${resp.status}` };
    }
    const lm = resp.headers.get("Last-Modified");
    return {
      ok: true,
      status: resp.status,
      etag: resp.headers.get("ETag") ?? undefined,
      versionId: resp.headers.get("x-oss-version-id") ?? undefined,
      lastModifiedMs: lm ? Date.parse(lm) : undefined,
    };
  } catch (e) {
    return { ok: false, status: 0, error: "fetch_failed: " + (e as Error).message };
  }
}

/**
 * 推 userId → snapshot OSS key 的统一规则。
 *   userId="selena" → "users/selena/snapshot.json"
 *
 * 未来扩 trophyImages / aiQuestions 也走 "users/{userId}/<resource>/..." 路径。
 */
export function snapshotKey(userId: string): string {
  return `users/${userId}/snapshot.json`;
}
