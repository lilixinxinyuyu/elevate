/**
 * onboardingTrophy — v0.34.79 iter 13
 *
 * 爸爸反馈: "新登陆后填写完同学的基本信息后系统没有任何正反馈, 是不是应该
 * 获得第一步的纪念勋章才对?"
 *
 * iter 2 在 ProfileGate 完成 (7 项全填齐) 时 dispatch 了
 * `xiaojinapp:onboarding-completed` 事件 — 当时只显示了 🎉 overlay,
 * 没真颁发勋章. 这次 ep 兑现.
 *
 * 流程:
 *   1. installOnboardingTrophyListener() 在 main.tsx 装一次 (启动)
 *   2. 监听 window 'xiaojinapp:onboarding-completed' 事件
 *   3. 查 db.students[0] 拿当前 studentId; 没有 → 跳过 (理论上 ProfileGate 触发
 *      时 student 一定已 seeded)
 *   4. 查 db.trophies 看 profile_pioneer 是否已颁发过 — 已颁发 → 跳过 (幂等)
 *   5. 否则 db.trophies.put 写一条 + dispatch 'xiaojinapp:trophy-awarded' 让
 *      Layout 的 lottery queue 接 (Layout passiveTrophyCheck 下次跑会扫到)
 *
 * 防重: 用 trophy.trophyId 唯一查重 — db.trophies.where({trophyId:"profile_pioneer"}).
 */

import { db } from "../db/dexie";
import { uid } from "./format";

const EVENT_NAME = "xiaojinapp:onboarding-completed";
const TROPHY_ID = "profile_pioneer";

async function awardProfilePioneer(): Promise<void> {
  try {
    const students = await db.students.toArray();
    const student = students[0];
    if (!student) {
      console.warn("[onboardingTrophy] no student in db — skip profile_pioneer award");
      return;
    }
    const existing = await db.trophies
      .where({ studentId: student.id })
      .filter((t) => t.trophyId === TROPHY_ID)
      .first();
    if (existing) {
      console.log("[onboardingTrophy] profile_pioneer 已颁过, skip");
      return;
    }
    await db.trophies.put({
      id: uid("t-"),
      studentId: student.id,
      subjectId: "math",
      trophyId: TROPHY_ID,
      unlockedAt: Date.now(),
    });
    console.log(`[onboardingTrophy] ✓ profile_pioneer awarded to ${student.id}`);
    // 通知 Layout 弹 lottery box (Layout 监听这个事件 → 加 passiveLotteryQueue)
    try {
      window.dispatchEvent(
        new CustomEvent("xiaojinapp:trophy-awarded", {
          detail: { trophyId: TROPHY_ID, studentId: student.id },
        }),
      );
    } catch { /* */ }
  } catch (e) {
    console.warn("[onboardingTrophy] award failed:", (e as Error).message);
  }
}

export function installOnboardingTrophyListener(): void {
  if (typeof window === "undefined") return;
  window.addEventListener(EVENT_NAME, () => {
    void awardProfilePioneer();
  });
}
