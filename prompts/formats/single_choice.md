## 答题格式：single_choice（4 选 1 / 单选）

**特点**：4 个选项中**恰好 1 个正确**，其余是高质量干扰项。

### 必填字段
```json
{
  "question_format": "single_choice",
  "options": [
    { "id": "A", "text": "70 度", "errorTag": "" },
    { "id": "B", "text": "60 度", "errorTag": "wrong_subtract_direction" },
    { "id": "C", "text": "80 度", "errorTag": "missed_step" },
    { "id": "D", "text": "90 度", "errorTag": "default_right_angle" }
  ],
  "answer": { "type": "choice", "value": "A" }
}
```

### 何时用 single_choice
- 概念辨析（"下面对小数 6.047 中 4 的解释，正确的是？"）
- 真假判断升级版（"哪一种竖式对齐方式是正确的？"）
- 多个量都要算但只问其中一个（"按角分属于哪一类？"）
- 选项是图形/图片描述

### 何时不用（错误用法）
- ⛔ stem 是 "…是多少 X？" + 答案是单一数值 → 用 fill_blank
- ⛔ 答案是表达式（"x + 5 = 12"） → 用 single_choice 但 options 必须是完整表达式
- ⛔ 选项之间没区分度（4 个相邻数字 50/51/52/53）

### 选项设计 4 原则
1. **1 正确 + 3 高质量干扰项**
2. 每个干扰项对应一种 **典型错误模式**（用 errorTag 标）：
   - 操作反了（add/sub 互换）
   - 漏一步（不进位）
   - 小数点错位
   - 单位错（厘米 vs 毫米）
   - 公式错（用周长公式算面积）
3. **干扰项要"似是而非"**：4 年级孩子算错容易得到的数字
4. **答案位置随机**（A/B/C/D 都用，不要总把 C 当正解）

### options[].text 长度
- 单一数字 + 单位（"12.5 元"）→ 简短即可
- 完整短句（"1 米 = 100 厘米"）→ 让 4 个选项长度差不多，避免长度暗示

### errorTag 选词
小学数学常用 tag：
- `decimal_point_error`、`carry_missing`、`borrow_missing`、`unit_mismatch`
- `add_sub_swap`、`mul_div_swap`、`wrong_formula`、`off_by_one`
- `careless_reading`（默认 fallback）
