#!/usr/bin/env node
/**
 * 对比 dashscope/qwen-plus vs token-plan/deepseek-v3.2 的出题能力。
 *
 * 同一个 prompt（skill × difficulty × count），forceProvider 强制走两边。
 * 对每边的返回结果跑 SAME validation：
 *   - 实际返回道数（请求 N，AI 真给几道）
 *   - off_topic 率（server 端 stemMatchesSkill 通过率）
 *   - shape 通过率（isValidQuestionShape 通过率）
 *   - audit 严重缺陷率（critical / likely-broken）
 *
 * 用法：APP_PASSWORD=... node scripts/_bench-models.mjs
 */
import { build } from "esbuild";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const tmpFile = join(tmpdir(), `benchmodels-${Date.now()}.mjs`);

const PWD = process.env.APP_PASSWORD;
if (!PWD) { console.error("APP_PASSWORD env required"); process.exit(1); }

const PROD = "https://selena-elevate.pages.dev";
const auth = `Bearer ${PWD}`;

await build({
  entryPoints: [join(PROJECT_ROOT, "scripts/_load-content-extended.ts")],
  bundle: true, format: "esm", platform: "node", outfile: tmpFile, logLevel: "error",
});
const { validateQuestion, auditQuestion } = await import(tmpFile);
rmSync(tmpFile, { force: true });

// 3 个不同特性的 skill：plain_choice / 概念 / 难度变化
const SKILLS = [
  { id: "large_compare", unitId: "G4A_U1_LARGE_NUMBERS", name: "大数比较大小", term: "上册" },
  { id: "decimal_compare", unitId: "G4B_U1_DECIMAL_ADD_SUB", name: "小数大小比较", term: "下册" },
  { id: "int_mul_3_by_2", unitId: "G4A_U3_MULTIPLICATION", name: "三位数乘两位数笔算", term: "上册" },
];

const COUNT = 10;
const SUB_BATCH_SIZE = 2;  // server 默认。让 5 个并发 sub-batch 各出 2 道，最多 ~10 道
const SLEEP_BETWEEN = 8000;  // 测之间 8s 缓 rate limit

async function gen(skill, provider) {
  const t0 = Date.now();
  const r = await fetch(`${PROD}/api/generate/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({
      subjectId: "math",
      unitId: skill.unitId, unitName: skill.name,
      skillId: skill.id, skillName: skill.name,
      count: COUNT,
      subBatchSize: SUB_BATCH_SIZE,
      forceProvider: provider,
      difficulty: "2-4",
      term: skill.term,
      existingStems: [],
    }),
  });
  const dt = Date.now() - t0;
  const txt = await r.text();
  if (!r.ok) {
    let detail = "";
    try { detail = JSON.parse(txt)?.detail ?? ""; } catch {}
    return { ok: false, http: r.status, dt, n: 0, vfail: 0, afail: 0, detail: detail.slice(0, 100) };
  }
  let body;
  try { body = JSON.parse(txt); } catch { return { ok: false, http: r.status, dt, parse: "fail" }; }
  if (!body.ok || !Array.isArray(body.questions)) {
    return { ok: false, http: r.status, dt, n: 0, vfail: 0, afail: 0, detail: body.detail ?? body.error };
  }
  // server 已经过 stemMatchesSkill + isValidQuestionShape（off_topic 的题不会进 questions）
  // 这里再跑客户端 zod + audit 看真实可用率
  let vfail = 0, afail = 0, ok = 0;
  for (const q of body.questions) {
    const v = validateQuestion(q);
    if (!v.ok) { vfail++; continue; }
    const a = auditQuestion(v.question);
    if (a.worstSeverity === "critical" || a.worstSeverity === "likely-broken") { afail++; continue; }
    ok++;
  }
  return {
    ok: true, http: r.status, dt,
    requested: COUNT,
    n: body.questions.length,
    vfail, afail, valid: ok,
    model: body.model, provider: body.provider,
  };
}

const PROVIDERS = [
  { label: "dashscope-intl", expectedModel: "qwen-plus" },
  { label: "token-plan", expectedModel: "deepseek-v3.2 (then glm-5/MiniMax/qwen3.6)" },
];

const results = [];
for (const sk of SKILLS) {
  for (const p of PROVIDERS) {
    process.stderr.write(`▶ ${sk.id} via ${p.label} … `);
    const r = await gen(sk, p.label);
    process.stderr.write(`[${(r.dt / 1000).toFixed(1)}s] returned ${r.n}/${COUNT} valid=${r.valid} vfail=${r.vfail} afail=${r.afail} model=${r.model ?? "?"}\n`);
    results.push({ skill: sk.id, provider: p.label, ...r });
    await new Promise(res => setTimeout(res, SLEEP_BETWEEN));
  }
}

console.log("\n══════ 汇总（一次请求 " + COUNT + " 道） ══════");
console.log("skill              | provider          | dt(s) | returned | valid | vfail | afail | model");
console.log("-".repeat(108));
for (const r of results) {
  const sk = r.skill.padEnd(18);
  const pv = r.provider.padEnd(17);
  const dt = (r.dt / 1000).toFixed(1).padStart(5);
  const ret = String(r.n).padStart(8);
  const vd = String(r.valid).padStart(5);
  const vf = String(r.vfail).padStart(5);
  const af = String(r.afail).padStart(5);
  console.log(`${sk} | ${pv} | ${dt} | ${ret} | ${vd} | ${vf} | ${af} | ${r.model ?? r.detail ?? ""}`);
}
