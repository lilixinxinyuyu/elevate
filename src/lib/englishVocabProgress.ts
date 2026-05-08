/**
 * 英语 G4 单词进度跟踪 + 历史数据迁移 (v0.31.39)
 *
 * 数据存储：
 *   db.meta.key = `english_vocab_progress::<studentId>` → Record<lowercaseWord, WordStat>
 *   db.meta.key = `english_vocab_progress_migrated::<studentId>` → boolean（幂等闸门）
 *
 * 字段：
 *   correct / wrong: 累计计数
 *   lastSeenAt: ms epoch；0 = 从没见过
 *
 * weight = pow(0.75, correct - wrong)；clamp [0.3, 1.8]
 *   - 新单词 → 1.0
 *   - 3 次对没错 → 0.42（少出现）
 *   - 错 2 次没对过 → 1.78（频繁强化）
 *
 * 历史数据迁移：从 english/data.json 的 wordMemory4EN 字段读出来。
 *   原数据有 weight 字段但我们重新算，因为权重逻辑可能不一致。
 */

import { db } from "../db/dexie";

export interface WordStat {
  correct: number;
  wrong: number;
  lastSeenAt: number;
}

export type VocabProgress = Record<string, WordStat>;

/** english/data.json 的 wordMemory4EN 字段（已 stringify） */
const HISTORICAL_WORD_MEMORY = `{"sport":{"correct":2,"wrong":0},"jump":{"correct":3,"wrong":0},"high":{"correct":3,"wrong":0},"far":{"correct":2,"wrong":0},"ping-pong":{"correct":6,"wrong":0},"volleyball":{"correct":4,"wrong":0},"at first":{"correct":1,"wrong":0},"give up":{"correct":3,"wrong":0},"try":{"correct":1,"wrong":0},"player":{"correct":3,"wrong":1},"chore":{"correct":1,"wrong":0},"sweep":{"correct":1,"wrong":0},"floor":{"correct":4,"wrong":0},"rubbish":{"correct":3,"wrong":0},"tidy":{"correct":3,"wrong":0},"clean":{"correct":3,"wrong":1},"dirty":{"correct":3,"wrong":0},"wash":{"correct":2,"wrong":0},"dish":{"correct":0,"wrong":0},"water":{"correct":5,"wrong":0},"feed":{"correct":2,"wrong":0},"helpful":{"correct":1,"wrong":0},"tired":{"correct":2,"wrong":1},"easy":{"correct":5,"wrong":1},"job":{"correct":2,"wrong":0},"good job":{"correct":2,"wrong":0},"weather":{"correct":1,"wrong":0},"sunny":{"correct":5,"wrong":1},"cloudy":{"correct":3,"wrong":0},"windy":{"correct":4,"wrong":0},"rainy":{"correct":3,"wrong":0},"snowy":{"correct":3,"wrong":1},"warm":{"correct":2,"wrong":0},"hot":{"correct":2,"wrong":1},"cool":{"correct":3,"wrong":0},"cold":{"correct":2,"wrong":0},"rain":{"correct":1,"wrong":0},"snow":{"correct":2,"wrong":0},"wind":{"correct":2,"wrong":0},"cloud":{"correct":6,"wrong":0},"season":{"correct":3,"wrong":0},"spring":{"correct":4,"wrong":0},"summer":{"correct":2,"wrong":0},"autumn":{"correct":5,"wrong":0},"winter":{"correct":4,"wrong":0},"fly kites":{"correct":1,"wrong":0},"make snowmen":{"correct":4,"wrong":0},"eat ice cream":{"correct":2,"wrong":0},"have a picnic":{"correct":3,"wrong":0},"bus":{"correct":3,"wrong":0},"train":{"correct":2,"wrong":0},"plane":{"correct":2,"wrong":1},"ship":{"correct":2,"wrong":0},"bike":{"correct":3,"wrong":1},"subway":{"correct":2,"wrong":0},"travel":{"correct":3,"wrong":0},"place":{"correct":2,"wrong":1},"near":{"correct":3,"wrong":0},"left":{"correct":4,"wrong":0},"right":{"correct":3,"wrong":0},"straight":{"correct":3,"wrong":0},"turn left":{"correct":2,"wrong":0},"turn right":{"correct":2,"wrong":0},"go straight on":{"correct":4,"wrong":0},"next to":{"correct":3,"wrong":1},"beside":{"correct":1,"wrong":0},"between":{"correct":2,"wrong":1},"supermarket":{"correct":5,"wrong":0},"hospital":{"correct":4,"wrong":1},"cinema":{"correct":2,"wrong":0},"library":{"correct":2,"wrong":0},"museum":{"correct":3,"wrong":1},"excuse me":{"correct":2,"wrong":0},"be careful":{"correct":4,"wrong":0},"run":{"correct":0,"wrong":0},"fast":{"correct":3,"wrong":0},"win":{"correct":2,"wrong":0},"luck":{"correct":1,"wrong":0},"good luck":{"correct":2,"wrong":0},"come on":{"correct":2,"wrong":0},"favourite":{"correct":2,"wrong":0},"hope":{"correct":3,"wrong":0},"lose":{"correct":3,"wrong":0},"because":{"correct":2,"wrong":0},"hard":{"correct":2,"wrong":0},"kind":{"correct":4,"wrong":0},"keep":{"correct":2,"wrong":0},"remember":{"correct":3,"wrong":0},"never":{"correct":3,"wrong":0},"cut":{"correct":4,"wrong":0},"make":{"correct":4,"wrong":0},"make the bed":{"correct":2,"wrong":0},"take out the rubbish":{"correct":4,"wrong":0},"coat":{"correct":6,"wrong":0},"car":{"correct":1,"wrong":0},"doctor":{"correct":0,"wrong":0},"fireman":{"correct":0,"wrong":0},"farmer":{"correct":2,"wrong":0},"cook":{"correct":1,"wrong":0},"police":{"correct":0,"wrong":0},"police officer":{"correct":1,"wrong":0},"station":{"correct":1,"wrong":1},"police station":{"correct":0,"wrong":0},"often":{"correct":2,"wrong":0},"field":{"correct":0,"wrong":0},"painter":{"correct":0,"wrong":0},"use":{"correct":0,"wrong":0},"brush":{"correct":0,"wrong":0},"scientist":{"correct":1,"wrong":0},"writer":{"correct":1,"wrong":0},"worker":{"correct":1,"wrong":0},"aunt":{"correct":0,"wrong":0},"night":{"correct":1,"wrong":0},"owl":{"correct":0,"wrong":0},"night owl":{"correct":0,"wrong":0},"driver":{"correct":0,"wrong":1},"taxi":{"correct":1,"wrong":0},"safe":{"correct":0,"wrong":0},"nurse":{"correct":0,"wrong":0},"light":{"correct":0,"wrong":0},"uncle":{"correct":0,"wrong":0},"bake":{"correct":2,"wrong":0},"bee":{"correct":0,"wrong":0},"same":{"correct":1,"wrong":0},"sound":{"correct":1,"wrong":0},"postman":{"correct":0,"wrong":0},"life":{"correct":0,"wrong":0},"mountain":{"correct":1,"wrong":0},"laugh":{"correct":1,"wrong":0},"sad":{"correct":1,"wrong":1},"scared":{"correct":0,"wrong":0},"angry":{"correct":0,"wrong":0},"excited":{"correct":2,"wrong":0},"opera":{"correct":0,"wrong":0},"next":{"correct":1,"wrong":0},"cough":{"correct":1,"wrong":0},"better":{"correct":1,"wrong":0},"gift":{"correct":0,"wrong":0},"model":{"correct":0,"wrong":0},"shout":{"correct":0,"wrong":0},"should":{"correct":0,"wrong":0},"feeling":{"correct":1,"wrong":0},"huge":{"correct":1,"wrong":0},"worried":{"correct":1,"wrong":0},"street":{"correct":1,"wrong":0},"hit":{"correct":0,"wrong":0},"talent":{"correct":1,"wrong":0},"act":{"correct":1,"wrong":0},"magic":{"correct":0,"wrong":0},"shine":{"correct":1,"wrong":0},"puzzle":{"correct":0,"wrong":0},"dancer":{"correct":0,"wrong":0},"just":{"correct":0,"wrong":0},"boy":{"correct":0,"wrong":0},"slowly":{"correct":0,"wrong":0},"work":{"correct":2,"wrong":0},"start":{"correct":0,"wrong":0},"seed":{"correct":1,"wrong":0},"earth":{"correct":0,"wrong":0},"root":{"correct":0,"wrong":0},"stem":{"correct":1,"wrong":0},"thin":{"correct":0,"wrong":0},"leaf":{"correct":0,"wrong":0},"dig":{"correct":0,"wrong":0},"sunflower":{"correct":1,"wrong":0},"plant":{"correct":1,"wrong":0},"dream":{"correct":0,"wrong":0},"sleep":{"correct":0,"wrong":0},"will":{"correct":0,"wrong":0},"true":{"correct":0,"wrong":0},"come true":{"correct":0,"wrong":0},"paper":{"correct":2,"wrong":0},"trip":{"correct":0,"wrong":0},"fair":{"correct":0,"wrong":0},"festival":{"correct":1,"wrong":0},"horn":{"correct":2,"wrong":0},"dot":{"correct":1,"wrong":0},"raindrop":{"correct":0,"wrong":0},"more":{"correct":1,"wrong":0},"special":{"correct":0,"wrong":0},"keeper":{"correct":0,"wrong":0},"hey":{"correct":2,"wrong":0},"lovely":{"correct":0,"wrong":0},"student":{"correct":0,"wrong":0},"culture":{"correct":2,"wrong":0},"hour":{"correct":0,"wrong":0},"note":{"correct":2,"wrong":0},"vote":{"correct":0,"wrong":0},"design":{"correct":0,"wrong":0},"hometown":{"correct":4,"wrong":0},"drama":{"correct":0,"wrong":0},"T-shirt":{"correct":0,"wrong":0},"skirt":{"correct":1,"wrong":0},"shorts":{"correct":0,"wrong":0},"shirt":{"correct":0,"wrong":0},"trousers":{"correct":3,"wrong":0},"scarf":{"correct":0,"wrong":0},"sweater":{"correct":2,"wrong":0},"dress":{"correct":0,"wrong":0},"party":{"correct":2,"wrong":0},"dressmaker":{"correct":0,"wrong":0},"wrong":{"correct":1,"wrong":0},"clever":{"correct":0,"wrong":0},"whale":{"correct":0,"wrong":0},"Mr":{"correct":1,"wrong":0},"uniform":{"correct":0,"wrong":0},"robe":{"correct":1,"wrong":0}}`;

