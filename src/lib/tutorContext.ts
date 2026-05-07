/**
 * Tutor 学情上下文 — 给 realtime 小进调出 Selena 的实时数据。
 *
 * 两层使用：
 *  1. 启动时一次性快照 → 写进 session.update.instructions（Phase 2）
 *     用于 "我最近怎么样" / "我什么 skill 最弱" 这类高频问题，无 round-trip
 *  2. 运行时 tool calls（Phase 3）
 *     AI 想看具体错题 / 某 skill 的细节时主动调，按需拉数据
 */

import { db } from "../db/dexie";
import { SKILLS } from "../content/skills";
import { computeCurrentRating } from "../db/service";
import { tierById } from "../core/tiers";
import type { Question, MasteryScore, Attempt, MistakeReview } from "../core/types";

const SKILL_MAP = new Map(SKILLS.map((s) => [s.id, s]));
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

export interface SelenaSnapshot {
  studentName: string;
  tier: string;
  xpTotal: number;
  last7d: {
    totalAttempts: number;
    correctCount: number;
    accuracy: number;
    daysActive: number;
  };
  weakSkills: { skillId: string; skillName: string; mastery: number }[];
  unresolvedMistakeCount: number;
  sampleMistakes: { stem: string; userAnswer: string; correctAnswer: string; skillName: string }[];
}

/** 拼"答案文本"的小工具 */
function answerText(q: Question | undefined): string {
  if (!q) return "(已删)";
  const a = q.answer;
  if (a.type === "number") return `${a.value}${a.unit ?? ""}`;
  if (a.type === "choice") return a.value;
  return a.steps.map((s) => `${s.step_id}=${s.expected}`).join("；");
}

/** 用户答案的可读形式 */
function userAnswerText(a: unknown): string {
  if (a == null) return "-";
  if (typeof a === "string" || typeof a === "number") return String(a);
  if (Array.isArray(a)) return a.map((x) => String(x)).join(", ");
  if (typeof a === "object") {
    return Object.entries(a as Record<string, unknown>)
      .map(([k, v]) => `${k}=${v ?? ""}`)
      .join("；");
  }
  return String(a);
}

export async function gatherSnapshot(studentId: string, studentName: string): Promise<SelenaSnapshot> {
  const now = Date.now();
  const [attempts, masteries, mistakes, questions] = await Promise.all([
    db.attempts.where({ studentId }).toArray(),
    db.mastery.where({ studentId }).toArray(),
    db.mistakes.where({ studentId }).toArray(),
    db.questions.toArray(),
  ]);
  const qmap = new Map(questions.map((q) => [q.question_id, q]));

  const recent7 = attempts.filter((a) => a.createdAt >= now - WEEK);
  const correct7 = recent7.filter((a) => a.isCorrect).length;
  const daysActive = new Set(recent7.map((a) => Math.floor(a.createdAt / DAY))).size;

  // 最弱 3 skill：mastery score 升序 + 至少 5 次答题（避免没数据的 skill）
  const weakSkills = masteries
    .filter((m) => m.attemptsCount >= 5)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((m) => ({
      skillId: m.skillId,
      skillName: SKILL_MAP.get(m.skillId)?.name ?? m.skillId,
      mastery: Math.round(m.score),
    }));

  const unresolvedMistakes = mistakes.filter((m) => !m.resolved && qmap.has(m.questionId));
  const sampleMistakes = unresolvedMistakes
    .slice()
    .sort((a, b) => b.lastAttemptAt - a.lastAttemptAt)
    .slice(0, 3)
    .map((m) => {
      const q = qmap.get(m.questionId)!;
      // 找最近一次该题的 attempt 拿用户答案
      const lastA = attempts
        .filter((a) => a.questionId === m.questionId)
        .sort((x, y) => y.createdAt - x.createdAt)[0];
      return {
        stem: q.stem,
        userAnswer: lastA ? userAnswerText(lastA.answer) : "-",
        correctAnswer: answerText(q),
        skillName: SKILL_MAP.get(q.skill_id)?.name ?? q.skill_id,
      };
    });

  // 段位 / XP（用 G4B 当前默认）
  let tierLabel = "和平街小学";
  let xpTotal = 0;
  try {
    const r = await computeCurrentRating(studentId, "下册");
    tierLabel = `${r.tier.name} ${r.subRankRoman}`;
    xpTotal = r.score;
  } catch {
    /* 容错：拿不到就空 */
  }
  // 防御：tier 名拿不到时退到默认
  if (!tierLabel) tierLabel = tierById("school")?.name ?? "和平街小学";

  return {
    studentName,
    tier: tierLabel,
    xpTotal,
    last7d: {
      totalAttempts: recent7.length,
      correctCount: correct7,
      accuracy: recent7.length > 0 ? correct7 / recent7.length : 0,
      daysActive,
    },
    weakSkills,
    unresolvedMistakeCount: unresolvedMistakes.length,
    sampleMistakes,
  };
}

