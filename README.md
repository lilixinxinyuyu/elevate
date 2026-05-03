# Selena's Elevate · 数学挑战 (v0.8.1)

像 Elevate 一样的、给 Selena 一个人玩的数学游戏化训练 App。**已上线 https://selena-elevate.pages.dev**（Cloudflare Pages + D1 云同步），本地优先 + 多设备无缝同步。

> 部署 / 升级流程见 [DEPLOY.md](./DEPLOY.md)，日常更新跑 `./deploy.sh` 即可。

## 当前状态（v0.8.1）

- **生产 URL**：https://selena-elevate.pages.dev
- **22 种奖杯**（含计数式 ×N），分布在里程碑 / 连击 / 技能领域 / 掌握度四类
- **14 个游戏模板** + 兜底 2 个 = **16 套互动**（v0.7 新增立体观察、三角形法庭，全 SVG 视觉）
- **~225 道题**（含 ~85 道试卷错题包），每个 skill 都有题，难度 1-4 都覆盖
- **试卷错题包**：把 Selena 真做的 U2 / U3 / U4 三张过关检测卷上的所有题（错题优先）+ 同类变式都收录到游戏里，错题打 `wrong_origin` 标签调度器优先抽
- **图形题真带图**：U2 三角形分类 / 等腰特殊 / 三边判定走 `triangle_judge`，U4 立体观察 / 三视图配对走 `cube_view`，**和试卷一模一样的视觉训练**
- **掌握度门槛**：一道题连续答对 3 次后暂退主调度池，30 天后回炉抽查 → **不会重复刷已经会的题**
- **题库快用完时主动提示**：首页弹「Selena 你都很熟啦，让爸妈给你出新题吧」卡片，一键跳 AI 出题
- **期中冲刺模式** `/train?mode=midterm`：锁定下册 1-4 单元，错题 25% + 每单元 ≥ 3 道
- **多设备云同步**：Cloudflare Pages Functions + D1 SQLite。完成挑战自动上传，新设备输密码自动拉取最新进度
- **PWA**：可"添加到主屏幕"作为应用启动，紫粉渐变图标
- **密码门**：单密码（`APP_PASSWORD` env var）保护，HTTPS + Bearer header
- 本地 IndexedDB（离线也能玩），`/admin` 一键 "只清空进度数据" / "完全清空" / 手动同步

## 游戏感卖点

- **3·2·1·Go!** 全屏倒数动画进入挑战
- **倒计时条** + **连击 Combo** + **XP 飞动** + **完成宝箱**
- **多级提示**：每题 1-3 级；不点拿满分；点 N 次扣 N 分
- **应用题分步**：clue_pick（挑真线索）→ choose（选关系）→ numeric（4 选 1）
- **错误温柔反馈**：摇一摇 + 鼓励文案，不出现"错了""失败"

## 14 个游戏模板

| 模板 | 中文 | 节奏 | 主要适用 |
|---|---|---|---|
| `speed_match` | 闪电匹配 | 5-10 秒 | 口算 / 概念判断 |
| `shop_counter` | 小数商店 | 30-60 秒 | 应用题（线索→关系→数字） |
| `equation_builder` | 方程拼装 | 30-60 秒 | 列方程 |
| `clue_finder` | 线索侦探 | 15-30 秒 | 应用题读题训练 |
| `sort_ladder` | 数字阶梯 | 15-30 秒 | 大小比较 / 排序 |
| `true_false_swipe` | 对错冲刺 | 3-5 秒 | 概念真假快判 |
| `vertical_repair` | 竖式修理厂 | 15-30 秒 | 修理错误竖式 |
| `decimal_shifter` | 小数点滑梯 | 15-25 秒 | 小数点扩大/缩小 |
| `memory_match` | 记忆配对 | 30-60 秒 | 等价对配对 |
| `shape_court` | 图形法庭 | 15-25 秒 | 三边能否围成（带 SVG 图） |
| `triangle_judge` ⭐ | 三角形法庭 | 15-30 秒 | 三角形分类 / 等腰周长 / 边角推理（按角度/边长画三角形） |
| `cube_view` ⭐ | 立体观察 | 20-40 秒 | 立体图形 ↔ 三视图（带 3D 等轴侧 SVG + 2D 网格） |
| `balance_lab` | 天平实验室 | 30-60 秒 | 解方程（两边操作） |
| `chart_detective` | 数据侦探 | 30-45 秒 | 拖虚线找平均/最大值（条形图） |

## 入口

- 首页 `▶ 开始今日挑战`：自动选 8-12 道，**遗忘曲线 + 薄弱 + 错题 + 真题错题加权**算分
- 首页 `⏰ 期中冲刺`（蓝色卡片）：下册 1-4 单元混合 15 道
- `/picker` **自由练**：技能多选；默认勾选 4 个最弱
- 技能地图每张 skill 卡 `▶ 练` 直接训练该 skill
- `/train?mode=final_sprint` 期末冲刺（下册全单元重点）
- `/train?mode=midterm` 期中冲刺（下册 1-4 单元）
- `/mistakes` 错题复活

