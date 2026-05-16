/**
 * 加新同学到 APP_USERS map + 自动重 deploy worker.js。
 *
 * 用法：
 *   node scripts/add-student.mjs --userId alice --displayName "爱丽丝" --gradeBand G3
 *   node scripts/add-student.mjs --userId alice                  # 最少
 *   node scripts/add-student.mjs --list                          # 看当前都有谁
 *   node scripts/add-student.mjs --remove --userId alice         # 删
 *
 * 流程：
 *   1. 读 .dev.vars 拿出现有 APP_USERS（JSON or 空）
 *   2. 生成 20 字符随机密码（避免歧义字符 0/O/1/l/I）
 *   3. APP_USERS[password] = userId
 *   4. 写回 .dev.vars
 *   5. `npm run build` 重打包 worker.js（烤入新 APP_USERS）
 *   6. `npx esa deploy` 上线
 *   7. 输出 ↘ 同学的：
 *      - 登录 URL: https://{userId}.xiaojin.app
 *      - 密码: xxxxxxxxxxxx
 *
 * 注：不重 deploy 前端（前端是单一 SPA bundle，每人共用）
 */

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import crypto from "node:crypto";
import OSS from "ali-oss";

const DEV_VARS = process.env.DEV_VARS ?? "/Users/yong/Desktop/xy/.dev.vars";
const SAFE_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  // boolean flag if no value or next is another --flag
  const next = process.argv[i + 1];
  if (!next || next.startsWith("--")) return true;
  return next;
}

function genPassword(len = 20) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += SAFE_CHARS[bytes[i] % SAFE_CHARS.length];
  return out;
}

