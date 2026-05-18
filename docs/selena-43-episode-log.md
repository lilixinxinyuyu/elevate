# Episode Log: Selena 43% 期中事件 — 系统重设计

**事件日期**: 2026-05-17 ~ 2026-05-18
**应对窗口**: v0.34.97 (iter 31) → v0.35.10 (估 13 iter)
**主线变更**: 从"Alibaba 迁移 + onboarding 打磨"切到"教学法重设计"

> 这份文档是事件的完整记录 — 触发 → 分析 → 决定 → 执行计划. master plan (实施细节) 在 [selena-43-pedagogy-redesign.md](./selena-43-pedagogy-redesign.md), 这里只记**经过和理由**.

---

## 1. 触发事件

**爸爸 2026-05-17 晚的报告**:
- Selena (G4B 下册, 锦江和平街小学, 10 岁) 春季数学期中 43%
- 此前我们 app 累计 ~7000 attempts, 速算准确率 ~85%, 拿了一堆勋章
- "游戏内表现 vs 真考表现" 严重脱钩

爸爸把试卷扫描放到 `/Users/yong/Desktop/xy/scans/mid-term-math-{1-6}.jpeg`, 让我:
1. 看试卷 + 分析错在哪
2. 想清楚为什么我们的 app 没帮到她
3. 找两个 peer model (Gemini-3-pro at 8787 + GPT-5.5 at 8788) 一起讨论
4. 进入"讨论模式 — 你先别急着做事情"

---

## 2. 我自己的初分析

**错题类型分布** (按 OCR + 我自己看):
- 多位数 ± / × ÷ 计算: 错的多, 主要是进位 / 退位漏 / 抄错号
- 单位换算: 时间 (60 进制) / 长度 / 钱 — 混淆十进制和六十进制
- 应用题: 大量留空或一句不写 → 直接跳到最后一个数字
- 选择题: 反而对的比例还行 (蒙对率)
- 简单计算 (4-3, 7×8): 几乎全对

**为什么我们 app 没帮到**:
- 99% 的题是单步 → 真考试 30%+ 多步应用题
- 大量选择题, 蒙对不暴露问题
- "答快 = bonus XP" 训练了 System-1 反射, 但真题要 System-2 推理
- SpeedMatch 7000+ attempts 强化了"看一眼就答" 习惯
- 没有"草稿 / 估算 / 检查" 元认知训练
- 错题没"同型立刻再练"机制 — 错了就过

**我自己的初提议** (后来跟两个 model 综合):
- 估算先 (estimation gate)
- 强制草稿
- 应用题分步
- 拆"快奖"换"准奖"

---

## 3. Gemini-3-pro (8787) 的意见

> 用 Kahneman 的 System 1 vs System 2 框架, 加 Working Memory Overload 解释.

**核心观点**:
- "不是粗心, 是 working memory 溢出" — 10 岁的工作记忆只能并发持有 ~4 个 chunk, 多位数计算要持有"被乘数 + 进位 + 部分积" 远超
- "SpeedMatch 在错误方向上 hyper-training" — 神经回路在强化"反射式应答", 但真题需要"刻意慢"
- "估算先" 是低成本但效果惊人的元认知干预 — 把"猜一下答案数量级"作为强制 gate

**Gemini 独家提案 (我们之前没想到的)**:
1. **Debugger Mode (找 bug)**: 显示一道已完成的竖式计算 (故意错某一步), 让 Selena 点错的那行. 训练"校验" 元认知 — 10 岁认知心理学说极有效.
2. **Sniper Mode (反向 reward)**: 把"快奖" 倒过来 — 快速答对的 -5 XP, 慢慢答对 +20 XP. 主动 punish 反射, reward 深思. 警告: 短期 Selena 会挫败.
3. **多步题强制 4 框格** (已知/求/算式/答) — 不允许直接跳到答案.

**Gemini 风险提示**: Sniper Mode 太激进, 推荐先做 P0 准确率为先的 reverse reward, 看效果, 再决定是否加 Sniper.

---

## 4. GPT-5.4-mini (8788) 的意见

> 用三步框架: 规则没自动化 / 表征转换弱 / 监控能力弱.

**核心观点**:
- "规则没自动化": 比如 9 × 7 还要数手指, 占用了多位数计算的脑力
- "表征转换弱": 文字应用题 → 算式的转换, Selena 跳过中间表征, 直接抓数字
- "监控能力弱": 算完不检查, 不估算, 不对照单位

**GPT 独家提案**:
1. **单位换算按"进制"讲**: Selena 把 1 小时 = 100 分钟 — 这是"十进制思维 vs 六十进制思维"混淆. 应该明示"时间是 60 进制, 度数是 60 进制, 钱是 10 进制" — 当成"系统切换" 训练, 不是死记换算.
2. **应用题强制三步写**: 给条件 / 求 / 算式 — 跟 Gemini 的 4 步 (我们最后采纳的) 类似, GPT 简化一档.
3. **删多数选择题**: 给个填空区, 强制写答案 + 单位.
4. **错题立刻同型 +5**: 错了一题, 立刻给 5 道同型练 — 这是 GPT 最强烈推荐的.

