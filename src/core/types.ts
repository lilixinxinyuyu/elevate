/**
 * 已登记的学科 id。
 *  - math (Phase 1): 数学全功能
 *  - chinese (Phase 2 MVP): 语文 + 写字表 250 字（v0.31.39）
 *  - english (v0.31.39): 单词记忆 250 词（仅词汇练习页 + 迁移老 data.json）
 *
 * 加学科：在这里加 union，再去 src/subjects/index.ts 登记 Subject 对象。
 *
 * 放在 core/ 而不是 subjects/ 是为了打破循环依赖（subjects/ 依赖 core/）。
 */
export type SubjectId = "math" | "chinese" | "english";

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

export type SessionMode = "normal" | "final_sprint" | "midterm" | "weak_skill" | "review" | "free" | "skill" | "mock_exam" | "big_problems";

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
  | "plain_choice"
  /** Phase 2 Axis 2：点子图画图 — 点击格点构造多边形 */
  | "dot_grid_draw";

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

/**
 * v0.31.73：option 可以带结构化 visual hint，让前端按数位对齐渲染竖式
 * 而不是 fall back 到 ASCII art。
 *
 * 例：用竖式计算 5.09 - 2.30，每个 option 给：
 *   { id: "A", text: "5.09 - 2.3 (末位对齐)",
 *     visual: { type: "vertical_arithmetic", a: "5.09", op: "−", b: "2.3", align: "right" } }
 *   { id: "B", text: "5.09 - 2.30 (小数点对齐)",
 *     visual: { type: "vertical_arithmetic", a: "5.09", op: "−", b: "2.30", align: "decimal" } }
 */
export interface OptionVisual {
  type: "vertical_arithmetic";
  a: string;
  op: string;
  b: string;
  align?: "decimal" | "right";
}

export interface ChoiceOption {
  id: string;
  text: string;
  errorTag?: string;
  /** v0.31.73：可选结构化视觉，前端用 grid 对齐渲染（取代 ASCII art） */
  visual?: OptionVisual;
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
  /**
   * 多学科 Phase 2（语文）：听写题需要播报的文本。
   * 可能与 stem 不同——stem 是题面（"听一听，选出正确的字"），audio_text
   * 是被播报的词（"蜻蜓"）。客户端听写模板 DictationPick 用 src/lib/tts.ts
   * 的 speakText(audio_text) 调 Qwen Cherry 朗读。
   */
  audio_text?: string;
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

  /**
   * 多学科 Phase 3：语文新游戏模板的可选数据载荷。
   * 不存在时模板回退到 plain_choice 渲染。
   *
   * pair_match: 拖/点配对（近反义词、量词、多音字、汉字-拼音 等）
   * sentence_shuffle: 词块按正确顺序点亮组成一句（句子排序、古诗排序、关联词补全）
   * poem_cloze: 填空（古诗 / 课内段落，从字池里挑字进空格）
   *
   * 数学侧不读这些字段，零影响。
   */
  game_data?: ChinesePairMatchData | ChineseSentenceShuffleData | ChinesePoemClozeData;

  /**
   * Phase 2 Axis 2：点子图画图题载荷。
   *
   * 点子图就是网格点阵（W×H），用户点击格点添加顶点，自动连线，闭合后判图形类别。
   * 判分逻辑见 src/components/game/templates/DotGridDraw.tsx。
   */
  dot_grid?: DotGridSpec;
}

/** Phase 2 Axis 2：点子图画图题规格。 */
export interface DotGridSpec {
  /** 格点宽度（含边界点）— 例 6 表示 6×6 = 36 个点 */
  gridWidth: number;
  /** 格点高度 */
  gridHeight: number;
  /**
   * 目标形状类型 — 判分时校验：
   *  - parallelogram: 4 顶点 + 两组对边平行 + 不是矩形
   *  - rectangle: 4 顶点 + 4 个直角
   *  - trapezoid: 4 顶点 + 恰好一组对边平行
   *  - isosceles_triangle: 3 顶点 + 至少两条边等长
   *  - equilateral_triangle: 3 顶点 + 三条边等长
   *  - right_triangle: 3 顶点 + 含直角
   *  - any_triangle: 3 顶点
   */
  targetShape:
    | "parallelogram"
    | "rectangle"
    | "trapezoid"
    | "isosceles_triangle"
    | "equilateral_triangle"
    | "right_triangle"
    | "any_triangle";
  /** 对学生展示的目标名（"等腰三角形"等） */
  targetLabel: string;
  /** 是否要求顶点严格落在格点上（一般 true） */
  snapToDots?: boolean;
}

