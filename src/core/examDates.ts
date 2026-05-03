/**
 * 考试日历（成都市锦江区小学 2025-2026 学年第二学期）
 *
 * 数据来源：
 *   - 期末：成都市教育局统一校历 → 2026-06-29 ~ 07-03（义务教育阶段）
 *           暑假从 2026-07-04 起。
 *           参考：https://m.cd.bendibao.com/edu/199445.shtm
 *   - 期中：成都市未统一发布；按 Selena 学校实际日历配置（默认 2026-05-06）。
 *           家长可以改下面的 MIDTERM_DATE 数字部分。
 *
 * 用法：
 *   const exam = currentExam();         // 自动选当前要冲刺的考试
 *   const days = daysUntil(exam.date);  // 还剩几天
 */

export interface ExamEvent {
  /** "midterm" | "final" */
  id: "midterm" | "final";
  /** 中文名 */
  name: string;
  /** YYYY-MM-DD 当地日期 */
  dateKey: string;
  /** Date 对象（当地时区午夜） */
  date: Date;
  /** /train?mode=... 用 */
  mode: "midterm" | "final_sprint";
  /** 卡片视觉色调 */
  tone: "cyan" | "rose";
  /** 卡片文案 */
  hint: string;
}

/** 把 "YYYY-MM-DD" 解析成当地日期（避免 UTC 时区漂移） */
function localDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** Selena 学校的期中考试日期。她妈妈/爸爸可改。 */
export const MIDTERM_DATE = "2026-05-06";

/** 成都市教育局统一校历：第二学期期末考试首日 */
export const FINAL_DATE = "2026-06-29";

export const MIDTERM: ExamEvent = {
  id: "midterm",
  name: "期中考试",
  dateKey: MIDTERM_DATE,
  date: localDate(MIDTERM_DATE),
  mode: "midterm",
  tone: "cyan",
  hint: "下册 1-4 单元混合 15 道",
};

export const FINAL: ExamEvent = {
  id: "final",
  name: "期末考试",
  dateKey: FINAL_DATE,
  date: localDate(FINAL_DATE),
  mode: "final_sprint",
  tone: "rose",
  hint: "下册全单元重点冲刺",
};

/** 距离 date 还有几天。今天 = 0。已过 = 负数。 */
export function daysUntil(date: Date, now: Date = new Date()): number {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86400000);
}

/**
 * 当前应该冲刺的考试：
 * - 期中考试当天及之前 → 期中
 * - 期中考试之后 → 期末
 *
 * 期末考试当天及之后仍返回期末（"考完了"由 UI 文案处理）。
 */
export function currentExam(now: Date = new Date()): ExamEvent {
  return daysUntil(MIDTERM.date, now) >= 0 ? MIDTERM : FINAL;
}
