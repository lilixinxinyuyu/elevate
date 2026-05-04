## 题型：cube_view（立体观察 / 数小正方体）

⏱️ **答题时间**：`estimated_time_seconds: 35`（立体空间想象需要时间，难度 4+ 给 45）

⚠️ **关键**：这种题需要客户端渲染 3D 立体图，所以你**必须**在 `tags` 数组里给一个 `solid:` tag，描述每个小正方体的坐标。

### tag 格式

`solid:x,y,z|x,y,z|x,y,z` —— 每个 `|` 分隔一个小正方体，`x,y,z` 是该立方体的整数坐标（0-3 范围）。

例：3 个排成 L 形 → `solid:0,0,0|1,0,0|1,1,0`

### stem 题型示例（围绕"几个小正方体"或"几个面"）

- "下面这个图形由几个小正方体组成？"
- "从正面看，能看到几个面？"
- "从上面看是什么形状？"
- "这个图形里有几个面是露出来的？"

### 必须字段（**继承 plain_choice 的全部字段**，下面只列差异）

⚠️ **完整 JSON 必须包含所有 plain_choice 必备字段**（question_id / subjectId / version / status / grade / term / unit_id / unit_name / skill_id / skill_name / cognitive_level / difficulty / estimated_time_seconds / stem / common_errors / feedback_correct / feedback_wrong / hints / tags / exam_priority）。**枚举值严格按 quality-rubric.md 第 1.5 节**。

差异化字段：

```json
{
  "game_type": "cube_view",
  "play_as": "cube_view",
  "question_format": "single_choice",
  "cognitive_level": "reasoning",
  "ability_dimension": ["spatial"],
  "estimated_time_seconds": 35,
  "tags": ["ai_generated", "solid:0,0,0|1,0,0|1,1,0"],
  "options": [
    {"id": "A", "text": "3"},
    {"id": "B", "text": "4"},
    {"id": "C", "text": "5"},
    {"id": "D", "text": "6"}
  ],
  "answer": {"type": "choice", "value": "A"}
}
```

立方体数量在 2-8 之间，不要超过 8 个（视觉上会乱）。