function progressKey(studentId: string): string {
  return `english_vocab_progress::${studentId}`;
}
function migratedKey(studentId: string): string {
  return `english_vocab_progress_migrated::${studentId}`;
}
function normWord(w: string): string {
  return w.toLowerCase().trim();
}

export async function loadVocabProgress(studentId: string): Promise<VocabProgress> {
  const row = await db.meta.get(progressKey(studentId));
  return ((row?.value as VocabProgress | undefined) ?? {}) as VocabProgress;
}

export async function saveVocabProgress(
  studentId: string,
  progress: VocabProgress,
): Promise<void> {
  await db.meta.put({ key: progressKey(studentId), value: progress });
}

export async function recordVocabAttempt(
  studentId: string,
  word: string,
  isCorrect: boolean,
): Promise<WordStat> {
  const all = await loadVocabProgress(studentId);
  const k = normWord(word);
  const cur = all[k] ?? { correct: 0, wrong: 0, lastSeenAt: 0 };
  const next: WordStat = {
    correct: cur.correct + (isCorrect ? 1 : 0),
    wrong: cur.wrong + (isCorrect ? 0 : 1),
    lastSeenAt: Date.now(),
  };
  all[k] = next;
  await saveVocabProgress(studentId, all);
  return next;
}

export function vocabWeight(s: WordStat | undefined): number {
  if (!s || (s.correct === 0 && s.wrong === 0)) return 1.0;
  const delta = s.correct - s.wrong;
  const w = Math.pow(0.75, delta);
  return Math.max(0.3, Math.min(1.8, w));
}

