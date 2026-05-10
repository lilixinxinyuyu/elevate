## 题型：time_heist（时间窃贼）

⏱️ **答题时间**：`estimated_time_seconds: 35`

钟面 SVG + 起止时间 → 4 选 1。**核心训练**：时间换算（24h ↔ 12h）、持续时间计算、速度 × 时间。

### 玩法（前端）

钟面 + 三选一显示开始/结束/持续时间 → 4 个候选时间 chip 让玩家选。

### 三种 mode

| mode | 给定 | 问 |
|---|---|---|
| `duration` | 开始 + 结束时刻 | 持续时间 |
| `start` | 结束时刻 + 持续时间 | 几点出发 |
| `end` | 开始时刻 + 持续时间 | 几点到 |

### stem 示例

- "Selena 7:30 开始练琴，8:15 结束。她练了多久？"
- "电影 14:20 开始，放映 1 小时 50 分钟，几点结束？"
- "高铁 9:45 到达，路上花了 2 小时 15 分钟，几点出发？"

### 必须字段

```json
{
  "game_type": "time_heist",
  "play_as": "time_heist",
  "question_format": "single_choice",
  "cognitive_level": "application",
  "ability_dimension": ["calculation", "modeling"],
  "estimated_time_seconds": 35,
  "stem": "Selena 7:30 开始练琴，8:15 结束。她练了多久？",
  "time_heist": {
    "mode": "duration",
    "startTime": "07:30",
    "endTime": "08:15",
    "showOn": "start"
  },
  "options": [
    { "id": "A", "text": "45 分钟" },
    { "id": "B", "text": "1 小时 15 分钟", "errorTag": "time_carry_error" },
    { "id": "C", "text": "30 分钟", "errorTag": "time_minute_off" },
    { "id": "D", "text": "1 小时", "errorTag": "time_round_up" }
  ],
  "answer": { "type": "choice", "value": "A" },
  "solution_steps": [
    "8:15 - 7:30 = 45 分钟",
    "（也可以分开算：分钟 15-30 不够减，借 1 小时变 75-30=45 分钟）"
  ],
  "hints": [{ "text": "分钟不够减时，借 1 小时 = 60 分钟", "penalty": 1 }],
  "common_errors": [
    { "tag": "time_carry_error", "error": "分钟借位算错", "remediation": "75 - 30 = 45，不是 75 - 30 = 1:15" },
    { "tag": "time_minute_off", "error": "30 - 15 当成 15（搞反方向）", "remediation": "结束 - 开始 = 持续时间" }
  ],
  "feedback_correct": "⏰ 时间感超准！",
  "feedback_wrong": "提示：用结束时刻减开始时刻，分钟不够借小时",
  "tags": ["ai_generated", "time_calc", "duration"]
}
```

### time_heist 字段细节

- `startTime` / `endTime`：24h 格式 `"HH:MM"`，必须 ≥ 起 < 终
- `durationMinutes`：纯分钟整数（90 表示 1.5 小时）
- `showOn`：钟面渲染哪个时刻（"start" | "end"）
- 三种 mode 必填字段：
  - `duration`：startTime + endTime（durationMinutes 由前端算 / AI 不填）
  - `start`：endTime + durationMinutes
  - `end`：startTime + durationMinutes

### 数字范围

- 时刻在 06:00 - 22:00（小学 4 年级日常作息）
- 持续时间 5 分钟 - 4 小时
- 分钟尽量是 5 的倍数（30/45/15 等），太精细的（如 23 分钟）少用
- **避免跨午夜**（23:00 出发明早 7:00 到这种），4 年级未学

### 干扰项设计（options 4 个）

- A：正确答案
- B：分钟借位算错（如 1:15 变 1:30）
- C：方向反了（end - start 算成 start - end）
- D：忽略小时部分只看分钟

每个干扰必须配 `errorTag`。

### ❌ 禁止

- 跨午夜场景
- 秒级精度（4 年级只到分钟）
- 无效时间（如 25:70）
- options 数 ≠ 4
