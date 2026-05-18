# Iter 39 P1-4 脑力雷达 设计稿 (送预审)

> Selena 43% master plan P1-4. 最后一个 P1 件.
> 评审一致强推 — 把 iter 32-38 收集的训练数据可视化给 Selena 看, 包装成"游戏角色属性".

## 目标

3 件事并行做:
1. **脑力雷达 dashboard 主页面** — 5 个维度 radar chart + 数据卡片, Selena 可见自己的"脑力属性"
2. **错题侦探落库** (P1-1.1 defer 自 iter 36) — 把 attempt 持久化到 IndexedDB (现在只 session-local)
3. **Train state 验证** (P1-2.1 defer 自 iter 37) — 测 Train ↔ Strengthen 来回是否丢 state

## 1. 脑力雷达 dashboard

### 5 个核心维度 (像 RPG 角色属性)
| 维度 | Icon | 数据源 | 算法 |
|---|---|---|---|
| 🧠 **直觉力** (估算) | brain | attempt.metadata.estimationGate | 数量级命中率: !magnitudeMismatch / 触发数 |
| ✍️ **严谨力** (草稿) | pen | attempt.metadata.scratch | insured 题数 / 触发草稿题数 |
| 📋 **拆解力** (多步) | clipboard | attempt.metadata.multiStep | 4 步全对率: phasePass.every(true) / 触发数 |
| 🎯 **专项力** (强化) | target | attempt.metadata.strengthenSessionId + strengthenCorrectCount | 强化 session 全对率 |
| 📐 **框架力** (进制) | ruler | localStorage base_system_lesson_progress | 完成节数 / 4 |

### UI
```
🧠 脑力雷达 (本周)

[ 5 维度 radar chart - SVG 五边形, 各顶点是各维度值 0-100% ]

直觉力 ████░░░░ 50%   (10 次估算, 5 次数量级对)
严谨力 ██████░░ 75%   (用草稿 6 / 总 8 次)
拆解力 ███░░░░░ 38%   (多步 8 题, 3 题全对)
专项力 ██░░░░░░ 25%   (强化 4 session, 1 全对)
框架力 █████░░░ 50%   (进制 2/4 节完成)

[ 按时间筛选: 本周 / 上周 / 本月 ]
[ 趋势: ↑ 直觉力比上周 +10% ]
```

每维度卡片可点击 → 展开详情 (最近 10 次的具体数据).

### 路由
`/math/radar` (英文 path, AUP 友好)

### 入口
Home 加按钮 "🧠 脑力雷达" (跟其它 mini-game 并排).

## 2. 错题侦探 落库 (P1-1.1)

现状 (iter 36): session-local, 退出页面就丢. Brainpower Radar 想看历史数据没法.

修改:
- `MistakeHunt.tsx` 每完成一题, 写一条 attempt 到 db.attempts:
  ```ts
  {
    questionId: `mh-${sessionId}-${idx}`,  // 合成 ID
    skillId: card.kind === 'vertical' ? 'mistake_hunt_vertical' : 'mistake_hunt_unit',
    isCorrect: state.solved,
    elapsedSeconds: 0,  // 不重要
    scoreDelta: { total: state.earnedXp, byAbility: {} },
    isReview: false,
    comboAtEnd: 0,
    metadata: {
      source: 'mistake_hunt',
      bugType: card.bugType,
      attempts: state.attempts,
      hintUsed: state.hintUsed,
    },
    createdAt: Date.now(),
  }
  ```
- 这样 Brainpower Radar 能查到 mistake hunt 历史

注: `source=mistake_hunt` 标记跟主 train attempt 区分, 不污染 mastery/streak.

## 3. Train state 持久化验证 (P1-2.1)

现状 (iter 37): Strengthen 用 navigate('/math/strengthen?...'), navigate(-1) 回 Train. 评审 B 担心 Train state 丢.

验证 + 修复方案 (按 Train 现状):
- 现在 Train state 已经写 IndexedDB (db.sessions, db.attempts, db.meta)
- React local state (current index, retry stage, etc.) 跑 Train mount 时从 DB 恢复
- 实际上 navigate(-1) 触发 Train re-mount, 但 mount 会重新读 session + 之前 attempt → 恢复"已答到第 X 题"
- 风险: combo state 可能丢 (combo 没存 DB?)

测试方法:
1. 进入 Train, 答 3 题对 (combo=3)
2. 第 4 题答错, 看到强化挑战 CTA → 点接受
3. Strengthen 3 题完成 → 返回
4. 检查: combo 是否回到 0 (因为最后一题错), 已答 3 题是否还在?

如果 combo 丢失 / 题号重置 → 需要存 IndexedDB.

## 实现拆分

### 新文件
- `src/core/brainpowerRadar.ts`: 数据聚合算法 (query attempt.metadata, 算各维度比率 + 时间窗口)
- `src/pages/BrainpowerRadar.tsx`: 主页面 (radar chart + 5 卡片 + 时间筛选)
- `src/components/radar/RadarChart.tsx`: SVG 雷达图组件 (5 顶点)
- `tests/brainpowerRadar.test.ts`: 数据聚合算法测试

### 修改
- `src/pages/MistakeHunt.tsx`: 加 db.attempts.put (每题完成时)
- `src/router.tsx`: /math/radar 路由
- `src/pages/Home.tsx`: 加入口
- `src/lib/featureFlags.ts`: `isBrainpowerRadarV1`

### Train state 验证
- 写一个 manual E2E 步骤 (`scripts/_e2e-train-strengthen.mjs` puppeteer)
- 或者直接代码 review + 加 console.log 在 Train mount 时打印 state, 现场跑一遍

## 设计决策需要预审验证

1. **5 维度命名**: "直觉力/严谨力/拆解力/专项力/框架力" 是不是太抽象? 10 岁能 connect 到自己做了什么?
2. **radar chart SVG**: 自写 svg 五边形, 还是引入 chart 库 (recharts 等)? 项目原则尽量 0 依赖.
3. **数据聚合时间窗口**: 默认本周 (7 天) / 本月 / 全部? 哪个最有意义?
4. **错题侦探 attempt 落库**: source="mistake_hunt" + skillId="mistake_hunt_vertical/unit" 是不是会污染 skill 列表?
5. **Train state 验证方法**: 手动测试 vs 自动 E2E vs 代码 review? 时间紧不能都做.
6. **缺什么 corner case**?
7. **整体: 立即做 / 改后再做 / 不做**?
