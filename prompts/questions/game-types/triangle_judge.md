## 题型：triangle_judge（三角形判定）

⏱️ **答题时间**：`estimated_time_seconds: 30`（规则套用 + 简单计算，难度 4-5 给 40）

围绕：三边能否构成三角形 / 三角形分类（按角、按边）/ 内角和。

### tag 格式

判断三边能否构成三角形：`tri-sides:a,b,c`，例 `tri-sides:3,4,5`。

按角分类：题干描述三个角，options 是"锐角三角形 / 直角三角形 / 钝角三角形"。

### stem 示例

- "下面三条边长能围成三角形的是？"
- "已知三角形两个内角是 60° 和 70°，第三个角是多少度？"
- "三个内角分别是 30°、60°、90° 的三角形是什么三角形？"

### 必须字段

```json
{
  "game_type": "triangle_judge",
  "play_as": "triangle_judge",
  "ability_dimension": ["reasoning", "spatial"],
  "tags": ["ai_generated", "tri-sides:3,4,5"]
}
```