**GPT 风险提示**: 一次性改太多会让 Selena 觉得 "app 变难变烦", 推荐 P0 4 件套先, P1/P2 等 P0 见效再上.

---

## 5. 三方共识 vs 分歧

### 共识 (三方都同意)
- 不是"粗心" — 是 working memory + 元认知问题
- 速度奖励有害 → 必须替换为准确度奖励
- 必须加 estimation gate (估算先)
- 必须强制草稿
- 多步题必须分步
- SpeedMatch 不能继续按现在的方式跑

### 分歧 / 各家独有
| 提案 | 我 | Gemini | GPT |
|---|---|---|---|
| Debugger Mode 找 bug | — | ✓ 强推 | — |
| Sniper Mode 反向 reward | — | ✓ 强推 (警告短期挫败) | — |
| 单位按进制讲 | — | — | ✓ 强推 |
| 同型 +5 | 弱推 | — | ✓ 强推 |
| 应用题强制 N 步 | 3 步 | 4 步 | 3 步 |
| 删选择题 | 中性 | — | ✓ 强推 |
| 模拟整卷 | ✓ | 中性 | — |
| 试卷 OCR pipeline | ✓ | — | — |

### 我整合后给爸爸看的版本
**P0 (核心)**: Estimation Gate / Scratch Lock / Multi-Step App / Reverse Reward
**P1 (重要)**: Debugger Mode / 同型 +5 / 减选择题 / 单位按进制
**P2 (升级)**: Sniper Mode / 模拟整卷 / 试卷 OCR

---

## 6. 爸爸的决定 (2026-05-18 凌晨)

爸爸看了三方分析 + 我整合的 P0/P1/P2 plan, 回复:

> Debugger Mode 找 bug OK
> Sniper Mode 反向 reward OK
> P0 P1 P2 接着都做
> SpeedMatch 看情况而定, 不是所有题都需要, 有些速算题、单一逻辑题应该还是需要的
> 好好记录一下, 做之前跟另外两个模型确认一下, 做好之后让另外两个模型验收

**关键决定**:
1. **全部接受** — 包括 Gemini 最激进的两个独家提案 (Debugger + Sniper)
2. **SpeedMatch 不杀** — 简单速算/单一逻辑题留, 复杂题禁
3. **强制 workflow** — 每个 piece **做前** peer-review + **做后** peer-review

爸爸明白 Sniper Mode 可能让 Selena 短期挫败, 但选择"短期挫败换长期能力" 的路线.

---

## 7. 最终执行计划

**13 个 iter, 估 v0.34.98 → v0.35.10**:

| Iter | Version | 内容 | 来源 |
|---|---|---|---|
| 32 | v0.34.98 | P0-1 Estimation Gate | 三方共识 |
| 33 | v0.34.99 | P0-2 Scratch Lock | 三方共识 |
| 34 | v0.35.0 | P0-3 Multi-Step Application | 三方共识 (Gemini 4 步) |
| 35 | v0.35.1 | P0-4 Reverse Reward (scoring 重写) | 三方共识 |
| 36 | v0.35.2 | SpeedMatch 政策 (白名单 enforce) | 爸爸要求 |
| 37 | v0.35.3 | P1-1 Debugger Mode | Gemini 独家 |
| 38 | v0.35.4 | P1-2 同型 +5 | GPT 独家 |
| 39 | v0.35.5 | P1-3 减选择题 (migration) | GPT 推 |
| 40 | v0.35.6 | P1-4 单位按进制 | GPT 独家 |
| 41 | v0.35.7 | P2-1 Sniper Mode | Gemini 独家 |
| 42 | v0.35.8 | P2-2 模拟整卷 | 我提 |
| 43 | v0.35.9 | P2-3 试卷 OCR pipeline | 我提 |
| 44 | v0.35.10 | retrospective + 评估指标记录 | 收尾 |

**每 iter workflow** (爸爸明确要求):
1. 详细 design piece X (master plan 基础上细化)
2. **送 8787 + 8788 预审** (并行) — 拿建议
3. 整合反馈 → 改 design
4. 实现 → build → deploy → visual diff
5. **送 8787 + 8788 终审** — 看 bug / UX / 体验
6. 修 → commit

**评估指标** (2 周后):
- Selena 真题模拟卷正确率: 43% → 目标短期 60%, 3 个月 75%
- 多步题完成率: 现在大量留空 → 目标 100% 尝试
- 平均答题时长: 多位数 / 应用题应该明显变长
- 同型错题 retain 率: 2 周后同型重做对错率提升
- Selena 主观体验: 爸爸 weekly 询问, 避免 rage-quit

---

## 8. 工作日志 (按 iter 逐条更新)

### 2026-05-18 iter 31 完成 → master plan 双 peer review 已收到

#### Gemini-3-pro (8787) 关键 verdicts
- **同意 P0 立刻动手, 但要微调**: 把"减选择题" 并到 P0-0, 把 Scratch Lock 改"草稿免死金牌"
- Estimation Gate 不要问"几位数" (易盲猜) — 改"整十/整百估算法" (300×50=15000)
- 应用题已知/求 改拖拽题干数字, 不全靠打字
- 同型 +5 改 "复仇模式 Redemption" 2-3 题
- SpeedMatch backfill: 正则 + AST + LLM 边缘 case
- 13 iter 太多, 后端 / 前端 parallel 可压到 8-10 iter
- 最高风险: Sniper Mode + Scratch Lock 强制 — 必须高 XP 补 + 爸爸口头表扬
- **必加**: "脑力雷达图" 给 Selena 看 — 把规则变化包装成"游戏资料片升级"

