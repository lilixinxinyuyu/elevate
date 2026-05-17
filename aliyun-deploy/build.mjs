/**
 * esbuild bundle: src/index.ts → dist/worker.js
 *
 * 重点：ESA EdgeRoutine **没有** runtime env var API（已确认 2026-05）。
 * 所以构建时把 .dev.vars 烤进 bundle —— 通过 esbuild `define` 把
 * `__BAKED_ENV__` 替换成 JSON literal。
 *
 * 安全提醒：dist/worker.js 内含明文 secret，**不要 commit**。
 * 我们只把它上传到 ESA，不入仓库（aliyun-deploy/.gitignore 已加 dist/）。
 */
import { build } from "esbuild";
import { readFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8"));

const devVarsPath = process.env.DEV_VARS ?? "/Users/yong/Desktop/xy/.dev.vars";
const devVars = Object.fromEntries(
  readFileSync(devVarsPath, "utf-8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

// 只把 EdgeRoutine 需要的 env 烤进去（白名单，避免把 SITE_ID 之类的也漏进 bundle）
const BAKED_KEYS = [
  "APP_PASSWORD",
  "APP_USERS",
  "ALIYUN_OSS_REGION",
  "ALIYUN_OSS_BUCKET",
  "ALIYUN_OSS_ACCESS_KEY_ID",
  "ALIYUN_OSS_ACCESS_KEY_SECRET",
  "TOKEN_PLAN_CN_API_KEY",
  "BAILIAN_API_KEY",
  "TOKEN_PLAN_API_KEY",
  "DASHSCOPE_API_KEY",
  "SUPER_ADMINS",
  "BACKUP_TOKEN",
];
const bakedEnv = {};
for (const k of BAKED_KEYS) {
  if (devVars[k]) bakedEnv[k] = devVars[k];
}
console.log(`[build] baking ${Object.keys(bakedEnv).length} env vars into bundle:`, Object.keys(bakedEnv).join(", "));

mkdirSync(resolve(__dirname, "dist"), { recursive: true });

await build({
  entryPoints: [resolve(__dirname, "src/index.ts")],
  outfile: resolve(__dirname, "dist/worker.js"),
  bundle: true,
  format: "esm",
  target: "es2022",
  platform: "neutral",
  external: [],
  conditions: ["worker", "browser"],
  mainFields: ["module", "main"],
  minify: false,
  sourcemap: false,
  treeShaking: true,
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": '"production"',
    "__VERSION__": JSON.stringify(pkg.version),
    "__BAKED_ENV__": JSON.stringify(bakedEnv),
  },
  logLevel: "info",
});

const stats = statSync(resolve(__dirname, "dist/worker.js"));
const sizeKB = (stats.size / 1024).toFixed(1);
console.log(`\n✓ built dist/worker.js (${sizeKB} KB) with ${Object.keys(bakedEnv).length} env vars baked in`);
