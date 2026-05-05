# Changelog

> 给爸爸/妈妈看的版本演进历史。Selena 不需要看这个文件——升级了她直接刷新就好。
> 所有版本号在 `package.json` + `src/components/Layout.tsx` 的 footer。

## v0.30.14 — 2026-05-05 · SEED_VERSION 补 bump + 错题孤儿清理

**用户报告**："拉了云端最新的，admin 题量还是没有变化（v0.30.12 的 60 道新题没下来）"。

**根因**：v0.30.12 把 `aiGenG4B_U14_Pack` 加进 `SEED_QUESTIONS` 数组，但忘了
bump `SEED_VERSION`（停在 v0.28.3 的 20）。`ensureSeeded()` 看到本地 meta
`seedVersion === 20` 直接 early-return，新题永远进不来 — 现有用户全部漏发，
只有清缓存或新设备才能拿到。

**修复**：
- `src/db/seed.ts` `SEED_VERSION` 20 → 21，强制现有设备重跑 bulkPut（idempotent）。
- 顺手加 `cleanupOrphanMistakes()` 一次性 migration：清掉 `mistakes` 表里
  `questionId` 已不存在于 `questions` 表的孤儿记录。
  - Selena 实际：112 mistakes 里 62 道孤儿（56 unresolved），错题复活页几乎
    全显示 `[题目已移除]`。
  - 来源是历史 admin 清理 / seed 改版时把题删了，但没同步删 mistake 行。
  - 由 `meta:orphanMistakesCleanedAt` flag 防重跑，跨设备 sync 自然带过去。

**Visual review 一并 audit**（生产 https://selena-elevate.pages.dev）：
- 首页 Hero / 段位勋章柜 / 奖杯柜：✅ 视觉无回归
- Train / Skills / 自由练 / 错题复活 / Admin：✅ 路由 + 渲染都正常
- 题量统计页：✅ 显示正确（修复 SEED_VERSION 后会再涨 ~60 道）
- F3-F4（G4A skill 题量=0、G4B U5/U6 必考题量不足）：列入期中后待办，本次不动

## v0.30.12 — 2026-05-05 · 防刷分三层护栏 + 60 道 U1-U4 + Trophy 文字 bug 修

**痛点**：用户观察到 Selena 已经在"姊妹题刷分"——同 skill 同难度不同 question_id 来回刷。
旧 scoring 只对同一题 ID 衰减，不同题就给满分；Elo 慢慢爬；能力诊断"题量"
log(totalAttempts) 也是被刷上限 87%。

**3 层护栏全部上线**：

1. **`siblingDecayMultiplier` (XP 维度)** — 同 skill 历史 correct 数：
   0-7 满分 / 8-14 7折 / 15-22 4折 / 23+ 2折（永远 0.2，留少量鼓励）。
   跟 `repeatDecay`（同题 ID）叠乘——双层衰减。

2. **`ELO_DOMINANT_DELTA = 300` (Mastery 维度)** — 学生 Elo > 题目 Elo + 300 时，
   答对完全不涨 Elo（之前自然衰减仍允许 +4-7 慢爬）；答错仍正常降。

3. **能力诊断"题量"→"覆盖广度"** — 旧 log(totalAttempts) → 新 sum across skills
   of min(5, uniqueCorrectInSkill) 封顶 150。1 skill 100 道只 5 分；30 skill ×
   5 道才满分。tutor-correct 在 7 天准确率里也只算 0.5 跟 mastery 一致。

**G4B U1-U4 必考 skill 补强 60 道**（src/content/aiGenG4B_U14_Pack.ts）：
- 11 个必考 skill 缺口 49 道，浏览器自动跑 /api/generate/questions 4 并发
- 9 skill 全部达标；2 skill（decimal_mul_mix / decimal_work_total）LLM 反复
  超时（应用题复杂），先空着，后续 admin 手补
- 60/68 入库（8 个 dups），D2:18 / D3:8 / D4:34

**Trophy 文字 bug 大修**：
- 之前 commemorative prompt 用「${t.name}」 → AI 把 "第一步"/"期中加冕" 等中
  文名当 TEXT 渲染进图（4/4 全失败！）
- v0.30.12 加 COMMEMORATIVE_MOTIF_SPEC 4 个纯英文视觉描述，删 t.name 引用
- 4 张 commemorative 重生成全验：完全无中文 ✅

**测试**：132 → 138 pass（+6 ability test、+5 sibling test、+7 elo cap test、+5 unitUnlock 已有）

