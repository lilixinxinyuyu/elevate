/**
 * 已登记的学科 id。多学科 Phase 1 包含 math + chinese；english 还没注册。
 * 加学科：在这里加 union，再去 src/subjects/index.ts 登记 Subject 对象。
 *
 * 放在 core/ 而不是 subjects/ 是为了打破循环依赖（subjects/ 依赖 core/）。
 */
export type SubjectId = "math" | "chinese";

export type AbilityId =
  | "calculation"
  | "concept"
  | "reasoning"
  | "modeling"
  | "spatial"
  | "data"
  | "strategy"
  | "habit";

export const ABILITY_LABELS: Record<AbilityId, string> = {
  calculation: "计算力",
  concept: "概念力",
  reasoning: "推理力",
  modeling: "建模力",
  spatial: "空间力",
  data: "数据力",
  strategy: "策略力",
  habit: "坚持力",
};

export type Term = "上册" | "下册" | "综合复习";

export type ExamPriority =
  | "MUST_BIG"
  | "HIGH_BIG"
  | "MUST_SMALL"
  | "VERY_HIGH_SMALL"
  | "HIGH_SMALL"
  | "NORMAL"
  | "LOW"
  | "LOW_SMALL"
  | "EXTENSION";

export type SkillPriority =
  | "VERY_HIGH"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "EXTENSION";

export type QuestionFormat =
  | "numeric"
  | "numeric_choice"
  | "single_choice"
  | "multi_choice"
  | "multi_step"
  | "fill_blank"
  | "drag_drop"
  | "sort_ladder"
  | "geometry_operation";

export type CognitiveLevel = "recall" | "procedural" | "application" | "reasoning";

export type SessionMode = "normal" | "final_sprint" | "midterm" | "weak_skill" | "review" | "free" | "skill" | "mock_exam";

export type GameTemplate =
  | "speed_match"
  | "shop_counter"
  | "equation_builder"
  | "clue_finder"
  | "sort_ladder"
  | "chart_detective"
  | "shape_court"
  | "triangle_judge"
  | "cube_view"
  | "true_false_swipe"
  | "vertical_repair"
  | "decimal_shifter"
  | "memory_match"
  | "balance_lab"
  | "plain_numeric"
  | "plain_choice";

export interface CurriculumUnit {
  id: string;
  /** 多学科 v2：所属学科。Dexie 升级时旧数据 stamp 为 "math"。 */
  subjectId?: SubjectId;
  term: Term;
  orderIndex: number;
  name: string;
  description?: string;
  priority: SkillPriority | "VERY_HIGH";
}

export interface Skill {
  id: string;
  /** 多学科 v2 */
  subjectId?: SubjectId;
  unitId: string;
  name: string;
  ability: AbilityId[];
  difficultyBase: number;
  priority: SkillPriority | "VERY_HIGH_SMALL";
  examPriority: ExamPriority;
  recommendedGameTypes?: string[];
  preferredTemplate?: GameTemplate;
}

export interface ExamPriorityItem {
  rank: number;
  name: string;
  unitIds: string[];
  skillIds: string[];
  weight: number;
  minQuestionsPerSession: number;
}

export interface NumericAnswer {
  type: "number";
  value: number;
  unit?: string;
  acceptable_error?: number;
}
export interface ChoiceAnswer {
  type: "choice";
  value: string;
}
export interface MultiStepAnswer {
  type: "multi_step";
  steps: { step_id: string; expected: string | number; kind?: "relationship" | "expression" | "answer" }[];
}
export type AnswerSpec = NumericAnswer | ChoiceAnswer | MultiStepAnswer;

export interface ChoiceOption {
  id: string;
  text: string;
  errorTag?: string;
}

export interface CommonError {
  tag: string;
  error: string;
  remediation: string;
}

export interface WordProblemSteps {
  known: string[];
  question: string;
  relationship: string;
  equation_or_expression: string;
  check: string;
}

export interface Hint {
  text: string;
  penalty?: number; // 默认 1
}

/** 线索挑选 */
export interface ClueSubquestion {
  kind: "clue_pick";
  prompt: string;
  clues: string[];            // 全部候选
  correct: number[];          // 正确索引
  mode: "pick_correct" | "pick_wrong";
  hint?: string;
}

export interface ChooseSubquestion {
  kind: "choose";
  prompt: string;
  options: { id: string; text: string; correct: boolean; errorTag?: string }[];
  multi?: boolean;
  hint?: string;
}

export interface NumericSubquestion {
  kind: "numeric";
  prompt: string;
  value: number;
  acceptable_error?: number;
  unit?: string;
  distractors?: number[];     // 提供则以 4 选 1 呈现
  hint?: string;
}

export type SubQuestion = ClueSubquestion | ChooseSubquestion | NumericSubquestion;

