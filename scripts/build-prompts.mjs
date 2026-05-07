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
 *     qualityRubric: "...",
 *     qualityJudgeSystem: "...",
 *     qualityJudgeUserTemplate: "...",
 *     skillKeywords: { ... },
 *     gameTypeBySkill: { ... },
 *     tutorTextSystem: "...",
 *     tutorVoiceSystem: "...",
 *     mascotXiaojin: "...",
 *   };
 *
 * 在 build 链路里跑一次（package.json 的 build 脚本里）。
 * 也可以单独 `node scripts/build-prompts.mjs` 调试。
 *
 * v0.28.4：支持 {{include:relpath}} 指令——build 时把 relpath 内容内联进来。
 *   用于让 questions/system.md 和 quality-judge/system.md 共享 quality-rubric.md。
 *   include 路径相对 prompts/ 根；递归一层（include 的文件里再 include 不展开）。
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const PROMPTS_DIR = join(PROJECT_ROOT, "prompts");

/**
 * 处理 {{include:relpath}} 指令。relpath 相对 prompts/ 根。
 * 只展开一级——include 的文件里再写 {{include:...}} 不会再次展开（避免环路）。
 */
function expandIncludes(content, sourceLabel) {
  return content.replace(/\{\{include:([^}]+)\}\}/g, (_, relPath) => {
    const cleanPath = relPath.trim();
    const fullPath = join(PROMPTS_DIR, cleanPath);
    try {
      return readFileSync(fullPath, "utf8").trim();
    } catch (e) {
      console.warn(
        `[build-prompts] WARN: ${sourceLabel} -> include "${cleanPath}" not found, leaving placeholder`,
      );
      return `<!-- include:${cleanPath} not found -->`;
    }
  });
}

function readMd(relPath) {
  const raw = readFileSync(join(PROMPTS_DIR, relPath), "utf8").trim();
  return expandIncludes(raw, relPath);
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
  const raw = readFileSync(join(gameTypesDir, f), "utf8").trim();
  questionsSchemas[name] = expandIncludes(raw, `questions/game-types/${f}`);
}

// v0.31.34: 扫 difficulty/ 下 1.md ... 5.md
const difficultyDir = join(PROMPTS_DIR, "difficulty");
const difficultyRubrics = {};
try {
  for (const f of readdirSync(difficultyDir).filter((f) => f.endsWith(".md"))) {
    const name = basename(f, extname(f));
    difficultyRubrics[name] = readMd(`difficulty/${f}`);
  }
} catch {
  /* 目录不存在就跳过 */
}

// v0.31.34: 扫 formats/ 下每个 question_format 的 .md
const formatsDir = join(PROMPTS_DIR, "formats");
const formatRubrics = {};
try {
  for (const f of readdirSync(formatsDir).filter((f) => f.endsWith(".md"))) {
    const name = basename(f, extname(f));
    formatRubrics[name] = readMd(`formats/${f}`);
  }
} catch {
  /* 目录不存在就跳过 */
}

// v0.31.34: 读 skills/scope.json — 每个 skill 的精确教学范围
let skillScope = {};
try {
  skillScope = readJson("skills/scope.json");
} catch {
  /* 文件不存在 → 回落到 skill_name + global rubric */
}

const data = {
  questionsSystem: readMd("questions/system.md"),
  questionsUserTemplate: readMd("questions/user-template.md"),
  questionsSchemas,
  /** v0.31.34：每个难度的精确定义 */
  difficultyRubrics,
  /** v0.31.34：每个 question_format 的具体要求 */
  formatRubrics,
  /** v0.31.34：每个 skill 的精确教学范围（in/out scope + key formulas + common mistakes） */
  skillScope,
  /** 共享质量规范——出题和质检都内联了它，但保留一份原文方便审计 */
  qualityRubric: readMd("quality-rubric.md"),
  qualityJudgeSystem: readMd("quality-judge/system.md"),
  qualityJudgeUserTemplate: readMd("quality-judge/user-template.md"),
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
data.skillScope = stripCommentKey(data.skillScope);

// 生成 TS 文件内容
const banner = `/**
 * 自动生成 — 不要手改。
 * 改 prompts 请编辑 /prompts/**.md，然后跑 \`pnpm build\` 或 \`node scripts/build-prompts.mjs\`。
 *
 * 源文件：
 *   - prompts/quality-rubric.md          (rock-solid 出题/质检共享规范)
 *   - prompts/questions/system.md        (出题 system，内联 rubric)
 *   - prompts/questions/user-template.md
 *   - prompts/questions/game-types/*.md
 *   - prompts/quality-judge/system.md    (质检 system，内联 rubric)
 *   - prompts/quality-judge/user-template.md
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
  `  ${Object.keys(questionsSchemas).length} game-type schemas, ${Object.keys(data.skillKeywords).length} skill keyword sets, ${Object.keys(difficultyRubrics).length} difficulty rubrics, ${Object.keys(formatRubrics).length} format rubrics, ${Object.keys(data.skillScope).length} skill scopes`,
);
