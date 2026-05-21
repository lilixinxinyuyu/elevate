## 题型：shape_court（图形法庭 · 三根小棒能否围成三角形）⚖️

⏱️ **答题时间**：`estimated_time_seconds: 25`（判断三边能否构成三角形）。

⚠️ 这种题用客户端 ShapeCourt 组件渲染：根据 `tags` 里的 `sticks:` 把三根小棒画出来，
学生判断“能 / 不能”围成三角形。所以 **answer 是 choice，值为 "T"（能）或 "F"（不能）**。

### tag 格式（必填）

`sticks:a,b,c` —— 三条边的长度（正数，英文逗号分隔），如 `sticks:3,4,5`。
**只给三条边**（三角形）。数值要和 stem 情境一致（厘米 / 木棒）。

### 判定规则（出题人必须自己先判对）

三角形成立的充要条件：**任意两边之和 > 第三边**（等价于：最短两边之和 > 最长边）。
- `3,4,5`：3+4=7 > 5 → 能（T）
- `5,5,10`：5+5=10，不大于 10 → 不能（F）
- `2,3,6`：2+3=5 < 6 → 不能（F）

### answer / options

```jsonc
"question_format": "single_choice",
"options": [ { "id": "T", "text": "能" }, { "id": "F", "text": "不能" } ],
"answer": { "type": "choice", "value": "T" }     // 能=T，不能=F
```

### 适用 skill

只用于 `triangle_inequality`（三角形三边关系），U2 认识三角形和四边形。

### stem 示例

- “这三根木棒能围成三角形吗？”
- “用 5 厘米、5 厘米、10 厘米的小棒，能围成三角形吗？”

### 必填字段（**继承 plain_choice 全部公共字段**，下面只列差异）

```jsonc
{
  "game_type": "shape_court",
  "play_as": "shape_court",
  "question_format": "single_choice",
  "options": [ { "id": "T", "text": "能" }, { "id": "F", "text": "不能" } ],
  "answer": { "type": "choice", "value": "F" },
  "tags": ["sticks:5,5,10"]    // 期末题再加 from_test/exam/期末题
}
```

### 真实样例

```jsonc
{
  "stem": "用 5 厘米、5 厘米、10 厘米的三根小棒，能围成三角形吗？",
  "game_type": "shape_court",
  "play_as": "shape_court",
  "question_format": "single_choice",
  "options": [ { "id": "T", "text": "能" }, { "id": "F", "text": "不能" } ],
  "answer": { "type": "choice", "value": "F" },
  "solution_steps": ["最短两边之和：5+5=10", "10 不大于第三边 10", "所以不能围成三角形"],
  "hints": [{ "text": "用最短两边相加，跟最长边比", "penalty": 1 }],
  "common_errors": [
    { "tag": "triangle_condition_error", "error": "把『大于等于』当成条件", "remediation": "必须严格大于，等于也不行。" }
  ],
  "feedback_correct": "判得准！5+5=10 不大于 10。",
  "feedback_wrong": "再想想：最短两边相加要严格大于最长边。",
  "tags": ["sticks:5,5,10", "from_test", "exam", "期末题"]
}
```

### 出题守则

1. `sticks:` 只放 **三个**正数；`answer.value` 必须和三边关系判定一致（出题前自己验算）。
2. 多出几道时，T / F 都要有，且要覆盖“恰好相等（如 5,5,10 / 3,3,6）→ 不能”这个最易错点。
3. `options` 固定 T=能 / F=不能，不要改 id。`hints[].penalty` 整数 1-3。
