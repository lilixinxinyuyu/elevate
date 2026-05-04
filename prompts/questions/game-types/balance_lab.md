## 题型：balance_lab（天平 / 等量代换）

⏱️ **答题时间**：`estimated_time_seconds: 50`（要看懂图 + 列方程 + 解方程，难度 5 给 60）

⚠️ 这种题用客户端 BalanceLab 组件渲染，**必须**在 `tags` 里给一个 `eq:` tag 描述天平两边。

### tag 格式

`eq:left|right` —— `left` 和 `right` 都是用 `+` 连接的项（比如 `2x+3`、`5+y`、`3a`）。

例：`2x + 3 = x + 5` → `eq:2x+3|x+5`

### stem 示例

- "天平两边平衡，左边是 ___，右边是 ___，请问 x 等于多少？"
- "下图天平刚好平衡，求 x 的值。"

### 必须字段

```json
{
  "game_type": "balance_lab",
  "play_as": "balance_lab",
  "ability_dimension": ["modeling", "calculation"],
  "tags": ["ai_generated", "eq:2x+3|x+5"],
  "answer": {"type": "numeric", "value": 2}
}
```

只用一元一次方程，未知数 x 取值 1-20 整数。变量名固定 x（不要用 y/a 等让小学生迷惑）。
