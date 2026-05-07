## 题型：speed_match（口算 / 快速判断）

**渲染**：4 个数字选项排成网格，孩子点选最快的那个。题目有 distractors 时也走这个模板。

### 适用 skill
- 口算（小数加减简便、积的小数位数）
- 单位换算（厘米转米）
- 数感判断（哪个最大 / 哪个最接近 1）

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
  "exam_priority": "MUST_SMALL",
  "game_type": "speed_calc",
  "play_as": "speed_match",
  "cognitive_level": "procedural",
  "difficulty": 2,
  "estimated_time_seconds": 15,
  "stem": "0.85 + 1.6 = ?",
  "question_format": "numeric_choice",
  "options": [
    { "id": "A", "text": "2.45" },
    { "id": "B", "text": "2.41" },
    { "id": "C", "text": "1.0145" },
    { "id": "D", "text": "0.245" }
  ],
  "answer": { "type": "choice", "value": "A" },
  "solution_steps": ["小数点对齐相加：0.85 + 1.60 = 2.45"],
  "common_errors": [
    { "tag": "decimal_point_error", "error": "小数点错位算成 0.245", "remediation": "对齐小数点再相加" },
    { "tag": "carry_missing", "error": "忘进位算成 2.41", "remediation": "5+0=5、8+6=14 进位" }
  ],
  "feedback_correct": "厉害！口算又快又准！",
  "feedback_wrong": "再来一次，先把小数点对齐。",
  "hints": [{ "text": "把两个数小数点对齐，逐位相加", "penalty": 1 }],
  "tags": ["ai_generated"]
}
```

### 关键
- stem 短（≤ 30 字）
- 4 个 option 都是数字，区分度大（不要 4 个相邻整数）
- 干扰项必须含小数点错位 / 漏进位 / 操作反 三类典型错误
