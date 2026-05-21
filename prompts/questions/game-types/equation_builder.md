## 题型：equation_builder（方程拼装 / 算式拼装）🧩

⏱️ **答题时间**：`estimated_time_seconds: 35`（把数字卡片拖进算式空格）。

⚠️ 用客户端 EquationBuilder 组件渲染：组件把一个**算式**里的数字挖空成 slot，给一池数字卡片
（含干扰数），学生把数字拖进空格拼出算式；`check()` 会**对拼出的算式求值**和目标值比对。

> 关键：**这是拼“可求值的综合算式”，不是含未知数的方程**。check 用 `tryEvaluateExpression`
> 对算式求值（支持 `+ − × ÷ ( )` 和小数），所以表达式里**不能有字母 x**，只能是纯数字算式。
> 适合：总价 = 单价 × 数量、路程 = 速度 × 时间、综合算式（如 45.5×8+38×6）等。

### 数据来源（按优先级，组件 deriveEquationSpec）

1. `answer.steps` 里 `step_id` 为 `"equation"` 或 `"expression"` 的步（字符串，整条算式）；或
2. **`word_problem_steps.equation_or_expression`**（推荐，最简单）；或
3. 兜底用 `answer.value`。

推荐写法（最稳）：`answer` 用 numeric（最终得数）+ `word_problem_steps.equation_or_expression` 放算式。

### 必填字段（继承 plain_choice 公共字段，差异如下）

```jsonc
{
  "game_type": "equation_balance",          // 映射到 equation_builder
  "play_as": "equation_builder",
  "question_format": "numeric",
  "answer": { "type": "number", "value": 20.8 },
  "word_problem_steps": {
    "known": ["苹果每千克 6.5 元", "买 3.2 千克"],
    "question": "一共多少元？",
    "relationship": "总价 = 单价 × 数量",
    "equation_or_expression": "6.5*3.2",     // ← 组件挖空这里的数字做 slot
    "check": "6.5×3.2=20.8"
  }
}
```

### 适用 skill / 单元

小数乘法应用类：`decimal_price_quantity` / `decimal_speed_distance` / `decimal_mul_mix`（U3）等。

### 真实样例

```jsonc
{
  "stem": "买 8 个篮球（每个 45.5 元）和 6 个足球（每个 38 元）。用数字卡片拼出求总价的算式。",
  "game_type": "equation_balance",
  "play_as": "equation_builder",
  "question_format": "numeric",
  "answer": { "type": "number", "value": 592 },
  "word_problem_steps": {
    "known": ["篮球每个 45.5 元，买 8 个", "足球每个 38 元，买 6 个"],
    "question": "一共多少元？",
    "relationship": "总价 = 篮球单价 × 数量 + 足球单价 × 数量",
    "equation_or_expression": "45.5*8+38*6",
    "check": "364+228=592"
  },
  "solution_steps": ["篮球：45.5 × 8 = 364 元", "足球：38 × 6 = 228 元", "合计：364 + 228 = 592 元"],
  "hints": [{ "text": "两种球分别 单价 × 数量，再相加", "penalty": 1 }],
  "common_errors": [{ "tag": "relation_model_error", "error": "单价数量混用", "remediation": "篮球单价配篮球数量。" }],
  "tags": ["from_test", "exam", "期末题", "方程拼装"]
}
```

### 出题守则

1. **`equation_or_expression` 必须是纯数字算式**（无字母 x），且能被求值；用 `*` `/` 或 `×` `÷` 都行。
2. **算式求值必须等于 `answer.value`**（出题前手算核对）。
3. 数字个数别太多（2～4 个 slot 最佳），否则拖动太繁琐；干扰数由组件自动加。
4. stem 引导“用数字卡片拼出算式”，给出情境（购物/行程/综合）。`hints[].penalty` 整数 1-3。
5. 想表达“几个数相乘相加”的综合算式最适合本题型；纯单步 a×b 也可（slot 少、偏简单）。
