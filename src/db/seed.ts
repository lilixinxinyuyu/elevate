import { db } from "./dexie";
import { UNITS } from "../content/units";
import { SKILLS } from "../content/skills";
import { SEED_QUESTIONS } from "../content/questions";
import { validateQuestion } from "../core/validateQuestion";
import type { Question, StudentProfile } from "../core/types";

// v0.28.3 (SEED_VERSION 20)：重写 7 道用 "输 N" 指令式说法的题（"0.30 和 0.3，
// 相等输 0" 这类令人困惑的句式）改成自然中文 "答 N" / 直接问数字。同时补 8 道
// decimal_compare 高质量题。bump version 让现有设备重新导入更新过的 stem。
const SEED_VERSION = 20;
const SEED_KEY = "seedVersion";
const AGENT_PULL_KEY = "agentQuestionsPulledAt";
const AGENT_PULL_INTERVAL = 60 * 60 * 1000; // 每小时最多拉一次 agent 题

/**
 * v0.26.3 起 seed 题统一 stamp subjectId="math"。
 * UNITS / SKILLS 也同样 stamp（之前 schema 加了字段但没填值）。
 */
function stampMathSubject<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((r) => ({ ...r, subjectId: r.subjectId ?? "math" }));
}

export async function ensureSeeded(): Promise<void> {
  const existing = await db.meta.get(SEED_KEY);
  const hasQuestions = await db.questions.count();
  // 即使 seed 已最新，也要跑 v7 迁移（一次性，幂等）
  if (existing?.value === SEED_VERSION && hasQuestions > 0) {
    pullAgentQuestionsIfStale().catch(() => {});
    migrateAttemptScoresV7().catch((e) => console.warn("[migrate v7] failed:", e));
    // v19 一次性补 stamp（即使 seed 没动也跑）
    void backfillMissingSubjectIds().catch(() => {});
    return;
  }

  await db.transaction("rw", [db.units, db.skills, db.questions, db.students, db.meta], async () => {
    // v19: stamp subjectId="math" on all seed rows（之前没 stamp 导致 admin 诊断
    // 显示 720/720 都是 undef）
    await db.units.bulkPut(stampMathSubject(UNITS as unknown as Record<string, unknown>[]) as never);
    await db.skills.bulkPut(stampMathSubject(SKILLS as unknown as Record<string, unknown>[]) as never);

    const ok: typeof SEED_QUESTIONS = [];
    const bad: { id: string; issues: string[] }[] = [];
    for (const q of SEED_QUESTIONS) {
      const r = validateQuestion(q);
      if (r.ok && r.question) ok.push(r.question);
      else bad.push({ id: q.question_id, issues: r.issues.map((i) => `${i.severity}: ${i.path} ${i.message}`) });
    }
    if (bad.length > 0) {
      console.warn("[seed] 以下题目校验失败，未导入：", bad);
    }
    await db.questions.bulkPut(stampMathSubject(ok as unknown as Record<string, unknown>[]) as never);

    const existing = await db.students.get("default-student");
    const now = Date.now();
    if (!existing) {
      const defaultStudent: StudentProfile = {
        id: "default-student",
        name: "Selena",
        grade: 4,
        textbook: "BNU_2013_G4",
        currentTerm: "下册",
        currentUnitId: "G4B_U3_DECIMAL_MULTIPLY",
        dailyLimitMin: 15,
        createdAt: now,
        updatedAt: now,
      };
      await db.students.put(defaultStudent);
    } else if (existing.name === "小禾") {
      // 升级到 v2 后默认名改为 Selena
      await db.students.put({ ...existing, name: "Selena", updatedAt: now });
    }

    await db.meta.put({ key: SEED_KEY, value: SEED_VERSION });
  });

  // seed 完后顺手拉一次 agent 题（不阻塞首屏）
  pullAgentQuestionsIfStale().catch(() => {/* 网络问题 / 后端没启都不报 */});

  // v7：检查是否需要按新规则迁移历史 attempts 的 XP（一次性）
  migrateAttemptScoresV7().catch((e) => console.warn("[migrate v7] failed:", e));

  // v19: backfill subjectId
  void backfillMissingSubjectIds().catch(() => {});
}

