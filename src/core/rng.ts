/**
 * v0.36.59 — 统一选题重构 Phase 4 (Option B, 保守版): 跨学科 **纯 RNG 原语** 抽取。
 *
 * 经 Gemini-3.1-pro(8787) + GPT-5.5(8788) 双 peer review 一致选 **Option B**:
 * 不建"选题 core + adapter"那套抽象 (Option C) — 数学 batch planner 跟语文 streaming
 * 选题形状/难度模型/语义本就不同, 为 3 个学科硬塞 adapter 是过度设计、回归风险大、收益低;
 * 也不是完全不动 (Option A) — 而是只抽 **真·纯函数、零风险、各处逐字重复** 的几个原语
 * (seeded RNG / hash / Fisher-Yates shuffle), 各学科的 recency 去重 / SRS 插入 / 难度选择 /
 * diversify / 连对连错 等业务逻辑全部留在本学科本地。
 *
 * 本文件就是那个共享落点。算法逐字搬自原 canonical 实现 (scheduler.ts 的 FNV+LCG、
 * practiceSelect.ts 的 Fisher-Yates), 行为完全一致 → 既有确定性输出不变。
 *
 * ⚠️ 注意: 仓库里还散着 8+ 处 game-template 自带的 `shuffleSeeded(arr, seedString)`
 * (签名不同, 内部 hash) 和若干 `arr.sort(() => Math.random()-0.5)` (有偏 shuffle)。
 * 那些属于更大、有回归风险的渐进清理, 不在本次保守抽取范围内 — 谁路过谁顺手换。
 */

/** FNV-1a 32-bit 字符串哈希 → uint32 种子。 */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** LCG (Numerical Recipes 常量) → [0,1) 确定性伪随机流。 */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Fisher-Yates 均匀洗牌 (不就地改, 返回新数组)。rng 注入 → 可确定。 */
export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i]!, out[j]!] = [out[j]!, out[i]!];
  }
  return out;
}
