/**
 * v0.35.47 Refactor Priority 14 (peer review #4 共识 #2): GameShell 拆分第 1 步.
 *
 * 提取 GAME_TEMPLATES + pickPanel + templateTitle 到独立文件:
 *   - GameShell.tsx 减重 ~60 行
 *   - 加新模板时只在 GAME_TEMPLATES 一处加, GameShell 完全不动
 *   - panel/title 选择逻辑独立可测
 *
 * 注: 用 `import type` 避免运行时 circular (TemplateRenderProps 仍 declared
 * in GameShell.tsx — 移它需要改 24 个 template 文件, 留下一轮 batch).
 */
import type { GameTemplate } from "../../core/types";
import { exhaustiveOr } from "../../lib/exhaustive";

// 22 template panels (run-time imports — 跟 GameShell 之前一样)
import { SpeedMatchPanel } from "./templates/SpeedMatch";
import { ShopCounterPanel } from "./templates/ShopCounter";
import { EquationBuilderPanel } from "./templates/EquationBuilder";
import { ClueFinderPanel } from "./templates/ClueFinder";
import { PlainNumericPanel } from "./templates/PlainNumeric";
import { PlainChoicePanel } from "./templates/PlainChoice";
import { SortLadderPanel } from "./templates/SortLadder";
import { TrueFalseSwipePanel } from "./templates/TrueFalseSwipe";
import { VerticalRepairPanel } from "./templates/VerticalRepair";
import { DecimalShifterPanel } from "./templates/DecimalShifter";
import { MemoryMatchPanel } from "./templates/MemoryMatch";
import { ShapeCourtPanel } from "./templates/ShapeCourt";
import { BalanceLabPanel } from "./templates/BalanceLab";
import { ChartDetectivePanel } from "./templates/ChartDetective";
import { CubeViewerPanel } from "./templates/CubeViewer";
import { TriangleJudgePanel } from "./templates/TriangleJudge";
import { DotGridDrawPanel } from "./templates/DotGridDraw";
import { MultiStepApplicationPanel } from "./templates/MultiStepApplication";
import { CanvasScratchPanel } from "./templates/CanvasScratch";
import { DiscountDriftPanel } from "./templates/DiscountDrift";
import { CoinComboPanel } from "./templates/CoinCombo";
import { TimeHeistPanel } from "./templates/TimeHeist";
import { NumberHuntPanel } from "./templates/NumberHunt";

// type-only import 避免运行时 circular (GameShell 也 import 自这里)
import type { TemplateRenderProps } from "./GameShell";

type TemplateDef = {
  readonly title: string;
  readonly Panel: (p: TemplateRenderProps) => JSX.Element;
};

/**
 * 单一 registry. `satisfies Record<GameTemplate, TemplateDef>` 编译时 enforce
 * 完整覆盖 — 加 / 删 GameTemplate union member 不同步这里 → TS error.
 *
 * 加新模板 step:
 *   1. core/types.ts 加到 GameTemplate union (+ GAME_TEMPLATE_IDS)
 *   2. 这里 GAME_TEMPLATES 加 `<id>: { title, Panel }` 一行
 *   3. (可选) core/templateCapabilities.ts 加 writeHeavy 等 capability
 */
export const GAME_TEMPLATES = {
  speed_match:           { title: "闪电匹配",     Panel: SpeedMatchPanel },
  shop_counter:          { title: "小数商店",     Panel: ShopCounterPanel },
  equation_builder:      { title: "方程拼装",     Panel: EquationBuilderPanel },
  clue_finder:           { title: "线索侦探",     Panel: ClueFinderPanel },
  plain_choice:          { title: "选择题",       Panel: PlainChoicePanel },
  plain_numeric:         { title: "口算挑战",     Panel: PlainNumericPanel },
  sort_ladder:           { title: "数字阶梯",     Panel: SortLadderPanel },
  true_false_swipe:      { title: "对错冲刺",     Panel: TrueFalseSwipePanel },
  vertical_repair:       { title: "竖式修理厂",   Panel: VerticalRepairPanel },
  decimal_shifter:       { title: "小数点滑梯",   Panel: DecimalShifterPanel },
  memory_match:          { title: "记忆配对",     Panel: MemoryMatchPanel },
  shape_court:           { title: "图形法庭",     Panel: ShapeCourtPanel },
  balance_lab:           { title: "天平实验室",   Panel: BalanceLabPanel },
  chart_detective:       { title: "数据侦探",     Panel: ChartDetectivePanel },
  cube_view:             { title: "立体观察",     Panel: CubeViewerPanel },
  triangle_judge:        { title: "三角形法庭",   Panel: TriangleJudgePanel },
  dot_grid_draw:         { title: "点子图画图",   Panel: DotGridDrawPanel },
  multi_step_application:{ title: "应用题 4 步法", Panel: MultiStepApplicationPanel },
  canvas_scratch:        { title: "画板列算式",   Panel: CanvasScratchPanel },
  discount_drift:        { title: "折扣漂移",     Panel: DiscountDriftPanel },
  coin_combo:            { title: "凑钱挑战",     Panel: CoinComboPanel },
  time_heist:            { title: "时间窃贼",     Panel: TimeHeistPanel },
  number_hunt:           { title: "数字寻宝",     Panel: NumberHuntPanel },
} as const satisfies Record<GameTemplate, TemplateDef>;

export function pickPanel(id: GameTemplate): (p: TemplateRenderProps) => JSX.Element {
  const def = GAME_TEMPLATES[id];
  if (def) return def.Panel;
  // 运行时兜底: 旧 IDB cache 里非法 templateId 字符串绕过 TS → 软 fallback.
  return exhaustiveOr(id as never, PlainNumericPanel, `pickPanel missing case: ${id}`);
}

export function templateTitle(id: GameTemplate): string {
  const def = GAME_TEMPLATES[id];
  if (def) return def.title;
  return exhaustiveOr(id as never, "挑战", `templateTitle missing case: ${id}`);
}
