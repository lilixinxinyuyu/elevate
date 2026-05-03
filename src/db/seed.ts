import { db } from "./dexie";
import { UNITS } from "../content/units";
import { SKILLS } from "../content/skills";
import { SEED_QUESTIONS } from "../content/questions";
import { validateQuestion } from "../core/validateQuestion";
import type { Question, StudentProfile } from "../core/types";

const SEED_VERSION = 15;
const SEED_KEY = "seedVersion";
const AGENT_PULL_KEY = "agentQuestionsPulledAt";
const AGENT_PULL_INTERVAL = 60 * 60 * 1000; // 每小时最多拉一次 agent 题

export async function ensureSeeded(): Promise<void> {
  const existing = await db.meta.get(SEED_KEY);
  // 不仅看 SEED_VERSION，也看 questions 表是否真的还有数据；
  // 用户在 DevTools 里清了 IndexedDB 但内存里 meta 已经设置过的情况下，仍然会重 seed。
  const hasQuestions = await db.questions.count();
  if (existing?.value === SEED_VERSION && hasQuestions > 0) return;

  await db.transaction("rw", [db.units, db.skills, db.questions, db.students, db.meta], async () => {
    await db.units.bulkPut(UNITS);
    await db.skills.bulkPut(SKILLS);

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
    await db.questions.bulkPut(ok);

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
