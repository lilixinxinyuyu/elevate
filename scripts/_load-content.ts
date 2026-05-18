/**
 * 给 build-agent-data.mjs 用的中转：把 src/content/* 的 TS 模块用 esbuild bundle 到一个 .mjs，
 * 再 dynamic import 取出 SEED_QUESTIONS / SKILLS / UNITS。
 */

export { SEED_QUESTIONS } from "../src/content/questions";
export { SKILLS } from "../src/content/skills";
export { UNITS } from "../src/content/units";
// v0.35.44: 给 scripts/check-content-schema.mjs 用 (避免 regex parse types.ts)
export { GAME_TEMPLATE_IDS } from "../src/core/types";