export async function migrateHistoricalVocabProgress(
  studentId: string,
): Promise<{ imported: number; skipped: number }> {
  const migrated = await db.meta.get(migratedKey(studentId));
  if (migrated?.value === true) return { imported: 0, skipped: 0 };
  let raw: Record<string, { correct: number; wrong: number }> = {};
  try {
    raw = JSON.parse(HISTORICAL_WORD_MEMORY);
  } catch (e) {
    console.warn("[englishVocabProgress] failed parse historical data", e);
    await db.meta.put({ key: migratedKey(studentId), value: true });
    return { imported: 0, skipped: 0 };
  }
  const cur = await loadVocabProgress(studentId);
  let imported = 0;
  let skipped = 0;
  for (const [w, hist] of Object.entries(raw)) {
    const k = normWord(w);
    if (cur[k]) {
      skipped += 1;
      continue;
    }
    cur[k] = {
      correct: hist.correct ?? 0,
      wrong: hist.wrong ?? 0,
      lastSeenAt: 0,
    };
    imported += 1;
  }
  await saveVocabProgress(studentId, cur);
  await db.meta.put({ key: migratedKey(studentId), value: true });
  console.log(
    `[englishVocabProgress] migrated ${imported} words from english/data.json (skipped ${skipped})`,
  );
  return { imported, skipped };
}

export function pickNextWord<T extends { w: string }>(
  pool: T[],
  progress: VocabProgress,
  recentlyShownLowerWords: string[],
  rng: () => number = Math.random,
): T | null {
  const recentSet = new Set(recentlyShownLowerWords);
  const candidates = pool.filter((c) => !recentSet.has(normWord(c.w)));
  if (candidates.length === 0) return null;
  const weights = candidates.map((c) => vocabWeight(progress[normWord(c.w)]));
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return candidates[0] ?? null;
  let roll = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1] ?? null;
}

export interface VocabSummary {
  total: number;
  attempted: number;
  mastered: number; // correct ≥ 3 且 correct > wrong
  shaky: number;
  fresh: number;
}

export function summarizeVocab<T extends { w: string }>(
  pool: T[],
  progress: VocabProgress,
): VocabSummary {
  let attempted = 0;
  let mastered = 0;
  let shaky = 0;
  let fresh = 0;
  for (const item of pool) {
    const s = progress[normWord(item.w)];
    if (!s || (s.correct === 0 && s.wrong === 0)) {
      fresh += 1;
      continue;
    }
    attempted += 1;
    if (s.correct >= 3 && s.correct > s.wrong) mastered += 1;
    if (s.wrong > s.correct) shaky += 1;
  }
  return {
    total: pool.length,
    attempted,
    mastered,
    shaky,
    fresh,
  };
}

export { normWord };
