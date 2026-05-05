import { build } from "esbuild";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
const tmpFile = join(tmpdir(), `count-g4b-${Date.now()}.mjs`);
await build({
  entryPoints: ["scripts/_load-content.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: tmpFile,
  logLevel: "error",
});
const mod = await import(tmpFile);
rmSync(tmpFile, { force: true });
const { SEED_QUESTIONS, SKILLS, UNITS } = mod;

const G4B_UNITS = new Set(UNITS.filter(u => u.term === "下册").map(u => u.id));
const g4bSkills = SKILLS.filter(s => G4B_UNITS.has(s.unitId));

const counts = {};
const diffByCount = {};
for (const s of g4bSkills) counts[s.id] = { total: 0, byDiff: {1:0,2:0,3:0,4:0,5:0}, byGameType: {} };

for (const q of SEED_QUESTIONS) {
  if (!q.skill_id || !counts[q.skill_id]) continue;
  counts[q.skill_id].total++;
  const d = Number(q.difficulty) || 0;
  counts[q.skill_id].byDiff[d] = (counts[q.skill_id].byDiff[d] || 0) + 1;
  const gt = q.game_type || "?";
  counts[q.skill_id].byGameType[gt] = (counts[q.skill_id].byGameType[gt] || 0) + 1;
}

console.log(`G4B 共 ${g4bSkills.length} 个技能。每行：技能 | 总数 | 难度 1/2/3/4/5 | 缺额到20`);
console.log("=".repeat(110));
let totalGap = 0;
for (const s of g4bSkills) {
  const c = counts[s.id];
  const gap = Math.max(0, 20 - c.total);
  if (gap > 0) totalGap += gap;
  const d = c.byDiff;
  const gt = Object.entries(c.byGameType).map(([k,v]) => `${k}:${v}`).join(",");
  const flag = c.total < 20 ? "❌" : c.total < 25 ? "⚠️" : "✅";
  console.log(`${flag} ${s.id.padEnd(32)} | ${String(c.total).padStart(3)} | ${d[1]||0}/${d[2]||0}/${d[3]||0}/${d[4]||0}/${d[5]||0} | -${gap.toString().padStart(2)} | ${gt}`);
}
console.log("=".repeat(110));
console.log(`总缺额（每技能补到 20）：${totalGap} 题`);

// 按难度分布看现状（只统计 G4B）
const overall = {1:0,2:0,3:0,4:0,5:0};
for (const id in counts) {
  for (const d in counts[id].byDiff) {
    overall[d] += counts[id].byDiff[d];
  }
}
console.log(`G4B 总题数：${Object.values(overall).reduce((a,b)=>a+b,0)}（难度 1=${overall[1]}, 2=${overall[2]}, 3=${overall[3]}, 4=${overall[4]}, 5=${overall[5]}）`);

// 输出 JSON 给后续脚本用
import { writeFileSync } from "node:fs";
const out = {
  totalGap,
  perSkill: g4bSkills.map(s => ({
    skillId: s.id,
    skillName: s.name,
    unitId: s.unitId,
    abilities: s.ability,
    difficultyBase: s.difficultyBase,
    examPriority: s.examPriority,
    current: counts[s.id].total,
    byDiff: counts[s.id].byDiff,
    byGameType: counts[s.id].byGameType,
    gap: Math.max(0, 20 - counts[s.id].total),
  })),
};
writeFileSync("/tmp/g4b-inventory.json", JSON.stringify(out, null, 2));
console.log("\n→ 写到 /tmp/g4b-inventory.json");
