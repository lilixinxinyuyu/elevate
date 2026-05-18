/**
 * v0.35.33 Refactor Priority 2: SSOT 常量 — Session 尺寸 / 题数.
 *
 * 痛点 (爸爸 v0.35.30 第 5 次反馈 "Selena 看到 17 题"):
 *   scheduler.ts baseTarget=15 → 改成 10 后忘了 Home.tsx 还有 challengeTarget: 15
 *   hardcode → TodayRings 显示 "0/15 题" 跟 scheduler "10 道" 不匹配, 看上去就像
 *   17 题 bug 重现. 真源头: **同一个语义常量在 N 个地方独立写**.
 *
 * 改这里 → 全应用一致. 任何 "今日挑战题数" 概念都 import DAILY_CHALLENGE_TARGET,
 * 不准再 hardcode 10 / 15.
 *
 * 加新模式 (e.g. WARMUP) → 在这里加常量 + scheduler 路由 + 入口 UI 都 import. 不准 hardcode.
 */

/**
 * 普通"今日挑战" 一日题数. v0.35.30 从 15 → 10 (爸爸反馈 "孩子做太多累").
 *
 * Consumer:
 *  - core/scheduler.ts buildNormalSession baseTarget
 *  - pages/Home.tsx challengeTarget (TodayRings 进度环)
 */
export const DAILY_CHALLENGE_TARGET = 10;

/**
 * 期末冲刺 (final_sprint) 单 session 题数. 比 daily 多 3 题, 5 大单元覆盖更密.
 *
 * Consumer:
 *  - core/scheduler.ts buildFinalSprint baseTarget
 *  - (未来 Home 显示冲刺进度环 也要 import 这个)
 */
export const FINAL_SPRINT_TARGET = 13;

/**
 * 模拟考 (mock_exam) 用户可选尺寸下限 / 上限 / 默认.
 *
 * v0.35.10 ExamPrep dashboard 传 ?size=30|60|80; Train.tsx 验证范围.
 * 默认 30 跟期中卷一样, 60/80 期末模拟.
 *
 * Consumer:
 *  - pages/Train.tsx overrideTargetCount 范围检查
 *  - core/scheduler.ts mock_exam 路径 clamp
 *  - pages/ExamPrep.tsx 入口 size 选择
 */
export const MOCK_EXAM_MIN_SIZE = 20;
export const MOCK_EXAM_MAX_SIZE = 100;
export const MOCK_EXAM_DEFAULT_SIZE = 30;

/**
 * Session "题数实在不够" 兜底门槛. scheduler 抽不到这么多就标 poolStarved → UI 提示用户.
 */
export const MIN_VALID_SESSION_SIZE = 6;
