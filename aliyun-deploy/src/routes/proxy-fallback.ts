/**
 * 过渡 proxy：未移植到 Aliyun 的 endpoint 转发到老 CF Pages backend。
 *
 * 客户端调 https://xiaojin.app/api/admin/foo → 我们透传 GET/POST 给
 * https://selena-elevate.pages.dev/api/admin/foo，把响应原样返回。
 *
 * 注意：CF Pages 上 D1 还在跑（虽然 sync 那里 8.2MB 卡住，但 admin / agent /
 * generate / tts / tutor 的 D1 操作量很小，依然能用）。
 *
 * 等所有 endpoint 都移植完，删掉本文件即可。
 */

import { Hono } from "hono";
import type { Env } from "../lib/env";

const proxyFallback = new Hono<{ Bindings: Env }>();

const OLD_BACKEND = "https://selena-elevate.pages.dev";

proxyFallback.all("*", async (c) => {
  const url = new URL(c.req.url);
  const upstreamUrl = OLD_BACKEND + url.pathname + url.search;

  // 透传 method / headers / body
  const headers = new Headers();
  c.req.raw.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    // 不传 host / referer 给 origin（避免 CORS / referer 校验问题）
    if (["host", "referer", "cf-connecting-ip", "x-forwarded-for"].includes(lk)) return;
    headers.set(k, v);
  });

  const init: RequestInit = {
    method: c.req.method,
    headers,
  };
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    init.body = await c.req.raw.arrayBuffer();
  }

  const upstream = await fetch(upstreamUrl, init);

  const respHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (["transfer-encoding", "content-encoding", "set-cookie"].includes(lk)) return;
    respHeaders.set(k, v);
  });
  respHeaders.set("X-Proxy-Fallback", "cf-pages");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
});

export default proxyFallback;
