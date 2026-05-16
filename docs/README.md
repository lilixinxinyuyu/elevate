# Selena's Elevate · 文档索引

## 项目概述

- **架构**：Vite + React + TypeScript + Dexie (IndexedDB) + Cloudflare Pages Functions + D1
- **部署**：https://selena-elevate.pages.dev（GitHub Pages 自动部署被 Cloudflare commit-message 校验 bug 卡住，实际通过 `wrangler pages deploy` 直推；详见 dev-ops.md）
- **目标用户**：Selena（10 岁，4 年级），数学练习 + 多学科扩展
- **核心循环**：每日 15 题挑战 + 错题复活 + 段位升级 + 闪电口算 + 闯关 + 巧算工具箱 + 庆祝节点

## 文档导航

### 系统设计 docs（必读）

| 文档 | 写给谁 | 何时看 |
|---|---|---|
| [Trophy 系统](trophy-system.md) | 勋章数据流 + 渲染链路 | 加新勋章 / debug 显示问题 |
| [评分 / 段位 / 反刷分](scoring-and-progression.md) | XP / Tier / Mastery / Anti-farm | 调评分 / 加新激励 |
| [题型 / 游戏模板](game-templates.md) | game_type / play_as / question_format | 加新题型 / 题不渲染 |
| [Prompt 系统](prompt-composer.md) | 出题 / 修题 / 变式 / 质检 4 端口共用 prompt 编排 | 加新 skill / 调出题质量 |
| [质量管线](quality-pipeline.md) | 4 P 原则、audit 工具、AI judge、cleanup 脚本 | 题库出现 leak 模式 / 反复犯错 |
| [Cloud sync](cloud-sync.md) | 实时 push、focus pull、服务端守门、防 stale 覆盖 | 数据"刷新看不到"、跨设备状态不对 |
| [Boss battle](boss-battle.md) | 闯关流程、生命系统、讲题 escalate、enraged 变体 | 改难度 / 加新 boss / 调 hint 流 |
| [User report → AI fix](report-and-fix.md) | 学生 / 用户报告坏题 + AI 立刻修题 | debug AI 修题失败 / 看历史 reports |
| [Feature flag + rollout](feature-flags-and-rollout.md) | Phase 2 flag + 当前 gated 内容 | 加 flag-gated 功能 |
| [**AI 模型注册表**](ai-models-registry.md) | Provider / endpoint / API key / 模型清单 / 任务→模型映射 | 改 endpoint / 加 key / 选 model 时 |

### 工作流 docs

| 文档 | 写给谁 | 何时看 |
|---|---|---|
| [Phase 2 plan ⏸ 存档](phase2-plan.md) | 整体路线图（设计起点，已执行进 production） | 看历史决策 / 不当 TODO |
| [Dev ops](dev-ops.md) | 部署速查 | 跑命令 / 部署 / env 配置 / Cloudflare commit-msg bug |
| [Trophy 图 pipeline](trophy-image-pipeline.md) | AI 图生成（v0.31.96+ 深 navy + CV 透明 + CSS 银环 3 件套） | 加新勋章图 / 透明背景 / Selena 反馈视觉问题 |
| [P2 Math City 沙箱设计](p2-math-city-plan.md) | 备选叙事方向（沙箱原则，无 flag） | 看历史方向 / 不当 TODO |

## 快速链接

### 关键代码

- 主流程：`src/pages/Home.tsx` / `Train.tsx` / `Mistakes.tsx` / `BossBattle.tsx` / `MathTricks.tsx`
- 评分系统：`src/core/scoring.ts` / `rating.ts` / `mastery.ts` / `tiers.ts`
- Trophy 系统：`src/core/trophies.ts` / `src/lib/trophyImages.ts` / `src/components/TierBadgeImg.tsx`
- Cloud sync：`src/db/cloudSync.ts` / `functions/api/sync/*.ts`
- Boss battle：`src/pages/BossBattle.tsx` / `BossWorld.tsx` / `src/components/boss/`
- Phase 2：`src/lib/featureFlags.ts` / `Fluency.tsx` / `BigProblems.tsx` / `DotGridDraw.tsx`
- 巧算工具箱：`src/pages/MathTricks.tsx` / `src/content/mathTricks.ts`
- 庆祝节点引擎：`src/components/CelebrationBurst.tsx`
- 报告 + AI 修题：`src/components/game/ReportQuestionButton.tsx` / `functions/api/admin/report-question.ts`

### 关键脚本

#### 出题 / 补题
- `scripts/_fill-bank-v5.mjs` — 直连 dashscope qwen-plus 补题，绕过 Cloudflare 30s 限制
- `scripts/_dump-prompt.mjs` — 复刻发给模型的完整 prompt（system + user）调试用
- `scripts/_audit-all-counts.mjs` — 审计每 skill 题量，输出 `/tmp/under20.json` 给 fill-bank

#### 题质量 / cleanup
- `scripts/_audit-leak-patterns.mjs` — 扫 P1/P2 leak 模式（`（无关）`、errorTag、整数情境答小数等）
- `scripts/_audit-question-template-match.mjs` — 检查 (game_type, answer.type) 配对错误
- `scripts/_cleanup-leak-patterns.mjs` — 机械修补 leak（v0.31.80 后服务端 sanitize 接管，少需用）
- `scripts/_fix-decimal-shifter-answers.mjs` — 一次性：30 道 decimal_shifter answer.type=choice→number
- `scripts/_fix-template-mismatch.mjs` — 一次性：play_as 校正

#### AI 评判 / 修题
- `scripts/_judge-all.mjs` — 跑 v0.31.72+ 4P 原则 judge 扫所有 D1 AI 题，输出 `/tmp/judge-results.json`