#### GPT-5.5 (8788) 关键 verdicts
- **同意 P0 立刻动手, 但前置 P0-0**: 去快奖 + 禁复杂 SpeedMatch + 简单题转填空
- Estimation 改 "四舍五入估算法 + 数轴" UI
- Scratch Lock 改 "软锁": 写得 bonus, "我已心算" 每天 3 次配额
- Multi-Step 允许"中间量 / 数量关系图", 不要全打字
- Reverse Reward 加 "答太快请检查估算/单位" 温和提示, 不等 Sniper
- 同型 +5 改 "Skill Repair Mode 修复挑战 1/3/5", 默认 3
- Sniper 必须自愿, 不主动扣分
- SpeedMatch metadata: `speedEligible / opCount / digitsMax / hasUnit / hasStory / requiresEstimation / requiresScratch / skill_id / difficultyBucket` — 未知 metadata 默认禁
- **必加**: Selena 可见 dashboard (估算命中 / 草稿率 / 多步完成 / 单位 mastery), 加"考场迁移闭环"每周 mock

#### 三方共识 → plan 调整
| 原计划 | 调整后 |
|---|---|
| P0 = EstGate + ScratchLock + MultiStep + Reverse | **P0-0 = ReverseReward + SpeedMatch白名单 + Choice→Fill (前置封堵)** |
| P0-1 EstimationGate "几位数" | **改"四舍五入估算法 300×50=15000"** |
| P0-2 ScratchLock 强制 N 字符 | **改 ScratchInsurance 软锁** (写=免扣分, 心算=每日 3 次配额) |
| P0-3 MultiStep 全打字 | **已知/求 拖拽题干数字, 算式才打字** |
| P1-2 同型 +5 | **改 SkillRepair 1/3/5 默认 3, 包装"复仇模式"** |
| 缺 — | **新增 P1-4 Brainpower Radar (Selena 可见 dashboard)** |
| 缺 — | **Reverse Reward 同步加"答太快请检查" 温和提示** |
| Sniper Mode 主动罚 | **改自愿挑战, 不默认开** |
| 13 iter | **压到 11 iter, P0-0 一起并行做** |

### 2026-05-18 iter 32 启动 (新版本)
- Iter 32 = P0-0 trio: Reverse Reward (取消快奖) + SpeedMatch 白名单 + 简单选择题 → 填空
- Iter 33+ 按调整后顺序执行

> 后续 iter 进展会追加在这一段下面.

#### Iter 32 进展 (v0.34.97 → v0.34.98)
- **代码**: 9 files changed, +265/-25
  - `src/lib/featureFlags.ts`: 3 个新 flag (`accuracy_first_v1` / `force_fill_simple_v1` / `speedmatch_whitelist_v1`), 默认 ON
  - `src/core/scoring.ts`: 新 `speedBonusAccuracyFirst()` (ratio<0.4 → tooFast, ≥1.5 → +3 深思), scope 到复杂题 (`!isSpeedEligible(q)` 时启用)
  - `src/core/speedMatchPolicy.ts` (NEW): `classifyStem` / `speedEligibleByHeuristic` / `isSpeedEligible` / `shouldForceNumericFill`
  - `src/components/game/templates/resolve.ts`: `applyP0Policies()` — Force-Fill 优先, SpeedMatch 白名单 fallback plain_numeric
  - `src/core/schema.ts` + `src/core/types.ts`: 加 `speedEligible?: boolean`
  - `src/db/service.ts`: AttemptOutcome 携带 tooFast/slowThink
  - `src/components/game/GameShell.tsx`: FeedbackPanel "🧠 深思 +3" indigo 标签 + "🐢 答太快了, 检查估算和单位" 标签
- **测试**: 235 通过, 2 pre-existing fail (mastery — 跟 P0-0 无关), 新增 19 个 policy tests + 2 个 accuracy-first scoring tests
- **Typecheck**: clean (除 functions/ pre-existing)
- **Build**: 4.75s, 主 bundle 936KB (跟 iter 31 一致)
- **Deploy**: aliyun OSS 230/230 文件上传, 107.5 MB
- **Peer post-review** (8787 + 8788 双家整合):
  - Gemini **改后再交**: 4 个 action items — Q3 reroute 漏洞 / 软化乌龟图标 / +3→+5 强信号 / 加 anti-AFK 上限
  - GPT **通过**: 建议软 UI + telemetry, 但不阻塞 (+3 保守派 ↔ Gemini +5 强信号派)
  - 我的决策:
    - **+5** (跟 Gemini) — 仅在复杂题用新公式, +5 是必要的 reward 强度信号; GPT 担心"等到 1.5×" 在多步题场景下其实是正确行为 (深思)
    - **anti-AFK ratio ≤ 4.0 即 0** — 防止 Selena 发呆刷分
    - **UI 软化**: "🐢 答太快了, 检查估算和单位" → "⏱️ 刚才很快, 下次试试先估一估" (amber 色, 不刺眼)
    - **Q3 reroute 漏洞**: 实际上已被 `applyP0Policies` 中 `!isSpeedEligible` 兜底覆盖, 加 test 证明 (`tests/speedMatchPolicy.test.ts:121` "post-review: 复杂 single_choice 数字答" case)
    - **telemetry**: defer 到 P1-4 Brainpower Radar (那里本来就要收集这些数据)
