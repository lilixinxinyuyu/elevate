import Dexie, { type Table } from "dexie";
import type {
  Attempt,
  CurriculumUnit,
  DailySession,
  MasteryScore,
  MistakeReview,
  Question,
  Skill,
  StudentProfile,
  TutorSession,
  UserTrophy,
} from "../core/types";

/** AI 生成的勋章图缓存（base64 持久化，URL 24h 过期） */
export interface TrophyImageRow {
  trophyId: string; // primary key
  /** 跨学科隔离：math / chinese */
  subjectId: "math" | "chinese";
  /** data:image/png;base64,... 持久化用 */
  imageDataUrl: string;
  /** 原始生成 URL（仅留作参考，过期后无效） */
  sourceUrl?: string;
  prompt: string;
  model: string;
  generatedAt: number;
  /** 是否是 lottery 抽奖独家（特殊成就） */
  isLottery?: boolean;
}

export class HepingDB extends Dexie {
  students!: Table<StudentProfile, string>;
  units!: Table<CurriculumUnit, string>;
  skills!: Table<Skill, string>;
  questions!: Table<Question, string>;
  sessions!: Table<DailySession, string>;
  attempts!: Table<Attempt, string>;
  mastery!: Table<MasteryScore, string>;
  mistakes!: Table<MistakeReview, string>;
  trophies!: Table<UserTrophy, string>;
  meta!: Table<{ key: string; value: unknown }, string>;
  trophyImages!: Table<TrophyImageRow, string>;
  /** v0.27.0：小进姐姐对话日志，事后分析 Selena 思维轨迹用 */
  tutorSessions!: Table<TutorSession, string>;

