# scripts/

构建 / 运维脚本。所有 `.mjs` 都是 Node ESM，跑前先 `nvm use 22`（v12 起步会炸）。

约定：`_` 前缀 = 不在 `npm run` 里、跑前要小心（很多吃 APP_PASSWORD env / 直接改 D1）。
没前缀的是 build helper 或 npm-invoked。

## 主要工作流

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

### `_fill-bank-v5.mjs` — 闭环填题

补题主力。详见 [hermes-skill/question-bank-fill/SKILL.md](../hermes-skill/question-bank-fill/SKILL.md)。

```bash
APP_PASSWORD=$APP_PASSWORD TARGET=30 node scripts/_fill-bank-v5.mjs <target_per_skill> <passes>
```

v5 自带 need-aware skip：已 ≥ TARGET 的 skill 不再发 prompt，可重复跑直到收工。

### `_dump-prompt.mjs` — 复刻完整 prompt 调试

```bash
node scripts/_dump-prompt.mjs <skillId> <gameType> <difficulty>
```

跟服务端 `composeQuestionUserPrompt` 完全一致，方便人肉 review prompt。

### `regenerate-trophies.mjs` — 勋章图重生 + 压缩 + push

详见 [docs/trophy-image-pipeline.md](../docs/trophy-image-pipeline.md)。

```bash
APP_PASSWORD=$APP_PASSWORD node scripts/regenerate-trophies.mjs --missing
```

## 周期性工具

### Quality 审计（[docs/quality-pipeline.md](../docs/quality-pipeline.md)）

- `_audit-leak-patterns.mjs` — P1 leak（"（无关）" 等元注解）扫描
- `_audit-question-template-match.mjs` — `play_as` vs `answer.type` 不匹配
- `_audit-all-counts.mjs` — per-skill 题量
- `_cleanup-leak-patterns.mjs` — 机械清理 leak 模式（一般在 server-side sanitize 兜底，本地排查用）
- `_judge-all.mjs` — 批量 AI judge 全量 D1 题
- `_scan-pinyin-leak.mjs` — 语文 stem 拼音泄漏
- `audit-questions.mjs` — npm `audit:questions` 入口

### Boss 图片 pipeline

- `_generate-boss-images.mjs` — DALL-E / 千问出图
- `_make-boss-transparent.py` — OpenCV flood-fill 透明化 + enraged 变体（需 Python + opencv-python）

### 内容提取（HTML → 资源）

- `extract-chinese-chars.mjs` / `extract-english-words.mjs`

## Build helpers（npm scripts 调用，勿手动）

- `build-prompts.mjs` — `prompts/*.md` → `functions/_prompts.generated.ts` 和 `src/lib/_prompts.generated.ts`
- `build-agent-data.mjs` — agent 元数据
- `_load-content.ts` / `_load-content-extended.ts` / `_load-trophy-prompts.ts` — esbuild bundle entries
- `_emit-g4b-ai-pack.mjs` — 历史 pack 转换（保留作 `add-skill.mjs` 参考）

## 历史（v0.31.86 一次性扫除已删）

参见 [hermes-skill/question-bank-fill/SKILL.md](../hermes-skill/question-bank-fill/SKILL.md) 的「历史脚本」段。
git log 里能找到 `_fill-bank-v2/v3/v4`、`_keep-filling.sh`、各种一次性 fix /
migrate / count / bench / debug 脚本。
