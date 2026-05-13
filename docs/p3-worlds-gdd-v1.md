# P3 GDD v1 — Selena 的学习世界（Worlds）

> **状态**：v0.31.122 后 Bruce 拍板"从游戏架构师视角设计"，本文是 v1 draft。
> 上一步走错（paradise hub + 4 发光柱 + 小进装小框 + town-3 没放正）。
> 本 GDD 取代之前的 paradise 思路；继承 p2-smalltown-concept.md 的核心原则。
>
> 工作流：v1 (本文) → Gemini-3-Pro / GPT-5.5 双 peer-review → v2 → Bruce 拍板 → 才开始编码。

---

## 1. 一句话核心 pitch

> **Selena 通过在 4 个真实生活的虚拟场景里"用"她学的数学/英语/语文/综合，
> 解决居民/旅客/古人的具体问题，赚到奖励让自己的世界越来越繁荣。**

不是题库 + skin。是把学科当工具，在场景里嵌入真实问题。

---

## 2. 目标玩家 + 教育目标

- **唯一用户**：Selena（10 岁，三年级升四年级，成都和平街小学，2026 春 G4B 下册）
- **已建立的角色关系**：小进姐姐（VRM 老师/搭档）+ 红熊猫副手（OBJ sidekick）
- **教育目标**：把"做题"转化为"学以致用"——数学是银行计算，英语是机场指路，语文是诗歌典故，综合是跨学科挑战
- **二次目标**：建立"长期归属感"——场景跟着她成长（建筑升级、NPC 增多、世界变繁华）

---

## 3. 核心理念（继承 p2-smalltown-concept 5 原则 + 扩展）

1. **3D 场景就是游戏**，不是"hub + 旧 drill 卡片"两段式
2. **题目隐性嵌入场景**：客户排队、车次表、菜单 ordering、对联接句——数学/英语/语文是工具，不是任务清单
3. **每个互动点（建筑/物件/NPC）有专属玩法**，跟它的"现实职能"强绑定
4. **可视化成长**：完成越多，世界越繁荣（变大、变热闹、变漂亮）
5. **小进始终陪伴**：场景里的固定老师/导游/合伙人，**不再关 PIP 小框**
6. **不要 modal popup**：所有答题在场景里完成（拖拽、点击、对话气泡）
7. **沿用现有系统**：XP / level / trophy / mastery 模型不重做，只重新封装入口

---

## 4. 世界观（Bruce v0.31.122 新方向）

### 主入口：悬空学科选择
- 进 `/worlds` → 全屏 R3F Canvas，深空背景 + 星云
- 中央：**4 个学科世界图标悬浮**（球形/岛屿/书页缩略图）旋转 + 微光
- 小进 VRM 站中央台座上（全身像，自然挥手 / point 招呼）
- 红熊猫绕台座一周
- 顶部 HUD：今日总分 / 等级 / trophy 数
- 点学科 → camera fly-to 该世界 + zoom transition → 进入该世界主场景

### 4 个独立学科世界（各自一张完整地图）

#### 🔢 数学世界：**和平小镇**（Heping Town，继承 p2-smalltown）
- 地图：30×30 单位俯视村庄 + 街道 + 4-8 个建筑
- 互动点（每个 = 一类数学题，全部 in-scene 拖拽/点击）：
  | 建筑 | 数学 skill | 玩法 |
  |---|---|---|
  | 🏦 银行 | 小数加减、找零、单位换算 | 拖钱币到托盘凑数 |
  | 🚌 公交站 | 速度×时间=距离、时刻表 | 读时刻表 + 画路线 |
  | 🏫 学校 | 方程、等式性质 | 拖数字方块补全 + 天平秤 |
  | 🏪 小卖部 | 小数乘、单价×数量、折扣 | 拖物品入购物车 |
  | 🏥 诊所（成长解锁）| 统计、平均数 | 看病人 BMI / 体温分布 |
  | 👮 警察局（成长解锁）| 概率、组合 | 案件嫌疑人推理 |
- 现实应用：买菜、坐车、看时间、找零钱——四年级最高频

#### 🌍 英语世界：**蓉城国际机场**（Chengdu Intl Airport）
- 地图：航站楼室内 + 跑道远景
- 互动点：
  | 区域 | 英语 skill | 玩法 |
  |---|---|---|
  | ✈️ 登机口 | 数量词、复数、time | 拖行李分类 ("3 carry-on / 2 checked") |
  | 🛂 海关 | basic Q&A、country names | 跟海关官对话 (NPC text + 选择回答) |
  | ☕ 咖啡馆 | menu reading、order phrasing | 客户读菜单 + 拼接句子 |
  | 📰 报刊亭 | sign reading、headline 推断 | 看 5 个 magazine 封面选主题 |
  | 🌐 信息台（成长解锁）| 听力理解（TTS）| 客户问路，听音频选路线 |
- 现实应用：旅行、买卖、问路——Selena 未来可能出国情境

