# Home Daily Quest 重设计 — 3 个方向

**Trigger**: Bruce directive (2026-05-19):
> "现在主页的所有这些 tab、所有这些内容，确实都应该重新思考一下。我们加的东西太多了。"
> "考虑一下游戏的这个界面设计，怎么让用户很快地可以找到自己想要的东西。Daily Quest，
>  然后怎么有一个自己的整体地图，有一个汤后这样的一个概念；我们怎么去让它看起来这个游戏化的程度更高。"
> "之后我们再加新的模块，我们也知道我们的这个组的结构可以在哪些地方再去扩展。"

**核心 directive 提取** (4 个):
1. **Daily Quest** 概念 (今日 3 主任务, 类似 MMO/手游 daily)
2. **整体地图 / 汤后概念** (overarching framework, 让 Selena 有"我在哪个 part of world" 感)
3. **游戏化程度更高** (现行偏 productivity dashboard)
4. **模块扩展槽位** (清晰知道新功能挂哪)

**目标用户**: Selena, 10 岁, G4B, 数学受挫. 跑 mobile / iPad 居多.

**现行 Home 数据** (基线对比):
- 27 interactive 元素 / 23 emoji / 70 行 / 505 字 (mcp Preview 实测)
- 7+ entries in 今日 tab (基本功 / 今日挑战 / 知识点复习 / 闯关赢星 / 期末备考 / 学期进度 + 顶部段位卡)
- 3 tab nav (闪电口算 / 今日挑战 / 驯龙营)
- "主线 / 辅线" 不清晰

---

## Direction 1: Daily Quest Hub (Duolingo-style)

**核心 mental model**: 一天 = 1 个 Quest. Quest = 3 个 sub-task. mascot 是任务 guide.

```
┌─────────────────────────────────┐
│  Cadet's Elevate · 数学         │     ← 顶部 brand 极小
│  ⬢ 你好 Selena!                │
├─────────────────────────────────┤
│                                 │
│       🐼  小进                  │     ← Mascot 大占位 (情感)
│        ↓                        │
│   今日 Quest                    │     ← 大标题
│                                 │
│   ▰▰▰▱  2/3 完成               │     ← 单个进度环
│                                 │
│   ┌──────────────────────┐      │
│   │ ✅ 今日挑战 (10/10)  │      │     ← 卡片 1 — 已完成 (绿)
│   ├──────────────────────┤      │
│   │ ⚔️ 错题驯龙 (1/3)    │ →   │     ← 卡片 2 — 进行中 (紫)
│   ├──────────────────────┤      │
│   │ ⚡ 基本功 (待开始)   │ ▶   │     ← 卡片 3 — 待开始 (灰)
│   └──────────────────────┘      │
│                                 │
│   完成全部解锁: 🎁 1 个新装扮   │     ← 完成激励 (单一)
│                                 │
├─────────────────────────────────┤
│  📊 进步地图 →  🏛️ 段位 → 👤    │     ← 二级入口在底部小 chip
└─────────────────────────────────┘
```

**模块扩展槽位**:
- 新练习功能 → 加进 Quest sub-task pool, 系统按 user mastery + 时间分配 3 个/天
- 新奖励 → 加进"完成全部解锁"池
- 新数据视图 → 加进底部 chip 区

**Pros**:
- 极简, 选择困难症消失 — 一天就这 3 件事
- mascot 真正成为 "guide" 不只是装饰 (P1-3 fix)
- 全 quest 完成的"礼物盒"反馈强 — 单一明确目标
- 类比验证: Duolingo 主屏就是这样

**Cons**:
- 失去现行 "段位 / XP / 学期进度" 的视觉锚点 (Selena 喜欢看自己段位升)
- "3 个 quest" 是 hard-coded — 周末想多练时无 affordance
- 期末冲刺 / mock_exam 这种"集中训练"模式难 fit 这个 frame

**Risk**: 中. 改动大 (重写 Home), 但每个组件已存在.

---

## Direction 2: World Map (Prodigy / Pokemon GO style)

