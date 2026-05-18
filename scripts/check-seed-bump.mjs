#!/usr/bin/env node
/**
 * v0.35.35 Refactor Priority 3: SEED hash auto-check (build-time gate).
 *
 * 痛点 (v0.35.25 紧急 bug + 历史 5+ 次):
 *   改 SEED_QUESTIONS / questions-backfilled-metadata.json 后忘 bump
 *   SEED_VERSION → 现有 user IDB cached 旧数据, ensureSeeded() early-return,
 *   新题永远进不来. Selena 看不到新 canvas_scratch / multi_step题.
 *
 * 解法: 编译 SEED_QUESTIONS → SHA256 hash → 跟 .seed-content-hash.json 对比.
 *   - hash 同 → pass (没改)
 *   - hash 改 + SEED_VERSION 没 bump → FAIL with clear 提示
 *   - hash 改 + SEED_VERSION bumped → 更新 stored hash file + pass
 *   - 首次 run (没 stored hash) → 写入 + pass
 *
 * 挂到 npm run build 链路. 阻断 "改一处忘一处" 在 CI / 本地 build 时.
 *
 * 加新 SEED 来源 (e.g. 新 pack 文件) 时, 它会自动随 SEED_QUESTIONS 变 hash,
 * 不需要改这个脚本.
 */
import { build } from "esbuild";
import { writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const HASH_FILE = join(PROJECT_ROOT, "src/db/.seed-content-hash.json");
const SEED_TS = join(PROJECT_ROOT, "src/db/seed.ts");

// 1. SEED_VERSION 从 src/db/seed.ts 提取
const seedTsContent = readFileSync(SEED_TS, "utf-8");
const versionMatch = seedTsContent.match(/^const SEED_VERSION\s*=\s*(\d+)/m);
if (!versionMatch) {
  console.error("[check-seed-bump] FAIL: 找不到 src/db/seed.ts 里的 SEED_VERSION 常量");
  process.exit(1);
}
const SEED_VERSION = parseInt(versionMatch[1], 10);

// 2. 编译 SEED_QUESTIONS via esbuild (复用 _load-content.ts 同 pattern)
const tmpFile = join(tmpdir(), `seed-hash-bundle-${Date.now()}.mjs`);
await build({
  entryPoints: [join(PROJECT_ROOT, "scripts/_load-content.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: tmpFile,
  external: [],
  logLevel: "error",
});
const mod = await import(tmpFile);
rmSync(tmpFile, { force: true });
const { SEED_QUESTIONS } = mod;

// 3. content hash — stable key-sorted JSON 确保 obj key 顺序不影响
function stableStringify(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}
const hash = createHash("sha256").update(stableStringify(SEED_QUESTIONS)).digest("hex").slice(0, 16);
const count = SEED_QUESTIONS.length;

// 4. 对比 stored
const stored = existsSync(HASH_FILE) ? JSON.parse(readFileSync(HASH_FILE, "utf-8")) : null;

if (!stored) {
  writeFileSync(HASH_FILE, JSON.stringify({ hash, version: SEED_VERSION, count, updatedAt: new Date().toISOString() }, null, 2) + "\n");
  console.log(`[check-seed-bump] 第一次 run, 写入: hash=${hash} version=${SEED_VERSION} count=${count}`);
  process.exit(0);
}

if (stored.hash === hash) {
  console.log(`[check-seed-bump] ✓ hash 匹配 (${hash}) version=${SEED_VERSION} count=${count}`);
  process.exit(0);
}

// hash changed
if (stored.version === SEED_VERSION) {
  console.error(`\n[check-seed-bump] ✗ FAIL: SEED_QUESTIONS content changed but SEED_VERSION not bumped\n`);
  console.error(`  stored.hash:     ${stored.hash}  (count=${stored.count})`);
  console.error(`  computed.hash:   ${hash}  (count=${count})`);
  console.error(`  stored.version:  ${stored.version}`);
  console.error(`  current.version: ${SEED_VERSION}\n`);
  console.error(`  ACTION: bump SEED_VERSION in src/db/seed.ts (${SEED_VERSION} → ${SEED_VERSION + 1})\n`);
  console.error(`  否则现有用户 IndexedDB cached 旧 SEED, ensureSeeded() early-return,`);
  console.error(`  新题永远进不来 (v0.35.25 紧急 bug 同种).\n`);
  process.exit(1);
}

// hash changed AND version bumped → 接受 + 更新 stored
writeFileSync(HASH_FILE, JSON.stringify({ hash, version: SEED_VERSION, count, updatedAt: new Date().toISOString() }, null, 2) + "\n");
console.log(`[check-seed-bump] ✓ hash 改 + version bumped ${stored.version} → ${SEED_VERSION}, 更新 stored hash`);
console.log(`  new hash: ${hash}, count: ${count}`);
process.exit(0);
