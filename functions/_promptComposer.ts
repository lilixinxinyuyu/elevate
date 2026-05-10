/**
 * Prompt 编排器（v0.31.34）
 *
 * 把多个轴的 prompt 片段拼成一个针对性强的最终 prompt：
 *   - skill scope（精确教学范围 + 常见错误 + 例题）
 *   - difficulty rubric（难度等级定义）
 *   - format rubric（answer 格式具体要求）
 *   - game-type schema（前端模板的 JSON 结构样板）
 *   - existing stems（去重）
 *   - quality rubric（共享质量规范，已在 system prompt 内联）
 *
 * 三个端点都用这套：
 *   - /api/generate/questions → composeQuestionPrompt
 *   - /api/agent/judge-questions → composeJudgePrompt
 *   - /api/agent/fix-question → composeFixPrompt
 *
 * 设计原则：
 *   1. 不附带没用的信息（不传 chinese 时不混 chinese 规则）
 *   2. skill 没在 scope.json 里的优雅 fallback（用 skill_name + global rubric）
 *   3. 按 question_format 注入对应规则（不每次都 dump 9 套）
 *   4. existing stems 截断（避免 prompt 爆长）
 */

import { PROMPTS } from "./_prompts.generated";

export interface SkillScope {
  name: string;
  term?: string;
  unitId?: string;
  definition: string;
  inScope: string[];
  outOfScope: string[];
  keyFormulas: string[];
  typicalContexts: string[];
  commonMistakes: string[];
  exampleStems: string[];
}

/** 安全拿 skill scope。没有就返回 null，调用方走 fallback 路径。 */
export function getSkillScope(skillId?: string): SkillScope | null {
  if (!skillId) return null;
  const scope = (PROMPTS.skillScope as unknown as Record<string, SkillScope | undefined>)[skillId];
  return scope ?? null;
}

/** 把 skill scope 渲染成 markdown 段，注入到 user prompt 里。 */
export function renderSkillScopeBlock(scope: SkillScope, skillId: string): string {
  const lines: string[] = [];
  lines.push(`### Skill 范围：${scope.name}（${skillId}）`);
  lines.push(``);
  lines.push(`**定义**：${scope.definition}`);
  lines.push(``);
  if (scope.inScope.length > 0) {
    lines.push(`**✅ 范围内（请只出这些方向）**：`);
    for (const item of scope.inScope) lines.push(`- ${item}`);
    lines.push(``);
  }
  if (scope.outOfScope.length > 0) {
    lines.push(`**⛔ 超纲 / 跑题（绝对不要出）**：`);
    for (const item of scope.outOfScope) lines.push(`- ${item}`);
    lines.push(``);
  }
  if (scope.keyFormulas.length > 0) {
    lines.push(`**🔑 关键公式 / 关系**：`);
    for (const item of scope.keyFormulas) lines.push(`- ${item}`);
    lines.push(``);
  }
  if (scope.typicalContexts.length > 0) {
    lines.push(`**🎯 典型情境（优先使用）**：${scope.typicalContexts.join(" / ")}`);
    lines.push(``);
  }
  if (scope.commonMistakes.length > 0) {
    lines.push(`**🐛 4 年级常见错误（设干扰项时参考）**：`);
    for (const item of scope.commonMistakes) lines.push(`- ${item}`);
    lines.push(``);
  }
  if (scope.exampleStems.length > 0) {
    lines.push(`**📋 题干风格样例（**只是风格参考，不要照抄**）**：`);
    for (const item of scope.exampleStems) lines.push(`- ${item}`);
    lines.push(``);
  }
  return lines.join("\n");
}

/** 渲染指定难度的 rubric 段。 */
export function renderDifficultyBlock(difficulty: number | string): string {
  const d = String(difficulty).match(/^[1-5]$/)?.[0];
  if (!d) return "";
  const rubric = (PROMPTS.difficultyRubrics as unknown as Record<string, string | undefined>)[d];
  if (!rubric) return "";
  return rubric;
}

