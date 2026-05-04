/**
 * AI 质检客户端：把题分批发给 /api/agent/judge-questions，按 quality-rubric.md
 * 让模型判定 verdict / severity / reason / issues。
 *
 * 调用方（QuestionsAdminPanel）传一组题进来，本模块负责：
 *   - chunk 分批（每批 MAX_BATCH 道）
 *   - 并发限制（CONCURRENCY 个 in-flight）
 *   - 进度回调（已完成 / 总批次）
 *   - 单批失败不中断整体（partial success）
 *
 * 返回 Map<question_id, Judgment> 让 UI 直接拼显示。
 */
import { getStoredPassword } from "../db/cloudSync";
import type { Question } from "../core/types";

/** 服务端单批上限——对齐 functions/api/agent/judge-questions.ts MAX_BATCH=30。
 * 实测 30 道 ~3500 token 输入 + ~2000 token 输出，qwen-plus 能在 25s 内返回。
 * 如果未来发现稳定性差可以调到 20。 */
export const JUDGE_BATCH_SIZE = 20;

/** 浏览器侧并发批次数。3 个并发不会触发 Cloudflare 边缘 rate limit。 */
const CONCURRENCY = 3;

export type JudgeVerdict = "keep" | "delete" | "borderline";

export interface Judgment {
  question_id: string;
  verdict: JudgeVerdict;
  severity: 1 | 2 | 3 | 4 | 5;
  reason: string;
  issues: string[];
}

export interface JudgeProgress {
  done: number;
  total: number;
  judgments: Map<string, Judgment>;
  errors: { code: string; detail?: string; batchIndex: number }[];
}

interface JudgeApiResponse {
  ok?: boolean;
  judgments?: Judgment[];
  model?: string;
  provider?: string;
  error?: string;
  detail?: string;
}

function authHeader(): Record<string, string> {
  const pwd = getStoredPassword();
  return pwd ? { Authorization: `Bearer ${pwd}` } : {};
}

function summarizeForJudge(q: Question): Record<string, unknown> {
  // 服务端会再压一次，这里只过滤 obvious noise（图片 base64、长 solution_steps 等）
  return {
    question_id: q.question_id,
    stem: q.stem,
    skill_id: q.skill_id,
    skill_name: (q as { skill_name?: string }).skill_name,
    unit_id: q.unit_id,
    game_type: q.game_type,
    difficulty: q.difficulty,
    estimated_time_seconds: q.estimated_time_seconds,
    options: Array.isArray(q.options) ? q.options : undefined,
    answer: q.answer,
    common_errors: q.common_errors,
    hints: q.hints,
    solution_steps: q.solution_steps,
    tags: q.tags,
  };
}

async function judgeOneBatch(
  questions: Question[],
  subjectId: "math" | "chinese",
  scopeLabel: string,
  scopeFilter: string,
): Promise<Judgment[]> {
  const r = await fetch("/api/agent/judge-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({
      subjectId,
      scopeLabel,
      scopeFilter,
      questions: questions.map(summarizeForJudge),
    }),
  });
  let body: JudgeApiResponse | null = null;
  try {
    body = (await r.json()) as JudgeApiResponse;
  } catch {
    /* */
  }
  if (!r.ok || !body?.ok || !Array.isArray(body.judgments)) {
    throw new Error(`${body?.error ?? "request_failed"}_${r.status}: ${body?.detail ?? ""}`);
  }
  return body.judgments;
}

/**
 * 主入口：分批并发判定一组题。
 *
 * 进度通过 onProgress 回调推送（每批完成调一次）。
 * 失败的批不中断——继续跑剩余批，最终在 errors[] 里汇报。
 */
export async function judgeQuestionsInBatches(
  questions: Question[],
  opts: {
    subjectId: "math" | "chinese";
    scopeLabel: string;
    scopeFilter: string;
    onProgress?: (p: JudgeProgress) => void;
    signal?: AbortSignal;
  },
): Promise<JudgeProgress> {
  const batches: Question[][] = [];
  for (let i = 0; i < questions.length; i += JUDGE_BATCH_SIZE) {
    batches.push(questions.slice(i, i + JUDGE_BATCH_SIZE));
  }
  const total = batches.length;
  const judgments = new Map<string, Judgment>();
  const errors: JudgeProgress["errors"] = [];
  let done = 0;

  // 并发池：CONCURRENCY 个 worker，从 batches[] 里 pop 一个就 run
  let nextIdx = 0;
  const runWorker = async (): Promise<void> => {
    while (nextIdx < batches.length) {
      if (opts.signal?.aborted) return;
      const myIdx = nextIdx++;
      const batch = batches[myIdx]!;
      try {
        const result = await judgeOneBatch(batch, opts.subjectId, opts.scopeLabel, opts.scopeFilter);
        for (const j of result) {
          judgments.set(j.question_id, j);
        }
      } catch (e) {
        errors.push({
          code: "batch_failed",
          detail: e instanceof Error ? e.message : String(e),
          batchIndex: myIdx,
        });
      } finally {
        done++;
        opts.onProgress?.({ done, total, judgments, errors });
      }
    }
  };
  const workers = Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () =>
    runWorker(),
  );
  await Promise.all(workers);
  return { done, total, judgments, errors };
}
