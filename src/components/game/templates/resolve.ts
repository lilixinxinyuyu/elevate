import type { GameTemplate, Question, Skill } from "../../../core/types";
import { isSpeedEligible, shouldForceNumericFill } from "../../../core/speedMatchPolicy";
import { requiresMultiStep } from "../../../core/multiStepPolicy";

/**
 * v0.35.24 iter 53: canvas_scratch heuristic.
 *
 * iter 41 ship CanvasScratch 后没自动 trigger condition, 只 admin/AI 显式标
 * play_as 才用. 旧题库 0 道这么标 → Selena 实际几乎不用.
 *
 * iter 49 LLM backfill 后 ~19.6% 题有 requiresScratch=true. 把符合条件的
 * 自动 route 到 canvas_scratch: 需要列算式 + 不是多步应用题 (多步用 4 步框架)
 * + 不是速算 (速算不需草稿) + numeric 答 (canvas 答需要数字, choice 不适合).
 *
 * 期望: ~10-14% 题自动走 canvas_scratch. Selena 终于真在白板上列算式.
 */
function requiresCanvasScratch(q: Question): boolean {
  if (q.play_as === "canvas_scratch") return true; // 显式标优先
  // 自动判: 需要列算式 + 不互斥其他模板
  if (q.requiresScratch !== true) return false;
  if (q.requiresMultiStep === true) return false; // multi_step 已覆盖
  if (q.speedEligible === true) return false;     // 速算不需草稿
  if (q.answer.type !== "number") return false;   // canvas 答需要数字
  if (q.dot_grid) return false;                   // 几何图形优先 dot_grid_draw
  if (q.subquestions && q.subquestions.length > 0) return false; // 子题走 shop_counter
  return true;
}

const GAME_TYPE_MAP: Record<string, GameTemplate> = {
  speed_calc: "speed_match",
  decimal_shop: "shop_counter",
  word_problem_lab: "shop_counter",
  equation_balance: "equation_builder",
  law_magic: "speed_match",
  vertical_repair: "vertical_repair",
  true_false: "true_false_swipe",
  geometry_judge: "plain_choice",
  angle_shooter: "plain_choice",
  data_detective: "plain_choice",
  // v0.31.87 — 5 个新玩法
  discount_drift: "discount_drift",
  coin_combo: "coin_combo",
  time_heist: "time_heist",
  number_hunt: "number_hunt",
  // shape_builder 复用 dot_grid_draw 渲染
  shape_builder: "dot_grid_draw",
};

const FORMAT_MAP: Record<string, GameTemplate> = {
  sort_ladder: "sort_ladder",
  multi_choice: "clue_finder",
  single_choice: "plain_choice",
  numeric_choice: "speed_match",
  multi_step: "shop_counter",
};

/**
 * v0.34.63 Q3 fix #1 (真 source bug): answer.type==="number" 的题永远不能落到
 * 「纯 choice 模板」(plain_choice / clue_finder / sort_ladder / true_false_swipe)。
 *
 * 这些模板用 option.id ("A"/"B"/"C"/"D") 作为提交答案；而 grader 拿 spec.value (number)
 * 去比 raw "A"，coerceNumber("A")==null → 一律记错题 + answer=["D"] 灌进 mistakes 库。
 *
 * 复现：AI 出 numeric 题误标 question_format: "single_choice" + 4 个数字选项。
 * 之前修了三层（grader unwrap / resurrection / ShopCounter source），这里堵真源头。
 */
const CHOICE_ONLY_TEMPLATES = new Set<GameTemplate>([
  "plain_choice",
  "clue_finder",
  "sort_ladder",
  "true_false_swipe",
]);