/** 渲染指定 question_format 的 rubric 段。 */
export function renderFormatBlock(format: string): string {
  const rubric = (PROMPTS.formatRubrics as unknown as Record<string, string | undefined>)[format];
  if (!rubric) return "";
  return rubric;
}

/** 渲染指定 game-type 的 schema 片段（如 plain_choice / shop_counter / speed_match 等）。 */
export function renderGameTypeSchema(gameType: string): string {
  const schema = (PROMPTS.questionsSchemas as unknown as Record<string, string | undefined>)[gameType];
  if (!schema) return PROMPTS.questionsSchemas.plain_choice;
  return schema;
}

/**
 * v0.31.72：按 game_type + difficulty 查 estimated_time_seconds 表（与 quality-rubric.md §3 一致）。
 * 不在表里的 game_type 走 fallback（中等估值）。
 */
const TIME_TABLE: Record<string, [number, number, number]> = {
  // game_type: [diff 1-2, diff 3, diff 4-5]
  speed_match: [10, 15, 20],
  plain_choice: [20, 30, 40],
  decimal_shifter: [18, 25, 35],
  cube_view: [25, 35, 50],
  triangle_judge: [22, 30, 40],
  vertical_repair: [25, 35, 45],
  balance_lab: [35, 50, 65],
  shop_counter: [35, 50, 70],
  clue_finder: [35, 45, 60],
  word_problem_lab: [70, 90, 130],
};
export function estimatedTimeFor(
  gameType: string,
  difficulty: 1 | 2 | 3 | 4 | 5,
): number {
  const row = TIME_TABLE[gameType] ?? [25, 35, 45];
  if (difficulty <= 2) return row[0]!;
  if (difficulty === 3) return row[1]!;
  return row[2]!;
}

/**
 * v0.31.72：按 game_type 推 question_format。固定映射，不走 AI。
 */
const FORMAT_BY_GAME_TYPE: Record<string, string> = {
  plain_choice: "single_choice",
  speed_match: "single_choice",
  cube_view: "single_choice",
  triangle_judge: "single_choice",
  vertical_repair: "fill_blank",
  decimal_shifter: "single_choice",
  balance_lab: "numeric_choice",
  shop_counter: "multi_step",
  clue_finder: "single_choice",
  word_problem_lab: "multi_step",
  equation_builder: "fill_blank",
};
export function questionFormatFor(gameType: string): string {
  return FORMAT_BY_GAME_TYPE[gameType] ?? "single_choice";
}

/**
 * v0.31.72：按 skill scope 推 cognitive_level（默认 procedural；和倍/差倍 / 应用题倾向 application）。
 */
export function cognitiveLevelFor(
  skillId: string,
  gameType?: string,
): "recall" | "procedural" | "application" | "reasoning" {
  if (gameType === "word_problem_lab" || gameType === "shop_counter") return "application";
  if (skillId.includes("compare") || skillId.includes("judge")) return "reasoning";
  if (skillId.includes("read") || skillId.includes("recognize")) return "recall";
  return "procedural";
}

/** v0.31.72: existingStem 可以带难度 + skill_id（用于 [Dx] 显示 + 同 skill 真实样题挑选）。 */
export type ExistingStemEntry =
  | string
  | { stem: string; difficulty?: number; skillId?: string; questionId?: string };