## 22 种奖杯

**单次型**：第一步 / 三天小火苗 / 一周连胜 / 月度恒星 / 答题 50/200/500 题 / 购物高手 / 初识掌握 / 稳扎稳打 / 数学大师

**计数型**（×N 显示）：今日完成 / 五连击 / 十连神 / 终极爆发 / 错题复活王 / 疾风手 / 独立思考 10 连 / 小数小英雄 / 方程小专家 / 平均数侦探 / 三角形法官

每种奖杯首页奖杯柜以小图标显示；右上角红色 `×N` pill 标记累计获得次数。

## 关键算法

- `core/scheduler.ts`：
  - `pickScore = forgetting + weakness + overdue + priority − fatigue − duplicate − wrong_origin_boost − from_test_boost`
  - 最终 shuffle，相同 skill 不连续超过 2 题
  - **30 天内做对的题不重复**
  - **单题 mastered 门槛**：连续 3 次答对 + 最近一次 < 30 天 → 暂退主池；30 天后回炉
  - **midterm 模式**：锁定 G4B U1-U4，错题 25% + 每单元 ≥ 3 道
  - 返回 `poolStarved + starvedSkillIds`，UI 据此提示"找家长加题"
- `core/scoring.ts`：base × difficultyMul × correctFactor + timeBonus + hintPenalty + reviewBonus，再乘 comboMul
- `core/grading.ts`：数字判分**忽略单位**（"22.8" / "22.80" / "22.8 元" / "22 元 8 角" 都对）
- `core/spacedReview.ts`：1/3/7/14/30 天间隔
- `core/trophies.ts`：单次 (`check`) 与计数 (`tier`) 双模式，自动补差额

## 技术栈

- Vite + React 18 + TypeScript（端口 5174）
- Dexie (IndexedDB) — 48 测试 ✅
- Zod 校验
- Tailwind CSS（深色 + 霓虹渐变 + 自定义动画 keyframes）
- Web Audio 合成音效（无第三方）
- Vitest + fake-indexeddb

## 运行

### 给 Selena 日常用（推荐）

**方式 1：双击启动（最省事）**

项目根目录有两个 `.command` 文件，**双击**就能启动 + 自动开浏览器：

| 文件 | 用途 | 启动慢/快 |
|---|---|---|
| `start.command` | 开发模式（带热重载，改代码立刻生效） | 慢一点，每次跑都重新编译 |
| `start-fast.command` | 生产模式（已编译好，启动快、流畅） | 快，**给 Selena 长期玩用这个** |

第一次双击会自动 `pnpm install`（约 30 秒），之后秒开。
关掉就在弹出来的终端窗口按 `Ctrl+C` 或直接关掉窗口。

> 把 `start-fast.command` 拖到 Mac Dock 或 Desktop 做替身，给 Selena 一键启动。
> Mac 第一次双击会问"无法验证开发者"，到 *系统设置 → 隐私与安全性* 里点"仍要打开"即可，以后就不会再问。

**方式 2：iPad / iPhone 远程玩**

启动后终端会显示 Network 地址，比如 `http://192.168.8.143:4173`。同 Wi-Fi 下：
1. iPad 浏览器打开这个地址
2. Safari → 分享 → "添加到主屏幕"，就有一个图标可以像 App 一样打开

> Mac 必须在开机+脚本运行时才能用。要做完全独立部署见下。

### 命令行（开发用）

```bash
pnpm install
pnpm dev          # 开发，http://localhost:5174
pnpm preview      # 生产预览，http://localhost:4173（先 pnpm build）
pnpm test         # 48 个用例
pnpm typecheck
pnpm build
```

### 部署到云端（不用每次开 Mac）

任意静态托管都能跑（不需要后端）。最便宜的两个：

- **Cloudflare Pages**：连接 GitHub 仓库 → 自动 build → 给一个免费 `*.pages.dev` 域名。Selena 用 iPad 任何时候都能玩。
- **Vercel**：同上，免费额度足够个人用。

构建命令 `pnpm build`，输出目录 `dist/`。所有数据仍在 Selena 自己浏览器的 IndexedDB 里，云端只托管静态文件。

## AI 出题

`/admin` 页 → "AI 出题 Prompt 生成器"，选单元 / 技能 / 数量 / 难度，自动生成一段含**完整 Schema + 单题示例**的 prompt。复制粘到任何 LLM 拿到 JSON 数组，回到管理页"导入题目 JSON" 粘贴即可。校验失败的题会列出具体字段错误。

## 隐私

数据全部 IndexedDB 本地存储，不发送任何后端。`/admin` 可一键清空进度（保留题库档案）或完全清空。

## 文档

- `heping_math_prd_v2.md` — 全量 PRD v2（含设计、模板候选、奖杯系统）
- `heping_math_prd_engineering_v1.md` + `heping_math_content_design_v1.md` — 历史 v1 PRD
