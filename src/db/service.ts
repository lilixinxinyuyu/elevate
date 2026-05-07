import { db } from "./dexie";
import { getUnlockedUnitIdSet } from "./unitUnlock";
import { buildDailySession } from "../core/scheduler";
import { scoreAttempt, levelFromXp } from "../core/scoring";
import { applyAttempt, MASTERY_BOUNDS } from "../core/mastery";
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
import { UNITS } from "../content/units";
import { todayKey } from "../lib/date";
import { uid } from "../lib/format";
import type { Term } from "../core/types";

const SKILL_MAP = new Map(SKILLS.map((s) => [s.id, s]));
const UNIT_TERM = new Map(UNITS.map((u) => [u.id, u.term]));

export async function getDefaultStudent(): Promise<StudentProfile> {
  const list = await db.students.toArray();
  if (list.length === 0) throw new Error("没有学生档案");
  return list[0]!;
}

/**
 * v0.31.12: 入口被动 trophy 检查。
 *
 * 跟 session 结束时的 commit 走同一份 checkAndAwardTrophies 逻辑，但只在
 * 入口（Layout）触发——用于"已经满足条件但还没做完一局"场景。
 * 典型用例：
 *   - 时间触发型 commemorative（新学期/期中/期末/生日）：日期到了即解锁，不必再答题
 *   - 跨段型 commemorative（破晓登阶）：上次跨段是历史事件，本次进 app 即补发
 *
 * 不弹 lottery（lottery 由 Train 结算页负责）；只把记录写进 db.trophies。
 * 返回新颁发数量，调用方可以决定是否提示。
 */
export async function runPassiveTrophyCheck(studentId: string): Promise<string[]> {
  const [allAttempts, mastery, mistakes, trophies, tutorSessions] = await Promise.all([
    db.attempts.where({ studentId }).toArray(),
    db.mastery.where({ studentId }).toArray(),
    db.mistakes.where({ studentId }).toArray(),
    db.trophies.where({ studentId }).toArray(),
    db.tutorSessions.where({ studentId }).toArray(),
  ]);
  const awards = checkAndAwardTrophies({
    studentId,
    attempts: allAttempts,
    mastery,
    mistakes,
    trophies,
    tutorSessions,
    todayDateKey: todayKey(),
  });
  // 只补 commemorative 类（时间型 + 跨段型），其他类别按设计应在 session 结束时颁发
  const commemorativeAwards = awards.filter((aw) => {
    const def = TROPHIES.find((t) => t.id === aw.trophyId);
    return def?.category === "commemorative";
  });
  for (const aw of commemorativeAwards) {
    for (let i = 0; i < aw.count; i++) {
      const t: UserTrophy = {
        id: uid("t-"),
        studentId,
        subjectId: "math",
        trophyId: aw.trophyId,
        unlockedAt: Date.now(),
        meta: aw.tier ? { tier: aw.tier } : undefined,
      };
      await db.trophies.put(t);
    }
  }
  // v0.31.13: 返回新颁发的 trophyId 列表（不是 count），让 Layout 用来弹 lottery 庆祝。
  return commemorativeAwards.map((aw) => aw.trophyId);
}

export interface SessionOptions {
  mode?: SessionMode;
  selectedSkillIds?: string[];
  /** 即便今天已有相同 mode 的 session，也强制新建一组 */
  fresh?: boolean;
  /** v0.31.1：big_problems 模式可指定单元（点 G4B U1 闯关 → 只选该单元的大题） */
  unitId?: string;
}

