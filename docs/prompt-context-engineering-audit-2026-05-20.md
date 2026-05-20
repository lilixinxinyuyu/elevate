# Prompt / Context Engineering 系统审查 (2026-05-20)

> **起源**: 爸爸要求系统性审查整个出题 prompt / context management 系统 —— 不只补语文, 数学也要查, 整体看架构 + 跟其他组件的结合是否有问题.

## 🔥 核心发现: 两套不一致的 prompt 系统

| | 系统 A (CF Pages backend) | 系统 B (ESA EdgeRoutine = xiaojin.app 主路径) |
|---|---|---|
| 文件 | `functions/api/generate/questions.ts` | `aliyun-deploy/src/routes/generate.ts` |
| Prompt 组装 | `composeQuestionUserPrompt()` 完整 | `buildQuestionsUserPrompt()` 简化 |
| skill scope | ✅ 注入 | ❌ 无 |
| difficulty rubric | ✅ | ❌ |
| format rubric | ✅ | ❌ |
| game-type schema | ✅ | ❌ |
| skill keywords 防跑题 | ✅ | ❌ |
| prefilled metadata | ✅ | ❌ |
| **用户实际走哪条** | 备用 | **主路径 (Selena 出题走这)** |

**后果**:
1. Selena 实际出题质量差 (数学 + 语文都受影响) —— 走的是没 scope 的简化 prompt
2. 我前几 iter 加的语文 scope (v0.36.14) 在 ESA 路径根本没生效
3. 两套维护时只改一边 (我 v0.36.14 就只改了 CF Pages)

## Peer Review 整合 (Gemini 3.1 Pro + GPT 5.5)

**两家共识**:
1. ✅ **多轴拼 prompt 架构正确** —— EdTech 标准做法 (Taxonomy-driven Prompting). `学科×知识点×年级×难度×题型` 拆分组装是对的.
2. ✅ **唯一源头原则**: `prompts/*.json` 唯一数据源, `build-prompts.mjs` 唯一生成器, `composeQuestionUserPrompt` 唯一组装逻辑. 不允许两套.
3. ✅ **精准注入 not 全量**: 小模型 (qwen3.6-flash) 被长 prompt 注意力稀释 + 增加 TTFT. 只注入当前 1 个 skill 的 scope, 不是 50 个全塞. (我们 composer 已经是精准注入)

**两家补充建议**:
- **GPT**: 生成后校验/修复环节 (schema / 超纲 / 答案唯一 / banned topic → reject 或短 prompt 重试). 不只靠 prompt 控质量.
- **GPT**: snapshot 测试 —— 同 skill/difficulty/game_type 在 CF 和 ESA 生成的 prompt 做 diff, 保证一致.
- **Gemini**: XML 标签包裹各维度 (`<skill_scope>...</skill_scope>`) —— LLM 对 XML 边界敏感, 降跑题. (现用 markdown `##` 段)
- **Gemini**: Few-shot > 冗长规则 —— 小模型模仿例子 >> 理解抽象规则. 精简 difficulty rubric, 换 1-2 个完美真实例题.
- **Gemini**: 冲突断言 —— composer 拼装时发现 keyFormulas 空就 fallback, 不把空 context 扔给 LLM.

## 已修 (v0.36.14 + v0.36.15)

| Fix | 版本 | 内容 |
|---|---|---|
| 语文新题型 scope | v0.36.14 | 4 个题型级 generic scope (TYPOS/BADSENT/IMITATE/READING) + 后缀 fallback |
| **统一 prompt 系统** | v0.36.15 | `build-prompts.mjs` 多输出一份给 ESA + 自动 copy composer; ESA generate 改用 `composeQuestionUserPrompt` |
| ESA timeout 调整 | v0.36.15 | 完整 prompt 单 call ~10-13s, timeout 10s→25s + 限单 model (不 cascade 超 30s gateway) |

唯一源头落实: 改 prompt 只改 `prompts/*.json` + `functions/_promptComposer.ts`, `build-prompts.mjs` 自动同步到 functions / src/lib / **aliyun-deploy**.

## 待办 (按 ROI 排序)

| 优先级 | 任务 | 来源 |
|---|---|---|
| P1 | chinese game-type 映射 (game-type-by-skill.json chinese = 0; 阅读应 multi_step, 仿写应 fill_blank) | 审查 |
| P1 | ESA 生成后校验 (CF Pages 已有 backfill, ESA 也要) | GPT |
| P2 | 数学 scope 质量复查 (30 个 scope 抽查准确性) | 爸爸 |
| P2 | XML 标签包裹维度 (降跑题) | Gemini |
| P2 | Few-shot 优化 (精简 rubric + 真实例题) | Gemini |
| P3 | snapshot 测试 CF/ESA prompt 一致 | GPT |
| P3 | 中期: composer 抽 shared package (彻底消复制) | 两家 |

## 架构结论

**系统设计本身是对的** (多轴 taxonomy-driven). 问题在:
1. **迁移没做完** —— ESA 简化 prompt 是迁移阿里云时的临时偷懒, 一直没补全 (现已修)
2. **组件结合断裂** —— 用户走 ESA 但 ESA 没接 prompt 系统 (现已接)
3. **ESA 平台限制** —— 9-30s timeout 跟 LLM 出题时间冲突, 完整 prompt 加剧. 中期考虑客户端 AI gen 直接走 CF Pages backend (60s) 而非 ESA.
