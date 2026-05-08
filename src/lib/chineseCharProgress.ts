/**
 * 语文写字表 500 字进度跟踪 + 历史数据迁移 (v0.31.40 重写)
 *
 * 跟老 chinese/g4_cn.html 系统对齐：
 *   - 数据 keyed by Chinese char（500 字范围内任意）
 *   - 每字记 right / wrong；不强制 mastered / shaky 之类的判断
 *   - 统计：
 *       总练习 = sum(right + wrong)  — 总 attempt 次数
 *       正确率 = sum(right) / 总练习
 *       错字总数 = chars where wrong > right
 *
 * 加权随机（getNextWord 同 g4_cn.html）：
 *   weight = max(1, wrong * 3 + 1 - min(right, 3))
 *   - 错过越多权重越高（× 3 倍数累计）
 *   - 答对超过 3 次后权重不再下降
 *   - 新字 weight = 1
 *
 * 数据存储：
 *   db.meta::chinese_char_progress::<studentId> → Record<char, CharStat>
 *   db.meta::chinese_char_progress_migrated::<studentId> → boolean
 *
 * 迁移：从 chinese/data.json 的 wordStudyData 一次性导入。
 */

import { db } from "../db/dexie";
import type { G4Char } from "../subjects/chinese/charLibrary";

export interface CharStat {
  right: number;
  wrong: number;
  /** ms epoch；0 = 没数据 */
  lastSeenAt: number;
}

export type CharProgress = Record<string, CharStat>;

/** 历史数据：从 chinese/data.json 的 wordStudyData 字段提取（已 stringify） */
const HISTORICAL_WORD_STUDY_DATA = `{"丈":{"right":2,"wrong":0},"嗅":{"right":1,"wrong":0},"质":{"right":1,"wrong":0},"溺":{"right":1,"wrong":0},"堵":{"right":1,"wrong":0},"违":{"right":1,"wrong":0},"劈":{"right":3,"wrong":0},"达":{"right":1,"wrong":0},"稼":{"right":2,"wrong":0},"获":{"right":2,"wrong":0},"概":{"right":1,"wrong":0},"振":{"right":1,"wrong":0},"择":{"right":2,"wrong":0},"愉":{"right":1,"wrong":0},"址":{"right":3,"wrong":0},"斥":{"right":2,"wrong":0},"恐":{"right":1,"wrong":0},"任":{"right":1,"wrong":0},"宅":{"right":1,"wrong":0},"徒":{"right":1,"wrong":0},"顽":{"right":1,"wrong":0},"浊":{"right":3,"wrong":0},"慎":{"right":1,"wrong":0},"横":{"right":1,"wrong":0},"熟":{"right":1,"wrong":0},"挖":{"right":1,"wrong":0},"竖":{"right":1,"wrong":0},"驾":{"right":1,"wrong":0},"攀":{"right":1,"wrong":0},"遭":{"right":1,"wrong":0},"罢":{"right":1,"wrong":0},"萤":{"right":3,"wrong":0},"绍":{"right":1,"wrong":0},"解":{"right":2,"wrong":0},"调":{"right":1,"wrong":0},"丫":{"right":1,"wrong":0},"例":{"right":1,"wrong":0},"眠":{"right":2,"wrong":0},"输":{"right":2,"wrong":0},"唤":{"right":2,"wrong":0},"抗":{"right":3,"wrong":0},"凡":{"right":1,"wrong":0},"佩":{"right":1,"wrong":0},"唯":{"right":2,"wrong":0},"费":{"right":1,"wrong":0},"跃":{"right":1,"wrong":0},"犹":{"right":1,"wrong":0},"蔬":{"right":1,"wrong":0},"蝠":{"right":2,"wrong":0},"毫":{"right":0,"wrong":1},"私":{"right":2,"wrong":0},"射":{"right":1,"wrong":0},"侍":{"right":3,"wrong":1},"胳":{"right":1,"wrong":0},"慌":{"right":1,"wrong":0},"绕":{"right":1,"wrong":0},"椅":{"right":1,"wrong":0},"葡":{"right":2,"wrong":0},"庐":{"right":2,"wrong":2},"茎":{"right":1,"wrong":0},"顺":{"right":2,"wrong":0},"派":{"right":2,"wrong":0},"哲":{"right":1,"wrong":0},"征":{"right":1,"wrong":0},"隙":{"right":1,"wrong":0},"选":{"right":1,"wrong":0},"牵":{"right":1,"wrong":0},"殷":{"right":1,"wrong":0},"齿":{"right":1,"wrong":0},"渐":{"right":1,"wrong":0},"柄":{"right":1,"wrong":0},"翻":{"right":1,"wrong":0},"狠":{"right":2,"wrong":0},"暮":{"right":2,"wrong":0},"峰":{"right":1,"wrong":0},"训":{"right":1,"wrong":0},"填":{"right":2,"wrong":0},"链":{"right":2,"wrong":0},"按":{"right":1,"wrong":0},"惹":{"right":2,"wrong":0},"班":{"right":1,"wrong":0},"锅":{"right":1,"wrong":0},"掐":{"right":1,"wrong":0},"盼":{"right":1,"wrong":0},"杰":{"right":1,"wrong":0},"尝":{"right":1,"wrong":0},"惨":{"right":1,"wrong":0},"扔":{"right":1,"wrong":0},"缓":{"right":1,"wrong":0},"妇":{"right":1,"wrong":0},"固":{"right":1,"wrong":0},"源":{"right":1,"wrong":0},"乳":{"right":2,"wrong":0},"滩":{"right":1,"wrong":0},"嘶":{"right":1,"wrong":0},"侧":{"right":1,"wrong":0},"临":{"right":1,"wrong":0},"摔":{"right":1,"wrong":0},"催":{"right":1,"wrong":0},"研":{"right":1,"wrong":0},"级":{"right":1,"wrong":0},"巢":{"right":1,"wrong":0},"昏":{"right":1,"wrong":0},"既":{"right":1,"wrong":0},"塞":{"right":1,"wrong":0},"适":{"right":1,"wrong":0},"捶":{"right":2,"wrong":0},"护":{"right":1,"wrong":0},"俩":{"right":1,"wrong":0},"系":{"right":1,"wrong":0},"赞":{"right":1,"wrong":0},"滚":{"right":1,"wrong":0},"睁":{"right":1,"wrong":0},"豌":{"right":1,"wrong":0},"卧":{"right":1,"wrong":0},"搏":{"right":1,"wrong":0},"累":{"right":1,"wrong":0},"虎":{"right":1,"wrong":0},"颤":{"right":1,"wrong":0},"尸":{"right":1,"wrong":0},"维":{"right":1,"wrong":0},"详":{"right":1,"wrong":0},"绘":{"right":1,"wrong":0},"蛇":{"right":1,"wrong":0},"昂":{"right":1,"wrong":0},"防":{"right":1,"wrong":0},"蹲":{"right":1,"wrong":0},"哩":{"right":0,"wrong":1},"茸":{"right":1,"wrong":0},"颇":{"right":0,"wrong":1},"挣":{"right":0,"wrong":1},"咕":{"right":1,"wrong":0},"贪":{"right":1,"wrong":0},"绩":{"right":1,"wrong":0},"鹰":{"right":1,"wrong":0},"吨":{"right":1,"wrong":0},"囊":{"right":0,"wrong":1},"萝":{"right":1,"wrong":0},"拽":{"right":1,"wrong":0},"锐":{"right":1,"wrong":0},"笼":{"right":1,"wrong":0},"投":{"right":1,"wrong":0}}`;