/**
 * v19 一次性补 stamp：把所有 subjectId=null/undef 的题/skill/unit 标成 "math"。
 *
 * 背景：seed.ts v7-v18 期间 db.questions.bulkPut(SEED_QUESTIONS) 没填 subjectId，
 * 而 dexie v2 migration 只在升级时跑一次。如果用户先升级、后从 cloud 拉新 seed，
 * 这些 row 就永远 undef。诊断面板显示 720/720 都是 undef 就是这个 bug。
 */
const BACKFILL_KEY = "subjectIdBackfill_v19";
async function backfillMissingSubjectIds(): Promise<void> {
  const meta = await db.meta.get(BACKFILL_KEY);
  if (meta?.value === true) return;
  let touched = 0;
  const stamp = (row: { subjectId?: string }) => {
    if (!row.subjectId) {
      row.subjectId = "math";
      touched++;
    }
  };
  await db.transaction("rw", [db.questions, db.skills, db.units, db.meta], async () => {
    await db.questions.toCollection().modify(stamp);
    await db.skills.toCollection().modify(stamp);
    await db.units.toCollection().modify(stamp);
    await db.meta.put({ key: BACKFILL_KEY, value: true });
  });
  if (touched > 0) {
    console.log(`[backfill v19] stamped subjectId=math on ${touched} rows`);
  }
}

/**
 * v7 计分规则迁移：把历史 attempts 的 scoreDelta.total 按新规则重算。
 * - 重做递减：每个 questionId 第 N 次答对乘 [1.0, 0.5, 0.2, 0.1, 0]
 * - 新 skill 首次答对 +5
 *
 * 用 meta.scoreVersion 标记，跑过一次就不再跑。
 */
const SCORE_VERSION_KEY = "scoreVersion";
const SCORE_VERSION_V7 = "v7-repeat-decay-new-skill-bonus";
const MIGRATION_NOTICE_KEY = "v7MigrationNoticeAcked";

export async function migrateAttemptScoresV7(): Promise<{ migrated: number; oldTotalXp: number; newTotalXp: number } | null> {
  const meta = await db.meta.get(SCORE_VERSION_KEY);
  if (meta?.value === SCORE_VERSION_V7) return null;

  const REPEAT_DECAY = [1.0, 0.5, 0.2, 0.1];
  const NEW_SKILL_BONUS = 5;

  const allAttempts = (await db.attempts.toArray()).sort((a, b) => a.createdAt - b.createdAt);
  if (allAttempts.length === 0) {
    await db.meta.put({ key: SCORE_VERSION_KEY, value: SCORE_VERSION_V7 });
    return { migrated: 0, oldTotalXp: 0, newTotalXp: 0 };
  }

  const correctOnQuestion = new Map<string, number>();
  const correctOnSkill = new Set<string>();
  let oldTotalXp = 0;
  let newTotalXp = 0;

  for (const attempt of allAttempts) {
    oldTotalXp += attempt.scoreDelta?.total ?? 0;
    if (attempt.isCorrect) {
      const studentSkillKey = `${attempt.studentId}::${attempt.skillId}`;
      const studentQKey = `${attempt.studentId}::${attempt.questionId}`;
      const priorCorrect = correctOnQuestion.get(studentQKey) ?? 0;
      const decay = priorCorrect >= REPEAT_DECAY.length ? 0 : REPEAT_DECAY[priorCorrect] ?? 0;

      const isFirstSkillCorrect = !correctOnSkill.has(studentSkillKey);

      // 把原 total 乘 decay（原始公式没有 decay，所以原 total 就是"无 decay 的全分"）
      const decayed = Math.max(0, Math.round((attempt.scoreDelta?.total ?? 0) * decay));
      const bonus = isFirstSkillCorrect ? NEW_SKILL_BONUS : 0;
      const newTotal = decayed + bonus;

      attempt.scoreDelta = { ...attempt.scoreDelta, total: newTotal };
      newTotalXp += newTotal;

      correctOnQuestion.set(studentQKey, priorCorrect + 1);
      if (isFirstSkillCorrect) correctOnSkill.add(studentSkillKey);
    } else {
      // 错答不变
      newTotalXp += attempt.scoreDelta?.total ?? 0;
    }
  }

  // bulk update
  await db.transaction("rw", [db.attempts, db.meta, db.students], async () => {
    for (const a of allAttempts) {
      await db.attempts.put(a);
    }
    await db.meta.put({ key: SCORE_VERSION_KEY, value: SCORE_VERSION_V7 });
    await db.meta.put({ key: MIGRATION_NOTICE_KEY, value: false });
    // 更新所有学生的 totalXp
    const students = await db.students.toArray();
    for (const stu of students) {
      const studentXp = allAttempts
        .filter((a) => a.studentId === stu.id)
        .reduce((s, a) => s + (a.scoreDelta?.total ?? 0), 0);
      await db.meta.put({ key: `totalXp::${stu.id}`, value: studentXp });
    }
  });

  console.log(`[migrate v7] ${allAttempts.length} attempts: ${oldTotalXp} → ${newTotalXp} XP`);
  return { migrated: allAttempts.length, oldTotalXp, newTotalXp };
}

