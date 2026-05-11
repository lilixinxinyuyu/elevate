# P2 — Math City 叙事整合（沙箱版）

> **STATUS（v0.31.93）**：仅设计文档 + 后续沙箱实验。**未集成到主路径**。
> 实施时所有改动遵循"沙箱原则" — 入口独立、数据独立、可完全删除不留痕。

## 沙箱原则（Bruce 拍板，v0.31.93）

1. **独立入口** — 走单独路由 `/math/city`，不替换 / 不修改 `/math` 主页、nav、train、boss 等主路径
2. **独立组件** — 所有 City 相关组件放 `src/components/city/`、page 放 `src/pages/city/`
3. **独立数据** — 不读 / 不写主 `mascot xp` / `mastery` / `attempts` 表；自用 `db.meta` key 前缀 `city::` 隔离
4. **独立资源** — 图片 / 主题 emoji / NPC 台词都在 `src/content/city/*.ts` 隔离
5. **可一键删除** — 删除以下文件即可完全卸下：
   - `src/pages/city/*` `src/components/city/*` `src/content/city/*`
   - `docs/p2-math-city-plan.md`
   - 路由配置中加的 `/math/city` 一行
   - admin tab 中加的 "🏙️ City 沙箱" tab 一行
6. **不强迫使用** — Selena 主路径仍是 home / 闯关 / 闪电口算 / 技能图 / 错题驯服；只有从 admin 进城市才会触发 P2 玩法

如果实验后决定不要 City，按上面清单删 7-8 个新文件 + 2 行配置即可，主路径完全无回归风险。

---

## P2 v1 — 最小可见叙事（半天）

**目的**：让玩家进入 City 后看到 "📍 折扣街 · 老板娘小红：欢迎光临！"，5 个新玩法各对应一个地标。

### 路由
- `/math/city` — 城市入口（5 张地标卡片 + 描述）
- 点击地标 → `/math/city/play?location=discount-street` → 起一个该地标对应的 skill 的 session

### 文件清单
```
src/pages/city/
  CityHomePage.tsx           # 5 地标卡片列表入口
  CityPlayPage.tsx           # 进入某地标的训练 session

src/components/city/
  LocationCard.tsx           # 单个地标卡片（emoji + 名 + 进度）
  LocationHeader.tsx         # session 内顶部 "📍 地标 + NPC 台词"
  NpcChatter.tsx             # NPC 答对/答错的随机台词浮窗

src/content/city/
  locations.ts               # 5 地标定义（id, name, emoji, gameType, npc, lines[]）
  npcLines.ts                # 每个 NPC 的台词池（鼓励 / 答对 / 答错）

src/lib/city/
  cityProgress.ts            # db.meta `city::progress::*` 读写
```

### 5 地标定义（locations.ts）

| id | name | emoji | gameType | NPC | 主 skill |
|---|---|---|---|---|---|
| `discount-street` | 折扣街 | 💸 | discount_drift | 🧑‍💼 老板娘小红 | decimal_price_quantity / decimal_point_shift |
| `coin-plaza` | 钱包广场 | 🪙 | coin_combo | 🦊 收银狐 | decimal_unit_conversion |
| `clock-tower` | 时钟塔 | ⏰ | time_heist | 🦉 钟楼管理员 | speed_time_distance / equation_meeting_problem |
| `gem-mine` | 宝石矿洞 | 💎 | number_hunt | 🦔 矿工小刺 | decimal_compare / large_compare |
| `workshop` | 建筑工坊 | 🎯 | dot_grid_draw | 🐻 工程师老熊 | triangle_inequality / triangle_classification |

### admin 入口（沙箱用）

加一个 admin tab "🏙️ City 沙箱"，里面：
- 链接到 `/math/city`
- 列出 5 地标的进度（已玩多少局）
- "重置 City 进度"按钮（删掉 `db.meta` `city::` 所有 key）

实验阶段只从 admin 进。等 Bruce 决定 release 给 Selena，再加 home 入口或合并到主路径。

---

## P2 v2 — 城市地图入口（2 天）

**目的**：替换 v1 的卡片列表为真正的 SVG 地图，5 个地标在地图上有视觉位置。

### 增量文件
```
src/components/city/
  CityMap.tsx                # SVG 城市俯视图，5 地标 + 连接路径
  LocationMarker.tsx         # 地图上单个地标 marker（emoji + glow）

src/content/city/
  mapLayout.ts               # 5 地标在 SVG 的 (x, y) 坐标 + 路径
```

### 地图设计
- 800×600 viewBox
- 浅紫渐变背景（夜空感）
- 5 地标按一个柔和的环形或迷宫式布局
- 已 unlocked 地标 colored + 微动效（呼吸光）
- 未 unlocked 地标灰色 + 🔒
- 点地标 → 弹窗"进入 [地标名]？" → 确认进 session

### 初始解锁条件
都默认 unlocked（这是沙箱，不门控）。如果实验时想门控，加个 prereq 字段。

---

## P2 v3 — 累积奖励 + 装扮（1 天）

**目的**：玩 N 次某地标 → 解锁该地标的"专属装扮 / NPC 升级 / 主题音效"。

### 增量
- `cityProgress.ts` 加 `getExploreCount(locationId)`
- 累积阈值（5/10/20 局）触发解锁事件
- 解锁内容：
  - NPC 形象 emoji 升级（🧑‍💼 → 👩‍💼 → 👑）
  - 地标主题改变（白天 / 黄昏 / 夜景）
  - 背景音效解锁

### 数据键
```
db.meta:
  city::progress::<locationId>::plays      // 玩过几次
  city::progress::<locationId>::completed  // 完成（答对）几次
  city::unlocks::<locationId>::stage       // 0/1/2 — 地标升级阶段
```

---

## 完全删除步骤（如实验失败要扔掉）

1. 删除目录
   ```bash
   rm -rf src/pages/city/ src/components/city/ src/content/city/ src/lib/city/
   ```
2. 删除文档
   ```bash
   rm docs/p2-math-city-plan.md
   ```
3. 路由配置去掉 `/math/city` 路由（router.tsx 里的 1-2 行）
4. admin tab 去掉 "🏙️ City 沙箱" tab（Admin.tsx 1 个 case）
5. `db.meta` 清理（一次性脚本）：删除所有 `city::*` key
   ```ts
   const keys = await db.meta.toCollection().keys();
   await db.meta.bulkDelete(keys.filter(k => k.startsWith("city::")));
   ```

完成后主路径完全无回归。

---

## 实施顺序建议

Bruce v0.31.93 决策：先跑 fill-bank 200 题 → compact session → 启动 P2 v1 沙箱实验。

v1 → 玩一段 → 决定 v2 / 不做。v2 → 玩一段 → 决定 v3 / 不做 / release。

每一档都是独立沙箱，**任何一档可随时停止 + 删除**。
