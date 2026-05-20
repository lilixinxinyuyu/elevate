/**
 * v0.36.25 (爸爸 review): 统一 tutor 对话存储 helper.
 *
 * 起源: review 发现 persist 逻辑耦合在 TutorPanel 内, SpeakWordPanel(英语听读音)
 * 根本不存对话, 且 scenario(唤醒场景)/mode(realtime/explain/voice)/promptMeta
 * (组装配方) 都没存. 抽成统一 helper, 所有跟小进对话的场景 (数学/语文讲题 /
 * 英语听读音 / 未来 minigame) 都调这个, 存全数据 + 易复用.
 *
 * 存什么:
 *   - 对话内容 messages
 *   - 学科 subjectId + 题目/skill/答案
 *   - scenario: 什么情况唤醒 (wrong_retry/skill_help/review_session/free_chat/english_speak)
 *   - mode: 走哪条路 (realtime/explain/voice)
 *   - promptMeta: 组装配方 (prompt ID only — 用了哪些 prompt block, 不存全文)
 */
import { db } from "../db/dexie";
import type { TutorSession, TutorMessage, TutorPromptMeta, SubjectId } from "../core/types";

export interface UpsertTutorSessionArgs {
  /** null = 新建 (返回新 id); 有 id = 更新这条 */
  sessionId: string | null;
  studentId: string;
  subjectId?: SubjectId;
  /** 唤醒场景 — 必传, 让记录能区分什么情况调起小进 */
  scenario: string;
  /** 走哪条路 — realtime(wss) / explain(HTTP文字) / voice(HTTP语音) */
  mode?: "realtime" | "explain" | "voice";
  /** prompt 组装配方 (ID only) */
  promptMeta?: TutorPromptMeta;
  attemptId?: string;
  questionId?: string;
  skillId?: string;
  skillName?: string;
  questionStem?: string;
  correctAnswer?: string;
  studentInitialAnswer?: string;
  messages: TutorMessage[];
}

/**
 * 统一 upsert tutor 对话记录. 任何跟小进对话的场景都调这个 — 存全 + 复用.
 *
 * @returns sessionId (新建时是新生成的, 更新时是原 id). messages 空时不写, 返回原 sessionId.
 */
export async function upsertTutorSession(args: UpsertTutorSessionArgs): Promise<string | null> {
  if (!args.studentId || args.messages.length === 0) return args.sessionId;
  try {
    const now = Date.now();
    let id = args.sessionId;
    if (!id) {
      id = `tutor-${args.scenario}-${args.attemptId ?? "x"}-${now}-${Math.random().toString(36).slice(2, 8)}`;
      const row: TutorSession = {
        id,
        studentId: args.studentId,
        subjectId: args.subjectId,
        attemptId: args.attemptId,
        questionId: args.questionId,
        skillId: args.skillId,
        skillName: args.skillName,
        questionStem: args.questionStem,
        correctAnswer: args.correctAnswer,
        studentInitialAnswer: args.studentInitialAnswer,
        messages: args.messages,
        scenario: args.scenario,
        mode: args.mode,
        promptMeta: args.promptMeta,
        startedAt: now,
        updatedAt: now,
      };
      await db.tutorSessions.put(row);
    } else {
      const existing = await db.tutorSessions.get(id);
      if (existing) {
        existing.messages = args.messages;
        existing.updatedAt = now;
        // 对话过程可能切 mode (realtime 失败 → explain), 更新最终走的路 + 配方
        if (args.mode) existing.mode = args.mode;
        if (args.promptMeta) existing.promptMeta = args.promptMeta;
        await db.tutorSessions.put(existing);
      }
    }
    return id;
  } catch (e) {
    console.warn("[tutorSessionStore] upsert failed", e);
    return args.sessionId;
  }
}

/**
 * 组装 promptMeta (prompt ID 配方). 各场景调用方拼好 blocks 列表传进来.
 * blocks 用稳定 ID: "baseSys" / "talent" / "snapshot" / "scenario:wrong_retry" /
 * "questionCtx" / "englishScoring" 等.
 */
export function buildPromptMeta(
  scenario: string,
  mode: "realtime" | "explain" | "voice",
  blocks: string[],
  subjectId?: string,
): TutorPromptMeta {
  return { scenario, mode, subjectId, blocks };
}
