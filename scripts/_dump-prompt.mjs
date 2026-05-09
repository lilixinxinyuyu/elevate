#!/usr/bin/env node
/**
 * 把"出题时实际发给模型的完整 prompt"打印出来 — system + user + 各段来源标注。
 *
 * 用法：
 *   node scripts/_dump-prompt.mjs [skillId] [difficulty] [gameType]
 * 例：
 *   node scripts/_dump-prompt.mjs large_compare 3 plain_choice
 *   node scripts/_dump-prompt.mjs equation_solve_simple 4 balance_lab
 */
import { build } from "esbuild";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const tmpFile = join(tmpdir(), `dumpprompt-${Date.now()}.mjs`);

const skillId = process.argv[2] ?? "large_compare";
const difficulty = Number(process.argv[3] ?? 3);
const gameType = process.argv[4] ?? undefined;

// 1. 复刻 fill-bank-v3：把 SEED + /tmp/aiqs.json 里相关 stem 集齐
const tmpContentFile = join(tmpdir(), `dumpcontent-${Date.now()}.mjs`);
await build({
  entryPoints: [join(PROJECT_ROOT, "scripts/_load-content-extended.ts")],
  bundle: true, format: "esm", platform: "node", outfile: tmpContentFile, logLevel: "error",
});
const { SEED_QUESTIONS, SKILLS, UNITS } = await import(tmpContentFile);
rmSync(tmpContentFile, { force: true });

const skillDef = SKILLS.find(s => s.id === skillId);
const unitDef = skillDef ? UNITS.find(u => u.id === skillDef.unitId) : null;

const seedStems = SEED_QUESTIONS
  .filter(q => q.skill_id === skillId && typeof q.stem === "string")
  .map(q => q.stem);

let aiStems = [];
try {
  const aj = JSON.parse(readFileSync("/tmp/aiqs.json", "utf8"));
  if (Array.isArray(aj.rows)) {
    aiStems = aj.rows
      .filter(r => r?.skill_id === skillId && typeof r?.stem === "string")
      .map(r => r.stem);
  }
} catch (e) {
  process.stderr.write(`▶ 读 /tmp/aiqs.json 失败 (${e.message})，仅用 SEED stems\n`);
}

const existingStems = [...seedStems, ...aiStems].slice(0, 25);
process.stderr.write(`▶ ${skillId}: SEED ${seedStems.length} 道 + D1 AI ${aiStems.length} 道 = ${existingStems.length} stem 喂给 server (server 截前 12)\n`);

// 2. build promptComposer + prompts.generated
await build({
  entryPoints: [join(PROJECT_ROOT, "functions/_promptComposer.ts")],
  bundle: true, format: "esm", platform: "node", outfile: tmpFile, logLevel: "error",
});
const { composeQuestionUserPrompt, getSkillScope } = await import(tmpFile);

const tmpFile2 = join(tmpdir(), `dumpprompt2-${Date.now()}.mjs`);
await build({
  entryPoints: [join(PROJECT_ROOT, "functions/_prompts.generated.ts")],
  bundle: true, format: "esm", platform: "node", outfile: tmpFile2, logLevel: "error",
});
const { PROMPTS } = await import(tmpFile2);
rmSync(tmpFile, { force: true });
rmSync(tmpFile2, { force: true });

const scope = getSkillScope(skillId);

const sysPrompt = PROMPTS.questionsSystem.replace(/\{\{subjectLabel\}\}/g, "数学");

const userPrompt = composeQuestionUserPrompt({
  subjectId: "math",
  unitId: skillDef?.unitId ?? scope?.unitId ?? "G4A_U1_LARGE_NUMBERS",
  unitName: unitDef?.name ?? scope?.unitName ?? "(unit)",
  skillId,
  skillName: skillDef?.name ?? scope?.name ?? skillId,
  term: unitDef?.term ?? "上册",
  difficulty,
  count: 1,
  gameType,
  existingStems,
  batchAngle: "数字换一组",
  callerTag: "fill-bank-v3",
});

const D = "═".repeat(74);
console.log(`${D}\n  实际下发给模型的 chat completion 是 [system, user] 两条 message\n${D}\n`);
console.log(`# ▼ system message (来自 prompts/questions/system.md，{{subjectLabel}} 注入)`);
console.log(`# ▼ 字符数：${sysPrompt.length}`);
console.log(`-`.repeat(74));
console.log(sysPrompt);
console.log(`-`.repeat(74));
console.log();
console.log(`# ▼ user message (由 functions/_promptComposer.ts 拼装)`);
console.log(`# ▼ 字符数：${userPrompt.length}`);
console.log(`# ▼ 来源段：`);
console.log(`#   1. 任务声明 — 从参数生成`);
console.log(`#   2. 主 Skill 教学范围 — 从 prompts/skills/scope.json[skillId]`);
console.log(`#   3. 难度规范 — 从 prompts/difficulty/${difficulty}.md`);
console.log(`#   4. (format rubric — 仅当显式传 format 时)`);
console.log(`#   5. JSON Schema — 从 prompts/questions/game-types/${gameType ?? "(自动 plain_choice)"}.md`);
console.log(`#   6. 已有题干（去重） — existingStems 截前 12 条`);
console.log(`#   7. (recent mistakes — 复习专用)`);
console.log(`#   8. 输出协议`);
console.log(`-`.repeat(74));
console.log(userPrompt);
console.log(`-`.repeat(74));
console.log();
console.log(`▶ 总长度（system + user）：${sysPrompt.length + userPrompt.length} 字符`);