function loadDevVars() {
  const raw = readFileSync(DEV_VARS, "utf-8");
  const lines = raw.split("\n");
  const map = {};
  for (const l of lines) {
    if (!l.trim() || l.startsWith("#") || !l.includes("=")) continue;
    const i = l.indexOf("=");
    map[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return { raw, lines, map };
}

function saveDevVars(map) {
  // 保留顺序：read raw 拆 line，对已存在的 key 替换 value；新 key append
  const { lines } = loadDevVars();
  const seen = new Set();
  const newLines = [];
  for (const l of lines) {
    if (!l.trim() || l.startsWith("#") || !l.includes("=")) {
      newLines.push(l);
      continue;
    }
    const i = l.indexOf("=");
    const k = l.slice(0, i).trim();
    if (k in map) {
      newLines.push(`${k}=${map[k]}`);
      seen.add(k);
    } else {
      newLines.push(l);
    }
  }
  for (const [k, v] of Object.entries(map)) {
    if (!seen.has(k)) newLines.push(`${k}=${v}`);
  }
  writeFileSync(DEV_VARS, newLines.join("\n"));
}

function loadAppUsers(map) {
  if (!map.APP_USERS || map.APP_USERS === "") return {};
  try {
    return JSON.parse(map.APP_USERS);
  } catch (e) {
    console.error("[add-student] APP_USERS parse failed:", e.message);
    return {};
  }
}

function listUsers() {
  const { map } = loadDevVars();
  const users = loadAppUsers(map);
  console.log("\n当前 APP_USERS:");
  if (Object.keys(users).length === 0) {
    console.log("  (空)");
  } else {
    for (const [pwd, uid] of Object.entries(users)) {
      const masked = pwd.slice(0, 4) + "..." + pwd.slice(-2);
      console.log(`  ${uid.padEnd(20)} → ${masked} (https://${uid}.xiaojin.app)`);
    }
  }
  if (map.APP_PASSWORD) {
    console.log(`\n额外：APP_PASSWORD = ${map.APP_PASSWORD.slice(0, 4)}... → userId="selena" (legacy 默认家)`);
  }
}

function rebuildAndDeploy() {
  const cwd = resolve(import.meta.dirname, "..");
  console.log("\n[build] npm run build ...");
  const build = spawnSync("npm", ["run", "build"], { cwd, stdio: "inherit" });
  if (build.status !== 0) {
    console.error("[build] 失败，退出");
    process.exit(1);
  }
  console.log("\n[deploy] npx esa deploy ...");
  const deploy = spawnSync(
    "npx",
    ["esa", "deploy", "dist/worker.js", "--name", "xiaojinapp-api", "--no-bundle", "-e", "production", "-d", `add-student ${new Date().toISOString().slice(0, 16)}`],
    { cwd, stdio: "inherit" },
  );
  if (deploy.status !== 0) {
    console.error("[deploy] 失败 — env 已写进 .dev.vars，但 ESA 没更新。手动重跑 npm run deploy:routine");
    process.exit(1);
  }
}

// ─── main ──────────────────────────────────────────────────────

const list = arg("list");
const remove = arg("remove");
const userId = arg("userId");
const displayName = arg("displayName");
const gradeBand = arg("gradeBand");
// Ep8 新加 onboarding 字段（爸爸 2026-05-17 加单）
const school = arg("school");           // 学校名 "成都锦江和平街小学"
const city = arg("city");               // 城市 "成都"
const grade = arg("grade");             // 年级 "4"
const klass = arg("class");             // 班级 "3" (不能叫 class，JS 保留字)
const birthday = arg("birthday");       // ISO "2016-03-13"
const guardianRole = arg("guardianRole"); // "妈妈" / "爸爸" / "爷爷" / 自定义
const guardianPhone = arg("guardianPhone"); // "13800138000"

if (list) {
  listUsers();
  process.exit(0);
}

if (remove) {
  if (!userId) {
    console.error("--remove 必带 --userId");
    process.exit(1);
  }
  const { map } = loadDevVars();
  const users = loadAppUsers(map);
  const before = Object.keys(users).length;
  const toRemove = Object.entries(users)
    .filter(([_, v]) => v === userId)
    .map(([k]) => k);
  if (toRemove.length === 0) {
    console.error(`没找到 userId='${userId}'`);
    process.exit(1);
  }
  for (const k of toRemove) delete users[k];
  map.APP_USERS = JSON.stringify(users);
  saveDevVars(map);
  console.log(`[remove] 删了 ${toRemove.length} 条 userId='${userId}' 的密码（${before} → ${Object.keys(users).length}）`);
  rebuildAndDeploy();
  process.exit(0);
}

if (!userId) {
  console.error("用法: node scripts/add-student.mjs --userId <id> [--displayName <名字>] [--gradeBand G3]");
  console.error("      node scripts/add-student.mjs --list");
  console.error("      node scripts/add-student.mjs --remove --userId <id>");
  process.exit(1);
}

if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
  console.error(`userId 不合法：'${userId}'，只能 [a-zA-Z0-9_-]，长度 1-64`);
  process.exit(1);
}

if (["api", "www", "mail", "admin", "static", "cdn", "assets", "edge"].includes(userId)) {
  console.error(`userId '${userId}' 是保留字（子域用），换一个`);
  process.exit(1);
}

const { map } = loadDevVars();
const users = loadAppUsers(map);

// 检查冲突
const existing = Object.entries(users).filter(([_, v]) => v === userId).map(([k]) => k);
if (existing.length > 0) {
  console.error(`userId='${userId}' 已存在（${existing.length} 个密码）。要重置先 --remove`);
  process.exit(1);
}

const password = genPassword(20);
users[password] = userId;
map.APP_USERS = JSON.stringify(users);
saveDevVars(map);

// Ep8 (爸爸 2026-05-17): 学生 profile 持久化到 OSS users/{userId}/profile.json
// 前端首登读这里渲染；缺字段时弹 onboarding form 让家长补
const profile = {
  schemaVersion: 1,
  userId,
  displayName: displayName ?? userId,
  gradeBand: gradeBand ?? null,
  school: school ?? null,
  city: city ?? null,
  grade: grade ?? null,
  class: klass ?? null,
  birthday: birthday ?? null,
  guardianRole: guardianRole ?? null,
  guardianPhone: guardianPhone ?? null,
  createdAt: Date.now(),
  createdBy: "add-student-cli",
};

let profilePushed = false;
try {
  const client = new OSS({
    endpoint: `https://${map.ALIYUN_OSS_REGION}.aliyuncs.com`,
    bucket: map.ALIYUN_OSS_BUCKET,
    accessKeyId: map.ALIYUN_OSS_ACCESS_KEY_ID,
    accessKeySecret: map.ALIYUN_OSS_ACCESS_KEY_SECRET,
    secure: true,
  });
  await client.put(`users/${userId}/profile.json`, Buffer.from(JSON.stringify(profile, null, 2)), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
  profilePushed = true;
} catch (e) {
  console.warn(`[profile] OSS push failed: ${e.message}（之后可以让同学登录后补）`);
}

console.log("\n✓ 已加：");
console.log(`  userId         : ${userId}`);
console.log(`  displayName    : ${profile.displayName}`);
console.log(`  school         : ${profile.school ?? "(待补)"}`);
console.log(`  city           : ${profile.city ?? "(待补)"}`);
console.log(`  grade/class    : ${profile.grade ?? "?"}年级 / ${profile.class ?? "?"}班`);
console.log(`  birthday       : ${profile.birthday ?? "(待补)"}`);
console.log(`  guardianRole   : ${profile.guardianRole ?? "(待补)"}`);
console.log(`  guardianPhone  : ${profile.guardianPhone ?? "(待补)"}`);
console.log(`  OSS profile    : ${profilePushed ? "✓ users/" + userId + "/profile.json" : "✗ 未推"}`);
console.log(`  登录 URL       : https://${userId}.xiaojin.app`);
console.log(`  备用 URL       : https://xiaojin.app    (apex 密码也认)`);
console.log(`  密码           : ${password}`);
console.log(`\n  → 把"登录 URL + 密码"发给监护人。`);
console.log(`  → profile 缺的字段同学/家长首登后补（onboarding modal）`);

rebuildAndDeploy();

console.log("\n✓ 部署完成。同学现在就可以登录了。");
console.log("\n再确认一遍：");
console.log(`  curl -X POST -H "Authorization: Bearer ${password}" https://xiaojin.app/api/auth/check`);
console.log(`  应返回 {"ok":true,"userId":"${userId}"}`);
console.log(`  curl https://${userId}.xiaojin.app/api/profile  # (新 endpoint, Ep8b 实现)`);
