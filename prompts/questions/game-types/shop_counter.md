## 题型：shop_counter（购物 / 总价应用题）

⏱️ **答题时间**：`estimated_time_seconds: 50`（应用题需要读题 + 列算式 + 算结果，难度 4-5 给 70）

围绕：单价 × 数量 = 总价 / 已付钱找零 / 多种商品组合等。

### stem 必备元素

- 至少一个商品 + 单价 + 数量
- 用人民币（元、角、分）单位，但**只用元**保留 2 位小数（不混分）
- 数字不超过 100 元，单价 0.5-25.0 元

### 干扰项设计

4 个数字选项中：
- 1 个正确
- 1 个"忘了乘数量"
- 1 个"小数点放错位"
- 1 个"加减号搞反"

### 必须字段（**继承 plain_choice 的全部字段**，下面只列差异）

⚠️ **完整 JSON 必须包含所有 plain_choice 必备字段**（question_id / subjectId / version / status / grade / term / unit_id / unit_name / skill_id / skill_name / cognitive_level / difficulty / estimated_time_seconds / stem / question_format / options / answer / solution_steps / common_errors / feedback_correct / feedback_wrong / hints / tags / exam_priority）。**枚举值严格按 quality-rubric.md 第 1.5 节**。

差异化字段：

```json
{
  "game_type": "shop_counter",
  "play_as": "shop_counter",
  "question_format": "single_choice",
  "cognitive_level": "application",
  "ability_dimension": ["modeling", "calculation"],
  "estimated_time_seconds": 50,
  "tags": ["ai_generated", "items:apple-3.5-2|book-12.8-1"]
}
```

`items:name-price-qty|...` 列出每个商品。