#### 资源 / 图
- `scripts/regenerate-trophies.mjs` — 生成 + 压缩 + push D1 trophy AI 图
- `scripts/_make-boss-transparent.py` — OpenCV 把 boss 白底图转透明 PNG + 生成 enraged 变体

#### 历史一次性脚本
- `scripts/add-skill.mjs` — 加新 skill 一条龙（patch 6+ 文件 + AI 出题 + bump SEED_VERSION）

### 持久化记忆

- 仓库 `docs/`（这里）— 跟代码一起版本化
- `~/.claude/projects/-Users-yong-Desktop-xy/memory/` — Claude 跨 session 记忆

## 加新东西的标准流程

### 加新 skill

```bash
APP_PASSWORD=$(grep ^APP_PASSWORD /Users/yong/Desktop/xy/.dev.vars | cut -d= -f2) \
  node scripts/add-skill.mjs \
    --id new_skill_id --name "新技能" --unit G4B_U1_DECIMAL_ADD_SUB \
    --ability concept --term 下册 --count 30
```

### 补题（v6+ 流程）

```bash
# 1. 拉最新 D1 快照
APP_PASSWORD=... curl -H "Authorization: Bearer $APP_PASSWORD" \
  https://selena-elevate.pages.dev/api/sync/ai-questions?since=0 -o /tmp/aiqs.json

# 2. 审计哪些 skill 缺题
node scripts/_audit-all-counts.mjs

# 3. 跑 fill-bank
APP_PASSWORD=... DASHSCOPE_API_KEY=... \
  node scripts/_fill-bank-v5.mjs 30 4 3 10 下册

# 4. 跑 quality 审计 + AI judge
node scripts/_audit-leak-patterns.mjs
node scripts/_audit-question-template-match.mjs
node scripts/_judge-all.mjs
```

详见 `quality-pipeline.md`。

### 加新 trophy

1. `src/core/trophies.ts` 加 def
2. `src/lib/trophyImages.ts` 加 motif spec
3. `node scripts/regenerate-trophies.mjs --ids math_xxx,...`
4. Read `/tmp/trophies/*.png` QA review
5. 用户刷新 → 自动同步

详见 `trophy-image-pipeline.md`。

### 加新模式 / 大功能

1. 在 `phase2-plan.md` 起草设计
2. 跟 user 对齐方向
3. 实现：types + components + 路由 + feature flag
4. 测试 + preview verify
5. 部署 + 验证

## 项目里程碑

- v0.10s — 题库框架 + 基础 UI
- v0.20s — 多学科架构 + 段位徽章 + AI 出题管道
- v0.28-0.29 — Trophy 系统 v2 + cloud sync 拆分 + AI 图压缩
- v0.30s — 防刷分护栏 + Hero 重设计 + 单元解锁
- **v0.31.0-50s** — Phase 2: Fluency / 闯关 / Canvas / 校园探险世界观
- **v0.31.65-72** — Prompt 系统 5 大改造（subject 隔离 / 字段预填 / 动态 skill example / [Dx] stems / 4 P 原则）
- **v0.31.71-79** — 同步实时化 + 巧算工具箱 + 正反馈密度 + 闯关 hint escalate + 怪物透明 + 报告→AI 修
- **v0.31.80-81** — 服务端 sanitize at the door + PNG-over-JPEG 守门 + stale-client 隔离
- **v0.31.82-85** — Boss 难度收紧（noRetry / 4 星=满血+全对 / hearts=2 / defeat=hearts 0）+ report→fix 加 userAnswer verdict + 选择题答案显示去 id 前缀
- **v0.31.86** — 全项目 review + 一轮清理：用户可见 bug fix（Home 焦点环 4 星虚高 / phase break 假补血 / Fluency hooks / trophy id→name）+ UI 配置（tailwind 漏注册 4 个 glow class / mobile sync chip / iPhone safe-area）+ 服务端守门（ai-questions keep-newer / sanitize 扩展到 stem+subq+option.text / userAnswer 数组解析）+ 删 17 个一次性 scripts + 死代码清理 + composer prefilledFields wiring 接好
- **v0.31.87-90** — game type 多样化（speed_match weight 调高 + 5 新 panel：discount_drift / coin_combo / time_heist / number_hunt / dot_grid_draw 含 emoji burst 庆祝）+ 巧算工具箱内嵌到 Fluency + TodayRings fluency 环双闭判定
- **v0.31.91-93** — Playground 试玩入口 + boss 难度细调 + p2 math city sandbox 设计存档
- **v0.31.94-96** — Trophy 视觉 v94→v95→v96 三轮迭代（最终 v96 三件套：AI motif on deep navy bg + CV flood-fill 透明 PNG + CSS 统一银环。boss 排除）
- **v0.31.97-99** — locked trophy 保留 ring (grayscale 化) / regenerate-trophies 改回 prod /api/generate/image 调用 / 语文加第五单元 · 妙笔写美景（海上日出 + 双龙洞 + 25 题）
- **v0.31.100-101** — Footer 版本号从 package.json 自动注入（之前 hardcoded 不变） / mastery fragility 软 cap（cap 跟 elo 挂钩，1500→60 / 1700→70，不一下打回 45） + UI "待复习" badge
- **v0.31.98 bug fix 四连**：错题复活 sticky-done 防回退 / 巧算 8 技巧死锁（mastered 也调 markDone）/ 闪电匹配 ⚡ 数量 gameplay vs completion 对齐（3⚡/2⚡/1⚡）/ 小数商店最后一步进度条 setStepOk + 400ms 延迟
- **v0.31.102** — prompt 加"绝对禁止元注解"硬规 + sanitize META_PATTERNS 补"（多余）/（迷惑）/（备注）"等漏

详细 changelog 见 `CHANGELOG.md`（仓库根）。
