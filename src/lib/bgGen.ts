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
  count?: number;
}

/**
 * 后台触发：选最弱 skill → AI 出题 → 写 db.questions。
 * dedup 保证一次只跑一个（如果已经在 running，本次调用 no-op）。
 *
 * 永远 await 完整 promise 但调用方可以不 await（fire-and-forget）。
 */
export async function triggerBackgroundGen(args: TriggerArgs): Promise<void> {
  if (currentStatus.state === "running") {
    console.log("[bgGen] already running, skipping");
    return;
  }
  // 选 skill：先按 term 过滤 → 看 mastery 选最弱 → 没数据则随机
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

  const masteryRows = await db.mastery
    .where("studentId")
    .equals(args.studentId)
    .filter((m: MasteryScore) => m.subjectId === args.subjectId)
    .toArray();
  const masteryById = new Map(masteryRows.map((m) => [m.skillId, m.score]));

  let pickedSkill: Skill | null = null;
  const withMastery = unitFiltered.filter((s) => masteryById.has(s.id));
  if (withMastery.length > 0) {
    const sorted = withMastery
      .map((s) => ({ s, m: masteryById.get(s.id)! }))
      .sort((a, b) => a.m - b.m);
    const top3 = sorted.slice(0, Math.min(3, sorted.length));
    pickedSkill = top3[Math.floor(Math.random() * top3.length)]?.s ?? null;
  } else {
    pickedSkill =
      unitFiltered[Math.floor(Math.random() * unitFiltered.length)] ?? null;
  }

  if (!pickedSkill) {
    setBgStatus({
      state: "failed",
      subjectId: args.subjectId,
      reason: "找不到合适的 skill",
      finishedAt: Date.now(),
    });
    return;
  }

  const unit = args.units.find((u) => u.id === pickedSkill!.unitId);
  setBgStatus({
    state: "running",
    subjectId: args.subjectId,
    skillName: pickedSkill.name,
    startedAt: Date.now(),
    message: `小进正在为「${pickedSkill.name}」准备新题…`,
  });

  try {
    const existingStems = args.seedQuestions
      .filter((q) => q.skill_id === pickedSkill!.id)
      .map((q) => q.stem)
      .slice(0, 30);

    const r = await generateAiQuestions({
      subjectId: args.subjectId,
      unitId: pickedSkill.unitId,
      unitName: unit?.name,
      skillId: pickedSkill.id,
      skillName: pickedSkill.name,
      count: args.count ?? 5,
      difficulty: "2-4",
      term: args.currentTerm ?? "下册",
      existingStems,
    });

    if (r.questions.length === 0) {
      setBgStatus({
        state: "failed",
        subjectId: args.subjectId,
        reason: "AI 出的题都没通过校验",
        finishedAt: Date.now(),
      });
      return;
    }

    const stamped = r.questions.map((q) => ({ ...q, subjectId: args.subjectId }));
    await db.questions.bulkPut(stamped as never);

    setBgStatus({
      state: "success",
      subjectId: args.subjectId,
      skillName: pickedSkill.name,
      count: stamped.length,
      finishedAt: Date.now(),
    });

    // 5 秒后自动回 idle，避免顶部条永远显示成功消息
    setTimeout(() => {
      if (
        currentStatus.state === "success" &&
        currentStatus.finishedAt === Date.now() // 同一个 success 没被新 run 覆盖
      ) {
        setBgStatus({ state: "idle" });
      }
    }, 5000);
    setTimeout(() => {
      if (currentStatus.state === "success") {
        setBgStatus({ state: "idle" });
      }
    }, 5000);
  } catch (e) {
    setBgStatus({
      state: "failed",
      subjectId: args.subjectId,
      reason: e instanceof Error ? e.message : String(e),
      finishedAt: Date.now(),
    });
    setTimeout(() => {
      if (currentStatus.state === "failed") {
        setBgStatus({ state: "idle" });
      }
    }, 8000);
  }
}

/** 调用方主动清除（罕见用），如管理页"重置进度"后 */
export function clearBgGenStatus() {
  setBgStatus({ state: "idle" });
}
