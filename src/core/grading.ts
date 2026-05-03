import type { AnswerSpec, Question } from "./types";
import { tryEvaluateExpression } from "./validateQuestion";

export interface GradeResult {
  isCorrect: boolean;
  partialCorrect: boolean;
  allStepsCorrect?: boolean;
  stepResults?: { step_id: string; ok: boolean }[];
  matchedErrorTags: string[];
}

export function gradeAttempt(question: Question, userAnswer: unknown): GradeResult {
  const spec = question.answer;
  switch (spec.type) {
    case "number":
      return gradeNumeric(question, spec, userAnswer);
    case "choice":
      return gradeChoice(question, spec, userAnswer);
    case "multi_step":
      return gradeMultiStep(question, spec, userAnswer);
  }
}

function gradeNumeric(
  _q: Question,
  spec: Extract<AnswerSpec, { type: "number" }>,
  raw: unknown,
): GradeResult {
  const num = coerceNumber(raw);
  if (num == null) {
    return { isCorrect: false, partialCorrect: false, matchedErrorTags: ["careless_reading"] };
  }
  const tol = spec.acceptable_error ?? 0;
  const ok = Math.abs(num - spec.value) <= Math.max(tol, 1e-6);
  return {
    isCorrect: ok,
    partialCorrect: false,
    matchedErrorTags: ok ? [] : guessNumericErrorTag(spec.value, num),
  };
}

function gradeChoice(
  q: Question,
  spec: Extract<AnswerSpec, { type: "choice" }>,
  raw: unknown,
): GradeResult {
  const val = typeof raw === "string" ? raw : "";
  const ok = val === spec.value;
  const matchedErrorTags: string[] = [];
  if (!ok) {
    const picked = (q.options ?? []).find((o) => o.id === val);
    if (picked?.errorTag) matchedErrorTags.push(picked.errorTag);
  }
  return { isCorrect: ok, partialCorrect: false, matchedErrorTags };
}

function gradeMultiStep(
  _q: Question,
  spec: Extract<AnswerSpec, { type: "multi_step" }>,
  raw: unknown,
): GradeResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const stepResults = spec.steps.map((step) => {
    const given = obj[step.step_id];
    const ok = compareStep(step.expected, given);
    return { step_id: step.step_id, ok };
  });
  const allOk = stepResults.every((s) => s.ok);
  const lastStepId = spec.steps[spec.steps.length - 1]!.step_id;
  const answerStep = stepResults.find((s) => s.step_id === lastStepId || s.step_id === "answer");
  const finalOk = answerStep?.ok ?? allOk;
  const partialCorrect = !finalOk && stepResults.some((s) => s.ok);
  const matchedErrorTags: string[] = [];
  if (!allOk) {
    const relationStep = stepResults.find((s) => s.step_id === "relationship");
    const exprStep = stepResults.find((s) => s.step_id === "expression" || s.step_id === "equation");
    if (relationStep && !relationStep.ok) matchedErrorTags.push("relation_model_error");
    if (exprStep && !exprStep.ok) matchedErrorTags.push("equation_setup_error");
  }
  return {
    isCorrect: finalOk,
    partialCorrect,
    allStepsCorrect: allOk,
    stepResults,
    matchedErrorTags,
  };
}

function compareStep(expected: string | number, given: unknown): boolean {
  if (typeof expected === "number") {
    const n = coerceNumber(given);
    return n != null && Math.abs(n - expected) <= 1e-6;
  }
  const expNormalized = normalizeText(expected);
  if (typeof given === "number") {
    return normalizeText(String(given)) === expNormalized;
  }
  if (typeof given === "string") {
    const gNorm = normalizeText(given);
    if (gNorm === expNormalized) return true;
    const eVal = tryEvaluateExpression(expected);
    const gVal = tryEvaluateExpression(given);
    if (eVal != null && gVal != null) return Math.abs(eVal - gVal) <= 1e-6;
    return false;
  }
  return false;
}

function normalizeText(s: string): string {
  return s
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .toLowerCase();
}

/**
 * 数字解析：宽松策略
 * - 剥离所有非数字非小数点非正负号的字符（含所有中文单位、元、米、角等）
 * - 支持中文分数/混合：暂不支持（不在四年级下册范围）
 * - 支持表达式求值（如 "22.8" / "3.8*6"）
 */
export function coerceNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 直接 Number
  const direct = Number(trimmed);
  if (Number.isFinite(direct)) return direct;

  const money = coerceChineseMoney(trimmed);
  if (money != null) return money;

  // 作为表达式求值
  const evaled = tryEvaluateExpression(trimmed);
  if (evaled != null) return evaled;

  // 剥离单位后再试
  const stripped = trimmed.replace(/[^\d.\-+]/g, "");
  if (stripped && stripped !== "-" && stripped !== "+" && stripped !== ".") {
    const n = Number(stripped);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

function coerceChineseMoney(text: string): number | null {
  const yuanJiao = text.match(/(-?\d+(?:\.\d+)?)\s*元\s*(\d+(?:\.\d+)?)\s*角/);
  if (yuanJiao) return Number(yuanJiao[1]) + Number(yuanJiao[2]) / 10;
  const yuanFen = text.match(/(-?\d+(?:\.\d+)?)\s*元\s*(\d+(?:\.\d+)?)\s*分/);
  if (yuanFen) return Number(yuanFen[1]) + Number(yuanFen[2]) / 100;
  const jiao = text.match(/^(-?\d+(?:\.\d+)?)\s*角$/);
  if (jiao) return Number(jiao[1]) / 10;
  return null;
}

function guessNumericErrorTag(expected: number, given: number): string[] {
  if (expected !== 0) {
    const r = given / expected;
    if (Math.abs(r - 10) < 0.01 || Math.abs(r - 0.1) < 0.001 || Math.abs(r - 100) < 0.01 || Math.abs(r - 0.01) < 0.001) {
      return ["decimal_point_error"];
    }
  }
  return ["careless_reading"];
}