export interface ComposeQuestionInput {
  /** "math" / "chinese" */
  subjectId: "math" | "chinese";
  /** 必填 */
  unitId: string;
  unitName?: string;
  /** 主 skill_id（落库的 question.skill_id 用这个） */
  skillId: string;
  skillName?: string;
  /**
   * v0.31.35: D5 综合题用 — 额外注入这些 skill 的 scope，让模型出题时跨这些
   * skill 的考点。落库还是用主 skillId（不是 multi-skill 标记）。
   *
   * 例：D5 出"小数乘法 + 平均数"综合题：
   *   skillId="average_compute"（落库主 skill）
   *   extraSkillIds=["decimal_mul_meaning"]（额外注入小数乘法的 scope）
   */
  extraSkillIds?: string[];
  /** 上册 / 下册 */
  term?: "上册" | "下册";
  /** 单道难度（1-5）；如果是范围（"2-4"），调用方先 pick 一个 */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** 答题格式 — 显式选择，避免模型按推荐自动选错（如 single_choice 但实际应该 fill_blank） */
  format?:
    | "numeric"
    | "numeric_choice"
    | "single_choice"
    | "multi_choice"
    | "multi_step"
    | "fill_blank"
    | "drag_drop"
    | "sort_ladder"
    | "geometry_operation";
  /** 前端模板（决定渲染方式 + schema 片段）。如不传按 game-type-by-skill 自动选。 */
  gameType?: string;
  /** 本批要出几道 */
  count: number;
  /** 已有题干，用于去重 + 难度参考 */
  existingStems?: ExistingStemEntry[];
  /** 最近做错的题（用于"再出一题"场景） */
  recentMistakeStems?: string[];
  /** 出题角度种子（不同批次的并发去重） */
  batchAngle?: string;
  /** 调用上下文标签（仅日志用） */
  callerTag?: string;
  /**
   * v0.31.72 (B + C)：caller-known 字段预填。让 AI 不再自己造 enum 值。
   * 调用方根据 skill_id + game_type + difficulty 计算后传入；composer 直接渲染到
   * "已确定的元数据"段，AI 原样抄进每道题。
   */
  prefilledFields?: {
    grade?: number;
    examPriority?: string;
    abilityDimension?: string[];
    cognitiveLevel?: string;
    questionFormat?: string;
    estimatedTimeSeconds?: number;
    status?: string;
  };
  /**
   * v0.31.72 (C)：当前 skill 的高质量样题（从 SEED 选 1 道）。
   * 注入到 schema 块下方作为"参考真实结构"，比固定的 basketball/football example 贴。
   */
  skillExampleQuestion?: Record<string, unknown>;
}

/**
 * 组合出 user prompt。
 *
 * 输出顺序（重要 → 次要）：
 *   1. 任务声明（出几道、什么 skill、什么难度）
 *   2. **Skill scope**（最关键，决定不跑题不超纲）
 *   3. **Difficulty rubric**（决定难度时间合理）
 *   4. **Format rubric**（决定 answer 格式正确）
 *   5. **Game-type schema**（决定 JSON 结构）
 *   6. existing stems（去重）
 *   7. recent mistakes（如有，重点考点）
 */
