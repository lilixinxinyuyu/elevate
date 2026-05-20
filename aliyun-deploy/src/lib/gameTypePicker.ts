/**
 * 按权重从 skill 的 game_type 池里抽一个（v0.31.86 起）。
 *
 * mapping 格式（兼容两种）：
 *   - 旧：单字符串  "speed_match"
 *   - 新：数组    [{ type: "speed_match", weight: 3 }, { type: "plain_choice", weight: 1 }]
 *
 * 没列出的 skill → fallback "plain_choice"。
 *
 * 这个 helper 让一个 skill 的题目分布到多种玩法，避免 plain_choice 占 78% 的失衡。
 */

import { PROMPTS } from "../generated/_prompts.generated";

export type GameTypeEntry =
  | string
  | { type: string; weight?: number };

function getMapping(skillId: string): GameTypeEntry | GameTypeEntry[] | undefined {
  const all = PROMPTS.gameTypeBySkill as unknown as Record<string, unknown>;
  if (!all) return undefined;
  return all[skillId] as GameTypeEntry | GameTypeEntry[] | undefined;
}

/**
 * 按权重抽 — 给 fill-bank / 出题 endpoint 用，每次调用得到的 game_type 可能不同。
 *
 * @param skillId 当前 skill
 * @param rand 注入的随机源，方便测试；默认 Math.random
 */
export function pickGameType(
  skillId: string,
  rand: () => number = Math.random,
): string {
  const m = getMapping(skillId);
  if (!m) return "plain_choice";
  if (typeof m === "string") return m;
  if (!Array.isArray(m) || m.length === 0) return "plain_choice";

  const total = m.reduce((s: number, e) => {
    const w = typeof e === "object" && typeof e.weight === "number" ? e.weight : 1;
    return s + w;
  }, 0);
  if (total <= 0) return "plain_choice";

  let r = rand() * total;
  for (const e of m) {
    const w = typeof e === "object" && typeof e.weight === "number" ? e.weight : 1;
    r -= w;
    if (r <= 0) {
      return typeof e === "string" ? e : e.type;
    }
  }
  // 浮点尾巴 — 保底返回最后一个
  const last = m[m.length - 1]!;
  return typeof last === "string" ? last : last.type;
}

/**
 * 列举该 skill 所有候选 game_type — 给 audit / 调试用。
 */
export function listGameTypes(skillId: string): string[] {
  const m = getMapping(skillId);
  if (!m) return ["plain_choice"];
  if (typeof m === "string") return [m];
  if (!Array.isArray(m)) return ["plain_choice"];
  return m.map((e) => (typeof e === "string" ? e : e.type));
}
