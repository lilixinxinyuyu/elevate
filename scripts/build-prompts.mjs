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

/**
 * v0.31.72：subject 隔离 — 把 `<!--SUBJ:MATH-->...<!--/SUBJ:MATH-->`
 * 和 `<!--SUBJ:CHINESE-->...<!--/SUBJ:CHINESE-->` 标记的段落，按目标 subject 过滤。
 * 不带标记的段落保留（视为 shared）。
 *
 * keepSubject: "math" / "chinese" / null（保留全部，给原始 dump 用）
 */
function filterBySubject(content, keepSubject) {
  if (!keepSubject) return content;
  const otherSubject = keepSubject === "math" ? "chinese" : "math";
  // 移除 OTHER subject 的整段（包括 marker 本身）
  const otherUpper = otherSubject.toUpperCase();
  const otherRe = new RegExp(
    `<!--\\s*SUBJ:${otherUpper}\\s*-->[\\s\\S]*?<!--\\s*/SUBJ:${otherUpper}\\s*-->\\n?`,
    "g",
  );
  let out = content.replace(otherRe, "");
  // 把 KEEP subject 的 marker 标签去掉，但保留内容
  const keepUpper = keepSubject.toUpperCase();
  const keepRe = new RegExp(`<!--\\s*/?SUBJ:${keepUpper}\\s*-->\\n?`, "g");
  out = out.replace(keepRe, "");
  // 折叠多余空行
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

function readMd(relPath, subject = null) {
  const raw = readFileSync(join(PROMPTS_DIR, relPath), "utf8").trim();
  const expanded = expandIncludes(raw, relPath);
  return filterBySubject(expanded, subject);
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
  /**
   * v0.31.72: 按 subject 拆分两份 — 数学 prompt 不再混入语文规则，反之亦然。
   * 调用方按 subjectId 选 .math 或 .chinese。
   * 还保留 .raw 供审计 / 工具脚本用。
   */
  questionsSystem: {
    math: readMd("questions/system.md", "math"),
    chinese: readMd("questions/system.md", "chinese"),
    raw: readMd("questions/system.md"),
  },
  questionsUserTemplate: readMd("questions/user-template.md"),
  questionsSchemas,
  /** v0.31.34：每个难度的精确定义 */
  difficultyRubrics,
  /** v0.31.34：每个 question_format 的具体要求 */
  formatRubrics,
  /** v0.31.34：每个 skill 的精确教学范围（in/out scope + key formulas + common mistakes） */
  skillScope,
  /** v0.31.72：四原则 — 出题和质检共用 */
  qualityPrinciples: readMd("quality-principles.md"),
  /** 附加机械约束（题型字段 / 时间表 / 题干语言等），按 subject 过滤 */
  qualityRubric: {
    math: readMd("quality-rubric.md", "math"),
    chinese: readMd("quality-rubric.md", "chinese"),
    raw: readMd("quality-rubric.md"),
  },
  qualityJudgeSystem: {
    math: readMd("quality-judge/system.md", "math"),
    chinese: readMd("quality-judge/system.md", "chinese"),
    raw: readMd("quality-judge/system.md"),
  },
  qualityJudgeUserTemplate: readMd("quality-judge/user-template.md"),
  /** v0.31.73：变式 prompt — 极简，给 retry 实时出题用 */
  variantSystem: readMd("variant/system.md"),
  /**
   * v0.31.78：修题 prompt — 给 fix-question / report-question 端点共用。
   * 跟 variant 不同：fix 是改原题（保 question_id），不是出新题。
   */
  fixSystem: {
    math: readMd("fix/system.md", "math"),
    chinese: readMd("fix/system.md", "chinese"),
    raw: readMd("fix/system.md"),
  },
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
