/**
 * v0.31.108: Dev / 站长用的一次性数据清理 helper。
 *
 * 用法（生产 PWA console 里）：
 *   await __selenaDev.clearTodayEnglish()
 *   // → 清本地 db.meta 里今日的 english 3 环 daily + dailyLog
 *   // → 立即 pushToCloud() 把新 snapshot 推到 D1（覆盖远程"已练"）
 *   // → Selena 那台设备硬刷 PWA 时会 pull 新 snapshot，看到的就是干净的今日
 *
 * 不要做成 admin UI 按钮（爸爸明确说过：一次性任务走 console / 临时脚本）。
 *
 * 远程是 IndexedDB 全量 snapshot 模式（functions/api/sync/upload.ts INSERT 一行
 * 完整 payload），所以"清远程" = 本地清完后 push 一份新 snapshot 覆盖。
 */

import { db } from "../db/dexie";
import { pushToCloud } from "../db/cloudSync";

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface ClearResult {
  clearedKeys: string[];
  pushed: boolean;
  pushError?: string;
  studentId?: string;
  today: string;
}

/**
 * 清今日英语测试数据（3 环 + dailyLog）。
 *
 * 注意：不动 english_vocab_progress（那是累计掌握度，不是"今日"）。
 * 也不动 attempts / 词汇 mastery — 只清 daily counters。
 */
export async function clearTodayEnglish(): Promise<ClearResult> {
  const today = todayDateStr();
  const ss = await db.students.toArray();
  const sid = ss[0]?.id;
  if (!sid) {
    return { clearedKeys: [], pushed: false, today };
  }

  const candidateKeys = [
    `daily_english_vocab_${sid}`,
    `daily_english_speak_${sid}`,
    `daily_english_sentences_${sid}`,
    `daily_log::${today}::english::${sid}`,
  ];

  const clearedKeys: string[] = [];
  for (const key of candidateKeys) {
    const existed = await db.meta.get(key);
    if (existed) {
      await db.meta.delete(key);
      clearedKeys.push(key);
    }
  }

  let pushed = false;
  let pushError: string | undefined;
  try {
    // skipPrePull=true：不要先 pull，否则远程的 daily_english_* key 会被
    // applyPayloadMerged 的 `if (!local) put(r)` 分支拉回本地，等于没清。
    const r = await pushToCloud({ skipPrePull: true });
    pushed = r.ok;
    if (!r.ok) pushError = r.error ?? "push_failed_unknown";
  } catch (e) {
    pushError = e instanceof Error ? e.message : String(e);
  }

  console.log(
    `[clearTodayEnglish] sid=${sid} today=${today} cleared=${clearedKeys.length} pushed=${pushed}`,
    { clearedKeys, pushError },
  );

  return { clearedKeys, pushed, pushError, studentId: sid, today };
}

/**
 * 把 dev helpers 挂到 window，方便站长在 prod console 调。
 * main.tsx 启动时调一次。
 */
export function installDevHelpers(): void {
  if (typeof window === "undefined") return;
  type DevHelpers = { clearTodayEnglish: typeof clearTodayEnglish };
  (window as unknown as { __selenaDev?: DevHelpers }).__selenaDev = {
    clearTodayEnglish,
  };
}