export async function getOrCreateSession(
  studentId: string,
  opts: SessionOptions = {},
): Promise<{ session: DailySession; questions: Question[]; poolStarved?: boolean; starvedSkillIds?: string[] }> {
  const student = await db.students.get(studentId);
  if (!student) throw new Error("学生不存在");
  const mode = opts.mode ?? "normal";
  const dateKey = todayKey();

  // 当前选学期决定题库范围：
  //   "下册" → 只出 G4B unit 的题
  //   "上册" → 只出 G4A unit 的题
  //   "综合复习" → 不过滤（上下册混合）
  // 期中冲刺/期末冲刺有自己的 hard-coded 范围（在 scheduler 里），不被 term 覆盖。
  const term = await getSelectedTerm(studentId);

  // session cache key 现在带 term，避免"切学期了还在沿用上一学期那套题"
  if (!opts.fresh && !opts.selectedSkillIds) {
    const existing = await db.sessions
      .where({ studentId, dateKey })
      .filter((s) => s.mode === mode && !s.finishedAt && (s.term ?? "下册") === term)
      .first();
    if (existing) {
      const questions = await fetchQuestionsOrdered(existing.questionIds);
      return { session: existing, questions };
    }
  }

  // 按 term 过滤题库
  const allQuestions = await db.questions.toArray();
  let pool = filterQuestionsByTerm(allQuestions, mode, term);

  // v0.30.9: 按"学期进度（已解锁单元）"过滤——避免 U5/U6 没学过的题被选进每日挑战。
  // 期中/期末/模拟考有 hard-coded 单元范围（scheduler 内处理），不再叠加 unlock 过滤。
  if (mode !== "midterm" && mode !== "final_sprint" && mode !== "mock_exam") {
    const unlocked = await getUnlockedUnitIdSet(studentId, term);
    pool = pool.filter((q) => unlocked.has(q.unit_id));
  }

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
    unitId: opts.unitId,
    rngSeed: `${studentId}:${mode}:${term}:${dateKey}:${opts.unitId ?? ""}:${Date.now()}:${Math.random()}`,
  });
  const session: DailySession = {
    id: uid("s-"),
    studentId,
    subjectId: "math", // 多学科 v2：service.ts 当前是 math 单学科作用域
    dateKey,
    mode,
    term, // 把本次 session 锁定到这个学期，结算时算 XP 用
    plannedMinutes: student.dailyLimitMin,
    questionIds: plan.questionIds,
    selectedSkillIds: opts.selectedSkillIds,
    unitId: opts.unitId,
    startedAt: Date.now(),
  };
  await db.sessions.put(session);
  const questions = await fetchQuestionsOrdered(plan.questionIds);
  return { session, questions, poolStarved: plan.poolStarved, starvedSkillIds: plan.starvedSkillIds };
}

/**
 * 按学期过滤题库。
 * - midterm / final_sprint 模式自带 hard-coded 范围 (scheduler 里处理)，term 不再过滤
 * - "综合复习" 不过滤
 * - 否则按 unit.term 过滤
 */
function filterQuestionsByTerm(
  qs: Question[],
  mode: SessionMode,
  term: Term,
): Question[] {
  if (mode === "midterm" || mode === "final_sprint" || mode === "mock_exam") return qs;
  // big_problems：跨学期挑硬题，不按学期过滤（D3-D4 大题哪个学期来都行）
  if (mode === "big_problems") return qs;
  if (term === "综合复习") return qs;
  return qs.filter((q) => UNIT_TERM.get(q.unit_id) === term);
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
  /**
   * v0.30.7: 这次答题前是否打开过"小进讲题"。
   * usedTutor + isCorrect → 计 XP 70%、不增 combo、Elo 半计、weighted accuracy 半计、
   * 不解锁 mistake stage（防"讲一下就算复习通关"）
   */
  usedTutor?: boolean;
  /**
   * v0.30.7: 这是同一道题在本 session 的第几次提交。
   * - 1: 第一次（含直接答对、直接答错、答错后会进 retry 阶段都先记 ordinal=1）
   * - 2: 1st 错答之后的重做提交
   *
   * combo 只在 ordinal=1 && correct && !usedTutor 时 +1（"独立连续答对"才算 combo）。
   * mistake stage 只在 ordinal=1 时变化（避免 1st-wrong 后 2nd-correct 立即把 mistake 推进）。
   */
  attemptOrdinal?: 1 | 2;
}

export interface AttemptOutcome {
  attempt: Attempt;
  points: number;
  comboAfter: number;
  /** 0-1 倍率：0.5 / 0.2 / 0.1 / 0 表示重做递减；1.0 表示首次答对（不显示） */
  repeatDecay: number;
  /** 5 = 这道题让她解锁了新 skill 的首次答对（应高亮） */
  newSkillBonus: number;
  /** 错题故事化：本次错答命中的 errorTag 在历史上踩过几次 + 几道老题 */
  errorPattern?: {
    matchedTag: string;
    tagLabel: string;
    remediation: string | null;
    pastQuestions: { questionId: string; stem: string; happenedAt: number }[];
  } | null;
}

