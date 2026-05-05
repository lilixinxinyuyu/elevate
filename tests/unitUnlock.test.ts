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
