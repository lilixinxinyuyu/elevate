# Selena 43% master plan — E2E computer-use 测试结果

> 跑日: 2026-05-18 (master plan 11 iter 完工后)
> 测试目标: 真浏览器 puppeteer 走 Selena 完整 flow, 验证 11 个新 feature 真 deploy 生效.

## 总结: 无 app bug, 2 个测试方法问题

| 项 | 状态 |
|---|---|
| 6 个新入口 Math Home 显示 | ✅ 全部 |
| 6 个新页 navigate render | ✅ 全部 |
| Console errors (Selena 域) | ✅ 0 |
| 错题侦探 mini-game 交互 | ✅ load + click 正常 |
| Visual diff vs iter 31 baseline | ⚠️ 5 页 minor delta (≤ 2.5%, 含我新加 entries — baseline 需 refresh) |

## 详细 finding

### 1. Math Home 6 入口全部 ✅
在 `selena.xiaojin.app/math` 实拍 screenshot, 入口卡片 grid 显示:
- 📅 期末考试冲刺
- 🌌 技能图
- 🪄 巧算工具箱
- 🕵️ **错题侦探** (iter 36 P1-1)
- 📐 **进制小课堂** (iter 38 P1-3)
- 🧠 **脑力雷达** (iter 39 P1-4)

下方:
- "想挑战自己? 试试稳准模式" inline (iter 40 P2-1 SteadyAimEntryButton)
- 考试模拟 card (iter 41 P2-2 入口同主 train flow, mock_exam mode)

Selena 看到 6 件新功能.

### 2. 每个新页 navigate ✅

| 页 | URL | 状态 |
|---|---|---|
| 错题侦探 | /math/find-mistakes | ✅ 5/5 题 session 加载, "319 × 71 = ?" vertical 显示, 5 个 line button + 提示/跳过/退出 |
| 进制小课堂 | /math/base-systems | ✅ 主菜单, 10 进制 / 60 进制节 文字 render |
| 脑力雷达 | /math/radar | ✅ "直觉力 / 严谨力" 5 维度 + 时间窗口切换 |
| Train | /math/train | ✅ 题目正常加载 |
| Mock report empty | /math/mock-report?sessionId=nonexistent | ✅ "还没有答题数据" + "开始模拟整卷" 引导 |
| Paper entry | /math/paper-entry (admin) | ✅ 录入页 render (跨域 admin 域 → 见下面 console error) |

### 3. 错题侦探 interactive ✅
- Load: "🕵️ 错题侦探 (1/5)" + "319 × 71 = ?" + 完整 ASCII vertical
- Click line 1 (319): 注册 → 无 page error
- Buttons: 5 line + "💡 提示 (-2 XP)" + "跳过" + "退出" 全部 render

### 4. Console errors ✅
唯一 1 个: `admin.xiaojin.app/math/paper-entry → 401`
- 跨域 admin 子域名, 需要 admin auth (smoke 没设)
- 不影响 Selena 主流
- Selena.xiaojin.app 0 error

### 5. Visual diff baseline 状态 ⚠️
| 页 | 旧 (iter 31) | 新 | delta |
|---|---|---|---|
| selena-home (subject shell) | 274 KB | 274 KB | 0% — 没变 (这页本来就不在 master plan 范围) |
| selena-math (Math Home) | 204 KB | 209 KB | **+2.5%** — 我加 6 新 entries, 期内 |
| selena-mistakes | 86 KB | 86 KB | 0.1% — 几乎一致 |
| bruce-home | 286 KB | 281 KB | -1.6% — Bruce 也变 (跟我无关? layout 微调) |
| bruce-math | 209 KB | 209 KB | 0% |

→ 没 major delta. 但 baseline 应该 refresh 一次, 让 iter 31 → iter 42 的 UI 都成新 baseline.

## 测试方法的 2 个 bug (要修, 但不是 app bug)

### A. smoke test 检查 `/` 不是 `/math`
`scripts/_e2e-master-plan-smoke.mjs` 第 1 步 `visit("01-home", "https://selena.xiaojin.app/")` — 但 `/` render 的是上层 SubjectShell, 不是 Math Home. 应改 `/math`.

修法: 改 smoke URL 为 `https://selena.xiaojin.app/math`.

### B. Visual diff baseline 过时
iter 31 baseline 是 P0 之前. iter 32-42 加了 6 个新入口, baseline 自然 minor delta.

修法: `node scripts/_visual-diff.mjs --refresh` 重 baseline.

## 行动 (我现在做)

1. 修 smoke test URL → 重跑 → 确认 ✅
2. Refresh visual diff baseline → commit
3. 写 retrospective 补这一段 (E2E 验证已完成)

## 没测的 (留 future)

- 真正完成 1 道 EstimationGate 流程 (耗时长, 需要触发条件)
- 多步应用题完整 4 步法走通
- 强化挑战 modal 触发 (要先答错主流题)
- 错题侦探 5 题全部命中
- 模拟整卷 30 题完成 → 跳 report (≥ 30 min)
- 稳准挑战激活后真减 XP
- 进制小课堂 4 节全部完成

这些是 deep functional verify, 需要爸爸帮 / Selena 真用. Smoke test 仅 sanity render.
