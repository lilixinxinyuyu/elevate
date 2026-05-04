/**
 * 后台 AI 出题 — 单例状态机 + 订阅模式。
 *
 * 用途：
 *  - 完成一组训练后 fire-and-forget 触发后台出题
 *  - 顶部 BgGenIndicator 订阅这个状态显示进度
 *  - 重复触发同一 (subjectId, skillId) 会被 dedup（lib/tutor 里的 inflightGens
 *    保证 fetch 不重发，这里负责 UI 状态共享）
 *  - 即使用户切到其他 page，状态保留，indicator 仍然显示
 *
 * 不持久化 — 切 tab 或刷新会重置（生成已经在 db 里了，只是 UI 状态丢了无所谓）。
 */

import { useEffect, useState } from "react";
import { db } from "../db/dexie";
import { generateAiQuestions } from "./tutor";
import type { CurriculumUnit, MasteryScore, Question, Skill } from "../core/types";

export type BgGenStatus =
  | { state: "idle" }
  | {
      state: "running";
      subjectId: "math" | "chinese";
      skillName: string;
      startedAt: number;
      message?: string;
    }
  | {
      state: "success";
      subjectId: "math" | "chinese";
      skillName: string;
      count: number;
      finishedAt: number;
    }
  | {
      state: "failed";
      subjectId: "math" | "chinese";
      reason: string;
      finishedAt: number;
    };

let currentStatus: BgGenStatus = { state: "idle" };
const listeners = new Set<(s: BgGenStatus) => void>();

function setBgStatus(next: BgGenStatus) {
  currentStatus = next;
  listeners.forEach((l) => l(next));
}

export function getBgGenStatus(): BgGenStatus {
  return currentStatus;
}

/** React hook：组件订阅当前状态 */
export function useBgGenStatus(): BgGenStatus {
  const [status, setStatus] = useState<BgGenStatus>(currentStatus);
  useEffect(() => {
    listeners.add(setStatus);
    return () => {
      listeners.delete(setStatus);
    };
  }, []);
  return status;
}

interface TriggerArgs {
  subjectId: "math" | "chinese";
  studentId: string;
  skills: Skill[];
  units: CurriculumUnit[];
  seedQuestions: Question[];
  currentTerm?: "上册" | "下册";
  preferredUnitId?: string;
  /** 单 skill 出多少题（默认 10 — 服务端并发 4 题/批，整体 20-25s） */
  count?: number;
  /**
   * 多 skill 模式：触发后会**遍历最弱 N 个 skill** 各出 count 题。
   * 默认 1（只出 1 个 skill 的 count 题）。设 3 → 跑 3 个 skill × count 题。
   *
   * 用于"完成一组训练后想批量补充题库"场景：直接出 30 题（3 skill × 10 题）。
   */
  multiSkillCount?: number;
}

/**
 * 检查这个学生当前学期下、可做的"新鲜"题数（最近 30 天没做对、未 mastered）。
 *
 * 用于"完成一组训练后题库低于阈值就自动补题"。
 *
 * 阈值是"该学期题库需要至少有 N 道新鲜题，否则触发后台再出"。
 */
const FRESH_QUESTION_THRESHOLD = 30;

async function countFreshQuestions(args: {
  subjectId: "math" | "chinese";
  studentId: string;
  units: CurriculumUnit[];
  currentTerm?: "上册" | "下册";
}): Promise<number> {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const allQs = await db.questions
    .where("subjectId")
    .equals(args.subjectId)
    .filter((q) => q.status === "approved" || q.status === "active")
    .toArray();
  const termUnitIds = new Set(
    (args.currentTerm
      ? args.units.filter((u) => u.term === args.currentTerm)
      : args.units
    ).map((u) => u.id),
  );
  const inTerm = allQs.filter((q) => termUnitIds.has(q.unit_id));
  const recentAttempts = await db.attempts
    .where("studentId")
    .equals(args.studentId)
    .filter(
      (a) =>
        (a.subjectId ?? "math") === args.subjectId &&
        a.createdAt >= now - 30 * DAY,
    )
    .toArray();
  const recentCorrectIds = new Set(
    recentAttempts.filter((a) => a.isCorrect).map((a) => a.questionId),
  );
  // 单题级 mastered（最近 3 次连对）也算用过
  const byQ = new Map<string, typeof recentAttempts>();
  for (const a of recentAttempts) {
    const arr = byQ.get(a.questionId) ?? [];
    arr.push(a);
    byQ.set(a.questionId, arr);
  }
  const masteredIds = new Set<string>();
  for (const [qId, list] of byQ) {
    list.sort((a, b) => a.createdAt - b.createdAt);
    if (list.length >= 3 && list.slice(-3).every((a) => a.isCorrect)) {
      masteredIds.add(qId);
    }
  }
  return inTerm.filter(
    (q) => !recentCorrectIds.has(q.question_id) && !masteredIds.has(q.question_id),
  ).length;
}

/**
 * 选最弱的 N 个 skill（按 term/preferredUnit 过滤后）。
 * mastery 越低优先；没 mastery 数据的当作 50。
 *
 * 用于多 skill 模式让一次 trigger 跨 skill 出题，整出 30+ 道丰富题型。
 */
function pickWeakestSkills(args: TriggerArgs, n: number): Skill[] {
  const termUnits = args.currentTerm
    ? args.units.filter((u) => u.term === args.currentTerm)
    : args.units;
  const termUnitIds = new Set(termUnits.map((u) => u.id));
  const termSkills = args.skills.filter((s) => termUnitIds.has(s.unitId));
  const candidates = termSkills.length > 0 ? termSkills : args.skills;

  let unitFiltered = candidates;
  if (args.preferredUnitId) {
    const us = candidates.filter((s) => s.unitId === args.preferredUnitId);
    if (us.length > 0) unitFiltered = us;
  }
  return unitFiltered.slice(0, n * 3); // 给排序留一点 buffer，下面 caller 会再排
}

