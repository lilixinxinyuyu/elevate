#!/usr/bin/env node
/**
 * scripts/add-skill.mjs — Phase 2 Axis 4 · 加新 skill 一条龙脚本
 *
 * 把 "加 skill" 从改 6+ 文件压成一条命令 + 审 git diff。
 *
 * 用法：
 *   ELEVATE_PASSWORD=xxx node scripts/add-skill.mjs \
 *     --id mul_table_9 \
 *     --name "9×9 乘法口诀" \
 *     --unit G4B_FLUENCY \
 *     --ability calculation \
 *     --term 下册 \
 *     --difficulty 1-2 \
 *     --count 30 \
 *     --exam-priority NORMAL \
 *     [--create-unit] [--unit-name "口算基本功"] [--order-index 99] \
 *     [--dry-run] [--no-gen]
 *
 * 干的事：
 *   1. 校验 skill id 不重复 + unit 已存在（或 --create-unit 创建）
 *   2. patch src/content/skills.ts（追加 skill row）
 *   3. patch src/content/units.ts（如果 --create-unit）
 *   4. 调 /api/generate/questions（DashScope qwen-plus，分批 + 并发）
 *   5. 验证生成的题（去重 / 答案 type / 禁词）
 *   6. 写 src/content/aiGenSkill_<id>.ts pack 文件
 *   7. patch src/content/questions.ts（import + spread）
 *   8. bump src/db/seed.ts 的 SEED_VERSION
 *   9. 打印汇总，提示 git diff + 人工审
 *
 * 不直接 commit。所有修改都 stage 在 working tree，跑 `git diff` 自己审。
 *
 * Phase 2 doc: docs/phase2-plan.md (Axis 4)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// 1. CLI 参数解析
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    id: null,
    name: null,
    unit: null,
    ability: null, // 逗号分隔
    term: null, // 上册 | 下册
    difficulty: "1-4",
    count: 30,
    examPriority: "NORMAL",
    priority: "HIGH",
    createUnit: false,
    unitName: null,
    orderIndex: null,
    gameType: null,
    dryRun: false,
    noGen: false,
    apiBase: process.env.ELEVATE_API_BASE || "https://selena-elevate.pages.dev",
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case "--id": args.id = next; i++; break;
      case "--name": args.name = next; i++; break;
      case "--unit": args.unit = next; i++; break;
      case "--ability": args.ability = next; i++; break;
      case "--term": args.term = next; i++; break;
      case "--difficulty": args.difficulty = next; i++; break;
      case "--count": args.count = parseInt(next, 10); i++; break;
      case "--exam-priority": args.examPriority = next; i++; break;
      case "--priority": args.priority = next; i++; break;
      case "--create-unit": args.createUnit = true; break;
      case "--unit-name": args.unitName = next; i++; break;
      case "--order-index": args.orderIndex = parseInt(next, 10); i++; break;
      case "--game-type": args.gameType = next; i++; break;
      case "--dry-run": args.dryRun = true; break;
      case "--no-gen": args.noGen = true; break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        if (a.startsWith("--")) die(`Unknown flag: ${a}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`scripts/add-skill.mjs — 加新 skill 一条龙

required:
  --id <id>              skill id（snake_case，例 mul_table_9）
  --name "<中文名>"      skill 中文显示名
  --unit <unit_id>       归属 unit（必须已存在，或加 --create-unit 创建）
  --ability <a,b,...>    逗号分隔，可选: concept|calculation|reasoning|spatial|modeling|data|strategy
  --term <上册|下册>     学期

optional:
  --difficulty <m-n>     难度范围（默认 1-4）
  --count <N>            生成题量（默认 30）
  --exam-priority <P>    NORMAL|HIGH_SMALL|MUST_SMALL|MUST_BIG（默认 NORMAL）
  --priority <P>         LOW|MEDIUM|HIGH|VERY_HIGH（默认 HIGH）
  --game-type <t>        填某个题型偏好，否则 generator 自选
  --create-unit          unit 不存在则创建（必须配 --unit-name --order-index --term）
  --unit-name "<名>"     新 unit 中文名
  --order-index <N>      新 unit 在学期内的序号
  --dry-run              不写文件不调 API，只打印计划
  --no-gen               跳过 AI 出题（只 patch schema 文件，pack 留空）

env:
  ELEVATE_PASSWORD       生产 API 密码（必填，除非 --no-gen）
  ELEVATE_API_BASE       API 域（默认 https://selena-elevate.pages.dev）
`);
}

function die(msg) { console.error("✗", msg); process.exit(1); }

function validate(args) {
  for (const k of ["id", "name", "unit", "ability", "term"]) {
    if (!args[k]) die(`--${k.replace(/([A-Z])/g, "-$1").toLowerCase()} required`);
  }
  if (!/^[a-z0-9_]+$/.test(args.id)) die(`--id 必须 snake_case (got ${args.id})`);
  if (!["上册", "下册"].includes(args.term)) die(`--term 必须 "上册" 或 "下册"`);
  const validAbilities = new Set([
    "concept", "calculation", "reasoning", "spatial", "modeling", "data", "strategy", "fluency",
  ]);
  for (const a of args.ability.split(",")) {
    if (!validAbilities.has(a)) die(`--ability 包含未知项 "${a}"`);
  }
  if (!/^\d-\d$/.test(args.difficulty)) die(`--difficulty 必须 N-M 形式 (got ${args.difficulty})`);
  if (args.count < 0 || args.count > 100) die(`--count must be 0-100`);
  if (args.createUnit) {
    if (!args.unitName) die("--create-unit 需要 --unit-name");
    if (args.orderIndex == null) die("--create-unit 需要 --order-index");
  }
  if (!args.noGen && !process.env.ELEVATE_PASSWORD) {
    die("ELEVATE_PASSWORD env 必填（或加 --no-gen 跳过 AI 出题）");
  }
}

// ---------------------------------------------------------------------------
// 2. 文件读 / 写工具
// ---------------------------------------------------------------------------

function readFile(rel) { return readFileSync(resolve(ROOT, rel), "utf-8"); }
function writeFile(rel, content) { writeFileSync(resolve(ROOT, rel), content, "utf-8"); }

// ---------------------------------------------------------------------------
// 3. patch skills.ts / units.ts / questions.ts / seed.ts
// ---------------------------------------------------------------------------

function checkSkillIdAvailable(id) {
  const src = readFile("src/content/skills.ts");
  const re = new RegExp(`["']${id}["']`);
  if (re.test(src)) die(`skill id "${id}" 已存在于 src/content/skills.ts`);
}

function checkUnitExists(unitId) {
  const src = readFile("src/content/units.ts");
  const re = new RegExp(`id:\\s*["']${unitId}["']`);
  return re.test(src);
}

function difficultyBaseFromRange(range) {
  const [, lo, hi] = /^(\d)-(\d)$/.exec(range) || [];
  return Math.min(4, Math.max(1, Math.round((Number(lo) + Number(hi)) / 2)));
}

function patchSkillsTs(args) {
  const path = "src/content/skills.ts";
  const src = readFile(path);
  const abilityArr = args.ability.split(",").map((a) => `"${a}"`).join(", ");
  const difficultyBase = difficultyBaseFromRange(args.difficulty);
  const newRow = `  { id: "${args.id}", unitId: "${args.unit}", name: "${args.name}", ability: [${abilityArr}], difficultyBase: ${difficultyBase}, priority: "${args.priority}", examPriority: "${args.examPriority}" },\n`;
  const lastBracket = src.lastIndexOf("];");
  if (lastBracket < 0) die("找不到 SKILLS 数组的 `];`");
  const out = src.slice(0, lastBracket) + newRow + src.slice(lastBracket);
  return { path, before: src, after: out };
}

function patchUnitsTs(args) {
  const path = "src/content/units.ts";
  const src = readFile(path);
  const newRow = `  { id: "${args.unit}", term: "${args.term}", orderIndex: ${args.orderIndex}, name: "${args.unitName}", description: "", priority: "${args.priority}" },\n`;
  const lastBracket = src.lastIndexOf("];");
  if (lastBracket < 0) die("找不到 UNITS 数组的 `];`");
  const out = src.slice(0, lastBracket) + newRow + src.slice(lastBracket);
  return { path, before: src, after: out };
}

function packFileName(skillId) { return `aiGenSkill_${skillId}.ts`; }
function packExportName(skillId) { return `AI_GEN_SKILL_${skillId.toUpperCase()}_PACK`; }

function writePackFile(args, questions) {
  const path = `src/content/${packFileName(args.id)}`;
  const exportName = packExportName(args.id);
  const byDiff = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const q of questions) byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
  const header = `/**
 * ${exportName} — Phase 2 Axis 4 自动生成
 *
 * skill: ${args.id} (${args.name})
 * unit:  ${args.unit}
 * 由 scripts/add-skill.mjs 跑 /api/generate/questions 生成。**勿手改**。
 *
 * 总数：${questions.length} 道
 * 难度：D1=${byDiff[1]} / D2=${byDiff[2]} / D3=${byDiff[3]} / D4=${byDiff[4]}
 * 生成时间：${new Date().toISOString()}
 */

