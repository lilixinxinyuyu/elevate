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
