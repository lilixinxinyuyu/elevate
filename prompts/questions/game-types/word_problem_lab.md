## 题型：word_problem_lab（应用题分阶段）

⚠️ 这是**多阶段题**，schema 跟 plain_choice 完全不同。一道题分成 3 步：

1. **clue_pick**（挑已知条件）：列出题面的所有"已知信息"，让 Selena 挑出对解题有用的几条
2. **choose**（选数量关系）：给 4 个候选公式 / 关系式，挑正确的
3. **numeric**（写答案）：给正确数字（带单位），3 个干扰项凑成 4 选 1

### 适用场景

只在 **应用题 / 实际问题** 类 skill 用，比如：和倍/差倍、列方程解决一步/两步应用题、总价 = 单价 × 数量、路程 = 速度 × 时间、求平均数（已知总数）等。

不要给纯计算 / 概念辨析类 skill 用。

---

### 必填字段（**完整 schema**）

```jsonc
{
  // ↓ 这批字段从「已确定的元数据」原样抄
  "question_id": "AI_<skillId>_001",   // 你自己起 _NNN 编号即可
  "subjectId": "<by metadata>",
  "version": 1,
  "status": "<by metadata>",
  "grade": 4,
  "term": "<by metadata>",
  "unit_id": "<by metadata>",
  "unit_name": "<by metadata>",
  "skill_id": "<by metadata>",
  "skill_name": "<by metadata>",
  "ability_dimension": "<by metadata>",
  "exam_priority": "<by metadata>",
  "game_type": "word_problem_lab",
  "play_as": "shop_counter",
  "cognitive_level": "<by metadata>",
  "difficulty": "<by metadata>",
  "estimated_time_seconds": "<by metadata>",
  "question_format": "multi_step",

  // ↓ 这些是真正需要你创作的字段
  "stem": "...",
  "answer": {
    "type": "multi_step",
    "steps": [
      { "step_id": "clue", "expected": "0,1,2,3" },        // 字符串！逗号拼接的索引
      { "step_id": "relationship", "expected": "..." },     // 完整关系式字符串
      { "step_id": "answer", "expected": 0, "kind": "answer" }   // number
    ]
  },
  "subquestions": [
    {
      "kind": "clue_pick",
      "prompt": "先挑出本题用到的已知条件：",
      "clues": [
        // 中性陈述句，不许标"（无关）/（解题设定）/（非已知）"等元注解
        // 让学生自己判断哪些是关键，这才是 clue_pick 的核心训练目的
        "...",
        "..."
      ],
      "correct": [0, 1]   // 有用条件的索引
    },
    {
      "kind": "choose",
      "prompt": "这道题最合适的数量关系是：",
      "options": [
        // 4 个选项，1 正 3 错。错选项 NOT 挂 errorTag —— 那是 leak！
        // 错选项归类放在 _internal_ 字段（admin only）
        { "id": "A", "text": "...", "correct": true },
        { "id": "B", "text": "...", "correct": false },
        { "id": "C", "text": "...", "correct": false },
        { "id": "D", "text": "...", "correct": false }
      ]
    },
    {
      "kind": "numeric",
      "prompt": "...",
      "value": 0,
      "unit": "...",
      // distractors 必须是"具体错误思路得到的值"，不能是题中数字的衍生（见原则 P3）
      "distractors": [0, 0, 0]
    }
  ],
  "_internal_option_diagnostics": [
    // admin-only 元数据，UI 永不渲染。讲清每个错选项归哪类错
    { "id": "B", "errorTag": "..." },
    { "id": "C", "errorTag": "..." },
    { "id": "D", "errorTag": "..." }
  ],
  "word_problem_steps": {
    "known": ["..."],
    "question": "...",
    "relationship": "...",
    "equation_or_expression": "...",
    "check": "..."
  },
  "solution_steps": ["..."],
  "hints": [
    { "text": "...", "penalty": 1 }
  ],
  "common_errors": [
    { "tag": "...", "error": "...", "remediation": "..." }
  ],
  "feedback_correct": "...",
  "feedback_wrong": "...",
  "tags": ["ai_generated", "word_problem"]
}
```

---

### 真实样例（leak-free）

题：「学校体育组买了 8 个篮球和 6 个足球，篮球每个 45.5 元，足球每个 38 元，一共花了多少元？」

