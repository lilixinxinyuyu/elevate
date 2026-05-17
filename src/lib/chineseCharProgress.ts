/**
 * 语文写字表 500 字进度 + 历史数据迁移 (v0.31.41 — mastery tier + 间隔重现)
 *
 * 比老 chinese/g4_cn.html 强：
 *   - 5 tier 等级（不只是 mastered 一锤子）
 *   - SM-2 间隔重现（答对的字会按 1h→1d→3d→7d→30d 周期回炉）
 *   - 答错强化（答错的字下 2 题内必现）
 *   - 老口径统计仍保留（总练习/正确率/错字总数）
 *
 * 数据：
 *   db.meta::chinese_char_progress::<studentId> → Record<char, MasteryStat>
 *   db.meta::chinese_char_progress_migrated_v2::<studentId> → boolean
 *     （注意 v2 — v1 已经有 migration，这次升级用新 key）
 */

import { db } from "../db/dexie";
import type { G4Char } from "../subjects/chinese/charLibrary";
import {
  distribution,
  freshStat,
  migrateLegacyStat,
  pickByMastery,
  transitionStat,
  type MasteryStat,
  type TierDistribution,
} from "./masteryTier";
import { recordDailyActivity } from "./dailyActivityLog";

export type CharProgress = Record<string, MasteryStat>;

const HISTORICAL_WORD_STUDY_DATA = `{"丈":{"right":2,"wrong":0},"嗅":{"right":1,"wrong":0},"质":{"right":1,"wrong":0},"溺":{"right":1,"wrong":0},"堵":{"right":1,"wrong":0},"违":{"right":1,"wrong":0},"劈":{"right":3,"wrong":0},"达":{"right":1,"wrong":0},"稼":{"right":2,"wrong":0},"获":{"right":2,"wrong":0},"概":{"right":1,"wrong":0},"振":{"right":1,"wrong":0},"择":{"right":2,"wrong":0},"愉":{"right":1,"wrong":0},"址":{"right":3,"wrong":0},"斥":{"right":2,"wrong":0},"恐":{"right":1,"wrong":0},"任":{"right":1,"wrong":0},"宅":{"right":1,"wrong":0},"徒":{"right":1,"wrong":0},"顽":{"right":1,"wrong":0},"浊":{"right":3,"wrong":0},"慎":{"right":1,"wrong":0},"横":{"right":1,"wrong":0},"熟":{"right":1,"wrong":0},"挖":{"right":1,"wrong":0},"竖":{"right":1,"wrong":0},"驾":{"right":1,"wrong":0},"攀":{"right":1,"wrong":0},"遭":{"right":1,"wrong":0},"罢":{"right":1,"wrong":0},"萤":{"right":3,"wrong":0},"绍":{"right":1,"wrong":0},"解":{"right":2,"wrong":0},"调":{"right":1,"wrong":0},"丫":{"right":1,"wrong":0},"例":{"right":1,"wrong":0},"眠":{"right":2,"wrong":0},"输":{"right":2,"wrong":0},"唤":{"right":2,"wrong":0},"抗":{"right":3,"wrong":0},"凡":{"right":1,"wrong":0},"佩":{"right":1,"wrong":0},"唯":{"right":2,"wrong":0},"费":{"right":1,"wrong":0},"跃":{"right":1,"wrong":0},"犹":{"right":1,"wrong":0},"蔬":{"right":1,"wrong":0},"蝠":{"right":2,"wrong":0},"毫":{"right":0,"wrong":1},"私":{"right":2,"wrong":0},"射":{"right":1,"wrong":0},"侍":{"right":3,"wrong":1},"胳":{"right":1,"wrong":0},"慌":{"right":1,"wrong":0},"绕":{"right":1,"wrong":0},"椅":{"right":1,"wrong":0},"葡":{"right":2,"wrong":0},"庐":{"right":2,"wrong":2},"茎":{"right":1,"wrong":0},"顺":{"right":2,"wrong":0},"派":{"right":2,"wrong":0},"哲":{"right":1,"wrong":0},"征":{"right":1,"wrong":0},"隙":{"right":1,"wrong":0},"选":{"right":1,"wrong":0},"牵":{"right":1,"wrong":0},"殷":{"right":1,"wrong":0},"齿":{"right":1,"wrong":0},"渐":{"right":1,"wrong":0},"柄":{"right":1,"wrong":0},"翻":{"right":1,"wrong":0},"狠":{"right":2,"wrong":0},"暮":{"right":2,"wrong":0},"峰":{"right":1,"wrong":0},"训":{"right":1,"wrong":0},"填":{"right":2,"wrong":0},"链":{"right":2,"wrong":0},"按":{"right":1,"wrong":0},"惹":{"right":2,"wrong":0},"班":{"right":1,"wrong":0},"锅":{"right":1,"wrong":0},"掐":{"right":1,"wrong":0},"盼":{"right":1,"wrong":0},"杰":{"right":1,"wrong":0},"尝":{"right":1,"wrong":0},"惨":{"right":1,"wrong":0},"扔":{"right":1,"wrong":0},"缓":{"right":1,"wrong":0},"妇":{"right":1,"wrong":0},"固":{"right":1,"wrong":0},"源":{"right":1,"wrong":0},"乳":{"right":2,"wrong":0},"滩":{"right":1,"wrong":0},"嘶":{"right":1,"wrong":0},"侧":{"right":1,"wrong":0},"临":{"right":1,"wrong":0},"摔":{"right":1,"wrong":0},"催":{"right":1,"wrong":0},"研":{"right":1,"wrong":0},"级":{"right":1,"wrong":0},"巢":{"right":1,"wrong":0},"昏":{"right":1,"wrong":0},"既":{"right":1,"wrong":0},"塞":{"right":1,"wrong":0},"适":{"right":1,"wrong":0},"捶":{"right":2,"wrong":0},"护":{"right":1,"wrong":0},"俩":{"right":1,"wrong":0},"系":{"right":1,"wrong":0},"赞":{"right":1,"wrong":0},"滚":{"right":1,"wrong":0},"睁":{"right":1,"wrong":0},"豌":{"right":1,"wrong":0},"卧":{"right":1,"wrong":0},"搏":{"right":1,"wrong":0},"累":{"right":1,"wrong":0},"虎":{"right":1,"wrong":0},"颤":{"right":1,"wrong":0},"尸":{"right":1,"wrong":0},"维":{"right":1,"wrong":0},"详":{"right":1,"wrong":0},"绘":{"right":1,"wrong":0},"蛇":{"right":1,"wrong":0},"昂":{"right":1,"wrong":0},"防":{"right":1,"wrong":0},"蹲":{"right":1,"wrong":0},"哩":{"right":0,"wrong":1},"茸":{"right":1,"wrong":0},"颇":{"right":0,"wrong":1},"挣":{"right":0,"wrong":1},"咕":{"right":1,"wrong":0},"贪":{"right":1,"wrong":0},"绩":{"right":1,"wrong":0},"鹰":{"right":1,"wrong":0},"吨":{"right":1,"wrong":0},"囊":{"right":0,"wrong":1},"萝":{"right":1,"wrong":0},"拽":{"right":1,"wrong":0},"锐":{"right":1,"wrong":0},"笼":{"right":1,"wrong":0},"投":{"right":1,"wrong":0}}`;