/** 配对题：左右两列 tile，点左边再点右边配成对，全配对完点提交 */
export interface ChinesePairMatchData {
  kind: "pair_match";
  /** 配对组：left=左列 tile 文本，right=右列 tile 文本 */
  pairs: { left: string; right: string }[];
  /** 左列展示标签（默认 "字 / 词"） */
  leftLabel?: string;
  /** 右列展示标签（默认 "拼音 / 解释"） */
  rightLabel?: string;
}

/** 句子重排：把正确顺序的 tokens 打乱让用户按序点击 */
export interface ChineseSentenceShuffleData {
  kind: "sentence_shuffle";
  /** 正确顺序的词块 */
  tokens: string[];
  /** 完成后展示用的可读句子（默认 join("")） */
  fullSentence?: string;
}

/** 古诗 / 段落填空：模板里 ___ 占位符 + 字池 */
export interface ChinesePoemClozeData {
  kind: "poem_cloze";
  /** 模板，用 ___（三下划线）作为空位占位 */
  template: string;
  /** 按 ___ 出现顺序对应的正确答案 */
  blanks: string[];
  /** 用户可拖/点的字池（包含答案 + 干扰项） */
  pool: string[];
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
  /** v0.31.1：big_problems 闯关模式锁定的单元（用于通关时颁发对应印章） */
  unitId?: string;
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
  /** 本次新解锁/再解锁的奖杯。新字段是 Round 6 加的，老 summary 没有 → optional */
  newTrophies: {
    trophyId: string;
    count: number;
    /** 解锁后的累计总数（计数型），check 单次型恒为 1 */
    newTotalCount?: number;
    /** check 单次型 = true，计数型 = false */
    isRare?: boolean;
    /** v0.29: 进阶勋章在哪个 tier 解锁（铜/银/金/钻），daily/commemorative 无 */
    tier?: TrophyTier;
  }[];
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
  /**
   * v0.31.86: 闯关 session 的"剩余心数"和"实际所得星数"。
   * 由 BossBattle.tsx 在 finalizeSession 之后回写（service 不知道 hearts）。
   * Home 焦点环算今日 boss star 时直接读 bossStars，不再用 starsFromAccuracy(correct,total)
   * 重算（旧调用没传 heartsLeft → 4 星全对的虚高显示）。
   */
  bossStars?: 0 | 1 | 2 | 3 | 4;
  bossHeartsLeft?: number;
  /**
   * v0.30.7: 本次 session 里"用了讲题才做对"的题数（独立答对的不算）。
   * 让家长看到"虽然全对，其中 X 道用了讲题"，避免统计撒谎。
   */
  tutorAssistedCount?: number;
  /**
   * v0.30.7: 第一次就答对的题数（最纯净的"会"指标）。
   * 跟 tutorAssistedCount 相加 ≤ correct（中间还可能有"自己重做对"）。
   */
  firstTryCorrectCount?: number;
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
  /**
   * v0.30.7: 这次答题前是否打开过"小进讲题"（在 1st 错答之后、2nd 提交之前）。
   * - true + isCorrect=true → tutor-assisted 答对，XP×0.7、不增 combo、不奖速度、
   *   mastery 半计；本质上"借助讲解才答对"，不算独立掌握
   */
  usedTutor?: boolean;
  /**
   * v0.30.7: 同一道题在本 session 里第几次作答。
   * - 1 = 第一次作答（正常计分 + 全部加成）
   * - 2 = 1st 错答之后的重做提交（无论对错都不增 combo、不奖速度；usedTutor 进一步降权）
   */
  attemptOrdinal?: 1 | 2;
  createdAt: number;
}

/**
 * Mastery 记录里保留的"近期 attempt 摘要"——给新算法 (v0.28+) 算
 * 滚动窗口加权命中率 + 多样性 + Fragility 用。
 */
export interface MasteryRecentEntry {
  /** 答题时间戳 (createdAt) */
  ts: number;
  /** 是否答对 */
  correct: boolean;
  /** 题目难度 1-5（来自 question.difficulty） */
  difficulty: number;
  /** 题目 id（用于多样性去重） */
  questionId: string;
  /**
   * v0.30.7: 这次是 tutor-assisted 答对吗？
   * 计 weighted accuracy 时 tutor-correct 只算 0.5（不全算"真会"）；
   * Elo 更新里也按 0.5 当 actual 用，避免独立答错却被 tutor 救一下就涨 elo。
   */
  usedTutor?: boolean;
}

export interface MasteryScore {
  id: string;
  studentId: string;
  /** 多学科 v2 */
  subjectId?: SubjectId;
  skillId: string;
  /** 0-100 综合掌握度。v0.28+ 由 computeMasteryScore() 综合算出 */
  score: number;
  attemptsCount: number;
  correctCount: number;
  lastPracticedAt?: number;
  updatedAt: number;

