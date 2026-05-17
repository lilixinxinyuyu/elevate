/**
 * Heuristic AI 出题质量 judge (v0.34.86 iter 20).
 *
 * 爸爸 backlog: AI question 入库前 quality judge — 跑 /api/agent/judge-questions
 * 过一遍 iter 10 合成的题, 拒低质 (避免学生 train 看到烂题).
 *
 * Why heuristic 而不是 LLM:
 * synthesize 已经 11s LLM call 接近 ESA 11s 限. 再叠 LLM judge call = 22s 死.
 * 用纯启发式 (无网络/无 LLM) 0ms 把明显烂题拦掉, 让真 LLM judge 留给 admin
 * batch UI 后台跑 (qualityJudge.ts 已有 client side flow).
 *
 * 拒题规则 (severity 4-5, 100% reject):
 *   - 没 stem 或 stem.length < 5 / > 300
 *   - 没 answer 或 answer.value 是 null/undefined
 *   - numeric answer.value 不是数字
 *   - choice answer.value 不在 options.id 列表 (mismatched answer)
 *   - single_choice 没 options 或 < 2 个
 *   - stem 含明显的 "(无关)" / "(待定)" / "FILL_BLANK" 占位符
 *
 * 标记 borderline (severity 2-3, 警告但保留):
 *   - 没 solution_steps
 *   - 没 hints
 *   - common_errors 空
 *   - stem 含 "todo" / "tbd"
 *
 * 输出 keep 的 question (含 _judge meta), 调用方根据 _judge.verdict 决定写不写 OSS.
 */

export type JudgeVerdict = "keep" | "borderline" | "reject";

export interface JudgeOutcome {
  verdict: JudgeVerdict;
  severity: 1 | 2 | 3 | 4 | 5;
  reasons: string[];
}

const STEM_PLACEHOLDER_RX = /\([\s]*(无关|待定|TBD|TODO|FILL[_ ]?BLANK)[\s]*\)/i;
const SOFT_TODO_RX = /\b(todo|tbd)\b/i;

export function judgeAiQuestionHeuristic(q: Record<string, unknown>): JudgeOutcome {
  const reasons: string[] = [];
  const stem = typeof q.stem === "string" ? q.stem : "";
  const answer = (q.answer ?? null) as { type?: string; value?: unknown } | null;
  const options = Array.isArray(q.options) ? (q.options as Array<{ id?: string; text?: string }>) : [];
  const qFmt = q.question_format;

  // Reject 5 = 致命
  if (!stem) {
    reasons.push("missing_stem");
    return { verdict: "reject", severity: 5, reasons };
  }
  if (stem.length < 5) {
    reasons.push(`stem_too_short_${stem.length}`);
    return { verdict: "reject", severity: 5, reasons };
  }
  if (stem.length > 300) {
    reasons.push(`stem_too_long_${stem.length}`);
    return { verdict: "reject", severity: 4, reasons };
  }
  if (STEM_PLACEHOLDER_RX.test(stem)) {
    reasons.push("stem_has_placeholder");
    return { verdict: "reject", severity: 5, reasons };
  }
  if (!answer || typeof answer !== "object") {
    reasons.push("missing_answer");
    return { verdict: "reject", severity: 5, reasons };
  }
  if (answer.value === null || answer.value === undefined) {
    reasons.push("answer_value_null");
    return { verdict: "reject", severity: 5, reasons };
  }

  // Type-specific checks
  if (answer.type === "number") {
    const v = typeof answer.value === "number" ? answer.value
      : typeof answer.value === "string" ? Number(answer.value)
      : NaN;
    if (!Number.isFinite(v)) {
      reasons.push(`numeric_answer_not_finite:${String(answer.value).slice(0, 20)}`);
      return { verdict: "reject", severity: 5, reasons };
    }
  }
  if (answer.type === "choice") {
    if (options.length < 2) {
      reasons.push(`choice_too_few_options:${options.length}`);
      return { verdict: "reject", severity: 4, reasons };
    }
    const optIds = new Set(options.map((o) => o.id));
    if (typeof answer.value === "string" && !optIds.has(answer.value)) {
      reasons.push(`answer_id_not_in_options:${answer.value}`);
      return { verdict: "reject", severity: 5, reasons };
    }
  }
  // single_choice format 必须有 options
  if (qFmt === "single_choice" && options.length < 2) {
    reasons.push("single_choice_needs_options");
    return { verdict: "reject", severity: 4, reasons };
  }

  // Borderline checks (保留但 flag)
  const solutionSteps = Array.isArray(q.solution_steps) ? q.solution_steps : [];
  const hints = Array.isArray(q.hints) ? q.hints : [];
  const commonErrors = Array.isArray(q.common_errors) ? q.common_errors : [];
  let borderlineSeverity: 1 | 2 | 3 = 1;

  if (solutionSteps.length === 0) {
    reasons.push("no_solution_steps");
    borderlineSeverity = 2;
  }
  if (hints.length === 0) {
    reasons.push("no_hints");
  }
  if (commonErrors.length === 0) {
    reasons.push("no_common_errors");
  }
  if (SOFT_TODO_RX.test(stem)) {
    reasons.push("soft_todo_in_stem");
    borderlineSeverity = 3;
  }

  if (reasons.length > 0) {
    return { verdict: "borderline", severity: borderlineSeverity, reasons };
  }
  return { verdict: "keep", severity: 1, reasons: [] };
}

/**
 * Batch — 跑一批题, 返回 kept 列表 + 拒题报告.
 */
export interface BatchJudgeResult {
  kept: Record<string, unknown>[];
  rejected: { question_id: string; outcome: JudgeOutcome }[];
  borderline: { question_id: string; outcome: JudgeOutcome }[];
}

export function judgeAiQuestionBatch(qs: Record<string, unknown>[]): BatchJudgeResult {
  const kept: Record<string, unknown>[] = [];
  const rejected: BatchJudgeResult["rejected"] = [];
  const borderline: BatchJudgeResult["borderline"] = [];
  for (const q of qs) {
    const outcome = judgeAiQuestionHeuristic(q);
    const qid = typeof q.question_id === "string" ? q.question_id : "?";
    if (outcome.verdict === "reject") {
      rejected.push({ question_id: qid, outcome });
    } else if (outcome.verdict === "borderline") {
      borderline.push({ question_id: qid, outcome });
      kept.push({ ...q, _judge: outcome });
    } else {
      kept.push({ ...q, _judge: outcome });
    }
  }
  return { kept, rejected, borderline };
}
