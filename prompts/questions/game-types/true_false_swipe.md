## 题型：true_false_swipe（真假判断滑动）

**渲染**：展示一句陈述，孩子滑动判断 "对" / "错"（或点选）。

### 适用 skill
- 概念辨析（"等边三角形是特殊的等腰三角形 → 对"）
- 判断式子是否方程（letter_expression / equation_meaning_balance）
- 单位换算判断（"1 米 = 100 厘米 → 对"）

### 必填字段
```json
{
  "question_id": "AI_${skillId}_001",
  "subjectId": "${subjectId}",
  "version": 1,
  "status": "approved",
  "grade": 4,
  "term": "${term}",
  "unit_id": "${unitId}",
  "unit_name": "${unitName}",
  "skill_id": "${skillId}",
  "skill_name": "${skillName}",
  "ability_dimension": ["concept", "reasoning"],
  "exam_priority": "HIGH_SMALL",
  "game_type": "true_false",
  "play_as": "true_false_swipe",
  "cognitive_level": "recall",
  "difficulty": 2,
  "estimated_time_seconds": 12,
  "stem": "等边三角形是特殊的等腰三角形。",
  "question_format": "single_choice",
  "options": [
    { "id": "T", "text": "对" },
    { "id": "F", "text": "错" }
  ],
  "answer": { "type": "choice", "value": "T" },
  "solution_steps": ["等腰三角形定义：至少两边相等；等边三角形三边都相等，是特例。"],
  "common_errors": [
    { "tag": "category_misunderstand", "error": "把等边和等腰当成两类不相交", "remediation": "等边是等腰的子集" },
    { "tag": "definition_confusion", "error": "记错等腰定义", "remediation": "至少两边相等就算等腰" }
  ],
  "feedback_correct": "对！等边三角形就是特殊的等腰三角形",
  "feedback_wrong": "再想想：等腰要求'至少两边相等'",
  "hints": [{ "text": "等腰要求至少两边相等，等边是不是满足？", "penalty": 1 }],
  "tags": ["ai_generated"]
}
```

### 关键
- options 永远是 `[{id:"T",text:"对"},{id:"F",text:"错"}]`（题干就是陈述本身）
- stem 是一句完整的陈述句，不要带问号
- 不要带"输 1 输 0"指令式说法
- difficulty 一般 1-2（简单判断）
