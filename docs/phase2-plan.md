# Phase 2 — 多步骤化 + Fluency + 自动化

> 起草 2026-05-05，跟父亲讨论后确认。**立刻开始实施**（不等期中考完）。
> Axis 4 build-only 零 runtime 影响今晚先动；Axis 3/1/2 涉及 runtime 用
> feature flag 攒着，5/6 期中后给 Selena flip 开。
> 触发：分析锦江 / 盐道街 2024-2025 期中真题，发现当前游戏化只覆盖单知识点，
> 缺少多步应用题、画图操作题、跨单元基础功（fluency）。

---

## Axis 4 · CLI 自动化（最先做，是基建）

**目标**：加新 skill 从"改 6+ 文件"压到"跑一条命令 + 审 git diff"。

**脚本**：`scripts/add-skill.mjs`

**输入**（命令行 flags）：
- `--id` (必填) — 例 `mul_table_9` 或 `decimal_round`
- `--name` (必填) — 中文，例 `9×9 乘法口诀`
- `--unit` (必填) — 例 `G4B_FLUENCY` 或 `G4B_U3_DECIMAL_MULTIPLY`
- `--ability` (必填) — 逗号分隔 `concept,calculation`
- `--exam-priority` — `MUST_BIG` / `IMPORTANT` / `NORMAL`（默认 NORMAL）
- `--game-types` — 默认 `numeric_choice,application`，可改
- `--n-questions` — 默认 30
- `--difficulty-range` — 默认 `1-4`
- `--gen-trophy` — 默认 false（trophy 跟 unit 走，单 skill 不一定有）

**自动 patch 的文件**：
1. `src/content/skills.ts` — push 新 skill 对象
2. `src/content/units.ts` — 如果 unit 不存在，创建（提示用户确认）
3. `src/content/examPriorities.ts` — push 到对应 priority 数组
4. `src/content/aiGenG4*_Pack.ts` — 跑现有 `/api/generate/questions` 接口，dump 到对应 pack
5. `src/content/questions.ts` — 注册新 pack import
6. `src/db/seed.ts` — bump SEED_VERSION（避免 v0.30.14 的坑重演）

**外部 API 调用**：
- `/api/generate/questions`（DashScope qwen-plus）— 出题
- `/api/generate/image`（token-plan wan2.7-image-pro）— 如果带 trophy

**输出流程**：
1. 跑完后 `git status` 显示 6+ 文件改动
2. 命令行打印题目预览（前 5 道）+ trophy 图 URL
3. **不自动 commit**——人工 review `git diff` + 确认后手动 commit

**用例**：
```bash
node scripts/add-skill.mjs \
  --id=mul_table_9 \
  --name="9×9 乘法口诀" \
  --unit=G4B_FLUENCY \
  --ability=calculation \
  --game-types=numeric_choice \
  --n-questions=81 \
  --difficulty-range=1-2
```

**估时**：1.5-2 天（其中 0.5 天 schema patch 工具，0.5 天接 AI pipeline，剩下 polish + edge）

---

## Axis 3 · Fluency 模式（基础功 / 速算训练）

**目标**：每天 60 秒 × 30 题口算冲刺，按年级开放分级表。覆盖**跨单元跨学期**的底层能力。

### 关键决策（已确认）
- **不进 XP / 段位**（独立勋章雷达 + 独立进度系统）
- 不污染段位经济，但 Selena 仍能看到自己的 fluency 涨

### 内容分级表

| 年级 | 默认开放内容 |
|---|---|
| G3 | 5×5 乘法表 / 10 以内加减 / 凑十凑五 |
| G4A | 9×9 全表 / 20 以内加减 / 简单除法 / 凑整 |
| G4B | G4A 全部 + 100 以内加减简便 / 小数加减口算 / 0.5×N 类技巧 |
| G5+ | 待定 |

### 路由 + UI
- 新路由 `/math/fluency`（跟 Train/Skills/Mistakes 同级，加进 navItems）
- 主页面：选择 fluency 模块（"9×9 乘法"、"20 以内加减"…）
- 训练界面：60 秒倒计时，闪电匹配风格，不显示讲解，做错立刻下一题（错的进 fluency 错题，不进现有 mistakes 表）

### 进度 / 勋章
- 独立 fluency 雷达（speed / accuracy / coverage 三轴）
- 独立 trophy 体系（不混进现有 BadgeInventory）：
  - 🚀 飞毛腿（每分钟 30+ 题）
  - 📐 乘法口诀王（9×9 全表 ≥ 95%）
  - ➕ 加法神速（20 以内加 ≥ 95%）
  - 🎯 全能口算（所有模块 ≥ 95%）
- 进度数据进 `db.fluencyAttempts`（新表）+ `db.fluencyStats`（新表），不动 `attempts` / `mastery`

