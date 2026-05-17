# Selena 43% 数学期中 — 教学法重设计 Master Plan

**起因**: Selena (G4B, 10 岁, 锦江和平街) 2026 春期中数学得 43%. 现有游戏化训练系统 (7000+ attempts, ~85% 速算正确率, 一堆勋章) 没有迁移到真题考场, 严重信号:
- "快奖" 训练出 System-1 反射, 但真题要 System-2 多步推理
- 选择题压倒填空 → "猜的"也算对, 没培养表征
- 多步骤应用题 zero — 真题里大段 30%+ 是
- SpeedMatch 反复 reinforce 一位数 + 简单进位的"快感", 但真题要四位数 ÷ 两位数 + 单位换算 + 时间钱币转换
- 没有 "草稿/估算/检查" 元认知训练
- 没有错题 same-type +5 巩固机制

**目标**: 把"游戏快感系统"重构为"考场迁移系统" — 留住激励, 加上认知脚手架.

**三方共识** (Gemini-3-pro + GPT-5.4 + 自分析):
1. 不是粗心, 是认知负荷过载 (working memory overflow)
2. 速度奖励有毒 — 必须替换为准确度奖励
3. 必须加 estimation gate (估算先) + scratch lock (强制草稿) + multi-step (应用题分步)
4. 删多数选择题, 改填空
5. SpeedMatch: 简单题留, 多步题禁

---

## P0 (核心 — 必须做, 4 件)

### P0-1. Estimation Gate (估算先)
**问题**: Selena 看到 312 × 47, 直接抄题 + 算 → 错就错到底.
**方案**: 多位数计算 (≥2 位 × ≥1 位 OR ≥3 位 ± ≥3 位 OR 任何 ÷) 必须先答:
- "答案大约是几位数?" (个/十/百/千/万)
- "答案 ≈ 多少?" (3 个选项: 真值 / 真值×10 / 真值÷10) — 这里少数选择题留着是因为估算就是模糊比较
- 答对估算才解锁真值填空

**实现**: 新组件 `EstimationGate.tsx` wrap 在多位数计算题外层. 题目元数据加 `requiresEstimation: boolean` (heuristic: digits ≥ 3 或有除法).

**XP 奖励**: 估算对 +5 XP, 真值对 +10 XP. 估算错可以重试 (不扣 XP), 不解锁就练不下去.

**与 SpeedMatch 关系**: SpeedMatch 模式 disable estimation gate (因为 SpeedMatch 只跑简单题). EstimationGate 只在 ProblemSet 模式生效.

### P0-2. Scratch Lock (强制草稿)
**问题**: Selena 心算多位数, working memory 溢出.
**方案**: 多位数计算题打开 canvas/text-area, 必须涂或写至少 N 字符才能提交答案. 草稿不评分 (隐私 + 不增加压力), 只检测有内容.

**实现**: 新组件 `ScratchLock.tsx` (touch-friendly canvas + 文本框 fallback). `requiresScratch: boolean` 题目元数据. 复用现有 IndexedDB persist 暂存草稿到 attempt 记录里 (将来 admin 可以看到她怎么算的).

**回退**: 单击"我已心算确认" 按钮 5 秒倒计时, 如果点了视为 override, attempt 标 `scratchOverride: true` (admin 报表里能看哪些题她跳过了).

### P0-3. Multi-Step Applications (应用题分步框架)
**问题**: 现有应用题就一个答案框 → Selena 跳步 → 一个数错全错.
**方案**: 应用题强制 4 步:
1. **已知** (输入框): 把题目里的数字 + 单位填进来
2. **求** (输入框): 求什么单位的什么
3. **算式** (输入框): 写出列式 (支持 +/-/×/÷ 简单格式)
4. **答** (数字框): 最终答案 + 单位

每步答错独立反馈. 任一步错不影响下步继续 (但终答错全步标黄 → review).

**实现**: `MultiStepProblem.tsx`. 现有应用题数据 schema 加 `solutionSteps: {given, ask, equation, answer}` 字段. 旧数据没有的题, 后台脚本一次性 LLM 反推填充 (用 token-plan workflow).

**XP**: 4 步全对 +20 XP. 3/4 对 +10. 终答对但中间步骤错 +5 (说明蒙对了, 不奖太多).

### P0-4. Reverse Reward (反向奖励 — 准确优先版)
**问题**: 现有 SpeedMatch + ProblemSet 都"答对+答快 = bonus XP", 训练快感.
**方案**: 拆 XP 公式:
- **准确**: 答对 +10, 答错 -2 (现在是 +5/-0)
- **稳健**: 连对 5 题 +15 streak (现在是连对 3 +10)
- **从容**: 用时 > 平均时长 1.5× 且对 → +3 "深思 bonus"
- **取消**: 快速答对的 +bonus

**实现**: `src/core/scoring.ts` 重写 scoreAttempt(). feature flag `accuracy_first_v1` 罩 (默认 on, 可以关回老逻辑做 A/B).

**注意**: SpeedMatch 模式独立 scoring (那里"快"还是 metric, 但只限简单题).

---

## P1 (重要 — P0 完了接着, 4 件)

