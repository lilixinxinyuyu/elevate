# scripts/

构建 / 运维脚本。所有 `.mjs` 都是 Node ESM，跑前先 `nvm use 22`（v12 起步会炸）。

## 主要

### `add-skill.mjs` — Phase 2 Axis 4 一条龙加新 skill
> 加 skill 从改 6+ 文件压成一条命令 + 审 git diff。先看 [docs/phase2-plan.md](../docs/phase2-plan.md) Axis 4。

**用法**：
```bash
ELEVATE_PASSWORD=xxx node scripts/add-skill.mjs \
  --id mul_table_9 --name "9×9 乘法口诀" \
  --unit G4B_FLUENCY --ability fluency,calculation --term 下册 \
  --difficulty 1-2 --count 30 \
  --create-unit --unit-name "口算基本功" --order-index 99
```

**会 patch 的文件**：
- `src/content/skills.ts` — append skill row
- `src/content/units.ts` — 如果 `--create-unit` 且 unit 不存在
- `src/content/aiGenSkill_<id>.ts` — 新建 pack 文件（生成的题）
- `src/content/questions.ts` — import + spread 注册新 pack
- `src/db/seed.ts` — bump SEED_VERSION（确保现有用户也下载新题）

**安全网**：
- `--dry-run` 不写文件，只打印计划
- `--no-gen` 跳过 AI 出题（只 patch schema，pack 留空）
- 不自动 commit。所有改动 stage 在 working tree，`git diff` 自己审

**API 密码**：见 Cloudflare Pages env vars。

### `_emit-g4b-u14-pack.mjs` / `_emit-g4b-ai-pack.mjs`
历史脚本：浏览器 dump JSON → 验证 → 转 TS pack。`add-skill.mjs` 替代了大部分场景。

### `_count-g4b.mjs` / `_count-g4b-u14.mjs`
统计 G4B 题量分布的临时分析脚本，可删。

### `_load-content.ts` / `build-prompts.mjs` / `build-agent-data.mjs`
build 时跑（在 `npm run build` 里调），勿改。
