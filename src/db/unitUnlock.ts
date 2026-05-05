/**
 * 单元解锁系统（v0.30.9）。
 *
 * 痛点：期中只考到 G4B U1-U4，但每日挑战 / 自由练经常跳出 U5/U6 的题，
 * 学生没学过没法做。需要按学期进度门控。
 *
 * 模型：每个 (studentId, term) 维护一个已解锁 unitId 集合。
 *   - meta key: `unlockedUnits::${studentId}::${termCode}` （G4A / G4B / MIX）
 *   - value: string[] of unitId
 *
 * 默认值（首次访问 / 没存过 meta 时返回）：
 *   - 上册（G4A）: 全部已解锁（学完了）
 *   - 下册（G4B）: U1-U4 已解锁（期中范围；U5 方程 / U6 数据后续）
 *   - 综合复习：union(G4A ∪ G4B 当前已解锁)
 *
 * 之后 UI 给"解锁下一单元"按钮，把对应 unitId 写进列表。
 *
 * 调用方：
 *   - service.ts buildDailySession 前过滤 pool
 *   - SkillPicker 过滤可选 skill
 *   - Home 加"学期进度"展示 + 解锁按钮
 */

import { db } from "./dexie";
import { UNITS } from "../content/units";
import type { Term } from "../core/types";

/** Term → 持久化用的 code（缩短 key + 兼容） */
function termCode(term: Term): "G4A" | "G4B" | "MIX" {
  if (term === "上册") return "G4A";
  if (term === "下册") return "G4B";
  return "MIX";
}

/** meta key 形如 `unlockedUnits::default-student::G4B` */
function metaKey(studentId: string, term: Term): string {
  return `unlockedUnits::${studentId}::${termCode(term)}`;
}

/**
 * 默认已解锁 units（按 term 分发）：
 *   - G4A：全部（上册学完了）
 *   - G4B：U1-U4（期中范围，2026 年 5 月期中考前）
 *   - MIX：union(G4A 默认 ∪ G4B 默认)
 *
 * 想调"默认解锁多少"就改这里。
 */
function defaultUnlockedUnitIds(term: Term): string[] {
  if (term === "上册") {
    return UNITS.filter((u) => u.term === "上册").map((u) => u.id);
  }
  if (term === "下册") {
    // U1-U4 期中考范围
    const orderedG4B = UNITS.filter((u) => u.term === "下册").sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
    return orderedG4B.slice(0, 4).map((u) => u.id);
  }
  // 综合复习：union(default G4A ∪ default G4B)
  return [
    ...defaultUnlockedUnitIds("上册"),
    ...defaultUnlockedUnitIds("下册"),
  ];
}

/** 拿当前已解锁 unitId 列表（如果 meta 没存就用 default 填好返回） */
export async function getUnlockedUnitIds(
  studentId: string,
  term: Term,
): Promise<string[]> {
  const row = await db.meta.get(metaKey(studentId, term));
  if (row && Array.isArray(row.value)) {
    return row.value as string[];
  }
  // 没存过 meta → 返回 default（不写入，下一次还是 default；
  // 想"持久化 default"调 ensureUnlockedUnitsInitialized 一次）
  return defaultUnlockedUnitIds(term);
}

/** 把指定 unitId 列表写入 meta（覆盖） */
export async function setUnlockedUnitIds(
  studentId: string,
  term: Term,
  unitIds: string[],
): Promise<void> {
  // dedupe + 按 UNITS 顺序排
  const known = new Set(UNITS.map((u) => u.id));
  const cleaned = Array.from(new Set(unitIds.filter((id) => known.has(id))));
  const ordered = UNITS.filter((u) => cleaned.includes(u.id)).map((u) => u.id);
  await db.meta.put({ key: metaKey(studentId, term), value: ordered });
}

/** 解锁某个 unit（追加到已解锁列表，去重） */
export async function unlockUnit(
  studentId: string,
  term: Term,
  unitId: string,
): Promise<string[]> {
  const current = await getUnlockedUnitIds(studentId, term);
  if (current.includes(unitId)) return current;
  const next = [...current, unitId];
  await setUnlockedUnitIds(studentId, term, next);
  return next;
}

/** 锁回某个 unit（从已解锁列表里移除）—— 调试 / 误锁回退用 */
export async function lockUnit(
  studentId: string,
  term: Term,
  unitId: string,
): Promise<string[]> {
  const current = await getUnlockedUnitIds(studentId, term);
  if (!current.includes(unitId)) return current;
  const next = current.filter((id) => id !== unitId);
  await setUnlockedUnitIds(studentId, term, next);
  return next;
}

/** 判定一个 unitId 在某 term 下是否已解锁 */
export async function isUnitUnlocked(
  studentId: string,
  term: Term,
  unitId: string,
): Promise<boolean> {
  const list = await getUnlockedUnitIds(studentId, term);
  return list.includes(unitId);
}

/**
 * 给 scheduler / SkillPicker 用：根据 term 拿一组 unlockedUnitIds 的 Set，
 * 用于 pool / skills 的 fast-filter。
 *
 * 综合复习模式 = 同时取 上册 + 下册 的 unlocked 并集（学生看综合复习应该
 * 同时尊重两个 term 的进度）。
 */
export async function getUnlockedUnitIdSet(
  studentId: string,
  term: Term,
): Promise<Set<string>> {
  if (term === "综合复习") {
    const [a, b] = await Promise.all([
      getUnlockedUnitIds(studentId, "上册"),
      getUnlockedUnitIds(studentId, "下册"),
    ]);
    return new Set([...a, ...b]);
  }
  return new Set(await getUnlockedUnitIds(studentId, term));
}
