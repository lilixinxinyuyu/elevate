# Iter 36 P1-1 改错挑战 (Mistake Hunt) 设计稿 — 整合 review

> Selena 43% master plan P1-1. 训练"校验答案"元认知 — Selena 看错号 / 跳步 / 漏检的根因.
> 设计名: **改错挑战** — 跟小学数学课本"改错题"对齐, 中文教育常规题型.

## 目标

展示**已完成的计算** (含一处故意错误), 让 Selena 点出错的那一步. 这是数学课本的"改错题"形式. 训练:
1. 校验意识 (看完结果要回查)
2. 错误类型识别 (进位漏 / 错号 / 计算错)
3. 元认知 ("做题人"→"批改人" perspective)

## v1 题型 (review 整合: 砍掉应用题)

### 题型 A: 竖式找错 (主推)
```
   312
 ×  47
-------
  2184     (步骤 1: 312 × 7 = 2184 ✓)
 12480     (步骤 2: 312 × 40 = 12480 ✓)
 14444     (步骤 3: 加和错 — 真实 14664)
=======
```
点错的步骤 → 答对 +15 XP. 错一次最高降 +5, 再错降 +1 (递减奖励, 不倒扣).

### 题型 C: 单位换算找错 (固定题池)
```
2 小时 = 120 分钟  ✓
3 米 = 300 厘米  ✓
1 千克 = 100 克   (错! 应该 1000)
```
点错的那行 → +15. v1 硬编码 10-15 道, 覆盖小学常见单位换算 (元/角/分, 米/分米/厘米/毫米, 千克/克, 时/分/秒).

### 题型 B (应用题找错) — Defer 到 v2
review 共识: 应用题"第 3 步错 → 第 4 步必然错" 判定歧义大, v1 不做.

## 评分规则 (重要 — 没有负 XP)

| 状态 | XP |
|---|---|
| 第 1 次点对 | +15 |
| 第 2 次点对 (前一次点错) | +10 |
| 第 3 次点对 | +5 |
| 全错 (用尽尝试) | 0 |
| 提示用了 | 最高 -2 (不倒扣本题已得分) |
| 跳过 | 0 |

**绝不倒扣已有 XP** (review 共识: 防 rage-quit).

## "找第一处错" 规则 (review 共识)

判定逻辑: 只认**第一处错误**. 如果题里有"算式错 → 答案也跟着错", 第一处错的是算式行, 答案行不算 bug. UI 文案明确: "找出第一处算错的地方".

## UI 设计

### 入口
1. 数学 home 加按钮 "🛠️ 改错挑战" (跟"练习/速算/闯关"并排)
2. 练习结束页 / 错题页弹温和提示 "刚才那道题不太理想, 来当 5 分钟小老师改改错?" (review 共识: 错题后自然连接)

### 路由
`/math/find-mistakes` (英文 path, 避免特殊字符)

### 页面 (5 题 session)
```
🛠️ 改错挑战 (3/5)
准确率: 2/2 (前两题一发命中)
─────────────────────────

312 × 47 = ?

她写的:
┌──────────────────────┐
│    312               │  [行 1]
│  ×  47               │  [行 2]
│ ─── (横线)            │
│  2184                │  [行 3]
│ 12480                │  [行 4]
│ ─── (横线)            │
│ 14444                │  [行 5]
└──────────────────────┘

🔍 找出第一处算错的地方:

[ 行 1 ]  [ 行 2 ]  [ 行 3 ]  [ 行 4 ]  [ 行 5 ]

[💡 提示] [跳过本题]
```

### 命中反馈 (review 强调)
点对 →
- 划掉错的数字, 旁边绿字标正解
- 简短解释: "14444 ❌ → 14664 ✅ (加和漏进位了!)"
- "+15 XP" floater
- 2 秒后自动下一题

点错 → 卡片轻微 shake + 提示 "再看看, 这一行没问题"

## 实现拆分

### 新文件
- `src/core/mistakeHuntPolicy.ts`:
  - `generateVerticalMultiplyBug(a, b)`: 生成竖式 + 故意一处错 (3 类: carry_missed / sum_wrong / partial_product_shift)
  - `generateUnitConversionBug(seed)`: 固定题池随机抽
  - `BugType`, `BugCard` interfaces
- `src/pages/MistakeHunt.tsx`: 主页面, 5 题 session, 进度 + 总结
- `src/components/mistakeHunt/BugCardVertical.tsx`: 竖式 + 高亮 + 可点行
- `src/components/mistakeHunt/BugCardUnit.tsx`: 单位换算列表 + 可点行
- `src/components/mistakeHunt/SessionResult.tsx`: 总结页 (5 题正确率 + Re-do 按钮)
- `tests/mistakeHuntPolicy.test.ts`: bug generation + 第一错判定

### 修改
- `src/router.tsx`: 加 `/math/find-mistakes` lazy 路由
- `src/pages/Home.tsx` (或 Math index): 加 "🛠️ 改错挑战" 入口按钮
- `src/lib/featureFlags.ts`: `isMistakeHuntV1` flag (default ON)
- (可选) `src/pages/Mistakes.tsx`: 错题页底部加 "改错挑战" 入口

### Out of scope
- LLM 生成精微 bug (v2)
- 应用题找错 (v2 — review 共识 defer)
- Mastery 集成 (mini-game 独立, 仅算 daily XP)
- 跨 session leaderboard

## 设计已 lock 的决策 (双家共识, 不再讨论)
- 5 题/session
- 题型 A + C, 不做 B
- 不倒扣 XP, 递减奖励 +15/+10/+5
- "找第一处错" 判定
- 独立 mini-game, 不污染 mastery/streak
- 命中反馈必须有"划掉错+绿字标正+解释"