export async function submitAttempt(input: SubmitAttemptInput): Promise<AttemptOutcome> {
  const {
    studentId, session, question, userAnswer,
    isCorrect, partialCorrect, matchedErrorTags, hintsOpened, elapsedSeconds, comboBeforeAttempt,
  } = input;
  const usedTutor = !!input.usedTutor;
  const attemptOrdinal: 1 | 2 = input.attemptOrdinal ?? 1;
  const isFirstAttempt = attemptOrdinal === 1;

  const existingMistake = await db.mistakes
    .where({ studentId, questionId: question.question_id })
    .first();
  const isReview = !!existingMistake && !existingMistake.resolved;

  // v0.30.7: combo 只在"第一次独立答对"时 +1（"独立连续答对"勋章语义）
  // - 第一次答错 → combo reset（current behavior）
  // - 第二次提交（不管对错、不管 tutor）→ combo 不增也不会再 reset
  // - tutor-assisted 答对 → 不增 combo
  let comboAfter: number;
  if (isCorrect && isFirstAttempt && !usedTutor) {
    comboAfter = comboBeforeAttempt + 1;
  } else if (!isCorrect && isFirstAttempt) {
    comboAfter = 0;
  } else {
    // 2nd 提交 — combo 沿用（已经在 1st-wrong 时 reset 到 0 了）
    comboAfter = comboBeforeAttempt;
  }

  // 重复递减：之前答对过这道题的次数
  const priorCorrectCount = isCorrect
    ? await db.attempts
        .where("studentId").equals(studentId)
        .filter((a) => a.questionId === question.question_id && a.isCorrect)
        .count()
    : 0;

  // v0.30.12: 同 skill 历史 correct 总数（用于 sibling decay 防"姊妹题刷分"）
  // - 一次 query 拿到 skill 全部 correct count
  // - 仅 isCorrect=true 时计算（错答不需要这个数据）
  const skillCorrectCount = isCorrect
    ? await db.attempts
        .where("studentId").equals(studentId)
        .filter((a) => a.skillId === question.skill_id && a.isCorrect)
        .count()
    : 0;

  // 新知识点首次答对：之前从来没有答对过该 skill 的任何一道题
  const isNewSkill = isCorrect && skillCorrectCount === 0;

  const delta = scoreAttempt({
    question,
    isCorrect,
    partialCorrect,
    hintsOpened,
    elapsedSeconds,
    isReview,
    comboAfter,
    priorCorrectCount,
    isNewSkill,
    usedTutor,
    attemptOrdinal,
    skillCorrectCount, // v0.30.12: 防"姊妹题刷分"
  });

  const priorMastery = await db.mastery.get(masteryId(studentId, question.skill_id));

  // v0.28 新算法：用 applyAttempt() 增量更新（内部跑 Elo + 滚动窗口 + Fragility）
  // v0.30.7: usedTutor 透传，tutor-assisted 答对 Elo actual=0.5
  const masteryNow = Date.now();
  const masteryUpdate = applyAttempt(
    priorMastery,
    {
      questionId: question.question_id,
      difficulty: question.difficulty,
      isCorrect,
      usedTutor,
      ts: masteryNow,
    },
    masteryNow,
  );
  const newMasteryScore = masteryUpdate.next.score;
  const masteryDelta = masteryUpdate.delta;

  const attempt: Attempt = {
    id: uid("a-"),
    studentId,
    subjectId: "math",
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
    usedTutor: usedTutor || undefined,
    attemptOrdinal,
    createdAt: Date.now(),
  };

  await db.transaction("rw", [db.attempts, db.mastery, db.mistakes, db.meta], async () => {
    await db.attempts.put(attempt);

    const next: MasteryScore = {
      id: masteryId(studentId, question.skill_id),
      studentId,
      subjectId: "math",
      skillId: question.skill_id,
      ...masteryUpdate.next,
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
          subjectId: "math",
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
      // v0.30.7：保护 mistake stage —— 第二次提交（同 session 立即重做）不应推进
      // mistake review，那是"刷一道讲一下就算掌握"的漏洞。仅 1st-attempt 答对才算
      // 真正"复习成功 → 推进 stage"。tutor-assisted 答对也不推进（半信半疑）。
      const shouldAdvance = isFirstAttempt && !usedTutor;
      if (shouldAdvance) {
        const newStage = advanceStageOnSuccess(existingMistake.stage);
        if (newStage >= REVIEW_INTERVAL_DAYS.length) {
          existingMistake.resolved = true;
        } else {
          existingMistake.stage = newStage;
          existingMistake.nextReviewAt = nextReviewAt(newStage);
        }
      }
      existingMistake.lastAttemptAt = Date.now();
      await db.mistakes.put(existingMistake);
    }

    // 更新 totalXp meta
    const xpMeta = await db.meta.get(studentKey("totalXp", studentId));
    const prevXp = typeof xpMeta?.value === "number" ? (xpMeta.value as number) : 0;
    await db.meta.put({ key: studentKey("totalXp", studentId), value: prevXp + delta.total });
  });

  // ROI #3：错题故事化（仅在错且有 errorTag 时计算）。考试模式不计算（节省时间）
  let errorPattern: AttemptOutcome["errorPattern"] = null;
  if (!isCorrect && matchedErrorTags.length > 0 && session.mode !== "mock_exam") {
    try {
      const raw = await getErrorPatternForAttempt(studentId, matchedErrorTags, question.question_id);
      if (raw) {
        errorPattern = {
          matchedTag: raw.matchedTag,
          tagLabel: errorTagLabel(raw.matchedTag),
          remediation: raw.remediation,
          pastQuestions: raw.pastQuestions,
        };
      }
    } catch { /* 静默：分析失败不影响主流程 */ }
  }

  return {
    attempt,
    points: delta.total,
    comboAfter,
    repeatDecay: delta.repeatDecay,
    newSkillBonus: delta.newSkillBonus,
    errorPattern,
  };
}

