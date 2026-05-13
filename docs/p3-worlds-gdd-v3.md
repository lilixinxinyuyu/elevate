# P3 GDD v3 — Selena 的学习世界（爸爸 v2 反馈整合）

> **状态**：v2 → 爸爸拍板 4 个核心方向后修订 → **v3（本文）**。
> 命名候选 3 套留待爸爸最终选。其他全部确认。
> **拍板命名 + 同意 Sprint 1 → 立即开工**。

---

## 1. 已确认（爸爸 v2 回复）

| 项 | 拍板 |
|---|---|
| Scope | **3 学科地图**（数学/英语/语文），**数学先做** — 内部建筑/地点 → 点击进入 1+ mini-game |
| 入口 | **3 学科悬空**（low-poly 简化加载），不要 2D 卡片 |
| 视角 | **第一人称柜台**（Papers Please 萌系版） |
| 主动建造 | **砍掉**（v2 不做完整装扮系统）；**简单装饰**（装饰灯 / 装饰带 / 种树）可试 |

## 2. 待拍板：3 学科命名（爸爸要求"游戏化、不要直接说学科"）

AI 双 review 后 finalist 3 套（每套风格统一）：

### Finalist 1（隐藏街巷系）⭐ Gemini 强推
**理念**：和平街小学的"隐藏魔法街区"，对角巷感

| 学科 | 名字 | 暗喻 |
|---|---|---|
| 数学 | **叮当街** | 硬币入钱箱、公交铃声、木工敲击=经营+几何 |
| 英语 | **季风街** | 远洋季风、港口舶来品=跨文化交流 |
| 语文 | **纸鸢巷** | 风筝古风、茶馆书院戏台=诗意故事 |

加分项：可以加 loading 彩蛋"和平街小学的 Selena 不知道，公交站等 10 分钟就能搭乘开往叮当街的专线..."

### Finalist 2（岛屿系）
**理念**：动森式离岛探险

| 学科 | 名字 | 暗喻 |
|---|---|---|
| 数学 | **积木岛** | 拼搭+几何+分数拆解 |
| 英语 | **鹦鹉岛** | 会说话+热带远洋 |
| 语文 | **白鹭岛** | "一行白鹭上青天"，诗意水墨 |

### Finalist 3（港口系）⭐ GPT-5.5 推
**理念**：宝可梦风+冒险家途径的港口

| 学科 | 名字 | 暗喻 |
|---|---|---|
| 数学 | **百宝港** | 货物/价格/时间/工具=生活经营 |
| 英语 | **远鸥港** | 海鸥/客船=出发看世界 |
| 语文 | **墨舟港** | 载诗句的小船=古风阅读 |

→ **下面文档暂用 "数学地图 / 英语地图 / 语文地图"占位，爸爸选完再 replace**

---

## 3. 数学地图详案（Sprint 1+2 重点）

### 3.1 地图布局（30×30 单位俯视低多边形小镇）

```
                    [🌲]      [🌲]
       ┌──────────────────────────────────┐
       │  🏪 小卖部    🏦 银行              │
       │  ↓扫码/找零    ↓单位换算/储蓄       │
       │                                  │
       │  🥖 面包店    🚌 公交站            │
       │  ↓分数/乘法    ↓速度时间距离       │
       │                                  │
       │  🛠️ 木工坊    🏠 我的房间          │
       │  ↓多边形/面积  ↓周长/装修          │
       │                                  │
       │     ⛲ 中央广场（小进站这里）       │
       └──────────────────────────────────┘
                    [🌲]      [🌲]
```

**6 个地点**，每个地点 = 1 个建筑 = 至少 1 个 mini-game。
未来每个地点可扩多个 game（e.g. 小卖部除了扫码还可"上货分类"）。

### 3.2 每地点 mini-game 概念（G4B 真核心 skill）

| 建筑 | G4B Skill | Mini-game 概念 | Sprint |
|---|---|---|---|
| 🏪 **小卖部** | 小数加减 + 乘法 | 扫码算总价 + 找零 | **1** |
| 🏦 **银行** | 单位换算 + 大数 | 兑换钱币（1元=10角=100分）| 2 |
| 🥖 **面包店** | 分数（½ + ¼）+ 除法 | 切蛋糕分给客人，平均分 | 2 |
| 🚌 **公交站** | 速度×时间=距离 + 时刻表 | 算几点到 + 选最快路线 | 3 |
| 🛠️ **木工坊** | 多边形面积 + 三角形 | 拼木板搭最稳固的房梁 | 3 |
| 🏠 **我的房间** | 周长 + 长度单位 + 装饰 | 给房间贴装饰墙纸（量边） | 3 |

### 3.3 通用交互模式（"操作物 → 校验 → 反馈 → 奖励"4 步）