  // === v0.28 新字段（可选，老数据 v5 migration 自动回填）===
  /**
   * 学生在这个 skill 上的 Elo 等级分。每次答题都更新（答对涨、答错跌；
   * 难题涨得更多、简单题几乎不涨）。1200 起始，1700+ ≈ 精通水平。
   * 对应 Duolingo Birdbrain 的 self-calibrating 机制。
   */
  studentElo?: number;
  /**
   * 最近 30 条 attempt 摘要（FIFO，最旧的被挤出）。
   * 用来算 time-decayed accuracy + 多样性奖励。
   */
  recent?: MasteryRecentEntry[];
  /** 上次答对的时间戳（fragility / 遗忘曲线判定用） */
  lastSuccessAt?: number;
  /** 上次答错的时间戳（连错检测用） */
  lastErrorAt?: number;
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

/**
 * v0.29 勋章五大分类 — 影响视觉分组 + AI 图风格 + 解锁叙事
 *
 *  - daily: 日常重复型（今日完成 / 五连击 / 疾风手）— 多次获得，显示 ×N
 *  - milestone: 里程碑进阶（答题大师铜→银→金→钻）— 单槽位 4 等级
 *  - ability: 能力勋章（8 维 calculation/concept/...）— 单槽位 4 等级
 *  - skill: 学科领域勋章（小数小英雄 / 方程小专家）— 单槽位 4 等级
 *  - commemorative: 纪念勋章（第一步 / 期中考完结）— 永久独一，不打等级
 */
export type TrophyCategory =
  | "daily"
  | "milestone"
  | "ability"
  | "skill"
  | "commemorative"
  /** Phase 2 Axis 1：闯关相关勋章（单元印章 / 零提示通关 / 连胜 / 期末大闯关） */
  | "boss";

/** 进阶勋章 4 等级（仅 milestone / ability / skill 用）。daily / commemorative 不打 tier。 */
export type TrophyTier = "bronze" | "silver" | "gold" | "platinum";

export interface TrophyTierThreshold {
  tier: TrophyTier;
  /** 累计达到这个值进入该 tier */
  threshold: number;
  /** 显示用，如 "50 题" / "Elo 600" */
  tierLabel: string;
}

export interface TrophyDef {
  id: string;
  name: string;
  description: string;
  icon?: string;
  /** v0.29 必填：勋章分类 */
  category: TrophyCategory;
  /** 单次解锁逻辑（commemorative 用：条件成立 → 解锁一次永久持有） */
  check?: (ctx: TrophyCheckContext) => boolean;
  /**
   * 计数型解锁：返回当前应该的"进度值"
   * - daily: 累计获得次数（不分等级，UI 直接显示 ×N）
   * - milestone/ability/skill: 当前进度（attempts、Elo、答对题数等），由 tieredThresholds 切等级
   */
  tier?: (ctx: TrophyCheckContext) => number;
  /**
   * v0.29 进阶等级阈值（按 threshold 升序）。
   * 只 milestone / ability / skill 会有；daily / commemorative 留空。
   * UI 用 (tier(ctx) >= threshold) 决定颁发哪一档。
   */
  tieredThresholds?: TrophyTierThreshold[];
  /**
   * v0.31.12: 没解锁就不显示在勋章柜里（隐藏成就）。
   * 用于"未来段位纪念"——蓉城启航 / 天府跃升 / 凤翔九天，避免提前剧透剩余路线，
   * 拿到时才"出现 = 解锁"双重惊喜。
   */
  hiddenUntilUnlocked?: boolean;
}

export interface TrophyCheckContext {
  studentId: string;
  attempts: Attempt[];
  mastery: MasteryScore[];
  mistakes: MistakeReview[];
  trophies: UserTrophy[];
  /** v0.31.8: tutor 学习深度勋章用 — 算"问 + 学会"闭环 */
  tutorSessions?: TutorSession[];
  todayDateKey: string;
}

/**
 * 小进姐姐对话日志 — 每次 Selena 打开 TutorPanel 就建一行；面板内每多一轮（assistant
 * 或 user 任意一方）就 append 进 messages 并更新 updatedAt。
 *
 * v0.27.0 加这个表，目的是事后能分析 Selena 的思维轨迹：哪些题让她卡住、她
 * 怎么用语言描述自己的思路、哪些线索她能接住、哪些她还需要更具体的引导。
 */
export interface TutorMessage {
  role: "assistant" | "user";
  content: string;
  via?: "voice" | "text";
  ts: number;
}

export interface TutorSession {
  /** primary key */
  id: string;
  studentId: string;
  subjectId?: SubjectId;
  /** 触发面板的 attempt（用来事后链回那次答题） */
  attemptId?: string;
  questionId?: string;
  skillId?: string;
  skillName?: string;
  questionStem?: string;
  correctAnswer?: string;
  /** 触发面板时 Selena 的答案（错题才会有） */
  studentInitialAnswer?: string;
  messages: TutorMessage[];
  startedAt: number;
  updatedAt: number;
}
