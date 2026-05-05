# 题型 / 游戏模板分发系统

> 写给未来的 Claude：每次加新题型都要读 4 个文件理解 game_type / play_as /
> question_format / GameTemplate 怎么对应——这个 doc 把映射讲清。

## 三个字段一个枚举

每道 Question 有三个字段决定怎么渲染：

```ts
{
  game_type: "speed_calc" | "decimal_shop" | ...,    // string 枚举（生成器/老 API 用）
  play_as: "shop_counter" | "speed_match" | ...,     // 强制走某个模板（覆盖默认）
  question_format: "numeric" | "numeric_choice" | ... // 答题形式
}
```

最终通过 `resolveTemplate(q)` 算出 `GameTemplate` 枚举，决定渲染哪个 Panel。

## resolveTemplate 优先级（src/components/game/templates/resolve.ts）

```
1. q.play_as 存在               → 直接用
2. q.dot_grid 存在              → "dot_grid_draw"
3. q.subquestions.length > 0    → "shop_counter"
4. FORMAT_MAP[question_format]  → 对应模板
5. GAME_TYPE_MAP[game_type]     → 对应模板
6. question_format === "numeric" → "speed_match"
7. fallback                     → "plain_numeric"
```

## 现有 GameTemplate 枚举 + 对应 Panel

`src/core/types.ts GameTemplate` + `src/components/game/GameShell.tsx pickPanel()`：

| GameTemplate | Panel 组件 | 用途 |
|---|---|---|
| `speed_match` | SpeedMatchPanel | 4 选 1 闪电匹配（默认 numeric） |
| `shop_counter` | ShopCounterPanel | **多步应用题**（subquestions 走这） |
| `equation_builder` | EquationBuilderPanel | 方程拼搭 |
| `clue_finder` | ClueFinderPanel | 多选 / 找线索 |
| `sort_ladder` | SortLadderPanel | 拖动排序（小数大小排） |
| `chart_detective` | ChartDetectivePanel | 看图答题（条形图） |
| `shape_court` | ShapeCourtPanel | 几何分类 |
| `triangle_judge` | TriangleJudgePanel | 三角形判断 |
| `cube_view` | CubeViewerPanel | 立体图形多角度 |
| `true_false_swipe` | TrueFalseSwipePanel | 是非滑动 |
| `vertical_repair` | VerticalRepairPanel | 竖式找错 |
| `decimal_shifter` | DecimalShifterPanel | 小数点移动 |
| `memory_match` | MemoryMatchPanel | 记忆配对 |
| `balance_lab` | BalanceLabPanel | 天平 / 等量替换 |
| `plain_numeric` | PlainNumericPanel | 普通数字输入兜底 |
| `plain_choice` | PlainChoicePanel | 普通选择题兜底 |
| `dot_grid_draw` | **DotGridDrawPanel** (Phase 2 Axis 2) | SVG 点子图画图 |

## 加新 GameTemplate 完整步骤

1. **types.ts**：`GameTemplate` 枚举加新字符串
2. **schema.ts**：`GameTemplateSchema` z.enum 加（**忘了这个 zod 会拒绝、validate 失败**）
3. **新 Panel 组件**：`src/components/game/templates/<Name>.tsx`
   实现 `TemplateRenderProps` 接口（看 VerticalRepair 学）
4. **GameShell.tsx**：
   - 顶部 import 新 Panel
   - `pickPanel()` switch 加 case
5. **resolve.ts**：`resolveTemplate()` 加分发条件（如果靠 question_format 或新字段）
6. **Question 字段**（如果新 template 需要专属载荷）：
   - `types.ts` Question 加 optional 字段
   - `schema.ts` QuestionSchema 加 zod validation
7. **生成 demo 题**：用 `play_as: "<new_template>"` 强制走

### v0.31.0 加 dot_grid_draw 真实例子
踩过的坑：第 2 步漏了。zod schema 默认 strip 未声明字段——题目带的
`dot_grid` 数据被静默丢掉，Panel 拿不到 spec → 渲染错误信息。

## subquestions / multi-step 题

特殊：题有 `subquestions[]` 时**自动**走 ShopCounter（多步分阶段答）。
不管 game_type/play_as 是啥。

subquestions 三种 kind：
- `clue_pick` 多选已知条件
- `choose` 单选
- `numeric` 数字输入

每步答对才解锁下一步；最后一步答对全题对。

## game_type / question_format 映射表

`resolve.ts`：

```ts
GAME_TYPE_MAP: {
  speed_calc      → speed_match
  decimal_shop    → shop_counter
  word_problem_lab → shop_counter
  equation_balance → equation_builder
  law_magic       → speed_match
  vertical_repair → vertical_repair
  true_false      → true_false_swipe
  geometry_judge  → plain_choice
  angle_shooter   → plain_choice
  data_detective  → plain_choice
}

FORMAT_MAP: {
  sort_ladder    → sort_ladder
  multi_choice   → clue_finder
  single_choice  → plain_choice
  numeric_choice → speed_match
  multi_step     → shop_counter
}
```

加新 game_type 优先建议直接给题目加 `play_as: "<existing_template>"`，
而不是改 GAME_TYPE_MAP（避免 mapping 表膨胀）。

## TemplateRenderProps 接口

新 Panel 必须实现：

```ts
interface TemplateRenderProps {
  question: Question;
  hintsOpened: number;
  openHint: () => void;
  onFinish: (r: Omit<AttemptResult, "hintsOpened" | "elapsedSeconds" | "correctAnswerDisplay">) => void;
  triggerFx: TriggerFx;
  onPickFeedback: (kind: "correct" | "wrong") => void;
  disabled: boolean;
}
```

`onFinish` 是关键：把 `{answer, isCorrect, partialCorrect, matchedErrorTags}` 报给 GameShell。
看 `DotGridDraw.tsx` / `VerticalRepair.tsx` 学。

## Question 验证（`core/validateQuestion.ts`）

每道题进 IndexedDB 前都 zod parse。**zod 默认会 strip 未在 schema 声明的字段**——
所以加新 Question 字段必须**同步加 zod schema**，否则数据被吞。

## 答题结算流程

```
Panel onFinish() →
GameShell 算 XP/速度/hints →
submitAttempt() in db/service.ts →
  写 attempts 表 +
  更新 mastery (Elo) +
  错题进 mistakes (如果错) +
  返回 AttemptResult →
GameShell 显示结算 chip +
触发 next 题
```

错答处理（v0.30.7+）：
- 1st 错答 → 显示讲题入口"小进姐姐讲一讲"
- 用户讲完 → 进 retry，**给一道同 skill 同难度但不同 question_id 的变式题**
- 2nd 答对 → tutor-assisted（XP × 0.5、Elo actual=0.5）

## 调试常用

```bash
# 找一道题走的是哪个模板
grep "DOT_DEMO_PARALLELOGRAM" src/content/   # 找 def
# 然后看 play_as / game_type / question_format / dot_grid 字段
```