export function composeQuestionUserPrompt(args: ComposeQuestionInput): string {
  const {
    subjectId,
    unitId,
    unitName,
    skillId,
    skillName,
    extraSkillIds,
    term,
    difficulty,
    format,
    count,
    existingStems,
    recentMistakeStems,
    batchAngle,
    prefilledFields,
    skillExampleQuestion,
  } = args;

  const subjectLabel = subjectId === "math" ? "数学" : "语文";
  const actualTerm = term ?? "下册";
  const otherTerm = actualTerm === "上册" ? "下册" : "上册";

  const scope = getSkillScope(skillId);
  // v0.31.35: D5 综合题 — 额外 skill 的 scope，去重防主 skill 重复
  const extraScopes: { skillId: string; scope: SkillScope }[] = [];
  for (const sid of extraSkillIds ?? []) {
    if (sid === skillId) continue;
    const sc = getSkillScope(sid);
    if (sc) extraScopes.push({ skillId: sid, scope: sc });
  }

  // v0.31.74: gameType 决定提前到 prefilled block 之前 — 元数据要带 game_type
  const fromSkill = (PROMPTS.gameTypeBySkill as unknown as Record<string, string>)[skillId];
  const gameType =
    args.gameType ??
    fromSkill ??
    (format === "multi_step"
      ? "shop_counter"
      : format === "single_choice"
        ? "plain_choice"
        : "plain_choice");

  const lines: string[] = [];

  // 1. 任务声明
  const isComboMode = extraScopes.length > 0;
  lines.push(`# 任务：生成 ${count} 道四年级${actualTerm} ${subjectLabel} 题`);
  lines.push(``);
  lines.push(`- **学科**：${subjectLabel}（${subjectId}）`);
  lines.push(`- **教材**：${subjectId === "math" ? "北师大版" : "人教版"}四年级${actualTerm}（不要混入${otherTerm}内容）`);
  lines.push(`- **单元**：${unitName ?? "(不详)"}（${unitId}）`);
  lines.push(`- **主技能点**：${skillName ?? scope?.name ?? "(不详)"}（${skillId}）`);
  if (isComboMode) {
    lines.push(`- **综合考查（D${difficulty} 跨 skill 题型）**：还要交叉融合下面这些 skill 的考点：`);
    for (const e of extraScopes) {
      lines.push(`  - ${e.scope.name}（${e.skillId}）`);
    }
  }
  lines.push(`- **难度**：${difficulty}（按下方难度规范严格控制）`);
  if (format) {
    lines.push(`- **答题格式**：${format}（按下方格式规范填字段）`);
  }
  if (batchAngle) {
    lines.push(`- **变化角度**：${batchAngle}（同批次不同情境/不同数字/不同字词）`);
  }
  lines.push(``);

  // 1.5 v0.31.72 (B): 已确定的元数据 — 直接抄进每道题
  if (prefilledFields) {
    lines.push(`## 已确定的元数据（**原样抄进每道题，不要改、不要造、不要凭直觉换值**）`);
    lines.push(``);
    lines.push("```jsonc");
    lines.push(`{`);
    lines.push(`  "subjectId": "${subjectId}",`);
    lines.push(`  "term": "${actualTerm}",`);
    lines.push(`  "unit_id": "${unitId}",`);
    if (unitName) lines.push(`  "unit_name": "${unitName}",`);
    lines.push(`  "skill_id": "${skillId}",`);
    if (skillName) lines.push(`  "skill_name": "${skillName}",`);
    lines.push(`  "grade": ${prefilledFields.grade ?? 4},`);
    lines.push(`  "difficulty": ${difficulty},`);
    lines.push(`  "game_type": "${gameType}",`);
    lines.push(`  "play_as": "${gameType}",`);
    if (prefilledFields.examPriority)
      lines.push(`  "exam_priority": "${prefilledFields.examPriority}",`);
    if (prefilledFields.abilityDimension && prefilledFields.abilityDimension.length > 0)
      lines.push(
        `  "ability_dimension": ${JSON.stringify(prefilledFields.abilityDimension)},`,
      );
    if (prefilledFields.cognitiveLevel)
      lines.push(`  "cognitive_level": "${prefilledFields.cognitiveLevel}",`);
    if (prefilledFields.questionFormat)
      lines.push(`  "question_format": "${prefilledFields.questionFormat}",`);
    if (prefilledFields.estimatedTimeSeconds)
      lines.push(
        `  "estimated_time_seconds": ${prefilledFields.estimatedTimeSeconds},`,
      );
    lines.push(`  "status": "${prefilledFields.status ?? "approved"}",`);
    lines.push(`  "version": 1`);
    lines.push(`}`);
    lines.push("```");
    lines.push(``);
    lines.push(
      `> 这些值由系统按 skill_id + game_type + difficulty 精确推出，AI 不再自行决定（避免 "term=G4B" / "cognitive_level=conceptual" 这类 enum vfail）。`,
    );
    lines.push(``);
  }

  // 2. Skill scope（主 skill）
  if (scope) {
    lines.push(`## 主 Skill 教学范围（必读 — 决定不跑题不超纲）`);
    lines.push(``);
    lines.push(renderSkillScopeBlock(scope, skillId));
  } else {
    lines.push(`## 主 Skill 教学范围（fallback — scope.json 未登记）`);
    lines.push(``);
    lines.push(`- skill_name：${skillName ?? skillId}`);
    lines.push(`- 紧扣这个 skill 的考点出题，不要扯其他 skill 的内容`);
    lines.push(``);
  }

  // 2.5 D5 综合题：渲染额外 skill 的 scope
  if (isComboMode) {
    lines.push(`## 综合考查的额外 Skill（D${difficulty} 题必须把这些考点织进同一道题）`);
    lines.push(``);
    for (const { skillId: sid, scope: sc } of extraScopes) {
      lines.push(renderSkillScopeBlock(sc, sid));
      lines.push(`---`);
      lines.push(``);
    }
    lines.push(`### 综合题设计要求`);
    lines.push(``);
    lines.push(`- 一道题里同时考主 skill 和上面所有额外 skill 的考点（不要分两道）`);
    lines.push(`- 解题流程明显有"先求 A 再用 A 求 B"的多阶段推理`);
    lines.push(`- 数据源同一个情境（如同一道购物 / 路程 / 班级题），不要硬拼两个不相关情境`);
    lines.push(`- 不要让任一 skill 沦为"道具"（每个 skill 都要真考查到）`);
    lines.push(``);
  }

  // 3. Difficulty rubric
  const diffBlock = renderDifficultyBlock(difficulty);
  if (diffBlock) {
    lines.push(`## 难度规范（${difficulty}）`);
    lines.push(``);
    lines.push(diffBlock);
    lines.push(``);
  }

  // 4. Format rubric
  if (format) {
    const fmtBlock = renderFormatBlock(format);
    if (fmtBlock) {
      lines.push(`## 答题格式规范（${format}）`);
      lines.push(``);
      lines.push(fmtBlock);
      lines.push(``);
    }
  }

  // 5. Game-type schema（决定 JSON 结构）
  // gameType 已在函数顶部定义（用于 prefilled metadata block），这里直接复用
  lines.push(`## JSON Schema（按 game-type=${gameType} 输出每道题）`);
  lines.push(``);
  lines.push(renderGameTypeSchema(gameType));
  lines.push(``);

  // 5.5 v0.31.72 (C): 当前 skill 的高质量真实样题 — 比固定 schema example 更贴
  if (skillExampleQuestion) {
    lines.push(`## 当前 skill 的真实样题（参考结构 — 不要照抄题面）`);
    lines.push(``);
    lines.push(
      `> 下面是题库里这个 skill 的一道高质量题，注意它的 \`subquestions\` / \`distractors\` / \`hints\` 风格。**只参考结构，不要复用题面**。`,
    );
    lines.push(``);
    lines.push("```json");
    lines.push(JSON.stringify(skillExampleQuestion, null, 2));
    lines.push("```");
    lines.push(``);
  }

  // 6. existing stems — v0.31.72 (D)：带 [Dx] 难度标，不再裁切
  //   - existingStems 现在可以是 string | { stem, difficulty }，对象形式渲染 [Dx]
  //   - 1000 道 × ~50 字 = 50KB ≈ 12K token，现代模型 context 100K+ 不在意
  //   - 唯一防爆兜底：单条 stem 超长（>200 字）截 200 — 防异常数据，不为省 token
  if (existingStems && existingStems.length > 0) {
    lines.push(
      `## 已有题干 (${existingStems.length} 道, **避免重复** — 换情境/换数字/换字词；前面 \`[Dx]\` 是该题难度，给你校准当前批次难度感)`,
    );
    lines.push(``);
    for (const entry of existingStems) {
      const stem = typeof entry === "string" ? entry : entry.stem;
      const d = typeof entry === "string" ? undefined : entry.difficulty;
      const truncated = stem.length > 200 ? stem.slice(0, 200) + "…" : stem;
      const prefix = d ? `[D${d}] ` : ``;
      lines.push(`- ${prefix}${truncated}`);
    }
    lines.push(``);
  }

  // 7. recent mistakes
  if (recentMistakeStems && recentMistakeStems.length > 0) {
    lines.push(`## 最近做错的考点（围绕这些设计同类题 — 巩固训练）`);
    lines.push(``);
    for (const s of recentMistakeStems.slice(0, 5)) {
      lines.push(`- ${s.slice(0, 60)}`);
    }
    lines.push(``);
  }

  // v0.31.72：输出协议 已经在 system prompt 里讲过一次，不在 user 重复（去 redundancy）
  return lines.join("\n");
}

