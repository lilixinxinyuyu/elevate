# Prompt 编排器（v0.31.34）

> 出题（generate） / 质检（judge） / 修题（fix）三个 LLM 端点的 prompt 都用同一个
> composer 组合，按"轴"模块化注入精确上下文。Selena 的题库质量、难度一致性、不
> 跑题、不重复，全靠这套。

## 设计目标

爸爸提的需求："出题 prompt 应该包含：四年级下册数学相遇问题的定义（避免超纲）+
已有的难度 3 的相遇问题题目列表（避免重复）+ 难度 3 在系统里的定义（避免难度浮动）
+ 选择题的要求（避免太多文字超时）+ 多步骤题的要求（避免每步逻辑不匹配）+ 样题
（避免数据结构不正确）。"

✅ Composer 现在按这五轴 + 一轴去重 = 六轴拼 prompt。

## 六轴

每个轴有自己的目录 / 文件，由 `scripts/build-prompts.mjs` 编进 `_prompts.generated.ts`。

| 轴 | 文件路径 | 数量 | 用途 |
|---|---|---|---|
| 1️⃣ Skill scope | `prompts/skills/scope.json` | 32 个 G4B 核心 skill | 定义 / in-scope / out-of-scope / 公式 / 典型情境 / 常见错误 / 例题 |
| 2️⃣ Difficulty rubric | `prompts/difficulty/{1..5}.md` | 5 | 每个难度的特征 + 时间 + 反例 |
| 3️⃣ Format rubric | `prompts/formats/*.md` | 6（核心）| 每个 question_format 的字段要求 + 设计原则 |
| 4️⃣ Game-type schema | `prompts/questions/game-types/*.md` | 11 | 每个前端模板的 JSON schema 样板 |
| 5️⃣ Existing stems | runtime（db.questions 查询） | dynamic | 防重复 |
| 6️⃣ Quality rubric | `prompts/quality-rubric.md` | 1 共享 | 内联在 system prompt 里，作为 fallback |

## 用例 1：出"四年级下册相遇问题、难度 4、multi_step"题

调用方（`/api/generate/questions` 或 `lib/sessionAdaptive`）传：

```ts
{
  subjectId: "math",
  unitId: "G4B_U5_EQUATIONS",
  unitName: "认识方程",
  skillId: "equation_meeting_problem",
  skillName: "相遇问题",
  term: "下册",
  difficulty: 4,         // 单数字，不是范围
  format: "multi_step",
  gameType: "shop_counter",
  count: 2,
  existingStems: [...],  // 同 skill 的已有题
}
```

Composer 拼出来的 prompt 包含：

```
# 任务：生成 2 道四年级下册数学题

## Skill 教学范围（必读 — 决定不跑题不超纲）

### Skill 范围：相遇问题（equation_meeting_problem）

**定义**：两个物体（人/车/船）从两地同时出发，相向而行，求相遇时间或某一方速度。

**✅ 范围内（请只出这些方向）**：
- 两人/两车从 A、B 两地同时出发，相向而行，求相遇时间
- 已知相遇时间和总路程及一方速度，求另一方速度
- ...

**⛔ 超纲 / 跑题（绝对不要出）**：
- ❌ 追及问题（同向追及，5 年级）
- ❌ 流水问题（6 年级）
- ...

**🔑 关键公式 / 关系**：
- （甲速度 + 乙速度）× 相遇时间 = 总路程
- ...

**🐛 4 年级常见错误（设干扰项时参考）**：
- 把「速度和」用乘法（× 而非 +）
- ...

**📋 题干风格样例**：
- 小明和小红从相距 600 米的两地同时出发相向而行...
- ...

## 难度规范（4）

### 必须满足的特征
- 多步运算（≥ 2 步含一次换算 / 或一次逆向）
- 含一次"陷阱"（容易漏一步、错单位、混用法）
- 题干 60-120 个汉字
- ...

## 答题格式规范（multi_step）

### 必填字段（完整 schema）...
### 设计要求 — 3 步必须形成完整推理链 + 逻辑一致性...

## JSON Schema（按 game-type=shop_counter 输出每道题）

{ "question_id": "...", "subquestions": [...], ... }

## 已有题干（必须避免重复）
- ...

## 输出协议
{ "questions": [...] }
```

总长 ~5000 字符（~1200 token），但每个字符都精确目标化——没有"出语文、出数学、什么
都行"的混杂内容。

## 用例 2：质检某批次题

`/api/agent/judge-questions` 拿到一批 20 道题，可能跨多个 skill。Composer 提取这批
里涉及的 skill scope 列出来（最多 6 个，避免 prompt 爆），让 judge 模型按精确范围
判定。

## 用例 3：会话内"再出一题"

`src/lib/sessionAdaptive.ts` 暴露：

- `requestRetryQuestion(question)` — Selena 答错后，弹"🔄 再出一道类似的"按钮，调
  composer 出同 skill / 同 difficulty / 同 format 的新题，写库（标
  `session_adaptive` tag），下一题就用上。
- `requestHarderQuestion(question)` — Selena 闪电速度答对后，弹"🚀 来道更难的"，
  调 composer 出同 skill / +1 difficulty 的新题。

UI 集成在 `src/components/game/GameShell.tsx` 的 `FeedbackPanel`：
- 错答时显示 cyan "🔄 再出一道类似的"
- 答对 + 闪电/迅速速度 + difficulty < 5 时显示 fuchsia "🚀 来道更难的"

## 添加新 skill scope

在 `prompts/skills/scope.json` 加一个 entry：

```json
{
  "your_skill_id": {
    "name": "中文 skill 名",
    "term": "下册",
    "unitId": "G4B_UX_XXX",
    "definition": "一句话定义",
    "inScope": ["...", "..."],
    "outOfScope": ["❌ ..."],
    "keyFormulas": ["公式 1", "公式 2"],
    "typicalContexts": ["情境 1", "情境 2"],
    "commonMistakes": ["错法 1", "错法 2"],
    "exampleStems": ["样题 1", "样题 2"]
  }
}
```

跑 `node scripts/build-prompts.mjs` 重新生成 `_prompts.generated.ts`。下次出题该
skill 就会自动拿到新范围。

⚠️ JSON 里的中文引用别用 `"`，用 `「」` 或转义（`\"`），否则 JSON 解析挂。

## 添加新难度 rubric / format rubric

直接在对应目录写 .md 文件，跑 build-prompts。

## 缺 skill scope 时怎么办

Composer 自动 fallback 到：
- skillName + global rubric（仍然能限制不跑题，但范围模糊）

所以新 skill 上线时优先在 scope.json 补一条会显著提升出题质量。

## 端到端流程

```
[admin / session]
   │
   ▼
[client lib (qualityJudge / sessionAdaptive / ...)]
   │ JSON request body { skillId, format, difficulty, ... }
   ▼
[functions/api/{generate|agent}/...]
   │
   ▼ uses
[functions/_promptComposer]
   │ assembles 6 axes
   ▼
[LLM (qwen-plus / qwen3 / ...)]
   │
   ▼ JSON response
[validate + write db.questions]
```

## 升级路径

未来可加（按优先级）：

1. **更多 skill scope** — 把语文 skill 也写进 `prompts/skills/scope.json`
2. **drag_drop / sort_ladder / geometry_operation 的 format rubric** — 这些目前缺，但用得少
3. **答题历史驱动**：composer 拿到 student 在该 skill 的最近 N 个 attempt，自动
   挑一个具体的 sub-error 当作"出题焦点"
4. **跨 skill 综合题（D5）的 composer**：注入 2-3 个 skill scope，要求题目交叉使用
