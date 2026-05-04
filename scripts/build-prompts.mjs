#!/usr/bin/env node
/**
 * 把 /prompts/ 目录里的 .md 文件 + JSON 配置编译成 TS 常量。
 *
 * 输出两个文件（git-tracked，部署时不需要再 build）：
 *   - functions/_prompts.generated.ts  （Cloudflare Pages Functions 用）
 *   - src/lib/_prompts.generated.ts    （浏览器端用）
 *
 * 形如：
 *   export const PROMPTS = {
 *     questionsSystem: "...",
 *     questionsUserTemplate: "...",
 *     questionsSchemas: { plain_choice: "...", cube_view: "...", ... },
 *     skillKeywords: { ... },
 *     gameTypeBySkill: { ... },
 *     tutorTextSystem: "...",
 *     tutorVoiceSystem: "...",
 *     mascotXiaojin: "...",
 *   };
 *
 * 在 build 链路里跑一次（package.json 的 build 脚本里）。
 * 也可以单独 `node scripts/build-prompts.mjs` 调试。
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const PROMPTS_DIR = join(PROJECT_ROOT, "prompts");

function readMd(relPath) {
  return readFileSync(join(PROMPTS_DIR, relPath), "utf8").trim();
}

function readJson(relPath) {
  return JSON.parse(readFileSync(join(PROMPTS_DIR, relPath), "utf8"));
}

// 扫 game-types/ 下所有 .md
const gameTypesDir = join(PROMPTS_DIR, "questions", "game-types");
const gameTypeFiles = readdirSync(gameTypesDir).filter((f) => f.endsWith(".md"));
const questionsSchemas = {};
for (const f of gameTypeFiles) {
  const name = basename(f, extname(f));
  questionsSchemas[name] = readFileSync(join(gameTypesDir, f), "utf8").trim();
}

const data = {
  questionsSystem: readMd("questions/system.md"),
  questionsUserTemplate: readMd("questions/user-template.md"),
  questionsSchemas,
  skillKeywords: readJson("skill-keywords.json"),
  gameTypeBySkill: readJson("game-type-by-skill.json"),
  tutorTextSystem: readMd("tutor/text-system.md"),
  tutorVoiceSystem: readMd("tutor/voice-system.md"),
  mascotXiaojin: readMd("mascot/xiaojin.md"),
};

// 把"_comment" key 从 JSON 里剥掉（运行时不需要）
function stripCommentKey(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "_comment") continue;
    out[k] = v;
  }
  return out;
}
data.skillKeywords = stripCommentKey(data.skillKeywords);
data.gameTypeBySkill = stripCommentKey(data.gameTypeBySkill);

// 生成 TS 文件内容
const banner = `/**
 * 自动生成 — 不要手改。
 * 改 prompts 请编辑 /prompts/**.md，然后跑 \`pnpm build\` 或 \`node scripts/build-prompts.mjs\`。
 *
 * 源文件：
 *   - prompts/questions/system.md
 *   - prompts/questions/user-template.md
 *   - prompts/questions/game-types/*.md
 *   - prompts/tutor/text-system.md
 *   - prompts/tutor/voice-system.md
 *   - prompts/mascot/xiaojin.md
 *   - prompts/skill-keywords.json
 *   - prompts/game-type-by-skill.json
 */

`;

const body = `export const PROMPTS = ${JSON.stringify(data, null, 2)} as const;\n\nexport type GameTypeSchemaKey = keyof typeof PROMPTS.questionsSchemas;\n`;

const out = banner + body;

// 写两份
const targets = [
  join(PROJECT_ROOT, "functions", "_prompts.generated.ts"),
  join(PROJECT_ROOT, "src", "lib", "_prompts.generated.ts"),
];

for (const t of targets) {
  mkdirSync(dirname(t), { recursive: true });
  writeFileSync(t, out, "utf8");
  console.log(`✓ wrote ${t.replace(PROJECT_ROOT, ".")}`);
}

console.log(
  `  ${Object.keys(questionsSchemas).length} game-type schemas, ${Object.keys(data.skillKeywords).length} skill keyword sets`,
);