---

## v0.30.11 — 2026-05-05 · subrank_up + 五角星放胖 + 钻档动画 + 全 trophy 重做

- subrank_up 勋章（daily counter）：每升小段 +1
- commemorative 五角星 inner radius 18.6% → 30%（AI 图可见 50% → 75%）
- 钻档 3 层叠加动画（shimmer + shimmerPulse + shimmerSweep）
- buildTrophyPrompt v2 强制 fill canvas 98%+，删 8% 边距
- 浏览器跑 wan2.7-image-pro 重做 77 张 trophy 图（74 一次过 + 3 retry 都成）

---

## v0.30.10 — 2026-05-05 · 学期进度自动解锁 + 期中/期末勋章

**学期进度自动解锁排期**（`src/db/unitUnlock.ts`）：
- `UNIT_UNLOCK_SCHEDULE`：G4B_U5_EQUATIONS=2026-05-08（期中后 2 天）/
  G4B_U6_DATA=2026-06-01（6 月初）
- `runScheduledUnlocks(studentId, now)` 进 Layout 时调一次：把"今天该解锁但
  还没解锁"的单元自动开放，返回新解锁列表给 UI 弹庆祝。幂等。
- 已手动解锁的单元跳过；过期那些一次性补齐。

**单元解锁庆祝弹窗**（`UnitUnlockCelebration.tsx`）：
- 全屏 backdrop + bounce 卡片 + 6 颗 sparkle 旋转闪烁
- 自动解锁前缀"⏰ 时间到啦！"；手动解锁前缀"🎉"
- "去练一练 →" CTA 直跳 free-practice，让她试新单元的 skill

**期中 / 期末勋章实装**（phase2-special-trophies.md 1 + 2 号）：
- `midterm_done` 期中加冕：今天 ≥ MIDTERM_DATE 第一次进 app 解锁
- `final_done` 期末凯旋：今天 ≥ FINAL_DATE 同上
- 用 commemorative 类自带 dedupe，每学期 1 枚

新增 6 个测试（runScheduledUnlocks / UNIT_UNLOCK_SCHEDULE 各场景），120 / 120 pass。

---

## v0.30.9 — 2026-05-05 · 学期进度门控 + 自由练修 bug + tutor XP 0.5

**核心**：考期中只考到 U4，但每日挑战经常出 U5/U6 没学过的题 —— 加单元解锁系统。

- **`src/db/unitUnlock.ts`**：每个 (studentId, term) 维护已解锁 unitId 集合，
  默认 G4A 全开 / G4B U1-U4（期中范围）/ 综合复习 = 上下册 union
- **`UnitProgress` 组件**：Home 页折叠卡，按顺序显示所有单元 + 解锁/锁回按钮，
  强制按顺序解锁（U6 必须先解 U5）
- **过滤生效在 3 处**：buildDailySession / SkillPicker / bgGen 都跳过锁定单元
- **期中/期末/模拟考保留 hard-coded 范围**，不受 unlock 限制（这些就是测覆盖范围）

**自由练自动选 4 个最弱 bug 修**（SkillPicker.tsx）：
- 之前所有未练过 skill mastery score 都 ?? 50 → 并列 → JS sort stable
  退回到 SKILLS 数组顺序 → 看起来"选最前面 4 个"
- 现在显式 weaknessRank：已尝试 score=0 → rank=100（最优先）/
  未尝试 → rank=50 / 已尝试 score=100 → rank=0

**tutor-assisted XP 0.7 → 0.5**（scoring.ts）：
"分数偏严比虚高好；错题以后还能再做拿分，现在不要慷慨加分"

7 个 unitUnlock 测试，114 / 114 pass。

---

## v0.30.8 — 2026-05-05 · 错题后给"同型同难度变式题"重做

**痛点**：v0.30.7 让错→讲题→对扣了 XP 和 combo，但学生还是在重做"刚看过答案的同一道题"——把数字背下来就能对，不是真理解。

**解法**：1st 错答后自动从题库找一道：
  - 同 skill_id（学的概念相同）/ 同 game_type（UI 玩法相同）/ 同 difficulty
  - 不同 question_id（强迫迁移到新情境）
  - 用户从未见过的优先（最锐利的"是否真会"测试）

变式题就绪 → "再做一次"时 swap 显示。变式题不存在 → fallback 同题重做。
`findParallelQuestion` in `src/core/scheduler.ts`，5 个 test。

---

