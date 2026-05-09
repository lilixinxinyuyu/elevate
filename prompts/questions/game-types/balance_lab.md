## 题型：balance_lab（天平 / 等量代换）

⏱️ **答题时间**：`estimated_time_seconds: 50`（要看懂图 + 列方程 + 解方程，难度 5 给 60）

⚠️ 这种题用客户端 BalanceLab 组件渲染，**必须**在 `tags` 里给一个 `eq:` tag 描述天平两边。

### tag 格式

`eq:left|right` —— `left` 和 `right` 都是用 `+` 连接的项（比如 `2x+3`、`5+y`、`3a`）。

例：`2x + 3 = x + 5` → `eq:2x+3|x+5`

### stem 示例

- "天平两边平衡，左边是 ___，右边是 ___，请问 x 等于多少？"
- "下图天平刚好平衡，求 x 的值。"

### 必须字段（**继承 plain_choice 的全部字段**，下面只列差异）

⚠️ **完整 JSON 必须包含所有 plain_choice 必备字段**（question_id / subjectId / version / status / grade / term / unit_id / unit_name / skill_id / skill_name / cognitive_level / difficulty / estimated_time_seconds / stem / common_errors / feedback_correct / feedback_wrong / hints / tags / exam_priority）。**枚举值严格按 quality-rubric.md 第 1.5 节**。

差异化字段：

```json
{
  "game_type": "balance_lab",
  "play_as": "balance_lab",
  "question_format": "numeric",
  "cognitive_level": "application",
  "ability_dimension": ["modeling", "calculation"],
  "estimated_time_seconds": 50,
  "tags": ["ai_generated", "eq:2x+3|x+5"],
  "answer": {"type": "number", "value": 2}
}
```

只用一元一次方程，未知数 x 取值 1-20 整数。变量名固定 x（不要用 y/a 等让小学生迷惑）。

### ⛔ 4 年级方程边界（必读）

**只能 ax=b / x±a=b 类型**，未知数 x 必须**只在等号一边**：

✅ 合法：
- `2x = 16`、`x + 5 = 12`、`3x = 27`、`x ÷ 4 = 6`

❌ **禁止 — 这些是 5 年级移项消元，4 年级不教**：
- `2x + 3 = x + 5`（x 在两边）
- `3x + 10 = 2x + 120`
- `x + 40 = 2x`
- `x + 20 = x + x + 5`
- 任何形如 `ax + b = cx + d` / `kx + m = nx + p` 都禁止

### ⛔ stem 表达必须明确（避免 cryptic）

涉及"x 个 X 克"的天平题，**必须在 stem 里说清 x 是单个量还是总量**：

❌ 模糊：`左边是 2 个相同的 x 克水杯，重 16 克` — x 是单个还是总？
✅ 清晰：`左边是 2 个相同的水杯，每个 x 克，总重 16 克。求 x` — `eq:2x|16`
✅ 也可以：`左边 1 个 x 克的盒子和 5 克砝码，右边 12 克砝码，求 x` — `eq:x+5|12`

stem 必须自带"每个" / "总" / "1 个 x 克的" 等限定词，**不能让 4 年级孩子读题时还要猜 x 的物理含义**。