/** 把快照渲染成给小进读的 plain-text instructions 段落 */
export function snapshotToInstructions(snap: SelenaSnapshot): string {
  const lines: string[] = [];
  lines.push(`=== Selena 学情快照（实时数据，用来回答她"我最近怎么样"之类问题）===`);
  lines.push(`姓名：${snap.studentName}（9 岁，四年级）`);
  lines.push(`段位：${snap.tier} · 累计 XP ${snap.xpTotal.toLocaleString()}`);
  if (snap.last7d.totalAttempts > 0) {
    lines.push(
      `最近 7 天：做了 ${snap.last7d.totalAttempts} 题，正确 ${snap.last7d.correctCount} 题（正确率 ${Math.round(snap.last7d.accuracy * 100)}%），活跃 ${snap.last7d.daysActive} 天`,
    );
  } else {
    lines.push("最近 7 天还没练。");
  }
  if (snap.weakSkills.length > 0) {
    lines.push(
      `当前最弱 3 个 skill：${snap.weakSkills.map((s) => `"${s.skillName}"（熟练度 ${s.mastery}/100）`).join("、")}`,
    );
  }
  if (snap.unresolvedMistakeCount > 0) {
    lines.push(`未解决错题：${snap.unresolvedMistakeCount} 道`);
    if (snap.sampleMistakes.length > 0) {
      lines.push("代表错题：");
      for (const m of snap.sampleMistakes) {
        lines.push(`- [${m.skillName}] "${m.stem}" → 她答 ${m.userAnswer}，正确是 ${m.correctAnswer}`);
      }
    }
  }
  lines.push("");
  lines.push(`用这些数据具体回答；不要泛泛地说"挺好的"。`);
  return lines.join("\n");
}

/** 当前题目的 context（如果 tutor 是从某道题打开的）*/
export function currentQuestionToInstructions(args: {
  stem: string;
  correctAnswer?: string;
  studentAnswer?: string;
  skillName?: string;
}): string {
  const lines: string[] = ["=== 现在 Selena 在做这道题 ==="];
  if (args.skillName) lines.push(`知识点：${args.skillName}`);
  lines.push(`题目：${args.stem}`);
  if (args.correctAnswer) lines.push(`正确答案：${args.correctAnswer}`);
  if (args.studentAnswer) lines.push(`她的答案：${args.studentAnswer}`);
  lines.push("");
  lines.push(
    "如果她问的是这道题，先苏格拉底式问她思路 → 给一个小线索 → 让她自己算；不要直接报答案。",
  );
  return lines.join("\n");
}

// ============================================================
// Phase 3: tool 实现 —— AI 在对话过程中可以"调"这些 tool 拿数据
// ============================================================

export interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string; default?: unknown }>;
    required?: string[];
  };
  /** 客户端本地实现 — 收到 AI 调用请求时执行，把结果传回 */
  handler: (studentId: string, args: Record<string, unknown>) => Promise<unknown>;
}

