# Selena's Elevate · 多学科 (v0.30.10)

像 Elevate 一样的、给 Selena 一个人玩的**多学科**游戏化训练 App。**已上线 https://selena-elevate.pages.dev**（Cloudflare Pages + D1 云同步），本地优先 + 多设备无缝同步。

> 部署 / 升级流程见 [DEPLOY.md](./DEPLOY.md) / [UPGRADE.md](./UPGRADE.md)，版本演进历史见 [CHANGELOG.md](./CHANGELOG.md)。

## 当前状态（v0.30.10）

- **生产 URL**：https://selena-elevate.pages.dev
- **多学科架构**：数学（北师大下册主线，G4A 历史包）+ 语文（人教版下册 1-4 单元）+ 学科选择器，路由前缀 `/:subject/...`
- **学期进度门控（v0.30.9-10）**：每个 (student, term) 维护已解锁 unitId 集合，
  下册默认 U1-U4 解锁（期中范围）；U5/U6 按 `UNIT_UNLOCK_SCHEDULE` 自动解锁
  （5/8 解 U5、6/1 解 U6），也可手动从 Home 页"📅 学期进度"卡解锁。每日挑战 /
  自由练 / 后台 AI 出题都按 unlock 状态过滤；自动解锁触发庆祝弹窗
- **讲题/重做反刷分（v0.30.7-9）**：1st 错答→讲题/重做后会换一道**同型同难度变式题**，
  防"刚看过答案的同题再做"假掌握；tutor-assisted 答对扣 50% XP + 不增 combo +
  Elo 半计 + mistake 仍入库；session 结算显示"X 道一遍就对 · X 道讲题后才对"
- **掌握度算法 v2（v0.28）**：Elo 等级分 + 滚动窗口加权命中率 + 多样性 + Fragility 上限。彻底解决"刷 25 题就全部熟练"的虚高问题（详见 § 掌握度算法）
- **AI 实时出题**：管理页 + 题库低位自动触发；qwen-plus（dashscope）+ token-plan 多 provider，并发 sub-batch + 跨 batch broken-model 跳过 + skill-fidelity 校验
- **AI provider 分流（v0.30.5）**：chat 走 DashScope qwen-plus 优先；image 走 token-plan
  wan2.7-image-pro 优先（用户付费订阅充分利用）
- **小进 AI 老师**（吉祥物熊猫）：苏格拉底式引导讲题、文字 + 语音双模、对话日志保留（v0.27 起）
- **AI 生成勋章图**：每枚 trophy 解锁时盲盒抽奖生成专属图，存 IndexedDB base64 持久化；
  v0.30.4-6 把 5 段位校徽用 wan2.7-image-pro 重生成（512×512 q=0.92 retina sharp）
- **段位系统**：和平街小学 → 锦江区 → 成都市 → 四川省 → 全国，按学期独立 XP 赛季；
  v0.30.5-6 Hero 大改：BIG 210px 校徽 + 段位文字捆绑校徽下方 + 能力诊断折叠
- **期中/期末勋章（v0.30.10）**：今天 ≥ 期中考日 → 自动颁发 commemorative 期中加冕；
  期末同理
- **15+ 游戏模板**：plain_choice / balance_lab / shop_counter / cube_view / triangle_judge / decimal_shifter / equation_builder / clue_finder / chart_detective / vertical_repair / sort_ladder / true_false_swipe / memory_match / shape_court / speed_match
- **多设备云同步**：CF Pages Functions + D1 SQLite，merge-by-timestamp（不互相覆盖）；
  v0.30.0 起 trophyImages 拆出独立 endpoint（per-row D1 写入避开 2.77MB 单参数限）
- **PWA**：可"添加到主屏幕"，紫粉渐变图标
- **密码门**：单密码（`APP_PASSWORD` env var）+ HTTPS + Bearer header

## 掌握度算法（v0.28 重写）

历史版本（v0.27 之前）只看"答对次数 + 起始 50 分"，刷 25 题就到 90 → 全部"熟练"假象。v0.28 完全重写：

```
分数 = 加权命中率 × 0.4 + Elo 分量 × 0.4 + 多样性 × 0.2

加权命中率：最近 30 条 attempt，时间权重 0.5^(天数/14) × 难度权重 0.7+0.16×难度
Elo 分量：学生 Elo 与"完全掌握门槛 1500"的 logistic 距离
多样性：最近 10 条不同 questionId 数 / 4，封顶 1.0

惩罚：
- attempts < 5         → 数据不足按比例打折
- 不同题面 < 3         → × 0.7
- 最近 5 错 ≥ 3 题     → 上限 45（fragile）
- 距离上次答对 > 21 天 → 上限 45（fragile）
```

