/**
 * v0.35.67: Tests for Streak Freeze 请假条体系.
 *
 * earn 规则: 单日 todayCount ≥ FREEZE_EARN_THRESHOLD (25) → 获得 1 张, cap 3 张.
 * use 规则: 漏一天 (cur.lastCompleteDate = 前天) + 有 token → 自动桥过昨天.
 */
import { describe, expect, it, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "../src/db/dexie";
import {
  loadDaily,
  tickDaily,
  saveDaily,
  FREEZE_EARN_THRESHOLD,
  FREEZE_MAX_TOKENS,
  type DailyState,
} from "../src/lib/dailyTarget";

const STUDENT = "s_test_freeze";
const SUBJECT = "math";

function today(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateNDaysAgo(n: number): string {
  return today(Date.now() - n * 86400000);
}

beforeEach(async () => {
  await db.meta.delete(`daily_${SUBJECT}_${STUDENT}`);
});

describe("Streak Freeze earning", () => {
  it("达到 EARN_THRESHOLD (25) 获得 1 张请假条", async () => {
    // 从 cur=24 答一题 → next=25 触发 earn
    const state: DailyState = {
      todayDate: today(),
      todayCount: 24,
      target: 10,
      streak: 1,
      lastCompleteDate: today(),
      freezeTokens: 0,
    };
    await saveDaily(SUBJECT, STUDENT, state);
    const cur = await loadDaily(SUBJECT, STUDENT);
    const r = await tickDaily(SUBJECT, STUDENT, cur);
    expect(r.justEarnedFreeze).toBe(true);
    expect(r.next.freezeTokens).toBe(1);
  });

  it("低于 EARN_THRESHOLD 不获得", async () => {
    const state: DailyState = {
      todayDate: today(),
      todayCount: 23,
      target: 10,
      streak: 1,
      lastCompleteDate: today(),
      freezeTokens: 0,
    };
    await saveDaily(SUBJECT, STUDENT, state);
    const cur = await loadDaily(SUBJECT, STUDENT);
    const r = await tickDaily(SUBJECT, STUDENT, cur);
    expect(r.justEarnedFreeze).toBeFalsy();
    expect(r.next.freezeTokens).toBe(0);
  });

  it("已 cap (3 张) 时再练习不增加", async () => {
    const state: DailyState = {
      todayDate: today(),
      todayCount: 24,
      target: 10,
      streak: 5,
      lastCompleteDate: today(),
      freezeTokens: FREEZE_MAX_TOKENS,
    };
    await saveDaily(SUBJECT, STUDENT, state);
    const cur = await loadDaily(SUBJECT, STUDENT);
    const r = await tickDaily(SUBJECT, STUDENT, cur);
    expect(r.next.freezeTokens).toBe(FREEZE_MAX_TOKENS);
    expect(r.justEarnedFreeze).toBeFalsy();
  });

  it("EARN_THRESHOLD 是 25, MAX 是 3", () => {
    expect(FREEZE_EARN_THRESHOLD).toBe(25);
    expect(FREEZE_MAX_TOKENS).toBe(3);
  });
});

describe("Streak Freeze auto-use", () => {
  it("漏一天 + 有 token → 自动桥过, streak 不破, token -1", async () => {
    // 模拟: 用户前天完成 (前天 = lastCompleteDate), 昨天没做, 今天进 home
    const state: DailyState = {
      todayDate: dateNDaysAgo(2), // 前天 (已经过期)
      todayCount: 15,
      target: 10,
      streak: 5,
      lastCompleteDate: dateNDaysAgo(2),
      freezeTokens: 2,
    };
    await saveDaily(SUBJECT, STUDENT, state);
    const cur = await loadDaily(SUBJECT, STUDENT);
    // 自动桥过: lastCompleteDate 变成昨天, token 2 → 1, streak 保留 5
    expect(cur.streak).toBe(5);
    expect(cur.lastCompleteDate).toBe(dateNDaysAgo(1));
    expect(cur.freezeTokens).toBe(1);
    expect(cur.lastFreezeUsedAt).toBe(dateNDaysAgo(1));
    expect(cur.todayCount).toBe(0);
  });

  it("漏一天 + 无 token → 不桥, streak 之后做题时会重置", async () => {
    const state: DailyState = {
      todayDate: dateNDaysAgo(2),
      todayCount: 15,
      target: 10,
      streak: 5,
      lastCompleteDate: dateNDaysAgo(2),
      freezeTokens: 0,
    };
    await saveDaily(SUBJECT, STUDENT, state);
    const cur = await loadDaily(SUBJECT, STUDENT);
    // 不桥: lastCompleteDate 保持前天, streak 仍是 5 (但下次 justCompleted 时会 reset 1)
    expect(cur.lastCompleteDate).toBe(dateNDaysAgo(2));
    expect(cur.freezeTokens).toBe(0);
  });

  it("没漏天 (昨天完成了) → 不触发桥过", async () => {
    const state: DailyState = {
      todayDate: dateNDaysAgo(1),
      todayCount: 15,
      target: 10,
      streak: 3,
      lastCompleteDate: dateNDaysAgo(1),
      freezeTokens: 2,
    };
    await saveDaily(SUBJECT, STUDENT, state);
    const cur = await loadDaily(SUBJECT, STUDENT);
    expect(cur.lastCompleteDate).toBe(dateNDaysAgo(1));
    expect(cur.freezeTokens).toBe(2); // 未消耗
    expect(cur.lastFreezeUsedAt ?? null).toBeNull();
  });

  it("老数据没 freezeTokens 字段 → 默认 0", async () => {
    // 直接写入老格式 (无 freezeTokens)
    await db.meta.put({
      key: `daily_${SUBJECT}_${STUDENT}`,
      value: {
        todayDate: today(),
        todayCount: 5,
        target: 10,
        streak: 1,
        lastCompleteDate: today(),
      },
    });
    const cur = await loadDaily(SUBJECT, STUDENT);
    expect(cur.freezeTokens).toBe(0);
  });
});
