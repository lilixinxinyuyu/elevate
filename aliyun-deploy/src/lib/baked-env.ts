/**
 * Build-time baked env vars.
 *
 * ESA EdgeRoutine 不支持 runtime env API（2024-09-10 surface 已确认），
 * 所以我们在 build.mjs 里用 esbuild `define` 把 `.dev.vars` 的内容
 * 替换成一个 JSON literal 嵌进 bundle。
 *
 * 轮换 secret = 重新跑 `npm run build && npm run deploy:routine`。
 *
 * 警告：dist/worker.js 含明文 secret，**不要 commit 到任何 repo**。
 */
import type { Env } from "./env";

declare const __BAKED_ENV__: Env;

export const BAKED_ENV: Env = __BAKED_ENV__;

/**
 * v0.36.18 (爸爸深度优化 #1): build 时烤进的 OSS `_auth/users.json`.
 * auth/check 0 runtime OSS hit. null = build 时 OSS 没读到, 回落 runtime OSS.
 */
export interface BakedAuthStore {
  passwords: Record<string, string>;
  updatedAt?: number;
  [k: string]: unknown;
}
declare const __BAKED_AUTH_STORE__: BakedAuthStore | null;
export const BAKED_AUTH_STORE: BakedAuthStore | null = __BAKED_AUTH_STORE__;
