/**
 * v0.31.52: 客户端版 question 审计 — scripts/audit-questions.mjs 的 TS port。
 *
 * AI 批量出题工作台用：每生成一道题就跑一次客户端 audit，分类：
 *   - critical: 必拒（缺字段 / answer 指错 / 类型不对）
 *   - likely-broken: 强建议拒（算术错 / 选项重复 / 答案明显错）
 *   - minor: 软标记（feedback 缺 / 长题短时间 / hint 弱）—— 默认接受但展示
 *
 * 重要：这个文件**只跑客户端**，不能 import Node-only API。也是 admin
 * "题库工作台"页面的 audit pass 来源。
 */
import type { Question } from "../core/types";

export type AuditSeverity = "critical" | "likely-broken" | "minor";

export interface AuditIssue {
  severity: AuditSeverity;
  code: string;
  message: string;
  fix?: string;
}

export interface AuditResult {
  /** 这道题是否通过（无 critical / likely-broken） */
  pass: boolean;
  /** 最严重的 severity（用于排序 / 展示）。无问题时 null */
  worstSeverity: AuditSeverity | null;
  issues: AuditIssue[];
}

/**
 * 单道题审计 — 返回所有问题。空数组 = 完美。
 *
 * 审计规则跟 scripts/audit-questions.mjs 同步：
 * C1-C5 critical; L1-L4 likely-broken; M1-M4 minor。
 */
