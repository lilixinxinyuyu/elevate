## 题型：plain_choice（4 选 1 标准选择题）

⏱️ **答题时间**：必须按 difficulty 给：
- difficulty 1-2 → `estimated_time_seconds: 20`
- difficulty 3   → `estimated_time_seconds: 30`
- difficulty 4-5 → `estimated_time_seconds: 40`

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
  "cognitive_level": "conceptual",
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
