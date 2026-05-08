/**
 * 语文写字表 250 字 - 进度跟踪 + 历史数据迁移 (v0.31.39)
 *
 * 数据存储：
 *   db.meta.key = `chinese_char_progress::<studentId>` → Record<char, CharStat>
 *   db.meta.key = `chinese_char_progress_migrated::<studentId>` → boolean（幂等闸门）
 *
 * 字段：
 *   right / wrong: 这个字答对/答错的累计次数
 *   lastSeenAt: 上次答题时间戳（ms epoch），用于"最近见过的不优先"
 *   weight:    实时算出的"还需要练的程度"，用于权重选题（0.3-1.0）
 *              基于 (right - wrong)：
 *                差距 0 → 1.0   （新字 / 50/50）
 *                差距 +3 → 0.42 （3 次对没错过，可以少出现）
 *                差距 -2 → 1.69 （错的多，频繁出现强化）
 *
 * 历史数据迁移（一次性，跑一次后 migrated key 永远为 true）：
 *   读 chinese/data.json 的 wordStudyData，对每个字写一条 stat。
 *   字段映射：right→right, wrong→wrong（旧的就用旧的；
 *   旧的没有的字保持空，新做才会出现）。
 */

import { db } from "../db/dexie";

export interface CharStat {
  right: number;
  wrong: number;
  /** ms epoch；0 = 从没见过 */
  lastSeenAt: number;
}

export type CharProgress = Record<string, CharStat>;