#### 📚 语文世界：**江南古镇**（江南水乡风）
- 地图：水乡街道 + 桥 + 茶馆 + 戏台 + 书院
- 互动点：
  | 场所 | 语文 skill | 玩法 |
  |---|---|---|
  | 🎋 茶馆 | 古诗背诵、对联 | NPC 出上联 → 拖字到下联格 |
  | 📜 客栈 | 成语接龙、典故 | 听客人讲故事 + 接龙气泡 |
  | 🖋️ 书院 | 汉字结构、偏旁、笔顺 | 拖偏旁组合汉字 |
  | 🏯 戏台 | 文言文阅读、人物对话 | 看戏选角色填台词 |
  | 📖 印刷坊（成长解锁）| 阅读理解、改写 | 把白话句子改成文言风 |
- 现实应用：诗词、典故、汉字——四年级必背 + 文化传承

#### 🌋 综合 Boss 世界：**试炼塔**（不叫"火山"——更通用）
- 地图：5 层垂直塔，每层一种风格
- 玩法：闯关——每层 3 道混合学科题（数学 + 英语 + 语文 + 逻辑），答对升层
- 顶层击败 Boss = 周/月级 trophy
- 沿用现有 `BossBattle.tsx` + boss-battle.md 系统

---

## 5. 核心 gameplay loop（每日 15-30 分钟）

```
进 /worlds
   ↓
看 4 世界悬浮，小进招呼
   ↓
选一个世界 (camera fly-in)
   ↓
看到学科主场景 + 小进站旁边
   ↓
点建筑/NPC/物件 (3-5 个目标点)
   ↓
触发场景内互动（拖拽 / 对话气泡 / 选择 / 输入）
   ↓
答对 → 奖励 (XP/灵感/coin) + 场景微变化 (NPC 笑/装饰长出/灯亮)
答错 → 小进给提示 (现成 RealtimeTutor 接入)
   ↓
完成今日目标 (e.g., 3 个场景互动) → 大奖 + trophy 进度
   ↓
返回 /worlds → 看 4 世界各自的成长视觉反馈
```

---

## 6. 现实生活 application 索引（Bruce 核心要求）

**所有 mini-game 必须能回答**："这道题在真实生活什么时候用？"

| 学科 | G4B skill | 场景 | 真实情境 |
|---|---|---|---|
| 数学 | 小数加减 | 银行找零 | 妈妈让你帮买东西，给 50 找多少？ |
| 数学 | 速度×时间 | 公交时刻表 | 几点出门来得及上学？ |
| 数学 | 方程 | 学校黑板 | 苹果 + 3 = 7，苹果几个 |
| 数学 | 三角形 | 工坊建栋 | 哪三根木条能搭三角架？ |
| 英语 | 数量+复数 | 机场行李 | 3 个 backpack 加 2 个 suitcase |
| 英语 | 简单对话 | 海关 | "Where are you from?" |
| 语文 | 古诗 | 茶馆对联 | 上联 → 下联（必背诗中找） |
| 语文 | 成语 | 客栈接龙 | 守株待兔 → 兔死狗烹 |
| 综合 | 多学科混合 | 试炼塔 | 周 boss / 月 boss |

---

## 7. UI/UX 框架

### 入口（/worlds）
- 全屏 R3F Canvas
- 4 世界图标悬浮（球/岛屿），低多边形风
- 中央台座：小进 VRM 全身 + 红熊猫
- 顶部 HUD：等级 / 今日 XP / Streak
- 左上：「← 返回 /math」（兼容旧路径）
- 右上：「设置 / Admin」

### 学科世界内
- 全屏 R3F Canvas（该学科主场景）
- 顶部 thin HUD：当前 XP / 任务进度 (3/5 已完成) / 「🏠 回 /worlds」
- 场景内：可点击的建筑/NPC/物件用微光圈 highlight
- 小进站在场景固定位置（每个世界不同：数学=广场，英语=信息台，语文=茶馆门口）
- 红熊猫在小进脚边/绕她巡逻
- 互动触发：点击对象 → 镜头微推 + 弹场景内对话气泡 (HTML overlay over Canvas)
- 答题完成 → +XP 飞向 HUD + 场景微变（NPC 头顶 ✨）

### 不做的事
- ❌ 不做全屏 modal 题卡（破坏沉浸感）
- ❌ 不做"hub + drill" 两段式（已被否决）
- ❌ 不做"右下角 PIP 小框小进"（爸爸明确否定）

---

## 8. 进度奖励系统（沿用 + 扩展）

### 现有系统（不改）
- XP → level → mascot skin 升级
- Mastery per skill（attempt 累计 + 衰减）
- Trophy 30+ 枚
- Daily streak

### 新增 per-world 维度
- 「世界繁荣度」：每世界累计完成的 mini-game session 数
  - 数学：小镇人口（30 → 80 → 200）
  - 英语：旅客数 / 航班数
  - 语文：游客数 / 书院学生数
  - 综合：试炼塔最高层
- 阈值触发：解锁新建筑 / 区域 / 装饰

### 视觉反馈
- 每完成 1 互动：场景 1 微变（路灯亮一盏、加一朵花、NPC 多笑）
- 每完成 10 互动：可见的中变（一栋新建筑长出来）
- 每完成 100 互动：世界进入"新阶段"（村庄→乡镇）

