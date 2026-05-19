# 重新模块化设计 — 2026-05 Refactor Plan

**Status**: 进行中 (v0.35.32+)
**Trigger**: 爸爸 explicit, "因为现在你做起来也比较 sloppy, 我感觉有个原因是模块太多了, 有时候改了这里忘了那里的. 项目从开始到现在迭代了几百次了, 现在过了这么久了肯定有很多地方都松散了, 可能是时候重新架构重新模块化设计了."

## 痛点 — AI 改一处忘一处

每一轮 AI 改 GameShell/Train/timing/scheduler 都需要同时改 ≥3 个文件, 漏一个就 bug:

| Pattern | 散落文件数 |
|---|---|
| `play_as === "canvas_scratch" \|\| play_as === "multi_step_application"` | 3+ (Train + timing + GameShell) |
| `requiresScratch \|\| requiresMultiStep` | 同上 |
| `templateId !== "canvas_scratch"` (suppression) | 2 处 GameShell |
| `targetCount` / `baseTarget` (今日挑战 10 道) | scheduler + Home (上轮漏 Home 导致 17 题 bug 重现) |
| feature flag (`isMultiStepAppV1` 等) | ~25 调用点 |
| GameTemplate 列表 | resolve.ts MAP + GameShell switch × 3 + 各处 if |

## Peer Review 共识 (Gemini-3-pro + GPT-5.5)

两边独立 review 后**完全一致**指向同 3 个 ROI Priority:

### Priority 1: GameTemplate Capabilities 注册表 (本轮做)

将散落的 `play_as === ... || requiresScratch === true || ...` 抽到单一 SSOT:

```ts
// src/games/templateCapabilities.ts
export type GameCapabilities = {
  writeHeavy: boolean;          // 倒计时跳过 + 时间 ×2.5
  hasBuiltInCanvas: boolean;    // 不叠加 ScratchInsurance / ScratchPanel
  scoreByStepsNotSpeed: boolean; // 不显示速度档位
};

const TABLE: Partial<Record<GameTemplate, Partial<GameCapabilities>>> = {
  canvas_scratch: { writeHeavy: true, hasBuiltInCanvas: true },
  multi_step_application: { writeHeavy: true, hasBuiltInCanvas: true, scoreByStepsNotSpeed: true },
};

// src/games/questionCapabilities.ts
export function getQuestionCapabilities(q: Question): GameCapabilities;
```

**效果**: 新增 write-heavy 模板时, 改 1 个表 ≠ 改 4 个文件.

### Priority 2: SSOT 常量 + 配置驱动 (下轮做)

- `src/config/constants.ts` — `DAILY_CHALLENGE_TARGET = 10` (终结 scheduler / Home 不同步)
- Discriminated unions + `assertUnreachable(template)` exhaustive switch 让 TS 编译时拦"加新模板忘加 case"

### Priority 3: SEED hash + Feature flag registry (再下轮做)

- Vite plugin: 编译时 MD5 SEED_QUESTIONS → 不一致 fail build (终结 SEED_VERSION 忘 bump)
- `defineFlag` 注册表 + ESLint 拦截散落的 `isXxxV1()`

## 本轮 (v0.35.32) 执行: Priority 1

### 改动文件

- 新建 `src/games/templateCapabilities.ts` — capabilities table
- 新建 `src/games/questionCapabilities.ts` — 题级 helper
- 改 `src/core/timing.ts` — isWriteHeavy 改用 getQuestionCapabilities
- 改 `src/pages/Train.tsx` — countdownEnabled 改用 getQuestionCapabilities
- 改 `src/components/game/GameShell.tsx` — ScratchInsurance / ScratchPanel suppression 改用 capabilities

### 验收

- typecheck pass
- build pass
- Preview 验 canvas_scratch 题: 没倒计时 + 没 ScratchInsurance dialog + 没 ScratchPanel + 没速度档位
- Preview 验 multi_step_application 题: 同上
- Preview 验 普通题 (plain_choice / speed_match): 倒计时正常 + 速度档位正常

### 验证后

- commit v0.35.32 "Priority 1 refactor: template capabilities SSOT"
- 继续 autonomous loop 进入 Priority 2

## 持续 Loop

cron `2ba238c2` 每 30 min 一个 iter. 标准 workflow:
1. git pull --rebase
2. 选 1 highest-leverage issue
3. 实现 + typecheck + build
4. **mcp__Claude_Preview__ visual verify** (不能跳)
5. peer review proxy 8787/8788 (decision 较大时)
6. commit + push 递增 version
7. (cron 自动 fire 下轮)

终止: 仅 user explicit "停".

## 进度日志 (2026-05-18 → 19, 20 iters)

