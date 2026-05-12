# P2 — 小进的星海工坊（v2 概念升级）

> **STATUS**：替代 `p2-math-city-plan.md` 的下一代概念。沙箱原则不变。
> **核心转向**：从「城市俯视图 + NPC 商店」改成「小进的工坊 + 维度传送」。Xiaojin 不再是图标，而是**主角 + 主持人**。

## 为什么放弃「数学城市」

读完原 city 方案 + 现在 codebase 后发现的硬伤：

1. **小进缺位**：城市里有 5 个 NPC（老板娘小红、收银狐 ...），Selena 跟谁建立情感纽带？分散到 5 个小角色身上不如集中到 1 个强角色（小进）。我们已经为 Xiaojin 做了**完整 3D 模型 + 5 套衣服 + 7 个手势 + 6 个表情 + lipsync + voice**，这些资产现在只在隐藏 `/math/mascot3d` 调试页能看到 — **巨大浪费**。
2. **「城市」太平庸**：动森、宝可梦、烧脑王、可汗学院……每家都做过 city。"逛街做题" 在叙事上没有梦想感。
3. **进度太线性**：原方案"玩 5/10/20 次解锁装扮"是 grind 思维，缺少**世界在成长**的感觉。
4. **题型 → 主题映射机械**：把 11 模块强塞进 5 商店有些拧巴（"钱包广场 = 单位换算" 牵强）。

## 新概念：「小进的星海工坊 / Xiaojin's Starlit Atelier」

> 小进住在一间**漂浮在星海里的魔法工坊**。工坊有一颗**星核**，可以打开通往不同**维度领域**的传送门。每个领域 = 一类数学题。Selena 是小进的**学徒 + 探险伙伴**，她们一起去各个领域冒险。

### 核心隐喻
- **工坊 ≠ 学校 ≠ 城市**。它是一个**温暖的「家」+ 神奇的「实验室」**。
- 小进既是**朋友**（聊天、表情、陪伴）也是**师傅**（讲解、指引、鼓励）。
- 数学不是"作业"，而是**穿越维度的钥匙**。

### 关键差异（vs 原 City）

| 维度 | 原 City | 新 Atelier |
|---|---|---|
| 主角 | 5 个 NPC + Selena | **小进 + Selena**，一对师徒 |
| 视觉中心 | SVG 城市俯视图 | **Mascot3D Xiaojin** 占据屏幕 60% |
| 转场 | 点地标卡片 → 直接进 session | 工坊里**打开传送门** → 维度过场 → 题目 |
| 资产复用 | 几乎为零 | 5 套衣服 + 4 个 skin 背景 + 7 个 gesture + 表情 全用上 |
| 进度可见性 | 数字"已玩 N 次" | **工坊本身在变**：装饰品 / 小番宠物 / 星核能量 |
| 长线孤本 | 收集 5 个 NPC 升级 | 探索 5-6 个 realm + 解锁 atelier 完整态 + 收齐 outfit |
| 情感钩子 | 弱（多 NPC 摊薄） | 强（一个 Xiaojin 全程陪伴 + 成长） |

## 5 个领域（V1 启动版）

| id | 名称 | 主题 emoji | 视觉 | 主 skills (G4 内) | 推荐小进 outfit |
|---|---|---|---|---|---|
| `discount-street` | 💸 折扣街 | neon 赛博集市 | 小数×小数 / 小数点移动 / 单价×数量 / 单位换算 / 分段计价 | 👧 校服（日常） |
| `chrono-tower` | ⏰ 时光塔 | 古铜齿轮 + 浮空表盘 | 路程·时间·速度 / 相遇问题 / 整数除法 | 🐱 中国风（古风时间感）|
| `gem-grotto` | 💎 宝石矿 | 水晶洞穴 | 大数 / 小数比较 / 大数四舍五入 / 数位 | 👗 白短款（探险服）|
| `geo-forge` | 🎯 几何工坊 | 蓝图绘图房 | 三角形 / 角度 / 坐标 / 三视图 | 👘 白旗袍（专业绘师） |
| `equation-hall` | 🧪 方程之厅 | 黑底悬浮符号 | 字母表示 / 解方程 / 方程应用题 / 和差倍 / 平均数 | 👗 小礼服（隆重感）|

> 第 6 个 realm（**数据宝库** 📊 — 统计/概率/平均数）放到 V2 加入。

## 三层 UX 节奏

### 层 1 — 工坊大厅（Atelier Hub）
- 上半屏：**Mascot3D Xiaojin** 在她的星空教室里 idle 摇晃 + 偶尔挥手 / 点头
- 中部：小对话框「Selena！今天想去哪个维度？」
- 下半屏：5 张**传送门卡片**（圆形 emoji + 名 + 简短描述 + 已解锁灵感数）
- 角落：工坊状态条（灵感 / 已解锁 outfit / 已点亮维度 / 小番状态）

### 层 2 — 维度入口（Realm Landing）
- 切到该 realm 的视觉皮肤（cyber-bazaar / clocktower / gemcave / blueprint / glowing equations）
- 小进**走进皮肤里**：换上对应 outfit，做个开门 gesture
- 一段 2-3 秒过场 + 小进台词："欢迎来到折扣街！"
- "开始挑战" → 跑 skill session（复用现有 `/math/train?skillIds=...`）