function progressKey(studentId: string): string {
  return `chinese_char_progress::${studentId}`;
}
function migratedKeyV2(studentId: string): string {
  return `chinese_char_progress_migrated_v2::${studentId}`;
}

export async function loadCharProgress(studentId: string): Promise<CharProgress> {
  const row = await db.meta.get(progressKey(studentId));
  return ((row?.value as CharProgress | undefined) ?? {}) as CharProgress;
}

export async function saveCharProgress(
  studentId: string,
  progress: CharProgress,
): Promise<void> {
  await db.meta.put({ key: progressKey(studentId), value: progress });
}

export async function recordCharAttempt(
  studentId: string,
  word: string,
  isCorrect: boolean,
  mode?: "write" | "choose",
): Promise<MasteryStat> {
  const all = await loadCharProgress(studentId);
  const cur = all[word] ?? freshStat();
  const next = transitionStat(cur, isCorrect);
  all[word] = next;
  await saveCharProgress(studentId, all);
  // v0.31.103：daily log（主页 summary 用）
  // Phase 3: 把 mode 传下去，主页 today-3-closure 用
  void recordDailyActivity("chinese", studentId, word, isCorrect, mode);
  return next;
}

export function pickNextChar(
  pool: G4Char[],
  progress: CharProgress,
  recentWords: string[],
  reinforceQueue: string[] = [],
  rng: () => number = Math.random,
): G4Char | null {
  return pickByMastery(
    pool,
    (c) => progress[c.word],
    (c) => c.word,
    recentWords,
    reinforceQueue,
    rng,
  );
}