export async function getMigrationNoticeUnacked(): Promise<boolean> {
  const r = await db.meta.get(MIGRATION_NOTICE_KEY);
  return r?.value === false;
}

export async function ackMigrationNotice(): Promise<void> {
  await db.meta.put({ key: MIGRATION_NOTICE_KEY, value: true });
}

/**
 * 拉 agent 出的题（/api/agent/questions）合并到本地题库。
 * 每小时拉一次。失败静默：app 主体不依赖这个。
 */
export async function pullAgentQuestionsIfStale(force = false): Promise<{ added: number; skipped: number } | null> {
  try {
    const last = await db.meta.get(AGENT_PULL_KEY);
    const lastTs = typeof last?.value === "number" ? (last.value as number) : 0;
    if (!force && Date.now() - lastTs < AGENT_PULL_INTERVAL) return null;

    const resp = await fetch("/api/agent/questions");
    if (!resp.ok) return null;
    const data = (await resp.json()) as { ok: boolean; questions?: Question[] };
    if (!data.ok || !Array.isArray(data.questions)) return null;

    let added = 0;
    let skipped = 0;
    const accepted: Question[] = [];
    for (const q of data.questions) {
      const r = validateQuestion(q);
      if (r.ok && r.question) {
        accepted.push(r.question);
        added += 1;
      } else {
        skipped += 1;
      }
    }
    if (accepted.length > 0) {
      await db.questions.bulkPut(accepted);
    }
    await db.meta.put({ key: AGENT_PULL_KEY, value: Date.now() });
    if (added > 0) {
      console.log(`[seed] pulled ${added} agent question(s); skipped ${skipped}`);
    }
    return { added, skipped };
  } catch (e) {
    console.warn("[seed] agent question pull failed", e);
    return null;
  }
}

export async function resetAllData(): Promise<void> {
  await db.delete();
  window.location.reload();
}

/**
 * 只清空"进度数据"：sessions / attempts / mastery / mistakes / trophies / xp meta
 * 题库（units / skills / questions）和学生档案保留不动。
 * 用于一键擦掉测试时积累的脏数据，重新开始挑战。
 */
export async function resetProgressOnly(): Promise<void> {
  await db.transaction(
    "rw",
    [db.sessions, db.attempts, db.mastery, db.mistakes, db.trophies, db.meta],
    async () => {
      await db.sessions.clear();
      await db.attempts.clear();
      await db.mastery.clear();
      await db.mistakes.clear();
      await db.trophies.clear();
      // 把所有 totalXp:: 开头的 meta 也清掉
      const metaRows = await db.meta.toArray();
      const xpKeys = metaRows.filter((r) => r.key.startsWith("totalXp::")).map((r) => r.key);
      if (xpKeys.length > 0) await db.meta.bulkDelete(xpKeys);
    },
  );
}