import type { Question } from "../core/types";

export const ${exportName}: Question[] = `;
  const body = JSON.stringify(questions, null, 2);
  const footer = " as Question[];\n";
  return { path, before: existsSync(resolve(ROOT, path)) ? readFile(path) : null, after: header + body + footer };
}

function patchQuestionsTs(args) {
  const path = "src/content/questions.ts";
  const src = readFile(path);
  const exportName = packExportName(args.id);
  const importLine = `import { ${exportName} } from "./${packFileName(args.id).replace(/\.ts$/, "")}";\n`;
  // 检查重复
  if (src.includes(importLine.trim())) die(`questions.ts 已包含 ${exportName} import`);
  // 找最后一个 import 行
  const lines = src.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) lastImportIdx = i;
  }
  if (lastImportIdx < 0) die("找不到 questions.ts 的 import 段");
  lines.splice(lastImportIdx + 1, 0, importLine.trimEnd());
  // 在最后 `];` 前插入 spread
  let spreadLine = `  ...${exportName},`;
  let firstHalf = lines.join("\n");
  const lastBracket = firstHalf.lastIndexOf("];");
  if (lastBracket < 0) die("找不到 questions.ts 最终数组的 `];`");
  const out = firstHalf.slice(0, lastBracket) + spreadLine + "\n" + firstHalf.slice(lastBracket);
  return { path, before: src, after: out };
}

function bumpSeedVersion() {
  const path = "src/db/seed.ts";
  const src = readFile(path);
  const m = /const SEED_VERSION = (\d+);/.exec(src);
  if (!m) die("找不到 SEED_VERSION");
  const oldVer = Number(m[1]);
  const newVer = oldVer + 1;
  const out = src.replace(/const SEED_VERSION = \d+;/, `const SEED_VERSION = ${newVer};`);
  return { path, before: src, after: out, oldVer, newVer };
}

// ---------------------------------------------------------------------------
// 4. 调 /api/generate/questions
// ---------------------------------------------------------------------------

async function generateQuestions(args) {
  if (args.noGen) return [];
  const url = `${args.apiBase}/api/generate/questions`;
  const body = {
    subjectId: "math",
    unitId: args.unit,
    unitName: args.unitName || args.unit,
    skillId: args.id,
    skillName: args.name,
    count: args.count,
    difficulty: args.difficulty,
    term: args.term,
    existingStems: [],
    recentMistakeStems: [],
    gameType: args.gameType || undefined,
  };
  console.log(`→ POST ${url}  count=${args.count} difficulty=${args.difficulty}`);
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ELEVATE_PASSWORD}`,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    die(`API ${r.status}: ${txt.slice(0, 200)}`);
  }
  const j = await r.json();
  if (!j.ok || !Array.isArray(j.questions)) {
    die(`API 返回 ok=${j.ok} questions=${typeof j.questions}`);
  }
  console.log(`← ${j.questions.length} questions (model=${j.model})`);
  return j.questions;
}

