# Hub 重设计 Integration Plan — 2026-05-19

**Trigger**: Bruce 反馈 v0.35.69 World Map prototype "整体差得还挺远", 提供 7 张参考截图. 启动 Gemini-3-pro + GPT-5.5 并行 design review.

**核心 BLINDSPOT**: 我做成了 dashboard. 参考全是 **角色英雄叙事 + 战斗游戏**.

---

## 🔴 P0 — 2 家强 converge

### P0-1: Mascot 居中大主角 (Hamster + Fitness Boxing)
- **现状**: prototype 里 mascot 是小 icon 跟在节点旁
- **改进**: Mascot 占屏 1/3 高度, 居中, 跳跃动画
- **状态**: ✅ v0.35.71 Hub Screen 已 ship (180px panda + 64px fox 副手 + float 动画)

### P0-2: 单 PLAY 巨钮 (Hamster + Duolingo)
- **现状**: prototype 27 个 interactive 元素分散
- **改进**: 单一巨大 PLAY 按钮右下, 黄橙渐变, 3D shadow pulse
- **状态**: ✅ v0.35.71 已 ship (PLAY → 跳现行 TrainRoute)

### P0-3: 战斗页 (题=武器 + 敌人 HP) — **最大缺失, 还没做**
- **来源**: Hamster 战斗 + Duolingo Math Duel
- **设计**:
  - 顶 HUD: 左 ❤❤❤ Mascot HP / 右 ❤❤❤ 怪兽 HP (Bug)
  - 战场: Mascot 左 vs 怪兽右, 树林背景, 可爱不恐怖 ("Number Gremlin")
  - 题目: 居中大字 "15 + ___ = 22"
  - 数字 tile bank: 2×7 grid, 14 个 tap-tile
  - **关键交互**: 选对 → tile 飞向怪兽 (CSS transform) + 怪兽掉血 + 闪红 / 选错 → tile shake + Mascot 鼓励 ("再看看", 不扣 HP, 不羞辱)
- **技术**: 全 SVG/CSS, 不需 canvas. ~250 行新 component.
- **路线**: `/math/battle-preview` (prototype) → 满意后替换 TrainPage 现行 game shell

### P0-4: 垂直 Duolingo Path 替换水平 Zigzag
- **现状**: prototype 水平 zigzag SVG (难滚动, 适合 PC 不适合 iPad)
- **改进**: `flex-col-reverse` (默认底部, 往上滑动); 节点大圆 (w-20 h-20) 左右交替 (`self-start ml-12` / `self-end mr-12`); 节点间 SVG 虚线连接
- **位置**: 改在 `/math/world-preview` (现 prototype) 或合并进 hub
- **状态**: ❌ 没做

### P0-5: 庆祝屏 (Lesson Complete)
- **来源**: Duolingo "Lesson complete!" + 角色 + Duo 配对 + XP/COMBO/SCORE
- **设计**:
  - Mascot 跳跃 (animate-bounce)
  - 3 奖励卡: +XP / Combo / 段位进度 +X%
  - 文案 positive: "干得漂亮！怪兽被赶跑了！" 不是分数
  - 错题多时 reframe: "今天找到 3 个再练的点" 不是低分
- **状态**: ❌ 没做

---

## 🟡 P1 — 2 家次 converge

### P1-1: Streak 独立屏 (大火焰 + W/T/F/S/S dots)
- **来源**: Duolingo Streak
- **设计**: 大🔥 SVG + 数字 + 周日 dots (已打卡橙色 + 今日 glow)
- **文案**: "连续练习让 Panda 变强 / 明天再来保持火焰" (不要 streak break 惩罚)
- **状态**: ❌ 没做

### P1-2: RPG HUD (profile 卡 + 双货币)
- **状态**: ✅ v0.35.71 已部分 ship (顶部 profile 卡 + ⭐ streak / 🟡 freezeTokens)
- **TODO**: 加 hexagon 形状 (Fitness Boxing style), 货币加 SVG icon 代替 emoji

### P1-3: 段位放主循环
- **设计**: 进度条显示 "还差 X XP 晋级 Y", 每 boss = 晋级赛, 完成屏弹 "段位进度 +18%"
- **状态**: ✅ v0.35.71 已部分 ship (tier name + progress bar)
- **TODO**: 完成屏的段位 +X% 反馈

---

## 实施顺序 (按 risk × impact)

| sprint | 改动 | 风险 | 状态 |
|---|---|---|---|
| 1 | Hub Screen v2 (P0-1, P0-2) | 低 | **✅ v0.35.71** |
| 2 | 庆祝屏组件 (P0-5) | 低-中, 独立 modal | next |
| 3 | Streak 屏 (P1-1) | 低-中 | next-next |
| 4 | 战斗页 prototype (P0-3) | 中-高, 新 game shell | 大 |
| 5 | 垂直 path (P0-4) | 中 | 大 |
| 6 | 段位整合 (P1-3 polish) | 低 | small |

---

## Bruce 待决策点

1. **Hub Screen v2 (v0.35.71)** 在 `/math/hub-preview` 已 ship — 看了之后:
   - 接受方向 (我继续 sprint 2/3/4/5/6)
   - 调整 Hub Screen (改色 / 改 mascot 大小 / 改 side icon 数量)
   - 跳过 Hub 直接做战斗页 / 庆祝屏

2. **战斗页 (P0-3)** 是核心 game mechanic 改造. 它取代 TrainPage 现行 game shell 是 BIG. 想问:
   - 战斗页只用于 normal mode (今日挑战), 还是覆盖全部 9 mode?
   - mock_exam (期末模拟) 也包成战斗吗? 还是 mock_exam 保持纸面试卷感?
   - canvas_scratch / multi_step 这种 write-heavy 题型怎么 fit 战斗 metaphor?

3. **保留现有 23 模板**? 战斗模型可能跟现有 PlainNumeric / SpeedMatch / DotGridDraw 等模板 fit, 但 BalanceLab / CubeViewer / TimeHeist 这种纯 visual gameplay 跟"打怪" metaphor 不合.

---

## Anchor (Gemini)
> "不要再把'数学'当成核心 UI 元素, 把它当成**'打怪的子弹'**.
>  把现在的 Prototype 当作底层逻辑, 盖上一层
>  **'主角养成 → 选关 (垂直爬塔) → 战斗 (选数字打怪) → 结算 (多邻国式庆祝)'** 的壳."

## Anchor (GPT)
> "首页 mascot 主舞台 / SVG 战斗页 / 竖向 Duolingo path / 完成庆祝屏 — 4 个 P0 缺一不可.
>  从'数学地图预览'变成 'Panda 陪 Selena 打怪升级的数学训练游戏'.
>  数学题不是考试, 而是武器; 错题不是失败, 而是怪物护盾."
