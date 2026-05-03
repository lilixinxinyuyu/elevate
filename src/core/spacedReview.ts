export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30];

export function nextReviewAt(stage: number, fromMs: number = Date.now()): number {
  const idx = Math.min(Math.max(stage, 0), REVIEW_INTERVAL_DAYS.length - 1);
  const days = REVIEW_INTERVAL_DAYS[idx]!;
  return fromMs + days * 24 * 60 * 60 * 1000;
}

export function advanceStageOnSuccess(stage: number): number {
  return Math.min(stage + 1, REVIEW_INTERVAL_DAYS.length); // > last 表示可退出
}

export function regressStageOnFailure(stage: number): number {
  return Math.max(0, stage - 1);
}
