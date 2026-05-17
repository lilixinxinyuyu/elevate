/**
 * 阿里云 OSS REST 客户端（V8 isolates 兼容，无外部依赖）
 *
 * 移植自 functions/_oss.ts（一字不改的逻辑，只把 Env import 换到本目录的 env.ts）。
 *
 * Signature V1：
 *   StringToSign = HTTP-Verb + "\n" + Content-MD5 + "\n" + Content-Type + "\n"
 *                + Date + "\n" + CanonicalizedOSSHeaders + CanonicalizedResource
 *   Signature = Base64(HMAC-SHA1(SecretKey, StringToSign))
 *
 * 不使用 Content-MD5（Web Crypto 没 MD5；V1 sig 允许空）
 * 不使用 CanonicalizedOSSHeaders（我们不发 x-oss-* header）
 */

import type { Env } from "./env";

export interface OssConfig {
  region: string;
  bucket: string;
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
  return `${cfg.bucket}.${cfg.region}.aliyuncs.com`;
}

function ossUrl(cfg: OssConfig, key: string, query?: string): string {
  const encodedKey = key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `https://${ossHost(cfg)}/${encodedKey}${query ? "?" + query : ""}`;
}

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
  let bin = "";
  const bytes = new Uint8Array(sigBuf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

async function signOss(
  cfg: OssConfig,
  method: string,
  key: string,
  contentType: string,
  date: string,
  subresource?: string,
): Promise<string> {
  const canonicalizedResource = `/${cfg.bucket}/${key}${subresource ? "?" + subresource : ""}`;
  const stringToSign = [method, "", contentType, date, canonicalizedResource].join("\n");
  const sig = await hmacSha1Base64(cfg.accessKeySecret, stringToSign);
  return `OSS ${cfg.accessKeyId}:${sig}`;
}

export interface OssPutOptions {
  contentType?: string;
  cacheControl?: string;
}

export interface OssPutResult {
  ok: boolean;
  status: number;
  etag?: string;
  versionId?: string;
  error?: string;
}

export async function ossPut(
  cfg: OssConfig,
  key: string,
  body: string | Uint8Array | ArrayBuffer,
  opts: OssPutOptions = {},
): Promise<OssPutResult> {
  const contentType = opts.contentType ?? "application/json; charset=utf-8";
  const date = new Date().toUTCString();
  const auth = await signOss(cfg, "PUT", key, contentType, date);
  const headers: Record<string, string> = {
    Host: ossHost(cfg),
    Date: date,
    "Content-Type": contentType,
    Authorization: auth,
  };
  if (opts.cacheControl) headers["Cache-Control"] = opts.cacheControl;
  try {
    const resp = await fetch(ossUrl(cfg, key), {
      method: "PUT",
      headers,
      body: body as BodyInit,
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
  body?: ArrayBuffer;
  etag?: string;
  versionId?: string;
  lastModifiedMs?: number;
  contentType?: string;
  /** Content-Length from headers (HEAD/GET); useful for super-admin stats */
  contentLength?: number;
  error?: string;
}

export async function ossGet(cfg: OssConfig, key: string): Promise<OssGetResult> {
  const date = new Date().toUTCString();
  const auth = await signOss(cfg, "GET", key, "", date);
  try {
    const resp = await fetch(ossUrl(cfg, key), {
      method: "GET",
      headers: { Host: ossHost(cfg), Date: date, Authorization: auth },
    });
    if (resp.status === 404) return { ok: false, status: 404, error: "not_found" };
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
      contentType: resp.headers.get("Content-Type") ?? undefined,
    };
  } catch (e) {
    return { ok: false, status: 0, error: "fetch_failed: " + (e as Error).message };
  }
}

/** GET 二进制（如图片）；返回 ArrayBuffer */
export async function ossGetBinary(cfg: OssConfig, key: string): Promise<OssGetResult> {
  const date = new Date().toUTCString();
  const auth = await signOss(cfg, "GET", key, "", date);
  try {
    const resp = await fetch(ossUrl(cfg, key), {
      method: "GET",
      headers: { Host: ossHost(cfg), Date: date, Authorization: auth },
    });
    if (resp.status === 404) return { ok: false, status: 404, error: "not_found" };
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: `oss_${resp.status}` };
    }
    const body = await resp.arrayBuffer();
    const lm = resp.headers.get("Last-Modified");
    return {
      ok: true,
      status: resp.status,
      body,
      etag: resp.headers.get("ETag") ?? undefined,
      versionId: resp.headers.get("x-oss-version-id") ?? undefined,
      lastModifiedMs: lm ? Date.parse(lm) : undefined,
      contentType: resp.headers.get("Content-Type") ?? undefined,
    };
  } catch (e) {
    return { ok: false, status: 0, error: "fetch_failed: " + (e as Error).message };
  }
}

export async function ossHead(cfg: OssConfig, key: string): Promise<OssGetResult> {
  const date = new Date().toUTCString();
  const auth = await signOss(cfg, "HEAD", key, "", date);
  try {
    const resp = await fetch(ossUrl(cfg, key), {
      method: "HEAD",
      headers: { Host: ossHost(cfg), Date: date, Authorization: auth },
    });
    if (resp.status === 404) return { ok: false, status: 404, error: "not_found" };
    if (!resp.ok) return { ok: false, status: resp.status, error: `oss_${resp.status}` };
    const lm = resp.headers.get("Last-Modified");
    const cl = resp.headers.get("Content-Length");
    return {
      ok: true,
      status: resp.status,
      etag: resp.headers.get("ETag") ?? undefined,
      versionId: resp.headers.get("x-oss-version-id") ?? undefined,
      lastModifiedMs: lm ? Date.parse(lm) : undefined,
      contentType: resp.headers.get("Content-Type") ?? undefined,
      contentLength: cl ? Number(cl) : undefined,
    };
  } catch (e) {
    return { ok: false, status: 0, error: "fetch_failed: " + (e as Error).message };
  }
}

/** 删除单个对象（用于 cleanup / replace 流程） */
export async function ossDelete(cfg: OssConfig, key: string): Promise<OssPutResult> {
  const date = new Date().toUTCString();
  const auth = await signOss(cfg, "DELETE", key, "", date);
  try {
    const resp = await fetch(ossUrl(cfg, key), {
      method: "DELETE",
      headers: { Host: ossHost(cfg), Date: date, Authorization: auth },
    });
    if (!resp.ok && resp.status !== 204) {
      const text = await resp.text().catch(() => "");
      return {
        ok: false,
        status: resp.status,
        error: `oss_${resp.status}: ${text.slice(0, 200)}`,
      };
    }
    return { ok: true, status: resp.status };
  } catch (e) {
    return { ok: false, status: 0, error: "fetch_failed: " + (e as Error).message };
  }
}

/**
 * 服务端 copy：PUT destKey with header `x-oss-copy-source: /bucket/sourceKey`.
 * 不下载 source 到 EdgeRoutine —— OSS 内部直接复制，零数据出口。
 * V1 sig 必须把 `x-oss-copy-source` 放进 CanonicalizedOSSHeaders。
 */
export async function ossCopy(
  cfg: OssConfig,
  sourceKey: string,
  destKey: string,
): Promise<OssPutResult> {
  const encodedSource = "/" + cfg.bucket + "/" + sourceKey
    .split("/").map((seg) => encodeURIComponent(seg)).join("/");
  const date = new Date().toUTCString();
  const contentType = ""; // copy 不需要 content-type
  // V1 sig + canonicalizedOssHeaders
  const ossHeaderLine = `x-oss-copy-source:${encodedSource}`;
  const canonicalizedResource = `/${cfg.bucket}/${destKey}`;
  const stringToSign = [
    "PUT", "", contentType, date,
    ossHeaderLine,
    canonicalizedResource,
  ].join("\n");
  const sig = await hmacSha1Base64(cfg.accessKeySecret, stringToSign);
  const auth = `OSS ${cfg.accessKeyId}:${sig}`;
  try {
    const resp = await fetch(ossUrl(cfg, destKey), {
      method: "PUT",
      headers: {
        Host: ossHost(cfg),
        Date: date,
        "x-oss-copy-source": encodedSource,
        Authorization: auth,
      },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return {
        ok: false,
        status: resp.status,
        error: `oss_copy_${resp.status}: ${text.slice(0, 200)}`,
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

/** snapshot key 规则：users/{userId}/snapshot.json */
export function snapshotKey(userId: string): string {
  return `users/${userId}/snapshot.json`;
}

/** AI 题快照 key */
export function aiQuestionsKey(userId: string): string {
  return `users/${userId}/ai-questions.json`;
}

/** trophy 图 key */
export function trophyImageKey(trophyId: string, variant: "locked" | "unlocked"): string {
  return `shared/trophies/${trophyId}-${variant}.png`;
}