每个 mini-game 进入是第一人称柜台/桌面视角：
- **顶部 HUD 极薄**：当前进度、得分、🏠 回地图
- **场景中央**：操作物（拖拽物品 / 选项 / 工具）
- **角色 NPC**：emoji + HTML 头像 + 对话气泡（不用 VRM）
- **小进**：左侧站立 VRM（idle 看你工作），需要才出手势（求救按钮）

### 3.4 Sprint 1 唯一 mini-game 详案：**小卖部扫码 + 找零**

#### 入口
地图点击小卖部 → camera fly-in（0.6 秒） → 切到柜台第一人称

#### 互动 A — 扫码算总价（小数乘）
- 顾客 NPC 桌前 emoji + 头顶气泡："I want these / 我要这些"
- 桌上 3-5 件物品（emoji 🍎🥖🥛）每件有标签价（¥0.5 / ¥1.5 / ¥2.0）
- **操作**：拖物品 → "扫码篮"（drei DragControls）
- **校验**：篮子上方实时显示累计总价 (drei Text)
- **反馈**：扫对 ✓ 物品金色边框 + "嘟" 音；放错位置 ✗ 物品弹回 + 顾客挠头
- **完成**：所有物品扫完，总价定格 → 进入互动 B

#### 互动 B — 找零（小数减）
- 顾客头顶："Here's ¥10"，递钱过来
- 桌面钱柜：1元 × 5、5角 × 5、1角 × 10、5分 × 10（emoji 🪙 + 数值标签）
- **操作**：拖钱币到"找零托盘"
- **校验**：托盘上方实时累计；目标 = ¥10 - 总价
- **反馈**：金额正 ✓ 钱币飞向顾客 + "Thank you!" 顾客笑脸；多/少 ✗ 顾客摇头钱推回
- **完成**：+5 XP 飞向 HUD + 顾客离开 + 掉 1 个"装饰碎片"

#### Sprint 1 后退出
完成 1 单 → 回小镇地图 → 看到中央广场多了 1 盏小灯（爸爸认可的"简单装饰"）

### 3.5 简单装饰系统（Sprint 1 试）

完成 1 个 mini-game session → 掉 1 个"装饰碎片"，自动放在小镇地图的固定位置（不让 Selena 自己摆，省 v2 不要的装扮 UI）：
- 第 1 单：广场中央加 1 盏路灯
- 第 5 单：路灯亮起来发光
- 第 10 单：广场加 1 棵小树
- 第 20 单：树挂彩灯
- 第 50 单：天空加 1 只飞鸟（动画）

**不让 Selena 自己摆，自动加。但是看得见的"我玩了 = 镇子变了"**。

---

## 4. 主入口 /worlds 详案

### 4.1 视觉

```
                              ⭐ 小星 ⭐
                                  
        ┌───┐                                  ┌───┐
        │ A │           [小进 VRM]              │ C │
        │地图│            🐼 红熊猫              │地图│
        │ ⭐ │                                  │   │
        └───┘                                  └───┘
                          ┌───┐
                          │ B │
                          │地图│
                          └───┘
                            
  顶部 HUD: Lv.5 | ⭐1230 | 🔥 streak 7
  底部: 推荐"叮当街的顾客在等你！" → 大按钮
```

### 4.2 交互
- 3 个学科地图悬浮在小进周围（low-poly + 微旋转 + 呼吸光晕）
- 小进 VRM 站中央台座（全身像，scale=1）waving idle
- 红熊猫绕台座一圈（Mascot3D sidekick 已有）
- 推荐学科图标 ⭐ 高亮 + 大按钮"开始"
- 点其他 2 个学科 → 提示"建设中" (Sprint 2+ 解锁)
- 点小进 → 弹小型对话气泡（不进 Realtime Tutor，保留沉浸）

### 4.3 Low-poly 简化（GPT-5.5 性能要求）
- 3 个学科图标 = 简单 box + emoji 贴图（不用 OBJ）
  - 数学 🏘️ = 微缩小镇 box（5 个小 box 摆成镇子）
  - 英语 🏝️ = 微缩岛屿（半球 + 帆）
  - 语文 🏯 = 微缩古镇（屋檐折角 box + 红灯笼 emoji）
- 全程 procedural，无 OBJ 加载
- DPR ≤ 1.5, no shadow, frameloop="demand"
- VRM 小进 lazy load，过渡用 emoji 占位

---

## 5. Sprint 1 实施清单（1 周）

