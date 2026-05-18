#!/usr/bin/env node
/**
 * v0.35.45 Refactor Priority 12 (peer review #4 共识 top 1):
 * Dexie IndexedDB schema migration gate (build-time).
 *
 * 痛点:
 *   db/dexie.ts 加新表或改 store 索引时, 必须同时加 `this.version(N+1).stores({...})`.
 *   忘了 → 现有用户 IDB schema 不升级, 新表 missing, write 报 NotFoundError,
 *   或老 index 找不到 → 整个 app 启动失败. 跟 SEED_VERSION 忘 bump 同类.
 *
 * 解法: 跟 check-seed-bump 同 pattern.
 *   1. 编译 src/db/dexie.ts, extract `version(N).stores({...})` block sequence + max version
 *   2. SHA256 hash schema content
 *   3. 比对 .db-schema-hash.json
 *   4. hash 改 + maxVersion 同 → FAIL (要 bump version)
 *   5. hash 改 + maxVersion 升 → 接受 + (--update 写新 hash)
 *
 * 挂到 npm run build 链路.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const DEXIE_TS = join(PROJECT_ROOT, "src/db/dexie.ts");
const HASH_FILE = join(PROJECT_ROOT, "src/db/.db-schema-hash.json");

// 1. 读 dexie.ts 源码
const src = readFileSync(DEXIE_TS, "utf-8");

// 2. extract 所有 version(N).stores({...}) block — 用 RegExp + brace counting
// (这里不像 GameTemplate union, Dexie schema 是 imperative 调用, 没法做 const list.
//  仍然 source-parse, 但容忍 doc comment + 多行)
const versions = [];
const re = /this\.version\((\d+)\)\s*\.stores\(\s*\{/g;
let m;
while ((m = re.exec(src)) !== null) {
  const version = parseInt(m[1], 10);
  let i = m.index + m[0].length;  // position after `{`
  let depth = 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
    i++;
  }
  const storesText = src.slice(m.index + m[0].length, i - 1).trim();
  versions.push({ version, storesText });
}

if (versions.length === 0) {
  console.error("[check-db-schema] FAIL: 没找到任何 this.version(N).stores 调用");
  process.exit(1);
}

const maxVersion = Math.max(...versions.map((v) => v.version));

// 3. 拼接所有 version stores 内容 (sorted by version) → hash
const composed = versions
  .sort((a, b) => a.version - b.version)
  .map((v) => `v${v.version}::${v.storesText.replace(/\s+/g, " ")}`)
  .join("\n");
const hash = createHash("sha256").update(composed).digest("hex").slice(0, 16);

// 4. 对比 stored
const isUpdate = process.argv.includes("--update");
const stored = existsSync(HASH_FILE) ? JSON.parse(readFileSync(HASH_FILE, "utf-8")) : null;

if (!stored) {
  if (!isUpdate) {
    console.error(`[check-db-schema] FAIL: 没有 ${HASH_FILE}, 第一次 setup. 跑 \`npm run update:db-schema-hash\` 写入.`);
    process.exit(1);
  }
  writeFileSync(HASH_FILE, JSON.stringify({ hash, maxVersion, versionCount: versions.length }, null, 2) + "\n");
  console.log(`[check-db-schema] 第一次 run (--update), 写入: hash=${hash} maxVersion=${maxVersion} versionCount=${versions.length}`);
  process.exit(0);
}

if (stored.hash === hash) {
  console.log(`[check-db-schema] ✓ hash 匹配 (${hash}) maxVersion=${maxVersion} versionCount=${versions.length}`);
  process.exit(0);
}

// hash changed
if (maxVersion <= stored.maxVersion) {
  console.error(`\n[check-db-schema] ✗ FAIL: Dexie schema content changed but maxVersion not bumped (or downgraded)\n`);
  console.error(`  stored.hash:        ${stored.hash}  (versionCount=${stored.versionCount})`);
  console.error(`  computed.hash:      ${hash}  (versionCount=${versions.length})`);
  console.error(`  stored.maxVersion:  ${stored.maxVersion}`);
  console.error(`  current.maxVersion: ${maxVersion}\n`);
  if (maxVersion === stored.maxVersion) {
    console.error(`  ACTION: src/db/dexie.ts 加 \`this.version(${maxVersion + 1}).stores({...})\` block\n`);
  } else {
    console.error(`  ACTION: maxVersion 比 stored 小 (${maxVersion} < ${stored.maxVersion}), 检查是否误删 version block\n`);
  }
  console.error(`  否则现有用户 IDB schema 不升级, 新表 missing, write 报 NotFoundError.\n`);
  console.error(`  本地 schema 改完确认无误后跑: npm run update:db-schema-hash\n`);
  process.exit(1);
}

if (!isUpdate) {
  console.error(`\n[check-db-schema] ✗ FAIL: hash & maxVersion 都改了, 但 stored 还没同步. 跑 --update 接受.\n`);
  console.error(`  stored.hash:       ${stored.hash}  -> computed: ${hash}`);
  console.error(`  stored.maxVersion: ${stored.maxVersion} -> current: ${maxVersion}\n`);
  console.error(`  ACTION: npm run update:db-schema-hash\n`);
  process.exit(1);
}
writeFileSync(HASH_FILE, JSON.stringify({ hash, maxVersion, versionCount: versions.length }, null, 2) + "\n");
console.log(`[check-db-schema] ✓ --update: hash 改 + maxVersion bumped ${stored.maxVersion} → ${maxVersion}, 写入新 stored`);
console.log(`  new hash: ${hash}, versionCount: ${versions.length}`);
process.exit(0);