**6 档标签**：未涉足 (0-19) / 见过几次 (20-39) / 进步中 (40-59) / 较稳 (60-74) / **熟练** (75-89) / **精通** (90-100)

技能地图顶部有"掌握度怎么算"展开卡，UI 上对家长 + Selena 透明。每个 skill 卡 hover 显示 Elo + 已答数 + Fragility 警告。

## 五个入口

| 入口 | URL | 行为 |
|---|---|---|
| **学科选择器** | `/` | 数学 / 语文双卡片，"继续上次"快捷 |
| **每日挑战** | `/math/train` | 跨 3 个最弱 skill 各出 5 道，scheduler 综合算法（遗忘曲线 + 错题加权） |
| **自由练** | `/math/free-practice` | 多选 skill，按 URL `?skillIds=...` 精准出题（v0.27.1 修了串题 bug） |
| **错题复活** | `/math/mistakes` | 间隔重复 1/3/7/14/30 天回炉 |
| **周报** | `/math/report` | 本周练习概况 + 进步最大 / 需要关注 + 模拟考试历史 |

## 技术栈

- Vite + React 18 + TypeScript
- Dexie (IndexedDB v5) — 120 个测试 ✅
- Zod 校验
- Tailwind CSS（深色 + 霓虹渐变 + 自定义动画）
- React Router v6（嵌套路由 `/:subject/...`）
- Cloudflare Pages Functions + D1（云同步）+ DashScope（qwen-plus 出题 / qwen-omni 语音 / wan2.7-image 出图）
- 所有 LLM prompt 在 `prompts/**/*.md`，`scripts/build-prompts.mjs` 编译进 TS（详见 prompts/README.md）

## 数据库

| 表 | 用途 | 同步 |
|---|---|---|
| `students` | 学生档案（含 currentTerm / currentSubject） | ✓ 保留本地 |
| `units` / `skills` | 教材结构（seed） | ✗ 本地教材 |
| `questions` | 题库（seed + AI 生成） | ✗ 本地，AI 题永久保留 |
| `sessions` | 每次挑战会话 + summary | ✓ merge by finishedAt |
| `attempts` | 单次答题记录（append-only） | ✓ union by id |
| `mastery` | 掌握度 + Elo + 滚动窗口 | ✓ merge by updatedAt |
| `mistakes` | 错题表 + 间隔复习状态 | ✓ merge by lastAttemptAt |
| `trophies` | 已解锁奖杯（append-only，每次解锁一行） | ✓ union by id |
| `trophyImages` | AI 生成勋章图 base64 缓存 | ✗ 本地缓存（按需重生成） |
| `tutorSessions` | 小进对话日志 | ✓ merge by updatedAt |
| `meta` | XP / rating / tiersUnlocked / **unlockedUnits** (v0.30.9) / settings | ✓ 按 key 类型分别合并 |

## 运行

```bash
pnpm install
pnpm dev          # http://localhost:5174
pnpm preview      # 生产预览，http://localhost:4173（先 pnpm build）
pnpm test         # 120 个用例
pnpm typecheck
pnpm build        # 跑 build-prompts → build-agent-data → tsc → vite build
pnpm build:prompts # 单独重生成 prompts.generated.ts
```

## 部署

`wrangler pages deploy dist --project-name=selena-elevate --branch=main` —— 详见 DEPLOY.md。

环境变量在 Cloudflare Pages dashboard 配：

- `APP_PASSWORD`：单一密码门
- `DASHSCOPE_API_KEY`：阿里云 DashScope 国际站（出题 / 讲题 / 出图 / TTS）
- `TOKEN_PLAN_API_KEY`：备份 LLM 网关（MiniMax / deepseek / glm / qwen3.6）

## 安全 + 隐私

- 所有 Selena 学习数据在她自己浏览器的 IndexedDB
- 云同步可选（启用时数据传到 D1，加密在 Cloudflare 服务端）
- 单密码保护，HTTPS only
- AI 端点仅在登录后调用，不留服务端用户数据

## 文档索引

- [`CHANGELOG.md`](./CHANGELOG.md) — 版本演进历史（v0.25-v0.30）
- [`docs/phase2-special-trophies.md`](./docs/phase2-special-trophies.md) — 纪念勋章触发器待办（已完成 midterm/final，待做 subrank/birthday/new_semester 等）
- [`DEPLOY.md`](./DEPLOY.md) — Cloudflare Pages 部署
- [`UPGRADE.md`](./UPGRADE.md) — 给 Selena 升级 App 的爸妈指南
- [`prompts/README.md`](./prompts/README.md) — Prompts 仓库结构与构建
- `heping_math_prd_v2.md` — 全量 PRD v2（含设计、模板候选、奖杯系统）
