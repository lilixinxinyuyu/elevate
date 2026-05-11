/**
 * 服务端 sanitize at the door (v0.31.86 抽出)
 *
 * 任何写入 ai_questions D1 表的 row 在落盘前都经过 sanitizeRow:
 *   1. 删除 stem / subquestions[].prompt / clue_pick.clues / 选项 text 里的元注解
 *      （"（无关）/（解题设定）/（错误干扰）/（提示）" 等）
 *   2. 把 options[].errorTag 移到顶层 _internal_option_diagnostics（学生不可见）
 *
 * 这是终极防线 —— 即使 Selena 的 stale PWA 把旧（带 leak）数据 push 回来，
 * server 也会自动剥掉，永远不污染 D1。
 *
 * v0.31.86 扩展：之前只扫 clue_pick + errorTag。现在补上 stem / subq.prompt /
 * 选项 text，覆盖 audit 报告里的全部 leak surface。
 *
 * v0.31.86 keep-newer 守门：sanitize 不直接做版本检查；调用方负责（参见
 * functions/api/sync/ai-questions.ts onRequestPost — 比对 existing.version vs row.version）。
 */

// v0.31.102 扩展 leak pattern 列表（Bruce 反馈分段计价题选项还看到"（无关）"
// 类提示——发现"（多余）/此条无关"等漏在外面，补上）。
// 这是 server-side defense；prompt 侧也加了"绝对禁止元注解"硬规（见
// prompts/questions/system.md）。
const META_PATTERNS = [
  // 解题设定 / 非已知类（告诉学生哪条是"假设"）
  "（解题设定，非已知）",
  "（解题设定）",
  "(解题设定)",
  "（非已知）",
  "(非已知)",
  "（设元）",
  "（设：未知）",
  // 无关 / 多余类（告诉学生哪条该忽略）
  "（无关条件）",
  "（无关）",
  "(无关)",
  "（多余）",
  "(多余)",
  "（多余条件）",
  "（多余信息）",
  "（与题无关）",
  "（此条无关）",
  "（无效）",
  "（迷惑项）",
  "（迷惑）",
  // 错误干扰类（告诉学生哪个错选项是干扰）
  "（错误干扰）",
  "（干扰）",
  "（干扰项）",
  "（错误项）",
  "（混淆）",
  // 元教学注释
  "（提示）",
  "（提示：）",
  "（注：）",
  "（注:）",
  "（备注）",
  "(备注)",
];

export function stripMetaAnnotations(text: string): string {
  let cleaned = text;
  for (const p of META_PATTERNS) cleaned = cleaned.split(p).join("");
  // 删 annotation 后残留的尾部标点 + trim
  return cleaned.replace(/[，,。、:：]\s*$/g, "").trim();
}

export interface UploadRow {
  question_id?: string;
  [k: string]: unknown;
}

export function sanitizeRow(row: UploadRow): UploadRow {
  // 深 clone（避免改外部对象）
  const cloned = JSON.parse(JSON.stringify(row)) as UploadRow;
  const internalDiagnostics: Array<{ id: string; errorTag: string }> = [];

  // 1) 顶层 stem
  if (typeof cloned.stem === "string") {
    cloned.stem = stripMetaAnnotations(cloned.stem);
  }

  // 2) subquestions[].prompt + clue_pick.clues + choose.options
  const subqs = cloned.subquestions as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(subqs)) {
    for (const sub of subqs) {
      if (typeof sub.prompt === "string") {
        sub.prompt = stripMetaAnnotations(sub.prompt);
      }
      // clue_pick：strip 元注解 + 调整 correct 索引
      if (sub.kind === "clue_pick" && Array.isArray(sub.clues)) {
        sub.clues = (sub.clues as unknown[]).map((c) =>
          typeof c === "string" ? stripMetaAnnotations(c) : c,
        );
        const oldClues = sub.clues as string[];
        const keepIdx = oldClues
          .map((c, i) => (c && typeof c === "string" && c.length > 0 ? i : -1))
          .filter((i) => i >= 0);
        if (keepIdx.length < oldClues.length) {
          sub.clues = keepIdx.map((i) => oldClues[i]);
          if (Array.isArray(sub.correct)) {
            const idxMap = new Map<number, number>();
            keepIdx.forEach((oldI, newI) => idxMap.set(oldI, newI));
            sub.correct = (sub.correct as number[])
              .map((oldI) => idxMap.get(oldI))
              .filter((x): x is number => typeof x === "number");
          }
        }
      }
      // choose options：sanitize text + 移 errorTag
      if (sub.kind === "choose" && Array.isArray(sub.options)) {
        for (const opt of sub.options as Array<Record<string, unknown>>) {
          if (opt && typeof opt.text === "string") {
            opt.text = stripMetaAnnotations(opt.text);
          }
          if (opt && typeof opt === "object" && "errorTag" in opt) {
            internalDiagnostics.push({
              id: String(opt.id),
              errorTag: String(opt.errorTag),
            });
            delete opt.errorTag;
          }
        }
      }
    }
  }

  // 3) 顶层 options（plain_choice 等）的 text + errorTag
  const topOpts = cloned.options as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(topOpts)) {
    for (const opt of topOpts) {
      if (opt && typeof opt.text === "string") {
        opt.text = stripMetaAnnotations(opt.text);
      }
      if (opt && typeof opt === "object" && "errorTag" in opt) {
        internalDiagnostics.push({
          id: String(opt.id),
          errorTag: String(opt.errorTag),
        });
        delete opt.errorTag;
      }
    }
  }

  if (internalDiagnostics.length > 0) {
    const existing =
      (cloned._internal_option_diagnostics as Array<{ id: string; errorTag: string }> | undefined) ??
      [];
    cloned._internal_option_diagnostics = [...existing, ...internalDiagnostics];
  }

  return cloned;
}
