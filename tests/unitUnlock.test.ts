/**
 * v0.30.9: 单元解锁系统测试
 *
 * 重点：
 *  - 默认 G4B 只解锁 U1-U4（期中范围）
 *  - 上册全解锁
 *  - unlockUnit 写入后下次 get 能拿到
 *  - 综合复习 = 上下册 union
 *  - lockUnit 也能撤回
 */

import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { db } from "../src/db/dexie";
import {
  getUnlockedUnitIds,
  unlockUnit,
  lockUnit,
  getUnlockedUnitIdSet,
  runScheduledUnlocks,
  UNIT_UNLOCK_SCHEDULE,
} from "../src/db/unitUnlock";

const STU = "test-student-1";

beforeEach(async () => {
  // 清掉 meta 让每个 test 独立
  await db.meta.clear();
});

describe("unitUnlock v0.30.9", () => {
  it("默认 下册 只解锁 U1-U4（期中范围）", async () => {
    const list = await getUnlockedUnitIds(STU, "下册");
    expect(list).toEqual([
      "G4B_U1_DECIMAL_ADD_SUB",
      "G4B_U2_TRI_QUAD",
      "G4B_U3_DECIMAL_MULTIPLY",
      "G4B_U4_OBSERVE_OBJECTS",
    ]);
    expect(list).not.toContain("G4B_U5_EQUATIONS");
    expect(list).not.toContain("G4B_U6_DATA");
  });

  it("默认 上册 全部解锁", async () => {
    const list = await getUnlockedUnitIds(STU, "上册");
    // G4A 共 8 个 unit
    expect(list.length).toBe(8);
    expect(list).toContain("G4A_U1_LARGE_NUMBERS");
    expect(list).toContain("G4A_U8_PROBABILITY");
  });

  it("unlockUnit 把 U5 加到列表", async () => {
    const next = await unlockUnit(STU, "下册", "G4B_U5_EQUATIONS");
    expect(next).toContain("G4B_U5_EQUATIONS");
    // re-read 也能拿到
    const list = await getUnlockedUnitIds(STU, "下册");
    expect(list).toContain("G4B_U5_EQUATIONS");
  });

  it("重复 unlockUnit 不会产生重复条目", async () => {
    await unlockUnit(STU, "下册", "G4B_U5_EQUATIONS");
    await unlockUnit(STU, "下册", "G4B_U5_EQUATIONS");
    const list = await getUnlockedUnitIds(STU, "下册");
    const u5Count = list.filter((id) => id === "G4B_U5_EQUATIONS").length;
    expect(u5Count).toBe(1);
  });

  it("lockUnit 撤回解锁", async () => {
    await unlockUnit(STU, "下册", "G4B_U5_EQUATIONS");
    let list = await getUnlockedUnitIds(STU, "下册");
    expect(list).toContain("G4B_U5_EQUATIONS");
    await lockUnit(STU, "下册", "G4B_U5_EQUATIONS");
    list = await getUnlockedUnitIds(STU, "下册");
    expect(list).not.toContain("G4B_U5_EQUATIONS");
  });

  it("综合复习 = 上下册 union", async () => {
    await unlockUnit(STU, "下册", "G4B_U5_EQUATIONS");
    const set = await getUnlockedUnitIdSet(STU, "综合复习");
    // 应该既有 G4A 的 unit，又有 G4B U1-U4 + 刚解锁的 U5
    expect(set.has("G4A_U1_LARGE_NUMBERS")).toBe(true);
    expect(set.has("G4B_U1_DECIMAL_ADD_SUB")).toBe(true);
    expect(set.has("G4B_U5_EQUATIONS")).toBe(true);
    expect(set.has("G4B_U6_DATA")).toBe(false); // 还没解锁 U6
  });

  it("两个学生互不影响", async () => {
    await unlockUnit("studentA", "下册", "G4B_U5_EQUATIONS");
    const aList = await getUnlockedUnitIds("studentA", "下册");
    const bList = await getUnlockedUnitIds("studentB", "下册");
    expect(aList).toContain("G4B_U5_EQUATIONS");
    expect(bList).not.toContain("G4B_U5_EQUATIONS");
  });
});

// v0.30.10: 基于时间的自动解锁
describe("runScheduledUnlocks v0.30.10", () => {
  beforeEach(async () => {
    await db.meta.clear();
  });

  it("UNIT_UNLOCK_SCHEDULE 至少包含 U5/U6 的排期", () => {
    expect(UNIT_UNLOCK_SCHEDULE.G4B_U5_EQUATIONS).toBeTruthy();
    expect(UNIT_UNLOCK_SCHEDULE.G4B_U6_DATA).toBeTruthy();
  });

  it("没到日期不解锁，返回空数组", async () => {
    const before = new Date("2026-05-01"); // 在 U5 / U6 排期之前
    const r = await runScheduledUnlocks(STU, before);
    expect(r).toHaveLength(0);
    const list = await getUnlockedUnitIds(STU, "下册");
    expect(list).not.toContain("G4B_U5_EQUATIONS");
  });

  it("到 U5 排期日期，自动解锁 U5（U6 还没到）", async () => {
    const u5date = UNIT_UNLOCK_SCHEDULE.G4B_U5_EQUATIONS!;
    const onDay = new Date(u5date + "T08:00:00");
    const r = await runScheduledUnlocks(STU, onDay);
    expect(r.map((x) => x.unitId)).toContain("G4B_U5_EQUATIONS");
    expect(r.map((x) => x.unitId)).not.toContain("G4B_U6_DATA");
    const list = await getUnlockedUnitIds(STU, "下册");
    expect(list).toContain("G4B_U5_EQUATIONS");
  });

  it("过了 U5 + U6 日期，两个都自动解锁", async () => {
    const farFuture = new Date("2027-01-01");
    const r = await runScheduledUnlocks(STU, farFuture);
    expect(r.map((x) => x.unitId).sort()).toEqual([
      "G4B_U5_EQUATIONS",
      "G4B_U6_DATA",
    ]);
  });

  it("已经手动解锁过的 unit，不会再次出现在 newlyUnlocked 列表", async () => {
    // 先手动解锁 U5
    await unlockUnit(STU, "下册", "G4B_U5_EQUATIONS");
    const farFuture = new Date("2027-01-01");
    const r = await runScheduledUnlocks(STU, farFuture);
    // U5 不应该重复出现，但 U6 应该被自动解锁
    expect(r.map((x) => x.unitId)).not.toContain("G4B_U5_EQUATIONS");
    expect(r.map((x) => x.unitId)).toContain("G4B_U6_DATA");
  });

  it("重复调用幂等：第二次调用不会再返回新解锁项", async () => {
    const farFuture = new Date("2027-01-01");
    const r1 = await runScheduledUnlocks(STU, farFuture);
    expect(r1.length).toBeGreaterThan(0);
    const r2 = await runScheduledUnlocks(STU, farFuture);
    expect(r2).toHaveLength(0);
  });
});
