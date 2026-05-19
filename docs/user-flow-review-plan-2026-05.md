# User Flow Comprehensive Review — 2026-05

**Trigger**: 爸爸 (产品 owner) 2026-05-19 explicit
> "根据核心价值, 整体架构, 游戏体系, 具体实施, 用户体验各个方面去找问题"

Refactor batch (v0.35.32 → 61, 30 iters) 已 stable. 主文件拆分 -45%, 3 build gate, 462 tests pass. 接下来转向**产品 + 用户视角**找问题, 不限 code 风格.

## 5 个 Review 维度

### 1. 核心价值 (Core Value)
> "Selena 4 年级 43% 期中 → 期末提到 80%+; 同时不让她讨厌数学"

要 review:
- 现行 daily flow 是否真在驯练 Selena 的弱项? (mastery 数据 vs scheduler 出题分布)
- "深思 +5" / "太快 -1" 等 nudge 是否真在改变 Selena 行为? (统计 attempts metadata)
- Hint / Tutor / Retry 三层 scaffold 顺序 + 触发条件是否合理? (vs Selena 实际 retry 数据)
- Daily 10 题 (DAILY_CHALLENGE_TARGET) 是否对的频次?
- ExamPrep 模拟卷 30/60/80 题切换是否真模拟期末压力?

### 2. 整体架构 (Architecture)
> "AI agent 改一处忘一处" 已通过 refactor 解决. 还有什么架构 risk?

要 review:
- Dexie schema migration 在 prod 多 device 同步是否真 work? (尤其 cloud snapshot.parent 跨设备)
- Aliyun FC 链路 (vision / image-gen) 错误处理 + retry 策略
- ESA EdgeRoutine + OSS frontend 静态托管的 cache invalidation 路径
- Feature flag (defineFlag) 真 ship/rollback workflow

### 3. 游戏体系 (Game System)
> 段位 / 勋章 / 闯关 / 灵感 / 工坊 / 速度档位 ... 这么多奖励 system, Selena 真分得清吗?

要 review:
- 9 个 mode (normal / final_sprint / mock_exam / skill / midterm / weak_skill / review / free / big_problems) 用户视角 mental model 是否 clear?
- 23 个 game template 出题分布 vs Selena 偏好 (她会避开哪些?)
- 段位 (school → district → city → province → nation) + 闯关星章 + commemorative trophies + tiered trophies + daily trophies + 灵感 (Atelier) — 这么多系统是否 overlap?
- Phase 2 / Phase 2.5 / 闯关 / 期末冲刺 — 命名清晰度?
- LotteryBoxModal 弹的时机 vs Selena 实际打开 app 的节奏

### 4. 具体实施 (Implementation)
要 review:
- Train 页面 multi_step Phase 1 "至少选 2 个数" 限制 — 题目本身就 1 个数字时怎么办?
- canvas_scratch 模板的 vision judge 在 prod 真 work 比例 (fc-paper-ocr CORS / 限频?)
- Mock_exam 60 题 / 80 题 模式下 Selena 中断 → reload 状态恢复?
- mistake review 的间隔曲线 (FSRS) 真符合记忆规律? 还是简单 fixed schedule?
- Auto-generate 出题质量 (AI 出的 vs 题库 seed 题 vs 爸爸录入的 mistake) 区分度?

### 5. 用户心理反馈 + Stickyness (Psychological + Retention)
> "Selena 真愿意每天打开 app 吗? 是不是父母逼着用?"

要 review:
- 进 app 第一屏 hook — 4 年级孩子 3 秒内被什么吸引?
- Daily streak / 今日打卡 0/3 ring 系统对孩子是动力还是压力?
- 错答时的情绪曲线 — "再仔细读一遍" → 是关心还是说教感?
- 速度档位 "⚡⚡⚡ 闪电" 强 reinforce, 但 v0.34.98 "Accuracy-First" 改成"深思+5" — 现在哪个 dominate? Selena 大脑学到什么?
- Trophy / 段位升档 reveal 的"惊喜值" — 第 N 次还是惊喜吗?
- 工坊灵感 + 段位徽章 + 闯关星章 + 勋章 4 套奖励, Selena 心里有清晰的"集卡"目标吗?
- Mascot 小进 + 红熊猫 — 4 年级孩子真的会跟 AI character emotional bond?
- 用 7 天后会怎样 (novelty 退潮后还有什么 hook)?
- 父母数据 (今日快报截图) → 是 dopamine 还是 surveillance?
- 跟 Duolingo / Math Academy / Khan Academy / Prodigy 等 stickiness 经验比较

### 6. 用户体验 (UX)
要 review:
- Home page 信息密度 — Selena 4 年级一打开 app 看到啥?
- Train 题间过渡是否流畅 (delays, animations 节奏)
- 错答 → RetryHintPanel "💡 先别急" 文案是否让 4 年级孩子接得住?
- 速度档位 "⚡⚡⚡ 闪电" vs "🐢 拖拉" 对 4 年级孩子是 motivating 还是 shaming?
- Mascot 小进 + 红熊猫 与 Selena 的 emotional connection (3D avatar reactions)
- Mobile 适配 (Selena 用 iPad 看 PWA?)

## Review Workflow (后续 iters)

每个 iter focus 1-2 个维度:
1. mcp Preview 截图 / 实际操作 + read source 找 issue
2. 平行 peer review (Gemini-3-pro + GPT-5.5) for 独立视角 + 设计建议
3. 整合到 `docs/user-flow-issues-found.md` (待建)
4. 按严重度排序 + 标责任域 (core/UX/arch/game/value)
5. 选 top 3 实施 → next iter

## 当前 baseline (供 review 参照)

- Selena: 4 年级 (G4B 下册), 10 岁, 期中 43%
- Refactor v0.35.32-61 完成
- 962 SEED 题 (961 题库 + 自动 backfill)
- 23 GameTemplate / 51 skill / 14 unit / 7 final_sprint priority bucket
- 461 test pass (含 P1-P21 refactor coverage)
- 主文件: GameShell 666 / Train 482 / SuperAdmin 2575 / Admin 1132 / scheduler 1061
- 3 build gate (seed/content/db schema) all green
- 部署: aliyun OSS (xiaojin.app) + ESA + FC; cron auto-fire 30min