/** 老口径统计仍保留：总练习 / 正确率 / 错字总数 */
export interface OldStyleStats {
  totalAttempts: number;
  correctRate: number;
  wrongChars: Array<{ word: string; right: number; wrong: number }>;
}
export function calcOldStyleStats(progress: CharProgress): OldStyleStats {
  let totalAttempts = 0;
  let totalRight = 0;
  const wrong: Array<{ word: string; right: number; wrong: number }> = [];
  for (const [word, s] of Object.entries(progress)) {
    totalAttempts += s.right + s.wrong;
    totalRight += s.right;
    if (s.wrong > s.right) {
      wrong.push({ word, right: s.right, wrong: s.wrong });
    }
  }
  wrong.sort((a, b) => b.wrong - b.right - (a.wrong - a.right));
  return {
    totalAttempts,
    correctRate: totalAttempts === 0 ? 0 : totalRight / totalAttempts,
    wrongChars: wrong,
  };
}

/** 5-tier 分布（新增）：传入完整 pool（500 字），返回每等级数量 */
export function calcTierDistribution(
  pool: G4Char[],
  progress: CharProgress,
): TierDistribution {
  return distribution(pool, (c) => progress[c.word]);
}

export async function migrateHistoricalCharProgress(
  studentId: string,
): Promise<{ imported: number; skipped: number; upgraded: number }> {
  const migratedRow = await db.meta.get(migratedKeyV2(studentId));
  const cur = await loadCharProgress(studentId);
  let imported = 0;
  let skipped = 0;
  let upgraded = 0;

  if (migratedRow?.value === true) {
    return { imported: 0, skipped: 0, upgraded: 0 };
  }

  // 升级现有 stat（v0.31.39/.40 老 schema 没 level/nextDueAt）
  for (const [word, raw] of Object.entries(cur)) {
    const s = raw as Partial<MasteryStat> & { right?: number; wrong?: number };
    if (typeof s.level !== "number" || typeof s.nextDueAt !== "number") {
      cur[word] = migrateLegacyStat(s.right ?? 0, s.wrong ?? 0);
      upgraded += 1;
    }
  }

  // 一次性导入老 chinese/data.json
  let raw: Record<string, { right: number; wrong: number }> = {};
  try {
    raw = JSON.parse(HISTORICAL_WORD_STUDY_DATA);
  } catch (e) {
    console.warn("[chineseCharProgress] failed parse historical data", e);
  }
  for (const [word, hist] of Object.entries(raw)) {
    if (cur[word]) {
      skipped += 1;
      continue;
    }
    cur[word] = migrateLegacyStat(hist.right ?? 0, hist.wrong ?? 0);
    imported += 1;
  }

  await saveCharProgress(studentId, cur);
  await db.meta.put({ key: migratedKeyV2(studentId), value: true });
  console.log(
    `[chineseCharProgress] migrated ${imported} chars + upgraded ${upgraded} existing`,
  );
  return { imported, skipped, upgraded };
}

/**
 * 词组提示泄露净化：500 字数据里 ~50% 的 group 字段会把 target 字也展示出来
 * （比如 "稀___、___稀" 让 target=稀 在视觉上直接出现，等于给答案）。
 *
 * 净化：把 group 里所有 target 字替换成 `〇`（unicode 圆圈占位符），
 * 这样视觉上仍然知道那位置有个字，但不再泄露答案。
 *
 * 例如：
 *   sanitize("复___、___杂", "杂")  →  "复___、___〇"
 *   sanitize("稀___、___稀", "稀")  →  "〇___、___〇"
 *   sanitize("___水、涨___", "潮")  →  "___水、涨___"   (无泄露原样)
 */
export function sanitizeGroupDisplay(group: string, target: string): string {
  if (!target) return group;
  // global replace target char everywhere in group
  return group.split(target).join("〇");
}

/** 辨字选择题：同 g4_cn.html 公式 */
export function generateChooseQuestion(
  target: G4Char,
  pool: G4Char[],
  rng: () => number = Math.random,
): { question: string; answer: string; options: string[] } {
  const pinyinHead = target.pinyin.charAt(0);
  const similar = pool
    .filter((w) => w.word !== target.word && w.pinyin.charAt(0) === pinyinHead)
    .sort(() => rng() - 0.5)
    .slice(0, 3);
  const distractors = similar.map((s) => s.word);
  while (distractors.length < 3) {
    const random = pool[Math.floor(rng() * pool.length)];
    if (!random) break;
    if (random.word !== target.word && !distractors.includes(random.word)) {
      distractors.push(random.word);
    }
  }
  const opts = [target.word, ...distractors].sort(() => rng() - 0.5);
  return {
    question: `请选择正确的生字：${target.meaning}`,
    answer: target.word,
    options: opts,
  };
}
