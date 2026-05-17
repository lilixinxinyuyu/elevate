/**
 * v0.35.1 (iter 35 P0-3): MultiStepApplication 政策 + 辅助.
 *
 * 起源: Selena 43% 期中事件 master plan P0-3.
 * 应用题强制 4 步框架: 已知 → 求 → 算式 → 答. 防 Selena 跳到结果蒙数字.
 *
 * 触发:
 *   - q.word_problem_steps 存在 + difficulty ≥ 2
 *   - OR heuristic: hasStory + multistep + difficulty ≥ 3 + numeric answer
 *
 * 互斥:
 *   - EstimationGate (estimation 已经排除 story 题, 自然不冲突)
 *   - ScratchInsurance (multi-step 已经强化思考结构)
 *
 * Feature flag: isMultiStepAppV1() (default ON).
 */
import type { Question } from "./types";
import { isMultiStepAppV1 } from "../lib/featureFlags";
import { classifyStem } from "./speedMatchPolicy";

/* ──────────────────── Trigger ──────────────────── */

/**
 * 已存在 word_problem_steps + 复杂度合格 OR heuristic 触发.
 *
 * Peer review 共识收窄 (Gemini + GPT):
 *   - subquestions 已存在 → 走老 ShopCounter, 不接管
 *   - word_problem_steps 存在 + (difficulty ≥ 3 OR known ≥ 2) → 触发
 *   - heuristic 兜底: hasStory + (hasMultiStep OR opCount ≥ 2) + difficulty ≥ 3
 */
export function requiresMultiStepByHeuristic(q: Question): boolean {
  if (q.answer.type !== "number") return false;
  // 已有 subquestions 走老 ShopCounter — 不重新接管
  if (q.subquestions && q.subquestions.length > 0) return false;
  // 题库已有 word_problem_steps 字段 + 复杂度 gate
  if (q.word_problem_steps) {
    const knownCount = q.word_problem_steps.known?.length ?? 0;
    if (q.difficulty >= 3 || knownCount >= 2) return true;
    return false;
  }
  // heuristic 兜底
  if (q.difficulty < 3) return false;
  const f = classifyStem(q.stem);
  if (!f.hasStory) return false;
  if (!f.hasMultiStep && f.opCount < 2) return false;
  return true;
}

/** Public: 是否走 multi-step. 显式 override 优先. Flag off → false. */
export function requiresMultiStep(q: Question): boolean {
  if (!isMultiStepAppV1()) return false;
  if (typeof q.requiresMultiStep === "boolean") return q.requiresMultiStep;
  return requiresMultiStepByHeuristic(q);
}

/* ──────────────────── 候选提取 ──────────────────── */

/**
 * 提取"已知"候选 — 优先 word_problem_steps.known, 否则从 stem 提.
 * 返回字符串数组 (e.g., ["5 千克", "12 元"]).
 */
export function extractKnownCandidates(q: Question): string[] {
  if (q.word_problem_steps?.known && q.word_problem_steps.known.length > 0) {
    return q.word_problem_steps.known;
  }
  if (q.keyNumbers && q.keyNumbers.length > 0) {
    return q.keyNumbers.map((n) => String(n));
  }
  // 从 stem 提数字 + 紧跟单位 (e.g., "5 千克", "12 元")
  const stem = q.stem;
  const candidates: string[] = [];
  // 简单 regex: 数字 + 可选小数 + 1-3 个中文字符 (常见单位)
  const re = /(\d+(?:\.\d+)?)\s*([一-鿿]{0,3})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stem)) !== null) {
    const num = m[1] ?? "";
    if (!num) continue;
    const unit = m[2] ?? "";
    candidates.push(unit ? `${num} ${unit}` : num);
    if (candidates.length >= 4) break;
  }
  return candidates;
}

