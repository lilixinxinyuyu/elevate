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
  return requestAdaptiveQuestion({
    question,
    difficultyDelta: 0,
    callerTag: "retry-after-wrong",
  });
}

/** 太顺利了：再出一道 +1 difficulty 的同 skill 题。 */
export function requestHarderQuestion(question: Question): Promise<Question[]> {
  return requestAdaptiveQuestion({
    question,
    difficultyDelta: 1,
    callerTag: "bump-up",
  });
}
