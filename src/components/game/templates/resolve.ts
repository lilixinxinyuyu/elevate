import type { GameTemplate, Question, Skill } from "../../../core/types";

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
};

const FORMAT_MAP: Record<string, GameTemplate> = {
  sort_ladder: "sort_ladder",
  multi_choice: "clue_finder",
  single_choice: "plain_choice",
  numeric_choice: "speed_match",
  multi_step: "shop_counter",
};

export function resolveTemplate(q: Question): GameTemplate {
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
