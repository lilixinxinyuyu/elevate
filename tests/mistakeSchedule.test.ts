/**
 * v0.31.69: 错题复活每日上限 + 自动分散积压逻辑测试。
 */

import { describe, expect, it } from "vitest";
import {
  DAILY_REVIVE_TARGET,
  SPREAD_TRIGGER,
  SPREAD_DAYS,
  planMistakeSpread,
  remainingForToday,
  shouldEncourageMore,
} from "../src/lib/mistakeSchedule";
import type { MistakeReview } from "../src/core/types";

const NOW = new Date("2026-05-09T12:00:00").getTime();
const DAY = 24 * 60 * 60 * 1000;

function mk(over: Partial<MistakeReview> & { id: string }): MistakeReview {
  return {
    studentId: "s1",
    subjectId: "math",
    questionId: `q-${over.id}`,
    skillId: "decimal_add_sub_compute",
    stage: 0,
    nextReviewAt: NOW - 1000,
    lastAttemptAt: NOW - DAY,
    errorTags: [],
    resolved: false,
    ...over,
  };
}

describe("planMistakeSpread", () => {
  it("到期数 ≤ SPREAD_TRIGGER（15）→ 不分散", () => {
    const due = Array.from({ length: 12 }, (_, i) => mk({ id: `m-${i}` }));
    const { keepToday, spread } = planMistakeSpread(due, NOW);
    expect(spread).toEqual([]);
    expect(keepToday.length).toBe(12);
  });

  it("正好 15（= trigger）→ 不分散（trigger 是 ≤ 才不分）", () => {
    const due = Array.from({ length: SPREAD_TRIGGER }, (_, i) => mk({ id: `m-${i}` }));
    const { spread } = planMistakeSpread(due, NOW);
    expect(spread).toEqual([]);
  });

  it("76 道 → 今日保留 10，剩 66 分散到未来 7 天", () => {
    const due = Array.from({ length: 76 }, (_, i) => mk({ id: `m-${i}` }));
    const { keepToday, spread } = planMistakeSpread(due, NOW);
    expect(keepToday.length).toBe(DAILY_REVIVE_TARGET); // 10
    expect(spread.length).toBe(66);
    // 所有 spread 的 nextReviewAt 都在未来
    for (const m of spread) {
      expect(m.nextReviewAt).toBeGreaterThan(NOW);
    }
    // 最远不超过 SPREAD_DAYS 天后 + 6h jitter
    const maxFuture = NOW + SPREAD_DAYS * DAY + 6 * 60 * 60 * 1000;
    for (const m of spread) {
      expect(m.nextReviewAt).toBeLessThan(maxFuture + DAY);
    }
  });

  it("分散均匀（每天 ~10 道）", () => {
    const due = Array.from({ length: 50 }, (_, i) => mk({ id: `m-${i}` }));
    const { spread } = planMistakeSpread(due, NOW);
    // 50 - 10 = 40 道分散到未来 7 天
    // floor(0/10)=0, floor(9/10)=0, floor(10/10)=1, floor(19/10)=1, ...
    // 即 day0(明天): 10 道, day1: 10, day2: 10, day3: 10, day4-6: 0
    const tomorrow = (() => {
      const d = new Date(NOW);
      d.setHours(0, 0, 0, 0);
      return d.getTime() + DAY;
    })();
    const dayCounts: Record<number, number> = {};
    for (const m of spread) {
      const dayOff = Math.floor((m.nextReviewAt - tomorrow) / DAY);
      dayCounts[dayOff] = (dayCounts[dayOff] ?? 0) + 1;
    }
    for (const [, n] of Object.entries(dayCounts)) {
      expect(n).toBeLessThanOrEqual(DAILY_REVIVE_TARGET);
    }
    // 总数对得上
    expect(spread.length).toBe(40);
  });

  it("优先保留低 stage（最薄弱）的", () => {
    const due = [
      ...Array.from({ length: 10 }, (_, i) => mk({ id: `high-${i}`, stage: 3 })),
      ...Array.from({ length: 10 }, (_, i) => mk({ id: `low-${i}`, stage: 0 })),
    ];
    const { keepToday, spread } = planMistakeSpread(due, NOW);
    // 低 stage 应全部留今日
    const keepIds = new Set(keepToday.map((m) => m.id));
    for (let i = 0; i < 10; i++) {
      expect(keepIds.has(`low-${i}`)).toBe(true);
    }
    // 高 stage 全部被分散
    for (const m of spread) {
      expect(m.stage).toBe(3);
    }
  });

  it("超过 7×10=70 道时多余的压到 day 6", () => {
    // 100 道 due → 10 留今日 + 90 分散
    // day 0-6 各 10 道，多出来的 20 应该压到 day 6
    const due = Array.from({ length: 100 }, (_, i) => mk({ id: `m-${i}` }));
    const { spread } = planMistakeSpread(due, NOW);
    expect(spread.length).toBe(90);
    const tomorrow = (() => {
      const d = new Date(NOW);
      d.setHours(0, 0, 0, 0);
      return d.getTime() + DAY;
    })();
    const lastDay = SPREAD_DAYS - 1; // day 6
    const onLastDay = spread.filter((m) => {
      const dayOff = Math.floor((m.nextReviewAt - tomorrow) / DAY);
      return dayOff === lastDay;
    });
    // 至少 10（这天本身的份额） + 20（溢出压上来的）= 30
    expect(onLastDay.length).toBeGreaterThanOrEqual(20);
  });
});

