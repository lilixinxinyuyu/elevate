## 题型：discount_drift（折扣漂移）

⏱️ **答题时间**：`estimated_time_seconds: 30`

模拟商场折扣场景，让 Selena 算折后价。**核心训练**：小数乘法、小数点移动（X 折 = X × 0.1）、单位换算。

### 玩法（前端）

商品图标 + 原价（带划线）+ 折扣 chip → 4 个候选价格 chip 让玩家选。

### stem 示例

- "一件 ¥120 的连衣裙打 7 折，现价是？"
- "一双 ¥85 的鞋子，今日满 ¥80 减 ¥10，要付多少钱？"
- "买二送一活动，¥6 一支的笔，买 3 支花多少钱？"

### 必须字段

```json
{
  "game_type": "discount_drift",
  "play_as": "discount_drift",
  "question_format": "single_choice",
  "cognitive_level": "application",
  "ability_dimension": ["calculation", "modeling"],
  "estimated_time_seconds": 30,
  "stem": "一件 ¥120 的连衣裙打 7 折，现价是多少元？",
  "discount": {
    "itemName": "连衣裙",
    "emoji": "👗",
    "originalPrice": 120,
    "discount": { "kind": "percent", "value": 70 }
  },
  "options": [
    { "id": "A", "text": "84" },
    { "id": "B", "text": "96", "errorTag": "calc_subtract_offset" },
    { "id": "C", "text": "70", "errorTag": "discount_misread" },
    { "id": "D", "text": "108", "errorTag": "calc_off_one" }
  ],
  "answer": { "type": "choice", "value": "A" },
  "solution_steps": [
    "7 折 = 7 × 0.1 = 0.7",
    "120 × 0.7 = 84"
  ],
  "hints": [{ "text": "7 折 = 0.7 倍", "penalty": 1 }],
  "common_errors": [
    { "tag": "discount_misread", "error": "把 7 折当成减 70%（应该是付 70%）", "remediation": "X 折 = 付 X*10%。7 折 = 付 70%" },
    { "tag": "calc_subtract_offset", "error": "误算 120 - 70 = 50（混淆减法 vs 乘法）", "remediation": "折扣是按比例打折，要乘不要减" }
  ],
  "feedback_correct": "💸 折扣高手！",
  "feedback_wrong": "提示：X 折 = 付原价的 X × 10%",
  "tags": ["ai_generated", "discount", "decimal_mul"]
}
```

### discount 字段三种 kind

```jsonc
// 1. 百分比折扣（最常用）— X 折用 value=X*10。例 7 折 → 70；半价 → 50
{ "kind": "percent", "value": 70 }

// 2. 满减
{ "kind": "yuan_off", "value": 10 }

// 3. 买 N 送 M（前端按 N+M 件平均价显示）
{ "kind": "buy_n_get_m", "n": 2, "m": 1 }
```

### 数字范围

- originalPrice：10-300，4 年级数字范围
- 折扣：percent（30-90 整 10 倍数最佳，方便心算）；yuan_off（5-50）；buy_n_get_m（n+m ≤ 5）
- 4 个候选价格之间差距合理（不要 4 个都接近，要拉开 5%-30%）

### 干扰项设计（4 个 options）

- A：正确答案
- B：减法陷阱（120 - 70 = 50 这种）
- C：算 70% 算成 70（漏乘原价）
- D：折扣方向反了（120 × 0.3 = 36 当 7 折，其实是 3 折）

每个干扰项必须配 `errorTag`，让 GameShell 反馈面板能给出针对性提示。

### ❌ 禁止

- 折扣超出 4 年级心算能力（如 13.5%、千位级原价）
- options 给 5 个或更多
- answer.type ≠ "choice"
- discount.kind 用其他值
