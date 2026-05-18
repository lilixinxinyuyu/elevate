# Iter 40 P2-1 稳准挑战 设计稿 (送预审)

> Selena 43% master plan P2-1. 原名 SniperMode → "**稳准挑战**" (AUP 指南).
> 评审独家提案: 主动反转 reward — 答对但太快 → 扣分, 答对但够慢够稳 → 大奖.
>
> ⚠️ **风险**: 短期对快感型选手 (Selena) 极挫败. 必须自愿开启 + 随时退出.

## 目标

iter 32 P0-0a 的 "Accuracy-First" 是被动 (扣快奖). 稳准挑战 是主动版:
- Selena 主动选择进入 (设置开启) — 不强加
- 进入后所有题走逆向: **答对 + 用时 < 平均 0.5×** → -5 XP "太冲了"
- 答对 + 用时 ≥ 1.5× → +20 XP "稳准 bonus"
- 答错 → -3 XP (正常扣, 跟 main train 一样)

训练目标: 让 Selena 把"快感" 神经回路反转 — 短期挫败, 长期能力.

## UI 流程

### 入口 (设置页 or Home 角落)
不放数学 home 主区域 (避免 Selena 误点). 放在:
- **设置** 页有个开关: `[ ] 稳准挑战模式 (高难度)`
- 旁边说明: "答得快 = 扣分, 答得稳 = 奖励. 不适合心情不好的时候."

或者:
- 数学 home 底部小字按钮 "想挑战自己?" → 弹模态详解 → 选择开启

### 开启后
- 整个 Train session 顶部加红色 banner: "🎯 稳准挑战中 (答快会扣分)"
- 每题答完反馈显示新 tier:
  - ratio < 0.5: ❌ -5 XP "太冲了, 稳一稳"
  - ratio < 1.5: 0 (中性)
  - ratio ≥ 1.5: ✨ +20 XP "稳准!"
  - 答错: -3 XP "稳准 mode 错答" (跟主流一样)

### 退出
- banner 上有 "退出挑战" 按钮 - 立刻关
- 关掉后 session 内剩余题恢复正常 scoring
- 已 ship 的 -5/+20 不追溯

## 评分整合

跟 iter 32 P0-0a 关系:
- P0-0a Accuracy-First (默认 ON) — 取消快奖, 慢 +5 (不强罚)
- P2-1 稳准挑战 (默认 OFF, 自愿) — 主动罚快, 大奖 +20

实现复用 `scoreAttempt` 的 `speedBonusAccuracyFirst` — 改 ratio 阈值:
- AccuracyFirst (P0-0a): too_fast → 0, deep_think → +5
- SteadyAim (P2-1): too_fast → **-5**, deep_think → **+20**

通过 feature flag `steady_aim_active_session` (sessionStorage, 只在当前 session 有效, 关 tab 清):
- localStorage = 长期偏好 (off)
- sessionStorage = 当前 session 在挑战中

`speedBonusAccuracyFirst` 加 mode 参数:
- "default" (AccuracyFirst, 现有): 0 / 0 / +5
- "steady_aim" (P2-1 新): -5 / 0 / +20

## 实现拆分

### 新文件
- `src/core/steadyAimPolicy.ts`:
  - `isSteadyAimActive()` (sessionStorage check)
  - `activateSteadyAim()` / `deactivateSteadyAim()`
  - `STEADY_AIM_XP` 常量 (太快 -5, 深思 +20)
  - `getSteadyAimXp(ratio): { xp, label }` (跟 speedBonusAccuracyFirst 同形)
- `src/components/SteadyAimBanner.tsx`: Train 页顶部红色 banner + 退出按钮
- `src/components/SteadyAimToggle.tsx`: 设置入口 (开关 + 警告)
- `tests/steadyAimPolicy.test.ts`

### 修改
- `src/core/scoring.ts`: scoreAttempt 内 检查 isSteadyAimActive, 若是用 getSteadyAimXp
- `src/components/game/GameShell.tsx`: render SteadyAimBanner 在 Train 顶部 + feedback 标签
- `src/pages/Settings.tsx` (或新建 Math 设置入口): 开关 + 警告对话框
- `src/lib/featureFlags.ts`: `isSteadyAimChallengeV1`

### Out of scope
- AI 出"专门考耐心的题" (复用现有题库)
- 跨 session 持久挑战 (sessionStorage 即可, 关 tab 退)
- Leaderboard / streak (不要再叠加压力)

## 设计决策需要预审验证

1. **入口位置**: 设置页 vs Home 角落小按钮? 哪个更适合自愿但不被误点?
2. **+20 XP for 慢对**: 跟 estimation/multistep (+12/+20) 比是否过高? 跟 normal train 单题 (10-30) 比?
3. **-5 XP for 快对**: 会不会让本来要"快感答题"的 Selena 直接退出整个 app?
4. **退出 banner 在哪**: 红色 banner 一直在顶部跟 noRetry 等已有 banner 是否冲突? 还是浮动右下角?
5. **跟 EstimationGate / ScratchInsurance / MultiStep 关系**: 稳准模式下这些 gate 还触发吗? 还是 quiet mode 简化?
6. **首次开启提示**: 第一次开 banner / dialog 提示什么? 怎么劝退"心情不好的时候"?
7. **缺什么 corner case**?
8. **整体: 立即做 / 改后再做 / 不做**?
