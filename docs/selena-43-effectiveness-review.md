# Selena 43% master plan — 效果自审 (vs 原期中失分模式)

> 11 iter ship 完, 跑了 E2E 智能渲染. 现在拉远看: 这套系统**真的解决 Selena 期中 43% 的根因**了吗?

## 1. 原期中 7 大失分模式 vs 11 件覆盖

| 期中失分 | 根因 | 我做了 | 实际是否解决? |
|---|---|---|---|
| **多位数计算错** (进位漏/抄错号) | working memory 溢出 | P0-1 EstimationGate (估算先) + P0-2 ScratchInsurance (草稿险) | **半解决** — 估算让她有数量级感, 草稿券降低惩罚. 但**没专门竖式训练** mini-game. 进位错本身没专项纠 |
| **单位换算错** (1 小时 = 100 分钟) | 不知 10 进制 vs 60 进制 | P1-3 进制小课堂 (4 节微课) | ✅ **直接解决** — 但要她**真做完 4 节**, 不做没用 |
| **应用题留空 / 跳到答案** | 没"列式"习惯, 直接抓数字 | P0-3 MultiStepApplication (4 步法) | ✅ **直接解决** — 4 步法**强制写**算式. 但**触发率取决于现有题库 word_problem_steps 字段填的多不多** — 旧题不补字段 → 不触发 |
| **选择题蒙对率高** | 看选项猜, 不算 | P0-0c Choice→Fill (简单单选转填空) | ✅ **直接解决** — 在简单题里. 复杂选择题仍能猜 |
| **简单速算 OK 但真题不行** | System-1 反射 vs System-2 推理 | P0-0a Reverse Reward + P2-1 稳准挑战 | **半解决** — 取消快奖断了 System-1 强化, 稳准挑战让 System-2 训练. 但效果**取决于 Selena 主动用稳准** (自愿 OFF 默认) |
| **没"草稿/估算/检查"元认知** | 习惯没养成 | P0-1 估算 + P0-2 草稿 + P1-1 错题侦探 (校验) | ✅ **三件协同覆盖** |
| **错题没系统强化** | 错了就过 | P1-2 强化挑战 (同型 +3) | **半解决** — 触发瞬时强化. 但**没间隔重复** (错题 2 周后再考是否还会错? 没做 spaced retest) |

**得分: 4 ✅ + 3 半解决 = 大致解决 70%**.

## 2. 系统级 gap (master plan 没正面挑战的)

### Gap A: 竖式计算训练
- 期中 Selena 大量错在"竖式进位/借位"
- 现有系统: SpeedMatch 速算训练单步, MultiStep 训练应用题分步, 错题侦探训练"找别人错"
- **缺**: 让 Selena **自己写竖式**的 mini-game. 比如"填空式竖式" — 给她空格让她填进位
- **future P3**: 竖式工坊?

### Gap B: 真考场景模拟不够真
- Mock exam 30 题 + 软限时, 跟真考差距:
  - 真考: 纸笔, 不能 retake, 时间紧
  - App: 屏幕, 可以中途退出, 软限时
- 我做的: report 给反馈, 但**考试体验本身** vs 真考不像
- **future**: 强限时模式 (倒计时强制交卷) + 全屏 fullscreen + 禁退按钮

### Gap C: 数据给爸爸的渠道
- 脑力雷达给 Selena 看自己
- 爸爸 admin 端看 cadet 数据 (现有 SuperAdmin 表格, 但是"答了多少道", 不是"哪里 stuck")
- **缺**: 周报 — 自动每周给爸爸一个 PDF / email "Selena 本周表现 + 推荐"
- **future**: SuperAdmin 加 "本周报告" 按钮 (打 mock exam report 的 5 维度 + 趋势)

### Gap D: 题型平衡
- 题库历史是 SpeedMatch 题居多 (启蒙期, Selena 7000+ attempts 大部分是)
- P0/P1 训练触发依赖"复杂题" (≥3 位数, 应用题, 等)
- 实际触发率: estimation 触发率 / multi-step 触发率 — **没数据**, 可能比预期低
- 验证方法: 看 attempt.metadata 里 estimationGate / multiStep 出现频率
- **future**: SuperAdmin 加"触发率 dashboard"

### Gap E: Selena 主观接受度
- 11 件加起来, app 比之前重很多 (estimation gate / 草稿险 / 拦截 dialog / multi-step 4 步法 / etc.)
- 短期 Selena **可能挫败** — "app 怎么变难了"
- 没做 staged rollout (P0-0 默认全 ON)
- 缓解: feature flag 都加了, 可以 individually OFF
- **风险**: Selena rage quit → app uninstall → 训练量归 0