function progressKey(studentId: string): string {
  return `chinese_char_progress::${studentId}`;
}
function migratedKey(studentId: string): string {
  return `chinese_char_progress_migrated::${studentId}`;
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

/**
 * 加权随机选下一字（沿用 g4_cn.html getNextWord 公式）：
 *   weight = max(1, wrong*3 + 1 - min(right, 3))
 *   - 新字 → 1
 *   - 1 错 → 4
 *   - 2 错 → 7
 *   - 1 对 → 1
 *   - 3 对 → 1（最低）
 *   - 1 对 1 错 → 3
 */
export function charWeightLikeOldSystem(s: CharStat | undefined): number {
  if (!s) return 1;
  return Math.max(1, s.wrong * 3 + 1 - Math.min(s.right, 3));
}

export function pickNextChar(
  pool: G4Char[],
  progress: CharProgress,
  recentlyShownWords: string[],
  rng: () => number = Math.random,
): G4Char | null {
  const recentSet = new Set(recentlyShownWords);
  const candidates = pool.filter((c) => !recentSet.has(c.word));
  if (candidates.length === 0) return null;
  const weights = candidates.map((c) => charWeightLikeOldSystem(progress[c.word]));
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return candidates[0] ?? null;
  let roll = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1] ?? null;
}

/**
 * 老系统口径的统计（updateStats in g4_cn.html）。
 *
 * - 总练习：sum(right + wrong) — 学生答了几次（不是不同字数）
 * - 正确率：sum(right) / 总练习
 * - 错字总数：chars where wrong > right
 *   （含义："这个字到现在为止错的比对的多" → 进错字本）
 * - 错字列表：上述字，按 wrong - right 降序
 */
export interface OldStyleStats {
  totalAttempts: number;
  correctRate: number; // 0-1
  wrongChars: Array<{ word: string; right: number; wrong: number }>;
}

export function calcOldStyleStats(progress: CharProgress): OldStyleStats {
  let totalAttempts = 0;
  let totalRight = 0;
  const wrongChars: Array<{ word: string; right: number; wrong: number }> = [];
  for (const [word, s] of Object.entries(progress)) {
    totalAttempts += s.right + s.wrong;
    totalRight += s.right;
    if (s.wrong > s.right) {
      wrongChars.push({ word, right: s.right, wrong: s.wrong });
    }
  }
  wrongChars.sort((a, b) => b.wrong - b.right - (a.wrong - a.right));
  return {
    totalAttempts,
    correctRate: totalAttempts === 0 ? 0 : totalRight / totalAttempts,
    wrongChars,
  };
}

export async function migrateHistoricalCharProgress(
  studentId: string,
): Promise<{ imported: number; skipped: number }> {
  const migratedRow = await db.meta.get(migratedKey(studentId));
  if (migratedRow?.value === true) return { imported: 0, skipped: 0 };
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
      skipped += 1;
      continue;
    }
    cur[word] = {
      right: hist.right ?? 0,
      wrong: hist.wrong ?? 0,
      lastSeenAt: 0,
    };
    imported += 1;
  }
  await saveCharProgress(studentId, cur);
  await db.meta.put({ key: migratedKey(studentId), value: true });
  console.log(
    `[chineseCharProgress] migrated ${imported} chars (skipped ${skipped} already present)`,
  );
  return { imported, skipped };
}

/**
 * 生成辨字选择题：从同 pinyin 首字母的字里挑 3 个干扰项（形近 / 同音）。
 * 不够 3 个时随机补全。
 */
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