  constructor() {
    super("heping-math-trainer");
    // v1：单学科（math）数据模型。保留 schema 让升级链能跑。
    this.version(1).stores({
      students: "id, name, currentTerm",
      units: "id, term, orderIndex",
      skills: "id, unitId",
      questions: "question_id, skill_id, unit_id, status, game_type, difficulty",
      sessions: "id, studentId, dateKey, mode",
      attempts: "id, studentId, questionId, skillId, createdAt, sessionId",
      mastery: "id, studentId, skillId, score",
      mistakes: "id, studentId, skillId, questionId, nextReviewAt, resolved",
      trophies: "id, studentId, trophyId, unlockedAt",
      meta: "key",
    });

    // v2（多学科架构 Phase 1）：
    //  - 所有学生数据表 + 内容表加 subjectId 索引
    //  - meta key 加 ::<subjectId>:: 段（仅对 per-subject 的 6 类 key 生效）
    //  - 旧数据全部 stamp subjectId="math" —— Selena 现有数据零损失
    this.version(2)
      .stores({
        students: "id, name, currentTerm, currentSubject",
        units: "id, subjectId, term, orderIndex",
        skills: "id, subjectId, unitId",
        questions:
          "question_id, subjectId, skill_id, unit_id, status, game_type, difficulty",
        sessions: "id, studentId, subjectId, dateKey, mode",
        attempts:
          "id, studentId, subjectId, questionId, skillId, createdAt, sessionId",
        mastery: "id, studentId, subjectId, skillId, score",
        mistakes:
          "id, studentId, subjectId, skillId, questionId, nextReviewAt, resolved",
        trophies: "id, studentId, subjectId, trophyId, unlockedAt",
        meta: "key",
      })
      .upgrade(async (tx) => {
        const SUBJECT_TABLES = [
          "units",
          "skills",
          "questions",
          "sessions",
          "attempts",
          "mastery",
          "mistakes",
          "trophies",
        ] as const;
        for (const t of SUBJECT_TABLES) {
          await tx
            .table(t)
            .toCollection()
            .modify((row: Record<string, unknown>) => {
              if (!row.subjectId) row.subjectId = "math";
            });
        }
        await tx
          .table("students")
          .toCollection()
          .modify((s: Record<string, unknown>) => {
            if (!s.currentSubject) s.currentSubject = "math";
          });

        // meta key 命名空间迁移：把六类 per-subject key 加上 ::math:: 段
        // totalXp::studentId       → totalXp::math::studentId
        // rating::studentId        → rating::math::studentId
        // rating::studentId::G4B   → rating::math::studentId::G4B
        // tiersUnlocked::studentId → tiersUnlocked::math::studentId
        // tiersUnlocked::studentId::G4B → tiersUnlocked::math::studentId::G4B
        // equippedBadge::studentId → equippedBadge::math::studentId
        // selectedTerm::studentId  → selectedTerm::math::studentId
        // mockExamLastAt::studentId → mockExamLastAt::math::studentId
        const PER_SUBJ_PREFIXES = [
          "totalXp",
          "rating",
          "tiersUnlocked",
          "equippedBadge",
          "selectedTerm",
          "mockExamLastAt",
        ];
        const allMeta = await tx.table("meta").toArray();
        for (const row of allMeta) {
          for (const p of PER_SUBJ_PREFIXES) {
            // 已经包含 ::math:: 的跳过（防止重复迁移）
            if (
              row.key.startsWith(`${p}::`) &&
              !row.key.startsWith(`${p}::math::`)
            ) {
              const newKey = row.key.replace(`${p}::`, `${p}::math::`);
              await tx.table("meta").delete(row.key);
              await tx.table("meta").put({ ...row, key: newKey });
              break; // 一行只匹配一个前缀
            }
          }
        }

        // 给现有学生（默认 selena）记一下当前学科 = math
        const students = await tx.table("students").toArray();
        for (const s of students) {
          await tx.table("meta").put({
            key: `selectedSubject::${s.id}`,
            value: "math",
          });
        }
      });

    // v3：加 trophyImages 表（AI 生成勋章图缓存）
    this.version(3).stores({
      trophyImages: "trophyId, subjectId, generatedAt",
    });

    // v4 (v0.27.0)：加 tutorSessions 表，记录小进姐姐和 Selena 的所有对话。
    // 事后可以用这个表分析她在哪些 skill 上反复求助、用什么语言描述思路。
    this.version(4).stores({
      tutorSessions: "id, studentId, subjectId, attemptId, questionId, skillId, startedAt, updatedAt",
    });

    // v5 (v0.28.0)：mastery 算法重写 (Elo + 滚动窗口 + Fragility)。
    // 老 mastery row 没有 studentElo / recent / lastSuccessAt 等字段。
    // upgrade 里扫所有 attempts 重放算法，让现有进度直接换算成新分数。
    //
    // 副作用：Selena 之前看到全"熟练"的 skill 都会重新算，预期会下来到
    // "较稳"或"进步中"，跟模考 75% 的真实水平对得上。
    this.version(5).stores({
      // 不改 schema 字段（recent 是数组，不需要 index）。只触发 upgrade hook。
    }).upgrade(async (tx) => {
      const { backfillFromAttempts } = await import("../core/mastery");
      const masteryRows = await tx.table("mastery").toArray();
      const now = Date.now();
      for (const row of masteryRows) {
        // 拿这个 student × skill 的所有历史 attempt
        const attempts = await tx
          .table("attempts")
          .where("studentId")
          .equals(row.studentId)
          .filter((a: { skillId?: string }) => a.skillId === row.skillId)
          .toArray();
        const sorted = attempts
          .map((a: {
            questionId: string;
            isCorrect: boolean;
            createdAt: number;
          }) => ({
            questionId: a.questionId,
            difficulty: 3, // attempts 没存 difficulty，用中位数 3 兜底
            isCorrect: a.isCorrect,
            ts: a.createdAt,
          }))
          .sort((a: { ts: number }, b: { ts: number }) => a.ts - b.ts);
        // 试图从 questions 表查每条 attempt 对应题的 difficulty
        for (const a of sorted) {
          const q = await tx.table("questions").get(a.questionId);
          if (q && typeof q.difficulty === "number") a.difficulty = q.difficulty;
        }
        const re = backfillFromAttempts(sorted, now);
        await tx.table("mastery").put({
          ...row,
          score: re.score,
          studentElo: re.studentElo,
          recent: re.recent,
          attemptsCount: re.attemptsCount,
          correctCount: re.correctCount,
          lastPracticedAt: re.lastPracticedAt,
          lastSuccessAt: re.lastSuccessAt,
          lastErrorAt: re.lastErrorAt,
          updatedAt: now,
        });
      }
    });
  }
}

export const db = new HepingDB();
