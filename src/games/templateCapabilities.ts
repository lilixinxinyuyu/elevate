/**
 * v0.35.32 Refactor Priority 1: GameTemplate Capabilities SSOT.
 *
 * 痛点 (爸爸反馈"sloppy / 改一处忘一处"):
 *   以前每加一个 write-heavy 模板都要同时改 4 个文件 (Train.tsx countdownEnabled,
 *   GameShell.tsx ScratchInsurance suppression × 2, timing.ts isWriteHeavy),
 *   漏一个就 bug. v0.35.26 跟 v0.35.27 各漏过一次.
 *
 * 解法: 模板自我描述 capabilities, 调用方查表.
 *
 * 加一个 write-heavy 模板时:
 *   1. 在下面 CAPABILITY_TABLE 加一行
 *   2. 完
 *
 * 加一个新 capability flag 时:
 *   1. 加到 GameCapabilities type
 *   2. 加 DEFAULT
 *   3. 改需要的 consumer (Train / GameShell / timing 等)
 *
 * 不要在 consumer 里 inline `templateId === "canvas_scratch"` 判断 — 加新模板会漏.
 */
import type { GameTemplate } from "../core/types";

export type GameCapabilities = {
  /**
   * 题型本身耗时长 (画 / 写算式 / 多步), 倒计时关掉 + 用时 ×2.5 + 速度档位不显示.
   * 现 consumer: timing.ts adjustedEstimatedTime, Train.tsx countdownEnabled,
   * GameShell.tsx speed label rendering.
   */
  writeHeavy: boolean;

  /**
   * 模板自带 canvas / 输入面板, GameShell 不再叠加 ScratchInsurance dialog
   * 或 ScratchPanel — 否则会出现 "重复白板" / "未选工具 dialog 拦截已经能写的题".
   */
  hasBuiltInCanvas: boolean;

  /**
   * 用 step 数 / phase 通过情况记分, 而不是速度. 显示速度档位会误导
   * (e.g. multi_step_application Phase 1-3 都过 = 3 个 XP, 跟 elapsedSeconds 无关).
   */
  scoreByStepsNotSpeed: boolean;
};

const DEFAULT_CAPABILITIES: GameCapabilities = {
  writeHeavy: false,
  hasBuiltInCanvas: false,
  scoreByStepsNotSpeed: false,
};

/**
 * 只在这里维护. 加 capability 时 partial 覆盖 default.
 *
 * 注: key 是 GameTemplate union member. TS 不会 enforce 完整覆盖
 * (Partial<Record<...>>), 因为绝大多数模板都用 default — 显式列出反而噪音.
 */
const CAPABILITY_TABLE: Partial<Record<GameTemplate, Partial<GameCapabilities>>> = {
  canvas_scratch: {
    writeHeavy: true,
    hasBuiltInCanvas: true,
  },
  multi_step_application: {
    writeHeavy: true,
    hasBuiltInCanvas: true,
    scoreByStepsNotSpeed: true,
  },
};

/**
 * 查表 — 未注册模板返回全 false default. undefined / null safe.
 */
export function getCapabilities(template: GameTemplate | undefined | null): GameCapabilities {
  if (!template) return { ...DEFAULT_CAPABILITIES };
  const partial = CAPABILITY_TABLE[template];
  if (!partial) return { ...DEFAULT_CAPABILITIES };
  return { ...DEFAULT_CAPABILITIES, ...partial };
}

/**
 * 单字段快捷查询, 给 consumer 写得更可读.
 *
 *   if (isWriteHeavyTemplate(t)) ...
 *
 * 等价于 getCapabilities(t).writeHeavy.
 */
export function isWriteHeavyTemplate(template: GameTemplate | undefined | null): boolean {
  return getCapabilities(template).writeHeavy;
}

export function hasBuiltInCanvas(template: GameTemplate | undefined | null): boolean {
  return getCapabilities(template).hasBuiltInCanvas;
}

export function scoreByStepsNotSpeed(template: GameTemplate | undefined | null): boolean {
  return getCapabilities(template).scoreByStepsNotSpeed;
}
