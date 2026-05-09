import { build } from "esbuild";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const tmpFile = join(tmpdir(), `dbg-${Date.now()}.mjs`);
await build({
  entryPoints: ["scripts/_load-content-extended.ts"],
  bundle: true, format: "esm", platform: "node", outfile: tmpFile, logLevel: "error",
});
const { validateQuestion, SKILLS, UNITS } = await import(tmpFile);
rmSync(tmpFile, { force: true });
const skill = SKILLS.find(s => s.id === "large_compare");
const unit = UNITS.find(u => u.id === skill.unitId);
console.error("Skill:", skill.name, "Unit:", unit.name, "Term:", unit.term);
const r = await fetch("https://selena-elevate.pages.dev/api/generate/questions", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Bearer selena-2026" },
  body: JSON.stringify({
    subjectId: "math", unitId: unit.id, unitName: unit.name,
    skillId: skill.id, skillName: skill.name, count: 1, difficulty: "2-3",
    term: unit.term, existingStems: [],
  }),
});
const j = await r.json();
console.log("API response:", JSON.stringify(j, null, 2).slice(0, 2000));
if (j.questions?.[0]) {
  const v = validateQuestion(j.questions[0]);
  console.log("\nVALIDATE:", JSON.stringify(v, null, 2));
}
