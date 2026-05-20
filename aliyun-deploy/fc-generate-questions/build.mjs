/**
 * esbuild bundle: index.ts (+ ESA lib composer/prompts/normalize/gameTypePicker)
 * → index.mjs (FC nodejs20 用).
 *
 * 复用 aliyun-deploy/src/lib/* (唯一出题逻辑源), 不重写.
 * bake TOKEN_PLAN_CN_API_KEY + APP_PASSWORD + APP_USERS 进 __BAKED_FC_ENV__.
 *
 * 安全: index.mjs 含明文 secret, 不 commit (.gitignore 排除).
 */
import { build } from "esbuild";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
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

const bakedFcEnv = {
  TOKEN_PLAN_CN_API_KEY: devVars.TOKEN_PLAN_CN_API_KEY,
  APP_PASSWORD: devVars.APP_PASSWORD,
  APP_USERS: devVars.APP_USERS,
};

await build({
  entryPoints: [resolve(__dirname, "index.ts")],
  outfile: resolve(__dirname, "index.mjs"),
  bundle: true,
  format: "esm",
  target: "es2022",
  platform: "node",
  minify: false,
  sourcemap: false,
  treeShaking: true,
  legalComments: "none",
  define: {
    "__BAKED_FC_ENV__": JSON.stringify(bakedFcEnv),
  },
  logLevel: "info",
});

const sizeKB = (statSync(resolve(__dirname, "index.mjs")).size / 1024).toFixed(1);
console.log(`\n✓ built fc-generate-questions/index.mjs (${sizeKB} KB), env baked: TOKEN_PLAN_CN + APP_PASSWORD + APP_USERS`);