```jsonc
{
  "stem": "学校体育组买了 8 个篮球和 6 个足球，篮球每个 45.5 元，足球每个 38 元，一共花了多少元？",
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
        "学校体育组今年新成立"        // ← 中性陈述，不挂"（无关）"
      ],
      "correct": [0, 1, 2, 3]
    },
    {
      "kind": "choose",
      "prompt": "这道题最合适的数量关系是：",
      "options": [
        { "id": "A", "text": "总价 = 篮球单价 × 篮球数量 + 足球单价 × 足球数量", "correct": true },
        { "id": "B", "text": "总价 = (篮球单价 + 足球单价) × (篮球数量 + 足球数量)", "correct": false },
        { "id": "C", "text": "总价 = 篮球数量 + 足球数量", "correct": false },
        { "id": "D", "text": "总价 = 篮球单价 × 足球数量 + 足球单价 × 篮球数量", "correct": false }
      ]
    },
    {
      "kind": "numeric",
      "prompt": "一共花了多少元？",
      "value": 592.0,
      "unit": "元",
      "distractors": [
        // 来源：把 单价 + 数量 一起合算 → (45.5+38) × (8+6) = 83.5 × 14 ≈ 1169
        // 但 1169 偏大可能学生秒排除，改用更典型错：
        // 漏掉小数 0.5 → 45 × 8 + 38 × 6 = 360 + 228 = 588
        588.0,
        // 数字看错：篮球 5 元、足球 5 元 → 单错位
        546.0,
        // 加法不对位 → 45.5 × 8 = 364, 38 × 6 = 228, 但相加错位 → 5.92 元（漏 100 倍）
        5.92
      ]
    }
  ],
  "_internal_option_diagnostics": [
    { "id": "B", "errorTag": "relation_model_error" },
    { "id": "C", "errorTag": "missing_unit_price" },
    { "id": "D", "errorTag": "swapped_quantities" }
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
    { "text": "把两种球分开算 单价 × 数量，再相加", "penalty": 1 }
  ],
  "common_errors": [
    { "tag": "relation_model_error", "error": "把单价合并 / 数量合并", "remediation": "两种商品分别 单价 × 数量 再相加。" },
    { "tag": "careless_reading", "error": "把题里某个数字看错", "remediation": "圈出所有数字再算。" }
  ],
  "feedback_correct": "数量关系抓得准，分步算清楚！",
  "feedback_wrong": "再读一遍题，区分两种商品的单价和数量。",
  "tags": ["ai_generated", "word_problem"]
}
```

---

### 反例 vs 正例对照（必看）

#### ❌ 反例（果园那道 v0.31.71 实际生成的问题题）

```jsonc
"clues": [
  "苹果树和橘子树共 156 棵",
  "苹果树是橘子树的 6 倍",
  "设橘子树为 x 棵（解题设定，非已知）",   // P1 违反：标"（非已知）"
  "果园占地 2 公顷（无关）",                // P1 违反：标"（无关）"
  "果树都是三年生（无关）"                  // P1 违反
]
```
```jsonc
"options": [
  { "id": "A", "text": "x + 6x = 156", "correct": true },
  { "id": "B", "text": "6x - x = 156", "correct": false,
    "errorTag": "sum_vs_difference_confusion" }   // P1 违反：errorTag 在 student-visible
]
```
```jsonc
"distractors": [133.71, 26, 18]   // P3 违反：133.71 = 6x 的值，泄露
"value": 22.285714                 // P2 违反：果树不能小数
```

#### ✅ 正例（同一道题正确出法）

把数字调整为能整除的：「学校植树一二班共 156 棵，一班是二班 2 倍多 12 棵」→ x = 48 ✓

```jsonc
"clues": [
  "一二班共植 156 棵",                 // 中性陈述
  "一班是二班 2 倍多 12 棵",           // 中性陈述
  "今年是植树节",                      // 即使无关也只写中性陈述
  "操场上有体育课"                     // 无关条件混入，让学生自己判断
],
"correct": [0, 1]
```
```jsonc
"options": [
  { "id": "A", "text": "x + (2x + 12) = 156", "correct": true },
  { "id": "B", "text": "x + 2x + 12 = 156", "correct": false },
  { "id": "C", "text": "2x - 12 = 156", "correct": false },
  { "id": "D", "text": "x × 2 = 156", "correct": false }
],
"_internal_option_diagnostics": [
  { "id": "B", "errorTag": "missing_parens" },
  { "id": "C", "errorTag": "sum_vs_diff_confused" },
  { "id": "D", "errorTag": "ignores_offset" }
]
```
```jsonc
"distractors": [
  56,        // 156 ÷ 3 误解，没考虑 +12
  60,        // 156 ÷ 2 - 18 = 60，乱算
  72         // 156 ÷ 2 - 6，半套思路
]
"value": 48   // 整数 ✓
```

四个值（48 / 56 / 60 / 72）量级一致，区分度只来自"是否抓住 +12 偏移"。学生不算就蒙不到。

---

### 出题守则（搭配四原则）

1. **clues 必须是中性陈述**——别在文本里标"（无关）/（非已知）"。1-2 条无关条件混入，让学生自己判断
2. **错选项 NOT 挂 errorTag**——分类信息放 `_internal_option_diagnostics`
3. **distractor 必须是真实学生误解的产物**——不能用 题中数字的直接衍生（如 6x 的值、总数 / 倍数）
4. **stem 要有具体情境**（学校 / 商店 / 公园 / 家里），不要纯抽象 "甲乙两数"
5. **数字选择**：和倍 / 差倍题，总数必须能被 (倍数+1) 或 (倍数-1) 整除——4 年级答案不能是小数棵
6. **stem ≥ 60 字**比短题视觉信息丰富，鼓励长题

### ⛔ 常见格式陷阱

1. `answer.steps[i].expected` 必须是字符串或数字，不能是数组：
   - `clue` 步：用逗号拼接的字符串 `"0,1,2"`，不要 `[0,1,2]`
   - `relationship` 步：完整关系式字符串
   - `answer` 步：number（带 `kind: "answer"`）
2. `solution_steps` 是字符串数组，不是对象数组
3. `hints[].penalty` 是整数 1-3，不要浮点