// ---------------------------------------------------------------------------
// 5. 题目验证（沿用 _emit-g4b-u14-pack.mjs 的规则）
// ---------------------------------------------------------------------------

const FORBIDDEN_RE = [
  /笨|粗心鬼|你怎么又错|真差|没用/,
  /比例|函数|方程组|平方根|二次方程|立方根|一元二次/,
];
const VALID_ANSWER_TYPES = new Set(["number", "choice", "multi_step"]);

function validateQuestions(qs, args) {
  const accepted = [];
  const seen = new Set();
  const rejected = { dup: 0, badShape: 0, badDiff: 0, mismatchSkill: 0, badAnswer: 0, forbidden: 0 };
  for (const q of qs) {
    if (!q.question_id || !q.stem || !q.answer) { rejected.badShape++; continue; }
    if (q.skill_id !== args.id) { rejected.mismatchSkill++; continue; }
    const [lo, hi] = args.difficulty.split("-").map(Number);
    if (!Number.isInteger(q.difficulty) || q.difficulty < lo || q.difficulty > hi) {
      rejected.badDiff++; continue;
    }
    if (!q.answer.type || !VALID_ANSWER_TYPES.has(q.answer.type)) { rejected.badAnswer++; continue; }
    const key = `${q.skill_id}::${(q.stem || "").trim()}`;
    if (seen.has(key)) { rejected.dup++; continue; }
    seen.add(key);
    if (q.answer.type === "multi_step") {
      if (!Array.isArray(q.subquestions) || q.subquestions.length === 0) { rejected.badShape++; continue; }
    } else if (!Array.isArray(q.options) || q.options.length < 2) {
      rejected.badShape++; continue;
    }
    const fullText = [
      q.stem || "",
      ...(Array.isArray(q.options) ? q.options.map((o) => o?.text || "") : []),
      ...(Array.isArray(q.solution_steps) ? q.solution_steps : [String(q.solution_steps || "")]),
    ].join("\n");
    if (FORBIDDEN_RE.some((re) => re.test(fullText))) { rejected.forbidden++; continue; }
    if (!Array.isArray(q.solution_steps)) {
      q.solution_steps = q.solution_steps ? [String(q.solution_steps)] : [];
    }
    accepted.push(q);
  }
  return { accepted, rejected };
}