/**
 * 后台触发：选最弱 N 个 skill → AI 出题 → 写 db.questions。
 *
 * dedup 保证一次只跑一个。永远 await 完整 promise 但调用方可以不 await。
 *
 * 多 skill 模式：args.multiSkillCount > 1 时跨 skill 串行跑（前一个跑完才开
 * 下一个），UI 更新进度。各 skill 之间不并行——避免后端 LLM provider 同时
 * 收到 N 个 30 题请求被限流。
 */
export async function triggerBackgroundGen(args: TriggerArgs): Promise<void> {
  if (currentStatus.state === "running") {
    console.log("[bgGen] already running, skipping");
    return;
  }
  const multiCount = Math.max(1, Math.min(5, args.multiSkillCount ?? 1));
  const perSkillCount = args.count ?? 10;

  // 拿 mastery 排序选最弱
  const masteryRows = await db.mastery
    .where("studentId")
    .equals(args.studentId)
    .filter((m: MasteryScore) => m.subjectId === args.subjectId)
    .toArray();
  const masteryById = new Map(masteryRows.map((m) => [m.skillId, m.score]));

  const candidates = pickWeakestSkills(args, multiCount);
  const sorted = candidates
    .map((s) => ({ s, m: masteryById.get(s.id) ?? 50 }))
    .sort((a, b) => a.m - b.m)
    .slice(0, multiCount)
    .map((x) => x.s);

  if (sorted.length === 0) {
    setBgStatus({
      state: "failed",
      subjectId: args.subjectId,
      reason: "找不到合适的 skill",
      finishedAt: Date.now(),
    });
    setTimeout(() => {
      if (currentStatus.state === "failed") setBgStatus({ state: "idle" });
    }, 8000);
    return;
  }

  let totalGenerated = 0;
  const allFailures: string[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const pickedSkill = sorted[i]!;
    const unit = args.units.find((u) => u.id === pickedSkill.unitId);
    const progress = sorted.length > 1 ? ` (${i + 1}/${sorted.length})` : "";
    setBgStatus({
      state: "running",
      subjectId: args.subjectId,
      skillName: pickedSkill.name,
      startedAt: Date.now(),
      message: `小进正在为「${pickedSkill.name}」准备 ${perSkillCount} 道新题${progress}…`,
    });

    try {
      const existingStems = args.seedQuestions
        .filter((q) => q.skill_id === pickedSkill.id)
        .map((q) => q.stem)
        .slice(0, 10);

      const r = await generateAiQuestions({
        subjectId: args.subjectId,
        unitId: pickedSkill.unitId,
        unitName: unit?.name,
        skillId: pickedSkill.id,
        skillName: pickedSkill.name,
        count: perSkillCount,
        difficulty: "2-4",
        term: args.currentTerm ?? "下册",
        existingStems,
      });

      if (r.questions.length === 0) {
        allFailures.push(`${pickedSkill.name}: 校验全失败`);
        continue;
      }

      const stamped = r.questions.map((q) => ({
        ...q,
        subjectId: args.subjectId,
      }));
      await db.questions.bulkPut(stamped as never);
      totalGenerated += stamped.length;
    } catch (e) {
      allFailures.push(
        `${pickedSkill.name}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  if (totalGenerated === 0) {
    setBgStatus({
      state: "failed",
      subjectId: args.subjectId,
      reason: allFailures[0] ?? "AI 出题全部失败",
      finishedAt: Date.now(),
    });
    setTimeout(() => {
      if (currentStatus.state === "failed") setBgStatus({ state: "idle" });
    }, 8000);
    return;
  }

  setBgStatus({
    state: "success",
    subjectId: args.subjectId,
    skillName:
      sorted.length === 1
        ? sorted[0]!.name
        : `${sorted.length} 个 skill`,
    count: totalGenerated,
    finishedAt: Date.now(),
  });

  setTimeout(() => {
    if (currentStatus.state === "success") setBgStatus({ state: "idle" });
  }, 5000);
}

/**
 * 智能补题：先检查题库是否够新鲜（≥ 30 道），不够才触发后台出题。
 *
 * 用于完成训练后的"恰当时机"自动补题——题库充足时一次都不打扰。
 */
export async function triggerBgGenIfLow(args: TriggerArgs): Promise<void> {
  const fresh = await countFreshQuestions({
    subjectId: args.subjectId,
    studentId: args.studentId,
    units: args.units,
    currentTerm: args.currentTerm,
  });
  if (fresh >= FRESH_QUESTION_THRESHOLD) {
    console.log(
      `[bgGen] fresh=${fresh} ≥ ${FRESH_QUESTION_THRESHOLD}, skipping auto-gen`,
    );
    return;
  }
  console.log(
    `[bgGen] fresh=${fresh} < ${FRESH_QUESTION_THRESHOLD}, triggering multi-skill gen`,
  );
  // 缺多少补多少（最多 30 道 = 3 skill × 10 题）
  const need = FRESH_QUESTION_THRESHOLD - fresh;
  const skillsNeeded = Math.ceil(need / 10);
  return triggerBackgroundGen({
    ...args,
    count: 10,
    multiSkillCount: Math.min(3, Math.max(1, skillsNeeded)),
  });
}

/** 调用方主动清除（罕见用），如管理页"重置进度"后 */
export function clearBgGenStatus() {
  setBgStatus({ state: "idle" });
}
