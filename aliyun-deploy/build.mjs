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
import OSS from "ali-oss";

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
  "FC_IMAGE_GEN_URL",
  "FC_PAPER_OCR_URL",
];
const bakedEnv = {};
for (const k of BAKED_KEYS) {
  if (devVars[k]) bakedEnv[k] = devVars[k];
}
console.log(`[build] baking ${Object.keys(bakedEnv).length} env vars into bundle:`, Object.keys(bakedEnv).join(", "));

// v0.36.18 (爸爸深度优化 #1): build 时把 OSS `_auth/users.json` 烤进 bundle.
// 之前 auth/check 每次 runtime OSS GET (~1-2s, 偶 spike). 现在密码表 build 时
// 注入, auth 完全 0 OSS hit. 改密码/加同学后需 redeploy (super-admin 操作可接受).
// 万一 build 时 OSS 读失败, runtime 回落到 OSS read (auth-store.ts fallback 保留).
let bakedAuthStore = null;
if (devVars.ALIYUN_OSS_ACCESS_KEY_ID && devVars.ALIYUN_OSS_BUCKET) {
  try {
    const client = new OSS({
      region: devVars.ALIYUN_OSS_REGION,
      accessKeyId: devVars.ALIYUN_OSS_ACCESS_KEY_ID,
      accessKeySecret: devVars.ALIYUN_OSS_ACCESS_KEY_SECRET,
      bucket: devVars.ALIYUN_OSS_BUCKET,
      secure: true,
    });
    const r = await client.get("_auth/users.json");
    const parsed = JSON.parse(r.content.toString("utf-8"));
    if (parsed && parsed.passwords && typeof parsed.passwords === "object") {
      bakedAuthStore = parsed;
      console.log(`[build] ✓ baked auth store: ${Object.keys(parsed.passwords).length} passwords (0 runtime OSS hit for auth)`);
    } else {
      console.warn("[build] auth store shape invalid, skip bake (runtime OSS fallback)");
    }
  } catch (e) {
    console.warn(`[build] auth store fetch failed (runtime OSS fallback): ${e.message}`);
  }
}

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
    "__BAKED_AUTH_STORE__": JSON.stringify(bakedAuthStore),
  },
  logLevel: "info",
});

const stats = statSync(resolve(__dirname, "dist/worker.js"));
const sizeKB = (stats.size / 1024).toFixed(1);
console.log(`\n✓ built dist/worker.js (${sizeKB} KB) with ${Object.keys(bakedEnv).length} env vars baked in`);