// ---------------------------------------------------------------------------
// 6. main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  validate(args);

  console.log(`📋 加 skill: ${args.id} (${args.name})`);
  console.log(`   unit=${args.unit} term=${args.term} ability=${args.ability}`);
  console.log(`   difficulty=${args.difficulty} count=${args.count}`);

  // 1. 检查 skill 已不存在
  checkSkillIdAvailable(args.id);

  // 2. 检查 unit
  const unitExists = checkUnitExists(args.unit);
  if (!unitExists && !args.createUnit) {
    die(`unit "${args.unit}" 不存在。加 --create-unit + --unit-name + --order-index 自动建`);
  }

  // 3. 收集所有要做的 patch
  const patches = [];
  if (!unitExists && args.createUnit) patches.push(patchUnitsTs(args));
  patches.push(patchSkillsTs(args));

  // 4. 生成题（除非 --no-gen）
  let rawQuestions = [];
  if (!args.noGen) {
    rawQuestions = await generateQuestions(args);
  }
  const { accepted, rejected } = validateQuestions(rawQuestions, args);
  console.log(`   验证：accepted=${accepted.length} rejected=${JSON.stringify(rejected)}`);

  // 5. 即使 0 题也写空 pack（保留 schema 一致）
  patches.push(writePackFile(args, accepted));
  patches.push(patchQuestionsTs(args));

  // 6. bump SEED_VERSION
  const seedPatch = bumpSeedVersion();
  patches.push(seedPatch);

  // 7. 应用 / dry-run
  if (args.dryRun) {
    console.log("\n🔍 --dry-run 模式，不写入。会改：");
    for (const p of patches) {
      const beforeLen = (p.before || "").length;
      const afterLen = (p.after || "").length;
      console.log(`   ${p.path}  (${beforeLen} → ${afterLen} bytes)`);
    }
    return;
  }
  for (const p of patches) {
    writeFile(p.path, p.after);
    console.log(`   ✓ wrote ${p.path}`);
  }
  console.log(`\n✅ 完成。SEED_VERSION ${seedPatch.oldVer} → ${seedPatch.newVer}`);
  console.log(`📋 下一步：跑 \`git diff\` 审完手动 commit + 部署。`);
  console.log(`   生成 ${accepted.length} 道题。如果题量不足，可重跑：`);
  console.log(`     node scripts/add-skill.mjs --id ${args.id} ... --count <N>`);
  console.log(`   （脚本会跳过已存在的 skill，但你可以手动 cat 进 pack 文件）`);
}

main().catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
