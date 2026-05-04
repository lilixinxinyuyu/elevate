## 题型：word_problem_lab（应用题分阶段）

⚠️ 这是**多阶段题**，跟 plain_choice 的 schema 完全不同。一道题分成 3 步：

1. **clue_pick**（挑已知条件）：列出题面里的所有"已知信息"，让 Selena 挑出"对解题有用的"几条
2. **choose**（选数量关系）：给 4 个候选公式 / 关系式，挑正确的
3. **numeric**（写答案）：给正确数字（带单位），4 个干扰项一起 4 选 1

### 适用场景

只在 **应用题 / 实际问题** 类 skill 上用，比如：
- 已知和/差求未知量逆向应用题
- 列方程解决一步应用题 / 两步应用题
- 总价 = 单价 × 数量
- 路程 = 速度 × 时间
- 工程量 / 产量合计
- 求平均数（已知总数）

不要给纯计算 / 概念辨析类 skill 用这个题型。

### 必填字段（**完整 schema**）

```json
{
  "question_id": "AI_{{skillId}}_001",
  "subjectId": "{{subjectId}}",
  "version": 1,
  "status": "approved",
  "grade": 4,
  "term": "{{term}}",
  "unit_id": "{{unitId}}",
  "unit_name": "{{unitName}}",
  "skill_id": "{{skillId}}",
  "skill_name": "{{skillName}}",
  "ability_dimension": ["modeling", "calculation"],
  "exam_priority": "MUST_BIG",
  "game_type": "word_problem_lab",
  "play_as": "shop_counter",
  "cognitive_level": "application",
  "difficulty": 4,
  "estimated_time_seconds": 90,
  "stem": "学校体育组买了 8 个篮球和 6 个足球，篮球每个 45.5 元，足球每个 38 元，一共花了多少元？",
  "question_format": "multi_step",
  "answer": {
    "type": "multi_step",
    "steps": [
      { "step_id": "clue", "expected": "0,1,2,3" },
      { "step_id": "relationship", "expected": "总价 = 篮球单价 × 篮球数量 + 足球单价 × 足球数量" },
      { "step_id": "answer", "expected": 592.0, "kind": "answer" }
    ]
  },
  "subquestions": [
    {
      "kind": "clue_pick",
      "prompt": "先挑出本题用到的已知条件：",
      "clues": [
        "8 个篮球",
        "6 个足球",
        "篮球每个 45.5 元",
        "足球每个 38 元",
        "学校在体育组（无关）"
      ],
      "correct": [0, 1, 2, 3],
      "mode": "pick_correct"
    },
    {
      "kind": "choose",
      "prompt": "这道题最合适的数量关系是：",
      "options": [
        { "id": "A", "text": "总价 = 篮球单价 × 篮球数量 + 足球单价 × 足球数量", "correct": true },
        { "id": "B", "text": "总价 = (篮球单价 + 足球单价) × (篮球数量 + 足球数量)", "correct": false, "errorTag": "relation_model_error" },
        { "id": "C", "text": "总价 = 篮球数量 + 足球数量", "correct": false, "errorTag": "missing_unit_price" },
        { "id": "D", "text": "总价 = 篮球单价 × 足球数量 + 足球单价 × 篮球数量", "correct": false, "errorTag": "swapped_quantities" }
      ]
    },
    {
      "kind": "numeric",
      "prompt": "一共花了多少元？",
      "value": 592.0,
      "unit": "元",
      "distractors": [364.0, 514.0, 626.0]
    }
  ],
  "word_problem_steps": {
    "known": ["8 个篮球", "6 个足球", "篮球每个 45.5 元", "足球每个 38 元"],
    "question": "一共花了多少元？",
    "relationship": "总价 = 篮球单价 × 篮球数量 + 足球单价 × 足球数量",
    "equation_or_expression": "45.5 × 8 + 38 × 6",
    "check": "364 + 228 = 592"
  },
  "solution_steps": [
    "篮球总价：45.5 × 8 = 364 元",
    "足球总价：38 × 6 = 228 元",
    "合计：364 + 228 = 592 元"
  ],
  "hints": [
    { "text": "先算篮球的总价", "penalty": 1 },
    { "text": "数量关系：总价 = 单价 × 数量，分别算两种再相加", "penalty": 2 }
  ],
  "common_errors": [
    { "tag": "relation_model_error", "error": "数量关系写错（合并单价或数量）", "remediation": "两种商品要分别算 单价 × 数量 再相加。" },
    { "tag": "careless_reading", "error": "把题目里某个数字看错", "remediation": "圈出所有数字再算。" }
  ],
  "feedback_correct": "数量关系抓得准，分步算清楚！",
  "feedback_wrong": "再读一遍题，注意区分两种商品的单价和数量。",
  "tags": ["ai_generated", "word_problem"]
}
```

### 出题守则（重要）

1. **clues 数组里要包含 1-2 条无关信息**（让 Selena 学会挑出真正有用的条件）。`correct` 数组只列有用条件的索引
2. **relationshipChoices 4 个**：1 个对，3 个错。每个错误项都要标 `errorTag`（描述错在哪）。错误项要"看起来合理"——比如调换单价/数量、漏乘、加减号反了
3. **distractors 3 个**：1 个常见加法错，1 个少算一步，1 个数字接近但单位错
4. **stem 要有具体情境**（学校 / 商店 / 公园 / 家里），不要纯抽象 "甲乙两数"
5. **数字保持小数点后 1-2 位**（4 年级范围）
6. **estimated_time_seconds 推荐 60-120**（应用题需要思考时间）
7. **difficulty 取 3-5**（应用题本身就是中难）
