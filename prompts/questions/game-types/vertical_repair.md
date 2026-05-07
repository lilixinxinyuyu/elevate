## 题型：vertical_repair（竖式找错）

**渲染**：展示一个有错的竖式，让孩子从 4 个候选竖式里挑出正确的（或挑出错处）。

### 适用 skill
- decimal_add_sub_vertical（小数加减竖式对齐）
- decimal_mul_vertical（小数乘法竖式）
- 整数竖式（数位对齐）

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
  "ability_dimension": ["calculation"],
  "exam_priority": "MUST_BIG",
  "game_type": "vertical_repair",
  "play_as": "vertical_repair",
  "cognitive_level": "procedural",
  "difficulty": 3,
  "estimated_time_seconds": 35,
  "stem": "小红用竖式计算 3.07 + 2.9，下面哪种对齐方式正确？",
  "question_format": "single_choice",
  "options": [
    { "id": "A", "text": "3.07\n+2.9_\n=5.97（小数点对齐，2.9 末位补 0）" },
    { "id": "B", "text": "3.07\n+ 2.9\n=3.36（末位对齐：7+9=16 进 1，0+2=2 等）", "errorTag": "right_align_wrong" },
    { "id": "C", "text": "3.07\n+0.29\n=3.36（把 2.9 当成 0.29）", "errorTag": "decimal_point_error" },
    { "id": "D", "text": "3.07\n+2.09\n=5.16（把 2.9 当成 2.09）", "errorTag": "decimal_point_error" }
  ],
  "answer": { "type": "choice", "value": "A" },
  "solution_steps": ["小数点对齐 = 相同数位对齐。2.9 末位（十分位）对齐 3.07 的十分位，百分位补 0。"],
  "common_errors": [
    { "tag": "right_align_wrong", "error": "把竖式末位对齐而非小数点对齐", "remediation": "记住：小数点对齐 ＝ 相同数位对齐" },
    { "tag": "decimal_point_error", "error": "把 2.9 看成 0.29 或 2.09", "remediation": "保持原小数不动，只补末尾 0 让位数对齐" }
  ],
  "feedback_correct": "对！小数点对齐就是相同数位对齐～",
  "feedback_wrong": "再看一次：小数点要对齐，不是末位对齐！",
  "hints": [{ "text": "对齐小数点，位数不齐就在末尾补 0", "penalty": 1 }],
  "tags": ["ai_generated"]
}
```

### 关键
- options 用换行 `\n` 模拟竖式视觉
- 4 个候选必须包含一个 "末位对齐" 错（最常见错误）+ 至少一个 "小数点错位" 错
- stem 简短，重点放在 options 上
