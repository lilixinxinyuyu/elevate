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
  UserTrophy,
} from "../core/types";

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

  constructor() {
    super("heping-math-trainer");
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
  }
}

export const db = new HepingDB();
