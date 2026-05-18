/**
 * v0.35.32 Refactor Priority 1: question-级 capabilities helper.
 *
 * 题目 capabilities = 模板 capabilities ∪ 题目自身 hint (requiresScratch / requiresMultiStep).
 *
 * 现 consumer:
 *  - core/timing.ts adjustedEstimatedTime — write-heavy 题型 ×2.5 时间
 *  - pages/Train.tsx countdownEnabled prop — 关倒计时
 *  - components/game/GameShell.tsx — ScratchInsurance 抑制 + 速度档位抑制
 *
 * 注: 这里读 q.play_as 而不是 resolveTemplate(q), 因为 resolveTemplate 在
 * components/ 层, core/ 不应反向依赖. q.play_as 是 AI/admin 显式标的 template hint,
 * 自动 reroute (e.g. requiresCanvasScratch 启发式) 走 question 自己的 requiresScratch flag,
 * 这里 union 覆盖, 等价.
 */
import type { Question, GameTemplate } from "./types";
import {
  getCapabilities,
  type GameCapabilities,
} from "./templateCapabilities";

export function getQuestionCapabilities(q: Question): GameCapabilities {
  const tmplCaps = getCapabilities(q.play_as as GameTemplate | undefined);
  return {
    // requiresScratch 或 requiresMultiStep 任一标了, 视作 write-heavy
    // (即使 play_as 是 plain_numeric / speed_match — 题目自报需要列算式)
    writeHeavy:
      tmplCaps.writeHeavy ||
      q.requiresScratch === true ||
      q.requiresMultiStep === true,
    // suppressesExternalScratchTools / scoreByStepsNotSpeed 跟模板走 — 是 UI 行为, 题目 flag 不决定
    suppressesExternalScratchTools: tmplCaps.suppressesExternalScratchTools,
    scoreByStepsNotSpeed: tmplCaps.scoreByStepsNotSpeed,
  };
}

/**
 * 单字段快捷查询.
 *
 *   if (isWriteHeavyQuestion(q)) return false; // 不开倒计时
 */
export function isWriteHeavyQuestion(q: Question): boolean {
  return getQuestionCapabilities(q).writeHeavy;
}
