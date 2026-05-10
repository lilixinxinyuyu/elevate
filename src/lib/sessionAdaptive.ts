/**
 * 会话内自适应出题（v0.31.34）
 *
 * 用例：
 *   1. 答错某道题后：「再出一道类似的」按钮 → 同 skill / 同 difficulty / 同 format
 *      生成 1 道新题，用作即时巩固。
 *   2. 答得很顺利时：「加难度」 → 同 skill / +1 difficulty 生成 1 道。
 *
 * 实现：调 /api/generate/questions（已经过 v0.31.34 的 composer 升级），
 * 拿到题后写进 db.questions（标 ai_generated + session_adaptive tag），
 * 由会话引擎下一题选用即可。
 */

import { db } from "../db/dexie";
import type { Question, QuestionFormat } from "../core/types";
import { getStoredPassword } from "../db/cloudSync";

interface GenerateResponse {
  ok: boolean;
  questions?: Question[];
  error?: string;
  detail?: string;
  model?: string;
  provider?: string;
  partial?: boolean;
}

interface RequestSimilarOpts {
  /** 原题（决定 skill / format / difficulty / unit 等） */
  question: Question;
  /** 难度偏移（默认 0 = 相同；+1 = 加难） */
  difficultyDelta?: number;
  /** 调用上下文：'retry-after-wrong' / 'bump-up' / 'admin-quick'  仅日志用 */
  callerTag?: string;
  /**
   * v0.31.35: D5 综合题用 — 显式传额外 skill_id 让 composer 注入这些 skill 的 scope。
   * 不传时若 difficulty 升到 5 会自动按 unit 内随机挑一个其他 skill。
   */
  extraSkillIds?: string[];
}

function authHeader(): Record<string, string> {
  const pwd = getStoredPassword();
  return pwd ? { Authorization: `Bearer ${pwd}` } : {};
}

function clampDifficulty(d: number): 1 | 2 | 3 | 4 | 5 {
  if (d < 1) return 1;
  if (d > 5) return 5;
  return d as 1 | 2 | 3 | 4 | 5;
}

/**
 * 调 generate API + 把回来的题写进 db.questions。
 * 返回新题列表（已入库），失败抛错。
 */
export async function requestAdaptiveQuestion(
  opts: RequestSimilarOpts,
): Promise<Question[]> {
  const { question, difficultyDelta = 0, callerTag = "session-adaptive" } = opts;

  // 拿同 skill 已有的题干（去重）
  const sameSkillStems = await db.questions
    .where("skill_id")
    .equals(question.skill_id)
    .limit(20)
    .toArray()
    .then((rows) => rows.map((r) => r.stem ?? "").filter(Boolean));

  const targetDifficulty = clampDifficulty(question.difficulty + difficultyDelta);
  const format = question.question_format as QuestionFormat;

  // v0.31.35: D5 题自动挑一个同 unit 的其他 skill 当跨 skill 综合
  let extraSkillIds = opts.extraSkillIds;
  if (!extraSkillIds && targetDifficulty === 5) {
    const sameUnit = await db.questions
      .where("unit_id")
      .equals(question.unit_id)
      .toArray();
    const otherSkills = Array.from(
      new Set(sameUnit.map((q) => q.skill_id).filter((sid) => sid && sid !== question.skill_id)),
    );
    if (otherSkills.length > 0) {
      // 随机选 1 个
      extraSkillIds = [otherSkills[Math.floor(Math.random() * otherSkills.length)]!];
    }
  }

  const r = await fetch("/api/generate/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({
      subjectId: question.subjectId ?? "math",
      unitId: question.unit_id,
      unitName: question.unit_name,
      skillId: question.skill_id,
      skillName: question.skill_name,
      term: question.term,
      count: 1,
      difficulty: String(targetDifficulty),
      format,
      gameType: question.game_type,
      existingStems: sameSkillStems,
      extraSkillIds,
      // 把当前这道（错了的）题作为"考点焦点"传过去
      recentMistakeStems: difficultyDelta < 0 ? [question.stem] : [],
      callerTag,
    }),
  });

  let body: GenerateResponse | null = null;
  try {
    body = (await r.json()) as GenerateResponse;
  } catch {
    /* */
  }

  if (!r.ok || !body?.ok || !body.questions || body.questions.length === 0) {
    throw new Error(
      `generate_failed: ${body?.error ?? r.status} ${body?.detail ?? ""}`.trim(),
    );
  }

  // 标 session_adaptive tag，便于以后审计 + 区分
  const stamped = body.questions.map((q) => ({
    ...q,
    tags: Array.from(
      new Set([...(q.tags ?? []), "ai_generated", "session_adaptive", callerTag]),
    ),
  }));

  // 入库
  await db.questions.bulkPut(stamped);

  return stamped;
}

/** 答错后：再出一道同 skill 同 difficulty 同 format 的"巩固题"。 */
export function requestRetryQuestion(question: Question): Promise<Question[]> {
  // v0.31.73: 走轻量 /api/generate/variant 路径（小 prompt + 单题 + max_tokens=1800
  // → 实测 ~6-8s，相比旧 /api/generate/questions 的 25-50s 快 3-5 倍）。
  return requestVariantQuestion(question, "retry-after-wrong");
}

/**
 * v0.31.73: 调用 /api/generate/variant — 极简 prompt 出 1 道变式题。
 * 用于 retry / 实时巩固。失败时降级到 requestAdaptiveQuestion（全量 prompt）。
 */
export async function requestVariantQuestion(
  source: Question,
  callerTag = "variant",
): Promise<Question[]> {
  try {
    const r = await fetch("/api/generate/variant", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ sourceQuestion: source, callerTag }),
    });
    type VariantResponse = { ok: boolean; question?: Question; error?: string; detail?: string };
    let body: VariantResponse | null = null;
    try {
      body = (await r.json()) as VariantResponse;
    } catch {
      /* */
    }
    if (!r.ok || !body?.ok || !body.question) {
      throw new Error(`variant_failed: ${body?.error ?? r.status} ${body?.detail ?? ""}`.trim());
    }
    const q: Question = {
      ...body.question,
      tags: Array.from(
        new Set([...(body.question.tags ?? []), "ai_generated", "session_adaptive", "variant", callerTag]),
      ),
    };
    await db.questions.bulkPut([q]);
    return [q];
  } catch (e) {
    // 降级到全量 prompt（只在 variant 端点 fail 时）
    console.warn("[sessionAdaptive] variant fast path failed, fall back to full prompt:", (e as Error).message);
    return requestAdaptiveQuestion({
      question: source,
      difficultyDelta: 0,
      callerTag: `${callerTag}-fallback`,
    });
  }
}

/** 太顺利了：再出一道 +1 difficulty 的同 skill 题。 */
export function requestHarderQuestion(question: Question): Promise<Question[]> {
  return requestAdaptiveQuestion({
    question,
    difficultyDelta: 1,
    callerTag: "bump-up",
  });
}