## v0.30.7 — 2026-05-05 · 讲题/重做计分大改 — 防"刷讲题"

**痛点**：错→讲题→对，combo 累积 + summary "全对" + mastery 涨满，跟独立答对几乎一样。重复同题重复讲题重复做对就成了刷分。

**对照表**：

| 维度 | 直接答对 | 自己重做对 | 讲题后做对 | 直接错 |
|---|---|---|---|---|
| XP base | 100% | 100% | **70%（v0.30.9 改 50%）** | 20% |
| Combo +1 | ✓ | ✗ | ✗ | ✗ |
| 速度奖励 | ✓ | ✗ | ✗ | ✗ |
| 新 skill +5 | ✓ | ✗ | ✗ | ✗ |
| Elo actual | 1.0 | 1.0 | **0.5** | 0 |
| Mistake 入库 | — | ✓（1st 错时）| ✓ | ✓ |
| Mistake stage 推进 | ✓ | ✗ | ✗ | regress |

核心：combo 是"独立连续答对"勋章；mistake 入库永远基于 1st 错答事实；
重复"刷讲题"被 repeatDecay 进一步削减（5 次后 0 XP）。

新加 schema 字段：`Attempt.usedTutor` / `Attempt.attemptOrdinal` /
`MasteryRecentEntry.usedTutor` / `SessionSummary.tutorAssistedCount` /
`SessionSummary.firstTryCorrectCount`。

结算页加"X 道一遍就对 · X 道讲题后才对"真实统计。

6 个新 scoring test，102 / 102 pass。

---

## v0.30.0 ~ v0.30.6 — 2026-05-04 · Hero 大改 + 题库补强 + 校徽

跨多个迭代：

- **G4B AI 题库补强**：浏览器自动化跑 /api/generate/questions，DashScope qwen-plus
  出题 18 个 G4B skill 各补 4-12 道。174 道 → 153 入选（去重 + 禁词扫 + answer.type 校验）
- **AI provider 分流**：chat 用 DashScope（qwen-plus 25s 内可返回），image 用
  token-plan（wan2.7-image-pro 比 wanx2.1-turbo 强很多）
- **Hero 重设计**（TierCard.tsx）：BIG 校徽 210px 移右、段位文字捆绑校徽下方、
  能力诊断折叠、垂直节奏 4-base grid、双 rim 冲突删 CSS ring
- **校徽 sharpness**：tier badge 压缩 256→512 q=0.92 retina 不糊
- **Tier badge prompt v2**：勋章圆形 fill 整画面 98%+、内部 tier 主题色径向渐变、
  绝对禁文字
- **5 段位校徽 AI 重生成**：用 wan2.7-image-pro 出，全无黑边
- **Cache key 统一**：Hero / 段位勋章柜 / XP 下小图都用同一 `math_tier_${id}`

---

## v0.28.0 — 2026-05-04 · 掌握度算法换骨

**核心改动**：mastery 算法重写为 Elo + 滚动窗口 + 难度加权 + Fragility。

老算法（v0.27 之前）每对一题固定 +2.4~3.5 分、不衰减、不区分新旧、5 道唯一题就解锁 80 分上限 → 25 题就全"熟练"，跟模考 75% 严重不一致。

新算法：
- **学生 Elo**（一个数字）：每次答题双向更新；难题答对涨得多
- **滚动窗口加权命中率**：最近 30 题，时间衰减半衰期 14 天 + 难度权重 0.7~1.5
- **多样性**：最近 10 题不同 questionId 数 / 4
- **Fragility 上限 45**：21 天没答对 / 最近 5 错 3 时强制掉到"较稳"以下

新阈值 **6 档**：未涉足 (0-19) → 见过几次 → 进步中 → 较稳 → **熟练 (75-89)** → **精通 (90-100)**

Dexie v5 自动 upgrade：扫所有现有 attempt 重放算法，回填 studentElo / recent / lastSuccessAt 等字段。

借鉴：Duolingo Birdbrain（Elo 自校准）+ Khan Academy（5-in-a-row + 时间门）+ FSRS（遗忘曲线）+ PFA（recency weighting）。

---

## v0.27.2 — 2026-05-04 · 奖杯柜视觉清理

- 奖杯卡片去掉外层 amber 边框 + shadow（之前和 TrophyIcon 自己的 ring 双框过密）
- TrophyIcon emoji 兜底也去掉显式 border
- 奖杯柜头部加 chip "✨ N 枚还没 AI 图"，深链 `/math/admin#trophy-images` → 可一键批量补图
- AdminPage 加 useLocation hash 监听，进页面后自动 scrollIntoView 到对应 id 的 card

