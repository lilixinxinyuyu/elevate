# Prompt 系统（v0.31.72-80）

> 出题 / 变式 / 修题 / 质检 4 个端点的 prompt 共享同一份 4 P 原则文件，按"轴"模块化注入精确上下文。

## 4 个端点 + 4 套 system prompt

| 端点 | system prompt | 用途 | 调用入口 |
|---|---|---|---|
| `/api/generate/questions` | `prompts/questions/system.md` | 批量出题（5-30 道） | fill-bank / Admin AI 生成 |
| `/api/generate/variant` | `prompts/variant/system.md` | 单道变式（用于 retry） | "再出一道类似的"按钮 |
| `/api/agent/fix-question` | `prompts/fix/system.md` | 修题（保 question_id） | Admin 手动 fix / report 流程 |
| `/api/admin/report-question` | `prompts/fix/system.md`（同上） | 用户报告 + 修题 | GameShell 🐛 报告按钮 |
| `/api/agent/judge-questions` | `prompts/quality-judge/system.md` | 评判 verdict + severity | 出题闭环 / cleanup |

**共享真相**：所有 system prompt 都 `{{include:quality-principles.md}}` 引同一份 4 P 原则。改一处全生效。

## 关键文件层级

```
prompts/
├── quality-principles.md    ← 4 P 原则，所有端点必 include
├── quality-rubric.md        ← 附加机械约束（题型字段 / 时间表 / 题干语言）
│
├── questions/
│   ├── system.md            ← 出题 system（subject filter math/chinese）
│   ├── user-template.md
│   └── game-types/*.md      ← 11 种 game_type 各自的 schema + 例子
│
├── variant/
│   └── system.md            ← v0.31.73：极简变式 prompt（~600 字）
│
├── fix/
│   └── system.md            ← v0.31.78：修题 prompt（fix-question + report 共用）
│
├── quality-judge/
│   ├── system.md            ← 质检 system
│   └── user-template.md
│
├── difficulty/{1..5}.md     ← 5 个难度档定义
├── formats/*.md             ← 9 种 question_format 要求
└── skills/scope.json        ← 45 个 skill 的精确教学范围
```

## v0.31.72 5 大改造（D + B + C + A + E）

爸爸："规则加得越多模型越混乱，能否加原则？"

| 改造 | 解决的痛点 |
|---|---|
| **A** Subject 隔离 | `<!--SUBJ:MATH-->...<!--/SUBJ:MATH-->` 标记 + build 时按 subject 过滤；数学 prompt 不再混入语文段落 |
| **B** Caller-known enum 字段预填 | composer `prefilledFields` 入参（grade/cognitiveLevel/abilityDimension/questionFormat/estimatedTimeSeconds/examPriority/status/game_type/play_as）渲染成"已确定的元数据"块，AI 原样抄 → 一类 vfail 消失 |
| **C** 动态 skill example | `skillExampleQuestion`：从 SEED 选当前 skill 一道高质量题作 schema 示范，比固定 basketball example 贴 |
| **D** existing stems 带 `[Dx]` | 所有已有题干前缀 `[D{difficulty}]`，让 AI 看到难度分布 |
| **E** 4 P 原则取代 23 条铁律 | quality-principles.md 唯一来源；severity 表只在 judge 用 |

## 出题 prompt 总长

- system: ~8.7K（subject filter 后） — 4 P 原则 + 通用规范
- user: ~14.9K — 任务 + 元数据预填 + skill scope + difficulty rubric + game-type schema + skill example + 全量 stems
- 总计 ~23.6K（v0.31.71 之前是 15.8K，但全是低信号；现在虽然长但全是高信号）

工具：
```bash
# 看实际发给模型的完整 prompt
node scripts/_dump-prompt.mjs equation_sum_difference 4 word_problem_lab
# → /tmp/dump-prompt-output.txt
```

## 变式 prompt（极简）

`prompts/variant/system.md` ~600 字，只引入 4 条变式原则：
1. 题面纯净（=P1）
2. 数学闭合（=P2）
3. distractor 独立（=P3）
4. 保题型保结构（变式专用 — 同 game_type / question_format）

输入：原题 JSON。输出：换数字+换情境的同结构新题（新 question_id）。

实测 ~22s 返回，比全量 prompt 25-50s 快约 50%。Cloudflare 30s wallclock 内。

## 修题 prompt

`prompts/fix/system.md`：

- 任务边界：明示"修题 ≠ 重出 ≠ 评判"
- 引 4 P 原则
- issues → 修题动作映射表（每个 issue tag 对应一种改法）
- v0.31.76 visual 退化检测规则
- 硬约束：保 stable 字段 + schema 完整 + answer 必须有效
- 自查清单 5 条

`fix-question.ts` + `report-question.ts` 都 `PROMPTS.fixSystem.{math,chinese}`。

## ChoiceOption.visual 字段（v0.31.73-76）

`option.visual = { type: "vertical_arithmetic", a, op, b, align }` 给前端 grid 渲染竖式。

**适用**：4 选项视觉**结构**不同（对齐方式 / 数位排列）的题。
**禁用**：4 选项**数值**不同（求积 / 求差 / 求结果）的题 — visual 完全相同会视觉退化。

v0.31.76：`PlainChoice` 检测 ≥2 个 visual 完全相同 → 自动 fall back 到 text，runtime 防御。

## ChoiceOption.errorTag 处理（v0.31.71-80）

errorTag 在 student-visible 字段（options[]）= P1 leak。正确做法：
- 学生看到的 options 不挂 errorTag
- 错答归类放顶层 `_internal_option_diagnostics: [{id, errorTag}]`（admin-only 命名约定）
- 服务端 sanitize 自动迁移：incoming 有 errorTag → 服务端 strip + 移到 _internal

详见 [quality-pipeline.md](quality-pipeline.md)。

## 关键代码索引

```
functions/_promptComposer.ts       # composer + helpers (estimatedTimeFor, questionFormatFor 等)
functions/_prompts.generated.ts    # build 输出，运行时引用
functions/api/generate/questions.ts
functions/api/generate/variant.ts
functions/api/agent/fix-question.ts
functions/api/agent/judge-questions.ts
functions/api/admin/report-question.ts
scripts/build-prompts.mjs          # subject filter + include 处理
scripts/_dump-prompt.mjs           # 调试用，复刻发给模型的完整 prompt
```
