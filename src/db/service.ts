import { db } from "./dexie";
import { buildDailySession } from "../core/scheduler";
import { scoreAttempt, levelFromXp } from "../core/scoring";
import { updateMastery, MASTERY_BOUNDS } from "../core/mastery";
import { advanceStageOnSuccess, nextReviewAt, regressStageOnFailure, REVIEW_INTERVAL_DAYS } from "../core/spacedReview";
import { checkAndAwardTrophies, TROPHIES } from "../core/trophies";
import { computeRating } from "../core/rating";
import { tierIndex, tierById } from "../core/tiers";
import type {
  Attempt,
  DailySession,
  MasteryScore,
  MistakeReview,
  Question,
  SessionMode,
  SessionSummary,
  StudentProfile,
  UserTrophy,
} from "../core/types";
import { SKILLS } from "../content/skills";
import { todayKey } from "../lib/date";
import { uid } from "../lib/format";

const SKILL_MAP = new Map(SKILLS.map((s) => [s.id, s]));

export async function getDefaultStudent(): Promise<StudentProfile> {
  const list = await db.students.toArray();
  if (list.length === 0) throw new Error("没有学生档案");
  return list[0]!;
}

export interface SessionOptions {
  mode?: SessionMode;
  selectedSkillIds?: string[];
  /** 即便今天已有相同 mode 的 session，也强制新建一组 */
  fresh?: boolean;
}

export async function getOrCreateSession(
  studentId: string,
  opts: SessionOptions = {},
): Promise<{ session: DailySession; questions: Question[]; poolStarved?: boolean; starvedSkillIds?: string[] }> {
  const student = await db.students.get(studentId);
  if (!student) throw new Error("学生不存在");
  const mode = opts.mode ?? "normal";
  const dateKey = todayKey();
  if (!opts.fresh && !opts.selectedSkillIds) {
    const existing = await db.sessions
      .where({ studentId, dateKey })
      .filter((s) => s.mode === mode && !s.finishedAt)
      .first();
    if (existing) {
      const questions = await fetchQuestionsOrdered(existing.questionIds);
      return { session: existing, questions };
    }
  }
  const pool = await db.questions.toArray();
  const mastery = await db.mastery.where({ studentId }).toArray();
  const mistakes = await db.mistakes.where({ studentId }).toArray();
  const attempts = await db.attempts.where({ studentId }).toArray();
  const plan = buildDailySession({
    studentId,
    mode,
    currentUnitId: student.currentUnitId,
    targetMinutes: student.dailyLimitMin,
    dateKey,
    pool,
    mastery,
    mistakes,
    attempts,
    selectedSkillIds: opts.selectedSkillIds,
    rngSeed: `${studentId}:${mode}:${dateKey}:${Date.now()}:${Math.random()}`,
  });
  const session: DailySession = {
    id: uid("s-"),
    studentId,
    dateKey,
    mode,
    plannedMinutes: student.dailyLimitMin,
    questionIds: plan.questionIds,
    selectedSkillIds: opts.selectedSkillIds,
    startedAt: Date.now(),
  };
  await db.sessions.put(session);
  const questions = await fetchQuestionsOrdered(plan.questionIds);
  return { session, questions, poolStarved: plan.poolStarved, starvedSkillIds: plan.starvedSkillIds };
}

async function fetchQuestionsOrdered(ids: string[]): Promise<Question[]> {
  if (ids.length === 0) return [];
  const found = await db.questions.bulkGet(ids);
  return ids.map((_, i) => found[i]).filter(Boolean) as Question[];
}

export interface SubmitAttemptInput {
  studentId: string;
  session: DailySession;
  question: Question;
  userAnswer: unknown;
  isCorrect: boolean;
  partialCorrect: boolean;
  matchedErrorTags: string[];
  hintsOpened: number;
  elapsedSeconds: number;
  comboBeforeAttempt: number;
}

export interface AttemptOutcome {
  attempt: Attempt;
  points: number;
  comboAfter: number;
}

