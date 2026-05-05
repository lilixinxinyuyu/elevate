/**
 * 给 regenerate-trophies.mjs 用的中转：esbuild 把 trophyImages.ts 打包成 mjs，
 * dynamic import 取出 buildTrophyPrompt + getAllTrophyMeta。
 */

export { buildTrophyPrompt } from "../src/lib/trophyImages";
export { getAllTrophyMeta } from "../src/lib/allTrophies";
