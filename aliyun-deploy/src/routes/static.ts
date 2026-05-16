/**
 * 静态资源代理：把 non-api 请求**签名后**代理到私有 OSS bucket `xiaojinapp/web/`。
 *
 * 路径映射：
 *   GET /              → OSS web/index.html (SPA root)
 *   GET /assets/abc.js → OSS web/assets/abc.js
 *   GET /env/town/...  → OSS web/env/town/...
 *   GET /any/spa/route → OSS web/index.html (SPA fallback for 404 of routes)
 *
 * Bucket 保持私有（防被直链 hotlink + 控制访问）。每次 routine 签名访问。
 * ESA 边缘 cache 按 Cache-Control 头自动缓存（命中率高），routine 不会被频繁调起。
 *
 * 缓存策略：
 *   - .html / manifest → no-cache（拉新版）
 *   - /assets/* (vite hashed) → 1y immutable
 *   - 其他静态 → 1d
 */

import { Hono } from "hono";
import type { Env } from "../lib/env";
import { getOssConfig, ossGetBinary } from "../lib/oss";

const staticProxy = new Hono<{ Bindings: Env }>();

const WEB_PREFIX = "web";

function cacheControlFor(path: string): string {
  if (path === "/" || path.endsWith(".html") || path.endsWith("/manifest.json")) {
    return "public, max-age=0, must-revalidate";
  }
  if (path.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  return "public, max-age=86400";
}

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    html: "text/html; charset=utf-8",
    js: "application/javascript; charset=utf-8",
    mjs: "application/javascript; charset=utf-8",
    css: "text/css; charset=utf-8",
    json: "application/json; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    wasm: "application/wasm",
    glb: "model/gltf-binary",
    gltf: "model/gltf+json",
    vrm: "application/octet-stream",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    mp4: "video/mp4",
    webm: "video/webm",
    txt: "text/plain; charset=utf-8",
    xml: "application/xml; charset=utf-8",
    map: "application/json; charset=utf-8",
  };
  return map[ext] ?? "application/octet-stream";
}

function looksLikeFile(path: string): boolean {
  const last = path.split("/").pop() ?? "";
  return /\.[a-z0-9]+$/i.test(last);
}

staticProxy.get("*", async (c) => {
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.text("oss_not_configured", 503);

  const url = new URL(c.req.url);
  let path = url.pathname;
  if (path === "/") path = "/index.html";

  const ossKey = WEB_PREFIX + path; // 注意没有 leading slash
  const got = await ossGetBinary(cfg, ossKey);

  if (!got.ok && got.status === 404 && !looksLikeFile(path)) {
    // SPA 路由 fallback → index.html
    const fb = await ossGetBinary(cfg, WEB_PREFIX + "/index.html");
    if (!fb.ok || !fb.body) return c.text("index.html missing", 502);
    return new Response(fb.body, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
        "X-SPA-Fallback": "true",
      },
    });
  }

  if (!got.ok || !got.body) {
    return c.text(`origin_${got.status}`, got.status === 404 ? 404 : 502);
  }

  return new Response(got.body, {
    status: 200,
    headers: {
      "Content-Type": got.contentType ?? contentTypeFor(path),
      "Cache-Control": cacheControlFor(path),
      ...(got.etag ? { ETag: got.etag } : {}),
    },
  });
});

export default staticProxy;