function rerouteIfNumericMismatch(
  q: Question,
  resolved: GameTemplate,
): GameTemplate {
  if (q.answer.type !== "number") return resolved;
  // speed_match 是 "numeric 4 选 1"，内部 buildOptions 也兼容 single_choice + numeric
  // (本次同步修了)。这里只挡纯 choice 模板。
  if (!CHOICE_ONLY_TEMPLATES.has(resolved)) return resolved;
  const hasNumericOptions =
    (q.options ?? []).length >= 2 &&
    (q.options ?? []).every((o) => /-?\d+(\.\d+)?/.test(o.text));
  const replacement: GameTemplate = hasNumericOptions ? "speed_match" : "plain_numeric";
  console.warn(
    `[resolveTemplate] q=${q.question_id} answer.type=number 但 resolved=${resolved}（choice-only），` +
      `自动改判 → ${replacement}。question_format=${q.question_format} game_type=${q.game_type}`,
  );
  return replacement;
}

/**
 * v0.34.98 (iter 32 P0-0b/c): SpeedMatch 白名单 + Choice→Fill 政策后处理.
 *
 *   1. resolved=speed_match 但 !isSpeedEligible(q) → fallback plain_numeric
 *   2. resolved=plain_choice/speed_match 且 shouldForceNumericFill(q) → fallback plain_numeric
 *      (注: rerouteIfNumericMismatch 会把 single_choice + 数字答 改 speed_match,
 *       所以 Force-Fill 必须在两种 resolved 上都生效, 否则简单单选数字题永远进 speed_match)
 *
 * 详见 src/core/speedMatchPolicy.ts.
 */
function applyP0Policies(q: Question, resolved: GameTemplate): GameTemplate {
  // Force-Fill 优先 (跨 speed_match / plain_choice 两种 resolved 都拦)
  if (
    (resolved === "speed_match" || resolved === "plain_choice") &&
    shouldForceNumericFill(q)
  ) {
    return "plain_numeric";
  }
  if (resolved === "speed_match" && !isSpeedEligible(q)) {
    return q.answer.type === "number" ? "plain_numeric" : "plain_choice";
  }
  return resolved;
}

export function resolveTemplate(q: Question): GameTemplate {
  // v0.35.1 iter 35 P0-3: MultiStepApplication 优先 — 满足条件直接接管
  // (跟 ScratchInsurance + EstimationGate 互斥 — multiStepPolicy heuristic 内已保证)
  if (requiresMultiStep(q)) return "multi_step_application";
  // v0.35.24 iter 53: canvas_scratch 自动 trigger — Selena 在白板上列算式
  if (requiresCanvasScratch(q)) return "canvas_scratch";
  const t = resolveTemplateRaw(q);
  const rerouted = rerouteIfNumericMismatch(q, t);
  return applyP0Policies(q, rerouted);
}

function resolveTemplateRaw(q: Question): GameTemplate {
  // v0.33.40 (bug fix): play_as=balance_lab 但缺 eq: tag → 退回 speed_match/plain_choice
  // 否则 BalanceLab parseEq fail → fallback state → 自动判错 bug
  if (q.play_as === "balance_lab") {
    const hasEqTag = (q.tags ?? []).some((t) => t.startsWith("eq:") && (t.includes("=") || t.includes("|")));
    if (!hasEqTag) {
      console.warn(
        `[resolveTemplate] q=${q.question_id} 标 play_as=balance_lab 但缺 eq: tag → fallback`,
      );
      // numeric 走 speed_match，single_choice 走 plain_choice
      if (q.question_format === "numeric") return "speed_match";
      if (q.question_format === "single_choice") return "plain_choice";
      return "speed_match";
    }
  }
  if (q.play_as) return q.play_as;
  // Phase 2 Axis 2：带 dot_grid spec 的题统一走 dot_grid_draw
  if (q.dot_grid) return "dot_grid_draw";
  // 有 subquestions 的走 shop_counter
  if (q.subquestions && q.subquestions.length > 0) return "shop_counter";
  const fromFormat = FORMAT_MAP[q.question_format];
  if (fromFormat) return fromFormat;
  const fromGame = GAME_TYPE_MAP[q.game_type];
  if (fromGame) return fromGame;
  // numeric 题默认 speed_match（有 distractors 或自动生成）
  if (q.question_format === "numeric") return "speed_match";
  return "plain_numeric";
}

export function skillTemplateHint(skill: Skill | undefined): GameTemplate | undefined {
  return skill?.preferredTemplate;
}