export async function getTotalXp(studentId: string): Promise<number> {
  const row = await db.meta.get(studentKey("totalXp", studentId));
  if (!row) return 0;
  return typeof row.value === "number" ? row.value : 0;
}

/**
 * Per-学期缓存的综合分。每个学期是独立赛季。
 */
export async function getCachedRating(
  studentId: string,
  term: import("../core/types").Term | null = null,
): Promise<{ score: number; tierId: string; computedAt: number } | null> {
  const key = term ? termKey("rating", studentId, term) : studentKey("rating", studentId);
  const row = await db.meta.get(key);
  if (!row || typeof row.value !== "object" || !row.value) return null;
  return row.value as { score: number; tierId: string; computedAt: number };
}

/**
 * 实时计算综合分（按学期过滤）。term=null 时算所有数据（兼容旧 UI）。
 */
export async function computeCurrentRating(
  studentId: string,
  term: import("../core/types").Term | null = null,
) {
  const attempts = await db.attempts.where({ studentId }).toArray();
  const mastery = await db.mastery.where({ studentId }).toArray();
  return computeRating(attempts, mastery, Date.now(), term);
}

/** 已解锁的段位列表（每学期独立） */
export async function getUnlockedTiers(
  studentId: string,
  term: import("../core/types").Term | null = null,
): Promise<string[]> {
  const key = term ? termKey("tiersUnlocked", studentId, term) : studentKey("tiersUnlocked", studentId);
  const row = await db.meta.get(key);
  if (!row || !Array.isArray(row.value)) return ["school"];
  return row.value as string[];
}

/** 当前佩戴的段位勋章（**全局共享**，不分学期：你只戴一枚） */
export async function getEquippedBadge(studentId: string): Promise<string> {
  const row = await db.meta.get(studentKey("equippedBadge", studentId));
  if (row && typeof row.value === "string") return row.value;
  // 默认佩戴所有学期里最高的段位
  const allTerms: import("../core/types").Term[] = ["上册", "下册", "综合复习"];
  let best = "school";
  for (const t of allTerms) {
    const u = await getUnlockedTiers(studentId, t);
    for (const id of u) {
      if (tierIndex(id) > tierIndex(best)) best = id;
    }
  }
  return best;
}

export async function setEquippedBadge(studentId: string, tierId: string): Promise<void> {
  if (!tierById(tierId)) return;
  // 校验：任何一个学期里解锁过都行
  const allTerms: import("../core/types").Term[] = ["上册", "下册", "综合复习"];
  let unlockedSomewhere = false;
  for (const t of allTerms) {
    const u = await getUnlockedTiers(studentId, t);
    if (u.includes(tierId)) { unlockedSomewhere = true; break; }
  }
  if (!unlockedSomewhere) return;
  await db.meta.put({ key: studentKey("equippedBadge", studentId), value: tierId });
}

