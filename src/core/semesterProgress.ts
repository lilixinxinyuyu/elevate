/**
 * 学期进度：今天应该走到学期的百分之几。
 *
 * 爸爸 2026-05-17 反馈：landing page 进度条要 visible 显示 expected position，
 * 让 Selena / 家长一眼看出超进度还是落后。算法走 examDates.ts 学期起止线性。
 *
 * 学期起止：
 *   - G4A (上册): 2025-09-01 → 2026-01-15（成都市 2025-2026 第一学期）
 *   - G4B (下册): 2026-02-17 → 2026-07-03（成都市 2025-2026 第二学期，期末 06-29 + 收尾）
 *
 * G4A 上册起止参考成都市常规校历；G4B 下册起借鉴去年同期 + FINAL_DATE 反推。
 *
 * 用法：
 *   const exp = expectedProgress("G4B");  // 0..1
 *   if (actual > exp) "超进度" else "落后"
 */

/**
 * 学期 type 跟 core/types.ts 对齐："上册" | "下册" | "综合复习"。
 * "综合复习" 没有清晰起止 — 用当前最近的学期日期表（fallback "下册"）。
 */
export type Term = "上册" | "下册" | "综合复习";

/** 学期起止 dateKey 表 — "综合复习" fallback 走"下册" */
const TERM_DATES: Record<"上册" | "下册", { start: string; end: string }> = {
  上册: { start: "2025-09-01", end: "2026-01-15" },
  下册: { start: "2026-02-17", end: "2026-07-03" },
};

function effectiveTerm(t: Term): "上册" | "下册" {
  if (t === "综合复习") return "下册";
  return t;
}

function localDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/**
 * 今天在学期里的位置（0..1）。
 * - 学期没开学 → 0
 * - 学期已结束 → 1
 * - 期间 → 线性 (today - start) / (end - start)
 */
export function expectedProgress(term: Term, now: Date = new Date()): number {
  const cfg = TERM_DATES[effectiveTerm(term)];
  if (!cfg) return 0;
  const start = localDate(cfg.start).getTime();
  const end = localDate(cfg.end).getTime();
  const t = now.getTime();
  if (t <= start) return 0;
  if (t >= end) return 1;
  return (t - start) / (end - start);
}

/** 学期已过百分比的中文标签，给 UI 用 */
export function expectedLabel(term: Term, now: Date = new Date()): string {
  const p = expectedProgress(term, now);
  return `按学期 ${Math.round(p * 100)}%`;
}

/**
 * 落后/超前判定。
 * @param actual 实际进度 0..1
 * @param term 当前学期
 * @returns 'ahead' | 'on_track' | 'behind'
 *   阈值：相差 >5% 才标 ahead/behind，否则 on_track
 */
export function compareProgress(
  actual: number,
  term: Term,
  now: Date = new Date(),
): "ahead" | "on_track" | "behind" {
  const exp = expectedProgress(term, now);
  const diff = actual - exp;
  if (diff > 0.05) return "ahead";
  if (diff < -0.05) return "behind";
  return "on_track";
}
