/**
 * v0.34.65: AI question 持久化 — 救 1288 missing.
 *
 * 背景:
 *   - 之前 Ep45 写 grader resurrection 脚本时 1288 个 isCorrect=false attempt 因
 *     "question 定义找不到" 没法重判 (qPool 只有 seed + backup + ai-questions.json
 *     一个老 v1 blob, 总共 2266 题, 而 attempts 引用的 question_id 很多是 historical
 *     AI 出过、客户端没回写、blob 也没追加的)。
 *   - 老的 client cloudSync 有 pushAiQuestions 但跑 OSS users/{uid}/ai-questions.json
 *     一个 blob 文件、容易丢内容; 而且只 push 当前 session 出的题。
 *
 * 修法 (per-key 模式, 跟 trophy-images Ep39 学的):
 *   - 每生成一道 AI 题, server 同步写 users/{uid}/ai-questions/{qid}.json (1 题 1 key)
 *   - 不维护中央 manifest (避免 RMW race) — 未来 resurrection 改用 oss.list({prefix})
 *   - parallel write, 总预算 2.5s (ESA 11s 之内 LLM ~8s + 这 2.5s 仍有 buffer)
 *   - 写失败不阻塞响应 (resurrection 是 nice-to-have, 出题成功是主路径)
 *
 * 数据 shape (每个 .json):
 *   完整 normalized question 对象 (含 stem/answer/options/hints/...)
 *   + persistedAt: epoch ms (用 ES module 自带 Date.now)
 */

import type { OssConfig } from "./oss";
import { ossPut } from "./oss";

export interface PersistedAiQuestion {
  question_id: string;
  /** All other Question fields (stem, answer, options, ...). 透传 normalize 后的 question */
  [k: string]: unknown;
  persistedAt?: number;
}

export interface PersistReport {
  attempted: number;
  succeeded: number;
  failed: number;
  /** 错误样本 (前 3 条) — 给 admin 看是不是 OSS 出鬼 */
  errors: string[];
  /** 整体耗时 ms (含 abort budget) */
  elapsedMs: number;
}

const WRITE_BUDGET_MS = 2_500;

export function aiQuestionKey(userId: string, questionId: string): string {
  // 没做 URL encode — question_id 由 generate.ts stamp 时控制 (AI_xxx_<idx>__<stamp>_<i>),
  // 全 alphanumeric + underscore, 符合 OSS key 合法字符。
  return `users/${userId}/ai-questions/${questionId}.json`;
}

/**
 * 写 N 道 question 到 OSS per-key. parallel, time-budgeted.
 * 不抛错: 出错的题计入 report.failed, 主流程继续.
 */
export async function persistAiQuestions(
  cfg: OssConfig,
  userId: string,
  questions: Array<Record<string, unknown>>,
): Promise<PersistReport> {
  const t0 = Date.now();
  const report: PersistReport = {
    attempted: questions.length,
    succeeded: 0,
    failed: 0,
    errors: [],
    elapsedMs: 0,
  };
  if (questions.length === 0) {
    report.elapsedMs = Date.now() - t0;
    return report;
  }

  // budget timer: 任意一个 PUT 在预算外 race 输 → 标 failed
  const budgetSignal = AbortSignal.timeout(WRITE_BUDGET_MS);

  const writes = questions.map(async (q) => {
    const qid = q.question_id;
    if (typeof qid !== "string" || !qid) {
      return { ok: false, error: "missing_question_id" };
    }
    const payload: PersistedAiQuestion = {
      ...(q as PersistedAiQuestion),
      question_id: qid,
      persistedAt: Date.now(),
    };
    const body = JSON.stringify(payload);
    // race with budget; ossPut 自己也有 fetch timeout
    try {
      const r = await Promise.race([
        ossPut(cfg, aiQuestionKey(userId, qid), body, {
          contentType: "application/json; charset=utf-8",
        }),
        new Promise<{ ok: false; error: string }>((_, reject) => {
          budgetSignal.addEventListener("abort", () => reject(new Error("write_budget_exceeded")));
        }),
      ]);
      if ("ok" in r && r.ok) return { ok: true };
      return { ok: false, error: ("error" in r ? r.error : null) ?? "unknown" };
    } catch (e) {
      return { ok: false, error: (e as Error).message?.slice(0, 80) ?? "fetch_failed" };
    }
  });

  const results = await Promise.allSettled(writes);
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) {
      report.succeeded++;
    } else {
      report.failed++;
      const err = r.status === "fulfilled" ? r.value.error : r.reason?.message ?? "rejected";
      if (report.errors.length < 3) report.errors.push(err);
    }
  }
  report.elapsedMs = Date.now() - t0;
  return report;
}