/** 当前选择的学期（UI selector），默认 student.currentTerm */
export async function getSelectedTerm(studentId: string): Promise<import("../core/types").Term> {
  const row = await db.meta.get(studentKey("selectedTerm", studentId));
  if (row && typeof row.value === "string") return row.value as import("../core/types").Term;
  const student = await db.students.get(studentId);
  return (student?.currentTerm as import("../core/types").Term) ?? "下册";
}

export async function setSelectedTerm(
  studentId: string,
  term: import("../core/types").Term,
): Promise<void> {
  await db.meta.put({ key: studentKey("selectedTerm", studentId), value: term });
}

/**
 * 多学科架构 Phase 1：所有 service.ts 内部的 meta key 都用学科段。
 * Phase 1 service.ts 还是 math 单学科作用域（chinese 是 ComingSoon 没 DB 写入），
 * 所以这里硬编码 "math"。Phase 2 chinese 接入真实数据时，这里要改成接受 subjectId
 * 参数并由调用点传入。
 *
 * key 形态（与 Dexie v2 upgrade 产生的形态一致）：
 *   xpKey     = "totalXp::math::<studentId>"
 *   termKey   = "rating::math::<studentId>::G4B"
 *   mockExam  = "mockExamLastAt::math::<studentId>"
 */
const SUBJECT_NAMESPACE = "math";

function termKey(
  name: string,
  studentId: string,
  term: import("../core/types").Term,
): string {
  // 用 ASCII 短码避免中文 key 处处出现
  const code = term === "上册" ? "G4A" : term === "下册" ? "G4B" : "MIX";
  return `${name}::${SUBJECT_NAMESPACE}::${studentId}::${code}`;
}

function studentKey(name: string, studentId: string): string {
  return `${name}::${SUBJECT_NAMESPACE}::${studentId}`;
}

