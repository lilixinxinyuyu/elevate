# 题库质量管线

> 出题 → 验证 → 修题 → 报告 → 重试 的全套机制。本文件是 v0.31.71-81 整套质量改造的文档落地。

## 4 P 原则（核心）

题库唯一的"价值观"判定标准。出题、修题、变式、AI judge 4 个端点都引用同一份 [`prompts/quality-principles.md`](../prompts/quality-principles.md)。

| 原则 | 一句话 | 违反就 |
|---|---|---|
| **P1** 题面纯净 | 学生看到的字段不带元注解（`（无关）` / `errorTag` / "（解题设定）"等）；stem 不嵌入无关 filler | delete |
| **P2** 数学闭合 + 现实合常识 | 整数情境答必须整数；数字必须能闭合 | delete |
| **P3** 干扰项独立 | 错选项不能用题中数字的直接衍生（如 6x 的值） | borderline |
| **P4** skill 真考 | 不能让蒙得到（量级一致 + 结构对称） | borderline |

**重要**：4 个原则故意只有 4 条 — LLM 注意力被切散反而泛化不动。新 vfail 模式应该映射到现有原则的"判定细节"，**不轻易加 P5**。

## 4 个端点 + 4 套 prompt

```
                ┌──────────────────────────────────────┐
                │  prompts/quality-principles.md (P1-P4)│  共享真相
                └──────────────────────────────────────┘
                          ↑       ↑       ↑       ↑
                ┌─────────┴───┐ ┌─┴────┐ ┌┴───────┐ ┌─┴────┐
                │ 出题 system │ │ judge│ │  fix   │ │variant│
                │ (questions/ │ │      │ │        │ │       │
                │  system.md) │ │      │ │        │ │       │
                └──────┬──────┘ └──┬───┘ └────┬───┘ └──┬────┘
                       │           │          │         │
            /api/generate/questions │ /api/agent/fix-question
                                    │ /api/admin/report-question
                       /api/agent/judge-questions
                                              /api/generate/variant
```

每个端点的 system prompt 都 `{{include:quality-principles.md}}`，再叠加自己的特定指引：
- **出题**: 详尽（skill scope + difficulty rubric + game-type schema + skill example + existing stems）
- **变式**: 极简（原题 JSON + 4 条变式原则）— 给 retry 实时出题用，<10s 返回
- **修题**: 中等（issues→修题动作映射 + stable 字段保留约束）— fix-question 和 report-question 共用
- **质检**: 中等（severity 表 + issues 标签清单）

详见 [prompt-composer.md](prompt-composer.md)。

## Audit 工具

题库出现质量问题时按这套流程查根因。

### `_audit-leak-patterns.mjs`

扫 D1 所有 AI 题，按 P1/P2 模式分类：

```bash
APP_PASSWORD=... curl -H "Authorization: Bearer $APP_PASSWORD" \
  https://selena-elevate.pages.dev/api/sync/ai-questions?since=0 -o /tmp/aiqs.json
node scripts/_audit-leak-patterns.mjs
# → /tmp/leak-audit.json
```

输出：
- `clue_meta_annotation`：clue 文本含"（无关）"等元注解
- `option_errorTag_visible`：options 上挂 errorTag 字段（应该在 _internal_）
- `non_integer_count`：果树/人数等可数实物给小数答案
- `math_not_closed_sum`：和倍/差倍题数字不能整除

### `_audit-question-template-match.mjs`

检查 `(play_as, answer.type)` 配对：

```bash
node scripts/_audit-question-template-match.mjs
# → /tmp/template-mismatch.json
```

历史 vfail：
- decimal_shifter + answer.type=choice（30 道 — 模板期 number，target 永远 0）
- plain_choice/shop_counter + answer.type=number 没 options（44 道 — 应改 play_as=plain_numeric）

### `_judge-all.mjs`

跑 v0.31.72+ 4P 原则 judge 扫所有 D1 AI 题：

```bash
APP_PASSWORD=... node scripts/_judge-all.mjs 10 3
# → /tmp/judge-results.json
# 输出 verdict 分布、severity 分布、issues 分布
```

注意：qwen-plus 偏严判，会把 P3/P4 nuance 也判 sev 4-5。fill-bank-v5 端点有 gating（HARD_BUG_TAGS 白名单）只在真 bug 时 delete，其他降级 borderline 保留。

## Cleanup 工具

发现 leak 后批量修。

### `_cleanup-leak-patterns.mjs`

机械改写：strip annotations，移 errorTag 到 `_internal_option_diagnostics`。

```bash
node scripts/_cleanup-leak-patterns.mjs --apply
```

历史使用：v0.31.71 修了 108 道 + 删了 5 道（数学不闭合）。

**v0.31.80 后**：服务端 `/api/sync/ai-questions` POST 端点加了自动 sanitize；任何写入数据自动 strip leak 模式。这个脚本现在主要作历史/审计工具。

### `_fix-decimal-shifter-answers.mjs`

针对 30 道 decimal_shifter + answer.type=choice 的一次性修正脚本。从正确选项 text 解析数值，写回 `{type:number, value:N}`。

### `_fix-template-mismatch.mjs`

针对 44 道 plain_choice/shop_counter + answer.type=number 没 options 的，把 `play_as` 改为 `plain_numeric`。

## 用户报告 → AI 立即修

详见 [report-and-fix.md](report-and-fix.md)。

## 服务端 sanitize at the door (v0.31.80)

`/api/sync/ai-questions` POST 端点在 UPSERT 前自动 strip：
- clue_pick `clues[]` 字符串去掉 `（无关）/（非已知）/（解题设定）/（错误干扰）/（干扰）/（混淆）/（提示）`
- choose `options[].errorTag` 移到顶层 `_internal_option_diagnostics`
- 顶层 `options[].errorTag` 同上
- 空 clue 过滤 + 同步 `correct[]` 索引

**根因背景**：之前 v0.31.71 用 cleanup script 修过 108 道，但 Selena's PWA 有 stale 本地 Dexie，她答题触发的 `pushAiQuestions` 全量 push 把脏数据写回 D1。服务端 sanitize 是终极防线 — 任何 client 写入都自动清理。

## v0.31.72 大改造历史（参考）

5 个 prompt 系统 axis 全部 ship：

| 改造 | 解决的痛点 |
|---|---|
| **A** Subject 隔离 | 数学 prompt 不再含语文段落 |
| **B** Caller-known enum 字段预填 | term/grade/cognitive_level 等不让 AI 选 → 一类 vfail 消失 |
| **C** Schema example 动态选当前 skill 真实样题 | 之前固定 basketball example 跨 skill +leak 模式 |
| **D** existing stems 带 `[Dx]` 难度标 | 全量 stems + 难度参考 |
| **E** 4 P 原则取代 23 条铁律 | 原则 > 铁律，少而强 |

详见 [prompt-composer.md](prompt-composer.md)。

## 当前题库统计（截至 v0.31.81）

- 1408 道 AI 题（math）+ 961 道 SEED
- audit-leak: **0 / 0** P1 leak（服务端 sanitize 接管后保持 0）
- audit-template-match: **1 道** edge case（answer.type=id 字符串）