**核心 mental model**: 地图 = 数学世界. Mascot 在地图上走, 每个 unit 是 1 个建筑.

```
┌─────────────────────────────────┐
│  🗺️ 和平街数学世界  · 下册       │     ← 地图主题
├─────────────────────────────────┤
│                                 │
│   🏫       🌉                   │
│   小学    桥梁                  │     ← 1 节点 = 1 unit
│  (起点)  (小数+−)               │
│      \  /                       │
│      🏛️ ★★☆                   │     ← 当前位置 + 完成度
│     图书馆                      │     ← 知识点复习 (mistakes)
│    (复习屋)                     │
│      |                          │
│      🏪 ★☆☆                    │
│     小数乘法                    │     ← 当前 active unit
│    [▶ 进入]                     │
│      |                          │
│   🌫️ 神秘塔 (锁)               │     ← 未解锁 unit
│      |                          │
│   🏰 期末城堡                  │     ← 期末备考 = boss
│                                 │
│  ↓ 滑动看上层 ↑                 │     ← 整张地图可滚动
│                                 │
├─────────────────────────────────┤
│  🐼 小进在图书馆里  ·  💎 灵感 12│     ← Mascot 实时位置
└─────────────────────────────────┘
```

**模块扩展槽位**:
- 新练习功能 → 地图加 1 个新建筑 (e.g. 基本功 = 体育馆, 错题驯龙 = 训练场)
- 新 unit → 自然加节点
- 新奖励 → 跟节点解锁强绑定 (走到 X 建筑解锁 Y)

**Pros**:
- 最高游戏化感 — 整个 app 是一个 "world"
- 地理 metaphor 强, "我现在在小数乘法" 比 "我现在在 mode=skill" 直观 N 倍
- 跟 Atelier 沙箱可统一 (Atelier = 旁支 zone)
- 模块扩展极清晰 — 新功能 = 新建筑

**Cons**:
- 实现工程量最大 (新 World Map 组件 + 节点 + 路径动画 + Mascot 位置 sync)
- 跟现有 unit unlock 系统融合需要重写
- iPad 横屏跟手机竖屏布局差异大
- "今日 quest" 概念会变弱 — 用户进 map 后失去"今天该做什么"线索

**Risk**: 高. 跟整个 product 现状 disruptive 大.

---

## Direction 3: RPG Dashboard 精简版 (现行优化版)

**核心 mental model**: 保留现行结构, 砍掉 60% 内容, 强化 1 个主 CTA.

```
┌─────────────────────────────────┐
│  🐼 你好 Selena! Lv 1 · 193 XP  │     ← 顶部 hero 减半 (无段位文案)
│  ▰▰▱▱▱  到下个段位还差 1807    │
├─────────────────────────────────┤
│                                 │
│   ┌──────────────────────┐      │
│   │  ▶ 开始今日挑战       │      │     ← 主 CTA — 巨大唯一按钮
│   │  7/10 题 完成        │      │
│   └──────────────────────┘      │
│                                 │
│   ┌──────┬─────────┬───────┐    │
│   │ ⚔️    │  ⚡      │  🎫   │    │     ← 3 个 secondary equal chip
│   │错题  │ 基本功  │ 1 张  │    │
│   │1/3   │  未开练 │ 请假  │    │     ← (freezeTokens 显示)
│   └──────┴─────────┴───────┘    │
│                                 │
│   ─────── 更多 ─────────────    │     ← 折叠抽屉
│   📝 期末冲刺                  │
│   🗺️ 学期进度  5/6 单元        │
│   🏆 已得勋章                  │
│                                 │
├─────────────────────────────────┤
│  闪电口算 · 今日挑战 · 驯龙营   │     ← 现行 3 tab nav
└─────────────────────────────────┘
```

**模块扩展槽位**:
- 新主要练习 → 进 "secondary 3 chip" 行 (4 个 chip 可接受)
- 不重要的统计 / 入口 → 进 "更多" 抽屉
- 新奖励 → 进 hero 区角标