/** chinese/data.json 的 wordStudyData 字段（已 stringify 过的） */
const HISTORICAL_WORD_STUDY_DATA = `{"丈":{"right":2,"wrong":0},"嗅":{"right":1,"wrong":0},"质":{"right":1,"wrong":0},"溺":{"right":1,"wrong":0},"堵":{"right":1,"wrong":0},"违":{"right":1,"wrong":0},"劈":{"right":3,"wrong":0},"达":{"right":1,"wrong":0},"稼":{"right":2,"wrong":0},"获":{"right":2,"wrong":0},"概":{"right":1,"wrong":0},"振":{"right":1,"wrong":0},"择":{"right":2,"wrong":0},"愉":{"right":1,"wrong":0},"址":{"right":3,"wrong":0},"斥":{"right":2,"wrong":0},"恐":{"right":1,"wrong":0},"任":{"right":1,"wrong":0},"宅":{"right":1,"wrong":0},"徒":{"right":1,"wrong":0},"顽":{"right":1,"wrong":0},"浊":{"right":3,"wrong":0},"慎":{"right":1,"wrong":0},"横":{"right":1,"wrong":0},"熟":{"right":1,"wrong":0},"挖":{"right":1,"wrong":0},"竖":{"right":1,"wrong":0},"驾":{"right":1,"wrong":0},"攀":{"right":1,"wrong":0},"遭":{"right":1,"wrong":0},"罢":{"right":1,"wrong":0},"萤":{"right":3,"wrong":0},"绍":{"right":1,"wrong":0},"解":{"right":2,"wrong":0},"调":{"right":1,"wrong":0},"丫":{"right":1,"wrong":0},"例":{"right":1,"wrong":0},"眠":{"right":2,"wrong":0},"输":{"right":2,"wrong":0},"唤":{"right":2,"wrong":0},"抗":{"right":3,"wrong":0},"凡":{"right":1,"wrong":0},"佩":{"right":1,"wrong":0},"唯":{"right":2,"wrong":0},"费":{"right":1,"wrong":0},"跃":{"right":1,"wrong":0},"犹":{"right":1,"wrong":0},"蔬":{"right":1,"wrong":0},"蝠":{"right":2,"wrong":0},"毫":{"right":0,"wrong":1},"私":{"right":2,"wrong":0},"射":{"right":1,"wrong":0},"侍":{"right":3,"wrong":1},"胳":{"right":1,"wrong":0},"慌":{"right":1,"wrong":0},"绕":{"right":1,"wrong":0},"椅":{"right":1,"wrong":0},"葡":{"right":2,"wrong":0},"庐":{"right":2,"wrong":2},"茎":{"right":1,"wrong":0},"顺":{"right":2,"wrong":0},"派":{"right":2,"wrong":0},"哲":{"right":1,"wrong":0},"征":{"right":1,"wrong":0},"隙":{"right":1,"wrong":0},"选":{"right":1,"wrong":0},"牵":{"right":1,"wrong":0},"殷":{"right":1,"wrong":0},"齿":{"right":1,"wrong":0},"渐":{"right":1,"wrong":0},"柄":{"right":1,"wrong":0},"翻":{"right":1,"wrong":0},"狠":{"right":2,"wrong":0},"暮":{"right":2,"wrong":0},"峰":{"right":1,"wrong":0},"训":{"right":1,"wrong":0},"填":{"right":2,"wrong":0},"链":{"right":2,"wrong":0},"按":{"right":1,"wrong":0},"惹":{"right":2,"wrong":0},"班":{"right":1,"wrong":0},"锅":{"right":1,"wrong":0},"掐":{"right":1,"wrong":0},"盼":{"right":1,"wrong":0},"杰":{"right":1,"wrong":0},"尝":{"right":1,"wrong":0},"惨":{"right":1,"wrong":0},"扔":{"right":1,"wrong":0},"缓":{"right":1,"wrong":0},"妇":{"right":1,"wrong":0},"固":{"right":1,"wrong":0},"源":{"right":1,"wrong":0},"乳":{"right":2,"wrong":0},"滩":{"right":1,"wrong":0},"嘶":{"right":1,"wrong":0},"侧":{"right":1,"wrong":0},"临":{"right":1,"wrong":0},"摔":{"right":1,"wrong":0},"催":{"right":1,"wrong":0},"研":{"right":1,"wrong":0},"级":{"right":1,"wrong":0},"巢":{"right":1,"wrong":0},"昏":{"right":1,"wrong":0},"既":{"right":1,"wrong":0},"塞":{"right":1,"wrong":0},"适":{"right":1,"wrong":0},"捶":{"right":2,"wrong":0},"护":{"right":1,"wrong":0},"俩":{"right":1,"wrong":0},"系":{"right":1,"wrong":0},"赞":{"right":1,"wrong":0},"滚":{"right":1,"wrong":0},"睁":{"right":1,"wrong":0},"豌":{"right":1,"wrong":0},"卧":{"right":1,"wrong":0},"搏":{"right":1,"wrong":0},"累":{"right":1,"wrong":0},"虎":{"right":1,"wrong":0},"颤":{"right":1,"wrong":0},"尸":{"right":1,"wrong":0},"维":{"right":1,"wrong":0},"详":{"right":1,"wrong":0},"绘":{"right":1,"wrong":0},"蛇":{"right":1,"wrong":0},"昂":{"right":1,"wrong":0},"防":{"right":1,"wrong":0},"蹲":{"right":1,"wrong":0},"哩":{"right":0,"wrong":1},"茸":{"right":1,"wrong":0},"颇":{"right":0,"wrong":1},"挣":{"right":0,"wrong":1},"咕":{"right":1,"wrong":0},"贪":{"right":1,"wrong":0},"绩":{"right":1,"wrong":0},"鹰":{"right":1,"wrong":0},"吨":{"right":1,"wrong":0},"囊":{"right":0,"wrong":1},"萝":{"right":1,"wrong":0},"拽":{"right":1,"wrong":0},"锐":{"right":1,"wrong":0},"笼":{"right":1,"wrong":0},"投":{"right":1,"wrong":0}}`;

function progressKey(studentId: string): string {
  return `chinese_char_progress::${studentId}`;
}
function migratedKey(studentId: string): string {
  return `chinese_char_progress_migrated::${studentId}`;
}

/** 读 student 的 char progress（不存在返回空 map） */
export async function loadCharProgress(studentId: string): Promise<CharProgress> {
  const row = await db.meta.get(progressKey(studentId));
  return ((row?.value as CharProgress | undefined) ?? {}) as CharProgress;
}

/** 写 student 的 char progress（覆盖式） */
export async function saveCharProgress(
  studentId: string,
  progress: CharProgress,
): Promise<void> {
  await db.meta.put({ key: progressKey(studentId), value: progress });
}