export function auditQuestion(q: Question): AuditResult {
  const issues: AuditIssue[] = [];
  const add = (severity: AuditSeverity, code: string, message: string, fix?: string) => {
    issues.push({ severity, code, message, fix });
  };

  // C1: 必填字段
  if (!q.question_id) add("critical", "C1", "缺 question_id");
  if (!q.skill_id) add("critical", "C1", "缺 skill_id");
  if (!q.stem || typeof q.stem !== "string" || !q.stem.trim()) {
    add("critical", "C1", "缺 stem 或 stem 空白");
  }
  if (typeof q.difficulty !== "number" || q.difficulty < 1 || q.difficulty > 5) {
    add("critical", "C1", `difficulty=${q.difficulty} 不在 1-5`);
  }
  if (!q.term) add("critical", "C1", "缺 term（应是 \"上册\" 或 \"下册\"）");

  // C2-C3: 选项 vs answer 一致性
  const opts = (q as { options?: { id?: string; text?: string }[] }).options;
  const ans = (q as { answer?: { type?: string; value?: unknown } }).answer;
  const needsOptions =
    q.game_type === "plain_choice" ||
    q.game_type === "true_false_swipe" ||
    q.question_format === "single_choice" ||
    q.question_format === "multi_choice";

  if (needsOptions) {
    if (!Array.isArray(opts) || opts.length < 2) {
      add("critical", "C2", `options 少于 2 (${opts?.length ?? 0}) 但题型需要 options`);
    } else {
      // 选项 ID 应该唯一
      const ids = opts.map((o) => o?.id).filter((x): x is string => typeof x === "string");
      if (new Set(ids).size !== ids.length) {
        add("critical", "C2", "options 有重复 id");
      }
      // answer.value 必须在 options.id 里
      if (ans?.type === "choice") {
        if (typeof ans.value !== "string" || !ids.includes(ans.value)) {
          add("critical", "C3", `answer.value="${String(ans.value)}" 不在 options 里`);
        }
      }
      // 选项 text 不应有重复
      const texts = opts
        .map((o) => (o?.text ?? "").trim())
        .filter((t) => t.length > 0);
      if (new Set(texts).size !== texts.length && texts.length >= 2) {
        add("likely-broken", "L3", "options 有重复 text");
      }
    }
    if (!ans) add("critical", "C2", "缺 answer");
  }

  // L2: 简单算术校验（仅 plain_choice + 数字类型 stem）
  if (
    needsOptions &&
    ans?.type === "choice" &&
    typeof ans.value === "string" &&
    Array.isArray(opts) &&
    typeof q.stem === "string"
  ) {
    const stem = q.stem;
    // 提取 stem 里的数字
    const nums = (stem.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => !Number.isNaN(n));
    if (nums.length === 2) {
      const [a, b] = nums;
      const correctOpt = opts.find((o) => o?.id === ans.value);
      const correctRaw = (correctOpt?.text ?? "").match(/-?\d+(?:\.\d+)?/);
      const correctNum = correctRaw ? Number(correctRaw[0]) : NaN;
      if (!Number.isNaN(correctNum) && a !== undefined && b !== undefined) {
        // 尝试 + - * / —— 看是否有一个匹配
        const tries = [
          { op: "+", val: a + b },
          { op: "-", val: a - b },
          { op: "-", val: b - a },
          { op: "*", val: a * b },
          { op: "/", val: b !== 0 ? a / b : NaN },
        ];
        const matched = tries.some((t) => Math.abs(t.val - correctNum) < 0.001);
        if (!matched && stem.match(/[+\-×÷*\/]/)) {
          add(
            "likely-broken",
            "L2",
            `数字 [${nums.join(",")}] 简单组合算不出 ${correctNum}`,
            "需要人工 / LLM 复核",
          );
        }
      }
    }
  }

  // M1: feedback
  const m1q = q as { feedback_correct?: string; feedback_wrong?: string };
  if (!m1q.feedback_correct || !m1q.feedback_wrong) {
    add("minor", "M1", "feedback_correct / feedback_wrong 有缺失");
  }

  // M3 + M4: estimated_time_seconds 范围 + 长 stem 时间相关性（v0.31.51 已加）
  const ets = q.estimated_time_seconds;
  if (typeof ets === "number") {
    if (ets < 10 || ets > 240) {
      add("minor", "M3", `estimated_time_seconds=${ets} 偏离合理区间`);
    }
    const stemLen = (q.stem ?? "").length;
    const longestOpt = Array.isArray(opts)
      ? Math.max(0, ...opts.map((o) => (o?.text ?? "").length))
      : 0;
    if (stemLen >= 60 && ets < 30) {
      add(
        "minor",
        "M4",
        `stem 长 ${stemLen} 字但 estimated_time=${ets}s 太短`,
        "建议 ≥ 45s",
      );
    }
    if (stemLen >= 120 && ets < 50) {
      add(
        "minor",
        "M4",
        `stem 超长 ${stemLen} 字但 estimated_time=${ets}s 严重不足`,
        "建议 ≥ 65s",
      );
    }
    if (longestOpt >= 20 && ets < 30) {
      add(
        "minor",
        "M4",
        `option 多行（最长 ${longestOpt} 字）但 estimated_time=${ets}s 太短`,
        "建议 ≥ 45s",
      );
    }
  }

  // 综合判定
  const hasCritical = issues.some((i) => i.severity === "critical");
  const hasLikelyBroken = issues.some((i) => i.severity === "likely-broken");
  const worstSeverity: AuditSeverity | null = hasCritical
    ? "critical"
    : hasLikelyBroken
      ? "likely-broken"
      : issues.length > 0
        ? "minor"
        : null;

  return {
    pass: !hasCritical && !hasLikelyBroken,
    worstSeverity,
    issues,
  };
}

/**
 * 对一批题跑 audit，返回汇总。
 */
export interface BatchAuditResult {
  total: number;
  passed: number;
  rejected: number;
  byQuestionId: Map<string, AuditResult>;
}

export function auditBatch(questions: Question[]): BatchAuditResult {
  const byQuestionId = new Map<string, AuditResult>();
  let passed = 0;
  let rejected = 0;
  for (const q of questions) {
    const r = auditQuestion(q);
    byQuestionId.set(q.question_id, r);
    if (r.pass) passed++;
    else rejected++;
  }
  return { total: questions.length, passed, rejected, byQuestionId };
}