export interface ComposeJudgeInput {
  subjectId: "math" | "chinese";
  scopeLabel: string;
  scopeFilter: string;
  questions: Array<Record<string, unknown>>;
}

/**
 * 组合出 judge user prompt。
 *
 * 与 generate 不同：judge 不针对单 skill（一批题可能跨 skill），所以不注入 skill scope。
 * 但每道题里如果指定了 skill_id 且在 scope.json 里有，模型就读得到。
 *
 * judge system prompt 已经是固定的（包含 quality-rubric.md），这里只构造 user。
 */
export function composeJudgeUserPrompt(args: ComposeJudgeInput): string {
  const subjectLabel = args.subjectId === "math" ? "数学" : "语文";

  // 把这批题里涉及的 skill 列出来 + 每个对应的 scope（如果有）
  const skillsTouched = new Set<string>();
  for (const q of args.questions) {
    if (typeof q.skill_id === "string") skillsTouched.add(q.skill_id);
  }
  const scopesUsed: { skillId: string; scope: SkillScope }[] = [];
  for (const sid of skillsTouched) {
    const sc = getSkillScope(sid);
    if (sc) scopesUsed.push({ skillId: sid, scope: sc });
  }

  // 简化 question 字段（避免 prompt 爆长）
  const questionsJsonl = args.questions
    .map((q) => JSON.stringify(q))
    .join("\n");

  const lines: string[] = [];
  lines.push(`# 任务：质检下面 ${args.questions.length} 道${subjectLabel}题`);
  lines.push(``);
  lines.push(`- **学科**：${subjectLabel}`);
  lines.push(`- **范围**：${args.scopeLabel}（${args.scopeFilter}）`);
  lines.push(``);

  // 把这批题涉及到的 skill scope 都列出来（最多 6 个，避免 prompt 爆）
  if (scopesUsed.length > 0) {
    lines.push(`## 这批题涉及的 Skill 教学范围（判定时严格对照）`);
    lines.push(``);
    for (const { skillId, scope } of scopesUsed.slice(0, 6)) {
      lines.push(renderSkillScopeBlock(scope, skillId));
      lines.push(`---`);
      lines.push(``);
    }
    if (scopesUsed.length > 6) {
      lines.push(`（还有 ${scopesUsed.length - 6} 个 skill scope 未列出，按通用 quality-rubric 判）`);
      lines.push(``);
    }
  }

  lines.push(`## 题目（每行一道，JSON 简表）`);
  lines.push(``);
  lines.push("```json");
  lines.push(questionsJsonl);
  lines.push("```");
  lines.push(``);
  lines.push(`## 输出要求`);
  lines.push(``);
  lines.push(
    `返回 \`{ "judgments": [...] }\`，每道题一个 judgment（顺序与输入一致），字段见 system 协议。每道题**必须**有一个 judgment。`,
  );

  return lines.join("\n");
}

