#!/usr/bin/env node
/**
 * 一次性运维：从 priorities.json 选 top N skill，每个 skill 调
 * /api/generate/questions 拿 5 道，validate + audit，filter 通过的合并进
 * D1 snapshot 的 aiQuestions 字段，再 push 回去。
 *
 * 用法：
 *   APP_PASSWORD=... node scripts/_fill-question-bank.mjs [skillCount=12] [perSkill=5]
 */

import { build } from "esbuild";
import { writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const tmpFile = join(tmpdir(), `fillbank-${Date.now()}.mjs`);

const PWD = process.env.APP_PASSWORD;
if (!PWD) { console.error("APP_PASSWORD env required"); process.exit(1); }

const SKILL_COUNT = Number(process.argv[2] ?? 12);
const PER_SKILL = Number(process.argv[3] ?? 5);
const PROD_HOST = "https://selena-elevate.pages.dev";

await build({
  entryPoints: [join(PROJECT_ROOT, "scripts/_load-content-extended.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: tmpFile,
  logLevel: "error",
});
const { SEED_QUESTIONS, validateQuestion, auditQuestion } = await import(tmpFile);
rmSync(tmpFile, { force: true });

// 读 priorities
const priorities = JSON.parse(readFileSync("/tmp/priorities.json", "utf8"));
const skills = priorities.topToFill.slice(0, SKILL_COUNT);
console.error(`▶ 准备给 ${skills.length} 个 skill 各出 ${PER_SKILL} 道，总计 ${skills.length * PER_SKILL} 道`);

const auth = `Bearer ${PWD}`;

function* skillStems(skillId) {
  for (const q of SEED_QUESTIONS) {
    if (q.skill_id === skillId && typeof q.stem === "string") yield q.stem;
  }
}

async function generateForSkill(skill) {
  const existingStems = Array.from(skillStems(skill.skillId)).slice(0, 30);
  const body = {
    subjectId: "math",
    unitId: skill.unitId,
    unitName: skill.unitName,
    skillId: skill.skillId,
    skillName: skill.skillName,
    count: PER_SKILL,
    difficulty: "2-4",
    term: skill.term === "综合复习" ? undefined : skill.term,
    existingStems,
  };
  const r = await fetch(`${PROD_HOST}/api/generate/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`gen failed ${skill.skillId}: ${r.status} ${await r.text()}`);
  const j = await r.json();
  if (!j.ok || !Array.isArray(j.questions)) throw new Error(`gen empty ${skill.skillId}`);
  return j.questions;
}

const accepted = [];
const stats = { tried: 0, validateFail: 0, auditFail: 0, accepted: 0, errors: [] };

for (let i = 0; i < skills.length; i++) {
  const sk = skills[i];
  process.stderr.write(`[${i + 1}/${skills.length}] ${sk.skillName} (${sk.skillId}) … `);
  try {
    const qs = await generateForSkill(sk);
    let acc = 0, vf = 0, af = 0;
    for (const q of qs) {
      stats.tried++;
      const v = validateQuestion(q);
      if (!v.ok || !v.question) { vf++; stats.validateFail++; continue; }
      const a = auditQuestion(v.question);
      if (a.worstSeverity === "critical" || a.worstSeverity === "likely-broken") {
        af++; stats.auditFail++; continue;
      }
      // stamp
      const stamped = {
        ...v.question,
        subjectId: "math",
        status: "approved",
        tags: Array.from(new Set([...(v.question.tags ?? []), "ai_generated"])),
      };
      accepted.push(stamped);
      acc++; stats.accepted++;
    }
    process.stderr.write(`accept ${acc}/${qs.length} (vfail ${vf}, afail ${af})\n`);
  } catch (e) {
    process.stderr.write(`✗ ${e.message}\n`);
    stats.errors.push({ skillId: sk.skillId, error: e.message });
  }
}

console.error(`▶ 总计：accepted ${stats.accepted}, validateFail ${stats.validateFail}, auditFail ${stats.auditFail}, errors ${stats.errors.length}`);

// 拉最新 snapshot，merge aiQuestions, push 回去
console.error(`▶ 拉最新 snapshot…`);
const dl = await fetch(`${PROD_HOST}/api/sync/download`, { headers: { Authorization: auth } });
if (!dl.ok) throw new Error(`download failed: ${dl.status}`);
const dj = await dl.json();
if (!dj.ok || !dj.latest?.payload) throw new Error("no latest payload");
const payload = dj.latest.payload;

// 当前 aiQuestions（应该都是空，因为这是首次跨设备 sync questions）
const existingAi = Array.isArray(payload.aiQuestions) ? payload.aiQuestions : [];
const existingIds = new Set(existingAi.map((q) => q.question_id));
const newOnes = accepted.filter((q) => !existingIds.has(q.question_id));
const merged = [...existingAi, ...newOnes];

const newPayload = { ...payload, aiQuestions: merged };
const meta = {
  attemptsCount: payload.attempts?.length ?? 0,
  sessionsCount: payload.sessions?.length ?? 0,
  totalXp: dj.latest.totalXp ?? 0,
  clientId: "fill-bank-script",
};

console.error(`▶ 推送 ${merged.length} 道 AI 题到 D1（新增 ${newOnes.length}）…`);
const up = await fetch(`${PROD_HOST}/api/sync/upload`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: auth },
  body: JSON.stringify({ payload: newPayload, ...meta }),
});
if (!up.ok) throw new Error(`upload failed: ${up.status} ${await up.text()}`);
const uj = await up.json();
console.error(`✓ 上传成功 version=${uj.version}`);

// 输出 JSON 报告
console.log(JSON.stringify({
  stats,
  acceptedQuestionIds: accepted.map((q) => q.question_id),
  pushedToD1: newOnes.length,
  totalAiQuestionsInD1: merged.length,
}, null, 2));

// 也写到 /tmp 留底
writeFileSync("/tmp/fillbank-report.json", JSON.stringify({
  stats,
  accepted: accepted.map((q) => ({ qid: q.question_id, skill: q.skill_id, difficulty: q.difficulty, stemPreview: q.stem.slice(0, 50) })),
  pushedToD1: newOnes.length,
  totalAiQuestionsInD1: merged.length,
}, null, 2));