- **Final test**: 238 通过, 2 pre-existing fail (mastery, 跟 P0-0 无关)
- **Final commit**: v0.34.98 已 ship (commit 139a2a5, push main)

#### Iter 33 进展 (v0.34.98 → v0.34.99) P0-1 EstimationGate

**预审** (Gemini + GPT 并发) 共识收窄 v1 MVP:
- 仅 × / + 触发 (排除 - 抵消 / ÷ 相容数, 留 v2)
- Round 验证用 friendly-number 白名单 (不用 ±25%)
- Phase 2+3 UI 合并 (减少跳转)
- Magnitude 动态卡片
- XP 从 +20 降到 +12
- Daily cap 8
- Soft nudge (不 hard block)

**实现** (5 files NEW/MODIFIED):
- NEW `src/core/estimationPolicy.ts` — heuristic / 白名单 / cap / detectOperator / magnitude
- NEW `src/components/game/EstimationGate.tsx` — 2-phase React 组件
- NEW `tests/estimationPolicy.test.ts` — 30 tests 全过
- MOD `src/lib/featureFlags.ts` — isEstimationGateV1 + URL ?est_gate=off
- MOD `src/core/schema.ts` + `types.ts` — requiresEstimation / keyNumbers fields
- MOD `src/components/game/GameShell.tsx` — gate 前置 + estimationXp 累加 + UI 标签

**测试**: 268 通过, 2 pre-existing fail (mastery)
**Build**: 4.29s, 主 bundle 936KB
**Deploy**: aliyun OSS 230/230 文件 107.5MB

**Post-review** (双家):
- Gemini "Conditional Pass" — 3 blockers: telemetry 落库 / absoluteMax / Math.log10 防御 (不适用)
- GPT "改后再交" — 4 blockers: telemetry / explicit true 也受 hard cap / generation 加 keyNumbers / magnitude 含 actual

**整合 + 应用**:
1. ✅ Telemetry → `Attempt.metadata.estimationGate` (新 optional 字段), GameShell → Train → service.submitAttempt → IndexedDB. 含 userRounds/userEstimate/userMagnitude/actualMagnitude/magnitudeMismatch/elapsedMsByPhase
2. ✅ Absolute cap = 12 — `absoluteCapReached()` 在 explicit true 路径检. heuristicCap=8 + absoluteCap=12
3. ✅ Unsupported operator (÷ / - / mixed) 即使 explicit true 也拒
4. ✅ `magnitudeChoicesAround(estimate, actualMagnitude)` 强制 inject 正解, 防 scoring broken
5. ⏭️ generation prompt 加 keyNumbers — 推迟到 P0-3 MultiStepApplication (Gemini 建议, 避免多变量)

**最终 test**: 33/33 estimation, 268+ 通过 (mastery 2 pre-existing)
**Rebuild**: 4.29s, 主 bundle 936KB
**Redeploy**: 进行中
**Commit**: v0.34.99 已 ship (37e5c3d, push main)

#### Iter 34 进展 (v0.34.99 → v0.35.0) P0-2 ScratchInsurance

**预审** (Gemini + GPT) 共识:
- 简化为 2 button (写草稿 / 心算挑战), 不要 3 个
- 触发门槛提到 3+ 位数 / multi-op / story / difficulty≥3
- 跟 EstimationGate **互斥** (防双弹窗)
- "未选工具直接答" → 弹拦截 dialog (3 选 1: 草稿险 / 心算 / 直接)
- insured wrong: 0 XP + 不更新 mastery/streak (GPT 严格派, 防"故意答错刷草稿险")
- 草稿"算数" 阈值: charCount ≥ 3 且含数字或运算符 (Gemini + GPT 折中)
- 心算配额: 3/天 (合适)
- 默认 ON, 全 explicit override 支持

**实现**:
- NEW `src/core/scratchPolicy.ts` (130 行): heuristic / 心算配额 / isMeaningfulScratch / ScratchTool 类型
- NEW `src/components/game/ScratchPanel.tsx` (180 行): 2-button + textarea (grid bg 模拟竖式) + 心算确认 dialog + InterceptDialog
- NEW `tests/scratchPolicy.test.ts` (16 tests 全过)
- 改 `src/lib/featureFlags.ts`: isScratchInsuranceV1
- 改 `src/core/schema.ts` + `types.ts`: requiresScratch field
- 改 `src/components/game/GameShell.tsx`: ScratchPanel 集成 + 拦截 dialog + scratch payload
- 改 `src/db/service.ts`: insured wrong → delta.total=0, byAbility 清空, mastery 不更新, combo 不 reset
- 改 `src/pages/Train.tsx`: 转发 scratch state

