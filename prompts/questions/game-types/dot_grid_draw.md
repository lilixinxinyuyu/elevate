## 题型：dot_grid_draw（点子图画图）

**渲染**：网格点阵，孩子点击格点添加顶点，自动连线，闭合后判图形类别。

### 适用 skill
- 三角形 / 四边形构造（triangle_classification 进阶）
- 三角形三边关系实操
- 等腰 / 等边判断

### 必填字段
```json
{
  "question_id": "AI_${skillId}_001",
  "subjectId": "math",
  "version": 1,
  "status": "approved",
  "grade": 4,
  "term": "下册",
  "unit_id": "G4B_U2_TRI_QUAD",
  "unit_name": "三角形",
  "skill_id": "triangle_classification",
  "skill_name": "按角/边给三角形分类",
  "ability_dimension": ["spatial", "concept"],
  "exam_priority": "HIGH_SMALL",
  "game_type": "geometry_judge",
  "play_as": "dot_grid_draw",
  "cognitive_level": "application",
  "difficulty": 3,
  "estimated_time_seconds": 60,
  "stem": "在点子图上画一个等腰直角三角形。",
  "question_format": "geometry_operation",
  "answer": {
    "type": "choice",
    "value": "isosceles_right"
  },
  "dot_grid": {
    "gridWidth": 6,
    "gridHeight": 6,
    "expectedShape": "isosceles_right_triangle",
    "minVertices": 3,
    "maxVertices": 3
  },
  "solution_steps": ["等腰直角三角形：两条直角边相等。在点子图上找两条相同长度的直角边即可。"],
  "common_errors": [
    { "tag": "non_isosceles", "error": "三边都不等，不是等腰", "remediation": "至少两边要相等" },
    { "tag": "non_right_angle", "error": "三个角都不是直角", "remediation": "等腰直角三角形必须有一个 90° 角" }
  ],
  "feedback_correct": "画得很对！两条直角边相等～",
  "feedback_wrong": "再试一次：等腰直角三角形要有 1 个 90° 角 + 两条相等的直角边。",
  "hints": [{ "text": "先选一个直角顶点，再分别向两个方向选相等距离的点", "penalty": 1 }],
  "tags": ["ai_generated"]
}
```

### 关键
- expectedShape 必须是 schema 里支持的：parallelogram / rectangle / trapezoid / isosceles_triangle / equilateral_triangle / right_triangle / isosceles_right_triangle
- gridWidth × gridHeight 通常 5×5 到 7×7
- minVertices / maxVertices 三角形是 3，四边形是 4
- 这个题型只用于"画图"操作，不要塞文字答案