---

## 9. 角色定位

### 小进姐姐（永远在场，不再关 PIP）
- 在每个世界都有"老师角色"皮肤
  - 数学世界：镇长助手（蓝色校服 / 自然站姿）
  - 英语世界：机场广播员（西装外套）
  - 语文世界：私塾先生（汉服 / 旗袍 outfit "ren"）
  - 综合世界：教官（毕业袍 skin "graduation"）
- 用 Mascot3D VRM full-body in scene + outfit 切换
- 答错时她会走近 + point + 说话（已有 Realtime Tutor 接入，按钮触发）

### 红熊猫副手
- 不再"跟随玩家走动"，因为玩家没 player avatar
- 改成"绕小进巡逻"或"待在小进脚边"
- 庆祝时跳跃 / 转圈（拥有 Mascot3D 的 sidekick gesture）

### NPC（场景的"人"）
- 每个 mini-game 触发点对应 1 个 NPC
- 用 emoji + HTML overlay 表现（不需要 VRM，太重）
- 有简单台词池（已有 npcLines.ts 模板 from city plan）

---

## 10. 技术栈（不重做基础，扩展沙箱）

- **R3F + drei**：已用
- **Mascot3D + VRM 系统**：已有完整 outfit/gesture/emotion，复用
- **现有 backdrop**：Mascot3D 已有 ClassroomBackdrop / LibraryBackdrop / MagicTowerBackdrop / CosmosBackdrop → 可以做 4 学科 backdrop 的起点
- **题目数据**：现有 D1 question bank + skill 系统不动，UI 层重新组合
- **db.meta `worlds::*`**：新世界进度独立 namespace（沿用 atelier/town/city 沙箱模式）
- **OBJ 素材**：`/avatar/env/` 10 个 pack 选 1-2 个，慎选（town-3 教训：先小角度验证再大量使用）
- **路径**：`/worlds`, `/worlds/math`, `/worlds/english`, `/worlds/chinese`, `/worlds/tower`（独立路径，沿用沙箱原则）

---

## 11. 现状盘点 / 复用清单

| 资产 | 状态 | 怎么用 |
|---|---|---|
| `/math` 主页 | 在用 | 留作 fallback；新入口 /worlds 不强迫切换 |
| `/math/atelier` | v0.32.9 实验 | 保留参考；最终可整合或删 |
| `/math/town` (BankScene + TownHomePage) | 沙箱 | **直接复用** 当数学世界基础 |
| `/math/paradise` (v0.31.122 失败) | 待删 | 本 GDD 拍板后清理 |
| Mascot3D + 4 backdrop | 在用 | 作 4 世界室内 backdrop 起点 |
| RedPandaFollower | 在用 | 改为绕小进巡逻 |
| RealtimeTutor (voice + viseme) | 在用 | 错题点小进求救按钮触发 |
| Trophy 系统 | 在用 | 加 per-world trophy 子集 |
| BossBattle | 在用 | 试炼塔直接复用 |

---

## 12. 实施路线（粗）

**Phase 0** — 本 GDD 拍板（Bruce + AI 双审）

**Phase 1** — `/worlds` 主入口 + 数学世界（4 周）
- /worlds 悬空选择页 (R3F 4 球 + 小进中央)
- /worlds/math 复用 BankScene + 加公交/学校/小卖部 3 个 mini-scene
- 进度系统 `worlds::math::*`

**Phase 2** — 英语世界（3 周）
- /worlds/english 机场场景
- 4 个 mini-scene（登机口/海关/咖啡馆/报刊亭）
- 接 D1 英语题库

**Phase 3** — 语文世界（3 周）
- /worlds/chinese 古镇场景
- 4 个 mini-scene（茶馆/客栈/书院/戏台）

**Phase 4** — 综合 Boss 试炼塔（2 周）
- /worlds/tower 复用 BossBattle 系统
- 跨学科混合题

**Phase 5** — 整合 / replace 主路径（2 周）
- /math home 加 "🌍 进入学习世界" 主按钮
- 旧路径标记 "legacy" 可移除

---

## 13. 开放问题（爸爸 + AI 共审）

1. **4 学科 final 吗**？是否预留"美术 / 科学 / 编程" 槽位（5/6 个学科）？
2. **悬空选择视觉**：球 vs 岛屿 vs 翻书 vs 选择行星？有具体参考？
3. **旧路径**（/math /english /chinese）保留多久？是否同步淘汰？
4. **数学世界**直接用 `/math/town` 的 BankScene 改造，还是从 0 重做？
5. **英语 + 语文** 当前 D1 题库可能不够 4 个 mini-scene 各 10+ 题——要先 fill bank 还是先做框架？
6. **小进每个世界换 outfit** 还是统一蓝校服？
7. **试炼塔 boss** 跟现有 `/math/big-problems` 关系？合并 or 并存？

---

## 14. 失败回滚

- 走沙箱路径 `/worlds`
- db.meta `worlds::*` 独立 key
- 一行 router 删除 + `rm -rf src/pages/worlds src/components/worlds src/lib/worlds` 完全卸下
- 主路径不动
