# Changelog

> 给爸爸/妈妈看的版本演进历史。Selena 不需要看这个文件——升级了她直接刷新就好。
> 所有版本号在 `package.json` + `src/components/Layout.tsx` 的 footer。

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
