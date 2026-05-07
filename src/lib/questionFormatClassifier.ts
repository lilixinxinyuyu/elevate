/**
 * 答题格式重分类器（v0.31.33）
 *
 * 背景：早期 AI 出题（aiGenG4BPack / aiGenG4B_U14_Pack）一律打 question_format=
 * "single_choice" + 4 个选项，但其中很多其实是"自然语言填空题"（"...是多少米？"
 * 答案就是一个数字）。这导致 admin 面板"按答题格式"过滤选 fill_blank 时永远 0 道。
 *
 * 这个模块用纯启发式规则（不调 LLM）把题分到正确的 question_format：
 *   - 含"下面/下列…正确"等概念辨析关键词 → single_choice
 *   - 自然语言题 + stem 末尾问"…是多少 X" + 答案能干净地抽成数值 → fill_blank
 *   - stem 含明显的填空标记（___、（  ）、□）→ fill_blank
 *
 * 转换 single_choice → fill_blank 时需要：
 *   - 把 answer.{type:"choice", value:"C"} 转成 {type:"number", value, unit?}
 *     (从被选中那个 option.text 抽数字 + 单位)
 *   - 清掉 options + play_as，让 GameShell 用 plain_numeric 模板
 *
 * 抽不出数字的（option 是中文或表达式）就放过，保持 single_choice。
 */

import type { AnswerSpec, NumericAnswer, Question, QuestionFormat } from "../core/types";

export interface ReclassifyResult {
  /** 推荐的新 question_format。如果与原 format 一致，返回 null。 */
  newFormat: QuestionFormat;
  /** 如果需要替换 answer（choice → numeric），给出新 spec。 */
  newAnswer?: AnswerSpec;
  /** 是否清掉 options（fill_blank 不展示 options）。 */
  dropOptions?: boolean;
  /** 是否清掉 play_as（让 resolveTemplate 重路由到 plain_numeric）。 */
  resetPlayAs?: boolean;
  /** 给 admin 看的中文原因。 */
  reason: string;
}

/** 概念性 MCQ：辨析说法、识图、判断真伪等，应该保持 single_choice */
const CONCEPTUAL_MCQ_RX =
  /(下面|下列).{0,12}(正确|错误|准确|说法|哪|图)|哪[一]?[句项种个](话|是|对|错|表示|说法|图|图形|描述|算式|形式|含义|位置|方法|做法)|请\s*选[出择]|选出正确|是否正确|对不对|判断对错|属于哪[一]?[类种]|是\s*什么(类型|图形|形状)|是\s*哪一?[类种]/;

/** stem 中显式的填空标记 */
const BLANK_MARKER_RX = /_{2,}|（\s+）|\(\s{2,}\)|□|＿/;

/** stem 末尾问数字的模式（要求"是多少 X"风格收尾） */
const NUMERIC_ASK_TAIL_RX =
  /(是\s*多少|为\s*多少|等于\s*多少|是\s*几\s*[?？]?\s*$|多少[米厘元角分秒度个块克千克吨升毫平方]+米?[?？]?\s*$|多少\s*[?？]?\s*$|=\s*[?？]?\s*$|应找回多少|共需多少|共付多少|应付多少|一共.{0,8}多少|这个数(写作|是)多少|这个小数是多少|结果是多少|相当于多少|这个数等于多少|是\s*几\s*\?|可以写成|这个三位小数是多少|这个两位小数是多少)/;

/**
 * 从 option.text 里抽 (numeric value, optional unit)。
 * 例:
 *   "0.158米" -> { value: 0.158, unit: "米" }
 *   "1.58 米" -> { value: 1.58, unit: "米" }
 *   "−2.5"   -> { value: -2.5 }
 *   "1/2"    -> null (分数暂不支持)
 *   "正确"    -> null
 *   "等腰三角形" -> null
 */
export function extractNumericFromText(
  raw: string,
): { value: number; unit?: string } | null {
  if (!raw) return null;
  const text = raw
    .replace(/[（(]\s*/g, "")
    .replace(/\s*[)）]/g, "")
    .replace(/^[\s．。\.]+|[\s．。\.]+$/g, "")
    .trim();
  if (!text) return null;
  // 不抽分数和带 × ÷ + - 的表达式（这种应该保持 choice）
  if (/[\/×÷]/.test(text)) return null;
  if (/[+\-].*[+\-]/.test(text)) return null;
  // 形如 "0.158米" 或 "0.158 平方分米"
  const m = text.match(/^(-?\d+(?:\.\d+)?)\s*([一-龥]{0,6})$/);
  if (!m) return null;
  const numStr = m[1]!;
  const value = parseFloat(numStr);
  if (Number.isNaN(value)) return null;
  const unit = (m[2] ?? "").trim() || undefined;
  return { value, unit };
}

/**
 * 主分类函数：给一道题，返回推荐的格式重分类（或 null = 保持原样）。
 *
 * 决策树（按优先级）：
 *   1. 复杂题型（multi_step / drag_drop / sort_ladder / dot_grid / 有 subquestions）→ 保持
 *   2. 已是 fill_blank → 保持
 *   3. stem 含填空标记 + 不是概念辨析 → fill_blank
 *   4. stem 含概念辨析关键词 → single_choice（如已是则保持）
 *   5. 自然语言"...是多少 X？" + answer 是 choice 但能抽出数字 → fill_blank
 *   6. 否则保持
 */
