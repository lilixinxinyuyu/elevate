## 答题格式：numeric（自由数字输入 / 4 选 1 都行）

**特点**：答案是一个数字，stem 是一道纯算式或自然语言问数字的题。如果给了 distractors 数组，前端会自动 4 选 1（speed_match）；没给就 plain_numeric input。

### 必填字段
```json
{
  "question_format": "numeric",
  "answer": { "type": "number", "value": 12.5, "unit": "元", "acceptable_error": 0 },
  "distractors": [10.5, 11.5, 13.5]   // 可选：3 个干扰项 → 自动 4 选 1
}
```

### 干扰项设计（如有）
- 必须是 3 个不同的"高质量错误"答案：
  1. 操作反了（× 写成 ÷ / + 写成 -）
  2. 漏一步（少进位 / 少借位 / 少乘）
  3. 小数点错位（多/少一位）
- ⛔ 不要让 4 个数字相邻 1（如 10/11/12/13）

### unit 字段
- 有单位的题必须填（"元"/"米"/"度"/"千克"）。
- Selena 看到答案"3.5"和"3.5 米"会区别——前端按 unit 显示。

### acceptable_error
- 整数题：0
- 小数题：0.001（避免浮点比较 0.30 != 0.3）
- 估算题：根据题意明示（如 "≈" 时 5%）

### ⛔ 禁止
- 选 numeric 但 stem 含 "下面…正确" / "哪一项" → 应该用 single_choice
- 答案是分数 / 表达式 → 应该用 single_choice
