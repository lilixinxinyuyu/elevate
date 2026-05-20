/**
 * v0.36.29 (爸爸: chinese cluster 完整化 — 接 XP): 统一 cluster XP 奖励.
 *
 * cluster 游戏 (preview, 不走 train submitAttempt) 玩对题时调这个, 加分到:
 *   1. 当前学科总 XP (db.meta totalXp::<subject>::<id>) — Selena 主进度
 *   2. mascot 小进成长 XP (跟小进一起玩成长)
 *
 * 7 个 cluster (古诗灯笼/字形侦探/病句龙训/修辞画卷/仿写画师/阅读图书馆/自由作文)
 * 都调 awardClusterXp, 让游戏分数连进总 XP — 游戏"算数"了.
 */
import { db } from "../db/dexie";
import { addBonusXp } from "../db/service";
import { awardMascotXp } from "./mascotProgress";

/** 每答对一题加的 XP (cluster 比 train 略低, 因为是练习游戏) */
export const CLUSTER_XP_PER_CORRECT = 8;

export interface ClusterXpResult {
  xpAdded: number;
  totalXp: number;
}

/**
 * cluster 答对题加 XP. 自动找 studentId (db.students[0]).
 * @param correctCount 这次答对几题 (默认 1)
 * @returns 加了多少 XP + 新总 XP; 没 student 返 null
 */
export async function awardClusterXp(correctCount = 1): Promise<ClusterXpResult | null> {
  if (correctCount <= 0) return null;
  try {
    const students = await db.students.toArray();
    const sid = students[0]?.id;
    if (!sid) return null;
    const xpAdded = correctCount * CLUSTER_XP_PER_CORRECT;
    const totalXp = await addBonusXp(sid, xpAdded);
    // mascot 跟着成长一点 (玩游戏 = 跟小进互动). 节流交给 awardMascotXp.
    void awardMascotXp(sid, "session_complete").catch(() => { /* noop */ });
    return { xpAdded, totalXp };
  } catch {
    return null;
  }
}