export interface ComposeFixInput {
  question: Record<string, unknown>;
  issues: string[];
  reason: string;
  subjectId: "math" | "chinese";
}

/**
 * 组合出 fix user prompt。带上 skill scope（如果该 skill 在 scope.json 里）让模型在范围内改。
 */
export function composeFixUserPrompt(args: ComposeFixInput): string {
  const skillId =
    typeof args.question.skill_id === "string" ? args.question.skill_id : undefined;
  const scope = getSkillScope(skillId);

  const issuesLine =
    args.issues && args.issues.length > 0 ? args.issues.join(", ") : "（无 issues 标签）";

  const lines: string[] = [];
  lines.push(`## 原题`);
  lines.push(``);
  lines.push("```json");
  lines.push(JSON.stringify(args.question, null, 2));
  lines.push("```");
  lines.push(``);
  lines.push(`## 质检员的判定`);
  lines.push(``);
  lines.push(`- **issues**：${issuesLine}`);
  lines.push(`- **reason**：${args.reason ?? "（未提供）"}`);
  lines.push(``);

  if (scope && skillId) {
    lines.push(`## Skill 教学范围（修题时不能跑出这个范围）`);
    lines.push(``);
    lines.push(renderSkillScopeBlock(scope, skillId));
  }

  lines.push(`## 输出`);
  lines.push(``);
  lines.push(
    `请按系统协议返回 \`{ "fixed": ..., "changesSummary": "..." }\`，**只输出 JSON**。`,
  );

  return lines.join("\n");
}
