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