export interface Question {
  question_id: string;
  /** 多学科 v2 */
  subjectId?: SubjectId;
  version: number;
  status: "draft" | "validated" | "approved" | "active" | "retired" | "needs_review" | "rejected";
  source?: {
    curriculum?: string;
    basis?: string;
    copyright_safe?: boolean;
    original?: boolean;
  };
  grade: 4;
  term: Term;
  unit_id: string;
  unit_name?: string;
  skill_id: string;
  skill_name?: string;
  ability_dimension: AbilityId[];
  exam_priority: ExamPriority;
  game_type: string;
  play_as?: GameTemplate;
  cognitive_level: CognitiveLevel;
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimated_time_seconds: number;
  stem: string;
  question_format: QuestionFormat;
  options?: ChoiceOption[];
  distractors?: (string | number)[];
  answer: AnswerSpec;
  solution_steps: string[];
  word_problem_steps?: WordProblemSteps;
  subquestions?: SubQuestion[];
  hints?: Hint[];
  common_errors: CommonError[];
  feedback_correct: string;
  feedback_wrong: string;
  parent_tip?: string;
  variant_rules?: {
    same_skill?: boolean;
    change_numbers?: boolean;
    change_context?: boolean;
    preserve_difficulty?: boolean;
  };
  review_interval_days?: number[];
  tags?: string[];
  safety_check?: Record<string, boolean>;
}

export interface StudentProfile {
  id: string;
  name: string;
  grade: number;
  textbook: string;
  currentTerm: Term;
  /** 多学科 v2：上次进入的学科 id，用于 picker 的"继续上次"按钮。 */
  currentSubject?: SubjectId;
  currentUnitId?: string;
  dailyLimitMin: number;
  createdAt: number;
  updatedAt: number;
}

export interface DailySession {
  id: string;
  studentId: string;
  /** 多学科 v2 */
  subjectId?: SubjectId;
  dateKey: string;
  mode: SessionMode;
  /** 本次 session 所属的学期；XP 算到这个学期的赛季总分里 */
  term?: Term;
  plannedMinutes: number;
  questionIds: string[];
  selectedSkillIds?: string[];
  startedAt?: number;
  finishedAt?: number;
  summary?: SessionSummary;
}

export interface SessionSummary {
  total: number;
  correct: number;
  accuracy: number;
  totalPoints: number;
  abilityPoints: Partial<Record<AbilityId, number>>;
  masteryImprovements: { skillId: string; skillName: string; from: number; to: number }[];
  needReview: { skillId: string; skillName: string }[];
  /** 本次新解锁/再解锁的奖杯，每个 trophyId 带这次拿到的次数 */
  newTrophies: { trophyId: string; count: number }[];
  suggestionForTomorrow: string;
  maxCombo: number;
  fastestSeconds: number;
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  dateKey: string;
  /** 综合分变化（本次结算后） */
  ratingBefore?: number;
  ratingAfter?: number;
  /** 跨段升档：第一次进入更高段位时填，触发解锁动画 */
  tierUpgrade?: { fromTierId: string; toTierId: string };
}

export interface Attempt {
  id: string;
  studentId: string;
  /** 多学科 v2 */
  subjectId?: SubjectId;
  questionId: string;
  skillId: string;
  sessionId?: string;
  answer: unknown;
  isCorrect: boolean;
  partialCorrect?: boolean;
  stepResults?: { step_id: string; ok: boolean }[];
  hintsOpened: number;
  elapsedSeconds: number;
  errorTags: string[];
  scoreDelta: { total: number; byAbility: Partial<Record<AbilityId, number>> };
  masteryDelta: number;
  isReview: boolean;
  comboAtEnd: number;
  createdAt: number;
}

export interface MasteryScore {
  id: string;
  studentId: string;
  /** 多学科 v2 */
  subjectId?: SubjectId;
  skillId: string;
  score: number;
  attemptsCount: number;
  correctCount: number;
  lastPracticedAt?: number;
  updatedAt: number;
}

export interface MistakeReview {
  id: string;
  studentId: string;
  /** 多学科 v2 */
  subjectId?: SubjectId;
  questionId: string;
  skillId: string;
  stage: number;
  nextReviewAt: number;
  lastAttemptAt: number;
  errorTags: string[];
  resolved: boolean;
}

export interface UserTrophy {
  id: string;
  studentId: string;
  /** 多学科 v2 */
  subjectId?: SubjectId;
  trophyId: string;
  unlockedAt: number;
  meta?: Record<string, unknown>;
}

export interface TrophyDef {
  id: string;
  name: string;
  description: string;
  icon?: string;
  /** 单次解锁逻辑（条件成立 → 解锁一次，永久持有） */
  check?: (ctx: TrophyCheckContext) => boolean;
  /** 计数型解锁：返回当前应该已经获得的总次数；系统会和已记录数对比补发差额 */
  tier?: (ctx: TrophyCheckContext) => number;
}

export interface TrophyCheckContext {
  studentId: string;
  attempts: Attempt[];
  mastery: MasteryScore[];
  mistakes: MistakeReview[];
  trophies: UserTrophy[];
  todayDateKey: string;
}
