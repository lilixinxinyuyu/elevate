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

/**
 * 提取"求" 候选 — 优先 word_problem_steps.question, 否则从 stem 提.
 *
 * v0.35.17 iter 47 P0-3.1 (retrospective backlog): heuristic 大改.
 * 老 v1 只 2 个 regex (求 X / 一总共还剩...), 实测 G4B 真题命中 ~40%.
 * 新版策略:
 *   1. 优先 word_problem_steps.question (admin/AI 已 tagged)
 *   2. 用问号切句子, 取最后一句含问号的 sentence 作为基础
 *   3. 再用 15+ 个常见小学应用题问法模式 (求/算/还剩/一共/平均/快/慢/多/少/
 *      够/便宜/贵/速度/路程/时间/面积/周长 等) 提取核心短语
 *   4. 句子 ≤ 25 字 → 直接整句作候选 (短问题不必分析)
 *
 * 目标: G4B 真题命中率 40% → 80%+. 减少 Phase 2 "求什么" 选项缺失
 * 让 Selena 手敲的情况.
 */
export function extractQuestionCandidates(q: Question): string[] {
  const cands: string[] = [];
  if (q.word_problem_steps?.question) {
    cands.push(q.word_problem_steps.question);
  }
  const stem = q.stem.trim();

  // Strategy 1: 句子切分, 取含问号的句子
  // 用 ? ？ . 。 ! ！ 切分, 然后筛"含问意"句
  const sentences = stem
    .split(/(?<=[?？.。!！])/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const questionSent = sentences.find((s) => /[?？]/.test(s));
  if (questionSent) {
    // 短问题 (≤ 25 字 中文) 直接作候选
    const trimmed = questionSent.replace(/[?？]$/, "").trim();
    if (trimmed.length > 0 && trimmed.length <= 25) {
      cands.push(trimmed);
    }
  }

  // Strategy 2: 多模式 regex (从 questionSent 优先, 否则全 stem)
  const searchText = questionSent ?? stem;
  // 4 年级常见问法模式 (覆盖 G4B 真题: 加减乘除应用 / 平均数 / 速度 / 面积周长 / 单位换算 / 货币)
  const PATTERNS: RegExp[] = [
    /求[^?？]{1,20}[?？]?/g,                      // "求一共多少元?"
    /[一总共][^?？]{0,15}[?？]/g,                  // "一共多少米?"
    /[还剩][^?？]{0,15}[?？]/g,                    // "还剩多少?"
    /[平均][^?？]{0,15}[?？]/g,                    // "平均每个多少?"
    /[最多最少至少][^?？]{0,15}[?？]/g,            // "最多 / 至少 多少?"
    /比[^?？]{0,10}[多少][^?？]{0,10}[?？]/g,      // "比 A 多 / 少 多少?"
    /[多少][^?？]{0,15}[?？]/g,                    // "多 / 少多少?"
    /[贵便宜][^?？]{0,15}[?？]/g,                  // "贵 / 便宜 多少?"
    /[节约省下][^?？]{0,15}[?？]/g,                // "节约多少?"
    /[够够不][^?？]{0,15}[?？]/g,                  // "够吗 / 够不够?"
    /[速度路程时间][^?？]{0,15}[?？]/g,            // "速度 / 路程 / 时间 是多少?"
    /[面积周长长宽高][^?？]{0,15}[?？]/g,          // "面积 / 周长 / 长宽高 是多少?"
    /[花用付费][^?？]{0,15}[?？]/g,                // "花了多少钱?"
    /[正好恰好][^?？]{0,15}[?？]/g,                // "正好用了多少?"
    /[几][条只个张本件辆双层只片块米斤元角分][^?？]{0,10}[?？]/g, // "几个/几条/几米/几元"
  ];
  for (const re of PATTERNS) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(searchText)) !== null) {
      const hit = m[0].replace(/[?？]$/, "").trim();
      if (hit.length >= 2 && hit.length <= 25) {
        cands.push(hit);
      }
      // 防 infinite loop
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }

  // 去重 + 取前 4 (Phase 2 显示 3-4 个选项, 多了 selena 选不过来)
  return [...new Set(cands)].slice(0, 4);
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
