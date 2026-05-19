# 战斗 + Minigame 设计 — 2026-05-19

**Trigger**: Bruce — 9 mode × 23 template 包装成战斗游戏感. canvas_scratch / multi_step 怎么处理? Minigame 按 skill 还是 cluster?

**双 peer review (Gemini-3-pro + GPT-5.5) 并行 cross-validate.**

---

## 🎯 核心 Insight (强 converge)

> "Mode 不决定玩法, mode 决定 playlist." (GPT)
> "Hub 主按钮永远是 PLAY, 学习诊断藏在背后." (GPT)
> "不要把所有题硬套 HP. 每个 session 包装成战斗旅程; 每道题根据交互类型选'攻击/防御/解谜/蓄力/Boss phase' 表现." (GPT)

**我 (Claude) Critical filter**:
- ✅ 3 tier 分组 / MultiStep 4-phase / Cluster 5-8 个 — 立即实施
- ⚠️ "魔法植物" 跟 atelier 重叠 — 不加
- ⚠️ "剧情碎片" 太新 — defer
- ✅ Mascot 换装 / 图鉴 / 盲盒 — 已有, 整合

---

## 23 模板 3-Tier 分组 (两家 converge)

### Tier A: 直接战斗化 (题=武器, 敌人 HP) — 9 个模板
SpeedMatch / PlainNumeric / VerticalRepair / PlainChoice / TrueFalseSwipe / SortLadder / ClueFinder / DecimalShifter / NumberHunt

**实施**: 1 个 BattleShell wrapper 替换 GameShell 上层. Panel 内部不变.

### Tier B: Boss 战 / 策略 — 7 个模板
ShopCounter / EquationBuilder / MultiStepApplication / BalanceLab / TimeHeist / DiscountDrift / CoinCombo / MemoryMatch

**MultiStep 4-phase = "终极奥义"** (Gemini 独家洞察):
- Phase 1 已知 = 收集能量宝石
- Phase 2 求 = 瞄准镜锁定 Boss 弱点
- Phase 3 算式 = 装填魔法大炮 充能光芒
- Phase 4 答 = 激光发射全屏特效

错某 phase = Boss 反击 + hint, 不直接失败.

### Tier C: 独立 Minigame 关卡 — 5 个模板
CanvasScratch / DotGridDraw / CubeViewer / ShapeCourt / TriangleJudge

**CanvasScratch = "符文绘制"** (Gemini):
- 场景: 封印石门 / 结界
- Canvas = 魔法阵, 笔触星光特效
- 答对 = 手写化金光击碎石门

---

## Minigame Cluster (两家 converge: 不按 51 skill, 5-8 cluster)

| # | Cluster | 涵盖模板 | Selena 现行 skill |
|---|---|---|---|
| 1 | Number Arena 数字竞技场 | SpeedMatch / PlainNumeric / DecimalShifter / VerticalRepair | 速算, 小数加减乘 |
| 2 | Word Problem Detective 应用题侦探 | ShopCounter / MultiStepApplication / ClueFinder | 应用题 4 步法 |
| 3 | Equation Temple 方程神殿 | EquationBuilder / BalanceLab | 方程 |
| 4 | Geometry Lab 几何实验室 | TriangleJudge / ShapeCourt / CubeViewer / DotGridDraw | 三角形 / 四边形 / 立体观察 |
| 5 | Data Quest 数据探险 | ChartDetective / NumberHunt | 统计图 |
| 6 | Money & Time Arcade 金钱时间游乐场 | CoinCombo / DiscountDrift / TimeHeist | 钱 / 时间 |
| 7 | Rune Drawing 符文绘制 | CanvasScratch | 手写列算式 |

**Skill 是关卡参数 (难度 / 题目集), 不是单独 game.**

---

## 9 Mode 是 Playlist 不是玩法

| Mode | Playlist |
|---|---|
| normal | 主线 cluster 1-3 mix |
| weak_skill | 自动补弱点 — pick cluster 中弱 skill |
| review | FSRS 旧 skill 复习 cluster |
| final_sprint / midterm / mock_exam | Boss gauntlet — 多 cluster 串联 + 时长压力 |
| skill | 单 skill 训练 → 进对应 cluster 单一变种 |
| free | 随便 arcade |
| big_problems | multi-step raid (Tier B) |

---

## Hub 主界面元素 status

| 元素 | 状态 |
|---|---|
| 中心 Mascot + 当前任务 | ✅ Hub v3 已 ship |
| 巨大 PLAY 按钮 | ✅ Hub v3 "开始战斗" |
| 一屏不 scroll | ✅ Hub v3 (fixed inset overlay, dvh) |
| 一屏地图 | ❌ /math/world-preview 还在水平 zigzag |
| 段位进度 | ✅ Hub v3 HUD |
| 6 side icon | ✅ Hub v3 (勋章/模拟/工坊/错题/基本功/地图) |
| Mascot 换装 | 🟡 已有 atelier 沙箱 — 整合 |
| 图鉴 | 🟡 已有 trophy — 整合 |
| 盲盒 | ✅ LotteryBoxModal 已存在 |

---

## 实施顺序 (risk × impact)

| sprint | 改动 | risk | impact | 状态 |
|---|---|---|---|---|
| 1 | Hub v2 Mascot + PLAY | 低 | 中 | ✅ v0.35.71 |
| 2 | Celebration Screen | 低 | 高 | ✅ v0.35.72 (Bruce 好评) |
| 3 | **Hub v3 真 1 屏 viewport** | 低 | 高 | ✅ **v0.35.73** |
| 4 | Streak 屏 | 低 | 中 | next |
| 5 | BattleShell (Tier A 9 模板) | 中 | 最高 | big |
| 6 | MultiStep 4-phase boss UI | 中 | 高 | next |
| 7 | CanvasScratch 符文绘制 | 中 | 中 | next |
| 8 | 垂直 Duolingo path | 中 | 高 | next |
| 9 | Cluster minigame 1-2 prototype | 中 | 高 | next |
| 10 | Integrate → 替换正式 home / Train | 高 | 最高 | far |

---

## Bruce 待决策 (3 个)

1. **Hub v3** (`/math/hub-v3`) 接受方向? 一屏可见 / 大 PLAY / 6 side icon.
2. **BattleShell** 先做 Tier A 9 模板, feature flag 罩 不影响主路径, OK?
3. **Cluster 命名** 用中文版 (数字竞技场 / 应用题侦探 / 方程神殿 / 几何实验室 / 数据探险 / 金钱时间游乐场 / 符文绘制) 还是别的?
