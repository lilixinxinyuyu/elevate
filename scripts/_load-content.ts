/**
 * 给 build-agent-data.mjs 用的中转：把 src/content/* 的 TS 模块用 esbuild bundle 到一个 .mjs，
 * 再 dynamic import 取出 SEED_QUESTIONS / SKILLS / UNITS。
 */

export { SEED_QUESTIONS } from "../src/content/questions";
export { SKILLS } from "../src/content/skills";
export { UNITS } from "../src/content/units";
