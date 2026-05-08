#!/usr/bin/env node
/**
 * 一次性运维脚本：基于 prod D1 snapshot + bundled seed 算出 SkillRow，输出
 *   - 缺货 + 期末重点（第一波要补题）
 *   - 薄弱（Selena mastery < 60 + 答过 ≥3 次）
 *   - 有 critical/likely-broken audit 问题的题列表（要 AI fix）
 *
 * 用法：node scripts/_audit-priorities.mjs > /tmp/priorities.json
 * 前置：snapshot 已经 curl 到 /tmp/prod-snapshot.json
 */

import { build } from "esbuild";
import { writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const tmpFile = join(tmpdir(), `priorities-${Date.now()}.mjs`);

await build({
  entryPoints: [join(PROJECT_ROOT, "scripts/_load-content.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: tmpFile,
  logLevel: "error",
});
const { SEED_QUESTIONS, SKILLS, UNITS } = await import(tmpFile);
rmSync(tmpFile, { force: true });

const snapshot = JSON.parse(readFileSync("/tmp/prod-snapshot.json", "utf8"));
const payload = snapshot.latest?.payload ?? {};
const attempts = payload.attempts ?? [];
const mastery = payload.mastery ?? [];

const UNIT_BY_ID = new Map(UNITS.map((u) => [u.id, u]));
const masteryBySkill = new Map();
for (const m of mastery) masteryBySkill.set(m.skillId, m);
const attemptsBySkill = new Map();
for (const a of attempts) {
  const arr = attemptsBySkill.get(a.skillId) ?? [];
  arr.push(a);
  attemptsBySkill.set(a.skillId, arr);
}
const questionsBySkill = new Map();
for (const q of SEED_QUESTIONS) {
  if (!q.skill_id) continue;
  const arr = questionsBySkill.get(q.skill_id) ?? [];
  arr.push(q);
  questionsBySkill.set(q.skill_id, arr);
}

// === Audit lite (mirror src/lib/questionAuditLite.ts) ===
const OPTION_BASED = new Set(["plain_choice", "true_false_swipe"]);
function auditQuestion(q) {
  const issues = [];
  const add = (sev, code, msg) => issues.push({ sev, code, msg });
  if (!q.question_id) add("critical", "C1", "missing question_id");
  if (!q.skill_id) add("critical", "C1", "missing skill_id");
  if (!q.stem || !q.stem.trim()) add("critical", "C1", "missing/empty stem");
  if (typeof q.difficulty !== "number" || q.difficulty < 1 || q.difficulty > 5)
    add("critical", "C1", `difficulty=${q.difficulty} not 1-5`);
  if (!q.term) add("critical", "C1", "missing term");
  const opts = q.options;
  const ans = q.answer;
  const needsOptions =
    OPTION_BASED.has(q.game_type) ||
    q.question_format === "single_choice" ||
    q.question_format === "multi_choice";
  if (needsOptions) {
    if (!Array.isArray(opts) || opts.length < 2) add("critical", "C2", "options < 2");
    if (!ans) add("critical", "C2", "missing answer");
    if (Array.isArray(opts) && ans?.type === "choice") {
      const ids = opts.map((o) => o?.id).filter((x) => typeof x === "string");
      if (typeof ans.value !== "string" || !ids.includes(ans.value))
        add("critical", "C3", `answer.value="${ans.value}" not in options`);
    }
  }
  // M3/M4
  if (typeof q.estimated_time_seconds === "number") {
    const ets = q.estimated_time_seconds;
    if (ets < 10 || ets > 240) add("minor", "M3", `ets=${ets}`);
    const stemLen = (q.stem ?? "").length;
    const longestOpt = Array.isArray(opts) ? Math.max(0, ...opts.map((o) => (o?.text ?? "").length)) : 0;
    if (stemLen >= 60 && ets < 30) add("minor", "M4", `stem ${stemLen}字 ets=${ets}s 太短`);
    if (stemLen >= 120 && ets < 50) add("minor", "M4", `stem ${stemLen}字 ets=${ets}s 严重不足`);
    if (longestOpt >= 20 && ets < 30) add("minor", "M4", `opt ${longestOpt}字 ets=${ets}s 太短`);
  }
  const hasCritical = issues.some((i) => i.sev === "critical");
  const hasLikely = issues.some((i) => i.sev === "likely-broken");
  return { pass: !hasCritical && !hasLikely, hasCritical, hasLikely, issues };
}

const PRIO_RANK = {
  MUST_BIG: 9,
  HIGH_BIG: 8,
  MUST_SMALL: 7,
  VERY_HIGH_SMALL: 6,
  HIGH_SMALL: 5,
  NORMAL: 4,
  LOW_SMALL: 2,
  LOW: 1,
  EXTENSION: 0,
};

const rows = [];
for (const skill of SKILLS) {
  const unit = UNIT_BY_ID.get(skill.unitId);
  if (!unit) continue;
  const skillQs = questionsBySkill.get(skill.id) ?? [];
  let m4Count = 0;
  let critCount = 0;
  for (const q of skillQs) {
    const a = auditQuestion(q);
    if (a.hasCritical) critCount++;
    if (a.issues.some((i) => i.code === "M4")) m4Count++;
  }
  const skillAttempts = attemptsBySkill.get(skill.id) ?? [];
  const correct = skillAttempts.filter((a) => a.isCorrect).length;
  const accuracy = skillAttempts.length > 0 ? correct / skillAttempts.length : 0;
  const masteryScore = masteryBySkill.get(skill.id)?.score ?? 0;
  const isWeak = skillAttempts.length >= 3 && masteryScore < 60;
  const isLowStock = skillQs.length < 8;
  const isMustBigShort = (skill.examPriority === "MUST_BIG" || skill.examPriority === "HIGH_BIG") && skillQs.length < 12;

  rows.push({
    skillId: skill.id,
    skillName: skill.name,
    unitId: skill.unitId,
    unitName: unit.name,
    term: unit.term,
    examPriority: skill.examPriority,
    priorityRank: PRIO_RANK[skill.examPriority] ?? 0,
    totalCount: skillQs.length,
    m4Count,
    critCount,
    mastery: masteryScore,
    attemptsCount: skillAttempts.length,
    accuracy: Math.round(accuracy * 100),
    isWeak,
    isLowStock,
    isMustBigShort,
  });
}

// 优先级评分：薄弱 + 缺货 + 期末重要度 + mastery gap + stock gap
function genScore(r) {
  return (
    (r.isWeak ? 30 : 0) +
    (r.isLowStock ? 20 : 0) +
    (r.isMustBigShort ? 15 : 0) +
    r.priorityRank * 3 +
    Math.max(0, 100 - r.mastery) * 0.3 +
    Math.max(0, 30 - r.totalCount) * 0.5
  );
}

const sorted = rows.sort((a, b) => genScore(b) - genScore(a));
const topToFill = sorted
  .filter((r) => r.term === "下册" && (r.isLowStock || r.isMustBigShort || r.isWeak))
  .slice(0, 12);

// 找出有 M4 (长题短时间) 的题，按 critCount + m4Count 降序
const skillsWithM4 = sorted
  .filter((r) => r.m4Count > 0 || r.critCount > 0)
  .slice(0, 20);

console.log(JSON.stringify({
  totals: {
    skills: rows.length,
    questionsTotal: SEED_QUESTIONS.length,
    skillsWithIssues: rows.filter((r) => r.m4Count + r.critCount > 0).length,
    weakSkills: rows.filter((r) => r.isWeak).length,
    lowStock: rows.filter((r) => r.isLowStock).length,
    mustBigShort: rows.filter((r) => r.isMustBigShort).length,
  },
  topToFill: topToFill.map((r) => ({
    skillId: r.skillId,
    skillName: r.skillName,
    term: r.term,
    unitId: r.unitId,
    unitName: r.unitName,
    examPriority: r.examPriority,
    totalCount: r.totalCount,
    mastery: r.mastery,
    attempts: r.attemptsCount,
    accuracy: r.accuracy,
    flags: [
      r.isWeak ? "weak" : null,
      r.isLowStock ? "lowStock" : null,
      r.isMustBigShort ? "mustBigShort" : null,
    ].filter(Boolean),
  })),
  skillsWithIssues: skillsWithM4.map((r) => ({
    skillId: r.skillId,
    skillName: r.skillName,
    term: r.term,
    totalCount: r.totalCount,
    critCount: r.critCount,
    m4Count: r.m4Count,
  })),
}, null, 2));
