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
 *
 * Ep32 (2026-05-17): in-memory sampling counter。worker 重启 / 跨 isolate
 * 都重置 OK —— 不是精确审计，是"哪个 endpoint 还高频走 fallback"的方向信号，
 * 给爸爸做 Ep33+ 移植优先级。
 */

import { Hono } from "hono";
import type { Env } from "../lib/env";

const proxyFallback = new Hono<{ Bindings: Env }>();

const OLD_BACKEND = "https://selena-elevate.pages.dev";

/**
 * In-memory hit counter — Map<path, {count, lastTs, lastStatus}>。
 * 模块级常量 → 在同一 isolate 生命周期内累计。导出供 super-admin 读。
 */
interface HitRecord {
  count: number;
  lastTs: number;
  lastStatus: number;
  /** 方法分布粗略：GET / POST / 其他 */
  methods: Record<string, number>;
}
const HITS = new Map<string, HitRecord>();
/** worker module loaded 时间，给前端展示 "isolate 启动了多久" */
const ISOLATE_STARTED_AT = Date.now();

/** 给 super-admin 读 */
export function getProxyFallbackStats(): {
  isolateStartedAt: number;
  totalHits: number;
  totalEndpoints: number;
  byPath: Array<{
    path: string;
    count: number;
    lastTs: number;
    lastStatus: number;
    methods: Record<string, number>;
  }>;
} {
  const byPath: ReturnType<typeof getProxyFallbackStats>["byPath"] = [];
  let total = 0;
  for (const [path, rec] of HITS) {
    byPath.push({
      path,
      count: rec.count,
      lastTs: rec.lastTs,
      lastStatus: rec.lastStatus,
      methods: { ...rec.methods },
    });
    total += rec.count;
  }
  // 按命中次数倒序，前 50
  byPath.sort((a, b) => b.count - a.count);
  return {
    isolateStartedAt: ISOLATE_STARTED_AT,
    totalHits: total,
    totalEndpoints: byPath.length,
    byPath: byPath.slice(0, 50),
  };
}

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

  // Ep32: bump in-memory counter（按 pathname 聚合，去掉 query 避免 cardinality 爆炸）
  const pathKey = url.pathname;
  const cur = HITS.get(pathKey) ?? { count: 0, lastTs: 0, lastStatus: 0, methods: {} };
  cur.count += 1;
  cur.lastTs = Date.now();
  cur.lastStatus = upstream.status;
  cur.methods[c.req.method] = (cur.methods[c.req.method] ?? 0) + 1;
  HITS.set(pathKey, cur);

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