export async function submitAttempt(input: SubmitAttemptInput): Promise<AttemptOutcome> {
  const {
    studentId, session, question, userAnswer,
    isCorrect, partialCorrect, matchedErrorTags, hintsOpened, elapsedSeconds, comboBeforeAttempt,
  } = input;

  const existingMistake = await db.mistakes
    .where({ studentId, questionId: question.question_id })
    .first();
  const isReview = !!existingMistake && !existingMistake.resolved;

  const comboAfter = isCorrect ? comboBeforeAttempt + 1 : 0;

  const delta = scoreAttempt({
    question,
    isCorrect,
    partialCorrect,
    hintsOpened,
    elapsedSeconds,
    isReview,
    comboAfter,
  });

  const priorMastery = await db.mastery.get(masteryId(studentId, question.skill_id));
  const priorTags = await getRecentErrorTags(studentId, question.skill_id);
  const newMasteryScore = updateMastery({
    oldScore: priorMastery?.score ?? MASTERY_BOUNDS.min + 50,
    difficulty: question.difficulty,
    isCorrect,
    usedHint: hintsOpened > 0,
    elapsedSeconds,
    estimatedTimeSeconds: question.estimated_time_seconds,
    errorTags: matchedErrorTags,
    priorErrorTags: priorTags,
    cognitiveLevel: question.cognitive_level,
  });
  const masteryDelta = newMasteryScore - (priorMastery?.score ?? 50);

  const attempt: Attempt = {
    id: uid("a-"),
    studentId,
    questionId: question.question_id,
    skillId: question.skill_id,
    sessionId: session.id,
    answer: userAnswer,
    isCorrect,
    partialCorrect,
    hintsOpened,
    elapsedSeconds,
    errorTags: matchedErrorTags,
    scoreDelta: delta,
    masteryDelta,
    isReview,
    comboAtEnd: comboAfter,
    createdAt: Date.now(),
  };

  await db.transaction("rw", [db.attempts, db.mastery, db.mistakes, db.meta], async () => {
    await db.attempts.put(attempt);

    const next: MasteryScore = {
      id: masteryId(studentId, question.skill_id),
      studentId,
      skillId: question.skill_id,
      score: newMasteryScore,
      attemptsCount: (priorMastery?.attemptsCount ?? 0) + 1,
      correctCount: (priorMastery?.correctCount ?? 0) + (isCorrect ? 1 : 0),
      lastPracticedAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.mastery.put(next);

    if (!isCorrect) {
      if (existingMistake) {
        existingMistake.stage = regressStageOnFailure(existingMistake.stage);
        existingMistake.nextReviewAt = Date.now() + 24 * 60 * 60 * 1000;
        existingMistake.errorTags = matchedErrorTags;
        existingMistake.lastAttemptAt = Date.now();
        existingMistake.resolved = false;
        await db.mistakes.put(existingMistake);
      } else {
        const m: MistakeReview = {
          id: uid("m-"),
          studentId,
          questionId: question.question_id,
          skillId: question.skill_id,
          stage: 0,
          nextReviewAt: nextReviewAt(0),
          lastAttemptAt: Date.now(),
          errorTags: matchedErrorTags,
          resolved: false,
        };
        await db.mistakes.put(m);
      }
    } else if (existingMistake) {
      const newStage = advanceStageOnSuccess(existingMistake.stage);
      if (newStage >= REVIEW_INTERVAL_DAYS.length) {
        existingMistake.resolved = true;
      } else {
        existingMistake.stage = newStage;
        existingMistake.nextReviewAt = nextReviewAt(newStage);
      }
      existingMistake.lastAttemptAt = Date.now();
      await db.mistakes.put(existingMistake);
    }

    // 更新 totalXp meta
    const xpMeta = await db.meta.get(studentKey("totalXp", studentId));
    const prevXp = typeof xpMeta?.value === "number" ? (xpMeta.value as number) : 0;
    await db.meta.put({ key: studentKey("totalXp", studentId), value: prevXp + delta.total });
  });

  return { attempt, points: delta.total, comboAfter };
}

export async function getTotalXp(studentId: string): Promise<number> {
  const row = await db.meta.get(studentKey("totalXp", studentId));
  if (!row) return 0;
  return typeof row.value === "number" ? row.value : 0;
}

/**
 * 读上次缓存的综合分（finalizeSession 写入）。
 * 没有就根据当前 attempts/mastery 实时算一个，但不写入。
 */
export async function getCachedRating(studentId: string): Promise<{
  score: number;
  tierId: string;
  computedAt: number;
} | null> {
  const row = await db.meta.get(studentKey("rating", studentId));
  if (!row || typeof row.value !== "object" || !row.value) return null;
  const v = row.value as { score: number; tierId: string; computedAt: number };
  return v;
}

/** 实时计算综合分（用于首页等需要立刻拿到分数的场景）。 */
export async function computeCurrentRating(studentId: string) {
  const attempts = await db.attempts.where({ studentId }).toArray();
  const mastery = await db.mastery.where({ studentId }).toArray();
  return computeRating(attempts, mastery);
}

/** 已解锁的段位列表（meta 持久化，跨段升档时追加） */
export async function getUnlockedTiers(studentId: string): Promise<string[]> {
  const row = await db.meta.get(studentKey("tiersUnlocked", studentId));
  if (!row || !Array.isArray(row.value)) return ["school"]; // 进来就拿到学徒
  return row.value as string[];
}

/** 当前佩戴的段位勋章（默认最高已解锁段位） */
export async function getEquippedBadge(studentId: string): Promise<string> {
  const row = await db.meta.get(studentKey("equippedBadge", studentId));
  if (row && typeof row.value === "string") return row.value;
  const unlocked = await getUnlockedTiers(studentId);
  // 默认佩戴解锁的最高段位
  return unlocked.reduce((best, id) =>
    tierIndex(id) > tierIndex(best) ? id : best, "school");
}

export async function setEquippedBadge(studentId: string, tierId: string): Promise<void> {
  if (!tierById(tierId)) return;
  const unlocked = await getUnlockedTiers(studentId);
  if (!unlocked.includes(tierId)) return; // 没解锁的不能佩戴
  await db.meta.put({ key: studentKey("equippedBadge", studentId), value: tierId });
}

function studentKey(name: string, studentId: string): string {
  return `${name}::${studentId}`;
}

function masteryId(studentId: string, skillId: string): string {
  return `${studentId}::${skillId}`;
}

async function getRecentErrorTags(studentId: string, skillId: string): Promise<string[]> {
  const recent = await db.attempts
    .where({ studentId, skillId })
    .reverse()
    .limit(3)
    .toArray();
  return recent.flatMap((a) => a.errorTags);
}

export async function finalizeSession(
  studentId: string,
  sessionId: string,
): Promise<SessionSummary> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error("会话不存在");
  const attempts = await db.attempts.where({ sessionId }).toArray();
  const total = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect).length;
  const accuracy = total === 0 ? 0 : correct / total;
  const totalPoints = attempts.reduce((s, a) => s + a.scoreDelta.total, 0);

  const abilityPoints: SessionSummary["abilityPoints"] = {};
  for (const a of attempts) {
    for (const [k, v] of Object.entries(a.scoreDelta.byAbility)) {
      const key = k as keyof typeof abilityPoints;
      abilityPoints[key] = (abilityPoints[key] ?? 0) + (v ?? 0);
    }
  }

  const maxCombo = attempts.reduce((m, a) => Math.max(m, a.comboAtEnd ?? 0), 0);
  const fastestSeconds = attempts
    .filter((a) => a.isCorrect)
    .reduce((m, a) => (m === 0 ? a.elapsedSeconds : Math.min(m, a.elapsedSeconds)), 0);

  const deltaBySkill = new Map<string, number>();
  for (const a of attempts) {
    deltaBySkill.set(a.skillId, (deltaBySkill.get(a.skillId) ?? 0) + a.masteryDelta);
  }
  const currentMastery = await db.mastery.where({ studentId }).toArray();
  const currentMap = new Map(currentMastery.map((m) => [m.skillId, m.score]));
  const masteryImprovements = Array.from(deltaBySkill.entries())
    .filter(([, d]) => d > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([skillId, d]) => {
      const to = currentMap.get(skillId) ?? 50;
      return {
        skillId,
        skillName: SKILL_MAP.get(skillId)?.name ?? skillId,
        from: Math.max(0, Math.round(to - d)),
        to: Math.round(to),
      };
    });

  const needReview = attempts
    .filter((a) => !a.isCorrect)
    .map((a) => ({
      skillId: a.skillId,
      skillName: SKILL_MAP.get(a.skillId)?.name ?? a.skillId,
    }))
    .filter((v, i, arr) => arr.findIndex((x) => x.skillId === v.skillId) === i);

  // 奖杯
  const allAttempts = await db.attempts.where({ studentId }).toArray();
  const mastery = await db.mastery.where({ studentId }).toArray();
  const mistakes = await db.mistakes.where({ studentId }).toArray();
  const trophies = await db.trophies.where({ studentId }).toArray();
  const newTrophyAwards = checkAndAwardTrophies({
    studentId,
    attempts: allAttempts,
    mastery,
    mistakes,
    trophies,
    todayDateKey: todayKey(),
  });
  for (const award of newTrophyAwards) {
    for (let i = 0; i < award.count; i++) {
      const t: UserTrophy = {
        id: uid("t-"),
        studentId,
        trophyId: award.trophyId,
        unlockedAt: Date.now(),
      };
      await db.trophies.put(t);
    }
  }

  const xpGained = totalPoints;
  const totalXpNow = await getTotalXp(studentId);
  const levelAfter = levelFromXp(totalXpNow);
  const levelBefore = levelFromXp(totalXpNow - xpGained);

  // 综合分 + 段位升档判定
  const prevRating = await getCachedRating(studentId);
  const rating = computeRating(allAttempts, mastery);
  await db.meta.put({
    key: studentKey("rating", studentId),
    value: {
      score: rating.score,
      tierId: rating.tier.id,
      components: rating.components,
      computedAt: Date.now(),
    },
  });
  // 解锁段位（追加，不删）
  const prevUnlocked = await getUnlockedTiers(studentId);
  const unlocked = new Set(prevUnlocked);
  unlocked.add("school"); // 永远有起步段
  if (!unlocked.has(rating.tier.id)) unlocked.add(rating.tier.id);
  if (unlocked.size !== prevUnlocked.length) {
    await db.meta.put({
      key: studentKey("tiersUnlocked", studentId),
      value: Array.from(unlocked),
    });
  }
  // 跨段升档：之前缓存段位 < 现在段位
  let tierUpgrade: SessionSummary["tierUpgrade"] | undefined;
  const prevTierId = prevRating?.tierId ?? "school";
  if (tierIndex(rating.tier.id) > tierIndex(prevTierId)) {
    tierUpgrade = { fromTierId: prevTierId, toTierId: rating.tier.id };
  }

  const summary: SessionSummary = {
    total,
    correct,
    accuracy,
    totalPoints,
    abilityPoints,
    masteryImprovements,
    needReview,
    newTrophies: newTrophyAwards,
    suggestionForTomorrow: computeSuggestion(needReview, masteryImprovements),
    maxCombo,
    fastestSeconds,
    xpGained,
    levelBefore,
    levelAfter,
    dateKey: session.dateKey,
    ratingBefore: prevRating?.score,
    ratingAfter: rating.score,
    tierUpgrade,
  };

  session.finishedAt = Date.now();
  session.summary = summary;
  await db.sessions.put(session);
  return summary;
}

