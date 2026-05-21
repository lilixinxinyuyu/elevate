## 题型：memory_match（记忆配对）🃏

⏱️ **答题时间**：`estimated_time_seconds: 40`（翻牌找相等的对子）。

⚠️ 这种题用客户端 MemoryMatch 组件渲染：根据 `tags` 里的 `pair:` 生成成对的牌，
学生把**相等 / 等价**的两张牌配对。组件自己统计步数，所以 **answer 是占位 numeric**。

### tag 格式（必填）

`pair:左|右` —— 每个 `pair:` tag 描述一对相等的牌，左右两个表示同一个值的两种写法。
用竖线 `|` 分隔左右。一题一般给 **3～5 对**。

例：
- `pair:0.5|1/2`、`pair:0.25|25%`、`pair:0.75|3/4`（小数 ↔ 分数 / 百分数）
- `pair:1 米|100 厘米`、`pair:1.5 米|150 厘米`（单位换算）
- `pair:0.3|3 个 0.1`、`pair:0.06|6 个 0.01`（小数的意义）

### answer

`{ "type": "number", "value": 1 }` —— 固定占位（配对正确与否由组件按 pair 判定，value 不参与判分）。

### 适用 skill

适合“同一个量的多种等价表示”类 skill：`decimal_meaning_place` / `decimal_unit_conversion` /
`decimal_compare` / 分数小数互化等。**每对的左右必须真的相等**，这是本题型唯一的正确性命门。

### stem 示例

- “把相等的两张牌配对：”
- “把相等的长度配对（米 ↔ 厘米）：”
- “把表示同一个小数的两张牌连起来：”

### 必填字段（**继承 plain_choice 全部公共字段**，下面只列差异）

⚠️ 完整 JSON 必须含所有公共字段（见 quality-rubric.md）。差异字段：
```jsonc
{
  "game_type": "memory_match",
  "play_as": "memory_match",
  "question_format": "numeric",
  "answer": { "type": "number", "value": 1 },
  "tags": ["pair:0.5|1/2", "pair:0.25|25%", "pair:0.75|3/4"]   // 另可加 from_test/exam/期末题
}
```

### 真实样例

```jsonc
{
  "stem": "把相等的长度配对（米 ↔ 厘米）：",
  "game_type": "memory_match",
  "play_as": "memory_match",
  "question_format": "numeric",
  "answer": { "type": "number", "value": 1 },
  "solution_steps": ["1 米 = 100 厘米", "1.5 米 = 150 厘米", "0.6 米 = 60 厘米"],
  "hints": [{ "text": "1 米 = 100 厘米，先把米化成厘米", "penalty": 1 }],
  "common_errors": [
    { "tag": "unit_conversion_error", "error": "进率记错（用了 10 或 1000）", "remediation": "米和厘米之间进率是 100。" }
  ],
  "feedback_correct": "全部配对成功！",
  "feedback_wrong": "再想想每张牌表示多大，相等的才能配。",
  "tags": ["pair:1 米|100 厘米", "pair:1.5 米|150 厘米", "pair:0.6 米|60 厘米", "from_test", "exam", "期末题"]
}
```

### 出题守则

1. **每个 `pair:` 的左右必须严格相等**——出题前逐对验算（这是最容易出错、也最致命的地方）。
2. 一题 3～5 对，左右两列风格要能区分（如左列小数、右列分数/单位），别让两张牌字面一样。
3. 同一题里不要出现“跨对也相等”的牌（否则配对有歧义），如别同时放 `0.5` 和 `50%` 又放 `0.5|1/2`。
4. stem 说清配对规则（按相等 / 按等价）。`hints[].penalty` 是整数 1-3。
