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

// v0.36.17: CF Pages (OLD_BACKEND) 已退役删除. 不再有 fallback 后端.

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

// v0.36.17 (爸爸决策: 彻底删 CF Pages, 单一 ESA):
// 不再转发到 CF Pages (已退役). 所有 endpoint 已 native ESA. 这个兜底只在
// 极罕见的未匹配路径触发, 直接返 501 (而不是转一个不存在的后端).
// 保留 HITS 计数 + getProxyFallbackStats (super-admin 监控哪些路径漏 native).
proxyFallback.all("*", async (c) => {
  const url = new URL(c.req.url);
  const pathKey = url.pathname;
  const cur = HITS.get(pathKey) ?? { count: 0, lastTs: 0, lastStatus: 0, methods: {} };
  cur.count += 1;
  cur.lastTs = Date.now();
  cur.lastStatus = 501;
  cur.methods[c.req.method] = (cur.methods[c.req.method] ?? 0) + 1;
  HITS.set(pathKey, cur);
  console.warn(`[proxy-fallback] 501 未 native 的路径: ${c.req.method} ${pathKey} (CF Pages 已删, 无 fallback)`);
  return new Response(
    JSON.stringify({
      ok: false,
      error: "not_implemented",
      detail: `endpoint ${pathKey} 未在 ESA native 实现 (CF Pages 已退役)`,
      path: pathKey,
    }),
    {
      status: 501,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Proxy-Fallback": "removed-cf-retired",
      },
    },
  );
});

export default proxyFallback;
