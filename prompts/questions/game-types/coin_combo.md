## 题型：coin_combo（凑钱挑战）

⏱️ **答题时间**：`estimated_time_seconds: 35`

给 5 张面值 chip + 一个目标金额，玩家点击勾选凑出目标。**核心训练**：小数加法、元角分换算、组合思维。

### 玩法（前端）

5 张钱币 chip 横排显示（点击切换勾选/未勾选），上方实时累加 → 目标金额。点"结算"判对错。

### stem 示例

- "用下面的钱凑出 ¥8.5 元"
- "凑出 ¥12.3 元"
- "凑出 ¥0.85"（元角分练）

### 必须字段

```json
{
  "game_type": "coin_combo",
  "play_as": "coin_combo",
  "question_format": "multi_choice",
  "cognitive_level": "application",
  "ability_dimension": ["calculation", "strategy"],
  "estimated_time_seconds": 35,
  "stem": "用下面的钱凑出 ¥8.5 元",
  "coin_combo": {
    "coins": [0.5, 1, 2, 3, 5],
    "target": 8.5,
    "correctIndices": [0, 3, 4]
  },
  "answer": { "type": "choice", "value": "0,3,4" },
  "solution_steps": [
    "0.5 + 3 + 5 = 8.5",
    "正好凑出目标金额 ¥8.5"
  ],
  "hints": [{ "text": "看哪些数加起来正好等于目标", "penalty": 1 }],
  "common_errors": [
    { "tag": "coin_overshoot", "error": "总和超过目标", "remediation": "选少一些 / 看面值" },
    { "tag": "coin_undershoot", "error": "总和不够", "remediation": "再多选一张" }
  ],
  "feedback_correct": "🪙 凑得真巧！",
  "feedback_wrong": "提示：你选的总和 vs 目标，差多少？",
  "tags": ["ai_generated", "decimal_add", "coin_combo"]
}
```

### coins 设计

- 5 张面值，**单位元**
- **必须只有一个正确组合**（验证：枚举所有 2^5-1=31 种组合，只有一种和等于 target）
- 推荐面值池：`0.1 / 0.2 / 0.5 / 1 / 2 / 5 / 10`（元角分组合更好）
- 不能出现 ¥0 或负数
- correctIndices 至少 2 张，最多 5 张

### 数字范围

- target：0.5 - 50（4 年级元角分练）
- 整数 target 用 1/2/5 一类纯整数面值
- 含 0.X 的 target 至少有一张 0.X 面值（不然凑不出来）

### answer.value 怎么写

写成**字符串**，逗号分隔的 indices（顺序无所谓，前端按 set 比对）：
- 选了 0、3、4 → `"value": "0,3,4"`
- 选了 1、2 → `"value": "1,2"`

但前端实际比对走 `coin_combo.correctIndices`，answer.value 只是为了 schema 兼容。

### 干扰设计（不需要 options 字段，玩家从 coins 自由组合）

确保 coins 里**有几个会让人误选的"近似组合"**，例如目标 8.5：
- 正确：0.5 + 3 + 5 = 8.5
- 容易误选：1 + 2 + 5 = 8（差 0.5，但很接近）

### ❌ 禁止

- coins 里有重复面值（必须 5 个唯一）
- 多个组合能凑出 target（前端期望唯一解）
- coins 里有 ≥ target 的单张（如 target=10 不能放 ¥20 的）
- 前端展示用 options — coin_combo 不是 4 选 1
