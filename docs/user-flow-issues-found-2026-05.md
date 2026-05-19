# User Flow Review Findings — 2026-05-19

**Reviewers**: Gemini-3-pro thinking-high + GPT-5.5 reasoning-xhigh (并行), + Claude 自验证 (mcp Preview screenshots)

**Status**: 2 家 reviewer **强 converge** on top 6 P0 issues. 不是猜想, 是 cross-validated.

**核心 BLINDSPOT (2 家共识)**:
> "这是用学霸/成人极客思维给数学受挫的 10 岁小女孩做的复杂 SaaS 系统."
> "60 版迭代每版都加东西, 没人砍东西, 10 岁孩子的认知带宽承受不住."

爸爸 KPI (43%→80%) 跟 Selena 内心需求 ("不被评价为笨, 不被惩罚, 安全的练习空间") 在 app 里打架.

---

## 🔴 P0 — Cross-Validated by 2 家 (强建议下轮 sprint 优先)

### P0-1: 奖励通货膨胀 — 5+ 套互相抵消 (Gemini F5 + GPT F1)
- **现状**: 段位 (5 阶) + commemorative trophies + daily/tiered trophies + 闯关星章 + 灵感 + Mascot 衣柜 + 速度档位. 答对一道同时弹 3-4 种.
- **影响**: 4 年级孩子大脑钝化, 不知道"为啥高兴". 系统设计目标本质消解.
- **改进**: 砍到 **1 个主奖励 (掌握进度 43→80)** + 短期目标 (星章) + 1 个代币 (灵感) 用于 Atelier 装饰. **废除省市段位**.
- **类比**: Duolingo 只让 streak 成主心智. Prodigy 用宠物战斗成长.

### P0-2: 段位 school→nation = 身份焦虑 (Gemini F5 + GPT F2)
- **现状**: "和平街数学爱好者" → "锦江区..." → "蓉城..." → "天府之星" → "中华小数神".
- **影响**: 对 43% 的孩子, "全国排名"是 status threat 不是 motivation. 女孩对竞争性排名有天然恐惧.
- **改进**: 改 **"个人进步地图 (43→80)"**, 强调自己跟自己比. 删除区/市/省/国 4 阶.

### P0-3: 9 Mode 是开发者分类 (Gemini F4 + GPT F5/F12)
- **现状**: normal / final_sprint / mock_exam / skill / midterm / weak_skill / review / free / big_problems.
- **影响**: Selena 只想知道"今天做什么", 9 个模式 = 噪声. 选择困难症.
- **改进**: 前台收拢 **3 入口: 今日练 / 错题补 / 模拟考**. 其他后台调度复用.
- **类比**: Khan Academy 用 mastery 颜色, 不暴露内部模式.

### P0-4: 速度档位 "拖拉/超时" = Negative Labeling (Gemini F10 + GPT F3)
- **现状**: ⚡⚡⚡ 闪电 +5 / ⚡⚡ 迅速 +3 / ⚡ 及时 +2 / ⏰ 超时 / 🐢 拖拉 -1.
- **影响**: 对 10 岁女孩, "🐢 拖拉" 是严重 negative label, 抹杀成就感引发逆反. v0.34.98 加 Accuracy-First "深思+5" 但**旧速度档位还在打架**.
- **改进**: 彻底 **删 ⏰ 超时 / 🐢 拖拉**. 速度只给正向 (闪电/迅速 combo bonus), 不给负面 label.
- **类比**: Math Academy 优先 mastery, 不让速度抢戏.

### P0-5: 43% 是概念断层, 不是练习不足 (Gemini F1, 独家洞察)
- **现状**: 错题变式 (`requestRetryQuestion`) 出 **同 skill 同难度**新题. FSRS spaced review 走 1/3/7/14/30 间隔.
- **影响**: 这两个工具都是 "懂了易错"用的, **修不了概念断层**. Selena 错题→变式还错=挫败循环.
- **改进**: 引入 **前置降级诊断** — 错某题时, 变式自动 **降级到 G3 前置知识点**. (例如: G4B 小数加减错, 先确认 G3 整数加减无误)
- **类比**: Khan Academy 知识图谱降级.

### P0-6: 父母快报 = Surveillance (GPT F7, 独家洞察)
- **现状**: 首页"📷 保存今日快报图片(发老师/家长)" + 父母看到逐题错答.
- **影响**: 若 Selena 知道爸爸看每个错题, app 从"我自己的练习"变成"被审讯". 晚上爸爸追问 "这题怎么又错" = 心理避风港崩塌.
- **改进**: 家长端 **只给趋势 + 建议** (e.g. "本周 mastery +5%, 易错单元: 小数乘法"), **隐藏逐题 detail**.

---

## 🟡 P1 — 强建议 1-2 sprint 内做

### P1-1: Scaffold 没 Fail-safe — 连错 2 次会崩溃 (Gemini F7)
- 现 Hint→Tutor→变式 Retry, 变式又错 → 又 Hint→... 死循环.
- **改进**: 同一知识点连错 2 次 → 强制 exit + 安慰奖 "这题太狡猾, 明天再收拾它" + 后台 mark 明天降难度切入.

### P1-2: Streak / 今日打卡 3 ring 是焦虑源 (Gemini F9 + GPT F4)
- Duolingo 流失最高点就在 streak 归零那天.
- **改进**: 加 **Streak Freeze 道具** (用灵感买请假条), 给孩子 autonomy 掌控感.

