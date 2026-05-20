/**
 * v0.34.64 (Q3 fix #1 generator side): 出题 LLM 经常乱拼字段 —
 * 数字答案配 single_choice、单步题塞 subquestions:[one_step]，
 * 灌进客户端就会被 ShopCounter 拆包或 PlainChoice 误判。
 *
 * 这里做后置 normalize：在 server 已经验过 stem 之后、写回 client 之前，
 * 把字段拍齐。配合客户端 resolve.ts 守卫双层防护。
 *
 * 守的几条规则（按错误频率排序）：
 *
 *   R1. answer.type==="number" + question_format==="single_choice"
 *       → 如果 options 全是数字 text：保留 options，改 format → "numeric_choice"
 *         (client SpeedMatchPanel buildOptions 走 numeric 分支，options 当 4 选 1)
 *       → 否则丢 options + 改 format → "numeric"（plain_numeric input）
 *
 *   R2. subquestions 数组只有 0 或 1 个元素
 *       → 丢掉。subquestions 触发 ShopCounter（multi-step UX），单元素
 *         没必要走 ShopCounter；ShopCounter 会把单步答案 wrap [val] 入库
 *         (即使 source 已修，老逻辑也不要再被触发)
 *
 *   R3. answer.type==="choice" 但 options 不存在/value 不在 options 里
 *       → 标 _normalize_warning 让上游 admin 看到，但保留以免静默丢题
 *
 *   R4. answer.type==="number" 但 value 是字符串
 *       → 尝试 Number(value), 不行就标 warning
 *
 * 这是 server-side 防御 (aliyun-deploy/src/routes/generate.ts 调).
 * 客户端 src/lib/questionFormatClassifier.ts 是另一层 (跑 admin 工具时)。
 */

export interface NormalizeReport {
  changed: boolean;
  warnings: string[];
  rules: string[]; // R1, R2, R3, R4
}

export function normalizeAiQuestion(
  raw: Record<string, unknown>,
): { q: Record<string, unknown>; report: NormalizeReport } {
  const q: Record<string, unknown> = { ...raw };
  const report: NormalizeReport = { changed: false, warnings: [], rules: [] };

  const answer = (q.answer ?? {}) as Record<string, unknown>;
  const qf = q.question_format as string | undefined;
  const options = Array.isArray(q.options) ? (q.options as Array<Record<string, unknown>>) : null;

  // R1: numeric answer + single_choice format
  if (answer.type === "number" && qf === "single_choice") {
    if (options && options.length >= 2 && options.every((o) => isNumericText(o.text))) {
      q.question_format = "numeric_choice";
      report.rules.push("R1.numeric_choice");
    } else {
      delete q.options;
      q.question_format = "numeric";
      report.rules.push("R1.numeric");
    }
    report.changed = true;
  }

  // R2: subquestions <= 1
  const sub = q.subquestions;
  if (Array.isArray(sub) && sub.length <= 1) {
    delete q.subquestions;
    report.rules.push("R2");
    report.changed = true;
  }

  // R3: choice but missing/inconsistent options
  if (answer.type === "choice") {
    const value = answer.value;
    const optList = Array.isArray(q.options)
      ? (q.options as Array<Record<string, unknown>>)
      : [];
    if (optList.length === 0) {
      report.warnings.push("R3: choice answer 但没有 options");
    } else if (typeof value === "string" && !optList.some((o) => o.id === value)) {
      report.warnings.push(`R3: choice answer.value="${value}" 不在 options 里`);
    }
  }

  // R4: numeric answer but value is string
  if (answer.type === "number" && typeof answer.value === "string") {
    const n = Number((answer.value as string).trim());
    if (Number.isFinite(n)) {
      q.answer = { ...answer, value: n };
      report.rules.push("R4");
      report.changed = true;
    } else {
      report.warnings.push(`R4: number answer.value="${answer.value}" 不能转数字`);
    }
  }

  // R5: number answer with multi_step format → 不动 spec，但 R2 已经清了 subquestions
  // multi_step format 不出现在 numeric answer 时是 R1 范畴

  // R6 (v0.36.26 爸爸: 数学出题 version Required / grade Invalid): backfill 必填
  // metadata. AI 经常漏 version / 给 grade 字符串 / status 缺. schema 这 3 个必填,
  // 漏了客户端 validateQuestion 直接拒. server 写回前兜底.
  if (typeof q.version !== "number" || !Number.isInteger(q.version) || (q.version as number) <= 0) {
    q.version = 1;
    report.changed = true;
    report.rules.push("R6.version");
  }
  const VALID_STATUS = ["draft", "validated", "approved", "active", "retired", "needs_review", "rejected"];
  if (typeof q.status !== "string" || !VALID_STATUS.includes(q.status as string)) {
    q.status = "approved";
    report.changed = true;
    report.rules.push("R6.status");
  }
  // grade: number 1-6. AI 可能给 "4"(string) / 漏
  if (typeof q.grade === "string") {
    const n = Number(q.grade);
    if (n >= 1 && n <= 6) q.grade = n;
  }
  if (typeof q.grade !== "number" || ![1, 2, 3, 4, 5, 6].includes(q.grade as number)) {
    q.grade = 4;
    report.changed = true;
    report.rules.push("R6.grade");
  }
  // difficulty: number 1-5. coerce string
  if (typeof q.difficulty === "string") {
    const n = Number(q.difficulty);
    if (n >= 1 && n <= 5) q.difficulty = n;
  }

  if (report.changed) {
    const existingTags = Array.isArray(q.tags) ? (q.tags as string[]) : [];
    const tagSet = new Set([...existingTags, "normalized_ai", ...report.rules.map((r) => `norm:${r}`)]);
    q.tags = Array.from(tagSet);
  }

  return { q, report };
}

/** 检查 option.text 是否可解析为数字（剥单位 / 中文）。 */
function isNumericText(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (Number.isFinite(Number(trimmed))) return true;
  // 剥单位再试 ("22.8 元" "150 厘米")
  const stripped = trimmed.replace(/[^\d.\-+]/g, "");
  if (!stripped || stripped === "-" || stripped === "+" || stripped === ".") return false;
  return Number.isFinite(Number(stripped));
}
