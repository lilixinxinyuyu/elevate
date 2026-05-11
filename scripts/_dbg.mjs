import { build } from "esbuild";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT = "/Users/yong/Desktop/xy/heping-math-trainer";

const t1 = join(tmpdir(), `dbg-pc-${Date.now()}.mjs`);
await build({ entryPoints: [join(PROJECT, "functions/_promptComposer.ts")], bundle: true, format: "esm", platform: "node", outfile: t1 });
const { composeQuestionUserPrompt } = await import(t1);

const t2 = join(tmpdir(), `dbg-gp-${Date.now()}.mjs`);
await build({ entryPoints: [join(PROJECT, "functions/_gameTypePicker.ts")], bundle: true, format: "esm", platform: "node", outfile: t2 });
const { pickGameType } = await import(t2);

// Test: simulate fill-bank for letter_expression
const skillId = "letter_expression";
const gameType = pickGameType(skillId);
console.log("pickGameType returned:", JSON.stringify(gameType), "type:", typeof gameType);

// Now call composer with that
const prompt = composeQuestionUserPrompt({
  subjectId: "math",
  unitId: "G4B_U5_EQUATIONS",
  skillId,
  term: "下册",
  difficulty: 3,
  count: 2,
  gameType,
  prefilledFields: { grade: 4, status: "approved" },
});

// Print lines containing game_type or play_as
const lines = prompt.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("game_type") || lines[i].includes("play_as")) {
    console.log(`L${i}:`, lines[i]);
  }
}
