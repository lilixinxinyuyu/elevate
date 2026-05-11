## 题型：coin_combo（凑钱挑战）

⏱️ **答题时间**：`estimated_time_seconds: 35`

给 5 张面值 chip + 一个目标金额，玩家点击勾选凑出目标。**核心训练**：小数加法、元角分换算、组合思维。

### 玩法（前端）

5 张钱币 chip 横排显示（点击切换勾选/未勾选），上方实时累加 → 目标金额。点"结算"判对错。

### stem 示例（生活化情境）

- "Selena 想买一本笔记本，正好 ¥8.5 元，用下面的钱凑出来"
- "便利店买饮料 ¥6.3 元，凑出来"
- "妈妈说凑齐 ¥12.5 就能买玩具，用零钱罐里的钱凑"

要带具体生活场景（买文具 / 买零食 / 攒钱 / 还借的钱），不要单写"凑出 ¥X.X"。

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

### 数字范围 + 难度阶梯

- D2 target：整数 1-20（用 1/2/5/10 等整面值）
- D3 target：一位小数 X.5（如 8.5 / 12.5）— 必须包含 0.5 面值
- D4 target：两位小数 X.X5 或 X.X0（如 6.85 / 12.35）— 必须包含 0.1 / 0.05 角分面值

**严格要求**：含 0.X / 0.0X 的 target，coins 数组里**至少要有 1 张相应小面值**（不然凑不出来）。

**面值池**：
- 推荐元面值：1 / 2 / 5 / 10 / 20 / 50
- 推荐角分面值：0.1 / 0.2 / 0.5

### 唯一解强制要求

⚠️ **31 种组合（5 张面值的 2^5-1）里只能有 1 种和 = target**。
- 出题前在脑子里 / 计算器验一遍：枚举 5 张面值的所有非空子集，确认只有 correctIndices 那个和等于 target。
- 多解题用户体验差（凑对了说错），fill-bank judge 会标 P3 删除。

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