| Priority | Version | 内容 | LOC 影响 |
|---|---|---|---|
| P1 | v0.35.32 | GameTemplate Capabilities SSOT (templateCapabilities + questionCapabilities) | +140 −56 |
| P2 | v0.35.33 | SSOT 常量 (config/constants.ts) DAILY_CHALLENGE_TARGET 等 | +51 −7 |
| P2.5 | v0.35.34 | exhaustive switch + assertUnreachable + 补 plain_numeric/dot_grid_draw title | +22 −96 |
| P3 | v0.35.35 | scripts/check-seed-bump.mjs (build gate) | +98 |
| P4 | v0.35.36 | GameErrorBoundary + exhaustiveOr soft fallback (Gemini HOTFIX) | +171 −31 |
| P5 | v0.35.37 | GAME_TEMPLATES `satisfies` registry | +54 −61 |
| P6 | v0.35.38 | defineFlag factory (13 flag, 283→174 LOC) | +120 −229 |
| P7 | v0.35.39 | src/lib/routes.ts URL SSOT (TrainRoute/MockReportRoute) | +124 −13 |
| P8 | v0.35.40 | scripts/check-content-schema.mjs (cross-ref gate) | +142 |
| P7.5 | v0.35.41 | Train.tsx parser → TrainRoute.parse | +20 −18 |
| P9 | v0.35.42 | rename hasBuiltInCanvas → suppressesExternalScratchTools | +20 −16 |
| P10 | v0.35.43 | src/games/ → src/core/ (反向依赖 cleanup) | +9 −9 |
| P11 | v0.35.44 | storage.ts SSOT + 2 HOTFIX (routes integer, GAME_TEMPLATE_IDS) | +113 −41 |
| P12 | v0.35.45 | scripts/check-db-schema.mjs (Dexie migration gate) | +121 |
| P13 | v0.35.46 | routes union validate (SESSION_MODE_IDS, ATELIER_REALM_IDS) | +39 −6 |
| P14 | v0.35.47 | 抽 templateRegistry.tsx (GameShell -83) | +101 −90 |
| P15 | v0.35.48 | 抽 feedbackLabels.ts (GameShell -38) | +92 −46 |
| P16 | v0.35.49 | 抽 answerDescribe.ts (GameShell -30) | +51 −34 |
| P17 | v0.35.50 | 抽 RetryHintPanel.tsx (GameShell -71) | +91 −75 |
| - | v0.35.51 | refactor 进度 doc 整理 | +44 −1 |
| P18 | v0.35.52 | 抽 FeedbackPanel.tsx (GameShell -244, 最大单步) | +269 −248 |
| P19 | v0.35.53 | 抽 templates/types.ts (TemplateRenderProps + TriggerFx + AttemptResult SSOT) | +108 −84 |
| P20 | v0.35.54 | 抽 trainComponents.tsx (StatCard / SummaryReviewTutor / MathAutoGen) | +132 −109 |
| P21 | v0.35.55 | 抽 SummaryView.tsx (Train -335, 最大单步) | +366 −342 |

**GameShell.tsx 1207 → 666 行 (−541, **−45%**, 6 步拆分: registry / labels / answerDescribe / RetryHintPanel / FeedbackPanel / types SSOT).**

**Train.tsx 920 → 482 行 (−438, **−48%**, 2 步拆分: trainComponents / SummaryView).**

**3 build gate**: check-seed-bump / check-content-schema / check-db-schema — 形成 CI 第一防线.

**5 const list satisfies enforce**: GAME_TEMPLATE_IDS / SESSION_MODE_IDS / ATELIER_REALM_IDS / GAME_TEMPLATES (registry) / 各 capability table.

**SSOT 文件**: config/constants.ts / config/storage.ts / lib/routes.ts / lib/exhaustive.ts / lib/featureFlags.ts (defineFlag factory) / core/templateCapabilities + questionCapabilities / components/game/templates/types.ts.

**ErrorBoundary + 软 fallback**: GameErrorBoundary 包 panel render + exhaustiveOr 替代 assertUnreachable 在 render path.

**新文件汇总 (21 priority 共 14 个新文件)**:
- src/config/{constants,storage}.ts
- src/core/{templateCapabilities,questionCapabilities}.ts (P10 从 src/games/ 迁过来)
- src/lib/{exhaustive,routes}.ts
- src/components/common/GameErrorBoundary.tsx
- src/components/game/{templateRegistry,feedbackLabels,answerDescribe,RetryHintPanel,FeedbackPanel}.tsx
- src/components/game/templates/types.ts
- src/pages/{trainComponents,SummaryView}.tsx
- scripts/{check-seed-bump,check-content-schema,check-db-schema}.mjs

## 后续 deferred (low priority)

- TemplateRenderProps + TriggerFx → templates/types.ts (24 file imports 改, 机械工作; P19 半解决了 — 已 SSOT, re-export 兼容)
- useScratchInsuranceState hook (state 深度 woven, 提取净值不高)
- useEstimationGate hook (同上)
- SuperAdmin.tsx 拆分 (2500+ 行, 但属内部工具)
- Train.tsx TrainPage 内部 hooks 拆分 (state 深度 woven 跟 GameShell 一样)
