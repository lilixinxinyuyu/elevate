#!/usr/bin/env node
/**
 * 把 SEED_QUESTIONS + SKILLS + UNITS 编译并写到 public/agent/*.json，
 * 供 Hermes skill (selena-math-tutor) 通过 HTTPS 拉。
 *
 * 在 build 时跑一次：package.json 的 build 链路里挂上。
 */

import { build } from "esbuild";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const tmpFile = join(tmpdir(), `agent-data-bundle-${Date.now()}.mjs`);

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

const { SEED_QUESTIONS, SKILLS, UNITS } = mod;

// 把题精简成 agent 需要的字段
const strippedQuestions = SEED_QUESTIONS.map((q) => ({
  question_id: q.question_id,
  unit_id: q.unit_id,
  unit_name: q.unit_name,
  skill_id: q.skill_id,
  skill_name: q.skill_name,
  difficulty: q.difficulty,
  cognitive_level: q.cognitive_level,
  exam_priority: q.exam_priority,
  question_format: q.question_format,
  stem: q.stem,
  options: q.options?.map((o) => ({ id: o.id, text: o.text })),
  answer: q.answer,
  hints: q.hints,
  solution_steps: q.solution_steps,
  parent_tip: q.parent_tip,
  tags: (q.tags ?? []).filter((t) => !/^(opt-|grid-|solid:|tri-|sticks:|eq:|pair:|vert:|op:|result:|hl:|bars:|step:|start:|factor:)/.test(t)),
}));

const strippedSkills = SKILLS.map((s) => ({
  id: s.id,
  unitId: s.unitId,
  name: s.name,
  ability: s.ability,
  difficultyBase: s.difficultyBase,
  examPriority: s.examPriority,
}));

const strippedUnits = UNITS.map((u) => ({
  id: u.id,
  term: u.term,
  orderIndex: u.orderIndex,
  name: u.name,
  description: u.description,
  priority: u.priority,
}));

const outDir = join(PROJECT_ROOT, "public/agent");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "questions.json"), JSON.stringify(strippedQuestions));
writeFileSync(join(outDir, "skills.json"), JSON.stringify(strippedSkills));
writeFileSync(join(outDir, "units.json"), JSON.stringify(strippedUnits));

console.log(`✓ wrote public/agent/{questions,skills,units}.json`);
console.log(`  questions: ${strippedQuestions.length}`);
console.log(`  skills: ${strippedSkills.length}`);
console.log(`  units: ${strippedUnits.length}`);
