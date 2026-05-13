/**
 * v0.31.103：中英文字词每日精细 log。
 *
 * 老 dailyTarget.ts 只存"今日总次数"（todayCount）—— 不知道是哪几个字 / 哪几个词
 * 对几个错几个。主页 daily summary 想精确说"今天练 8 字（7 对 1 错）"或"小进帮讲
 * 3 道"就需要明细。
 *
 * Schema:
 *   db.meta key: `daily_log::<dateKey>::<subjectId>::<studentId>`
 *   value: { right: number, wrong: number, items: string[] }  // items 是字/词列表
 *
 * 跟 dailyTarget.ts 平行——dailyTarget 仍管"目标/streak"，dailyLog 管"具体明细"。
 * 每次答题时**同时**写两边。
 *
 * dateKey 用 YYYY-MM-DD（local time），明天 0:00 自动换 key，老的留作历史。
 */

import { db } from "../db/dexie";
import { schedulePushToCloud } from "../db/cloudSync";

export interface DailyLogEntry {
  /** 今日答对次数（同一字答多次也算多次） */
  right: number;
  /** 今日答错次数 */
  wrong: number;
  /** 今日**练过的不同字/词**列表（去重，max 200 防爆 db.meta） */
  items: string[];
  /**
   * v0.32.10：今日**答错过的不同字/词**列表（去重，max 50）。
   * 给快报卡列"今日错字/错词"用 — 老师辅导抓手。
   * 老数据没此字段 — 读取时 fallback `[]`。
   */
  wrongItems?: string[];
}

function todayDateStr(now: number = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function key(subjectId: string, studentId: string, dateStr?: string): string {
  return `daily_log::${dateStr ?? todayDateStr()}::${subjectId}::${studentId}`;
}

export async function loadDailyLog(
  subjectId: string,
  studentId: string,
  dateStr?: string,
): Promise<DailyLogEntry> {
  const row = await db.meta.get(key(subjectId, studentId, dateStr));
  const raw = row?.value as DailyLogEntry | undefined;
  if (!raw) return { right: 0, wrong: 0, items: [], wrongItems: [] };
  // v0.32.10：老数据 fallback wrongItems
  return { wrongItems: [], ...raw };
}

/** 记一次答题（一个字/词，对错） */
export async function recordDailyActivity(
  subjectId: string,
  studentId: string,
  item: string,
  isCorrect: boolean,
): Promise<void> {
  const cur = await loadDailyLog(subjectId, studentId);
  const curWrong = cur.wrongItems ?? [];
  const next: DailyLogEntry = {
    right: cur.right + (isCorrect ? 1 : 0),
    wrong: cur.wrong + (isCorrect ? 0 : 1),
    items: cur.items.includes(item)
      ? cur.items
      : [...cur.items.slice(-199), item], // 上限 200
    // v0.32.10：只在答错时加进 wrongItems（去重 + 上限 50）
    wrongItems: isCorrect
      ? curWrong
      : curWrong.includes(item)
        ? curWrong
        : [...curWrong.slice(-49), item],
  };
  await db.meta.put({ key: key(subjectId, studentId), value: next });
  // v0.32.15：daily_log 也走 schedulePushToCloud，跟 vocab/char 进度一致
  //   原来只有 recordVocabAttempt 顺带推；中文/数学场景就漏了
  schedulePushToCloud();
}