describe("shouldEncourageMore", () => {
  it("样本 < 5 不鼓励", () => {
    const samples = Array.from({ length: 4 }, () => ({
      isCorrect: true,
      elapsedSeconds: 5,
      estimatedSeconds: 30,
    }));
    expect(shouldEncourageMore(samples)).toBe(false);
  });

  it("准确率 70% 不鼓励（必须 >70%）", () => {
    const samples = Array.from({ length: 10 }, (_, i) => ({
      isCorrect: i < 7, // 7 / 10 = 70%
      elapsedSeconds: 5,
      estimatedSeconds: 30,
    }));
    expect(shouldEncourageMore(samples)).toBe(false);
  });

  it("准确率 80% + 比 estimated 快 ≥20% → 鼓励", () => {
    const samples = Array.from({ length: 10 }, (_, i) => ({
      isCorrect: i < 8,
      elapsedSeconds: 20, // estimated 30 → 20/30 = 67% < 80%，达成"快 ≥20%"
      estimatedSeconds: 30,
    }));
    expect(shouldEncourageMore(samples)).toBe(true);
  });

  it("准确率高但答得慢（>=80% time）→ 不鼓励（孩子可能费力）", () => {
    const samples = Array.from({ length: 10 }, (_, i) => ({
      isCorrect: i < 9, // 90%
      elapsedSeconds: 28, // 28/30 = 93%
      estimatedSeconds: 30,
    }));
    expect(shouldEncourageMore(samples)).toBe(false);
  });

  it("estimatedSeconds 都是 0 → 不鼓励（数据缺失防误判）", () => {
    const samples = Array.from({ length: 10 }, () => ({
      isCorrect: true,
      elapsedSeconds: 5,
      estimatedSeconds: 0,
    }));
    expect(shouldEncourageMore(samples)).toBe(false);
  });
});

describe("remainingForToday", () => {
  it("0 due 0 revived → 0 remaining", () => {
    expect(remainingForToday(0, 0)).toBe(0);
  });
  it("3 due 0 revived → target=3, 还需 3", () => {
    expect(remainingForToday(3, 0)).toBe(3);
  });
  it("76 due 0 revived → target=10, 还需 10", () => {
    expect(remainingForToday(76, 0)).toBe(10);
  });
  it("9 due 1 revived (totalToday=10) → 还需 9", () => {
    expect(remainingForToday(9, 1)).toBe(9);
  });
  it("0 due 10 revived → 已闭, 0 remaining", () => {
    expect(remainingForToday(0, 10)).toBe(0);
  });
  it("已超额做（5 due 12 revived）→ 0 remaining（不会负数）", () => {
    expect(remainingForToday(5, 12)).toBe(0);
  });
});