## v0.27.1 — 2026-05-04 · 自由练串题 + 模考历史

**P0 路由 bug**：`SkillPicker` 用 `/train?skillIds=...` 老路径，被 `<Navigate to="/math/train">` 兜底重定向时**丢 query string**，导致选 A 出 B → 自由练永远变成"每日挑战出最弱 skill"。修复 SkillPicker 走绝对路径 `/math/train`，router 加 LegacyRedirect 组件透传 search + hash。

其他：
- AI 勋章图终于显示在奖杯柜（TrophyWall 用 `<TrophyIcon>` 组件读 `db.trophyImages`）
- 删除 v0.27.0 加的 TrophyWall 段位徽章分组（跟 BadgeInventory 重复）
- 每日挑战变跨 3 个最弱 skill 出 15 道综合题（之前单 skill 5 道）；自由练保持单 skill 8 道
- 模拟考试历史在周报页可查（最近 5 条 + 可展开 20 条）
- math navItems 加"周报"入口

## v0.27.0 — 2026-05-04 · 段位徽章 + Prompts MD + 出题守 skill + 小进对话日志

- **Prompts 全部抽到 `/prompts/**/*.md`**，`scripts/build-prompts.mjs` 编译进 `functions/_prompts.generated.ts` + `src/lib/_prompts.generated.ts`
- 加 6 个 game-type schema：`plain_choice` / `cube_view` / `balance_lab` / `decimal_shifter` / `triangle_judge` / `shop_counter`
- **出题守 skill**：服务端按 `prompts/skill-keywords.json` 校验 stem 是否真的扣 skill，否则丢弃重试。修了"用户选 cube_shape_count 但 LLM 偷懒生成平均数"的 bug
- 小进对话日志：Dexie v4 加 `tutorSessions` 表，TutorPanel 每条消息增量写回 db；cloudSync 加进 PUSH_TABLES
- 段位徽章奖杯墙分组（v0.27.1 移除，跟 BadgeInventory 重复）

## v0.26 系列（v0.26.0 ~ v0.26.12） — 2026-05-03 · 出题超时 + 题库诊断 + 系统修复

跨多个迭代：

- **AI 出题超时根因**：DashScope FreeTier 限制 + 部分 model 不支持 `enable_thinking=false`。Provider 顺序改 dashscope-first（qwen-plus 是唯一稳定可用的），enable_thinking 仅对 qwen3.x 生效，per-provider lazy 30s budget
- **题库诊断面板** (`QuestionsAdminPanel`)：列出每 skill 题数、bad question 检测 (game-type 感知)、按 skill trim 到 30 题
- **mastery 防刷分**：同题重复对衰减 + 唯一题数封顶 30+N×10（v0.28 整体重写后这个垫层弃用）
- **AI 勋章图缓存**：512×512 sticker + 圆形遮罩 + 段位 badge 专门 prompt
- **段位 + milestone 盲盒**：rare trophy 解锁时 LotteryBoxModal 抽奖生成专属图，常规增量解锁不抽
- **小进吉祥物**：四川大熊猫 + 学士帽 + 魔法棒，所有 AI loading 状态都用她
- **数据 sync 修复**：pull 改用 merge-by-timestamp，本地不被远程旧快照覆盖；chinese train 完成时 push
- **chinese train 模拟考完成 push 修了**

## v0.25.0 — 2026-04-XX · AI 勋章图 + 盲盒 + bg gen 指示器 + resume fix

第一次接 wan2.7-image-pro 出图。盲盒 modal + 烟花 reveal 动画。BgGenIndicator 全局 toast 显示后台出题进度。

---

## 早期里程碑（v0.8 ~ v0.24）

详细 PRD 在 `heping_math_prd_v2.md` 和 `heping_math_prd_engineering_v1.md`。关键：

- **v0.20+**：多学科架构（数学 + 语文 ComingSoon）、嵌套路由 `/:subject/...`、Dexie v2 学科隔离 migration
- **v0.15+**：14 个游戏模板齐活（balance_lab / cube_view / triangle_judge 等带 SVG 视觉）
- **v0.10+**：试卷错题包导入（U2 / U3 / U4 三张过关检测卷）、`wrong_origin` 标签调度优先
- **v0.8.1**：22 种奖杯（单次型 + 计数型 ×N 显示）、期中冲刺模式 `mode=midterm`