export function classifyFormat(q: Question): ReclassifyResult | null {
  const fmt = q.question_format;
  const stem = (q.stem ?? "").trim();

  // 1. 复杂题型不动
  if (fmt === "multi_step" || fmt === "drag_drop" || fmt === "sort_ladder" || fmt === "geometry_operation") {
    return null;
  }
  if (q.subquestions && q.subquestions.length > 0) return null;
  if (q.play_as === "dot_grid_draw" || q.dot_grid) return null;
  if (q.answer.type === "multi_step") return null;

  // 2. 已是 fill_blank
  if (fmt === "fill_blank") return null;

  const isConceptualMCQ = CONCEPTUAL_MCQ_RX.test(stem);
  const hasBlankMarker = BLANK_MARKER_RX.test(stem);
  const asksNumeric = NUMERIC_ASK_TAIL_RX.test(stem);

  // 3. 显式填空标记
  if (hasBlankMarker && !isConceptualMCQ) {
    // 如果是 choice 答案，尝试抽数字
    if (q.answer.type === "choice") {
      const opt = q.options?.find((o) => o.id === (q.answer as { value: string }).value);
      const extracted = opt ? extractNumericFromText(opt.text) : null;
      if (!extracted) {
        // 抽不出数字 → 别动（可能 stem 有空格巧合命中正则）
        return null;
      }
      const newAnswer: NumericAnswer = {
        type: "number",
        value: extracted.value,
        ...(extracted.unit ? { unit: extracted.unit } : {}),
      };
      return {
        newFormat: "fill_blank",
        newAnswer,
        dropOptions: true,
        resetPlayAs: true,
        reason: `stem 含填空标记，自动从选项 "${opt!.text}" 抽出数值答案`,
      };
    }
    // numeric / numeric_choice answer → 直接重打格式
    if (q.answer.type === "number") {
      return {
        newFormat: "fill_blank",
        dropOptions: true,
        resetPlayAs: true,
        reason: "stem 含填空标记 + 数值答案",
      };
    }
    return null;
  }

  // 4. 概念辨析 → single_choice
  if (isConceptualMCQ) {
    if (fmt === "single_choice" || fmt === "multi_choice") return null;
    // numeric/fill_blank → single_choice 改起来代价大（要构造选项），暂不动
    return null;
  }

  // 5. 自然语言题 + 问数字 + choice 答案能抽数字 → fill_blank
  if (asksNumeric && fmt === "single_choice" && q.answer.type === "choice") {
    const opt = q.options?.find((o) => o.id === (q.answer as { value: string }).value);
    if (!opt) return null;
    const extracted = extractNumericFromText(opt.text);
    if (!extracted) return null;
    const newAnswer: NumericAnswer = {
      type: "number",
      value: extracted.value,
      ...(extracted.unit ? { unit: extracted.unit } : {}),
    };
    return {
      newFormat: "fill_blank",
      newAnswer,
      dropOptions: true,
      resetPlayAs: true,
      reason: `自然题 + 末尾问数字（"${opt.text}" → ${extracted.value}${extracted.unit ?? ""}）`,
    };
  }

  // 6. numeric 题（speed_match 自动 4 选 1）如果 stem 含数字表达式且自然问数字，可标 fill_blank
  // 但这会改变 UX（变成 input 而不是 4 选 1）—— 对纯算数题保留 numeric 更友好（
  // SpeedMatch 给低龄孩子按选项更快），所以这里不动 numeric → fill_blank。

  return null;
}

/** 按规则给一道题应用重分类，返回新 question 对象（拷贝）。 */
export function applyReclassification(q: Question, r: ReclassifyResult): Question {
  const next: Question = { ...q, question_format: r.newFormat };
  if (r.newAnswer) next.answer = r.newAnswer;
  if (r.dropOptions) next.options = undefined;
  if (r.resetPlayAs) next.play_as = undefined;
  // 给打 tag 方便以后筛
  const tags = new Set(next.tags ?? []);
  tags.add("format_reclassified");
  next.tags = Array.from(tags);
  return next;
}

export interface ScanReport {
  total: number;
  /** 实际会变 format 的题数 */
  changes: number;
  /** 按 (oldFormat → newFormat) 分组的计数 */
  byTransition: Record<string, number>;
  /** 详细 list（仅变的） */
  details: { q: Question; r: ReclassifyResult }[];
}

export function scanForReclassification(questions: Question[]): ScanReport {
  const byTransition: Record<string, number> = {};
  const details: ScanReport["details"] = [];
  for (const q of questions) {
    const r = classifyFormat(q);
    if (!r) continue;
    if (r.newFormat === q.question_format) continue;
    const key = `${q.question_format} → ${r.newFormat}`;
    byTransition[key] = (byTransition[key] ?? 0) + 1;
    details.push({ q, r });
  }
  return {
    total: questions.length,
    changes: details.length,
    byTransition,
    details,
  };
}
