# Feature Flag + Phase 2 Rollout 状态

> 写给未来的 Claude：每次都要重读 6 个文件才知道"什么是 feature-gated 的"
> ——这个 doc 集中说清楚。

## 唯一的 flag：`PHASE2_LIVE`

`src/lib/featureFlags.ts` `isPhase2Live(): boolean`

### 三种打开方式
1. **localStorage**（爸爸调试用，单设备）
   ```js
   localStorage.setItem('phase2_live', 'true')
   ```
2. **URL 参数**（一次性写进 localStorage）
   ```
   https://selena-elevate.pages.dev/math?phase2=on
   ```
3. **构建期**（全员默认开）
   ```bash
   VITE_PHASE2_LIVE=true npm run build
   ```

### 关闭
URL `?phase2=off` 或 `localStorage.removeItem('phase2_live')`。

## 当前 gated 内容（v0.31.x）

### Nav 项
**移动底部 nav（5 项）**：首页 / 闪电口算* / 今日挑战 / 闯关* / 错题复活
**桌面顶 nav（7 项）**：上面 5 + 专项练 / 技能树 + 周报(subtle) + 管理(subtle)

带 `*` 的 = flag-gated：
- **闪电口算** (`/math/fluency`)
- **闯关** (`/math/big-problems`)

flag off 时：nav 不显示这两项；路由强制走 ComingSoon。

参见：`src/subjects/math/index.ts` `buildMathNavItems()`

### 路由
`/math/fluency` / `/math/fluency/:moduleId` / `/math/big-problems`
都被 `Phase2Route` wrapper 罩着 → flag off 直接 ComingSoon。

参见：`src/router.tsx`

### Hero 上的 3 环
flag off：保持原 chip 行（10 天连续 / 累计 75% / 开始按钮）
flag on：`TodayRings` 同心 3 环（闪电口算 / 今日挑战 / 今日重点动态）

参见：`src/pages/Home.tsx` 三元判断

### 重命名（永久，不 gate）
不在 flag 内、永久变更：
- 自由练 → 专项练
- 技能地图 → 技能树
- 大题营 → 闯关（nav 短）/ 大题闯关（landing 大标题）
- 口算 → 闪电口算

## 当前 Phase 2 进度（截至 v0.31.9）

### Axis 4 · 加 skill CLI（基建）✅ ship
`scripts/add-skill.mjs` 一条命令端到端。
详见 `scripts/README.md`。

### Axis 3 · Fluency 闪电口算 ✅ ship（flag gated）
- 6 模块：5×5 / 9×9 / 19 内速算 / 20 内加 / 20 内减 / 100 内凑整
- DB schema v6 加 fluencyAttempts / fluencyStats（独立于主 attempts/mastery）
- 不进 XP / 段位（独立勋章雷达）
- 6 个跨模块 trophy（飞毛腿 30/50、连击 20/30、闪电反应、模块大师）

### Axis 1 · 大题闯关 ✅ ship（flag gated）
- 单元 gate：每 unit skill avg ≥ 75 才解锁本单元闯关
- 期末大闯关：6 印章齐 + G4B avg ≥ 70
- 11 枚 boss 印章
- URL `?unitId=G4B_U1` 限定单元
- 通过条件：5/5 中 ≥ 4 道对（accuracy ≥ 0.8）

### Axis 2 · Canvas 真画 ✅ ship（flag gated）
- 起步 1 模板：`dot_grid_draw` 点子图画图
- 7 种目标形状：parallelogram / rectangle / trapezoid /
  isosceles_triangle / equilateral / right / any_triangle
- 5 道 demo 题（DOT_DEMO_*）
- 后续：分图操作 / 三角形分类拖拽（未做）

### Axis 5 · 试卷分析自动补题（暂停）
等多模态视觉模型成熟。当前走"用户拍照 → 我分析 → 用 add-skill.mjs 补题"
人工通道。

## 期中考完后操作（5/6 后）

1. 父亲设备开 flag 完整体验一遍
2. 觉得 OK 后告诉 Claude
3. Claude 跑 `VITE_PHASE2_LIVE=true npm run build` 重新构建
4. 部署 → 所有用户默认开

### ✅ 已 flip — v0.31.10 (2026-05-06)
期中考 5/6 当天 flip。所有用户访问 `https://selena-elevate.pages.dev/math`
直接看到完整 Phase 2 nav（首页 / 闪电口算 / 今日挑战 / 闯关 / 错题复活）+ 3 环 Hero。
URL `?phase2=on` 不再需要。`?phase2=off` 仍可用于本地关闭（localStorage 优先级仍在）。

## 加新 flag-gated 功能 checklist

### Nav 加项
1. `subjects/math/index.ts` `buildMathNavItems()` 用 `if (isPhase2Live())` 包
2. 移动 vs 桌面：用 `desktopOnly: true` 控制（mobile bottom nav 最多 5 项）

### 路由 gate
1. `router.tsx` 用 `<Phase2Route>` 包页面元素
2. flag off 时路由组件自动 ComingSoon

### Hero / 主页内容 gate
1. 在 component 内 `const phase2 = isPhase2Live();`
2. JSX 三元 `{phase2 ? <NewWidget /> : <OldWidget />}`

### 数据库 schema 升级（独立于 flag）
flag 控制 UI 入口，但 schema 改动**永远立刻生效**——不要在 flag 里 gate
schema migration（会让 flag flip 时又跑 migration 出问题）。

## 历史教训

| 版本 | bug |
|---|---|
| v0.30.14 | feature flag off 但 SEED_VERSION 没 bump → 现有用户不下载新题 |
| v0.31.1 | flag off 时 mobile nav 还是 7 项挤爆 → 加 desktopOnly 字段 |
| v0.31.x | Selena 误开 flag 看到半成品 → URL `?phase2=on` 一次性写进 localStorage 是对的（不是 query string 必须每次带） |
