import { QuestionSchema } from "./schema";
import type { Question } from "./types";
import { UNITS } from "../content/units";
import { SKILLS } from "../content/skills";

export interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  ok: boolean;
  question?: Question;
  issues: ValidationIssue[];
}

const FORBIDDEN_REGEX = [
  /1[3-9]\d{9}/,
  /\d{17}[\dXx]/,
  /[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/,
  /充值|抽奖|点击领取|付费|限时特惠|扫码关注/,
  /笨|粗心鬼|你怎么又错|真差|没用/,
  /比例|函数|方程组|平方根|二次方程|立方根|一元二次/,
  /https?:\/\/(?!example\.com)/i,
];

const ALLOWED_UNIT_IDS = new Set(UNITS.map((u) => u.id));
const ALLOWED_SKILL_IDS = new Map(SKILLS.map((s) => [s.id, s]));

export function validateQuestion(raw: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const parsed = QuestionSchema.safeParse(raw);
  if (!parsed.success) {
    for (const err of parsed.error.issues) {
      issues.push({ path: err.path.join("."), message: err.message, severity: "error" });
    }
    return { ok: false, issues };
  }
  const q = parsed.data as Question;

  if (!ALLOWED_UNIT_IDS.has(q.unit_id)) {
    issues.push({ path: "unit_id", message: `未知单元 ${q.unit_id}`, severity: "error" });
  }
  const skill = ALLOWED_SKILL_IDS.get(q.skill_id);
  if (!skill) {
    issues.push({ path: "skill_id", message: `未知技能 ${q.skill_id}`, severity: "error" });
  } else if (skill.unitId !== q.unit_id) {
    issues.push({
      path: "skill_id",
      message: `skill ${q.skill_id} 不属于 unit ${q.unit_id}`,
      severity: "error",
    });
  }

  if (q.exam_priority === "EXTENSION" && q.difficulty !== 5) {
    issues.push({ path: "difficulty", message: "拓展题 difficulty 必须为 5", severity: "error" });
  }

  if (q.cognitive_level === "application" && !q.word_problem_steps && !q.subquestions) {
    issues.push({
      path: "subquestions",
      message: "application 级题目应提供 word_problem_steps 或 subquestions",
      severity: "warning",
    });
  }

  // 选择题必须有 options
  if (q.question_format === "single_choice") {
    if (!q.options || q.options.length < 2) {
      issues.push({ path: "options", message: "选择题必须至少提供 2 个选项", severity: "error" });
    }
    if (q.answer.type !== "choice") {
      issues.push({ path: "answer.type", message: "选择题答案必须为 choice", severity: "error" });
    } else {
      const choiceValue = q.answer.value;
      if (q.options && !q.options.some((o) => o.id === choiceValue)) {
        issues.push({ path: "answer.value", message: "choice 答案不在 options 中", severity: "error" });
      }
    }
  }

  if (q.common_errors.length < 2) {
    issues.push({
      path: "common_errors",
      message: "建议至少 2 个 common_errors",
      severity: "warning",
    });
  }

  const textBlobs = [
    q.stem,
    q.feedback_correct,
    q.feedback_wrong,
    q.parent_tip ?? "",
    ...q.solution_steps,
    ...q.common_errors.map((e) => `${e.error} ${e.remediation}`),
    ...(q.tags ?? []),
    ...(q.hints ?? []).map((h) => h.text),
  ].join("\n");

  for (const pat of FORBIDDEN_REGEX) {
    if (pat.test(textBlobs)) {
      issues.push({
        path: "content",
        message: `内容命中禁词/超纲/负面模式：${pat}`,
        severity: "error",
      });
    }
  }

  if (/错了|失败|扣分/.test(q.feedback_wrong) && !/再|试试|想想|提示|来/.test(q.feedback_wrong)) {
    issues.push({
      path: "feedback_wrong",
      message: "feedback_wrong 需带鼓励/提示，不能只是负面判断",
      severity: "warning",
    });
  }

  // 数值答案自验算
  if (q.answer.type === "number" && q.word_problem_steps?.equation_or_expression) {
    const numAnswer = q.answer;
    const computed = tryEvaluateExpression(q.word_problem_steps.equation_or_expression);
    if (computed != null) {
      const tol = numAnswer.acceptable_error ?? 1e-6;
      if (Math.abs(computed - numAnswer.value) > Math.max(tol, 1e-6)) {
        issues.push({
          path: "answer.value",
          message: `自动验算得 ${computed}，与 answer.value ${numAnswer.value} 不一致`,
          severity: "warning",
        });
      }
    }
  }

  const hasError = issues.some((i) => i.severity === "error");
  return { ok: !hasError, question: hasError ? undefined : q, issues };
}

export function tryEvaluateExpression(expr: string): number | null {
  if (!expr) return null;
  let cleaned = expr
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/\s+/g, "");
  if (cleaned.includes("=")) cleaned = cleaned.split("=")[0]!;
  if (!/^[-+*/().\d]+$/.test(cleaned)) return null;
  try {
    const val = Function(`"use strict"; return (${cleaned});`)();
    return typeof val === "number" && Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}
