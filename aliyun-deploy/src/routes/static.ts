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
import { listKnownUserIds } from "../lib/auth-store";

const staticProxy = new Hono<{ Bindings: Env }>();

const WEB_PREFIX = "web";

/**
 * Ep 爸爸-2026-05-17：subdomain gate
 *
 * 之前所有子域 (alice.xiaojin.app / foo.xiaojin.app / bar.*) 都返回 Selena
 * 的 SPA。爸爸要求: 未启用 subdomain 显示提示页, 不要把所有 subdomain 都
 * 指向 selena 的系统.
 *
 * 允许的 host:
 *   - apex xiaojin.app
 *   - admin.xiaojin.app (super-admin console)
 *   - {userId}.xiaojin.app (任何在 _auth/users.json 里有的同学)
 *   - localhost / 127.0.0.1 (dev)
 *
 * 未匹配 → 返简单 "未启用" 静态 HTML, 不走 SPA, 不暴露任何代码.
 */
const RESERVED_SUBDOMAINS = new Set(["admin", "www"]);

// Module-level cache for known userIds (60s TTL) — avoid OSS GET on every nav.
// 加同学时延 ≤60s 才会看到新 subdomain 启用。
interface KnownIdsCache { ids: Set<string>; expires: number }
let knownIdsCache: KnownIdsCache | null = null;
const KNOWN_IDS_TTL_MS = 60_000;
async function getKnownIdsCached(env: Env): Promise<Set<string>> {
  const now = Date.now();
  if (knownIdsCache && knownIdsCache.expires > now) return knownIdsCache.ids;
  try {
    const ids = new Set(await listKnownUserIds(env));
    knownIdsCache = { ids, expires: now + KNOWN_IDS_TTL_MS };
    return ids;
  } catch {
    return knownIdsCache?.ids ?? new Set();
  }
}

function parseSubdomain(host: string): string | null {
  const h = host.toLowerCase().split(":")[0]!;
  if (h === "localhost" || h === "127.0.0.1") return "localhost";
  if (h === "xiaojin.app") return ""; // apex
  const m = h.match(/^([a-z0-9_-]+)\.xiaojin\.app$/);
  return m ? m[1]! : null;
}

const NOT_ENABLED_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>子域未启用 · xiaojin.app</title>
<style>
  body { margin: 0; padding: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(180deg, #0a0a0a 0%, #1a0a2e 100%); color: #fff;
    font-family: -apple-system, "PingFang SC", system-ui, sans-serif; }
  .box { max-width: 480px; padding: 32px 24px; text-align: center; }
  h1 { font-size: 28px; margin: 0 0 12px; font-weight: 500; }
  .sub { color: #a0c3ec; font-size: 14px; margin-bottom: 24px; }
  .host { font-family: ui-monospace, monospace; background: rgba(255,255,255,0.08);
    padding: 8px 12px; border-radius: 6px; color: #ffc285; display: inline-block; margin: 8px 0; }
  .help { color: #7d8187; font-size: 12px; margin-top: 24px; line-height: 1.7; }
  .help a { color: #c4b5fd; text-decoration: none; }
  .help a:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="box">
  <h1>🚧 子域未启用</h1>
  <div class="sub">这个子域名还没有分配给任何同学.</div>
  <div class="host" id="host">--</div>
  <div class="help">
    如果你是同学家长想给孩子开账号, 请联系管理员.<br/>
    已注册同学请打开自己的子域 (如 <a href="https://selena.xiaojin.app">selena.xiaojin.app</a>).
  </div>
</div>
<script>document.getElementById("host").textContent = location.host;</script>
</body>
</html>`;

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

  // Ep 爸爸-2026-05-17：subdomain gate (顶层，所有路径之前)
  // assets/api/manifest 等不走 gate（已经按 host 路由到 OSS，跨子域读静态 OK）
  // 只 gate "导航到 SPA" 的情况（HTML 请求 + /或 SPA fallback）
  const host = c.req.header("Host") ?? "";
  const sub = parseSubdomain(host);
  // 静态资源直放（assets/manifest/icons 跨子域共享同 OSS bucket）
  const isStaticAsset =
    path.startsWith("/assets/") || path.startsWith("/env/") ||
    path.startsWith("/icons/") || path.endsWith(".webmanifest") ||
    path.endsWith(".svg") || path.endsWith(".png") || path.endsWith(".ico") ||
    path.endsWith(".woff2") || path.endsWith(".woff") || path.endsWith(".ttf");
  if (!isStaticAsset && sub !== null && sub !== "" && sub !== "localhost" && !RESERVED_SUBDOMAINS.has(sub)) {
    // 非保留 subdomain → 必须是已知 userId 才放
    const knownIds = await getKnownIdsCached(c.env);
    if (!knownIds.has(sub)) {
      return new Response(NOT_ENABLED_HTML, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300", // 5 min cache, 加同学时刷新
          "X-Subdomain-Gate": "not-enabled",
        },
      });
    }
  }

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
