## 题型：plain_choice（4 选 1 标准选择题）

⏱️ **答题时间**：先按 difficulty 给基础值，再按"阅读量"加成。**长题必须多给时间**——
小学生读字慢，4 行情境题 + 4 行选项跟一句计算题不能同时间。

**基础值**（短题：题面一句话内、选项每个 ≤ 12 个字）：
- difficulty 1-2 → 基础 20s
- difficulty 3   → 基础 30s
- difficulty 4-5 → 基础 40s

**阅读量加成**（**累加**到基础值上，不是替换）：
- 题面 stem 超过 60 字（一段文字描述情境）→ **+15s**
- 题面 stem 超过 120 字（多句情境/多步描述）→ **+25s**（替代上一条）
- 任一 option text 超过 20 字 / 多行内容（含竖式 / 多步算式 / 描述）→ **+15s**
- 题面含图示、表格、竖式描述（用 `─` `┃` `┃` `+` `-` 等画图字符）→ **+20s**

**最终范围**：`estimated_time_seconds` 在 20-90s 之间，超过 90 就过长，需要重新设计题目让它更紧凑。

**举例对照**：
- D2 "0.6 里面有几个 0.1?"（短题）→ 20s
- D3 "下列哪个分数是最简？(选项 A 1/2 B 2/4 C 3/6 D 4/8)"（短题短选项）→ 30s
- D3 "小丽去文具店买一支钢笔和一本笔记本，钢笔标价 12.5 元……（4 行竖式选项）"
  → 30 (基础) + 15 (stem ≥60 字) + 15 (option 多行竖式) = **60s**
- D4 长情境多步推理 + 含表格 → 40 + 25 + 20 = **85s**（接近上限）

⚠️ **必填枚举字段（合法值，不要改写、不要翻译）**：
- `term`: 必须是 `"上册"` 或 `"下册"`（用户传入的 `{{term}}`）。**不要写 `"G4A"` / `"G4B"`** — 那是 unit_id 的前缀，不是 term 的值。
- `cognitive_level`: 必须是 `"recall"` / `"procedural"` / `"application"` / `"reasoning"` 中的一个。**不要写 `"conceptual"`**。
- `ability_dimension[]`: 数组元素必须从 `["calculation","concept","reasoning","modeling","spatial","data","strategy","habit"]` 选。**不要写 `"conceptual"`，不要写 `"procedural"`**（procedural 是 cognitive_level 的值，不是 ability）。
- `question_format`: `"single_choice"`（plain_choice 题型固定这个）。
- `exam_priority`: 见 prompts/quality-rubric.md，常用 `"HIGH_BIG"`。

⚠️ **`solution_steps` 是字符串数组，不是对象数组**：
- ✓ `"solution_steps": ["先算 A，得 X", "再算 B，得 Y", "因此答案是 Z"]`
- ✗ `"solution_steps": [{ "step": 1, "text": "..." }]`

⚠️ **`hints[].penalty` 是整数 1-3，不要用浮点**：
- ✓ `{ "text": "提示...", "penalty": 1 }`
- ✗ `{ "text": "提示...", "penalty": 0.5 }`

输出每题的 JSON 形如：

```json
{
  "question_id": "AI_{{skillId}}_001",
  "subjectId": "{{subjectId}}",
  "version": 1,
  "status": "approved",
  "grade": 4,
  "term": "{{term}}",
  "unit_id": "{{unitId}}",
  "unit_name": "{{unitName}}",
  "skill_id": "{{skillId}}",
  "skill_name": "{{skillName}}",
  "ability_dimension": ["{{defaultAbility}}"],
  "exam_priority": "HIGH_BIG",
  "game_type": "plain_choice",
  "play_as": "plain_choice",
  "cognitive_level": "procedural",
  "difficulty": 3,
  "estimated_time_seconds": 30,
  "stem": "题面文字",
  "question_format": "single_choice",
  "options": [
    {"id": "A", "text": "选项 A"},
    {"id": "B", "text": "选项 B"},
    {"id": "C", "text": "选项 C"},
    {"id": "D", "text": "选项 D"}
  ],
  "answer": {"type": "choice", "value": "A"},
  "solution_steps": ["分析步骤一句话"],
  "common_errors": [
    {"tag": "{{errorTagExample}}", "error": "常见错误描述", "remediation": "怎么纠正"}
  ],
  "feedback_correct": "答对的反馈",
  "feedback_wrong": "答错的反馈",
  "hints": [{"text": "提示文字", "penalty": 1}],
  "tags": ["ai_generated"]
}
```
