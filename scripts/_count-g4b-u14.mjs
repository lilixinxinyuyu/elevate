import { build } from "esbuild";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync, writeFileSync } from "node:fs";

const tmpFile = join(tmpdir(), `count-${Date.now()}.mjs`);
await build({
  entryPoints: ["scripts/_load-content.ts"],
  bundle: true, format: "esm", platform: "node",
  outfile: tmpFile, logLevel: "error",
});
const mod = await import(tmpFile);
rmSync(tmpFile, { force: true });
const { SEED_QUESTIONS, SKILLS, UNITS } = mod;

// G4B U1-U4 only (期中范围)
const G4B_U14 = new Set(
  UNITS.filter(u => u.term === "下册" && u.orderIndex <= 4).map(u => u.id)
);
const u14Skills = SKILLS.filter(s => G4B_U14.has(s.unitId));

const counts = {};
for (const s of u14Skills) {
  counts[s.id] = {
    name: s.name,
    unitId: s.unitId,
    examPriority: s.examPriority,
    total: 0,
    byDiff: {1:0,2:0,3:0,4:0,5:0},
  };
}

for (const q of SEED_QUESTIONS) {
  if (!q.skill_id || !counts[q.skill_id]) continue;
  counts[q.skill_id].total++;
  const d = Number(q.difficulty) || 0;
  counts[q.skill_id].byDiff[d] = (counts[q.skill_id].byDiff[d] || 0) + 1;
}

// 必考 vs 一般：MUST_BIG / MUST_SMALL / VERY_HIGH_SMALL = 必考（target 30+）；其他 = 一般 (target 20+)
const isMustExam = (p) => p === "MUST_BIG" || p === "MUST_SMALL" || p === "VERY_HIGH_SMALL" || p === "HIGH_BIG" || p === "HIGH_SMALL";

const results = [];
console.log("G4B U1-U4 题量盘点（按 examPriority 分目标：必考 30+ / 一般 20+）");
console.log("=".repeat(120));
for (const [sid, c] of Object.entries(counts)) {
  const isMust = isMustExam(c.examPriority);
  const target = isMust ? 30 : 20;
  const gap = Math.max(0, target - c.total);
  const flag = c.total >= target ? "✅" : c.total >= target * 0.7 ? "⚠️ " : "❌ ";
  const tag = isMust ? "[必考]" : "[一般]";
  console.log(`${flag}${tag} ${sid.padEnd(34)} | ${c.unitId.replace("G4B_","").slice(0,4).padEnd(4)} | ${c.examPriority.padEnd(10)} | ${String(c.total).padStart(3)}/${target} | D ${c.byDiff[1]||0}/${c.byDiff[2]||0}/${c.byDiff[3]||0}/${c.byDiff[4]||0}/${c.byDiff[5]||0} | gap -${gap}`);
  results.push({
    skillId: sid,
    skillName: c.name,
    unitId: c.unitId,
    examPriority: c.examPriority,
    total: c.total,
    byDiff: c.byDiff,
    target,
    gap,
    isMust,
  });
}
console.log("=".repeat(120));
const totalGap = results.reduce((s, r) => s + r.gap, 0);
const skillsNeedingFill = results.filter(r => r.gap > 0).length;
console.log(`总缺口：${totalGap} 道（${skillsNeedingFill} 个 skill 需补充）`);
console.log(`其中必考 skill 缺口：${results.filter(r => r.isMust && r.gap > 0).reduce((s,r)=>s+r.gap,0)} 道`);

writeFileSync("/tmp/g4b-u14-inventory.json", JSON.stringify({
  totalGap, skillsNeedingFill, perSkill: results,
}, null, 2));
console.log("\n→ /tmp/g4b-u14-inventory.json 已写");
