# Iter 37 P1-2 强化挑战 设计稿 (送预审)

> Selena 43% master plan P1-2. 原名 SkillRepair, 按 AUP 指南改 **强化挑战** (Strengthening Challenge).
> 评审独家提案: 错了一题立刻同型 3 题强化, 包装为正向"加练"而非"惩罚".

## 目标

让"答错"从挫败时刻 → 学习契机. Selena 错了一题后, 立刻给 3 道**同型变式**加练:
1. 强化错题对应 skill 的肌肉记忆 (避免"错过就忘")
2. 让她看到"我能解决这类题" 的进步感
3. 防止同一类型反复出错却没系统补强

## 触发条件

任意 attempt `isCorrect=false` 触发 (仅 1st attempt, 不在已有 retry 流之上再叠加).

显式排除:
- 考试模式 (examMode=true) 不弹
- Boss 战 (noRetry=true) 不弹
- 错题侦探 mini-game 内部 (不递归)
- multi-step 应用题 (本身已经是大题)
- 已经在 strengthen session 内不再弹 (不嵌套)

Feature flag: `strengthen_challenge_v1` (default ON).

## UI flow

### 1. 错答后温和模态 (FeedbackPanel 旁边或下方)

```
😅 这道题错了 — 来 3 道同型加练?
[ ✅ 来 3 题 (+25 XP if 全对) ]  [ 跳过 ]
```

10 秒后自动消失 = 跳过. 主流程继续走 retry / mistakes 添加.

### 2. 接受 → strengthen mini-session

```
🔁 强化挑战 (题 2/3) — 同型: 三位数 × 一位数
─────────────
[ 正常 GameShell 题目渲染 ]
─────────────
全对 3 题 = +25 XP 奖励 🎉
```

跟主 GameShell 完全一样的 UI, 只是 wrapped in StrengthenSession context (传 skill_id + difficulty 给生成器).

### 3. 完成 3 题 → 总结 + 回主流程

```
🎉 强化完成! 3/3 全对 +25 XP
[ 继续主练习 ]
```

部分对:
- 3/3 全对: +25 bonus
- 2/3 对: +12 bonus (一半奖励)
- 1/3 对: +5 bonus
- 0/3 对: 0 bonus + 鼓励文案 "这类题真的有点难, 我们多练几次"

## 同型 matching 算法 (用现有基础设施)

复用现有 `lib/sessionAdaptive.ts` 里的 `requestRetryQuestion` 接口 (它已经做 skill+difficulty 同型生成):
- 优先 DB 现有题 (排除当前 session 已答过的)
- 不够 → AI gen 同型变式

新加: 一次生成 3 题而不是 1 题. 加 `requestStrengthenSet(skill_id, difficulty, count=3)` API.

## 评分规则

- 每题正常走 scoreAttempt (复用现有逻辑, 估算/草稿/multi-step 该走都走)
- session 结束时根据正确数额外发 strengthening bonus:
  - 3 对 → +25
  - 2 对 → +12
  - 1 对 → +5
  - 0 对 → 0 (但 attempt 已计正常分)

Bonus 来源:
- 不存独立 attempt (per AUP doc: 整合后写, 不嵌大段)
- 通过 `awardBonusXp(studentId, 25, 'strengthen_complete')` 直接加到学生 XP 累计
- attempt.metadata.strengthen = { sessionId, idxInSession, totalQuestions }

## 实现拆分

### 新文件
- `src/core/strengthenPolicy.ts`:
  - `isStrengthenOpportunity(attempt)` — 判断是否可以弹模态
  - `STRENGTHEN_XP` 常量 (25/12/5/0)
  - `pickStrengthSkillContext(attempt, question)` — 决定 skill+difficulty
- `src/components/game/StrengthenModal.tsx` — 错答后小模态 (10 秒自动消失)
- `src/pages/Strengthen.tsx` — 3 题 mini-session 主页面 (复用 GameShell)
- `src/lib/sessionAdaptive.ts`: 加 `requestStrengthenSet(skill_id, difficulty, count)` 方法
- `tests/strengthenPolicy.test.ts` — XP + 触发判定

### 修改
- `src/components/game/GameShell.tsx` 的 FeedbackPanel: wrong 答案下方加 StrengthenModal 入口
- `src/pages/Train.tsx`: 完成 strengthen session 后跳回原 train flow (preserve session state)
- `src/router.tsx`: 加 `/math/strengthen` lazy 路由
- `src/lib/featureFlags.ts`: `isStrengthenChallengeV1`

### Out of scope
- 跨 session 错题强化 (留 P1-4 dashboard)
- 错题强化 streak / leaderboard
- 让 AI 出"故意稍难一点"的变式 (用现有 retry 同难度逻辑)
- 多步应用题的强化 (defer)

## 设计决策需要预审验证

1. **默认 3 题 vs 弹性 1/3/5**? 评审之前提过"修复挑战 1/3/5 默认 3". 实现弹性会让 modal 复杂. 我倾向硬 3 题简化 v1, 评审同意吗?
2. **10 秒自动消失** 合理吗? 太短会错过, 太长打断主流. 5? 15?
3. **同型 = skill_id + difficulty bucket**: difficulty bucket 是直接同 difficulty 还是 ±1? 同 difficulty 太严 (题库可能不够), ±1 可能不够"同型"
4. **跟错题队列 mistakes 的关系**: 接受强化 = 直接清掉 mistake (因为已经强化了)? 还是仍然进 mistake queue 走 spaced review?
5. **XP +25 全对**: 之前 estimation/multistep 都 +20. 强化只是同型再练, 给 +25 会不会过高?
6. **modal 触发频率**: 假如 Selena 一节课错 5 题, 弹 5 次, 累计 15 道强化题 + 主练 30 题 = 45 题, 太多. 要不要加 cap (每 session 最多弹 2 次)?
7. **跟 EstimationGate / ScratchInsurance 重叠**: 强化题进入后, 每题正常走 estimation/scratch gate? 还是 strengthen 内简化掉? 我倾向正常走, 但累计起来 UX 重?
8. **缺什么 corner case**?
9. **整体: 立即做 / 改后再做 / 不做**?
