/**
 * v0.35.49 Refactor Priority 16 (GameShell 拆分 step 3): 抽 answer describe 纯函数.
 *
 * 描述函数: question + answer → 给 UI / AI tutor 看的 string. 无 state, 无 hook,
 * 但藏在 GameShell 中. 提到独立文件让 GameShell 只剩"组装", 不再做格式化.
 */
import type { Question } from "../../core/types";

/**
 * 把 question.answer (canonical 答案) 描述成 user 看的 string.
 *
 * 注意 choice 题: 只返 option text — 不带 id 前缀.
 * 因为 PlainChoice 视觉 shuffle 后用户看到的 "A" 跟 spec.value="C" 不一致,
 * 带 id 前缀会让"正确答案 C. 1.26" 跟视觉 "A. 1.26" 高亮矛盾. v0.31.85.
 */
export function describeAnswer(q: Question): string {
  const a = q.answer;
  if (a.type === "number") return `${a.value}`;
  if (a.type === "choice") {
    const opt = (q.options ?? []).find((o) => o.id === a.value);
    return opt ? opt.text : a.value;
  }
  return a.steps.map((s) => `${s.step_id}=${s.expected}`).join("；");
}

/**
 * 把 user 提交的 answer (unknown) 翻译成给 AI tutor 看的人话.
 */
export function describeUserAnswer(q: Question, answer: unknown): string {
  if (answer === null || answer === undefined) return "（未作答）";
  if (typeof answer === "number") return `${answer}`;
  if (typeof answer === "string") {
    // choice 题: answer 是 option id ("A"/"B"...), 转成 option text
    const opt = (q.options ?? []).find((o) => o.id === answer);
    if (opt) return opt.text;
    return answer;
  }
  if (typeof answer === "object") {
    // multi_step 等结构化答案
    try {
      return JSON.stringify(answer).slice(0, 80);
    } catch {
      return "（结构化答案）";
    }
  }
  return String(answer);
}