export const TUTOR_TOOLS: ToolDef[] = [
  {
    name: "get_recent_mistakes",
    description:
      `查询 Selena 最近未解决的错题列表（题干 + 她答的 + 正确答案 + 知识点）。当她问"我哪些题做错了"/"我最近哪道题没搞懂"等具体错题问题时调。`,
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "最多返回几道，默认 5，最大 10",
          default: 5,
        },
      },
      required: [],
    },
    handler: async (studentId, args) => {
      const limit = Math.min(10, Math.max(1, Number(args.limit ?? 5)));
      const [mistakes, attempts, questions] = await Promise.all([
        db.mistakes.where({ studentId }).toArray(),
        db.attempts.where({ studentId }).toArray(),
        db.questions.toArray(),
      ]);
      const qmap = new Map(questions.map((q) => [q.question_id, q]));
      const lastByQ = new Map<string, Attempt>();
      for (const a of attempts) {
        const prev = lastByQ.get(a.questionId);
        if (!prev || a.createdAt > prev.createdAt) lastByQ.set(a.questionId, a);
      }
      const items = mistakes
        .filter((m) => !m.resolved && qmap.has(m.questionId))
        .sort((a, b) => b.lastAttemptAt - a.lastAttemptAt)
        .slice(0, limit)
        .map((m) => {
          const q = qmap.get(m.questionId)!;
          const last = lastByQ.get(m.questionId);
          return {
            skill: SKILL_MAP.get(q.skill_id)?.name ?? q.skill_id,
            difficulty: q.difficulty,
            stem: q.stem,
            herAnswer: last ? userAnswerText(last.answer) : "-",
            correctAnswer: answerText(q),
            mistakeStage: m.stage,
            lastAttemptAtISO: new Date(m.lastAttemptAt).toISOString().slice(0, 10),
          };
        });
      return { mistakes: items, totalUnresolved: mistakes.filter((m) => !m.resolved).length };
    },
  },
  {
    name: "get_skill_summary",
    description:
      `查询 Selena 各 skill 的熟练度，从最弱到最强。她问"我什么 skill 最弱"/"我数学整体怎么样"时调。返回 top 5 弱 + top 3 强。`,
    parameters: { type: "object", properties: {}, required: [] },
    handler: async (studentId) => {
      const masteries = await db.mastery.where({ studentId }).toArray();
      const decorated = (masteries as MasteryScore[])
        .filter((m) => m.attemptsCount >= 3)
        .map((m) => ({
          skill: SKILL_MAP.get(m.skillId)?.name ?? m.skillId,
          mastery: Math.round(m.score),
          attempts: m.attemptsCount,
          accuracy:
            m.attemptsCount > 0 ? Math.round((m.correctCount / m.attemptsCount) * 100) : 0,
        }))
        .sort((a, b) => a.mastery - b.mastery);
      return {
        weakest5: decorated.slice(0, 5),
        strongest3: decorated.slice(-3).reverse(),
        totalSkillsPracticed: decorated.length,
      };
    },
  },
  {
    name: "get_today_progress",
    description:
      `查询 Selena 今天的练习情况：做了几道题、正确率、最近一次练的什么 skill。她问"我今天怎么样"时调。`,
    parameters: { type: "object", properties: {}, required: [] },
    handler: async (studentId) => {
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const attempts = (await db.attempts.where({ studentId }).toArray()) as Attempt[];
      const todayAttempts = attempts.filter((a) => a.createdAt >= startOfToday);
      if (todayAttempts.length === 0) {
        return { practicedToday: false, message: "她今天还没开始练" };
      }
      const correct = todayAttempts.filter((a) => a.isCorrect).length;
      // 按 skill 统计今日活动
      const bySkill = new Map<string, { total: number; correct: number }>();
      for (const a of todayAttempts) {
        const s = bySkill.get(a.skillId) ?? { total: 0, correct: 0 };
        s.total += 1;
        if (a.isCorrect) s.correct += 1;
        bySkill.set(a.skillId, s);
      }
      const skillBreakdown = Array.from(bySkill.entries())
        .map(([id, s]) => ({
          skill: SKILL_MAP.get(id)?.name ?? id,
          total: s.total,
          correct: s.correct,
          accuracy: Math.round((s.correct / s.total) * 100),
        }))
        .sort((a, b) => b.total - a.total);
      return {
        practicedToday: true,
        totalAttempts: todayAttempts.length,
        correctCount: correct,
        accuracy: Math.round((correct / todayAttempts.length) * 100),
        skillBreakdown,
      };
    },
  },
];

// helper used by snapshot — mistakes table type alias for clarity
export type _MistakeReviewType = MistakeReview;

/** 把 TUTOR_TOOLS 绑到指定 studentId，转成 RealtimeTutor 接受的 ToolDefinition 形 */
export function bindToolsForStudent(studentId: string): {
  name: string;
  description: string;
  parameters: ToolDef["parameters"];
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}[] {
  return TUTOR_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
    handler: (args) => t.handler(studentId, args),
  }));
}
