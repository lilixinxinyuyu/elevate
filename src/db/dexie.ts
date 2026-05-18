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
import type { FluencyAttemptRow, FluencyStatsRow } from "../core/fluencyTypes";

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

/**
 * v0.35.15 iter 45 P3-1: 纸面试卷错题 row.
 *
 * 爸爸在 admin /math/paper-entry 录入一份 paper × N 错题 → 推送到 OSS
 * `users/{cadetUid}/paper-mistakes/{paperId}.json`. 这边 cloudSync pull
 * 下来按"一行一道纸面错题"打平存表. Selena 端 /math/paper-mistakes 列出
 * 让她"再写一次答案", reviewedAt 记录她已复习的时间.
 *
 * 关键: 完全独立于 db.mistakes — 不 dilute mastery, 不算 SRS, 不入主 attempts.
 * 只是给 Selena 一个"爸爸帮我记的纸面错题在这" 的入口. 配合 EXAM_PAPER_PACK
 * (硬编码真题题库) 形成"线上 + 线下 错题双闭环".
 */
export interface PaperMistakeRow {
  /** primary key, 组合 `${studentId}::${paperId}::${paperQuestionId}` */
  id: string;
  studentId: string;
  /** 这份 paper 的 ID (一份 paper 多道 row 共享) */
  paperId: string;
  /** 这道纸面题在 paper 内的 ID (admin 端 genPaperMistakeId 生成的) */
  paperQuestionId: string;
  /** 题干 */
  stem: string;
  /** 正解 */
  correctAnswer: string;
  /** Selena 当时写的错答 */
  studentAnswer: string;
  /** 错因 tag (admin 选的) */
  errorTag?: string;
  /** admin 备注 (可选) */
  notes?: string;
  /** 试卷类型 */
  paperKind: "midterm" | "final" | "homework" | "quiz" | "other";
  /** 试卷名称/标题 */
  paperTitle: string;
  /** admin 推送时间 */
  pushedAt: number;
  /** Selena 端复习过的时间 (null = 未复); 复习后写答 + 标对错都记进 reviewLog */
  reviewedAt?: number;
  /** Selena 端再答的内容 + 自评 (可多次) */
  reviewLog?: { ts: number; myAnswer: string; correct: boolean }[];
}

/** v0.31.22：小进衣柜（mascotWardrobe）— Selena 用装扮卡 AI 生成的造型。 */
export interface MascotWardrobeRow {
  id: string;
  studentId: string;
  subjectId: string;
  /** 用户起的名字或自动总结的 */
  name: string;
  /** AI 生成时用的 prompt（让 Selena 看到 + 复现） */
  prompt: string;
  /** 完整造型图，PNG/JPG blob，~50-200KB（已压缩） */
  blob: Blob;
  mime: string;
  width: number;
  height: number;
  /** 当前是否佩戴（同 student 同时只一件 equipped；切换时另一件 equipped=0） */
  equipped: 0 | 1;
  createdAt: number;
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
  /** Phase 2 (v0.31.0)：Fluency 口算每道题的 attempt 记录 — 完全独立于
   * 主 attempts 表，不进 XP / 段位 / 主 mastery */
  fluencyAttempts!: Table<FluencyAttemptRow, string>;
  /** Phase 2 (v0.31.0)：Fluency 单 module × 单 student 的累计 stats */
  fluencyStats!: Table<FluencyStatsRow, string>;
  /** v0.31.22：小进衣柜 — AI 生成的造型 outfit */
  mascotWardrobe!: Table<MascotWardrobeRow, string>;
  /** v0.35.15 iter 45 P3-1：爸爸录入的纸面试卷错题. 跟 db.mistakes 完全独立, 不进 mastery (评审 B 防污染). */
  paperMistakes!: Table<PaperMistakeRow, string>;

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

    // v6 (Phase 2 / v0.31.0)：加 fluency 两张表 — 跟主 attempts/mastery 完全分离。
    // Fluency 是底层口算训练（9×9、20 内加减、凑整），不进 XP / 段位 / 主错题，
    // 自己一套 stats 体系。
    this.version(6).stores({
      fluencyAttempts:
        "id, studentId, moduleId, sessionId, problemKey, isCorrect, createdAt",
      fluencyStats: "id, studentId, moduleId, mastered, masteredAt",
    });

    // v7 (v0.31.22)：小进衣柜 — Selena 用"装扮卡"AI 生成的造型 outfit。
    // 每条 row = 一个完整造型（image blob + prompt + 元数据）。
    // 卡片余额放 db.meta::wardrobeCards::math::<studentId>，不在表里。
    this.version(7).stores({
      mascotWardrobe: "id, studentId, subjectId, equipped, createdAt",
    });

    // v8 (v0.35.15 iter 45 P3-1): 纸面试卷错题 (爸爸 admin 录入, 从 OSS pull).
    // 完全独立, 不进 mastery / mistakes / attempts. Selena 端只读 + 自己再写一次答案. row 表示
    // 一个 paper × paper_mistake 组合 (一份 paper 可能多条). reviewedAt 索引用于"待复"过滤.
    this.version(8).stores({
      paperMistakes: "id, studentId, paperId, paperQuestionId, pushedAt, reviewedAt",
    });
  }
}

export const db = new HepingDB();
