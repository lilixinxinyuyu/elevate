/**
 * v0.36.44 — Cluster "实时生成" / cover-fire 补题 helper.
 *
 * cluster 短游戏循环 (一道接一道, 没有"交卷") 跑到 starved (题库见底 / 难度档缺题,
 * 见 clusterSelect.pickNextClusterIndex 返回的 starved 信号) 时, 后台 fire-and-forget
 * 调 AI 出几道新题塞进 db.questions, 让 cluster 页随后 reload 折进去 — 全程不阻塞玩家
 * (玩家继续做一道已有题, "cover fire" 掩护生成).
 *
 * 设计:
 *  - 复用 lib/tutor.generateAiQuestions (走 FC, ~10-15s). 但**保存到 db 的是调用方**
 *    (跟 lib/bgGen.ts 一致: tutor 只负责 fetch, 不写库), 所以这里做 client 端校验 +
 *    bulkPut, 题型/学期/skill 元数据由 args 透传, 后端按 gameType 强制出对应玩法.
 *  - 模块级 in-flight guard (Set, key = gameType+difficulty): 同一档生成进行中时
 *    重复触发直接跳过 (cluster advanceToNext 每题都可能 starved, 不能每题都打一发).
 *    注意: tutor 内部也有 (subjectId::skillId::count) 级 dedup, 这里是 cluster 语义上
 *    "同题型同难度档只跑一个" 的更粗粒度闸.
 *  - **绝不 throw**: 这是 best-effort 后台补给, 失败就返回 0, 让玩家无感知地继续.
 */

import { db } from "../db/dexie";
import { generateAiQuestions } from "./tutor";

/**
 * 客户端轻量校验: 拦截垃圾题入库 (跟 lib/bgGen.ts isValidQuestionRow 同款双保险).
 * 网络中间环节可能 mangle JSON, server 已校验但这里再拦一道.
 *
 * v0.36.45: cluster 互动玩法 (poem_cloze / sentence_shuffle) 的答案藏在 game_data,
 * options 是空的 —— 老逻辑 (options.length >= 2) 会误杀这些题, 让 C1/C3 的 cover-fire
 * 落不了库. 凡带已知 interactive kind 的 game_data 行, 改成校验 game_data 本身,
 * 不再强求 options. 不带 game_data 的纯选择题 (plain_choice) 仍走 options/answer 老校验.
 */
function isValidGameData(o: Record<string, unknown>): boolean {
  const gd = o.game_data;
  if (!gd || typeof gd !== "object") return false;
  const g = gd as Record<string, unknown>;
  switch (g.kind) {
    case "poem_cloze":
      // 模板 (非空 string) + blanks (非空数组) + pool (数组)
      return (
        typeof g.template === "string" &&
        g.template.trim().length > 0 &&
        Array.isArray(g.blanks) &&
        g.blanks.length > 0 &&
        Array.isArray(g.pool)
      );
    case "sentence_shuffle":
      // tokens (数组, >= 2 个词块)
      return Array.isArray(g.tokens) && g.tokens.length >= 2;
    default:
      // glyph_detective / pair_match 等仍由调用方走 options/answer 老校验, 这里不接管
      return false;
  }
}

function isValidQuestionRow(q: unknown): boolean {
  if (!q || typeof q !== "object") return false;
  const o = q as Record<string, unknown>;
  if (typeof o.question_id !== "string" || !o.question_id.trim()) return false;
  if (typeof o.stem !== "string" || !o.stem.trim()) return false;
  // game_data 互动题 (答案在 game_data, options 可空): 校验 game_data, 不要求 options.
  const gd = o.game_data as { kind?: string } | undefined;
  if (gd && (gd.kind === "poem_cloze" || gd.kind === "sentence_shuffle")) {
    return isValidGameData(o);
  }
  // glyph_detective / pair_match / plain_choice: 沿用 options[>=2] + answer 老校验.
  if (!Array.isArray(o.options) || o.options.length < 2) return false;
  if (!o.answer || typeof o.answer !== "object") return false;
  const ans = o.answer as { type?: string; value?: unknown };
  if (ans.type === "choice") {
    const optIds = (o.options as Array<{ id?: string }>)
      .map((x) => x?.id)
      .filter((x): x is string => typeof x === "string");
    if (typeof ans.value !== "string" || !optIds.includes(ans.value)) return false;
  }
  return true;
}

/** 进行中的 cluster 生成 (粗粒度: 同 gameType + 同难度档只跑一个). */
const inflightClusterGens = new Set<string>();

export interface GenerateClusterQuestionsOpts {
  subjectId?: "chinese";
  /** 强制 AI 出某种玩法 (后端 pickGameTypeEsa 读它), 例 "glyph_detective". */
  gameType: string;
  skillId: string;
  skillName?: string;
  unitId: string;
  term?: "上册" | "下册";
  /** 目标难度 1-5 (来自 pickNextClusterIndex 的 targetDifficulty). */
  difficulty: number;
  /** 默认 3 (cluster 补给少量即可, 不是批量灌库). */
  count?: number;
}

/**
 * cluster 后台补题: 调 AI 出 count 道指定 gameType/难度的题并写入 db.questions,
 * 返回成功落库的题数 (失败 / 校验全挂 → 0). **永不 throw**.
 */
export async function generateClusterQuestions(
  opts: GenerateClusterQuestionsOpts,
): Promise<number> {
  const subjectId = opts.subjectId ?? "chinese";
  const count = opts.count ?? 3;
  const guardKey = `${opts.gameType}::${opts.difficulty}`;
  // in-flight guard: 同题型同难度档已在跑 → 跳过 (cover-fire 不重复打)
  if (inflightClusterGens.has(guardKey)) return 0;
  inflightClusterGens.add(guardKey);
  try {
    const r = await generateAiQuestions({
      subjectId,
      unitId: opts.unitId,
      skillId: opts.skillId,
      skillName: opts.skillName,
      count,
      difficulty: String(opts.difficulty),
      term: opts.term,
      gameType: opts.gameType,
    });
    if (!Array.isArray(r.questions) || r.questions.length === 0) return 0;
    // 跟 bgGen 一致: 打 subjectId + 客户端校验 + bulkPut (tutor 不写库).
    const validated = r.questions
      .map((q) => ({ ...q, subjectId }))
      .filter(isValidQuestionRow);
    if (validated.length === 0) return 0;
    await db.questions.bulkPut(validated as never);
    return validated.length;
  } catch (e) {
    // best-effort 后台补给: 吞掉错误, 玩家无感知继续
    console.warn("[clusterGen] 后台补题失败 (best-effort, 已忽略)", e);
    return 0;
  } finally {
    inflightClusterGens.delete(guardKey);
  }
}