/** 提取"求" 候选 — 优先 word_problem_steps.question, 否则从 stem 提. */
export function extractQuestionCandidates(q: Question): string[] {
  const cands: string[] = [];
  if (q.word_problem_steps?.question) {
    cands.push(q.word_problem_steps.question);
  }
  // 从 stem 提"求 X" "X 多少" "几 X" 模式
  const stem = q.stem;
  const m1 = stem.match(/求([^?？]{1,20})[?？]?/);
  if (m1) cands.push(`求${m1[1]}`);
  const m2 = stem.match(/[一总共还剩平均最多最少]+([^?？]{0,15})[?？]/);
  if (m2) cands.push(m2[0].replace(/[?？]$/, ""));
  // 去重
  return [...new Set(cands)].slice(0, 3);
}

/** 提取最终答案的单位 — 优先 word_problem_steps.equation_or_expression 末尾, 否则 stem 末尾 (剥离 ? 问号). */
const UNIT_RE = /(元|角|分|米|千米|厘米|毫米|分米|克|千克|公斤|吨|秒|分钟|小时|天|周|月|年|升|毫升|度|个|只|条|张|本|件|岁|斤|两|块|毛)/g;
export function extractAnswerUnit(q: Question): string {
  const eq = (q.word_problem_steps?.equation_or_expression ?? "").trim();
  // 剥掉 stem 末尾的 ? ？ 标点 + 空白
  const stemEnd = q.stem.replace(/[?？.!。!\s]+$/g, "").slice(-20);
  for (const text of [eq, stemEnd]) {
    const matches = [...text.matchAll(UNIT_RE)];
    if (matches.length > 0) {
      return matches[matches.length - 1]![1]!;
    }
  }
  return "";
}

/* ──────────────────── 算式 parse ──────────────────── */

/**

 * Equation parser — Shunting-yard 安全算式求值器 (v1, peer review 共识).
 *
 * 支持: plus / minus / multiply / divide (×÷ 自动转) / 括号 / 小数 / 多步式 / 等号 (=).
 * 不支持: 函数 (sin/cos), 幂 (^), 变量, eval 注入.
 *
 * 例:
 *   "5 × 12" → 60
 *   "5 × 12 - 8" → 52
 *   "(5 + 3) × 2 = 16" → declaredResult=16, computed=16
 *   "5 / 0" → ok=false (div0)
 */
export interface EvalResult {
  ok: boolean;
  value?: number;
  reason?: string;
  /** 若用户写了 "a = b", b 是 declaredResult */
  declaredResult?: number;
}

type Token =
  | { type: "num"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "lp" }
  | { type: "rp" }
  | { type: "eq" };

function tokenize(text: string): Token[] | { error: string } {
  const t = text.trim().replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
  const tokens: Token[] = [];
  let i = 0;
  while (i < t.length) {
    const c = t[i]!;
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < t.length && /[0-9.]/.test(t[j]!)) j++;
      const num = Number(t.slice(i, j));
      if (!Number.isFinite(num)) return { error: "bad_number" };
      tokens.push({ type: "num", value: num });
      i = j;
    } else if (c === "+" || c === "-" || c === "*" || c === "/") {
      // unary minus: 紧跟 ( 或 op 或 eq 或开头时, 把 "-N" 当 0-N (转成 num)
      const prev = tokens[tokens.length - 1];
      const isUnary = !prev || prev.type === "op" || prev.type === "lp" || prev.type === "eq";
      if (c === "-" && isUnary) {
        // 把 -N 处理为下一个 num 取负, 简单做法: emit (0 - N) 用 0 + op 替代
        tokens.push({ type: "num", value: 0 });
      }
      tokens.push({ type: "op", value: c });
      i++;
    } else if (c === "(") {
      tokens.push({ type: "lp" });
      i++;
    } else if (c === ")") {
      tokens.push({ type: "rp" });
      i++;
    } else if (c === "=") {
      tokens.push({ type: "eq" });
      i++;
    } else {
      return { error: `unknown_char:${c}` };
    }
  }
  return tokens;
}

