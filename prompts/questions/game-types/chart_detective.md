## 题型：chart_detective（数据侦探 · 条形图）📊

⏱️ **答题时间**：`estimated_time_seconds: 45`（看图 + 读数 / 算平均数）。

⚠️ 这种题用客户端 ChartDetective 组件渲染：根据 `tags` 里的 `bars:` 把数据画成柱形图，
学生把一条虚线拖到目标位置（平均数 / 某个统计量），所以 **answer 必须是 `numeric`**。

### tag 格式（必填）

- `bars:v1,v2,v3,...` —— 柱形图各柱的数值，用英文逗号分隔（如 `bars:120,128,124,132,126`）。
  柱子数量一般 4～6 个，数值要和 stem 的情境一致（跳绳次数 / 气温 / 销量…）。
- 可选 `step:1` 表示单步拖动题。

### answer

`{ "type": "number", "value": <目标值> }` —— `value` 是要拖到的位置：
- 求平均数题：value = 所有柱值之和 ÷ 柱数（**必须整除得整数或一位小数**，设计数据时先验算）。
- 读最值 / 求差题：value = 对应的那个数。

### 适用 skill

只在数据 / 统计类 skill 用：`average_compute` / `average_inverse_total` / `data_bar_chart`。
不要给纯计算 / 几何 skill 用。

### stem 示例

- “把虚线拖到 5 次跳绳成绩的平均数位置：”
- “下面是某周最高气温，把虚线拖到平均气温的位置：”
- “把虚线拖到销量最高的那一天的位置：”

### 必填字段（**继承 plain_choice 全部公共字段**，下面只列差异）

⚠️ 完整 JSON 必须含所有公共字段（question_id / subjectId / version / status / grade / term /
unit_id / unit_name / skill_id / skill_name / ability_dimension / exam_priority / cognitive_level /
difficulty / estimated_time_seconds / stem / solution_steps / hints / common_errors /
feedback_correct / feedback_wrong / tags）。枚举值严格按 quality-rubric.md。

差异字段：
```jsonc
{
  "game_type": "chart_detective",
  "play_as": "chart_detective",
  "question_format": "numeric",
  "answer": { "type": "number", "value": 126 },
  "tags": ["bars:120,128,124,132,126", "step:1"]    // 加 from_test/exam 期末题 tag 时一并放这里
}
```

### 真实样例

```jsonc
{
  "stem": "把虚线拖到 5 次跳绳成绩的平均数位置：",
  "game_type": "chart_detective",
  "play_as": "chart_detective",
  "question_format": "numeric",
  "answer": { "type": "number", "value": 126 },
  "solution_steps": ["总数：120+128+124+132+126 = 630", "630 ÷ 5 = 126"],
  "hints": [
    { "text": "平均数大约在最大与最小数中间", "penalty": 1 },
    { "text": "总和 ÷ 5 算一下", "penalty": 1 }
  ],
  "common_errors": [
    { "tag": "average_formula_error", "error": "随便估", "remediation": "用总数 ÷ 份数检验。" },
    { "tag": "careless_reading", "error": "漏看一个数据", "remediation": "把每个柱都加进去。" }
  ],
  "tags": ["bars:120,128,124,132,126", "step:1", "from_test", "exam", "期末题"]
}
```

### 出题守则

1. `bars:` 的数值个数 = stem 里说的数据条数，缺一不可。
2. **求平均数题必须先验算**：和 ÷ 条数 = 整数或一位小数，否则改数据（4 年级不出现复杂小数平均）。
3. `answer.value` 必须真实等于目标统计量（平均数 / 最值），别和 `bars` 矛盾。
4. stem 给具体情境（跳绳 / 气温 / 销量 / 借书量），不要抽象“一组数”。
5. `solution_steps` 写出“总和 → ÷ 份数”的过程；`hints[].penalty` 是整数 1-3。
