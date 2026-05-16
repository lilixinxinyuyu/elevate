/**
 * Frontend deploy：把仓库根的 dist/* （`npm run build` 输出）传到
 * OSS bucket `xiaojinapp` 的 `web/` 前缀下。
 *
 * 用法：从 aliyun-deploy 目录 `npm run deploy:frontend`
 *
 * 流程：
 *   1. 读 .dev.vars
 *   2. ali-oss SDK 连 cn-hongkong bucket
 *   3. 递归列 ../../dist 文件
 *   4. 上传，content-type 按扩展名映射，cache-control 按资源类型：
 *      - .html → no-cache (随时获取新版)
 *      - .js/.css/[hashed] → max-age=31536000 (Vite 已加 hash)
 *      - 其他静态 → max-age=86400
 *   5. 删除 OSS 上 web/ 下不在本次 dist 里的 stale 文件（可选）
 */

import OSS from "ali-oss";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { resolve, relative, join, extname } from "node:path";

const DEV_VARS = process.env.DEV_VARS ?? "/Users/yong/Desktop/xy/.dev.vars";
const env = Object.fromEntries(
  readFileSync(DEV_VARS, "utf-8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const DIST_DIR = resolve(import.meta.dirname, "../../dist");
const PREFIX = "web/";

const client = new OSS({
  endpoint: `https://${env.ALIYUN_OSS_REGION}.aliyuncs.com`,
  bucket: env.ALIYUN_OSS_BUCKET,
  accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID,
  accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET,
  secure: true,
});

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push({ full, size: st.size });
  }
  return out;
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".vrm": "application/octet-stream",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function contentTypeFor(file) {
  const ext = extname(file).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

function cacheControlFor(file) {
  if (file.endsWith(".html") || file.endsWith("/manifest.json")) {
    return "public, max-age=0, must-revalidate";
  }
  // Vite hashed assets in /assets/ — long cache
  if (file.includes("/assets/")) return "public, max-age=31536000, immutable";
  // 其他静态资源 1 天
  return "public, max-age=86400";
}

async function main() {
  console.log(`[deploy-frontend] reading dist: ${DIST_DIR}`);
  const files = walk(DIST_DIR);
  console.log(`[deploy-frontend] found ${files.length} files, total ${(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(2)} MB`);

  let okCount = 0;
  let failCount = 0;
  let totalBytes = 0;
  const start = Date.now();

  // 并发 8
  const queue = [...files];
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      const relPath = relative(DIST_DIR, item.full).replace(/\\/g, "/");
      const key = PREFIX + relPath;
      try {
        await client.put(key, item.full, {
          headers: {
            "Content-Type": contentTypeFor(relPath),
            "Cache-Control": cacheControlFor(relPath),
          },
        });
        okCount++;
        totalBytes += item.size;
        if (okCount % 20 === 0 || okCount === files.length) {
          console.log(`[deploy-frontend] uploaded ${okCount}/${files.length}`);
        }
      } catch (e) {
        failCount++;
        console.error(`[deploy-frontend] FAIL ${key}: ${e.message}`);
      }
    }
  });
  await Promise.all(workers);

  const dur = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n[deploy-frontend] done in ${dur}s. ok=${okCount}, fail=${failCount}, bytes=${(totalBytes / 1024 / 1024).toFixed(2)}MB`);
  if (failCount > 0) process.exit(1);
}

main().catch((e) => {
  console.error("[deploy-frontend] fatal:", e);
  process.exit(1);
});
