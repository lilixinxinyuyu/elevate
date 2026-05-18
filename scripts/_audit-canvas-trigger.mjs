import { build } from "esbuild";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
process.chdir(ROOT);

const TMPq = resolve(tmpdir(), `q-${Date.now()}.mjs`);
const TMPr = resolve(tmpdir(), `r-${Date.now()}.mjs`);

await build({ entryPoints: [resolve(ROOT, "src/content/questions.ts")], bundle: true, format: "esm", platform: "node", outfile: TMPq, target: "es2022", loader: { ".json": "json" }, logLevel: "error" });
await build({ entryPoints: [resolve(ROOT, "src/components/game/templates/resolve.ts")], bundle: true, format: "esm", platform: "node", outfile: TMPr, target: "es2022", loader: { ".json": "json" }, logLevel: "error" });

const { SEED_QUESTIONS } = await import(TMPq);
const { resolveTemplate } = await import(TMPr);

// Count metadata vs heuristic templates
let backfilledCount = 0, scratchTrueCount = 0, multistepTrueCount = 0;
const templateDist = {};
const canvasExamples = [];
for (const q of SEED_QUESTIONS) {
  if (q.requiresScratch !== undefined || q.requiresMultiStep !== undefined) backfilledCount++;
  if (q.requiresScratch === true) scratchTrueCount++;
  if (q.requiresMultiStep === true) multistepTrueCount++;
  const t = resolveTemplate(q);
  templateDist[t] = (templateDist[t] ?? 0) + 1;
  if (t === "canvas_scratch" && canvasExamples.length < 3) {
    canvasExamples.push({
      id: q.question_id,
      stem: q.stem.slice(0, 80),
      diff: q.difficulty,
      reqScratch: q.requiresScratch,
      reqMultiStep: q.requiresMultiStep,
      speedEligible: q.speedEligible,
      play_as: q.play_as,
      answerType: q.answer?.type,
    });
  }
}
console.log(`Total: ${SEED_QUESTIONS.length}`);
console.log(`Backfilled metadata: ${backfilledCount} (${((backfilledCount / SEED_QUESTIONS.length) * 100).toFixed(1)}%)`);
console.log(`requiresScratch=true: ${scratchTrueCount} (${((scratchTrueCount / SEED_QUESTIONS.length) * 100).toFixed(1)}%)`);
console.log(`requiresMultiStep=true: ${multistepTrueCount} (${((multistepTrueCount / SEED_QUESTIONS.length) * 100).toFixed(1)}%)`);
console.log("\nResolve template distribution:");
for (const [k, v] of Object.entries(templateDist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(30)} ${String(v).padStart(4)} (${((v / SEED_QUESTIONS.length) * 100).toFixed(1)}%)`);
}
console.log("\nSample canvas_scratch questions:");
console.log(JSON.stringify(canvasExamples, null, 2));