/** 一次答题：增 right or wrong + 更新 lastSeenAt。返回更新后的 stat。 */
export async function recordCharAttempt(
  studentId: string,
  word: string,
  isCorrect: boolean,
): Promise<CharStat> {
  const all = await loadCharProgress(studentId);
  const cur = all[word] ?? { right: 0, wrong: 0, lastSeenAt: 0 };
  const next: CharStat = {
    right: cur.right + (isCorrect ? 1 : 0),
    wrong: cur.wrong + (isCorrect ? 0 : 1),
    lastSeenAt: Date.now(),
  };
  all[word] = next;
  await saveCharProgress(studentId, all);
  return next;
}

/** 算一个字的"还需练度"权重（0.3-1.7） */
export function charWeight(s: CharStat | undefined): number {
  if (!s || (s.right === 0 && s.wrong === 0)) return 1.0;
  // 差距越大越熟，权重越低；错越多权重越高
  const delta = s.right - s.wrong;
  // base 0.75：3 次对没错 → 0.42；连错 2 次 → 1.78
  const w = Math.pow(0.75, delta);
  // clamp 0.3 - 1.8
  return Math.max(0.3, Math.min(1.8, w));
}

/**
 * 一次性迁移 chinese/data.json 历史进度。
 * 幂等：靠 migratedKey 闸门。
 *
 * 已经在新系统答过题的字，新数据为准（不被旧覆盖）；
 * 旧数据里有但新系统从没见过的字 → 直接 import。
 */
export async function migrateHistoricalCharProgress(
  studentId: string,
): Promise<{ imported: number; skipped: number }> {
  const migratedRow = await db.meta.get(migratedKey(studentId));
  if (migratedRow?.value === true) {
    return { imported: 0, skipped: 0 };
  }
  let raw: Record<string, { right: number; wrong: number }> = {};
  try {
    raw = JSON.parse(HISTORICAL_WORD_STUDY_DATA);
  } catch (e) {
    console.warn("[chineseCharProgress] failed parse historical data", e);
    await db.meta.put({ key: migratedKey(studentId), value: true });
    return { imported: 0, skipped: 0 };
  }
  const cur = await loadCharProgress(studentId);
  let imported = 0;
  let skipped = 0;
  for (const [word, hist] of Object.entries(raw)) {
    if (cur[word]) {
      // 新系统已经有，跳过
      skipped += 1;
      continue;
    }
    cur[word] = {
      right: hist.right ?? 0,
      wrong: hist.wrong ?? 0,
      lastSeenAt: 0, // 旧数据无时间戳
    };
    imported += 1;
  }
  await saveCharProgress(studentId, cur);
  await db.meta.put({ key: migratedKey(studentId), value: true });
  console.log(
    `[chineseCharProgress] migrated ${imported} chars from chinese/data.json (skipped ${skipped} already present)`,
  );
  return { imported, skipped };
}

/**
 * 选下一道字：权重随机
 * 排除：刚刚答过的（last 5 道避免连续看到）
 */
export function pickNextChar<T extends { word: string }>(
  pool: T[],
  progress: CharProgress,
  recentlyShownWords: string[],
  rng: () => number = Math.random,
): T | null {
  const recentSet = new Set(recentlyShownWords);
  const candidates = pool.filter((c) => !recentSet.has(c.word));
  if (candidates.length === 0) return null;

  // 计算 weight 数组
  const weights = candidates.map((c) => charWeight(progress[c.word]));
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return candidates[0] ?? null;

  // 加权抽
  let roll = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1] ?? null;
}

/** 总览统计（用于 home banner） */
export interface CharProgressSummary {
  total: number; // 250
  attempted: number; // 出现过且至少答过一次
  mastered: number; // right >= 3 且 right > wrong
  shaky: number; // wrong > right
  fresh: number; // 从没见过
}

export function summarizeProgress<T extends { word: string }>(
  pool: T[],
  progress: CharProgress,
): CharProgressSummary {
  let attempted = 0;
  let mastered = 0;
  let shaky = 0;
  let fresh = 0;
  for (const c of pool) {
    const s = progress[c.word];
    if (!s) {
      fresh += 1;
      continue;
    }
    if (s.right === 0 && s.wrong === 0) {
      fresh += 1;
      continue;
    }
    attempted += 1;
    if (s.right >= 3 && s.right > s.wrong) mastered += 1;
    if (s.wrong > s.right) shaky += 1;
  }
  return {
    total: pool.length,
    attempted,
    mastered,
    shaky,
    fresh,
  };
}
