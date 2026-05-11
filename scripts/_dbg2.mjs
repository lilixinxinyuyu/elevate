import { build } from "esbuild";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT = "/Users/yong/Desktop/xy/heping-math-trainer";

const t2 = join(tmpdir(), `dbg2-gp-${Date.now()}.mjs`);
await build({ entryPoints: [join(PROJECT, "functions/_gameTypePicker.ts")], bundle: true, format: "esm", platform: "node", outfile: t2 });
const { pickGameType } = await import(t2);

// Run pickGameType 20 times for each problematic skill
for (const skillId of ["letter_expression", "triangle_classification", "decimal_compare"]) {
  const counts = {};
  for (let i = 0; i < 100; i++) {
    const g = pickGameType(skillId);
    counts[g] = (counts[g] || 0) + 1;
  }
  console.log(`${skillId}:`, counts);
}
