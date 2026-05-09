#!/usr/bin/env node
/**
 * 对比 count=10/20/30 的实际效率：
 *   - 单次 wallclock
 *   - 实际返回道数（部分 model 给少于请求数）
 *   - 校验通过率（只用 isValidQuestionShape，因为 server 已经过 zod）
 *
 * 用法：APP_PASSWORD=... node scripts/_bench-batch-size.mjs [skillId]
 *
 * 跑 3 个 skill × 3 个 count，让 token-plan 不要打挤一个 skill。
 */
const PWD = process.env.APP_PASSWORD;
if (!PWD) { console.error("APP_PASSWORD env required"); process.exit(1); }

const PROD = "https://selena-elevate.pages.dev";
const auth = `Bearer ${PWD}`;

// 选 3 个不同特性的 skill 测：plain_choice / balance_lab / word_problem_lab
const SKILLS = [
  { id: "large_compare", unitId: "G4A_U1_LARGE_NUMBERS", name: "大数比较大小", term: "上册" },
  { id: "decimal_compare", unitId: "G4B_U1_DECIMAL_ADD_SUB", name: "小数大小比较", term: "下册" },
  { id: "int_mul_3_by_2", unitId: "G4A_U3_MULTIPLICATION", name: "三位数乘两位数笔算", term: "上册" },
];
const COUNTS = [10, 20, 30];

async function genN(skill, n) {
  const t0 = Date.now();
  const r = await fetch(`${PROD}/api/generate/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({
      subjectId: "math",
      unitId: skill.unitId, unitName: skill.name,
      skillId: skill.id, skillName: skill.name,
      count: n,
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
    return { ok: false, http: r.status, dt, n_returned: 0, detail: detail.slice(0, 100) };
  }
  let body;
  try { body = JSON.parse(txt); } catch { return { ok: false, http: r.status, dt, parse: "fail" }; }
  return {
    ok: body.ok,
    http: r.status,
    dt,
    requested: n,
    n_returned: body.questions?.length ?? 0,
    model: body.model ?? "?",
    provider: body.provider ?? "?",
  };
}

const results = [];
for (const sk of SKILLS) {
  for (const n of COUNTS) {
    process.stderr.write(`▶ ${sk.id} count=${n} … `);
    const r = await genN(sk, n);
    process.stderr.write(`[${r.dt}ms] ok=${r.ok} got=${r.n_returned}/${n} ${r.detail ?? r.provider + "/" + r.model}\n`);
    results.push({ skill: sk.id, count: n, ...r });
    await new Promise(res => setTimeout(res, 1500)); // 不要打挤
  }
}

console.log("\n══════ 汇总 ══════");
console.log("skill\t\tcount\tdt(s)\treturned\tdt/题\tnotes");
for (const r of results) {
  const dtPerItem = r.n_returned > 0 ? (r.dt / r.n_returned / 1000).toFixed(1) : "-";
  const sn = r.skill.padEnd(20, " ");
  console.log(`${sn}\t${r.count}\t${(r.dt / 1000).toFixed(1)}\t${r.n_returned}\t\t${dtPerItem}\t${r.detail ?? r.provider + "/" + r.model ?? ""}`);
}
