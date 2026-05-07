## 答题格式：numeric_choice（数字 4 选 1）

**特点**：本质是 numeric 题但显式给了 4 个数字选项。前端用 speed_match。

### 必填字段
```json
{
  "question_format": "numeric_choice",
  "options": [
    { "id": "A", "text": "12.5" },
    { "id": "B", "text": "12.05" },
    { "id": "C", "text": "1.25" },
    { "id": "D", "text": "125" }
  ],
  "answer": { "type": "choice", "value": "A" }
}
```

### 何时用
- 想让孩子练 "数感" / "口算选最优" 时（speed_match 模板抢答）
- 答案明显有 "小数点错位" 这类典型陷阱时（不让 plain_numeric 输入逃过陷阱）

### 设计要求
- options[].text 都是纯数字（不带单位也行，单位放 stem 里）
- 4 个选项区分度大，不要 4 个相邻整数
- 1 正确 + 3 干扰，干扰必须对应 4 年级常见错误：
  - 小数点错位（12.5 vs 1.25 vs 125）
  - 漏一位 / 多一位（12.05 vs 12.5）
  - 操作反（120 - 5 vs 125 + 5）

### vs numeric
- numeric + distractors → 完全等价（前端自动展开）
- 唯一差别：numeric_choice 显式声明，更清晰

### vs single_choice
- single_choice 选项可以是中文短句
- numeric_choice 选项必须全是数字
