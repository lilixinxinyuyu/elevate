#!/usr/bin/env node
/**
 * 直连 alibaba dashscope，绕开 Cloudflare 30s 硬限。
 * 测：qwen-plus 给到 90s budget，一次能出多少道。
 *
 * 用 fill-bank-v4 同样的 prompt 拼装逻辑（composeQuestionUserPrompt + system.md）
 * 唯一区别是 fetch 直接打 dashscope，不走 Cloudflare。
 *
 * 用法：DASHSCOPE_API_KEY=... node scripts/_bench-direct.mjs [count=20] [skillId=large_compare]
 */
import { build } from "esbuild";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// 读 .dev.vars 自动注入 — 先 parent (~/Desktop/xy/.dev.vars)，后 cwd
for (const path of [join(PROJECT_ROOT, "..", ".dev.vars"), join(PROJECT_ROOT, ".dev.vars")]) {
  try {
    const dv = readFileSync(path, "utf8");
    for (const line of dv.split("\n")) {
      const [k, ...rest] = line.split("=");
      if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
    }
  } catch { /* */ }
}

// 支持两个 provider：dashscope (qwen-plus) 或 token-plan (deepseek-v3.2)
const COUNT = Number(process.argv[2] ?? 20);
const SKILL_ID = process.argv[3] ?? "large_compare";
const PROVIDER = process.argv[4] ?? "dashscope";  // dashscope | token-plan
const MODEL = process.argv[5] ?? (PROVIDER === "token-plan" ? "deepseek-v3.2" : "qwen-plus");

const PROVIDER_CONFIG = {
  "dashscope": {
    baseUrl: "https://dashscope-intl.aliyuncs.com",
    keyEnv: "DASHSCOPE_API_KEY",
  },
  "token-plan": {
    baseUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com",
    keyEnv: "TOKEN_PLAN_API_KEY",
  },
};

const cfg = PROVIDER_CONFIG[PROVIDER];
if (!cfg) { console.error(`unknown provider: ${PROVIDER}`); process.exit(1); }
const KEY = process.env[cfg.keyEnv];
if (!KEY) { console.error(`${cfg.keyEnv} env (or in .dev.vars) required`); process.exit(1); }

// 同 fill-bank-v4：build prompt composer + load content
const t1 = join(tmpdir(), `bdc1-${Date.now()}.mjs`);
await build({
  entryPoints: [join(PROJECT_ROOT, "functions/_promptComposer.ts")],
  bundle: true, format: "esm", platform: "node", outfile: t1, logLevel: "error",
});
const { composeQuestionUserPrompt, getSkillScope } = await import(t1);

const t2 = join(tmpdir(), `bdc2-${Date.now()}.mjs`);
await build({
  entryPoints: [join(PROJECT_ROOT, "functions/_prompts.generated.ts")],
  bundle: true, format: "esm", platform: "node", outfile: t2, logLevel: "error",
});
const { PROMPTS } = await import(t2);

const t3 = join(tmpdir(), `bdc3-${Date.now()}.mjs`);
await build({
  entryPoints: [join(PROJECT_ROOT, "scripts/_load-content-extended.ts")],
  bundle: true, format: "esm", platform: "node", outfile: t3, logLevel: "error",
});
const { validateQuestion, auditQuestion, SKILLS, UNITS } = await import(t3);
rmSync(t1, { force: true });
rmSync(t2, { force: true });
rmSync(t3, { force: true });

const skillDef = SKILLS.find(s => s.id === SKILL_ID);
if (!skillDef) { console.error(`unknown skill: ${SKILL_ID}`); process.exit(1); }
const unitDef = UNITS.find(u => u.id === skillDef.unitId);

const sysPrompt = PROMPTS.questionsSystem.replace(/\{\{subjectLabel\}\}/g, "数学");
const userPrompt = composeQuestionUserPrompt({
  subjectId: "math",
  unitId: skillDef.unitId,
  unitName: unitDef.name,
  skillId: SKILL_ID,
  skillName: skillDef.name,
  term: unitDef.term,
  difficulty: "2-4",
  count: COUNT,
  existingStems: [],
  batchAngle: "数字换一组",
  callerTag: "bench-direct",
});

console.error(`▶ 直连 ${PROVIDER} ${MODEL}, count=${COUNT}, skill=${SKILL_ID}`);
console.error(`▶ system ${sysPrompt.length} 字 + user ${userPrompt.length} 字 = ${sysPrompt.length + userPrompt.length} 字`);

const t0 = Date.now();
const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), 240_000);  // 4 分钟 budget
// 估算 max_tokens：每道题 ~600 token JSON, 留 buffer
const estMaxTokens = Math.min(16000, Math.max(2000, COUNT * 700 + 500));
const reqBody = {
  model: MODEL,
  messages: [
    { role: "system", content: sysPrompt },
    { role: "user", content: userPrompt },
  ],
  temperature: 0.7,
  max_tokens: estMaxTokens,
  response_format: { type: "json_object" },
};
console.error(`▶ max_tokens=${estMaxTokens}`);
// hybrid-thinking 模型默认 off，但 qwen3.x 系列要显式关
if (/^qwen3/i.test(MODEL)) reqBody.enable_thinking = false;
let r;
try {
  r = await fetch(`${cfg.baseUrl}/compatible-mode/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(reqBody),
    signal: ctrl.signal,
  });
} catch (e) {
  console.error(`▶ FETCH FAIL after ${Date.now() - t0}ms: ${e.message}`);
  process.exit(1);
} finally {
  clearTimeout(timer);
}
const dt = Date.now() - t0;
const txt = await r.text();
console.error(`▶ HTTP ${r.status} in ${dt}ms (${(dt / 1000).toFixed(1)}s)`);

if (!r.ok) {
  console.error(txt.slice(0, 500));
  process.exit(1);
}
const j = JSON.parse(txt);
const content = j.choices?.[0]?.message?.content ?? "";
console.error(`▶ 模型: ${j.model ?? "?"}, content ${content.length} 字`);
console.error(`▶ usage: prompt=${j.usage?.prompt_tokens} completion=${j.usage?.completion_tokens}`);

// 解析 JSON 内容
let parsed;
try { parsed = JSON.parse(content); } catch (e) {
  console.error(`▶ JSON parse fail: ${e.message}`);
  console.error(content.slice(0, 200));
  process.exit(1);
}
const questions = parsed.questions ?? [];
console.error(`▶ AI 出了 ${questions.length} 道题`);

// 跑同 fill-bank-v4 的 validate + audit
let valid = 0, vfail = 0, afail = 0;
for (const q of questions) {
  const v = validateQuestion(q);
  if (!v.ok) { vfail++; continue; }
  const a = auditQuestion(v.question);
  if (a.worstSeverity === "critical" || a.worstSeverity === "likely-broken") { afail++; continue; }
  valid++;
}

console.log(`\n══════ 结果 ══════`);
console.log(`skill=${SKILL_ID} count=${COUNT} dt=${(dt / 1000).toFixed(1)}s`);
console.log(`AI 给: ${questions.length}/${COUNT}`);
console.log(`validate 过: ${valid}, vfail ${vfail}, afail ${afail}`);
console.log(`token: prompt ${j.usage?.prompt_tokens}, completion ${j.usage?.completion_tokens}`);
console.log(`效率: ${(dt / 1000 / Math.max(1, valid)).toFixed(1)}s / 有效题`);