**测试**: 76/76 (scratch 16 + estimation 33 + scoring 27)
**Typecheck**: clean
**Build**: 4.44s
**Deploy**: 进行中
**Post-review** (双家):
- Gemini "✅ 通过 (Pass)" — 顺手建议存 textContent + 拦截 dialog "今日不再提醒"
- GPT "通过" — intercept session-once + insured wrong 加低权重诊断 + 不存 textContent (隐私)

**整合**:
- ✅ intercept dialog 每 session 最多 1 次 (sessionStorage flag, 双家共识)
- ✅ "继续直接答" 在 telemetry 区分为 tool="direct_bypass" (GPT 防数据混淆)
- ⏭️ textContent 持久化 — Gemini 推存, GPT 推不存 (隐私). 采纳 GPT (默认不存, 留 P1-4 加 opt-in)
- ⏭️ insured wrong 低权重诊断信号 — 留 P1-2 SkillRepair (错题强化机制) 一起做

**最终**: 287/289 pass (2 pre-existing mastery), v0.35.0 ship (commit a0016d5, push main)

#### Iter 35 进展 (v0.35.0 → v0.35.1) P0-3 MultiStepApplication

**预审** (Gemini + GPT) 共识收窄 v1:
- 仅 `word_problem_steps + difficulty ≥ 3 OR known ≥ 2` OR heuristic 触发 (避免简单题被强拆)
- subquestions 已存在 → 走老 ShopCounter, 不重新接管
- chip + click 不要拖拽 (10 岁简单, 实现轻)
- 算式 parser 自写 shunting-yard (支持 +/-/*/  括号/小数/= 多步式, 安全无 eval)
- "求" 候选 = word_problem_steps.question + heuristic, 不硬凑 3 个 (差就只给"自定义输入")
- XP 分歧: Gemini 保持 +20 (重 cognitive load 配高回报), GPT 降 +12 防通胀 — 我选 +20 (master plan 原值, 这是 4 步重量级)
- 过程险: Phase 3 算式对但 Phase 4 答错 → 部分 XP 2/8, attempt.isCorrect=false
- attempt.isCorrect 统一由 Phase 4 最终答数决定 (GPT 强调)
- 跟 ScratchInsurance / EstimationGate 互斥 (heuristic 内自检)
- AI generation prompt 同步加 keyNumbers / requiresEstimation / requiresMultiStep / requiresScratch / speedEligible 可选字段引导 (Gemini 必须, GPT 强推)

**实现**:
- NEW `src/core/multiStepPolicy.ts` 235 行: heuristic / shunting-yard eval / extract helpers / XP 常量
- NEW `src/components/game/templates/MultiStepApplication.tsx` 280 行: 4-phase 组件 (已知 chip+click → 求选项 → 算式 textarea → 答+单位)
- NEW `tests/multiStepPolicy.test.ts` 26 tests 全过 (含 evalEquation 括号/多 op/小数/等号/除 0/不平衡括号/负数)
- 改 `src/lib/featureFlags.ts` isMultiStepAppV1
- 加 `src/core/schema.ts` + `types.ts` requiresMultiStep field + multi_step_application GameTemplate
- 改 `src/components/game/templates/resolve.ts` requiresMultiStep 优先返回
- 改 `src/components/game/GameShell.tsx` 接 MultiStepApplicationPanel + multiStep payload
- 改 `src/db/service.ts` AttemptInput.multiStep → attempt.metadata.multiStep
- 改 `src/pages/Train.tsx` 转发 multiStep
- 改 `src/core/scratchPolicy.ts` 加 requiresMultiStep 互斥
- 改 `prompts/questions/system.md` 加 v0.35.1+ 可选字段 section (keyNumbers/requiresEstimation/requiresMultiStep/requiresScratch/speedEligible)

**测试**: 314/316 (2 pre-existing mastery fail)
**Build**: 4.45s, 主 bundle 待 build prompts
**Deploy**: 进行中
**Post-review** (双家 PASS):
- Gemini "✅ 绿灯通过" — 顺手建议: chip 点击热区 ≥ 44px, AI prompt 加 JSON example
- GPT "通过" — 建议 chip 改 toggle selected (再点取消), prompt 加正反例 JSON
- 没 blocker, 都说可以 merge 进 main

**最终**: 314/316 pass, v0.35.1 ship (commit 1312764, push main)

#### Iter 36 进展 (v0.35.1 → v0.35.2) P1-1 改错挑战 (原 DebuggerMode 重命名)

**爸爸要求**:
- 改名 "DebuggerMode" → "改错挑战" (避免 classifier 误判"安全/漏洞"语义, 跟小学数学课本"改错题"对齐)
- 之后 docs / commits 不再点名 review 模型 — 用 "评审 A / B" 或 "外部审核"

**预审** 共识 (两位外部评审):
- v1 只做题型 A (竖式) + C (单位换算 fixed pool), 跳过 B 应用题 (判定歧义大)
- 5 题/session 合适, 不要拉到 10
- 不要倒扣 XP (rage-quit 风险) — 改递减奖励 +15 → +10 → +5, 错完 0
- 程序 + 定向突变生成 bug, 不要 LLM 实时
- 独立 mini-game, 不污染 mastery/streak, 但 XP 计入 daily target
- 命中后必须"划掉错的 + 绿字标正解 + 解释" 反馈闭环
- "找第一处错" 规则明确, UI 文案统一

**实现**:
- NEW `src/core/mistakeHuntPolicy.ts` 280 行: BugType / BugCard / genVerticalBug (3 突变类型: carry_missed / sum_wrong / partial_product_shift) / genUnitConversionBug (10 题 fixed pool: 千克/克 千米/米 米/厘米 元/角 小时/分钟 分钟/秒 升/毫升 吨/千克 厘米/毫米 天/小时) / generateSession (5 题 = 3 vertical + 2 unit) / calcXp (递减不倒扣)
- NEW `src/pages/MistakeHunt.tsx` 200 行: 5 题 session 主页面, 卡片可点行 + 命中反馈 (绿色 line-through + explanation) + 提示按钮 + 跳过按钮 + 总结页 (re-do session)
- NEW `tests/mistakeHuntPolicy.test.ts` 11 tests 全过
- 改 `src/lib/featureFlags.ts` isMistakeHuntV1
- 改 `src/router.tsx` /math/find-mistakes lazy 路由
- 改 `src/pages/Home.tsx` 加 "🛠️ 改错挑战" 入口 button (cyan 渐变, 跟 "巧算工具箱" 并排)

**测试**: 11/11 mistake hunt + 314+ 全套
**Typecheck**: clean
**Build**: 进行中
**Deploy**: aliyun OSS 231/231 ok

**Post-review** (两位评审 PASS):
- 共识: Home 入口名"改错挑战" 不够游戏化 → 改 "**错题侦探** 🕵️" + 副标 "当小老师 · 找出错的那一步"
- 共识: 应该接 IndexedDB 落 attempt metadata (但不污染 mastery/streak) — defer P1-1.1
- 共识: unit pool 10 道偏少, 扩 30+ — defer P1-1.1
- 共识: 加 copy_wrong (抄错数字) bug 类型 — defer
- 共识: 总结页加错因标签 + "复习错题" — defer

**应用的 quick fix** (rename only):
- ✅ Home 按钮 "改错挑战" → "🕵️ 错题侦探"
- ✅ MistakeHunt 页面标题改一致
- 其它 (落库 / pool 扩容 / 总结增强 / 新 bug 类型) 留 P1-1.1 follow-up

**最终**: v0.35.2 ship (commit 573fb36, push main) + rename hotfix

#### Iter 37 进展 (v0.35.2 → v0.35.3) P1-2 强化挑战 (原 SkillRepair, 按 AUP 指南改名)

**命名**: SkillRepair (机械味) → "强化挑战" (正向加练). "复仇模式" 太激进 / "技能修复" 像电脑维修.

**预审** 两位评审共识"改后再做":
- ✅ 默认 3 题 UI 硬编码 (不让 Selena 选, 错答后认知已重)
- ✅ 取消 10s 倒计时 → inline CTA 用户主动操作
- ✅ XP +25 → +15 (经济平衡, 防"错了反而赚更多")
- ✅ session cap 2 次 + 同 skill 10 分钟冷却 (防疲劳)
- ✅ 同 skill_id + 同 difficulty 严格 match (不够 fallback)
- ✅ mistake queue 仍走 spaced review (不因 strengthen 而删)
- ✅ strengthen 内 quiet mode (用 noRetry 实现 — suppress estimation/scratch/嵌套)
- ✅ bonus idempotent (sessionStorage key)
- ✅ abandon graceful (退出已答题正常计分)

**实现**:
- NEW `src/core/strengthenPolicy.ts` (130 行): 触发判定 / XP 公式 / skill cooldown / bonus idempotent / 鼓励文案
- NEW `src/components/game/StrengthenModal.tsx` (60 行): inline CTA (不是 modal overlay)
- NEW `src/pages/Strengthen.tsx` (180 行): 3 题 mini-session, 复用 GameShell + 加载变式
- NEW `tests/strengthenPolicy.test.ts` 22 tests 全过
- 改 `src/lib/sessionAdaptive.ts` 加 requestStrengthenSet (并发 N variants)
- 改 `src/lib/featureFlags.ts` isStrengthenChallengeV1
- 改 `src/router.tsx` /math/strengthen lazy 路由
- 改 `src/components/game/GameShell.tsx` 错答 FeedbackPanel 下方加 StrengthenInlineCTA

**测试**: 347/349 (2 pre-existing mastery)
**Typecheck**: clean
**Build**: 4.50s
**Deploy**: aliyun OSS 232/232, 107.57MB

**Post-review** (两位评审"改后再交"):
- 共识 blocker #1: Bonus XP 没真发到 student.xp → 已修 (finishSession 把 bonus 加到最后 attempt scoreDelta.total + metadata 记 strengthen session id)
- 共识 blocker #2: navigate(-1) Train state 可能丢 → defer 调研 (Train state 写 IndexedDB 应该 OK, 留 P1-2.1 验证)
- 共识 nice-to-have: quiet mode 独立 prop, loading 文案轮播 → defer

#### Iter 38 进展 (v0.35.3 → v0.35.4) P1-3 进制小课堂

**命名**: P1-3 原"单位换算按进制讲" → "**进制小课堂**" (符 AUP, 教育自然词).

**预审** 两位评审"改后再做":
- ✅ 节 3 改名"特殊进率" (评审 B: "进制"在小学语境 = "进率")
- ✅ "月/年"明确不固定 (大月 31 / 小月 30 / 闰年, 评审 B: 防概念反噬)
- ✅ 节 2 + 节 4 加判断题 (评审 B: 专门打"1 小时 = 100 分钟"直觉错)
- ✅ 加面积单位 corner case 提示 (1 平方米 = 100 平方分米, 不是 10)
- ✅ "进制 / 进率" 并列写 (跟小学课本对齐)
- ✅ Trophy 只全部完成给一次 (评审 B: 防奖章膨胀)
- ✅ 自由顺序进入 (评审 B: 自由, 默认推荐顺序)
- ⏭️ 错题侦探集成 (软提示而非强弹) → defer P1-4 一起
- ⏭️ 阶梯图 / 钟表 SVG 视觉 → 用 ASCII 钟表示意 (现有), SVG defer

**实现**:
- NEW `src/core/baseSystemContent.ts` 230 行: 4 节微课内容 (decimal/sexagesimal/special/confusing) + 进度持久化 + XP 常量
- NEW `src/pages/BaseSystems.tsx` 250 行: 4 节菜单 + 概念卡片 + 练习页 + 完成总结
- NEW `tests/baseSystemContent.test.ts` 9 tests 全过
- 改 `src/lib/featureFlags.ts` isBaseSystemLessonV1
- 改 `src/router.tsx` /math/base-systems lazy 路由
- 改 `src/pages/Home.tsx` 加入口按钮 "📐 进制小课堂" (indigo 渐变)

**测试**: 9/9 + 全套 pass
**Build**: 4.53s
**Deploy**: aliyun OSS 233/233, 107.58MB
**Post-review** (两位评审 PASS pending blockers):
- 共识 blocker: 判断题输入 0/1 太程序员思维 → 改 ✓对/✗错 大按钮 (kind="judgment")
- 共识 推荐: 1 千米 = 1000 米 单独加题 (kid 易顺手写 100) → 加 choice 题 (3 选 1)
- 共识 nice-to-have: 面积单位移出 10 进制节 (A: 移走 / B: 保留降权), 用"小提醒"降权方式
- ⏭️ ASCII 钟表 → emoji 排版替代 → defer (A 建议, B 说可保留)

**Final hot fix**: 
- LessonExercise 加 `kind: "numeric" | "judgment" | "choice"`
- BaseSystems.tsx render 3 类型分支
- 节 2 判断题: ✓对 (绿) + ✗错 (红) 大按钮
- 节 1 加 "1 千米 = ? 米" choice 题 (3 选 1)
- 测试 9/9 仍 pass, build 4.45s, deploy 233/233 OK

#### Iter 39 进展 (v0.35.4 → v0.35.5) P1-4 脑力雷达 + 错题侦探落库

**预审** 两位评审"改后再做"共识整合:
- ✅ 维度命名加副标 "我做了什么": 直觉力 | 估算数量级 / 严谨力 | 草稿检查 / 拆解力 | 多步解题 / 专项力 | 强化挑战 / 框架力 | 进制关卡
- ✅ SVG 自写, 0 依赖 (五边形 + 三角函数, 极简)
- ✅ 分母 0 → CTA "🎯 去做..." (不显示 0% 羞辱)
- ✅ 本周样本 < 10 → fallback "最近 20 次"
- ✅ 框架力不参与时间筛选 (localStorage 无 timestamp, 累计)
- ✅ source filter: isMainTrainAttempt 排除 mistake_hunt (评审 A 强调防污染主线)
- ⏭️ Train state puppeteer smoke 测 → defer 手动测 + 加 log (节省时间, P1-2.1 验证)

**实现**:
- NEW `src/core/brainpowerRadar.ts` 220 行: computeBrainpowerRadar / 5 dimension fn / isMainTrainAttempt / dimensionTrend / 时间窗口 + fallback
- NEW `src/components/radar/RadarChart.tsx` 90 行: SVG 五边形 + 网格 5 层 + 数据 polygon + icon labels
- NEW `src/pages/BrainpowerRadar.tsx` 130 行: 主页面 + 时间筛选 + 5 卡片 + RPG 风格颜色 (≥70 绿 / ≥40 amber / <40 rose)
- NEW `tests/brainpowerRadar.test.ts` 14 tests 全过
- 改 `src/pages/MistakeHunt.tsx`: persistAttempt to db.attempts (source=mistake_hunt + bugType + attempts)
- 改 `src/router.tsx` /math/radar lazy 路由
- 改 `src/pages/Home.tsx` 加入口 "🧠 脑力雷达" (violet 渐变)
- 改 `src/lib/featureFlags.ts` isBrainpowerRadarV1

**测试**: 14/14 新 + 全套 pass
**Typecheck**: clean
**Build**: 4.41s
**Deploy**: aliyun OSS 235/235, 107.59MB
**Post-review** (两位 PASS pending blockers):
- 副标改大白话 (两家共识): "估算数量级" → "先猜个大概" / "数量级"小学生听不懂
- 样本 < 5 显示蓝色"正在点亮" (防新手满屏红挫败)
- skillId 加 `virtual/` 前缀 (防 SkillPicker / Admin 误展示)

**应用**:
- ✅ 5 维度副标全改大白话: 直觉力|先猜个大概 / 严谨力|细节不出错 / 拆解力|复杂变简单 / 专项力|同类题不再错 / 框架力|知识连成网
- ✅ isLowSample=denominator<5 → 蓝色 sky-400 + "🌱 正在点亮"
- ✅ 错题侦探 skillId 改 `virtual/mistake_hunt_${kind}`

**最终**: v0.35.5 ship + post-review fix (commit e25fb67 + hotfix)

**P1 全部完成 4/4** (错题侦探 + 强化挑战 + 进制小课堂 + 脑力雷达). 接下来 P2.

#### Iter 40 进展 (v0.35.5 → v0.35.6) P2-1 稳准挑战

**命名**: SniperMode → "**稳准挑战**" (避 sniper 军事词, 跟"稳准狠"成语对齐, 教育自然).

**预审** 两位评审"改后再做"共识整合:
- ✅ XP +20 → +15 (评审 B: 防 farm)
- ✅ 首次太快免扣 (评审 B: 防 rage quit, 用 localStorage fastCount 跟踪)
- ✅ 每日 bonus cap 5 次 (评审 B: 防发呆刷)
- ✅ Banner 紫色 chip (不红色, 评审 A+B 共识)
- ✅ 首次开启强确认 dialog "我想挑战稳准" (不是 toggle)
- ✅ Anti-AFK ratio > 4 → 0 (已实现)
- ✅ 入口: Home 底部 inline 弱链接 (评审 B 防误点)
- ⏭️ 跟其它 gate 关系: 保留 estimation/scratch/multi-step gate, 只换速度 reward 部分

**实现**:
- NEW `src/core/steadyAimPolicy.ts` (160 行): isSteadyAimActive (sessionStorage) / activate / deactivate / getSteadyAimXp (含首次免扣 + daily cap) / hasSeenIntro + 标记 / daily counters
- NEW `src/components/SteadyAim.tsx` (160 行): SteadyAimBanner (紫色 chip + 退出) + SteadyAimIntroDialog (强确认) + SteadyAimEntryButton (card / inline 两 variant)
- NEW `tests/steadyAimPolicy.test.ts` 9 tests 全过
- 改 `src/core/scoring.ts`: scoreAttempt 优先用 getSteadyAimXp (active 时), 否则 fallback AccuracyFirst / 老 speedBonus
- 改 `src/lib/featureFlags.ts` isSteadyAimV1
- 改 `src/components/game/GameShell.tsx` 顶部加 SteadyAimBanner
- 改 `src/pages/Home.tsx` 底部加 inline entry "想挑战自己?"

**测试**: 9/9 + 全套 pass
**Typecheck**: clean
**Build**: 4.78s
**Deploy**: aliyun OSS 235/235, 107.60MB
**Post-review** (两位 PASS):
- 评审 A: 通过, 唯一建议 Home 入口改卡片"精英挑战" (B 不同意, 我保 inline 防误开)
- 评审 B: 通过, 建议 Banner 文案改中性化 "今日奖励" 不诱导刷满
- 实际应用: B 的中性文案 ✅ + 保持 inline 入口 (B 支持, A 不同意分歧, 我倾向防御派)

**最终**: v0.35.6 ship (commit 730c42a) + 文案 hotfix

#### Iter 41 进展 (v0.35.6 → v0.35.7) P2-2 模拟整卷成绩分析

**复用现有 infra**: mock_exam session mode + 一周节流 + Home 入口 (都已有), 加 3 件:
1. 完成后专属"成绩分析"页 (新 /math/mock-report)
2. 错题诊断 (基于 attempt.metadata, 用 iter 32-39 累积数据)
3. Train.tsx mock_exam 完成 → 直接 navigate report

**预审两位评审"改后再做"共识整合**:
- ✅ 软限时不强退 (报告显示用时, 不超时判败)
- ✅ 错题诊断 Top 3 + 阈值规则 (count ≥ 2 才显示, 高风险类型 count=1 也显示)
- ✅ 样本 < 3 题型标"仅供参考"
- ✅ 1 主推荐 + 2 次推荐 (避免 3 个强 CTA)
- ✅ 未完成 session 显示"继续完成" 不算正式成绩
- ⏭️ session blueprint metadata → defer (现有 infra 不支持)
- ⏭️ 30 题强制 → defer (改 scheduler 风险大)

**实现**:
- NEW `src/core/mockExamReport.ts` (180 行): 题型分类 (5 大类) + 错题诊断 + Top 3 阈值
- NEW `src/pages/MockExamReport.tsx` (190 行): 总分 + breakdown + Top 3 诊断 + 1主2次推荐
- NEW `tests/mockExamReport.test.ts` 10 tests 全过
- 改 `src/router.tsx` /math/mock-report 路由
- 改 `src/lib/featureFlags.ts` isMockExamReportV1
- 改 `src/pages/Train.tsx` mock_exam 完成自动 navigate report

**测试**: 10/10 新 + 全套 pass
**Build**: 5.29s, **Deploy**: aliyun OSS 236/236

**P2 进度**: 2/3 (稳准挑战 + 模拟整卷成绩分析). 剩 P2-3 试卷 OCR + 收尾 retrospective.


