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
 *
 * v0.31.32 加 fixQuestion + applyQuestionFix —— 让 admin 把判错的题直接 AI 修
 * 而不是删掉重出。修过的题打上 ai_fixed tag，patch 存进 meta::questionPatches
 * 跨设备同步。
 */
import { db } from "./../db/dexie";
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

// ============================================================
//  AI 修题（v0.31.32）
// ============================================================

export interface FixResult {
  fixed: Question;
  changesSummary: string;
  model?: string;
}

/** 调 /api/agent/fix-question 让 LLM 修一道题 */
export async function fixQuestion(args: {
  question: Question;
  issues: string[];
  reason: string;
  subjectId?: "math" | "chinese";
}): Promise<FixResult> {
  const pwd = getStoredPassword();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (pwd) headers["Authorization"] = `Bearer ${pwd}`;

  const r = await fetch("/api/agent/fix-question", {
    method: "POST",
    headers,
    body: JSON.stringify({
      question: args.question,
      issues: args.issues,
      reason: args.reason,
      subjectId: args.subjectId ?? args.question.subjectId ?? "math",
    }),
  });
  if (!r.ok) {
    let parsed: { error?: string; detail?: string } | null = null;
    try {
      parsed = await r.json();
    } catch {
      /* */
    }
    throw new Error(
      `fix_question_failed: ${parsed?.error ?? r.status} ${parsed?.detail ?? ""}`.trim(),
    );
  }
  const j = (await r.json()) as {
    ok?: boolean;
    fixed?: Question;
    changesSummary?: string;
    model?: string;
    error?: string;
    detail?: string;
  };
  if (!j.ok || !j.fixed) {
    throw new Error(`fix_question_failed: ${j.error ?? "unknown"} ${j.detail ?? ""}`.trim());
  }
  return {
    fixed: j.fixed,
    changesSummary: j.changesSummary ?? "AI 已修",
    model: j.model,
  };
}

/** 跨设备同步用：meta key 存所有已应用的 patch（qid → 整道修过的题） */
const PATCHES_META_KEY = "questionPatches";

/** 把修过的题 upsert 到 db.questions 并存进 meta::questionPatches（用于跨设备同步） */
export async function applyQuestionFix(fixed: Question): Promise<void> {
  // 1. 直接覆盖 db.questions（admin 这台马上看到）
  await db.questions.put(fixed);

  // 2. 存进 meta::questionPatches，跨设备同步
  const meta = await db.meta.get(PATCHES_META_KEY);
  const map: Record<string, Question> =
    meta && typeof meta.value === "object" && meta.value !== null
      ? (meta.value as Record<string, Question>)
      : {};
  map[fixed.question_id] = fixed;
  await db.meta.put({ key: PATCHES_META_KEY, value: map });
}

/** 从 meta::questionPatches 拉所有已存的 patch，写到 db.questions（boot 时跑） */
export async function applyPendingQuestionPatches(): Promise<number> {
  try {
    const meta = await db.meta.get(PATCHES_META_KEY);
    if (!meta || typeof meta.value !== "object" || meta.value === null) return 0;
    const map = meta.value as Record<string, Question>;
    let applied = 0;
    for (const [qid, fixedQ] of Object.entries(map)) {
      const cur = await db.questions.get(qid);
      // 只有本地版本 != patch 时才覆盖（避免覆盖更新更晚的 SEED）
      // 用 JSON 字符串简易比较
      if (!cur || JSON.stringify(cur) !== JSON.stringify(fixedQ)) {
        await db.questions.put(fixedQ);
        applied += 1;
      }
    }
    return applied;
  } catch (e) {
    console.warn("[applyPendingQuestionPatches] failed:", e);
    return 0;
  }
}

/** 删一条 patch（admin 想撤销修题时用） */
export async function removeQuestionPatch(qid: string): Promise<void> {
  const meta = await db.meta.get(PATCHES_META_KEY);
  if (!meta || typeof meta.value !== "object" || meta.value === null) return;
  const map = meta.value as Record<string, Question>;
  if (!(qid in map)) return;
  delete map[qid];
  await db.meta.put({ key: PATCHES_META_KEY, value: map });
}
