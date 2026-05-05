# Selena's Elevate · 文档索引

## 项目概述
- **架构**：Vite + React + TypeScript + Dexie (IndexedDB) + Cloudflare Pages Functions + D1
- **部署**：https://selena-elevate.pages.dev
- **目标用户**：Selena（9 岁，4 年级），数学练习 + Phase 2 后续语文 / 英语
- **核心循环**：每日 15 题挑战 + 错题复活 + 段位升级，加 Phase 2 闪电口算 / 闯关 / Canvas 画图

## 文档导航

### 系统设计 docs（必读）
| 文档 | 写给谁 | 何时看 |
|---|---|---|
| [Trophy 系统](trophy-system.md) | 勋章数据流 + 渲染链路 | 加新勋章 / debug 显示问题 / locked 状态 |
| [评分 / 段位 / 反刷分](scoring-and-progression.md) | XP / Tier / Mastery / Anti-farm | 调评分 / 加新激励 / 想破坏 anti-farm 前先读 |
| [题型 / 游戏模板](game-templates.md) | game_type / play_as / question_format / GameTemplate 分发 | 加新题型 / 题不渲染 / Panel 不显示 |
| [Cloud sync](cloud-sync.md) | sync 架构 + 调试 | 数据"刷新看不到"、跨设备状态不对 |
| [Feature flag + rollout](feature-flags-and-rollout.md) | Phase 2 flag + 当前 gated 内容 | 加 flag-gated 功能 / 翻 flag |

### 工作流 docs
| 文档 | 写给谁 | 何时看 |
|---|---|---|
| [Phase 2 plan](phase2-plan.md) | 整体路线图 | 想"接下来做什么"|
| [Dev ops](dev-ops.md) | 部署速查 | 跑命令 / 部署 / env 配置 / 常见错误 |
| [Trophy 图 pipeline](trophy-image-pipeline.md) | AI 图生成 → 压缩 → push D1 | 加新勋章图 / 重抽现有 |
| [Phase 2 special trophies](phase2-special-trophies.md) | 历史 trophy 设计稿 | 历史参考 |

## 快速链接

### 关键代码
- 主流程：`src/pages/Home.tsx`、`src/pages/Train.tsx`、`src/pages/Mistakes.tsx`
- 评分系统：`src/core/scoring.ts`、`src/core/rating.ts`、`src/core/mastery.ts`
- Trophy 系统：`src/core/trophies.ts`、`src/lib/trophyImages.ts`
- Cloud sync：`src/db/cloudSync.ts`、`functions/api/sync/*.ts`
- Phase 2：`src/lib/featureFlags.ts`、`src/pages/Fluency.tsx`、`src/pages/BigProblems.tsx`、`src/components/game/templates/DotGridDraw.tsx`

### 关键脚本
- `scripts/add-skill.mjs` — 加新 skill 一条龙（patch 6+ 文件 + AI 出题 + bump SEED_VERSION）
- `scripts/regenerate-trophies.mjs` — 生成 + 压缩 + push D1 trophy AI 图

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
然后 review git diff、跑 tests、commit、deploy。详见 `dev-ops.md`。

### 加新 trophy
1. `src/core/trophies.ts` 加 def
2. `src/lib/trophyImages.ts` 加 motif spec（**必须** 否则中文 leak）
3. `node scripts/regenerate-trophies.mjs --ids math_xxx,...`
4. Read `/tmp/trophies/*.png` QA review
5. 改 motif 重抽不合格的
6. 用户刷新 → 自动同步

详见 `trophy-image-pipeline.md`。

### 加新模式 / 大功能
1. 在 `phase2-plan.md` 起草设计
2. 跟 user 对齐方向
3. 实现：types + components + 路由 + feature flag
4. 测试 + preview verify
5. 部署 + 验证

## 项目里程碑

- v0.10s 题库框架 + 基础 UI
- v0.20s 多学科架构 + 段位徽章 + AI 出题管道
- v0.28-0.29 Trophy 系统 v2 + cloud sync 拆分 + AI 图压缩
- v0.30s 防刷分护栏 + Hero 重设计 + 单元解锁
- **v0.31s Phase 2** — Fluency / 闯关 / Canvas / 校园探险世界观

详细 changelog 见 `CHANGELOG.md`（仓库根）。
