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

/** 带声调的拼音字符（含 ü/ǖ 系列）— 用来判定 stem 是否"主要由拼音组成"（看拼音写字）。 */
const PINYIN_TONE_RE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹ]/;

/** 汉字范围（基本汉字平面，含繁简）。 */
const HANZI_RE = /[一-鿿]/g;

/** 判断 skill_id 是不是"看拼音写字 / 听写"类。匹配 *_PINYIN / *_DICTATION 后缀。 */
function isPinyinWriteSkill(skillId: string | undefined): boolean {
  if (!skillId) return false;
  return /_(?:PINYIN|DICTATION)$/i.test(skillId);
}

/**
 * 看拼音写字答案泄露检测。
 *
 * 触发条件（必须同时满足）：
 *   1. subjectId="chinese"（避免误伤数学题）
 *   2. skill_id 命中拼音 / 听写类（_PINYIN / _DICTATION 后缀）
 *   3. stem 里有拼音声调字符（说明这就是"读拼音写字"题面，而不是"宿字读音是？"那种 stem 已经写出目标字的题）
 *   4. answer.value 对应的选项 text 里包含汉字（即 target chars）
 *   5. 这些 target 汉字 **没出现在 stem**（避免把 stem 已含汉字的辨字题也误判）
 *   6. target 汉字 **出现在** hints / solution_steps / common_errors / feedback 里
 *
 * 返回命中的字 + 命中字段；没问题时返回 null。
 */
export function detectPinyinAnswerLeak(
  q: Question,
): { chars: string[]; fields: string[] } | null {
  if (q.subjectId !== "chinese") return null;
  if (!isPinyinWriteSkill(q.skill_id)) return null;

  const stem = q.stem ?? "";
  if (!PINYIN_TONE_RE.test(stem)) return null;

  // 取 answer.value 对应的选项 text；非 choice 题（fill_blank 文字答案）退而用 audio_text。
  const ans = (q as { answer?: { type?: string; value?: unknown } }).answer;
  const opts = (q as { options?: { id?: string; text?: string }[] }).options;
  let answerText = "";
  if (ans?.type === "choice" && Array.isArray(opts) && typeof ans.value === "string") {
    answerText = opts.find((o) => o?.id === ans.value)?.text ?? "";
  }
  if (!answerText) {
    answerText = (q as { audio_text?: string }).audio_text ?? "";
  }
  if (!answerText) return null;

  const targetChars = Array.from(new Set(answerText.match(HANZI_RE) ?? []));
  if (targetChars.length === 0) return null;

  // stem 已含的字不算泄露（辨字题）
  const stemChars = new Set(stem.match(HANZI_RE) ?? []);
  const checkChars = targetChars.filter((c) => !stemChars.has(c));
  if (checkChars.length === 0) return null;

  const buckets: { name: string; text: string }[] = [];
  for (const h of q.hints ?? []) {
    if (h?.text) buckets.push({ name: "hints", text: h.text });
  }
  for (const s of q.solution_steps ?? []) {
    if (s) buckets.push({ name: "solution_steps", text: s });
  }
  for (const e of q.common_errors ?? []) {
    if (e?.error) buckets.push({ name: "common_errors", text: e.error });
    if (e?.remediation) buckets.push({ name: "common_errors", text: e.remediation });
  }
  if (q.feedback_correct) buckets.push({ name: "feedback_correct", text: q.feedback_correct });
  if (q.feedback_wrong) buckets.push({ name: "feedback_wrong", text: q.feedback_wrong });

  const leakedChars = new Set<string>();
  const leakedFields = new Set<string>();
  for (const ch of checkChars) {
    for (const b of buckets) {
      if (b.text.includes(ch)) {
        leakedChars.add(ch);
        leakedFields.add(b.name);
      }
    }
  }
  if (leakedChars.size === 0) return null;
  return { chars: [...leakedChars], fields: [...leakedFields] };
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

  // L5: 看拼音写字答案泄露 — 拼音写字题的目标字不能在 hint / 解析 / common_errors / feedback 里直接出现
  const leak = detectPinyinAnswerLeak(q);
  if (leak) {
    add(
      "likely-broken",
      "L5",
      `看拼音写字答案泄露：「${leak.chars.join("")}」出现在 ${leak.fields.join(" / ")}（题面只给拼音，等于直接告诉答案）`,
      "把提示 / 解析 / common_errors / feedback 里的目标字换成部首描述、笔画位置等线索",
    );
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