function masteryId(studentId: string, skillId: string): string {
  // Phase 1：mastery row id 不动（math 单学科 skill id 不会和 chinese 撞）。
  // Phase 2 加 chinese 数据时再 bump 成 ${studentId}::${subjectId}::${skillId}。
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

  // v0.30.7：按 questionId 去重，让"total / correct"反映"题数"而不是"提交次数"。
  // 一道题可能有 2 个 attempt（1st 错 + 2nd 对）—— 这种 total 算 1 道，correct 算 1 道，
  // 同时 tutorAssistedCount/firstTryCorrectCount 给家长看"水分"。
  const byQuestion = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const list = byQuestion.get(a.questionId) ?? [];
    list.push(a);
    byQuestion.set(a.questionId, list);
  }
  // 每个 question 的最终 outcome：以最后一次提交为准
  type QOutcome = { isCorrect: boolean; usedTutor: boolean; firstTryCorrect: boolean };
  const perQuestion: QOutcome[] = [];
  for (const list of byQuestion.values()) {
    list.sort((a, b) => (a.attemptOrdinal ?? 1) - (b.attemptOrdinal ?? 1));
    const last = list[list.length - 1]!;
    const first = list[0]!;
    perQuestion.push({
      isCorrect: last.isCorrect,
      usedTutor: !!last.usedTutor,
      firstTryCorrect: first.isCorrect && (first.attemptOrdinal ?? 1) === 1,
    });
  }
  const total = perQuestion.length;
  const correct = perQuestion.filter((q) => q.isCorrect).length;
  const accuracy = total === 0 ? 0 : correct / total;
  // tutor-assisted correct：最终对的题里，最后一次提交带 usedTutor=true 的
  const tutorAssistedCount = perQuestion.filter((q) => q.isCorrect && q.usedTutor).length;
  // 第一次就答对（独立答对）：最纯净的"会"指标
  const firstTryCorrectCount = perQuestion.filter((q) => q.firstTryCorrect).length;
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
  // v0.31.8: tutor_companion "小进知音"勋章需要 tutor sessions 算闭环
  const tutorSessions = await db.tutorSessions.where({ studentId }).toArray();
  const newTrophyAwards = checkAndAwardTrophies({
    studentId,
    attempts: allAttempts,
    mastery,
    mistakes,
    trophies,
    tutorSessions,
    todayDateKey: todayKey(),
  });
  for (const award of newTrophyAwards) {
    for (let i = 0; i < award.count; i++) {
      const t: UserTrophy = {
        id: uid("t-"),
        studentId,
        subjectId: "math",
        trophyId: award.trophyId,
        unlockedAt: Date.now(),
        // v0.29 新增：tiered 勋章带 tier，让 UI 显示正确等级 + 让 awarder 不重发同 tier
        meta: award.tier ? { tier: award.tier } : undefined,
      };
      await db.trophies.put(t);
    }
  }

  // v0.31.1：闯关印章 + 闯关相关勋章。
  //   通过条件：mode=big_problems + 5/5 中 ≥ 4 道对（accuracy ≥ 0.8）
  //   单元印章: trophyId = boss_<unitId>_master
  //   零提示通关: 整场没开过 hint
  //   闯关首通: 首次任意通过任意单元
  //   闯关连胜: meta:bossWinStreak 累计，>= 5 拿
  //   期末大闯关: session.final=1 + 通过 → boss_final_master
  if (session.mode === "big_problems") {
    const passed = total > 0 && correct >= Math.ceil(total * 0.8);
    if (passed) {
      const noHints = attempts.every((a) => (a.hintsOpened ?? 0) === 0);
      const trophiesToAdd: { id: string; meta?: Record<string, unknown> }[] = [];

      // 单元印章
      if (session.unitId) {
        const bossId = `boss_${session.unitId}_master`;
        if (!trophies.some((t) => t.trophyId === bossId)) {
          trophiesToAdd.push({ id: bossId });
        }
      }
      // 闯关首通
      if (!trophies.some((t) => t.trophyId === "boss_first_pass")) {
        trophiesToAdd.push({ id: "boss_first_pass" });
      }
      // 零提示通关
      if (noHints && !trophies.some((t) => t.trophyId === "boss_no_hint")) {
        trophiesToAdd.push({ id: "boss_no_hint" });
      }
      // 闯关连胜（meta key 累加）
      const streakRow = await db.meta.get("bossWinStreak::math::" + studentId);
      const streak = ((streakRow?.value as number | undefined) ?? 0) + 1;
      await db.meta.put({ key: "bossWinStreak::math::" + studentId, value: streak });
      if (streak >= 5 && !trophies.some((t) => t.trophyId === "boss_win_streak_5")) {
        trophiesToAdd.push({ id: "boss_win_streak_5" });
      }
      if (streak >= 10 && !trophies.some((t) => t.trophyId === "boss_win_streak_10")) {
        trophiesToAdd.push({ id: "boss_win_streak_10" });
      }

      for (const x of trophiesToAdd) {
        await db.trophies.put({
          id: uid("t-"),
          studentId,
          subjectId: "math",
          trophyId: x.id,
          unlockedAt: Date.now(),
          meta: x.meta,
        });
        // 也加进 newTrophyAwards 让 SessionSummary UI 弹出
        newTrophyAwards.push({
          trophyId: x.id,
          count: 1,
          newTotalCount: 1,
          isRare: true,
        });
      }
    } else {
      // 失败重置连胜
      await db.meta.put({ key: "bossWinStreak::math::" + studentId, value: 0 });
    }
  }

  const xpGained = totalPoints;
  const totalXpNow = await getTotalXp(studentId);
  const levelAfter = levelFromXp(totalXpNow);
  const levelBefore = levelFromXp(totalXpNow - xpGained);

  // 综合分 + 段位升档判定（**按本次会话的学期算**）
  // session.term 在 getOrCreateSession 时锁定；老 session（v0.16 之前）没有 term 字段，
  // 退化到当前选学期 / student.currentTerm
  const student = await db.students.get(studentId);
  const term: import("../core/types").Term =
    session.term ??
    (await getSelectedTerm(studentId).catch(() => null)) ??
    (student?.currentTerm as import("../core/types").Term) ??
    "下册";

  const prevRating = await getCachedRating(studentId, term);
  const rating = computeRating(allAttempts, mastery, Date.now(), term);
  await db.meta.put({
    key: termKey("rating", studentId, term),
    value: {
      score: rating.score,
      tierId: rating.tier.id,
      computedAt: Date.now(),
    },
  });
  // 解锁段位（追加，不删）—— per-term
  const prevUnlocked = await getUnlockedTiers(studentId, term);
  const unlocked = new Set(prevUnlocked);
  unlocked.add("school"); // 永远有起步段
  if (!unlocked.has(rating.tier.id)) unlocked.add(rating.tier.id);
  if (unlocked.size !== prevUnlocked.length) {
    await db.meta.put({
      key: termKey("tiersUnlocked", studentId, term),
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
    tutorAssistedCount,
    firstTryCorrectCount,
  };

  session.finishedAt = Date.now();
  session.summary = summary;
  await db.sessions.put(session);

  // v0.31.22：完成一个 session（≥ 5 题，准确率 ≥ 50%）→ 给 1 张装扮卡
  // 不必考虑成绩：完整把题做完就奖励，让 Selena 想多解锁衣装就多做题。
  // 太简单 / 没努力的 session（1-4 题或 < 50% 正确）不给，避免刷。
  if (total >= 5 && accuracy >= 0.5) {
    try {
      const { awardWardrobeCard } = await import("../lib/mascotWardrobe");
      await awardWardrobeCard(studentId, 1);
    } catch (e) {
      console.warn("[finalizeSession] award wardrobe card failed:", e);
    }
  }

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

/* ============================================================
   ROI 改进 #1：错题三阶段 — 红旗 skill 检测
   ------------------------------------------------------------
   当一个 skill 出现"反复尝试都过不去"的迹象时，红旗给爸妈关注：
   - 该 skill 最近 7 天答题 ≥ 3 次
   - 最近 3 次都错（连错）
   - mistakes 表中有未解决条目
   "三天后用同 skill 不同 surface 还错" 的判定通过 mistakes.stage 退步检测。
   ============================================================ */
const WEEK = 7 * 24 * 60 * 60 * 1000;
export async function getStruggleSkills(studentId: string): Promise<{
  skillId: string;
  skillName: string;
  consecutiveWrong: number;
  totalRecent: number;
}[]> {
  const now = Date.now();
  const attempts = await db.attempts.where({ studentId }).toArray();
  const recent = attempts.filter((a) => a.createdAt >= now - WEEK);

  // 按 skillId 分组、按时间排序
  const bySkill = new Map<string, typeof recent>();
  for (const a of recent) {
    const arr = bySkill.get(a.skillId) ?? [];
    arr.push(a);
    bySkill.set(a.skillId, arr);
  }

  const out: { skillId: string; skillName: string; consecutiveWrong: number; totalRecent: number }[] = [];
  for (const [skillId, list] of bySkill) {
    if (list.length < 3) continue;
    list.sort((a, b) => b.createdAt - a.createdAt); // 最新优先
    // 统计末尾连续错的数量
    let conseq = 0;
    for (const a of list) {
      if (a.isCorrect) break;
      conseq += 1;
    }
    if (conseq >= 3) {
      const skill = SKILL_MAP.get(skillId);
      out.push({
        skillId,
        skillName: skill?.name ?? skillId,
        consecutiveWrong: conseq,
        totalRecent: list.length,
      });
    }
  }
  out.sort((a, b) => b.consecutiveWrong - a.consecutiveWrong);
  return out;
}

/* ============================================================
   ROI 改进 #2：考试模拟 — 周节流
   ------------------------------------------------------------
   保证 mock_exam 一周一次（前一次完成至少 6 天后才能再开）。
   防止把"考试模拟"也当日常刷的高难题包用，失去模拟意义。
   ============================================================ */
const MOCK_EXAM_LAST_KEY = "mockExamLastAt";
export async function getMockExamCooldown(studentId: string): Promise<{
  available: boolean;
  daysUntilNext: number;
  lastAt: number | null;
}> {
  const row = await db.meta.get(studentKey(MOCK_EXAM_LAST_KEY, studentId));
  const lastAt = typeof row?.value === "number" ? (row.value as number) : null;
  if (lastAt === null) return { available: true, daysUntilNext: 0, lastAt: null };
  const days = (Date.now() - lastAt) / (24 * 60 * 60 * 1000);
  if (days >= 6) return { available: true, daysUntilNext: 0, lastAt };
  return { available: false, daysUntilNext: Math.ceil(6 - days), lastAt };
}

export async function recordMockExamCompleted(studentId: string): Promise<void> {
  await db.meta.put({ key: studentKey(MOCK_EXAM_LAST_KEY, studentId), value: Date.now() });
}

/* ============================================================
   ROI 改进 #3：错题故事化 — 错误模式分析
   ------------------------------------------------------------
   给定本次 attempt 命中的 errorTags，回查历史 attempts 找出该学生
   在哪些"以往题目"上踩过同样的坑。返回最多 2 道老题做对照，让 Selena
   看到「我这个错不是第一次了」，把孤立的题目错串成成长叙事。
   ============================================================ */
export async function getErrorPatternForAttempt(
  studentId: string,
  currentErrorTags: string[],
  excludeQuestionId?: string,
): Promise<{
  matchedTag: string;
  remediation: string | null;
  pastQuestions: { questionId: string; stem: string; happenedAt: number }[];
} | null> {
  if (currentErrorTags.length === 0) return null;
  const tagSet = new Set(currentErrorTags);

  // 取最近 50 道错题，找命中相同 errorTag 的
  const allAttempts = await db.attempts.where({ studentId }).reverse().limit(80).toArray();
  const sameTagAttempts = allAttempts.filter((a) =>
    !a.isCorrect &&
    a.questionId !== excludeQuestionId &&
    a.errorTags.some((t) => tagSet.has(t)),
  );
  if (sameTagAttempts.length === 0) return null;

  // 选最高频的 tag 做主线
  const tagCount = new Map<string, number>();
  for (const a of sameTagAttempts) {
    for (const t of a.errorTags) {
      if (tagSet.has(t)) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    }
  }
  const matchedTag = Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!matchedTag) return null;

  // 取这个 tag 下最近 2 道题（去重，按时间倒排）
  const seen = new Set<string>();
  const pastList: { questionId: string; stem: string; happenedAt: number }[] = [];
  for (const a of sameTagAttempts) {
    if (!a.errorTags.includes(matchedTag)) continue;
    if (seen.has(a.questionId)) continue;
    seen.add(a.questionId);
    const q = await db.questions.get(a.questionId);
    if (q) {
      pastList.push({
        questionId: a.questionId,
        stem: q.stem.length > 50 ? q.stem.slice(0, 50) + "…" : q.stem,
        happenedAt: a.createdAt,
      });
    }
    if (pastList.length >= 2) break;
  }
  if (pastList.length === 0) return null;

  // 找 remediation：从"最近一道含 matchedTag 的题"的 common_errors 里取
  let remediation: string | null = null;
  for (const a of sameTagAttempts) {
    if (!a.errorTags.includes(matchedTag)) continue;
    const q = await db.questions.get(a.questionId);
    const e = q?.common_errors.find((ce) => ce.tag === matchedTag);
    if (e?.remediation) { remediation = e.remediation; break; }
  }

  return { matchedTag, remediation, pastQuestions: pastList };
}

/** 把 errorTag 的英文/标识符映射到中文给 UI 显示 */
export function errorTagLabel(tag: string): string {
  const map: Record<string, string> = {
    decimal_point_error: "小数点位置错",
    careless_reading: "看错题",
    relation_model_error: "数量关系搞错",
    concept_confuse: "概念混淆",
    place_value_error: "数位看错",
    average_formula_error: "平均数公式错",
    tail_zero: "末位 0 处理错",
    reverse: "运算顺序反了",
    wrong_op: "运算符号选错",
    wrong_model: "题意建模错",
    no_unknown: "误判方程",
    no_equal_sign: "缺等号",
    not_equation: "误判方程",
    formula_wrong: "公式记错",
    median_confuse: "中位数/平均数混淆",
    place_skip: "数位跳格",
    place_wrong: "数位写错",
    subset: "子集分类混淆",
    confuse: "类别混淆",
    violation: "三边关系不成立",
    view_confuse: "视角看错",
    all_views: "把所有面都数了",
    all_faces: "把所有面都数了",
    above_one: "看错位置",
    missed_3: "漏掉系数",
    area: "周长/面积混了",
    perimeter: "周长/面积混了",
    perimeter_half: "周长/面积混了",
    format_wrong: "字母表达式简写错",
    wrong_class: "三角形分类错",
    wrong_calc: "算错",
    alternative: "另一种正确写法",
    missing_50: "漏掉条件",
  };
  return map[tag] ?? tag;
}
