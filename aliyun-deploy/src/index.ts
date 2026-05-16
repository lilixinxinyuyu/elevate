/**
 * ESA EdgeRoutine 入口（V8 isolates）。
 *
 * 部署：esbuild bundle 到 dist/worker.js，再通过 ESA Routine API 上传。
 *
 * 路由：
 *   /api/auth/*    → auth.ts（登录校验）
 *   /api/sync/*    → sync.ts（snapshot / ai-questions OSS 同步）
 *   /api/agent/*   → agent.ts（AI 出题 / 修题 / 质检）          [TODO]
 *   /api/admin/*   → admin.ts（report-question / list-reports）  [TODO]
 *   /api/generate/* → generate.ts（image / questions / variant）[TODO]
 *   /api/tts/*     → tts.ts                                      [TODO]
 *   /api/tutor/*   → tutor.ts                                    [TODO]
 *
 * 其他请求（前端静态资源、用户子域）由 ESA 路由规则直接命中 OSS 源站，
 * 不进 EdgeRoutine。
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./lib/env";
import { BAKED_ENV } from "./lib/baked-env";
import sync from "./routes/sync";
import auth from "./routes/auth";
import staticProxy from "./routes/static";
import proxyFallback from "./routes/proxy-fallback";
import generate from "./routes/generate";

const app = new Hono<{ Bindings: Env }>();

// 全局 CORS（前端在 xiaojin.app 各子域调，需要放开）
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "*";
      if (origin.endsWith(".xiaojin.app") || origin === "https://xiaojin.app") return origin;
      // 开发期允许 localhost
      if (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) {
        return origin;
      }
      return null;
    },
    allowHeaders: ["Content-Type", "Authorization", "Content-Encoding"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["X-Snapshot-LastModified", "X-Snapshot-Etag", "X-LastModified"],
    maxAge: 86400,
    credentials: false,
  }),
);

// API 永不缓存
app.use("/api/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
});

// Health check
app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "xiaojinapp-edge",
    ts: Date.now(),
  }),
);

// 已移植到 Aliyun 的 endpoint
app.route("/api/auth", auth);
app.route("/api/sync", sync);

// 已部分移植 endpoint
// NOTE: /api/generate/image 同步实现在 generate.ts 但 ESA EdgeRoutine 11s 硬超时 <
//       图生 30-60s → 504。Episode 5 实现 async (start task → OSS 存 task state →
//       client poll status) 后再 mount。现在 fall back 到 proxy-fallback。
// app.route("/api/generate", generate);
void generate; // 保留 import，避免 unused 警告

// 未移植 endpoint 过渡 proxy → 老 CF Pages backend
app.route("/api/admin", proxyFallback);
app.route("/api/agent", proxyFallback);
app.route("/api/generate", proxyFallback);
app.route("/api/tts", proxyFallback);
app.route("/api/tutor", proxyFallback);

// 非 api 请求 → OSS web/* 代理（SPA fallback 在 staticProxy 内）
app.route("/", staticProxy);

// 404 兜底（理论上不该触发，staticProxy 是 catch-all）
app.notFound((c) => c.json({ ok: false, error: "not_found", path: c.req.path }, 404));

// 异常兜底
app.onError((err, c) => {
  console.error("[onError]", err.message, err.stack);
  return c.json({ ok: false, error: "internal_error", message: err.message }, 500);
});

// ESA EdgeRoutine entry：必须导出名为 default 的对象，含 fetch handler
// 由于 ESA 没有 runtime env binding，我们在这里把 build-time 烤进去的 env
// 作为第二个参数传给 hono。
export default {
  async fetch(request: Request, _runtimeEnv?: unknown, ctx?: unknown): Promise<Response> {
    return app.fetch(request, BAKED_ENV, ctx as never);
  },
};