### P1-1. Debugger Mode (找 bug)
**问题**: Selena 看错号 (× 看成 +), 没有 "校验答案" 元认知.
**方案**: 新 mini-game. 给出一道竖式计算 (已经算完, 有错). Selena 任务: 点错误那一步.
**例子**:
```
   312
×   47
------
  2184    ← 错: 312 × 7 = 2184 ✓
 1208     ← 这步是错的, 312 × 40 应该 = 12480
------
 14264
```
她点中间那行, +15 XP. 错点 -3.

**实现**: `DebuggerMode.tsx` 路由 `/math/debugger`. 题库: 后台 LLM 生成 (基础竖式 + 故意错某一步). Cap 20 题, 滚动复用.

### P1-2. 同型 +5 (错题后立刻同型再练 5)
**问题**: Selena 错了一题, 现有系统下一题随机给, 没强化薄弱点.
**方案**: 错任意一题 (任何模式), 触发 modal "你刚错了一题, 来 5 道同型练一下?" 接受 → 进入 同型 mini-set (5 题, 全对 +25 XP). 拒绝 → 错题进入 mistakes 队列 (按现在的流程).

**实现**: 给 `useProblemSet` hook 加 `onWrongAnswer` 回调. SameTypeBoost.tsx 组件. 同型识别: skill_id + difficulty bucket (简单/中等/难).

### P1-3. 减选择题 (转填空)
**问题**: 选择题让 Selena 蒙对率 25%, 不练表征.
**方案**: 全题库扫一遍. 规则:
- 单一计算题 (1+1, 9×7) — 强制填空, 取消选项
- 文字题 — 保留多选, 但选项混淆度提高 (例如 312+47 答案是 359, 选项现在可能是 [359, 35.9, 360, 312], 改成 [359, 369, 349, 412] — 都是计算时可能犯的错的结果)

**实现**: 后台 migration script `aliyun-deploy/scripts/_convert-choice-to-fill.mjs` — 跑一次, 筛 question_bank 里 `type: single_choice` + skill_id 在简单计算列表里的, 改 `type: numeric`.

### P1-4. 单位换算按进制讲 (元认知)
**问题**: Selena 把 1 小时 = 100 分钟 (混淆十进制和六十进制).
**方案**: 新 micro-lesson 模块 `/math/unit-systems`:
- 长度/重量/容量 — "都是十进制, 跟数字进退位一样"
- 时间 — "60 进制, 60 秒 = 1 分, 60 分 = 1 小时, 12/24 进制要看上下文"
- 钱 — "10 进制 (元/角/分)"
- 角度 — "60 进制 (度/分/秒)" — 五年级会教

每个模块: 概念卡 + 10 题练习. 完成解锁单位换算 trophy.

**实现**: 已有 unit-conversion skill, 加 lesson 前置. `src/lessons/UnitSystems.tsx`.

---

## P2 (升级 — P0/P1 完了再做, 3 件)

### P2-1. Sniper Mode (反向 reward 激进版)
**问题**: 普通 Reverse Reward (P0-4) 还是"快也不扣分". Sniper Mode 主动把"快"变"罚".
**方案**: 进入 Sniper Mode 后, 提示"现在 慢就是赢. 用时低于平均 1× 答对的, 不给 XP 反而扣 -5".
- 答对 + 用时 ≥ 平均 1.5× → +20 XP "狙击手 bonus"
- 答对 + 用时 < 平均 → -5 XP (惩罚冲)
- 答错 → -2 XP (标准)

仅限自愿模式 (Selena 选择进入, 退出门外). UI 红色警告 banner.

**实现**: `SniperMode.tsx`. feature flag `sniper_mode_v1`. 默认 off, Selena 可以从 settings 开. 爸爸警告: 短期会让 Selena 挫败.

### P2-2. 模拟整卷 (mock exam)
**方案**: 拼一份 30 题模拟卷 (从所有 G4B 题型抽样, 难度梯度), 60 分钟限时, 模拟期末考场体验. 结束给出真实分数 + 错题分析 + 推荐复习路径.

**实现**: `MockExam.tsx` 路由 `/math/mock-exam`. 月一次解锁. 后台 LLM 组卷.

### P2-3. 试卷 OCR (个性化补漏)
**方案**: 爸爸 / 老师上传真试卷照片 → 后台 dashscope qwen-vl-max OCR → 提取题目 + 学生答案 → 自动判错 + 错题转为同型练习推到 Selena 个性化队列.

**实现**: SuperAdmin 加 "上传试卷" 入口 (已有 textbook upload pipeline 改造). OSS 存 + DashScope 处理 + 写回 user-specific question bank.

---

## SpeedMatch 政策更新

**保留 SpeedMatch 的题型**:
- 个位数加减法 (1-20 内)
- 个位数乘除法 (九九乘法表)
- 简单倍数/约数判断
- 单步整数比较

**禁用 SpeedMatch 的题型**:
- 两位数以上加减
- 多位数乘除
- 带括号 / 多运算符
- 任何单位换算
- 任何应用题

**实现**: `src/games/SpeedMatch.tsx` 加 problem-type whitelist. 不在白名单的题, SpeedMatch 模式不抽.