function computeSuggestion(
  needReview: { skillName: string }[],
  improvements: { skillName: string }[],
): string {
  if (needReview.length === 0 && improvements.length > 0) {
    return `明天再来一把挑战更大的吧！`;
  }
  if (needReview.length > 0) {
    return `明天先复习：${needReview.slice(0, 2).map((r) => r.skillName).join("、")}。`;
  }
  return "明天继续保持！";
}

export function trophyById(id: string) {
  return TROPHIES.find((t) => t.id === id);
}

/**
 * 检查题库健康度：
 * - freshTotal: 全部 skill 还没掌握 / 30 天内没做对的题数
 * - freshMidterm: 锁定下册 1-4 单元的同上指标
 * - starvedSkills: 完全没新题可出的 skill
 *
 * 主页据此决定是否提示「让爸妈给你出新题吧」。
 */
export async function checkPoolHealth(studentId: string): Promise<{
  freshTotal: number;
  freshMidterm: number;
  starvedSkills: { skillId: string; skillName: string }[];
}> {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const attempts = await db.attempts.where({ studentId }).toArray();
  const pool = await db.questions.toArray();

  // 30 天内做对过的（暂时退池）
  const recentCorrectIds = new Set(
    attempts.filter((a) => a.isCorrect && a.createdAt >= now - 30 * DAY).map((a) => a.questionId),
  );
  // 单题级 mastered（连续 3 次答对）
  const byQ = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const arr = byQ.get(a.questionId) ?? [];
    arr.push(a);
    byQ.set(a.questionId, arr);
  }
  const masteredIds = new Set<string>();
  for (const [qId, list] of byQ) {
    list.sort((a, b) => a.createdAt - b.createdAt);
    if (list.length < 3) continue;
    const tail = list.slice(-3);
    if (tail.every((a) => a.isCorrect) && tail[2]!.createdAt >= now - 30 * DAY) {
      masteredIds.add(qId);
    }
  }
  const fresh = pool.filter(
    (q) =>
      (q.status === "approved" || q.status === "active") &&
      !recentCorrectIds.has(q.question_id) &&
      !masteredIds.has(q.question_id),
  );
  const MIDTERM_UNIT_IDS = ["G4B_U1_DECIMAL_ADD_SUB", "G4B_U2_TRI_QUAD", "G4B_U3_DECIMAL_MULTIPLY", "G4B_U4_OBSERVE_OBJECTS"];
  const freshMidterm = fresh.filter((q) => MIDTERM_UNIT_IDS.includes(q.unit_id)).length;

  // 哪些 skill 已经"用完"了：要求做过 ≥ 5 次（不是 3）+ pool 里至少有过 ≥ 3 道题
  // 这样冷门、题量少的 skill（比如"万/亿级认识"只有 1-2 题）不会误报
  const skillAttemptCount = new Map<string, number>();
  for (const a of attempts) {
    skillAttemptCount.set(a.skillId, (skillAttemptCount.get(a.skillId) ?? 0) + 1);
  }
  const skillFreshCount = new Map<string, number>();
  const skillTotalCount = new Map<string, number>();
  for (const q of pool) {
    skillTotalCount.set(q.skill_id, (skillTotalCount.get(q.skill_id) ?? 0) + 1);
  }
  for (const q of fresh) {
    skillFreshCount.set(q.skill_id, (skillFreshCount.get(q.skill_id) ?? 0) + 1);
  }
  const starvedSkills: { skillId: string; skillName: string }[] = [];
  for (const s of SKILLS) {
    const did = skillAttemptCount.get(s.id) ?? 0;
    const total = skillTotalCount.get(s.id) ?? 0;
    const left = skillFreshCount.get(s.id) ?? 0;
    // 只在"题量本来就不少（≥3 道）+ 学生练过 ≥ 5 次 + 真没新题"时才算枯竭。
    // 避免「数位顺序表」这种只有 1-2 题的小 skill 被算成枯竭。
    if (total >= 3 && did >= 5 && left === 0) {
      starvedSkills.push({ skillId: s.id, skillName: s.name });
    }
  }

  return { freshTotal: fresh.length, freshMidterm, starvedSkills };
}