### 层 3 — 题目页 + 小进 PIP（in-progress）
- 题目主区 + 右下角**小进 picture-in-picture**（mini Mascot3D，约 200×200px）
- 答对 → 小进 gesture wave / thumbsUp / cheer + 表情 happy
- 答错 → 小进 gesture 微 nod + 表情 sad / confused，台词「再试一次」
- 完成 N 题 → 回工坊大厅，加灵感、解锁装饰

## 进度系统：灵感 (Inspiration) 而非 XP

```
db.meta:
  atelier::inspiration::total           // 累积灵感（never decrease）
  atelier::realm::<id>::visited         // 进过几次
  atelier::realm::<id>::completed       // 完成完整 session 几次
  atelier::realm::<id>::stars           // 星等 1-3（基于正确率）
  atelier::unlocks::decoration::<id>    // 已解锁装饰品
  atelier::unlocks::outfit::<key>       // 已解锁 outfit
  atelier::xiaopanda::stage             // 副手小番阶段 (0-3, 影响吉祥物动画 / 表情)
```

**灵感阈值** → 解锁内容：
- 10 灵感 → 工坊角落出现书架装饰
- 25 灵感 → 解锁 `小礼服` outfit
- 50 灵感 → 星核多一束光（背景升级）
- 100 灵感 → 解锁 `白旗袍` outfit + 小番升级
- 200 灵感 → 工坊"完整态"（所有装饰齐全）

每完成一题 +1 灵感，全对 session +3 灵感 bonus。

## 沙箱隔离（同 city 原则）

1. **独立路由** `/math/atelier`（不动 `/math` 主路径）
2. **独立组件** `src/components/atelier/`、page `src/pages/atelier/`
3. **独立数据** `db.meta` key 前缀 `atelier::`
4. **独立资源** `src/content/atelier/realms.ts`
5. **可一键删除**：删 4 个目录 + 路由 1 行 + admin tab 1 项 = 0 残留
6. **不强迫**：从 admin tab "🏠 小进的工坊" 或直链 `/math/atelier` 进入

## 实施路线（自我演化版）

> Bruce 说"持续做，一直做不要停，自我演化"。下面是按可逐步交付的 step，**每个 step 都是独立可见的进展**。

### Stage A — 雏形 (今天)
- ✅ 概念 doc（本文件）
- 🔨 路由 `/math/atelier`
- 🔨 `AtelierHomePage`：Mascot3D + 5 个 portal 卡片 + 「灵感: 0」状态条
- 🔨 `realms.ts` 5 个 realm 定义
- 🔨 点 portal → `/math/atelier/realm/:id` 占位页

### Stage B — 维度入口（next session）
- 🔨 `AtelierRealmPage`：realm 介绍 + 小进换 outfit 过场 + 「开始挑战」按钮
- 🔨 「开始挑战」跳 `/math/train?skillIds=...&from=atelier` 真跑题
- 🔨 `atelierProgress.ts`：每题 +1 灵感（通过 train 完成回调 / event）
- 🔨 admin tab "🏠 小进的工坊"（链接 + 进度查看 + reset）

### Stage C — 进度可见 + 解锁
- 🔨 工坊大厅显示装饰（按 inspiration 阶段）
- 🔨 灵感阈值触发解锁动画 + Xiaojin 庆祝 cheer
- 🔨 小番（红熊猫副手）跟进度升级

### Stage D — 全部 realm 视觉皮肤 + 过场
- 🔨 5 个 realm 各自的 R3F 背景（复用 SceneBackground 思路）
- 🔨 进入 / 退出过场动画（褪色 + Xiaojin 换 outfit）

### Stage E — 题目页 PIP + Xiaojin 实时反应
- 🔨 题目页右下角嵌 mini Mascot3D
- 🔨 答对 / 答错触发 gesture + emotion + (optional) voice 台词

### Stage F — 长线钩子：剧情线
- 🔨 主线小故事（每周一段对话推动）
- 🔨 第 6 个 realm 数据宝库
- 🔨 隐藏 realm / boss 等

## 设计原则（贯穿）

1. **小进永远是中心**。任何屏幕，她要么占主画面，要么 PIP。
2. **数学是钥匙**，不是任务。台词永远是「我们去解开 XX」，而不是「快做对 XX 题」。
3. **工坊在变**：每隔几次回工坊，Selena 应该能注意到"上次没有这本书 / 上次小番不会这个动作"。
4. **失败也美**：答错时 Xiaojin 不批评，而是 confused 表情 + "再想想" + 提示。
5. **节奏 < 数量**：宁愿 5 题一次小进开心庆祝，也不要 20 题平铺直叙。

## 删除 checklist（如果实验失败）

```bash
rm -rf src/pages/atelier/ src/components/atelier/ src/content/atelier/ src/lib/atelier/
rm docs/p2-atelier-concept.md docs/p2-math-city-plan.md
# router.tsx 删 /math/atelier 那 1-2 行
# Admin.tsx 删 "🏠 小进的工坊" tab 那 1 个 case
# 清 db.meta::atelier::* keys
```

主路径完全无回归风险。