### 估时：2-3 天

---

## Axis 1 · 大题营（多步应用题）

**目标**：新独立训练模式，专攻 2-3 步推理大题（25/26 题那种），**不混入今日挑战**。

### 关键决策（已确认）
- 新模式（不混 daily）— daily 15 题时长不能因此失控

### 模式设计
- 路由 `/math/big-problems`（跟 Train/Skills/Fluency 同级）
- 每 session 5 道大题，全 D3-D4
- 单题渲染必须真支持 `subquestions[]` 多步走（小题分步答 + 正确才解锁下一步）
- 不限时（大题需要思考）

### 题库改造
- generator prompt 加硬性约束：**D4 题至少 50% 含 subquestions**
- 用 Axis 4 的 add-skill.mjs / 现有 admin AI 出题，批量补 D3-D4 多步题
- 期中后估计需要补 60-100 道 D4 多步题铺底

### 题型覆盖（按试卷反推）
1. 购物算钱（单价 × 数量 + 加法 + 比较）— 总价 / 找零 / 够不够
2. 倍数追问（A=故事书, B=A×k1, C=(A+B)×k2）
3. 几何复合（长方形周长 → 长 / 宽 → 面积变化）
4. 求和均值（电费 6/7/8 月求和 / 求平均）
5. 逆向应用题（已知和差求其一）
6. 分段函数（运费：15 千克内 + 超出按 2 元/千克）
7. 平均数应用（已知平均求其中之一）

### 估时：1-2 天（前提是 Axis 4 已就位，否则 +1 天）

---

## Axis 2 · 画图 / 操作题（canvas 真画）

**目标**：试卷里的画三角形、点子图画平行四边形、按要求分图——`game_type` 库里完全没有，加 canvas 真画。

### 关键决策（已确认）
- **直接上 canvas 真画**（不做"识别版"妥协）
- 工程量大但 cover Selena 真实期末必需

### 题型设计
1. **点子图画平行四边形 / 梯形 / 三角形** — canvas + 网格点磁吸
2. **分图操作** — 给一个图形，画一条线分成两个梯形 / 一个平行四边形 + 一个梯形
3. **按角分类** — 给三角形 SVG，drag 到"锐角 / 直角 / 钝角 / 等腰 / 等边"分类盒
4. **画指定角度** — 量角器 UI（这个超期中范围，可选）

### 评判
- 点子图：连线坐标化 + 几何验证（边数 / 平行 / 边长比 / 闭合）
- 分图：分割点 + 分割后两半的形状判断
- 分类：直接对照 ground truth

### 估时：2 天（其中 1 天 canvas 框架 + 网格 + 磁吸；1 天具体 4 种题型）

---

## ⏸ Axis 5 · 试卷分析自动补题（暂停）

**状态**：当前多模态模型对中文小学手写试卷 OCR 准确率 70-85%，且不只是 OCR——还要真理解题型 +
skill 映射。**等多模态视觉能力上来再做**。

**临时人工方案**：父亲拍照 / PDF 试卷给 Claude（在 chat 里），Claude 人工分析 + 用 Axis 4
的 `add-skill.mjs` 或现有 admin AI 出题接口，补到对应 pack。**不在代码库占位置写废脚本**。

---

## 实施顺序（已确认）

1. **Axis 4 CLI 自动化** — 1.5-2 天 → 后面所有改动都受益。**今晚先动**（build-only 零 runtime 影响）
2. **Axis 3 Fluency** — 2-3 天 → Selena 用上几周内见效最快。代码先 ship，UI 入口用 feature flag 隐藏到 5/6 期中后
3. **Axis 1 大题营** — 1-2 天 → 用 Axis 4 generator 批量出题。同 feature flag 套路
4. **Axis 2 Canvas 画图** — 2 天 → 同 feature flag 套路

**总计** ~7-9 个工作日。

## Feature flag 约定

新模式入口（Fluency / 大题营 / Canvas 画图）入口在 navItems 里用 `subtle: true` 加个开关变量
`PHASE2_LIVE`（环境变量或 localStorage flag）控制是否对 Selena 可见。开发期父亲设备开启验证；
Selena 期中前完全看不到。期中考完 5/6 晚上 flip 开。

## 关键 invariant（开发时不能违反）

1. Fluency 数据**绝对不进** `attempts` / `mastery` / 现有 trophy / XP rating
2. 每加一个新 skill 都必须 bump `SEED_VERSION`（Axis 4 脚本自动做）
3. 大题题库的 `subquestions[]` 必须真渲染分步——不允许"折叠成一道大题一次性提交"
4. Canvas 答题必须有"我画完了"按钮 + 清空重画——不准时间到自动判（cognitive load 高）
5. 加新模式（fluency / 大题营）必须加进 `subject.navItems`，否则 mobile 底部导航看不到
