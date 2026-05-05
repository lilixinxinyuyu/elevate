/**
 * Fluency（口算基本功）模式核心类型。
 *
 * 设计原则：**完全独立于现有 Question/Attempt/Mastery 系统**——
 * fluency 是底层"速度+准确"训练，不进 XP / 段位 / 主 mastery / 主错题表，
 * 否则会污染 Selena 现有的成就经济。
 *
 * 跟 Question 的关键差别：
 *   - 没有 game_template / hints / solution_steps —— fluency 题秒答秒下一道
 *   - 没有 question_id —— 每次访问随机生成（key 只用作 dedup 和 stats 聚合）
 *   - 没有 ability 多维度 —— 只有 speed + accuracy 两轴
 *
 * Phase 2 doc: docs/phase2-plan.md (Axis 3)
 */

/** Fluency 模块分类 — 决定模块封面颜色 + 勋章主题 */
export type FluencyCategory =
  | "multiplication" // 乘法口诀
  | "addition" // 加法
  | "subtraction" // 减法
  | "division" // 除法
  | "decimal" // 小数加减口算
  | "mixed"; // 混合

/** 一道 fluency 题（生成时即时构造，不持久化） */
export interface FluencyProblem {
  /** 规范化 key（用于 stats 聚合 + dedup），例如 "9x7" / "15+8" */
  key: string;
  /** 显示在屏幕上的题干，例如 "9 × 7" */
  stem: string;
  /** 正确答案（数字） */
  correctAnswer: number;
  /** 3 个干扰项（也是数字），跟 correct 一起组成 4 选 */
  distractors: number[];
}

/** 一个 fluency 模块（按年级/学期开放） */
export interface FluencyModule {
  /** 唯一 id，跟 trophyId 前缀对应（如 mul_table_9） */
  id: string;
  /** 中文显示名（"9×9 乘法口诀"） */
  name: string;
  /** 模块卡片右上 chip 用（"×9"、"+20"） */
  shortLabel: string;
  /** 一行说明（"99 道乘法口诀，1-9 全表"） */
  description: string;
  /** 分类，决定颜色主题 */
  category: FluencyCategory;
  /** 适用年级（如 [3, 4, 5]）— Fluency Home 按当前 grade 过滤 */
  grades: number[];
  /** 颜色主题（Tailwind from-X to-Y） */
  themeColor: string;
  /** Emoji icon（卡片左上角） */
  icon: string;
  /** 出题函数 — 每次调用返回一道新题 */
  generate: () => FluencyProblem;
  /** 这个模块的"满分"基准：speed/p50（毫秒）和 accuracy（0-1）。
   *  达到的话 trophy 升级。 */
  masteryThreshold: {
    /** 50% 题反应时低于这个值才"快"（毫秒）。例 9×9 = 3000ms */
    p50LatencyMs: number;
    /** 准确率达到这个值才"准"。例 0.95 */
    accuracy: number;
    /** 至少做过 N 题（避免 5 题就算"达标"） */
    minAttempts: number;
  };
}

/** 一次 fluency 答题记录（持久化到 db.fluencyAttempts） */
export interface FluencyAttemptRow {
  id: string;
  studentId: string;
  moduleId: string;
  /** problem.key —— 用于按题型聚合 */
  problemKey: string;
  /** 学生选的答案（数字），错就记录 */
  selectedAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
  /** 反应时（ms，从题展示到点击） */
  latencyMs: number;
  /** session 标识 — 一次 60s 训练算一个 session */
  sessionId: string;
  createdAt: number;
}

/** 单 module × 单 student 的累计统计（持久化到 db.fluencyStats） */
export interface FluencyStatsRow {
  /** key 格式：`${studentId}::${moduleId}` */
  id: string;
  studentId: string;
  moduleId: string;
  totalAttempts: number;
  totalCorrect: number;
  /** 50 / 95 百分位反应时（ms） */
  p50LatencyMs: number;
  p95LatencyMs: number;
  /** 历史最长连击（同一 session 内连续答对） */
  bestStreak: number;
  /** 最近一次 session 的关键指标（首页卡片要显示） */
  lastSession: {
    at: number;
    attempts: number;
    correct: number;
    p50LatencyMs: number;
    streak: number;
  } | null;
  /** 当前是否已达 module mastery */
  mastered: boolean;
  masteredAt: number | null;
}

/** 一次 60s 训练 session 跑完后的结果摘要（用于结算页） */
export interface FluencySessionResult {
  moduleId: string;
  sessionId: string;
  durationMs: number; // 实际跑了多长（≤ 60_000）
  totalAttempts: number;
  totalCorrect: number;
  /** 当次 session 的 p50 / p95 反应时（ms） */
  p50LatencyMs: number;
  p95LatencyMs: number;
  /** 当次 session 的最长连击 */
  longestStreak: number;
  /** 比上次进步了多少（正数=快了 ms） */
  speedDeltaMs: number | null;
  /** 是否本次 session 触发了 mastery 解锁 */
  newlyMastered: boolean;
  /** 是否本次 session 解锁了新 trophy（trophyId 列表） */
  unlockedTrophies: string[];
}
