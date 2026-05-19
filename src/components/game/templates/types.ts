/**
 * v0.35.53 Refactor Priority 19: 模板组件公用 types SSOT.
 *
 * 把 TemplateRenderProps + TriggerFx + AttemptResult 从 GameShell.tsx 移到这里.
 * 让 templateRegistry.tsx 不再需要 `import type {...} from "./GameShell"`
 * 这种"反向 type-only import" — 架构上 GameShell 是 consumer, types 应在 leaf.
 *
 * 23 个 template Panel 文件继续从 GameShell.tsx 导出 (re-export back-compat),
 * 不需要 24 file 大规模改 import — 等下次有相关修改时顺带换路径即可.
 */
import type { Question } from "../../../core/types";

export interface AttemptResult {
  answer: unknown;
  isCorrect: boolean;
  partialCorrect: boolean;
  matchedErrorTags: string[];
  hintsOpened: number;
  elapsedSeconds: number;
  correctAnswerDisplay: string;
  /**
   * v0.35.1 iter 35 P0-3: MultiStepApplication 模板专用 — 4 phase 结果 payload.
   * 由 MultiStepApplicationPanel onFinish 时透传. GameShell handleFinish 把 earnedXp
   * 累加到 finalPoints, 把整个 payload 透传给 Train → service → attempt.metadata.
   */
  multiStep?: {
    phasePass: boolean[];
    earnedXp: number;
    userKnown: string[];
    userQuestion: string;
    userEquation: string;
    userAnswer: number;
    userUnit: string;
  };
  /**
   * v0.30.7: 这次答题前是否打开过"小进讲题"。仅 retry 后的 2nd 提交可能为 true。
   * 1st 提交永远 false（讲题入口在 1st 错答之后才出现）。
   */
  usedTutor?: boolean;
  /**
   * v0.30.7: 同一道题的第几次提交（1=直接 / 2=1st 错答之后的重做）。
   * 决定 combo / 速度奖励 / mistake stage / mastery Elo 倍率。
   */
  attemptOrdinal?: 1 | 2;
  /**
   * v0.34.99 (iter 33 P0-1): EstimationGate 完成 payload. Train.tsx 转给
   * submitAttempt → 落库到 attempt.metadata.estimationGate.
   */
  estimationGate?: {
    earnedXp: number;
    userRounds: number[];
    userEstimate: number;
    userMagnitude: string;
    actualMagnitude: string;
    magnitudeMismatch: boolean;
    elapsedMsByPhase: { round: number; computeAndMagnitude: number };
  };
  /** v0.35.0 iter 34 P0-2: ScratchInsurance payload (Train → service → attempt.metadata) */
  scratch?: {
    tool: "scratch" | "mental_calc" | "direct_bypass";
    charCount: number;
    insured: boolean;
    mentalOverrideUsed: boolean;
  };
  /**
   * v0.35.10 iter 41 (爸爸反馈): canvas_scratch 模板 payload.
   * imageBase64 是手写 PNG (列算式区), 落 attempt.metadata.canvasScratch.
   * mistake 复盘时可还原 Selena 当时怎么列的式子.
   */
  canvasScratch?: {
    imageBase64: string;
    strokeCount: number;
    hasWork: boolean;
  };
}

export interface TriggerFx {
  correctAt: (x: number, y: number, text?: string) => void;
  wrongAt: (x: number, y: number) => void;
  hintPenaltyAt: (x: number, y: number, amount: number) => void;
  /** v0.31.93: 答对时的"放射 burst" — 5 个新玩法用，emoji 随玩法主题对齐 */
  burstAt: (x: number, y: number, emojis: string[], count?: number) => void;
}

/** 每个子模板实现这个接口 */
export interface TemplateRenderProps {
  question: Question;
  hintsOpened: number;
  openHint: () => void;
  onFinish: (r: Omit<AttemptResult, "hintsOpened" | "elapsedSeconds" | "correctAnswerDisplay">) => void;
  triggerFx: TriggerFx;
  onPickFeedback: (kind: "correct" | "wrong") => void;
  disabled: boolean;
}
