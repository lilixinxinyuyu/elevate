## 题型：decimal_shifter（小数点移动）

⏱️ **答题时间**：`estimated_time_seconds: 25`（程序化操作，应该熟练后较快）

围绕"小数点移动 → 数字变大或变小"的核心知识点。

### stem 示例

- "把 3.45 的小数点向右移动一位，得到的数是 ___"
- "5.678 缩小到原来的 1/100 后是 ___"
- "0.07 的小数点向左移动一位，结果是 ___"

### 必须字段

```json
{
  "game_type": "decimal_shifter",
  "play_as": "decimal_shifter",
  "ability_dimension": ["concept", "strategy"],
  "tags": ["ai_generated", "shift:right:1", "start:3.45"]
}
```

`tags` 里的 `shift:` 描述方向 + 位数；`start:` 是起始数字。客户端用这两个 tag 渲染动画。

选项保持 4 个数字，包括 1 个干扰项是"小数点方向反了"，1 个是"位数错了"。
