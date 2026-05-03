/**
 * 语文勋章定义。
 *
 * 设计原则（参考 math 的 trophies + Elevate iOS）：
 *  - 9 个单次解锁勋章（不同维度的"首次成就"）
 *  - 5 个计数型勋章（做题量、错题攻克、连击长度等里程碑）
 *
 * 不依赖 math 的 TROPHIES 数据；命名空间 c4b_xxx 避开冲突。
 *
 * 检查上下文 attempts / mastery 都已经按 subjectId="chinese" 过滤好。
 */

import type { Attempt, MasteryScore } from "../../core/types";

export interface ChineseTrophyContext {
  studentId: string;
  attempts: Attempt[];
  mastery: MasteryScore[];
}

export interface ChineseTrophyDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** 单次解锁：返回 true 时给一枚 */
  check?: (ctx: ChineseTrophyContext) => boolean;
  /** 计数型：返回当前应有的总枚数；service 跟已记录数对比补差 */
  tier?: (ctx: ChineseTrophyContext) => number;
}

export const CHINESE_TROPHIES: ChineseTrophyDef[] = [
  // ===== 单次解锁 =====
  {
    id: "c4b_first_correct",
    name: "初露锋芒",
    description: "答对第一道语文题",
    icon: "🌱",
    check: (c) => c.attempts.some((a) => a.isCorrect),
  },
  {
    id: "c4b_first_dictation",
    name: "听音识字",
    description: "答对第一道听写题",
    icon: "🎧",
    check: (c) =>
      c.attempts.some(
        (a) =>
          a.isCorrect &&
          a.skillId.endsWith("_DICTATION"),
      ),
  },
  {
    id: "c4b_first_poem",
    name: "诗书启蒙",
    description: "答对第一道古诗题",
    icon: "📜",
    check: (c) =>
      c.attempts.some(
        (a) =>
          a.isCorrect &&
          (a.skillId.includes("POEM") || a.skillId.includes("RECITE")),
      ),
  },
  {
    id: "c4b_first_rhetoric",
    name: "辨修辞",
    description: "答对第一道修辞题",
    icon: "🎭",
    check: (c) =>
      c.attempts.some((a) => a.isCorrect && a.skillId.includes("RHET")),
  },
  {
    id: "c4b_perfect_unit",
    name: "单元满贯",
    description: "在某个单元下连续 5 道题全对",
    icon: "💯",
    check: (c) => {
      // 按 skillId 前缀分组（C4B_U1_*, C4B_U2_* …）
      const byUnit = new Map<string, Attempt[]>();
      for (const a of c.attempts) {
        const m = a.skillId.match(/^(C4B_U\d+)_/);
        if (!m) continue;
        const arr = byUnit.get(m[1]!) ?? [];
        arr.push(a);
        byUnit.set(m[1]!, arr);
      }
      for (const arr of byUnit.values()) {
        // 看最近 5 道
        const recent = arr.slice(-5);
        if (recent.length >= 5 && recent.every((a) => a.isCorrect)) return true;
      }
      return false;
    },
  },
  {
    id: "c4b_combo_5",
    name: "连击 5",
    description: "连续 5 道题全对",
    icon: "🔥",
    check: (c) => c.attempts.some((a) => a.isCorrect && a.comboAtEnd >= 5),
  },
  {
    id: "c4b_combo_10",
    name: "连击 10",
    description: "连续 10 道题全对，势如破竹",
    icon: "🚀",
    check: (c) => c.attempts.some((a) => a.isCorrect && a.comboAtEnd >= 10),
  },
  {
    id: "c4b_skill_master",
    name: "技能精通",
    description: "任意一个技能 mastery 达到 90+",
    icon: "🧠",
    check: (c) => c.mastery.some((m) => m.score >= 90),
  },
  {
    id: "c4b_polymath",
    name: "全能学子",
    description: "4 个单元每个都答对至少 5 道题",
    icon: "🏆",
    check: (c) => {
      const correctByUnit = new Map<string, number>();
      for (const a of c.attempts) {
        if (!a.isCorrect) continue;
        const m = a.skillId.match(/^(C4B_U\d+)_/);
        if (!m) continue;
        correctByUnit.set(m[1]!, (correctByUnit.get(m[1]!) ?? 0) + 1);
      }
      const units = ["C4B_U1", "C4B_U2", "C4B_U3", "C4B_U4"];
      return units.every((u) => (correctByUnit.get(u) ?? 0) >= 5);
    },
  },

  // ===== 计数型（每解锁一次给一枚） =====
  {
    id: "c4b_correct_25",
    name: "做题达人 · 25",
    description: "累计答对 25 道",
    icon: "✏️",
    tier: (c) => Math.floor(c.attempts.filter((a) => a.isCorrect).length / 25),
  },
  {
    id: "c4b_dictation_master",
    name: "听写小能手",
    description: "累计答对 10 道听写题",
    icon: "🎼",
    tier: (c) =>
      Math.floor(
        c.attempts.filter((a) => a.isCorrect && a.skillId.endsWith("_DICTATION"))
          .length / 10,
      ),
  },
  {
    id: "c4b_poem_keeper",
    name: "诗词储备家",
    description: "累计答对 8 道古诗题",
    icon: "🪷",
    tier: (c) =>
      Math.floor(
        c.attempts.filter(
          (a) =>
            a.isCorrect &&
            (a.skillId.includes("POEM") || a.skillId.includes("RECITE")),
        ).length / 8,
      ),
  },
  {
    id: "c4b_session_count",
    name: "勤学之星",
    description: "完成 5 组训练（每组 10 题）",
    icon: "⭐",
    tier: (c) => {
      // 用 sessionId 去重
      const sessions = new Set<string>();
      for (const a of c.attempts) {
        if (a.sessionId) sessions.add(a.sessionId);
      }
      return Math.floor(sessions.size / 5);
    },
  },
  {
    id: "c4b_overall_accuracy",
    name: "百炼成钢",
    description: "至少做 30 题且整体准确率 ≥85%",
    icon: "💎",
    check: (c) => {
      if (c.attempts.length < 30) return false;
      const correct = c.attempts.filter((a) => a.isCorrect).length;
      return correct / c.attempts.length >= 0.85;
    },
  },
];