**Pros**:
- 跟现行最近, 风险最低
- 主 CTA 唯一明确 (P1-7 fix)
- 渐进式 — 可以增量切换, 不需要 big bang
- freezeTokens 等新 feature 有自然位置 (chip 行)

**Cons**:
- 不够 disruptive — 没真正解决"60+ 版本累积复杂度"
- "更多" 抽屉是 escape hatch — 时间长会再次堆满
- 游戏化感 ≈ 现行水平 (现行就是 RPG dashboard)
- Bruce directive "汤后概念 / 整体地图" 没体现

**Risk**: 低. 主要是删/折叠现有元素, 不加新组件.

---

## 对比 Matrix

| 维度 | D1 Daily Quest Hub | D2 World Map | D3 Dashboard 精简 |
|---|---|---|---|
| 游戏化感 | 中 (主屏强 quest 感) | **高** (整 app 是 world) | 低-中 (dashboard) |
| 选择困难 fix | **强** (3 个 quest 清晰) | 中 (建筑多了仍有选择) | 中 (主 CTA 唯一) |
| Daily Quest 概念 | **完美 fit** | 弱 (地图模式淡化日历) | 中 (主 CTA = 今日挑战) |
| 整体地图概念 | 弱 | **完美 fit** | 弱 ("更多" 抽屉只是分类) |
| 模块扩展性 | 中 (quest pool) | **强** (新建筑) | 中 (chip row + 抽屉) |
| 实施成本 | 中 (重写 Home) | **高** (新 component + animation) | **低** (删 + 折叠) |
| 跟现行段位 / Mascot 兼容 | 强 (Mascot 主位置) | 强 (Mascot 在地图上) | 强 (Mascot 在 hero) |
| 一周后 novelty 衰减 risk | 中 (quest 重复) | 低 (地图慢慢解锁有惊喜) | 高 (dashboard 看腻) |

---

## 我的 take + 推荐

**Bruce directive 强调 "整体地图 / 汤后概念 / 游戏化程度更高 / 模块扩展槽位"** — 这 4 个全指向 **D2 World Map**.

但 D2 实施成本最高 + risk 最大. 渐进路径建议:

**Phase 1 (next 1-2 iter): D3 + freeze chip** — 先砍现有 Home 60% 内容 + 加 freeze 显示, 把 page 整理干净. **不需要新组件**.

**Phase 2 (next 3-5 iter): D1 改造** — 把 Phase 1 的"主 CTA"扩成 "今日 3 quest" 模型. mascot 上来当 guide. 现行段位放进底部 chip.

**Phase 3 (next 5-10 iter): D2 转化** — 当 quest 模型稳定后, 把现行 unit unlock + atelier 转成地图节点. Mascot 移到地图上走. 这是最大改动.

→ **本 sprint 推荐 D3 phase 1**: 删 + 折叠 + 加 freeze chip. **下次给 Bruce 看视觉效果决定后续**.

或者 Bruce 选择直接 jump D1 / D2 — 我相应 ship 不同的下一 iter.

## 待 Bruce 决定

1. **方向选择**: D1 / D2 / D3 / 渐进 D3 → D1 → D2 ?
2. **Mascot 角色**: 装饰 / guide / 战友 ? (D1 倾向 guide, D2 倾向战友)
3. **现行段位** (school/district/city/...) 在新 home 的位置: 顶部 hero / 底部 chip / 移到 "我的" tab ?
4. **fluency (闪电口算)**: 算 daily quest 一员, 还是独立 entry?
5. **mock_exam / 期末备考** 入口: daily quest 中临时 surface, 还是独立 "考试" tab?

---

## next iter 默认 plan (若 Bruce 没回话)

如果 Bruce 没特别 directive, 下轮我默认开始 **D3 phase 1**:
- 删 Home 今日 tab 内的 "学期进度" / "闯关赢星" (move 到 "更多" 抽屉)
- 加 freezeTokens 显示 chip
- 加大 "今日挑战" 主 CTA
- 视觉 declutter

这是低风险、渐进式、立即 ship 的 step.

Sprint B (P0-5 前置降级) 跟 home redesign 是并行 work — 不冲突. 我会下一轮接着 ship.
