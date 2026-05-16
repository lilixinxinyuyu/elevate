/**
 * 通用 ESA API caller。HMAC-SHA1 签名（V1）。
 *
 * 用法：
 *   import { esaCall } from "./_esa-api.mjs";
 *   const r = await esaCall("GET", "GetSite", { SiteId: 156848617750740 });
 */

import crypto from "node:crypto";
import { readFileSync } from "node:fs";

export function loadEnv() {
  const path = process.env.DEV_VARS ?? "/Users/yong/Desktop/xy/.dev.vars";
  return Object.fromEntries(
    readFileSync(path, "utf-8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

const enc = (s) =>
  encodeURIComponent(String(s))
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");

/**
 * @param {"GET"|"POST"|"PUT"|"DELETE"} method
 * @param {string} action
 * @param {Record<string, string|number|boolean>} extra
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function esaCall(method, action, extra = {}) {
  const env = loadEnv();
  const AK = env.ALIYUN_OSS_ACCESS_KEY_ID;
  const SK = env.ALIYUN_OSS_ACCESS_KEY_SECRET;
  if (!AK || !SK) throw new Error("Missing AK/SK in .dev.vars");

  const params = {
    Action: action,
    Version: "2024-09-10",
    Format: "JSON",
    AccessKeyId: AK,
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    SignatureNonce: crypto.randomUUID(),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    ...extra,
  };
  const canonical = Object.keys(params)
    .sort()
    .map((k) => enc(k) + "=" + enc(params[k]))
    .join("&");
  const stringToSign = method + "&%2F&" + enc(canonical);
  const signature = crypto.createHmac("sha1", SK + "&").update(stringToSign).digest("base64");
  const url = `https://esa.ap-southeast-1.aliyuncs.com/?${canonical}&Signature=${enc(signature)}`;

  const res = await fetch(url, { method });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

export function siteId() {
  const env = loadEnv();
  if (!env.ALIYUN_ESA_SITE_ID) throw new Error("Missing ALIYUN_ESA_SITE_ID in .dev.vars");
  return env.ALIYUN_ESA_SITE_ID;
}