---

## ⚠️ Peer Review 后的 plan 调整 (2026-05-18 iter 31 收尾)

Master plan 经 Gemini-3-pro + GPT-5.5 双 peer review (reasoning-high) 后**核心调整**:

### 新增 P0-0 (前置封堵 — 必须先做)
原因: Gemini + GPT 一致警告 — 不堵这三个口, 后面所有脚手架等于白上.

- **P0-0a Reverse Reward**: scoring 重写, 取消快奖. 同时加 "答太快请检查估算/单位" 温和提示 (不等 Sniper)
- **P0-0b SpeedMatch 白名单**: 题目元数据 backfill (`speedEligible/opCount/digitsMax/hasUnit/hasStory`), 未知 metadata 默认禁入 SpeedMatch, 加 CI 测试防回归
- **P0-0c Choice → Fill**: 单步简单计算题 (个位数 +/-/×/÷) migration 为填空

### 各 piece 设计调整
- **Estimation Gate**: 不问"几位数" (易盲猜), 改 "四舍五入估算法": "把 312 看作 (300), 47 看作 (50), 估算 300×50 = (15000)". UI 用 "几十/几百/几千/几万" 卡片 + 数轴
- **Scratch Lock → Scratch Insurance**: 不强制 N 字符. 用了草稿且错了 → 免扣分. 提供工具选择 (竖式/分步/画图/估算). "我已心算确认" 每日 3 次配额
- **Multi-Step Application**: "已知/求" 改拖拽题干数字 (不全靠打字), "算式" 才打字. 允许中间量 / 数量关系图
- **同型 +5 → Skill Repair Mode**: 改 "修复这个技能: 1/3/5 题挑战", 默认 3. 先 2 题拿回错题损失, 余 3 题进今日任务
- **Sniper Mode**: 默认 OFF, 自愿挑战入口. 不主动扣"答对快"分 (10 岁觉得不公平)

### 新增 P1-4 Brainpower Radar (Gemini + GPT 都点名)
Selena 可见 dashboard — 不只显示分数, 显示:
- 估算命中率 / 草稿使用率 / 多步题完成率 / 同型 retain 率 / 单位 mastery
- 包装成 "脑力雷达图" — 闪电之力 (反应快) vs 泰坦之盾 (准确深度) — 把规则变化包装成 "游戏新资料片升级"

### iter 数压到 11
P0-0 三件可并行 (scoring + SpeedMatch + migration 互不冲突). 后端 / 前端 wrapper 可同步.

---

## 实施顺序 + workflow

爸爸要求: **每个 piece 做之前送 peer review (8787 + 8788), 做完之后再让两个 model 验收.**

**Iteration 模板** (每 P 一个 iter):
1. 详细设计 piece X (本文档已经粗略, 实现时细化)
2. 送 8787 + 8788 预审 — 改进 design
3. 实现 + build + deploy
4. visual diff 验证 (`scripts/_visual-diff.mjs`)
5. 送 8787 + 8788 终审 — 检查 bug + 体验
6. 修 + commit

**预计 iter 数**: P0 4 iter + P1 4 iter + P2 3 iter = 11 iter. 加 SpeedMatch 政策更新 + 文档收尾 = 13 iter. 估 v0.34.98 → v0.35.10 一波.

**版本编号 (peer-review 后)**:
- v0.34.98 (iter 32) **P0-0 trio**: Reverse Reward + SpeedMatch 白名单 + Choice→Fill migration
- v0.34.99 (iter 33) P0-1 EstimationGate (四舍五入估算法)
- v0.35.0  (iter 34) P0-2 ScratchInsurance (软锁)
- v0.35.1  (iter 35) P0-3 MultiStepApplication (拖拽数字 + 算式打字)
- v0.35.2  (iter 36) P1-1 DebuggerMode (找 bug)
- v0.35.3  (iter 37) P1-2 SkillRepair (1/3/5 默认 3)
- v0.35.4  (iter 38) P1-3 单位换算按进制
- v0.35.5  (iter 39) P1-4 Brainpower Radar (Selena dashboard)
- v0.35.6  (iter 40) P2-1 SniperMode (自愿)
- v0.35.7  (iter 41) P2-2 模拟整卷
- v0.35.8  (iter 42) P2-3 试卷 OCR
- v0.35.9  (iter 43) retrospective + 评估指标

---

## 评估指标 (实施后 2 周后回看)

- **真题正确率**: Selena 做新一份 mock exam, 目标从 43% → 60% (短期), 75% (3 个月)
- **多步题完成率**: 现在多步题大量留空, 目标 100% 至少尝试
- **平均答题时长**: 简单题应该不变, 多位数 / 应用题应该明显变长 (说明真在思考)
- **错题 retain 率**: 同一道题 (同型) 2 周后再做, 对错率提升
- **Selena 主观体验**: 爸爸 weekly 询问 — 是否觉得变难/无聊/挫败, 调整 XP 系数

---

**文档版本**: v1.0 (2026-05-18, iter 31 完之后, 由 master plan 直接进入 iter 32 P0-1)
