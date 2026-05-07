## 答题格式：fill_blank（填空题 / 自由输入数字）

**特点**：题干结尾问"…是多少 X？"或含 `___` / `（  ）` 等空白标记，孩子直接输入数字（含单位由前端显示）。前端用 plain_numeric 模板，**不**显示选项。

### 必填字段
```json
{
  "question_format": "fill_blank",
  "answer": { "type": "number", "value": 0.158, "unit": "米", "acceptable_error": 0.001 }
}
```

### 何时用 fill_blank（vs numeric）
- 文字题问数字 → fill_blank（不需要 4 选 1）
- 纯算式题（"5.6 + 2.4 = ?"）→ numeric（前端会自动 4 选 1）
- 单位换算题（"3.5 米 = ___ 厘米"）→ fill_blank

### stem 写法
- 自然语言："一支铅笔长 15 厘米 8 毫米，用米作单位是多少米？"
- 含填空标记："3 米 8 分米 = ___ 米"

### options 字段
- ⛔ **不要给 options**（fill_blank 不展示选项）
- ⛔ 不要给 distractors（前端会忽略）

### unit
- 有单位必填
- 前端会在输入框旁边显示单位提示（"答案：___ 米"）

### acceptable_error
- 整数：0
- 小数 1 位：0.05
- 小数 2 位：0.005
- 小数 3 位：0.001
- 估算："约多少" → 5%

### ⛔ 禁止
- 答案是中文短语（"等腰三角形"）→ 用 single_choice
- 答案是表达式（"x + 5"）→ 用 single_choice
- 多个空白（"___ 米 ___ 厘米"）→ 用 multi_step 或拆成两道题
