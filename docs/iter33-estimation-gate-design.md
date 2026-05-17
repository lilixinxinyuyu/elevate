# Iter 33 P0-1 EstimationGate 设计稿 (送预审)

> 起源: Selena 43% 期中事件 master plan 的 P0-1. peer review 改良: 不问"几位数" (易盲猜), 改 "四舍五入估算法" + 数轴/卡片 UI.

## 目标

强制 Selena 在做多位数计算 / 应用题前, 先经历"估算" 元认知步骤. 训练:
1. **数量级感** (这答案应该是十/百/千/万)
2. **四舍五入** (把 312 看作 300, 把 47 看作 50)
3. **估算验算** (300 × 50 = 15000, 所以真答案在万级)

## 触发条件 (requiresEstimation heuristic)

题目同时满足以下任一即触发:
- `q.answer.type === "number"` AND
- `!isSpeedEligible(q)` (复杂题, 已有 P0-0b 的 heuristic) AND
- 满足下列复杂度门槛之一:
  - 数字最大位数 ≥ 3
  - 含除法 (÷ 或 /)
  - 多运算符 (opCount ≥ 2)
  - 题面 ≥ 30 字 (应用题)

显式 metadata 覆盖: `q.requiresEstimation?: boolean` (新加 optional 字段, 跟 `speedEligible` 一样).

Feature flag: `estimation_gate_v1` (default ON, URL ?est_gate=off 可关).

## 三阶段 UI

### Phase 1: Round (四舍五入)
显示题面 + 提取关键数字, 让 Selena 输入四舍五入近似值:

```
题: 312 × 47 = ?

第一步: 估算前先简化
   把 312 看作 [ 300 ]   ← 数字输入框 (按千/百/十凑整)
   把 47  看作 [ 50  ]   ← 数字输入框
   
   [ 提示 ] [ 下一步 ]
```

**验证**: 接受任何在 "理想 round" 邻域 ±25% 内的值. 例: 312 理想四舍 = 300, 接受 [225, 375]. 47 理想四舍 = 50, 接受 [37, 62].

**XP**: 答对 +5 (Phase 1 完成).

### Phase 2: Compute (近似计算)
自动带入 Phase 1 的值, 让 Selena 算近似积:

```
第二步: 算近似答案
   300 × 50 = [        ]   ← 数字输入框
   
   提示: 3×5=15, 然后补上 (3+1) 个 0
   
   [ 下一步 ]
```

**验证**: 必须匹配她自己 Phase 1 输入的两个值的乘积 (±10% 容差).

**XP**: 答对 +5 (Phase 2 完成).

### Phase 3: Magnitude (数量级)
最后让她选答案的"数量级":

```
第三步: 最终答案大约在
   [ 几十 ]  [ 几百 ]  [ 几千 ]  [ 几万 ]
   
   你估算的 (15000), 在哪一档?
```

**验证**: 必须匹配她 Phase 2 答案的数量级.

**XP**: 答对 +5 (Phase 3 完成). 三个 phase 全对额外 +5 streak bonus = 共 +20.

### Phase 4: Reveal + 真答案
完成估算后, 实际题目展开, 进入正常 answer input. 现在她带着"答案应该在万级 + 15000 附近" 的预期去算.

如果真答案明显不在数量级 → UI 高亮提示 "你的答案 X, 跟估算的 Y 数量级不同, 检查一下?"

## 数据流

```
GameShell
  └─ resolveTemplate(q)
        ├─ if requiresEstimation(q) AND isEstimationGateV1() → 'estimation_gate'
        └─ else → 现有逻辑
  └─ EstimationGatePanel  ← 新组件
        ├─ Phase 1 input
        ├─ Phase 2 input
        ├─ Phase 3 magnitude cards
        └─ onComplete(estimationXP) → 展开真 question → 现有 PlainNumeric/etc
```

Estimation XP 走独立 scoring (不计入 ScoreDelta 的 timeBonus, 单独累计).

## 实现拆分

### 新文件
- `src/core/estimationPolicy.ts`:
  - `requiresEstimation(q): boolean` (heuristic + explicit)
  - `roundToOrderOfMagnitude(n): number` (312 → 300)
  - `magnitudeBucket(n): "ones"|"tens"|"hundreds"|"thousands"|"tenThousands"|"hundredThousands"`
  - `extractNumbers(stem): number[]` (从题面提取数字, 用于 Phase 1 显示)
- `src/components/game/templates/EstimationGate.tsx`: 三阶段 wrapper

### 修改
- `src/core/types.ts`: Question 加 `requiresEstimation?: boolean`
- `src/core/schema.ts`: 同上
- `src/components/game/templates/resolve.ts`: applyP0Policies 加 estimation gate 路由
- `src/components/game/GameShell.tsx`: render switch case 加 estimation_gate
- `src/lib/featureFlags.ts`: `isEstimationGateV1()`
- `tests/estimationPolicy.test.ts` (NEW): heuristic + round + magnitude
- `tests/estimationGate.test.tsx` (NEW): 三阶段流程

## 跟现有系统的兼容

- 不破坏现有 attempt schema (estimation XP 算独立 attempt? 还是 sub-step?)
  → 决定: estimation step **不存为独立 attempt**, 只在 session-local state 累计 estimation XP, 完成后跟真 answer attempt 一起入库 (scoreDelta 加一个 estimationXP 字段)
- 不破坏现有 Train flow: EstimationGate 内部完成后 onComplete 触发 setShow(true) → 展开真 question, GameShell 正常 timer/answer 流

## 设计决策需要预审验证

1. **触发门槛是否合适**? (数字 ≥ 3 位 OR 除法 OR 多 operator OR ≥ 30 字)
2. **三阶段是否过冗长**? (1-2 分钟一题, Selena 会不会嫌烦?)
3. **Round 容差 ±25%** 合适吗? 还是应该更宽松 / 更严?
4. **Magnitude 卡片** 4 档 (十/百/千/万) 够吗? 还是要 5 档加 "十万"?
5. **三 phase 全对 +20 XP** 是否过高/过低?
6. **数量级不一致警告** 是 hard block (不让提交) 还是 soft nudge (允许但提示)?
7. **Performance**: estimation 加 30-60 秒/题, Selena 一天答题量会从 50 → 30, 总训练量减少, OK 还是要补回?
8. **缺什么 corner case**? (除法估算特别难 — 312 ÷ 47 估算应该用什么策略?)

## 风险

- **过度抑制流量**: 估算后真题再花 1-2 分钟, 每道题翻倍, Selena 可能从积极→抗拒. 缓解: 默认 ON 给 Selena, Bruce 等其它 cadet 默认 OFF.
- **估算输入打字慢**: 10 岁打字 30 字/分钟, 3 个数字输入 ≈ 10 秒. 缓解: 提供 "+10 / +100 / +1000" 按钮快捷加减.
- **Selena 学会蒙估算**: 如果 Phase 1 容差 ±25% 太宽, 她可能瞎填. 缓解: 提示具体策略 "看百位四舍五入".

## Out of scope (留给后 iter)
- 除法估算的"商首位法"教学 — 这是 P1-3 单位换算 + 五年级除法的事
- 估算历史 dashboard — P1-4 Brainpower Radar 里
- 估算 OCR vs 真答案对比 — P2-3 试卷 OCR