### Gap F: 跟老师 / 妈妈的协同
- App 数据存 Selena 设备 + cloud
- 老师 / 妈妈想看 Selena 表现, 没渠道
- 现有: SuperAdmin 给爸爸, 但老师没账号
- **future**: 老师 view-only 链接 (爸爸生成, 老师扫码看 Selena 一周表现, 7 天有效)

### Gap G: 跟 Selena 的 weekly check-in
- 现在指标: "2 周后看 mock exam 改善". 但没**实时**反馈
- Selena 做完 1 周不知道自己有没有进步
- 脑力雷达本周窗口 ≥10 sample 才显示 — 用得少的没体感
- **future**: 每日"今日进步" 简报 (脑力雷达迷你版 + 今日 highlight)

### Gap H: 错题间隔重复
- 现有: 错题进 mistakes queue + scheduler 按 spaced review 出 (已有, 不是 master plan 加的)
- P1-2 强化挑战触发时立刻补 3 题
- 但 1 周后同型重做率: **没数据**. 强化 ≠ retention.
- **future**: P1-2.2 — 强化挑战完后 24h / 3d / 7d 各自动出 1 道同型 (真间隔重复)

## 3. 我做对的 (诚实)

1. ✅ workflow 严守: 每件双 peer review + post-review fix, 比直接拍脑袋 ship 强
2. ✅ AUP 指南自我升级, 命名危机后形式化规则
3. ✅ 数据基础设施: attempt.metadata 5 类子字段, 让 P1-4 脑力雷达 + Mock report 都能聚合
4. ✅ 把"惩罚式"训练全部改成"软包装" (草稿险 / 强化挑战 / 错题侦探 / 进制小专家)
5. ✅ 11 iter 全 ship, 0 阻断 bug (E2E smoke 验证)

## 4. 我做欠缺的 (诚实)

1. ❌ 没做 staged rollout — P0 默认全 ON, 没灰度 / 没 A/B
2. ❌ 没监控数据 — 触发率 / 完成率 / Selena 实际 retain 率没指标 dashboard
3. ❌ 没竖式专项 mini-game — 期中失分大头之一
4. ❌ 间隔重复没 explicit (依赖 mistakes scheduler)
5. ❌ 真考场景不真 (软限时 / 可退)
6. ❌ 没给老师 / 妈妈端
7. ❌ Train state 持久化 P1-2.1 只口头, 没 puppeteer smoke 真测
8. ❌ AI prompt 加 keyNumbers 但旧题库**不补打**
9. ❌ 错题侦探 unit pool 仅 10 道, Selena 玩 3 次会熟 (评审推 30+, defer 了)
10. ❌ 整套系统**没真让 Selena 试**, 一切都靠推理

## 5. 风险评估 (假设 Selena 真开始用)

| 风险 | 概率 | 严重度 | 缓解 |
|---|---|---|---|
| Selena 觉得变难, 不爱用 | 高 | 高 | feature flag OFF, 跟 Selena 商量先关哪些 |
| EstimationGate 触发太频繁 (>50% 题) | 中 | 中 | heuristic 调严 (已经 daily cap 8) |
| 多步法 4 phase 走完累 | 中 | 中 | 跟 Selena 协商, 接受 4 phase 但缩短卡片文字 |
| 进制小课堂 4 节没人主动做 | 高 | 中 | 爸爸陪她做第 1 节启动 |
| Mock exam 报告"诊断" 让 Selena 反感"被分析" | 中 | 中 | 改文案 → "你的强项 / 待加强", 不用"错因" |
| 稳准挑战即使自愿, 看见入口仍诱发"我必须挑战" | 低 | 低 | 现已 inline 弱链接 |
| 数据自动同步失败 → 离线 Selena 数据丢 | 低 | 高 | 现有 cloudSync 已有 retry, 不是 master plan 加的 |

## 6. 自评结论

**11 件 ship 已**覆盖原 43% 期中失分的 **大部分根因** (70% 直接 / 30% 半解决).

**主要 gap**:
1. 竖式专项训练缺
2. 数据反馈链给爸爸 / 老师缺
3. 间隔重复 explicit 缺
4. 监控指标 dashboard 缺
5. Selena 主观接受度未验证

**当下不应再添新功能**. 应该:
1. 让爸爸 + Selena 真用 1-2 周
2. 看脑力雷达数据 (estimation 触发率 / multi-step 完成率 / Selena 主观体验)
3. 根据真数据决定下一波 (是补 gap 还是调阈值)

**最大不确定**: 我从未跟 Selena 直接交互, 所有"她会喜欢/讨厌"都是推测. 真实体验只能爸爸观察反馈.
