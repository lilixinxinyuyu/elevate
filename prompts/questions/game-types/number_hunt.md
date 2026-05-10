## 题型：number_hunt（数字寻宝）

⏱️ **答题时间**：`estimated_time_seconds: 45`

5×5 数字网格 + 一句规则 → 玩家挑出符合条件的格子（多选）。**核心训练**：找规律、数感、比较、快速心算。

### 玩法（前端）

25 个数字按 5×5 网格排列，stem 提示规则。玩家点击勾选 → 点"确认"判全选对错。

### stem 示例

- "把所有大于 1.5 的小数都找出来"
- "找出 3 个相加等于 1 的小数"（注意：是"找一组"，不是"找所有可能的组")
- "选出含十分位数字 5 的数"
- "把所有 4 的倍数找出来"

### 必须字段

```json
{
  "game_type": "number_hunt",
  "play_as": "number_hunt",
  "question_format": "multi_choice",
  "cognitive_level": "reasoning",
  "ability_dimension": ["concept", "reasoning"],
  "estimated_time_seconds": 45,
  "stem": "把所有大于 1.5 的小数都找出来",
  "number_hunt": {
    "grid": [
      0.8, 1.6, 2.3, 0.9, 1.2,
      1.5, 1.7, 0.4, 2.1, 0.7,
      1.0, 1.8, 0.6, 2.5, 1.4,
      0.3, 1.9, 1.1, 2.0, 0.5,
      1.3, 0.2, 2.4, 1.65, 0.95
    ],
    "rule": "大于 1.5",
    "targetIndices": [1, 2, 6, 8, 11, 13, 16, 18, 22, 23]
  },
  "answer": { "type": "choice", "value": "1,2,6,8,11,13,16,18,22,23" },
  "solution_steps": [
    "比 1.5 大：1.6 / 2.3 / 1.7 / 2.1 / 1.8 / 2.5 / 1.9 / 2.0 / 2.4 / 1.65",
    "等于 1.5 的不算（rule 是严格大于）"
  ],
  "hints": [{ "text": "找十位是 1 且十分位 ≥ 6 的，以及 ≥ 2 的", "penalty": 1 }],
  "common_errors": [
    { "tag": "boundary_misread", "error": "把 1.5 也选上（应该严格大于）", "remediation": "看 rule 用'大于'还是'大于等于'" },
    { "tag": "missed_target", "error": "漏选 1.65 这种额外的小数位", "remediation": "数位多的小数也要看清楚" }
  ],
  "feedback_correct": "💎 全找对了！",
  "feedback_wrong": "提示：再扫一遍，少了几个？多了几个？",
  "tags": ["ai_generated", "number_compare"]
}
```

### number_hunt 字段细节

- `grid`：**正好 25 个数**（5×5）
- `rule`：纯文字描述（前端渲染在 stem 下方提醒）
- `targetIndices`：0-24 范围内的 indices（按行优先：第 0 行是 0-4，第 1 行是 5-9 ...）
- **正确数量在 3-12 之间最有挑战**（太少没找头，太多变扫描而非判断）

### 适合的题目模式

✅ 推荐：
- "找所有大于/小于 X 的"
- "找所有 X 的倍数"
- "找出 3 个相加等于 X 的"（前端只校验正好这 3 个）
- "选出含 X 数位的"
- "选出最大的 3 个 / 最小的 3 个"

❌ 不推荐：
- 需要排序 / 排列的（用 sort_ladder）
- 只有 1 个答案（用 plain_choice）
- 答案数 > 12（变扫描题）

### grid 设计

- 数字范围按 skill 来：小数 skill → 0.x ~ 9.x；整数 skill → 1-100
- **避免重复**（每个数应该唯一，否则 indices 不能定位）
- 让 target 散布在网格里（不集中在一行/一列）
- 干扰数字接近边界（如 rule "大于 1.5" 时放 1.5 / 1.49 / 1.51 这种边界值）

### 数据校验自查

出题前自查：
1. `grid.length === 25`？
2. `targetIndices` 全部在 0-24？
3. `targetIndices` 里每个 i，`grid[i]` 真的满足 `rule`？
4. 不在 `targetIndices` 里的格子，**没有**满足 `rule`？
5. 没有重复数字？

### ❌ 禁止

- grid 大小 ≠ 25
- targetIndices 漏选 / 误选 / 重复
- rule 模糊不清（如"找特殊的"）
- 把这题做成"找一个最大的" — 改用 plain_choice
