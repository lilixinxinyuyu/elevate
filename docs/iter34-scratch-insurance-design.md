# Iter 34 P0-2 ScratchInsurance 设计稿 (送预审)

> 起源: Selena 43% 期中事件 master plan P0-2. 预审 Gemini/GPT 共识: 不要硬强制写 N 字符 (易反抗), 改"软锁/草稿险": 用了草稿且答错 → 免扣分; "我已心算确认" 每日 3 次配额.

## 目标
鼓励 Selena 在复杂题写草稿 (减少 working memory overload), 但不强制. 让"写草稿" 变成"保险" (写了答错免扣 + 中性 XP), "心算"变"赌一把" (答对一切照常, 答错 +正常扣).

## 触发条件 (requiresScratch heuristic)

- `q.answer.type === "number"` AND
- !isSpeedEligible(q) AND
- 复杂度 (与 EstimationGate 触发类似, 但更宽松):
  - 数字最大位数 ≥ 2 (≥10 就建议写草稿)
  - OR 多 operator
  - OR 应用题 (story / multistep)
  - OR difficulty ≥ 3

显式 metadata: `q.requiresScratch?: boolean` 覆盖 heuristic (跟 speedEligible / requiresEstimation 一致).

Feature flag: `scratch_insurance_v1` (default ON).

## UI 设计

### 工具栏 (在 Answer Panel 旁边或上方)

```
🛠️ 解题工具 (可选)
┌──────────────────────────────────────────────┐
│ [📝 写草稿]  [📐 列竖式]  [🧠 心算 (今日还有 2/3)] │
└──────────────────────────────────────────────┘
```

(GPT 提议的"控制感" 设计 — 让 Selena 选自己的解题工具)

### "写草稿" 选了之后 → 展开

```
┌─ 草稿区 (随便写, 不评分) ─────────────────┐
│                                            │
│   [文本框 or canvas]                       │
│   预设竖式底纹 (Gemini 提议: 降低书写门槛)  │
│                                            │
└────────────────────────────────────────────┘
✓ 用了草稿就有"草稿险": 即使答错, XP 不扣
```

文本输入或简单 canvas 涂写都接受. v1 用 textarea + 等宽字体 + 网格背景 (CSS) 让她可以打竖式. v2 加 canvas (用手指/笔写).

### "心算" 选了之后 → 倒计时 + 确认

```
🧠 心算挑战!
你今天还有 2 次心算配额. 心算答错按正常扣分.
[ 继续心算 →  ]  [ 改用草稿  ]
```

点确认后, 该次 attempt 标 `scratchOverride: true`. 答对一切正常, 答错正常扣分 (没保险).

### 默认状态 (不选工具)

不选任何工具直接答, 视为"心算 (不消耗配额)" — 答对正常, 答错正常扣. 这是"默认放任" 模式.

### XP 调整规则 (与 Reverse Reward 整合)

| 状态 | 答对 | 答错 |
|---|---|---|
| 用了草稿 | 正常 XP | **XP 不扣 (insurance)** + "+草稿险" 提示 |
| 用了心算 (配额内) | 正常 XP | 正常扣 + "心算挑战失败" 提示 |
| 没选工具 (默认) | 正常 XP | 正常扣 |
| 心算配额用完 | 正常 XP | 正常扣 (无保险) |

## 数据流

```
GameShell (P0-1 EstimationGate 已完成 / 跳过)
  └─ if requiresScratch(q) AND flag ON:
        ├─ render ScratchToolbar (3 buttons)
        ├─ if "write scratch" picked → expand ScratchInput
        ├─ if "vertical column" picked → expand VerticalScratchInput
        ├─ if "mental confirm" picked → confirm dialog + decrement quota
  └─ TemplatePanel (现有 answer input, 旁边 / 下方)

handleFinish:
  └─ if scratchUsed && !isCorrect → bypass XP penalty (set isInsuredWrong=true)
  └─ telemetry: attempt.metadata.scratch = { tool, charCount, overrideUsed, insured }
```

## 实现拆分

### 新文件
- `src/core/scratchPolicy.ts`:
  - `requiresScratch(q): boolean` heuristic + explicit
  - `getMentalCalcQuotaToday(): number` (3 默认)
  - `useMentalCalcQuota(): void` (decrement)
  - `canUseMentalCalc(): boolean`
- `src/components/game/ScratchPanel.tsx`: toolbar + 展开区
  - 3 个按钮: 写草稿 / 列竖式 / 心算确认
  - 展开的 textarea (等宽 + grid background)
  - 心算确认 dialog

### 修改
- `src/core/types.ts`: Question 加 `requiresScratch?: boolean`; Attempt.metadata 加 scratch sub-field
- `src/core/schema.ts`: 同上
- `src/components/game/GameShell.tsx`: ScratchPanel 集成 (在 EstimationGate 完成后渲染); insured-wrong bypass XP
- `src/db/service.ts`: AttemptOutcome 加 isInsuredWrong flag; submitAttempt 接受 scratch metadata
- `src/pages/Train.tsx`: 转发 scratch state 给 submitAttempt
- `src/lib/featureFlags.ts`: `isScratchInsuranceV1()`
- `tests/scratchPolicy.test.ts` (NEW): heuristic + quota
- `tests/scoring.test.ts`: 加 insured-wrong case

### Out of scope
- Canvas / 手写 OCR (留 v2)
- 草稿内容 LLM judge "她写得对吗?" (留 P1-4 Brainpower Radar 一起)
- 草稿可视化 dashboard (留 P1-4)

## 设计决策需要预审验证

1. **触发门槛是否合适**? 是否所有 ≥ 2 位数都该提供 ScratchPanel? 还是仅 ≥ 3 位?
2. **3 个工具按钮** 是不是太多, 应该简化为 [写] vs [心算] 二选一?
3. **草稿险 = 全免扣分** 是不是太宽松? Selena 可能学会"写一行就免扣"刷分? 是否应该额外要求 "草稿 charCount ≥ N"?
4. **心算配额 3/天** 合适吗? 太多 (没意义) 还是太少 (压抑)?
5. **跟 EstimationGate 串联** — Selena 已经做了 estimation, 现在又要选工具, UI 会不会"步骤太多"?
6. **insurance bypass XP** 是只跳过扣分 (≥ 0), 还是给基础尝试分 (1-2 XP)? 哪种鼓励效应好?
7. **缺什么 corner case**?
8. **整体方向: 立即做 / 改后再做 / 不做**?