### P1-3: AI 小进情感连接假设过高 (Gemini F6 + GPT F6)
- 现状: VRM 换装娃娃, 只展示不互动.
- **改进**: Mascot **绑定状态** — 连续对发光; 错答 3 次说"我也觉得难, 一起看老师怎么说". 战友不是宠物.
- 类比: Prodigy 宠物靠战斗成长.

### P1-4: 80 题模拟超注意力 (GPT F10)
- 4 年级有效专注 ~20-25 分钟. 80 题约 1 小时 = 耐力惩罚, 后半段错因是累不是不会.
- **改进**: 改 **20 题 + 复盘 + 休息 + 20 题** 分段. 80 题只为考前彩排.

### P1-5: 23 Template 会被规避 (GPT F9)
- 模板越多 → 用户 "讨厌题型黑洞".
- **改进**: scheduler 记录每 template 的回避率, **软硬混排**, 不让用户自由绕开.

### P1-6: Atelier 会吞 Train (GPT F11)
- 沙箱货币和装饰如果反馈更爽, Selena 上线先换装拖延今日题.
- **改进**: Atelier 必须 **由 mastery 进度解锁**, 不可独立产出快乐.
- 类比: Prodigy 常被批 "玩比学多".

### P1-7: Home 信息密度 (Gemini F11, Claude 自验证)
- Claude 实测: 70 行 / 505 字 / 23 emoji / 27 个 interactive 在 first screen (mcp screenshot).
- 4 年级孩子打开看到的不是"今天做什么", 是 XP/段位/能力诊断 (meta-game).
- **改进**: 一个巨大 "PLAY 开始今日探索" 主按钮, 3 Ring 作为它周围进度条. 模式选择藏二级.

### P1-8: 错答视觉/听觉 (Gemini F12)
- 现作业帮式红叉+刺耳"嘟" = 挫败.
- **改进**: 中性色 (灰/橘 不血红) + 鼓励音效 "Oops 差一点点!".

### P1-9: Dexie 跨端同步隐患 (Gemini F3)
- iPad ↔ PC state 冲突. 晚上拿的星章第二天没看到 = 毁灭打击.
- **改进**: server-side state SSOT 或单设备登录.

### P1-10: 定位矛盾 — 补差 vs 玩耍 (GPT F8, 独家洞察)
- 43%→80% 是补救任务, 沙箱/段位/衣柜是娱乐叙事 — 两个心智模型在 app 里打架.
- Selena 以为来玩, 爸爸以为来补差.
- **改进**: 选边. 主线明确"提分", 沙箱仅作"练完奖励".

---

## 🟢 P2 — 长期考虑

- **P2-1**: 23 模板收敛到 5 种核心交互 (选/填/拖排/连/画) (Gemini F8)
- **P2-2**: iPad Canvas Scratch 人体工学 (Gemini F13, Safari/Webkit 防误触)
- **P2-3**: Mock_exam 20+复盘+20 分段 implementation (P1-4 follow up)
- **P2-4**: Atelier 解锁 gating implementation (P1-6 follow up)

---

## Anchor Metaphor (Gemini)
> "心理避风港 — 先让她连续两周笑着离开 iPad, 再谈 80%."

## TOP 3 Sprint Action (GPT)
> 1. 奖励只留 mastery 进度 (43→80), 其他 4 套降到 background
> 2. 前台模式 9→3 (今日练 / 错题补 / 模拟考)
> 3. 速度体系暂停 ("先对、会讲、再快")

## 我 (Claude) 视角的 META 总结

爸爸/Claude 60 iter 在做 **加法迭代** (每版加一个 feature). 现在到了 **减法时刻**.

最强信号: **6 个 P0 全集中在"减法"上**:
- 减奖励种类 (P0-1, P0-2)
- 减模式选择 (P0-3)
- 减速度负反馈 (P0-4)
- 减"懂了易错"假设 (P0-5, 加降级机制)
- 减父母监控感 (P0-6)

P0-5 是最深的洞察 — Scheduler 现在的假设是"用户在某 skill 已经懂了, 只需反复操练". 但 Selena 43% 说明很多 skill **从未真正懂**, FSRS / 错题变式都是错配工具.

P0-6 是最 emotional 的洞察 — 现行设计假设父母看错题是帮助, 但对 10 岁孩子的心理是 **surveillance**.

## 下轮 Sprint 建议顺序

| iter | 改动 | 影响范围 | 风险 |
|---|---|---|---|
| 1 | **P0-4 删速度负反馈** (⏰ 超时 / 🐢 拖拉) | feedbackLabels + scoring | 低 (1 文件改) |
| 2 | **P0-3 9 mode → 3 入口** (前台) | Home + Train routing + UI copy | 中 (UI 极简, 后台保留) |
| 3 | **P0-6 父母快报聚合化** (隐藏逐题) | Home 快报 export + content | 中 |
| 4 | **P0-1 砍奖励种类** (废段位 city/province/nation) | trophies + tier + SuperAdmin | 高 (data migration) |
| 5 | **P0-5 前置降级诊断** (新 mechanism) | scheduler + retry policy + 题库准备 G3 | 高 (题库要准备 G3 前置) |

每个 iter 走完仍然 mcp Preview verify + peer review + commit. 但 BUILD/REMOVE 比例反过来.