function evalRpn(tokens: Token[]): { ok: boolean; value?: number; reason?: string } {
  // Shunting-yard → RPN
  const output: Token[] = [];
  const stack: Token[] = [];
  const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };
  for (const tok of tokens) {
    if (tok.type === "num") output.push(tok);
    else if (tok.type === "op") {
      while (stack.length > 0) {
        const top = stack[stack.length - 1]!;
        if (top.type === "op") {
          const topPrec = prec[top.value] ?? 0;
          const tokPrec = prec[tok.value] ?? 0;
          if (topPrec >= tokPrec) {
            output.push(stack.pop()!);
            continue;
          }
        }
        break;
      }
      stack.push(tok);
    } else if (tok.type === "lp") stack.push(tok);
    else if (tok.type === "rp") {
      while (stack.length > 0 && stack[stack.length - 1]!.type !== "lp") {
        output.push(stack.pop()!);
      }
      if (stack.length === 0) return { ok: false, reason: "mismatched_paren" };
      stack.pop(); // drop lp
    }
  }
  while (stack.length > 0) {
    const t = stack.pop()!;
    if (t.type === "lp" || t.type === "rp") return { ok: false, reason: "mismatched_paren" };
    output.push(t);
  }
  // Evaluate RPN
  const eval_stack: number[] = [];
  for (const tok of output) {
    if (tok.type === "num") eval_stack.push(tok.value);
    else if (tok.type === "op") {
      const b = eval_stack.pop();
      const a = eval_stack.pop();
      if (a === undefined || b === undefined) return { ok: false, reason: "stack_underflow" };
      let v: number;
      switch (tok.value) {
        case "+": v = a + b; break;
        case "-": v = a - b; break;
        case "*": v = a * b; break;
        case "/": v = b === 0 ? NaN : a / b; break;
      }
      if (!Number.isFinite(v)) return { ok: false, reason: "div0_or_nan" };
      eval_stack.push(v);
    }
  }
  if (eval_stack.length !== 1) return { ok: false, reason: "incomplete" };
  return { ok: true, value: eval_stack[0]! };
}

/**
 * 解析 + 求值算式. 如果带 "=", 拆 LHS / RHS 分别 evaluate, declaredResult = RHS.
 */
export function evalEquation(text: string): EvalResult {
  if (!text || !text.trim()) return { ok: false, reason: "empty" };
  const tokens = tokenize(text);
  if ("error" in tokens) return { ok: false, reason: tokens.error };
  // split on '='
  const eqIdx = tokens.findIndex((t) => t.type === "eq");
  if (eqIdx === -1) {
    const r = evalRpn(tokens);
    return r.ok ? { ok: true, value: r.value } : { ok: false, reason: r.reason };
  }
  const lhs = tokens.slice(0, eqIdx);
  const rhs = tokens.slice(eqIdx + 1);
  if (lhs.length === 0 || rhs.length === 0) return { ok: false, reason: "empty_side" };
  const lr = evalRpn(lhs);
  const rr = evalRpn(rhs);
  if (!lr.ok) return { ok: false, reason: lr.reason };
  if (!rr.ok) return { ok: false, reason: rr.reason };
  return { ok: true, value: lr.value, declaredResult: rr.value };
}

/**
 * 验证算式 — LHS evaluate + (若有 = RHS) RHS 跟 LHS 匹配 + LHS 跟 expected 匹配 (±5%).
 */
export function validateEquation(text: string, expectedAnswer: number): {
  ok: boolean;
  reason?: string;
  computed?: number;
} {
  const r = evalEquation(text);
  if (!r.ok) return { ok: false, reason: r.reason };
  const lhs = r.value!;
  if (r.declaredResult !== undefined) {
    if (Math.abs(r.declaredResult - lhs) > 0.01) {
      return { ok: false, reason: "result_mismatch", computed: lhs };
    }
  }
  const tol = Math.max(1, Math.abs(expectedAnswer) * 0.05);
  if (Math.abs(lhs - expectedAnswer) > tol) {
    return { ok: false, reason: "wrong_value", computed: lhs };
  }
  return { ok: true, computed: lhs };
}

/* ──────────────────── XP 常量 ──────────────────── */

export const MULTI_STEP_XP = {
  KNOWN: 4,
  QUESTION: 2,
  EQUATION: 6,
  ANSWER: 8,
} as const;
