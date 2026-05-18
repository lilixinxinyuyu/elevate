/**
 * v0.31.51: 客户端运行时调时器 — 长题自动加时间，不动 source 数据。
 *
 * 背景：plain_choice 等题型的 prompt 老写法 hardcode 了
 *   estimated_time_seconds: 20/30/40 by difficulty
 * 不考虑题面 stem 长度 / 选项多行。结果一道 60 字情境题 + 4 行竖式选项被
 * 当成 20s 的题，倒计时跑得飞快、答对了也判"超时不奖速度"，10 岁孩子读字慢被坑。
 *
 * 修复路径有两条：
 *  A) 修 source（每个 question.estimated_time_seconds 写对）— 工作量大
 *  B) **运行时调（这个文件）— scheduler 出题、GameShell 显示、scoring 算速度都走这个 helper**
 *
 * 选 B：DB 不动，新题旧题都受益。同一份逻辑也走 audit-questions.mjs 的检查。
 */
import type { Question } from "./types";

const READ_BONUS_60 = 15;   // stem 60-119 字
const READ_BONUS_120 = 25;  // stem ≥ 120 字（替代 60）
const OPTION_BONUS = 15;    // 任一 option ≥ 20 字 / 多行
const HARD_CAP = 240;       // 最长 240s（语文阅读理解 D5 级别）

/**
 * 按 stem / option 长度给问题加阅读时间。
 * 如果原始 estimated_time_seconds 已经够长（≥ 60s）就不加 — 假定是设计者已经考虑过。
 *
 * v0.35.26 (爸爸 explicit 反复): "需要写草稿或算式回答的题都增加时间或者不要求时间,
 * 因为电脑书写会比选择答案麻烦很多, 时间不太可控". 草稿/列算式/多步应用 ×2.5
 * 或封顶 240s, 让 Selena 不被倒计时催着不写草稿.
 */
export function adjustedEstimatedTime(q: Question): number {
  const base = q.estimated_time_seconds ?? 30;

  // v0.35.26: write-heavy 题型 (canvas_scratch / multi_step_application /
  // requiresScratch=true) 时间放宽到 240s 或 base × 2.5 取大. 电脑书写慢,
  // 不能让倒计时变成"逼着孩子心算"的反向激励.
  const isWriteHeavy =
    q.play_as === "canvas_scratch" ||
    q.play_as === "multi_step_application" ||
    q.requiresScratch === true ||
    q.requiresMultiStep === true;
  if (isWriteHeavy) {
    return Math.min(HARD_CAP, Math.max(base * 2.5, 180));
  }

  // 已经给得很足（60s+）的题不二次加成，避免长应用题被加到 120s+
  if (base >= 60) return Math.min(HARD_CAP, base);

  const stemLen = String(q.stem ?? "").length;
  let bonus = 0;
  if (stemLen >= 120) {
    bonus += READ_BONUS_120;
  } else if (stemLen >= 60) {
    bonus += READ_BONUS_60;
  }

  // options 数组（plain_choice / true_false_swipe 等带选项的题型）
  const opts = (q as { options?: { text?: string }[] }).options;
  if (Array.isArray(opts) && opts.length > 0) {
    let longestOpt = 0;
    for (const o of opts) {
      const t = String(o?.text ?? "");
      if (t.length > longestOpt) longestOpt = t.length;
    }
    if (longestOpt >= 20) bonus += OPTION_BONUS;
  }

  return Math.min(HARD_CAP, base + bonus);
}