### 文件结构
```
src/pages/worlds/
  WorldsHomePage.tsx        # /worlds 悬空入口
  MathMapPage.tsx           # /worlds/math 数学地图俯视
  StoreScene.tsx            # /worlds/math/store 第一人称小卖部
src/components/worlds/
  WorldOrb.tsx              # 悬空 3 学科 low-poly orb
  XiaojinGreeter.tsx        # 中央 VRM 老师
  MathTown.tsx              # 数学小镇 30×30 + 6 建筑 box
  StoreCounter.tsx          # 第一人称柜台（物品+钱柜+客户）
  CustomerNPC.tsx           # emoji+HTML 客户对话气泡
  DragItem.tsx              # 通用拖拽物品 component
  XPFlyAnim.tsx             # +5 XP 飞向 HUD 动画
src/lib/worlds/
  worldsProgress.ts         # db.meta worlds::* 读写
  storeQuestions.ts         # 小卖部题库（从现有 D1 小数题筛）
src/content/worlds/
  mathTown.ts               # 6 建筑定义 + emoji + 解锁状态
  storeItems.ts             # 物品 emoji + 价格池
  customerLines.ts          # 顾客台词池
```

### 路由
```
/worlds                       → WorldsHomePage
/worlds/math                  → MathMapPage  
/worlds/math/store            → StoreScene
```

旧路径 (`/math`, `/math/paradise`, `/math/atelier`, `/math/town`) 全部不动。

### Sprint 1 步骤
1. ✅ **GDD v3 拍板**（本文）
2. 🔨 `WorldsHomePage`：3 个 procedural orb + 小进中央 + 推荐按钮
3. 🔨 `MathMapPage`：俯视 6 个建筑 box（5 个建设中标签，小卖部 active）
4. 🔨 `StoreScene` + `StoreCounter`：第一人称视角 + 物品摆桌
5. 🔨 互动 A 扫码：DragControls + 累加显示
6. 🔨 互动 B 找零：钱币拖拽 + 校验
7. 🔨 装饰系统：完成 1 单加 1 盏灯到地图
8. 🔨 `worldsProgress`：db.meta 持久化进度
9. ✅ 性能验证：iPhone 12 ≥ 30 fps
10. ✅ 部署 + Selena 5 分钟试玩验证（"完成 3 单还想再点一次"）

### 不在 Sprint 1 里
- ❌ 其他 5 个数学地点（Sprint 2+3）
- ❌ 英语 / 语文地图（Sprint 4+）
- ❌ 装扮系统（v4 才考虑）
- ❌ 试炼塔 Boss（远期）
- ❌ Realtime Tutor 求救按钮（Sprint 2 加）

---

## 6. 现有代码处理

### 不动
- `/math` 主路径全套（home / train / skills / boss / fluency）
- D1 题库 + cloud sync
- XP / level / trophy 系统

### 复用
- `BankScene.tsx`（30% 复用钱币拖拽逻辑 → StoreCounter）
- `Mascot3D` VRM + outfit 系统（XiaojinGreeter）
- `MascotPIP` 模板（如果未来要 PIP 求救按钮）

### 待清理（GDD v3 拍板后）
- `/math/paradise` 全套 v0.31.122 失败实验
- `public/env/town-3/` 24MB OBJ 素材
- `src/components/paradise/*`

---

## 7. 待爸爸最终决定

### 1 个命名候选选 1 套（或自己出一套）
- ⭐ Finalist 1: 叮当街 / 季风街 / 纸鸢巷
- Finalist 2: 积木岛 / 鹦鹉岛 / 白鹭岛
- Finalist 3: 百宝港 / 远鸥港 / 墨舟港

### 1 个时间限同意
- Sprint 1 = 1 周做小卖部 vertical slice（不含其他 5 建筑）

### 1 个 v0.31.122 paradise 清理
- 同意拍板 GDD v3 后我清掉旧 paradise 代码 + town-3 OBJ 24MB（不影响线上 /math 主路径）

---

## 8. 风险登记

| 风险 | 概率 | 缓解 |
|---|---|---|
| iPhone 12 性能 < 30 fps | 中 | Sprint 1 末实测；procedural 全程，无 OBJ |
| 拖拽在 3D 难（移动端） | 中高 | drei DragControls + 触屏适配；如果还不行降级 2D overlay |
| Sprint 1 1 周做不完 | 中 | 优先互动 A 扫码（最简单的拖+加）；互动 B 找零可推到 Sprint 1.5 |
| Selena 试玩"还是题卡" | 中 | 4 步验收必过；5 分钟连续 3 单是真验证 |
| 装饰碎片视觉感弱 | 低 | 第 1 单加路灯就够；不复杂 |

---

## 9. 失败回滚（沙箱原则）

```bash
# 主路径 0 回归
rm -rf src/pages/worlds src/components/worlds src/lib/worlds src/content/worlds
rm docs/p3-worlds-gdd-v1.md docs/p3-worlds-gdd-v2.md docs/p3-worlds-gdd-v3.md
# router.tsx 删 /worlds 路由
# db.meta 清 worlds::* keys
```

完成。
