/**
 * v0.35.8 (iter 42 P2-3): 线下试卷错题录入 — 类型 + 持久化.
 *
 * 评审共识: v1 砍 OCR, 改"手动录入 + 推送" 闭环验证.
 * - 不动 db.mistakes (评审 B 防污染 mastery)
 * - 用 sourceType="real_paper" + affectsMastery=false 元标
 * - 不在录入时调 AI 生成同型 (lazy, Selena 训练时再 generate)
 * - 推送幂等 (paperQuestionId, pushedAt 防重)
 */

export type PaperKind = "midterm" | "final" | "homework" | "quiz" | "other";

export interface PaperMistakeEntry {
  /** 稳定 ID (UUID), 推送幂等用 */
  paperQuestionId: string;
  /** 题干 (admin 手敲) */
  stem: string;
  /** 正确答案 (admin 手敲) */
  correctAnswer: string;
  /** Selena 写的错答 */
  studentAnswer: string;
  /** Admin 标记的错误原因 (e.g., "进位漏" / "单位错") */
  errorTag?: string;
  /** Admin 备注 (e.g., "这道题考试时跳了") */
  notes?: string;
  /** 已推送时间 (null = 草稿) */
  pushedAt?: number;
}

export interface PaperRecord {
  paperId: string;
  /** 目标 cadet user_id */
  cadetUid: string;
  /** 试卷类型 */
  kind: PaperKind;
  /** 试卷名 / 描述 */
  title: string;
  /** 录入时间 */
  createdAt: number;
  /** 最后修改 */
  updatedAt: number;
  /** 录入人 (admin user_id) */
  enteredBy: string;
  /** 错题列表 (只录错的, 不录全卷) */
  mistakes: PaperMistakeEntry[];
}

/* ──────────────────── 校验 ──────────────────── */

export function validatePaperMistake(m: PaperMistakeEntry): string | null {
  if (!m.stem || m.stem.trim().length < 2) return "题干不能为空";
  if (!m.correctAnswer || m.correctAnswer.trim().length < 1) return "正确答案不能为空";
  if (!m.studentAnswer || m.studentAnswer.trim().length < 1) return "Selena 答案不能为空 (用'空'表示她没写)";
  return null;
}

/* ──────────────────── OSS key 约定 ──────────────────── */

export function paperOssKey(cadetUid: string, paperId: string): string {
  return `users/${cadetUid}/paper-mistakes/${paperId}.json`;
}

export function paperListOssPrefix(cadetUid: string): string {
  return `users/${cadetUid}/paper-mistakes/`;
}

/* ──────────────────── 生成 ID ──────────────────── */

export function genPaperId(): string {
  return `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function genPaperMistakeId(): string {
  return `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
