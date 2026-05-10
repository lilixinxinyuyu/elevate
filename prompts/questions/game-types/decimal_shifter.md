## 题型：decimal_shifter（小数点移动）

⏱️ **答题时间**：`estimated_time_seconds: 25`（程序化操作，应该熟练后较快）

围绕"小数点移动 → 数字变大或变小"的核心知识点。

⚠️ **重要**：DecimalShifter 是 **位移操作题** —— 前端给 Selena ← / → 按钮让她**直接拖动小数点**到正确位置。**不是 4 选 1**。`answer.value` 必须是位移后的**目标数字本身**（number 类型）。

### stem 示例

- "把 3.45 的小数点向右移动一位，得到的数是 ___"
- "5.678 缩小到原来的 1/100 后是 ___"
- "0.07 的小数点向左移动一位，结果是 ___"

### 必须字段

```json
{
  "game_type": "decimal_shifter",
  "play_as": "decimal_shifter",
  "question_format": "numeric",
  "cognitive_level": "procedural",
  "ability_dimension": ["concept", "strategy"],
  "estimated_time_seconds": 25,
  "stem": "把 3.45 的小数点向右移动一位，得到的数是 ___",
  "answer": { "type": "number", "value": 34.5 },
  "tags": ["ai_generated", "shift:right:1", "start:3.45"],
  "solution_steps": ["小数点向右移动一位 = ×10，3.45 × 10 = 34.5"],
  "hints": [{ "text": "小数点向右移一位等于乘 10", "penalty": 1 }],
  "common_errors": [
    { "tag": "shift_direction_reversed", "error": "误把方向当左移", "remediation": "向右移 = 数变大；向左移 = 数变小" },
    { "tag": "shift_count_off", "error": "位数算错", "remediation": "题面说几位就移几位，多一位 / 少一位都不对" }
  ],
  "feedback_correct": "操作准确！",
  "feedback_wrong": "再想想：题里说移几位？方向是左还是右？",
  "tags": ["ai_generated", "shift:right:1", "start:3.45"]
}
```

`tags` 里：
- `start:N` 是起始数字（`N` 用原值，不带括号）
- `shift:right:N` 或 `shift:left:N` 描述位移方向 + 位数
- 客户端用这两个 tag 渲染动画 + 校验

### ❌ 禁止（v0.31.75 之前 30 道题就栽在这）

```jsonc
"answer": { "type": "choice", "value": "A" }   // ❌ DecimalShifter 模板不识别 choice
"options": [ {...}, {...} ]                     // ❌ 不要 options，这不是选择题
"question_format": "single_choice"              // ❌ 应该是 "numeric"
```

如果你想出 4 选 1 风格的小数点移动题，**改用 game_type=plain_choice**（PlainChoice 模板），别用 decimal_shifter。

### 数据校验自查

出题前检查：
1. `start:` tag 的值，乘以 `10^shift_count`（右移）或除以 `10^shift_count`（左移）= `answer.value`？
2. `answer.type === "number"`？不是 "choice"？
3. 没有 `options` 字段？
